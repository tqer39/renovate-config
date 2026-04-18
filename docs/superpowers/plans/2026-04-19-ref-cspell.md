# ref-cspell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `cspell.json` にインライン定義されている `words` 配列を外部辞書 `.cspell/custom-words.txt` に移設し、設定をスリム化する。

**Architecture:** 新規に `.cspell/custom-words.txt` を作成し、既存 `words` 配列 44 件を case 重複統合＋小文字正規化したうえでアルファベット順に書き出す。`cspell.json` 側からは `words` キーを削除する。`dictionaryDefinitions` は既に `.cspell/custom-words.txt` を `addWords: true` で参照しているため、移設後も挙動は等価になる。

**Tech Stack:** cspell / JSON / プレーンテキスト

**Spec:** `docs/superpowers/specs/2026-04-18-ref-cspell-design.md`

**Worktree:** `.worktrees/ref-cspell`（branch `ref/cspell`）

---

## 前提

- 作業ディレクトリは worktree 内: `/Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell`
- このリポには単体テストは無い。検証は「cspell の未知語レポートが移設前後で同じか」で行う
- `npx cspell` はプロジェクトに cspell が未インストールでも都度 DL して実行できる
- コミットメッセージは絵文字プレフィックス＋日本語要約（リポの慣習）

## ファイル構成

### 作成するファイル

| Path | 責務 |
| --- | --- |
| `.cspell/custom-words.txt` | プロジェクト固有のカスタム辞書（1 行 1 単語） |

### 変更するファイル

| Path | 変更内容 |
| --- | --- |
| `cspell.json` | `words` 配列を削除 |

### 削除するファイル

なし。

---

## Task 1: 移設前のベースラインを取る

**目的:** 移設前後で cspell の未知語検出結果が変わらないことを保証するため、pre-state を記録する。

**Files:**
- Create (一時的): `/tmp/cspell-before.txt`

- [ ] **Step 1: worktree に移動し、コミット対象外の場所に pre-state を保存する**

```bash
cd /Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell
npx --yes cspell "**/*" --no-progress --no-summary --no-color 2>&1 | sort > /tmp/cspell-before.txt
wc -l /tmp/cspell-before.txt
```

Expected: 行数が表示される（未知語があれば 0 以外。現状は既知語しか `words` に無いので 0 の可能性が高い）。エラーで落ちないこと。

- [ ] **Step 2: 出力に明らかな異常がないか確認する**

```bash
head -20 /tmp/cspell-before.txt
```

Expected: cspell の通常出力。`Error` や `CSpell: Files checked` のような想定外のサマリ行が残っていないこと（`--no-summary` で抑制されているはず）。

---

## Task 2: `.cspell/custom-words.txt` を作成する

**目的:** 既存 `words` 配列 44 件を正規化したカスタム辞書ファイルを作成する。

**Files:**
- Create: `.cspell/custom-words.txt`

### 正規化ルール（仕様の再掲）

- case 重複統合: `autobuild` / `Autobuild` → `autobuild`、`openrouter` / `OPENROUTER` → `openrouter`
- 小文字化: `CODEOWNERS` → `codeowners`、`Datasources` → `datasources`、`SSIA` → `ssia`、`Takeru` → `takeru`
- 例外: `O'oyama`（アポストロフィ入り固有名詞）は原形維持
- 並び: アルファベット順（case-insensitive）。`O'oyama` は `ooyama` の直前に配置
- 末尾改行あり
- 件数: 44 - 2（case 重複） = **42 行**

- [ ] **Step 1: ディレクトリを作成する**

```bash
mkdir -p .cspell
```

- [ ] **Step 2: `.cspell/custom-words.txt` を以下の内容で作成する**

