# Spec: prek から lefthook への移行（Phase 1）

- Date: 2026-04-18
- Topic: `ref-pre-commit`
- Branch: `ref/pre-commit-260418-4e5ec3`
- Repo: `tqer39/renovate-config`

## 1. 背景と目的

このリポジトリは `pre-commit` → `prek`（Rust 製互換ランナー）への移行済みで、`.pre-commit-config.yaml` で 13 個のフック（prek builtin 4 + 外部 repo 9）を運用している。CI は `j178/prek-action@v2` で `--all-files` 実行。

以下の動機により、さらに `lefthook`（Go 製の Git フックマネージャ）へ移行する。

1. **並列実行による高速化** — lefthook は複数ジョブを実質並列実行できる（prek は実質逐次）
2. **設定の簡潔さ** — `repo: builtin` / 外部 repo / `local` の混在を排し、フラットな `lefthook.yml` に書き直す
3. **pre-commit 以外のステージ活用** — `pre-push` / `commit-msg` / `prepare-commit-msg` 等を将来的に使いたい
4. **探索的導入** — 新しい標準として他リポにも展開する前に、このリポで検証したい

## 2. スコープ

### 含まれるもの (Phase 1)

現行 13 フックのうち、以下 4 つのみを `lefthook.yml` に移植する。

| Hook | 役割 | 優先理由 |
| --- | --- | --- |
| `renovate-config-validator` | `renovate.json5` 検証 | このリポの本分 |
| `biome-format` | JSON/TS/YAML フォーマット | Rust 製で並列の恩恵大 |
| `actionlint` | GitHub Actions lint | Go 製で軽量 |
| `shellcheck` | シェルスクリプト lint | Go 呼び出しの外部バイナリ |

### 含まれないもの (Phase 2 以降に先送り)

- prek builtin 相当のハイジーン系: `check-added-large-files` / `end-of-file-fixer` / `mixed-line-ending` / `trailing-whitespace`
- `cspell` / `markdownlint-cli2` / `textlint` / `prettier` (YAML 専用) / `detect-aws-credentials` / `detect-private-key`
- `pre-push` / `commit-msg` 等の新ステージ導入

### 非目標

- 他リポの `.pre-commit-config.yaml` 書き換え（本リポ単体の移行）
- `renovate.json5` の共有設定内容の変更

## 3. アーキテクチャ

### 追加するファイル

| Path | 内容 |
| --- | --- |
| `lefthook.yml` | Phase 1 の 4 フック定義（`pre-commit` ステージ、`parallel: true`） |
| `mise.toml` | `lefthook` / `actionlint` / `shellcheck` / `biome` / `node` を [tools] に記載 |
| `.github/workflows/lefthook.yml` | CI ワークフロー。`mise-action` → `lefthook run pre-commit --all-files` |

### 削除するファイル

| Path | 理由 |
| --- | --- |
| `.pre-commit-config.yaml` | Phase 1 で全 4 フックを lefthook へ移すため即削除。Phase 2 以降も戻さない |
| `.github/workflows/prek.yml` | 旧 CI。`lefthook.yml` に一本化 |

### 変更するファイル

| Path | 変更内容 |
| --- | --- |
| `README.md` | 開発者向けセットアップ手順を `mise install` + `lefthook install` に更新 |
| `renovate.json5` | `pre-commit` manager を無効化し、`mise` manager を有効化 |

## 4. 詳細設計

### 4.1 `lefthook.yml`

```yaml
# lefthook.yml
# https://lefthook.dev/configuration/
pre-commit:
  parallel: true
  jobs:
    - name: renovate-config-validator
      glob: "renovate.json5"
      run: npx --yes --package=renovate -- renovate-config-validator {staged_files}

    - name: biome-format
      glob: "*.{js,jsx,ts,tsx,json,jsonc,json5}"
      run: biome format --write {staged_files}
      stage_fixed: true

    - name: actionlint
      glob: ".github/workflows/*.{yml,yaml}"
      run: actionlint {staged_files}

    - name: shellcheck
      glob: "*.{sh,bash}"
      run: shellcheck {staged_files}
```

設計根拠:

- **`parallel: true`**: 動機 1。4 ジョブが独立しているため衝突しない
- **`glob`**: `staged_files` は lefthook が暗黙に glob フィルタを適用。対象 0 件なら自動スキップ
- **`stage_fixed: true`** は biome-format のみ: 自動整形結果を再ステージ
- **`renovate-config-validator` の実行**: Go/Rust 製バイナリが公式提供されていないため `npx --yes --package=renovate` で実行（初回のみキャッシュ作成）
- **`commands:` ではなく `jobs:`**: 最新 lefthook の推奨構文。`name` が明示でき出力が読みやすい

### 4.2 `mise.toml`

```toml
[tools]
lefthook = "latest"
actionlint = "latest"
shellcheck = "latest"
biome = "latest"
node = "lts"
```

設計根拠:

