# ref-pre-commit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `renovate-config` リポジトリの pre-commit 実行系を `prek` から `lefthook` に移行する（Phase 1: 4 フックのみ）。

**Architecture:** `mise.toml` で Phase 1 のツール 5 種を宣言する。`lefthook.yml` では並列 4 ジョブを定義する。GitHub Actions では `jdx/mise-action` 経由でツールを導入し、続けて `lefthook run pre-commit --all-files` を走らせる。旧 `.pre-commit-config.yaml` と `prek.yml` は Phase 1 完了時点で削除する。

**Tech Stack:** lefthook / mise / biome / actionlint / shellcheck / GitHub Actions / Renovate

**Spec:** `docs/superpowers/specs/2026-04-18-ref-pre-commit-design.md`

**Worktree:** `.worktrees/ref-pre-commit-260418-4e5ec3`（branch `ref/pre-commit-260418-4e5ec3`）

---

## 前提

- 作業ディレクトリは上記 worktree 内（絶対パスは `/Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-pre-commit-260418-4e5ec3`）
- 現時点で `.pre-commit-config.yaml` は存在し、`git commit` のたびに prek フックが走る
- このリポには単体テストは無い。検証は「lefthook 自体が期待通り動くか」で行う
- mise は既にローカル環境に導入済み（ワークスペース共通）

## ファイル構成

### 作成するファイル

| Path | 責務 |
| --- | --- |
| `mise.toml` | このリポで使うツール（lefthook/actionlint/shellcheck/biome/node）のバージョン宣言 |
| `lefthook.yml` | pre-commit フック 4 本（並列実行） |
| `.github/workflows/lefthook.yml` | CI で lefthook を走らせるワークフロー |

### 削除するファイル

| Path | 理由 |
| --- | --- |
| `.pre-commit-config.yaml` | lefthook に一本化 |
| `.github/workflows/prek.yml` | lefthook ワークフローに一本化 |

### 変更するファイル

| Path | 変更内容 |
| --- | --- |
| `renovate.json5` | `"pre-commit": { enabled: true }` ブロックを削除 |
| `README.md` | 開発者向けセットアップ手順を `mise install` + `lefthook install` に更新 |

---

## Task 1: Preflight — mise-action の最新 SHA を取得

**Files:**

- Read: なし（ネットワーク取得のみ）

**背景:** `.github/workflows/lefthook.yml` で使う `jdx/mise-action` は SHA ピン運用。最新 v2 系 SHA を取得して記録する。

- [ ] **Step 1: mise-action の最新リリース SHA を取得**

```bash
gh api repos/jdx/mise-action/releases/latest --jq '{tag: .tag_name, sha: .target_commitish}'
# もし target_commitish が branch 名の場合は下記で tag の SHA を取る
TAG=$(gh api repos/jdx/mise-action/releases/latest --jq .tag_name)
gh api repos/jdx/mise-action/git/refs/tags/$TAG --jq '.object.sha'
# ※ tag が annotated の場合はさらに 1 段デリファレンス:
SHA=$(gh api repos/jdx/mise-action/git/refs/tags/$TAG --jq '.object.sha')
gh api repos/jdx/mise-action/git/tags/$SHA --jq '.object.sha' 2>/dev/null || echo $SHA
```

Expected: 40 文字の SHA と v2 系の tag。以降の Task で `MISE_ACTION_SHA` として使用。

- [ ] **Step 2: メモ**

取得した `tag` と `SHA` を手元にメモ（コミットはしない）。以降 Task 4 で使う。

---

## Task 2: `mise.toml` を作成

**Files:**

- Create: `mise.toml`

- [ ] **Step 1: `mise.toml` を作成**

```toml
[tools]
lefthook = "latest"
actionlint = "latest"
shellcheck = "latest"
biome = "latest"
node = "lts"
```

- [ ] **Step 2: mise でツールを解決**

```bash
mise install
```

Expected: 5 つのツールすべてがインストール成功。stderr にエラーなし。

- [ ] **Step 3: 各ツールのバージョンを確認**

