# Block Supply Chain Attack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有 Renovate プリセット `renovate.json5` にサプライチェーン攻撃防御層（14日ソーク / OSV / メジャー手動マージ / replacement 手動マージ）を追加する。

**Architecture:** 既存の `renovate.json5` を直接ハードニング。`extends: ["github>tqer39/renovate-config"]` を使っている全 consumer リポジトリに一括反映される。`vulnerabilityAlerts` は既存の automerge 挙動を維持しつつ、ソーク期間とスケジュール制約をバイパスするオーバーライドを追加。

**Tech Stack:** Renovate（JSON5 設定）、pre-commit フック（prek）、`renovate-config-validator`、markdownlint-cli2

**Spec:** `docs/superpowers/specs/2026-04-18-block-supply-chain-attack-design.md`

---

## File Structure

| ファイル | 変更種別 | 役割 |
| -------- | -------- | ---- |
| `renovate.json5` | 変更 | 共有 Renovate プリセット本体。本プランの全変更はここに集約 |
| `docs/superpowers/plans/2026-04-18-block-supply-chain-attack.md` | 新規 | この実装プラン |
| `default.json` | 変更なし | `renovate.json5` を extends するだけ。変更不要 |

---

## Task 1: トップレベルにサプライチェーン防御キーを追加

**Files:**

- Modify: `renovate.json5`（`labels: ["renovate"],` の直後に挿入）

**背景:** `minimumReleaseAge`（14日ソーク）、`osvVulnerabilityAlerts`（OSV 検知ソース）、`allowedPostUpgradeCommands`（空集合の明示）をトップレベルに追加する。これは後続タスクの基盤になる。

- [ ] **Step 1: 現在の `renovate.json5` の該当箇所を確認**

Run:

```bash
grep -n "labels:" renovate.json5
```

Expected: `18:  labels: ["renovate"],` に相当する行が存在することを確認。

- [ ] **Step 2: 3つの新トップレベル キーを追加**

`labels: ["renovate"],` 行の直後に以下を挿入:

```json5
  // Supply chain hardening: リリース即攻撃（xz-utils / npm worm 等）を14日間ソークで減速
  minimumReleaseAge: "14 days",
  // OSV.dev を検知ソースに追加（GitHub Advisory 単一ソース依存の緩和）
  osvVulnerabilityAlerts: true,
  // Renovate 自身が任意コマンドを実行しないことを明示
  allowedPostUpgradeCommands: [],
```

- [ ] **Step 3: バリデーション実行（pre-commit の renovate-config-validator のみ）**

Run:

```bash
prek run renovate-config-validator --all-files
```

Expected: `Passed`。Failed になった場合は JSON5 構文エラー（末尾カンマ・引用符）を確認して修正。

- [ ] **Step 4: 差分を目視確認**

Run:

```bash
git diff renovate.json5
```

Expected: 追加された3キーと3つのコメント行のみが差分に現れる。

- [ ] **Step 5: コミット**

```bash
git add renovate.json5
git commit -m "feat: add minimumReleaseAge and OSV alerts for supply chain defense"
```

Expected: pre-commit フック全通過。コミット作成成功（`renovate-config-validator` は `renovate.json5` 変更時に走る）。

---

## Task 2: `major` ブロックで automerge を無効化

**Files:**

- Modify: `renovate.json5`（`major: { addLabels: ["major"] }` ブロック）

**背景:** メジャー更新は悪意のあるメジャーリリース検知時間を確保するため、目視レビュー必須化する。

- [ ] **Step 1: 現在の `major` ブロックを確認**

Run:

```bash
grep -n -A 2 "^  major:" renovate.json5
```

Expected:

```text
  major: {
    addLabels: ["major"],
  },
```

- [ ] **Step 2: `major` ブロックに `automerge: false` を追加**

```json5
  major: {
    addLabels: ["major"],
    // メジャー更新は目視レビュー必須（悪意のあるメジャー リリース対策）
    automerge: false,
  },
```

- [ ] **Step 3: バリデーション**

Run:

```bash
prek run renovate-config-validator --all-files
```

Expected: `Passed`

- [ ] **Step 4: 差分を目視確認**

Run:

```bash
git diff renovate.json5
```

Expected: `major` ブロック内に 1 コメント行と `automerge: false,` のみ追加されている。

- [ ] **Step 5: コミット**

```bash
git add renovate.json5
git commit -m "feat: disable automerge for major updates"
```

Expected: コミット成功。

---

## Task 3: `vulnerabilityAlerts` のソーク/スケジュール オーバーライドを追加

**Files:**

- Modify: `renovate.json5`（`vulnerabilityAlerts` ブロック）

**背景:** Task 1 で全体に 14 日ソークと週末限定スケジュールを入れたため、このままだとセキュリティ修正 PR も 14 日遅延する。`vulnerabilityAlerts` 内でこの2つをバイパスして防御目的を維持する。

- [ ] **Step 1: 現在の `vulnerabilityAlerts` ブロックを確認**

Run:

```bash
grep -n -A 3 "vulnerabilityAlerts:" renovate.json5
```

Expected:

```text
  vulnerabilityAlerts: {
    automerge: true,
    labels: ["security"],
  },
```

- [ ] **Step 2: `vulnerabilityAlerts` にオーバーライドを追加**

```json5
  vulnerabilityAlerts: {
    automerge: true,
    labels: ["security"],
    // セキュリティ修正は 14日ソークを上書きして即適用（防御破綻防止）
    minimumReleaseAge: "0 days",
    // 週末スケジュール制約を解除（緊急性優先）
    schedule: ["at any time"],
  },
```