- Phase 1 では `latest` を採用し、Phase 2 で Renovate の mise manager と versioning を整えた時点でバージョンピン
- `node = "lts"` は `npx` 経由の `renovate-config-validator` 実行に必要
- ワークスペース共通 CLAUDE.md の「mise で言語・ツールを管理」方針に準拠

### 4.3 `.github/workflows/lefthook.yml`

```yaml
---
name: lefthook

on:
  push:
    branches:
      - main
  pull_request:

concurrency:
  cancel-in-progress: true
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  lefthook:
    name: lefthook
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd  # v6
        with:
          ref: ${{ github.head_ref }}

      - name: Setup mise
        uses: jdx/mise-action@<pinned-sha>  # 実装時に最新の v2 系 SHA を取得

      - name: Run lefthook
        run: lefthook run pre-commit --all-files
```

設計根拠:

- トリガ・concurrency・timeout は旧 `prek.yml` と同等（既存運用の維持）
- `jdx/mise-action` で `mise.toml` を解釈し全ツールを一括インストール
- `--all-files` で PR 時に全ファイルを検査

### 4.4 `renovate.json5` の調整

現状は `pre-commit` manager で `.pre-commit-config.yaml` の `rev:` を追従している。移行に伴い:

- `pre-commit` manager を `"enabledManagers"` から除外
- `mise` manager を追加して `mise.toml` を追従対象に
- `regexManagers` で `actions/*@<sha>` 形式のピンを維持する場合は別途確認

具体的な diff 設計は writing-plans フェーズで詰める。

## 5. データフロー

### ローカル

```text
$ git commit
  └─ lefthook pre-commit hook
      ├─ job renovate-config-validator (glob: renovate.json5)
      ├─ job biome-format              (glob: *.{js,ts,json5,...})
      ├─ job actionlint                (glob: .github/workflows/*.yml)
      └─ job shellcheck                (glob: *.sh)
         (parallel: true)
  └─ stage_fixed が反映されて commit 成立 / 失敗時は commit 中断
```

### CI

```text
PR push
  └─ GH Actions: lefthook workflow
      └─ checkout → mise install → lefthook run pre-commit --all-files
         └─ 成功: check green / 失敗: PR ブロック
```

## 6. エラーハンドリング

- ツール未インストール（ローカル）: `mise install` を README に明記。未実行なら `lefthook` 本体が exit で失敗 → `mise install` 案内
- CI キャッシュミス: `mise-action` の内部キャッシュに任せる（Phase 1 では個別キャッシュ設定しない）
- `npx` ネットワーク失敗: CI で `npx --yes --package=renovate` が断続失敗する場合は Phase 2 でキャッシュ導入を検討
- ロック競合: lefthook は並列実行時のジョブ間共有リソース無し（設計上衝突しない）

## 7. 検証方法

以下を順に実施し、全て成功したら Phase 1 完了とする。

1. **ローカル install 検証**
   - `mise install` が成功
   - `lefthook install` が `.git/hooks/pre-commit` を作成
2. **ローカル実行検証**
   - `lefthook run pre-commit --all-files` が成功（終了コード 0）
   - 実行時間が prek 実行時より短い（並列効果の確認）
3. **各フック失敗パターン検証**（独立 commit で確認後破棄）
   - `renovate.json5` を意図的に JSON として壊す → `renovate-config-validator` が失敗
   - `.github/workflows/*.yml` の `steps` キーを typo → `actionlint` が失敗
   - 簡易 `.sh` で `[[` を `[` に書き換える等 → `shellcheck` が失敗
   - `*.ts` に余分なインデント → `biome-format` が `stage_fixed` で修正
4. **CI 検証**
   - 本ブランチの PR で `lefthook` ワークフローが green
   - `prek` ワークフローが存在しない（GH checks 一覧に出ない）
5. **後続 PR で Renovate が動くこと**
   - `mise.toml` 内のツール更新 PR が生成されるか Phase 1 完了後に観察（必要なら Phase 2 で調整）

## 8. ロールアウト計画

- **Phase 1（本 spec）**: 上記 4 フック + CI 切替 + README 更新 + renovate.json5 最小調整
- **Phase 2（別 spec）**: C/D カテゴリのフック移植、`pre-push` / `commit-msg` 検討、mise バージョンピン、CI キャッシュ最適化

## 9. オープン事項（実装フェーズで確定）

- `jdx/mise-action` の最新 v2 系 SHA
- Renovate `regexManagers` を新設すべきか（mise manager 単体で十分か）
- `biome` が `mise` 公式レジストリで `latest` 解決可能か（不可なら `aqua:biomejs/biome` へフォールバック）

これらは `writing-plans` フェーズで解決する。

## 10. 参考リンク

- lefthook 公式: <https://lefthook.dev/>
- lefthook configuration: <https://lefthook.dev/configuration/>
- mise 公式: <https://mise.jdx.dev/>
- Renovate config validator: <https://docs.renovatebot.com/config-validation/>