```bash
mise exec -- lefthook version
mise exec -- actionlint -version
mise exec -- shellcheck --version | head -2
mise exec -- biome --version
mise exec -- node --version
```

Expected: 全コマンドが終了コード 0、バージョン文字列が表示される。

- [ ] **Step 4: コミット**

```bash
git add mise.toml
git commit -m "feat: add mise.toml with lefthook and Phase 1 tools"
```

Expected: prek フックが通過してコミット成立。`mise.toml` 自体は検査対象外なので lint 影響なし。

---

## Task 3: `lefthook.yml` を作成

**Files:**

- Create: `lefthook.yml`

- [ ] **Step 1: `lefthook.yml` を作成**

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

- [ ] **Step 2: lefthook のバリデーション**

```bash
mise exec -- lefthook validate
```

Expected: 終了コード 0、`Validation OK` 相当の出力。

- [ ] **Step 3: lefthook の install（この段階ではまだ prek 側のフックが有効）**

注意: `lefthook install` は `.git/hooks/pre-commit` を置き換える。worktree は `.git/hooks` を親リポと共有するため、この操作は親リポの `pre-commit` も差し替える。Phase 1 移行が完了するまで、親リポで commit する際は注意。

```bash
mise exec -- lefthook install
```

Expected: `.git/hooks/pre-commit` が lefthook 実行スクリプトに差し替えられる。

- [ ] **Step 4: 全ファイルに対して lefthook を実行**

```bash
mise exec -- lefthook run pre-commit --all-files
```

Expected: 4 ジョブが並列実行され、すべて成功（終了コード 0）。もし失敗したら各ジョブのログを確認し、本 Plan の想定外の不整合があるかを洗い出す（例: 既存 workflow に actionlint 違反がある等）。違反があれば Task 内で修正コミット（新たな Step 4a を追加）し、再実行して成功を確認。

- [ ] **Step 5: コミット**

```bash
git add lefthook.yml
git commit -m "feat: add lefthook.yml with Phase 1 pre-commit hooks"
```

Expected: lefthook がセルフ適用され、4 ジョブ全て pass。prek フックはまだ残っているが、`.git/hooks/pre-commit` は Step 3 で上書き済みのため、実際に走るのは lefthook。prek は commit には干渉しない。

---

## Task 4: CI ワークフロー `.github/workflows/lefthook.yml` を作成

**Files:**

- Create: `.github/workflows/lefthook.yml`

- [ ] **Step 1: ワークフローファイルを作成**

`MISE_ACTION_SHA` と `MISE_ACTION_TAG` は Task 1 で取得した値を埋める。

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
        uses: jdx/mise-action@MISE_ACTION_SHA  # MISE_ACTION_TAG

      - name: Run lefthook
        run: lefthook run pre-commit --all-files
```

- [ ] **Step 2: ローカルで actionlint による自己検証**

```bash
mise exec -- actionlint .github/workflows/lefthook.yml
```

Expected: 終了コード 0、違反なし。違反があれば修正してから再実行。

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/lefthook.yml
git commit -m "ci: add lefthook workflow"
```

Expected: lefthook hook 4 ジョブが全 pass。特に actionlint ジョブが新規 workflow を検査し green になることを確認。

---

## Task 5: 旧 `prek.yml` ワークフローを削除

**Files:**

- Delete: `.github/workflows/prek.yml`

- [ ] **Step 1: ファイル削除**

```bash
git rm .github/workflows/prek.yml
```

- [ ] **Step 2: コミット**

```bash
git commit -m "ci: remove prek workflow (replaced by lefthook)"
```

Expected: lefthook hook 通過。CI 側では次回 PR 以降、prek チェックが消える。

---

## Task 6: `.pre-commit-config.yaml` を削除

**Files:**

- Delete: `.pre-commit-config.yaml`

- [ ] **Step 1: ファイル削除**

```bash
git rm .pre-commit-config.yaml
```

- [ ] **Step 2: lefthook で最終チェック**

```bash
mise exec -- lefthook run pre-commit --all-files
```

Expected: 4 ジョブ全て pass。`.pre-commit-config.yaml` は lefthook のどの glob にもマッチしないため、削除のみで問題ない。