- [ ] **Step 3: バリデーション**

Run:

```bash
prek run renovate-config-validator --all-files
```

Expected: `Passed`

- [ ] **Step 4: 差分を目視確認**

Run:

```bash
git diff renovate.json5
```

Expected: `vulnerabilityAlerts` ブロック内に 2 コメント行と 2 キー (`minimumReleaseAge`, `schedule`) のみ追加されている。

- [ ] **Step 5: コミット**

```bash
git add renovate.json5
git commit -m "feat: bypass soak period and schedule for vulnerabilityAlerts"
```

Expected: コミット成功。

---

## Task 4: `packageRules` に `replacement` 更新を目視レビュー化するエントリを追加

**Files:**

- Modify: `renovate.json5`（`packageRules` 配列の末尾）

**背景:** Renovate の `replacement` 更新タイプは、旧パッケージを新パッケージ名に自動で付け替える挙動。悪意ある「rename 乗っ取り」攻撃の経路になりうるため、手動レビュー化する。

- [ ] **Step 1: `packageRules` 配列の末尾を確認**

Run:

```bash
grep -n "^    \],$" renovate.json5 | tail -3
```

Expected: `packageRules` 配列の閉じ `]` 行番号が見える（ファイル末尾付近）。末尾の要素は `matchUpdateTypes: ["minor", "patch"]` を持つ Python testing tools のルール。

- [ ] **Step 2: `packageRules` 末尾に新エントリを追加**

`packageRules: [` の閉じ `]` の直前に以下を追加（末尾カンマに注意: 配列内の直前要素には末尾カンマあり）:

```json5
    {
      // 依存置換（renameなど）は自動マージ禁止：悪意ある replacement 攻撃対策
      matchUpdateTypes: ["replacement"],
      automerge: false,
      addLabels: ["replacement"],
    },
```

- [ ] **Step 3: バリデーション**

Run:

```bash
prek run renovate-config-validator --all-files
```

Expected: `Passed`

- [ ] **Step 4: 差分を目視確認**

Run:

```bash
git diff renovate.json5
```

Expected: `packageRules` 配列末尾に新エントリ 1 つのみ追加。

- [ ] **Step 5: コミット**

```bash
git add renovate.json5
git commit -m "feat: disable automerge for replacement update type"
```

Expected: コミット成功。

---

## Task 5: プラン ドキュメントをコミット

**Files:**

- Create: `docs/superpowers/plans/2026-04-18-block-supply-chain-attack.md`（このファイル自体）

**背景:** プラン ファイルがまだコミットされていない場合、コミットする。

- [ ] **Step 1: プラン ファイルの未追跡状態を確認**

Run:

```bash
git status docs/superpowers/plans/
```

Expected: `Untracked files:` に `2026-04-18-block-supply-chain-attack.md` が表示される。既に追跡済みならこのタスクをスキップ可。

- [ ] **Step 2: コミット**

```bash
git add docs/superpowers/plans/2026-04-18-block-supply-chain-attack.md
git commit -m "docs: add implementation plan for block-supply-chain-attack"
```

Expected: コミット成功。markdownlint が走り通過する。

---

## Task 6: 全体検証と最終目視チェック

**Files:** 変更なし（検証のみ）

**背景:** 全変更をまとめて検証し、想定外の差分がないことを確認する。

- [ ] **Step 1: 全コミット履歴を確認**

Run:

```bash
git log --oneline main..HEAD
```

Expected: 以下のコミット（順序は実行順）:

```text
feat: add minimumReleaseAge and OSV alerts for supply chain defense
feat: disable automerge for major updates
feat: bypass soak period and schedule for vulnerabilityAlerts
feat: disable automerge for replacement update type
docs: add implementation plan for block-supply-chain-attack
```

- [ ] **Step 2: `renovate.json5` の最終差分を main と比較**

Run:

```bash
git diff main..HEAD -- renovate.json5
```

Expected: spec セクション「変更内容」の diff と一致。

- [ ] **Step 3: 全 pre-commit フック実行**

Run:

```bash
prek run --all-files
```

Expected: 全 hook `Passed`（または `Skipped`）。

- [ ] **Step 4: リモートへ push**

Run:

```bash
git push -u origin feature/block-supply-chain-attack
```

Expected: リモート ブランチ作成成功。

- [ ] **Step 5: PR 作成**

```bash
gh pr create --title "feat: block supply chain attacks via Renovate hardening" --body "$(cat <<'EOF'
## Summary

- `minimumReleaseAge: "14 days"` を導入し、新規リリースへの即日自動マージを停止
- `osvVulnerabilityAlerts: true` で OSV.dev を検知ソースに追加
- メジャー更新と `replacement` 更新を手動マージ化
- `vulnerabilityAlerts` は automerge を維持しつつソーク/スケジュールをバイパス

詳細は `docs/superpowers/specs/2026-04-18-block-supply-chain-attack-design.md` を参照。

## Test plan

- [x] `prek run --all-files` 全通過
- [ ] マージ後 24 時間、任意 consumer（例: blog / edu-quest）の Dependency Dashboard を確認
- [ ] リリース < 14 日のパッケージへの PR が作成されていないこと
- [ ] 脆弱性アラート時は 14 日待たず即 PR 化されること
EOF
)"
```

Expected: PR URL が返る。

---

## Rollback

業務支障が出た場合:

```bash
# 段階的緩和（14 → 7 日に短縮）
# renovate.json5 の minimumReleaseAge を "7 days" に変更してコミット/PR

# 完全ロールバック
git revert <merge-commit-sha>
```