```
adrienverge
antonbabenko
autobuild
autofix
automerge
awsebcli
buildscript
buildx
codeowners
codeql
datasource
datasources
dateutil
dotenv
freezegun
igorshubovych
kentaro
markdownlint
moto
mypy
nodenv
oneline
O'oyama
ooyama
openai
openrouter
powertools
prek
pyenv
pytest
renovatebot
reviewdog
rinchsan
setuptools
shellcheck
ssia
takeru
textlint
textlintcache
tflint
tqer
vercel
```

- [ ] **Step 3: 行数が 42 であることを確認する**

```bash
wc -l .cspell/custom-words.txt
```

Expected: `42 .cspell/custom-words.txt`

- [ ] **Step 4: 末尾改行があることを確認する**

```bash
tail -c 1 .cspell/custom-words.txt | od -c | head -1
```

Expected: `0000000  \n` を含む出力（末尾が改行であること）。

---

## Task 3: `cspell.json` から `words` 配列を削除する

**目的:** 外部辞書ファイルに移設したため、インラインの `words` 配列を取り除く。

**Files:**
- Modify: `cspell.json`

- [ ] **Step 1: `cspell.json` を以下の内容に書き換える**

```json
{
  "files": ["**", ".*/**"],
  "ignorePaths": [".git", ".gitignore"],
  "dictionaryDefinitions": [
    {
      "name": "custom-words",
      "path": "./.cspell/custom-words.txt",
      "addWords": true
    }
  ]
}
```

- [ ] **Step 2: JSON として valid であることを確認する**

```bash
npx --yes jsonlint cspell.json >/dev/null && echo OK
```

Expected: `OK` が出る。

（`jsonlint` が無い環境では `python3 -c "import json; json.load(open('cspell.json'))" && echo OK` でも可）

---

## Task 4: 移設後の cspell 出力がベースラインと一致することを確認する

**目的:** 移設前後で未知語レポートに差分が出ないことを確認する。

**Files:**
- 新規作成なし
- Create (一時的): `/tmp/cspell-after.txt`

- [ ] **Step 1: 移設後の出力を取得する**

```bash
cd /Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell
npx --yes cspell "**/*" --no-progress --no-summary --no-color 2>&1 | sort > /tmp/cspell-after.txt
wc -l /tmp/cspell-after.txt
```

Expected: Task 1 Step 1 と同じ行数。

- [ ] **Step 2: 差分を取る**

```bash
diff /tmp/cspell-before.txt /tmp/cspell-after.txt && echo "IDENTICAL"
```

Expected: `IDENTICAL` が出る（差分ゼロ）。

差分が出た場合は、`.cspell/custom-words.txt` の case 統合や抜けを疑う。特に `Datasources` のような複数形と `datasource` のような単数形は両方必要。

- [ ] **Step 3: lefthook pre-commit（現状 cspell は未登録だが他ジョブが壊れていないことを確認）**

```bash
lefthook run pre-commit --all-files 2>&1 | tail -20
```

Expected: 全ジョブが `skip` または `ok`。`fail` が出ないこと。

---

## Task 5: コミットする

**目的:** 検証済みの変更をコミットする。

- [ ] **Step 1: 変更内容を確認する**

```bash
git status
git diff cspell.json
```

Expected: `cspell.json` の `words` 配列削除と、`.cspell/custom-words.txt` 新規追加の 2 ファイル変更。

- [ ] **Step 2: ステージしてコミットする**

```bash
git add .cspell/custom-words.txt cspell.json
git commit -m "$(cat <<'EOF'
♻️ cspell の words 配列を外部辞書に移設

cspell.json に散在していた words 配列 44 件を .cspell/custom-words.txt
に移設し、case 重複統合＋小文字化＋アルファベット順で整理。
移設前後で cspell の未知語レポートに差分なし。
EOF
)"
```

Expected: lefthook pre-commit が通り、commit が作成される。

- [ ] **Step 3: コミットログを確認する**

```bash
git log -1 --stat
```

Expected: 2 files changed（`cspell.json` 削減 + `.cspell/custom-words.txt` 新規）。