- [ ] **Step 3: コミット**

```bash
git commit -m "chore: remove .pre-commit-config.yaml (migrated to lefthook)"
```

Expected: コミット成立。

---

## Task 7: `renovate.json5` から pre-commit manager 設定を削除

**Files:**

- Modify: `renovate.json5`

- [ ] **Step 1: 現状確認**

```bash
grep -n "pre-commit" renovate.json5
```

Expected: `"pre-commit": { enabled: true },` の行番号を特定（現在は約 30 行目）。

- [ ] **Step 2: 該当ブロックを削除**

`renovate.json5` から以下を削除:

```json5
"pre-commit": {
  enabled: true,
},
```

削除後、前後の行のカンマと空行を JSON5 として妥当な状態に保つ。

- [ ] **Step 3: lefthook の renovate-config-validator で検証**

```bash
mise exec -- lefthook run pre-commit --files renovate.json5
```

Expected: `renovate-config-validator` ジョブが実行され成功。他 3 ジョブは glob 不一致でスキップ。

- [ ] **Step 4: コミット**

```bash
git add renovate.json5
git commit -m "chore(renovate): remove pre-commit manager config"
```

Expected: lefthook hook で renovate-config-validator が通過。

---

## Task 8: `README.md` のセットアップ手順を更新

**Files:**

- Modify: `README.md`

- [ ] **Step 1: 現状確認**

```bash
grep -n -i "pre-commit\|prek" README.md
```

Expected: prek/pre-commit への言及箇所（あれば）の行番号を把握。無ければ Step 2 で新規セクション追加のみ。

- [ ] **Step 2: README に開発者セットアップセクションを追加／更新**

下記内容を `## Usage` の前、または既存の開発者向けセクション内に挿入（ファイル内の位置は現状確認後に決定）:

````markdown
## Development

