# Design: Block Supply Chain Attack via Renovate Hardening

- 日付: 2026-04-18
- ブランチ: `feature/block-supply-chain-attack`
- 対象: `renovate.json5`（共有プリセット本体）

## 背景・目的

`tqer39/renovate-config` は `github>tqer39/renovate-config` として 17 リポジトリから extends される共有プリセット。現状は `automerge: true` かつ `vulnerabilityAlerts.automerge: true` により、メジャー更新を含めほぼ全ての依存更新が自動マージされる。

近年のサプライチェーン攻撃（`xz-utils`、`@ctrl/tinycolor` ワーム、`ua-parser-js` 侵害等）は「正規パッケージの新リリースに悪性コードが仕込まれて数時間〜数日以内に検出される」パターンが主流。**自動マージ前提の現構成はこの期間に直撃する**。

本設計は Renovate の機能だけで、extends している全リポジトリに一括で供給可能な防御層を追加する。

## 合意事項（ブレスト結果）

| 項目 | 決定 |
| ---- | ---- |
| スコープ | 既存プリセット `renovate.json5` を直接ハードニング（新サブプリセット不要） |
| ソーク期間 | `minimumReleaseAge: "14 days"` |
| 検知ソース | OSV.dev を追加（`osvVulnerabilityAlerts: true`） |
| 新規パッケージ / メジャー automerge | 無効化（手動レビュー必須） |
| `replacement` 更新 automerge | 無効化 |
| 脆弱性アラート automerge | 維持（ユーザー指示）。ただしソーク期間とスケジュールをバイパス |
| Renovate 側コマンド実行 | `allowedPostUpgradeCommands: []` で空を明示 |

## 変更内容

`renovate.json5` に以下を追加・変更する。

```diff
 {
   $schema: "https://docs.renovatebot.com/renovate-schema.json",
   extends: [
     "config:recommended",
     "helpers:pinGitHubActionDigests",
   ],
   timezone: "Asia/Tokyo",
   schedule: ["after 0:00 before 6:00 every weekend"],
   automerge: true,
   automergeSchedule: ["after 0:00 before 6:00 every weekday"],
   automergeStrategy: "squash",
   automergeType: "pr",
   platformAutomerge: true,
   prHourlyLimit: 0,
   separateMajorMinor: true,
   separateMultipleMajor: true,
   dependencyDashboard: true,
   labels: ["renovate"],
+  // Supply chain hardening: リリース即攻撃（xz-utils / npm worm 等）を14日間ソークで減速
+  minimumReleaseAge: "14 days",
+  // OSV.dev を検知ソースに追加（GitHub Advisory 単一ソース依存の緩和）
+  osvVulnerabilityAlerts: true,
+  // Renovate 自身が任意コマンドを実行しないことを明示
+  allowedPostUpgradeCommands: [],
   major: {
     addLabels: ["major"],
+    // メジャー更新は目視レビュー必須（悪意のあるメジャー リリース対策）
+    automerge: false,
   },
   minor: {
     addLabels: ["minor"],
   },
   patch: {
     addLabels: ["patch"],
   },
   "pre-commit": {
     enabled: true,
   },
   vulnerabilityAlerts: {
     automerge: true,
     labels: ["security"],
+    // セキュリティ修正は 14日ソークを上書きして即適用（防御破綻防止）
+    minimumReleaseAge: "0 days",
+    // 週末スケジュール制約を解除（緊急性優先）
+    schedule: ["at any time"],
   },
   packageRules: [
     // ... 既存ルールはそのまま ...
+    {
+      // 依存置換（renameなど）は自動マージ禁止：悪意ある replacement 攻撃対策
+      matchUpdateTypes: ["replacement"],
+      automerge: false,
+      addLabels: ["replacement"],
+    },
   ],
 }
```

## 設計の決め手

### なぜ `minimumReleaseAge` を 14 日にしたか

- 直近の重大インシデントの発覚までの期間: `@ctrl/tinycolor` 数日、`ua-parser-js` 約 4 時間、`xz-utils` 約 1 ヶ月
- 7 日ではカバーしきれないケース（`xz-utils` 相当の長期潜伏）に備える
- 自動マージ速度が重要な一部パッケージ（例: patch の緊急修正）は既存 `vulnerabilityAlerts` 経由で 0 day バイパス可能

### なぜ `vulnerabilityAlerts` の `automerge` を据え置きにしたか

- ユーザー判断で維持。CVE 対応の速度を保つため
- ただし `minimumReleaseAge: "0 days"` と `schedule: ["at any time"]` を明示して、他設定による意図しない遅延を防ぐ

### なぜサブプリセット化せず既存プリセット本体を直接変更するか

- `extends: ["github>tqer39/renovate-config"]` を使う全 17 リポジトリを一括でハードニングしたい
- 個別 opt-in 方式は採用漏れが発生しやすい
- 影響が過剰な場合は期間短縮（14 → 7 日など）で段階的に緩和可能

## 影響・副作用

- 全 consumer の自動マージ速度が平均 14 日遅延。業務影響は小（週末スケジュール運用のため元から日次更新ではない）
- メジャー更新は手動マージ必須に。既存 `nodenv` / `pyenv` の個別 `major.automerge: false` 設定と重複するが害はない
- 脆弱性対応は従来通り即応可能

## 検証

### 静的検証

- `prek run renovate-config-validator --all-files`（pre-commit フック。コミット時自動実行）
- `.github/workflows/prek.yml` が PR で同じチェックを実施

### 意図検証

- PR 説明に Renovate 公式ドキュメントへのリンクを添付:
  - [minimumReleaseAge](https://docs.renovatebot.com/configuration-options/#minimumreleaseage)
  - [osvVulnerabilityAlerts](https://docs.renovatebot.com/configuration-options/#osvvulnerabilityalerts)
  - [vulnerabilityAlerts](https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts)

### E2E 検証

1. **Step A（変更前）**: 任意の consumer リポジトリ（例: `blog` / `edu-quest`）の Dependency Dashboard を記録
2. **Step B**: この PR を main にマージ
3. **Step C（24 時間後）**: 同 consumer の Dashboard を確認
   - ✅ リリース日 < 14 日前のパッケージに対する PR が存在しない
   - ✅ 新規 PR のリリース日がすべて ≥14 日前
   - ✅ 人工的に脆弱性アラートを発生させた場合、14 日待たず即 PR 化される（必要なら `npm audit` 相当で既知 CVE を含む古い依存を一時的に入れて試験）

## ロールバック戦略

- 予期せぬ業務支障 → `minimumReleaseAge` を `"7 days"` に短縮（段階的緩和）
- それでも問題 → 本 PR を revert。プリセット extends 構造は無変更のため影響は最小

## 今後の検討（本プラン対象外）

- ⑥ 推奨事項（`ignoreScripts: true` など npm 側の対策）を README に追記
- consumer 側でサブプリセットを `extends` 追加する opt-in 強化（B 案）の再検討
- Dependabot との併用検討（OSV 検知の重複可否）

## 関連ファイル

- `renovate.json5`（変更対象）
- `default.json`（変更不要。`renovate.json5` を extends するのみ）
- `.pre-commit-config.yaml`（`renovate-config-validator` フック）
- `.github/workflows/prek.yml`（CI 検証）