このリポジトリの pre-commit フックは [lefthook](https://lefthook.dev/) で管理する。

### セットアップ

```bash
mise install          # lefthook / actionlint / shellcheck / biome / node を導入
lefthook install      # .git/hooks/pre-commit に lefthook を登録
```

### ローカルで全ファイル検査

```bash
lefthook run pre-commit --all-files
```
````

既に prek / pre-commit に関する記述があれば、それらを削除または書き換える。

- [ ] **Step 3: lefthook で検証**

```bash
mise exec -- lefthook run pre-commit --files README.md
```

Expected: 4 ジョブとも README.md に対する glob 不一致でスキップ（markdown はどの Phase 1 フックの対象でもない）。終了コード 0。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "docs: update setup instructions for lefthook"
```

Expected: lefthook hook 通過。

---

## Task 9: 失敗パターンの検証（commit しない）

**Files:** なし（一時的な破壊テスト）

**目的:** 4 ジョブがそれぞれ意図した失敗を検出できることを確認する。各検証後は必ず `git restore` で戻す。

- [ ] **Step 1: renovate-config-validator が失敗することを確認**

```bash
cp renovate.json5 /tmp/renovate.json5.bak
printf '\nbroken_key: not_valid_json5_top_level\n' >> renovate.json5
mise exec -- lefthook run pre-commit --files renovate.json5
```

Expected: `renovate-config-validator` ジョブが失敗、終了コード非 0。

```bash
cp /tmp/renovate.json5.bak renovate.json5
rm /tmp/renovate.json5.bak
```

- [ ] **Step 2: actionlint が失敗することを確認**

```bash
cp .github/workflows/lefthook.yml /tmp/lefthook-workflow.bak
sed -i '' 's/ runs-on: ubuntu-latest/  runs-on: ubuntu-latest\n      unknown-key: true/' .github/workflows/lefthook.yml
mise exec -- lefthook run pre-commit --files .github/workflows/lefthook.yml
```

Expected: `actionlint` ジョブが失敗、終了コード非 0。

```bash
cp /tmp/lefthook-workflow.bak .github/workflows/lefthook.yml
rm /tmp/lefthook-workflow.bak
```

- [ ] **Step 3: shellcheck が失敗することを確認**

```bash
cat > /tmp/shellcheck-test.sh <<'SH'
#!/bin/bash
if [ $UNSET_VAR = "x" ]; then echo hi; fi
SH
cp /tmp/shellcheck-test.sh ./_tmp_test.sh
git add ./_tmp_test.sh
mise exec -- lefthook run pre-commit --files ./_tmp_test.sh
```

Expected: `shellcheck` ジョブが失敗（SC2086 等）、終了コード非 0。

```bash
git rm --cached ./_tmp_test.sh
rm ./_tmp_test.sh /tmp/shellcheck-test.sh
```

- [ ] **Step 4: biome-format が差分を検出することを確認**

```bash
cat > ./_tmp_test.ts <<'TS'
const   x    =    1 ;
TS
git add ./_tmp_test.ts
mise exec -- lefthook run pre-commit --files ./_tmp_test.ts
```

Expected: `biome-format` ジョブが実行され、`stage_fixed: true` により `_tmp_test.ts` が整形されてステージされる。終了コード 0。

```bash
git rm --cached ./_tmp_test.ts
rm ./_tmp_test.ts
```

- [ ] **Step 5: ワークツリーがクリーンであることを確認**

```bash
git status
```

Expected: `nothing to commit, working tree clean`。

**注意:** このタスクでは一切コミットしない。あくまで動作検証のみ。

---

## Task 10: PR を作成して CI で検証

**Files:** なし（push と PR 作成のみ）

- [ ] **Step 1: ブランチを push**

```bash
git push -u origin ref/pre-commit-260418-4e5ec3
```

- [ ] **Step 2: PR を作成**

```bash
gh pr create --title "ref: prek から lefthook に移行 (Phase 1)" --body "$(cat <<'EOF'
## Summary

- `.pre-commit-config.yaml` / `prek` を廃止し、`lefthook` + `mise` で pre-commit フックを管理するよう移行（Phase 1: 4 フックのみ）
- CI ワークフローを `prek.yml` → `lefthook.yml` に一本化
- `renovate.json5` から `pre-commit` manager 設定を削除

Spec: `docs/superpowers/specs/2026-04-18-ref-pre-commit-design.md`
Plan: `docs/superpowers/plans/2026-04-18-ref-pre-commit.md`

## Phase 1 のフック

- `renovate-config-validator` (npx)
- `biome-format`
- `actionlint`
- `shellcheck`

## Test plan

- [x] ローカル `lefthook run pre-commit --all-files` 成功
- [x] 4 フックの失敗パターン検証（Task 9）
- [ ] CI で `lefthook` ワークフロー green
- [ ] `prek` チェックが PR から消えている
EOF
)"
```

- [ ] **Step 3: CI を確認**

```bash
gh pr checks --watch
```

Expected: `lefthook` チェックが success、`prek` チェックは存在しない。

- [ ] **Step 4: CI green を確認**

失敗した場合はログを取得して原因調査:

```bash
gh run list --branch ref/pre-commit-260418-4e5ec3 --limit 5
gh run view <run-id> --log-failed
```

Expected: `lefthook` ワークフローの `Run lefthook` ステップが成功。

---

## Task 11: マージ後のクリーンアップ計画（この Plan 完了後、別ブランチで実施）

- マージ後、Phase 2 の spec 作成を別ブランチで開始
- Phase 2 で追加予定: cspell / markdownlint-cli2 / textlint / prettier / detect-aws-credentials / detect-private-key / ハイジーン系 + pre-push / commit-msg 検討

本 Plan のスコープ外。ここでは記録のみ。

---

## 検証サマリ（Plan 完了条件）

1. `lefthook run pre-commit --all-files` がローカルで 0 で終了
2. Task 9 の 4 つの失敗パターンを確認済み
3. `.pre-commit-config.yaml` と `.github/workflows/prek.yml` がリポジトリから消えている
4. `renovate.json5` に `"pre-commit":` を含む行が存在しない
5. `README.md` に `mise install && lefthook install` の手順が記載
6. PR CI で `lefthook` チェックが green、`prek` チェックが存在しない

全部 ✅ で Phase 1 完了、マージ可能とみなす。
