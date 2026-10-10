# ref-cspell の実装計画

> **エージェント向け:** 必須の補助スキルとして `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans` を使い、タスクごとに実装してください。進捗はチェックボックス（`- [ ]`）で管理します。

**目的:** `cspell.json` にインライン定義されている `words` 配列を外部辞書 `.cspell/custom-words.txt` に移設し、設定をスリム化する。

**設計方針:** 新規に `.cspell/custom-words.txt` を作成し、既存 `words` 配列 44 件を 大文字・小文字の重複統合＋小文字正規化したうえでアルファベット順に書き出す。`cspell.json` 側からは `words` キーを削除する。`dictionaryDefinitions` は既に `.cspell/custom-words.txt` を `addWords: true` で参照しているため、移設後も挙動は等価になる。

**使用技術:** cspell / JSON / プレーンテキスト

**設計書:** `docs/superpowers/specs/2026-04-18-ref-cspell-design.md`

**ワークツリー:** `.worktrees/ref-cspell`（ブランチ `ref/cspell`）

---

## 前提

- 作業ディレクトリは worktree 内: `/Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell`
- このリポには単体テストは無い。検証は「cspell の未知語レポートが移設前後で同じか」で行う
- `npx cspell` はプロジェクトに cspell が未インストールでも都度 DL して実行できる
- コミットメッセージは絵文字プレフィックス＋日本語要約（リポの慣習）

## ファイル構成

### 作成するファイル

| パス | 責務 |
| --- | --- |
| `.cspell/custom-words.txt` | プロジェクト固有のカスタム辞書（1 行 1 単語） |

### 変更するファイル

| パス | 変更内容 |
| --- | --- |
| `cspell.json` | `words` 配列を削除 |

### 削除するファイル

なし。

---

## タスク 1: 移設前のベースラインを取る

**目的:** 移設前後で cspell の未知語検出結果が変わらないことを保証するため、変更前の状態 を記録する。

**対象ファイル:**

- 一時作成: `/tmp/cspell-before.txt`

- [ ] **手順 1: worktree に移動し、コミット対象外の場所に 変更前の状態 を保存する**

```bash
cd /Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell
npx --yes cspell "**/*" --no-progress --no-summary --no-color 2>&1 | sort > /tmp/cspell-before.txt
wc -l /tmp/cspell-before.txt
```

期待する結果: 行数が表示される（未知語があれば 0 以外。現状は既知語しか `words` に無いので 0 の可能性が高い）。エラーで落ちないこと。

- [ ] **手順 2: 出力に明らかな異常がないか確認する**

```bash
head -20 /tmp/cspell-before.txt
```

期待する結果: cspell の通常出力。`Error` や `CSpell: Files checked` のような想定外のサマリ行が残っていないこと（`--no-summary` で抑制されているはず）。

---

## タスク 2: `.cspell/custom-words.txt` を作成する

**目的:** 既存 `words` 配列 44 件を正規化したカスタム辞書ファイルを作成する。

**対象ファイル:**

- 作成: `.cspell/custom-words.txt`

### 正規化ルール（仕様の再掲）

- 大文字・小文字の重複統合: `autobuild` / `Autobuild` → `autobuild`、`openrouter` / `OPENROUTER` → `openrouter`
- 小文字化: `CODEOWNERS` → `codeowners`、`Datasources` → `datasources`、`SSIA` → `ssia`、`Takeru` → `takeru`
- 例外: `O'oyama`（アポストロフィ入り固有名詞）は原形維持
- 並び: アルファベット順（大文字・小文字を区別しない）。`O'oyama` は `ooyama` の直前に配置
- 末尾改行あり
- 件数: 44 - 2（大文字・小文字の重複） = **42 行**

- [ ] **手順 1: ディレクトリを作成する**

```bash
mkdir -p .cspell
```

- [ ] **手順 2: `.cspell/custom-words.txt` を以下の内容で作成する**

```text
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

- [ ] **手順 3: 行数が 42 であることを確認する**

```bash
wc -l .cspell/custom-words.txt
```

期待する結果: `42 .cspell/custom-words.txt`

- [ ] **手順 4: 末尾改行があることを確認する**

```bash
tail -c 1 .cspell/custom-words.txt | od -c | head -1
```

期待する結果: `0000000  \n` を含む出力（末尾が改行であること）。

---

## タスク 3: `cspell.json` から `words` 配列を削除する

**目的:** 外部辞書ファイルに移設したため、インラインの `words` 配列を取り除く。

**対象ファイル:**

- 変更: `cspell.json`

- [ ] **手順 1: `cspell.json` を以下の内容に書き換える**

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

- [ ] **手順 2: JSON として valid であることを確認する**

```bash
npx --yes jsonlint cspell.json >/dev/null && echo OK
```

期待する結果: `OK` が出る。

（`jsonlint` が無い環境では `python3 -c "import json; json.load(open('cspell.json'))" && echo OK` でも可）

---

## タスク 4: 移設後の cspell 出力がベースラインと一致することを確認する

**目的:** 移設前後で未知語レポートに差分が出ないことを確認する。

**対象ファイル:**

- 新規作成なし
- 一時作成: `/tmp/cspell-after.txt`

- [ ] **手順 1: 移設後の出力を取得する**

```bash
cd /Users/takeruooyama/workspace/tqer39/renovate-config/.worktrees/ref-cspell
npx --yes cspell "**/*" --no-progress --no-summary --no-color 2>&1 | sort > /tmp/cspell-after.txt
wc -l /tmp/cspell-after.txt
```

期待する結果: タスク 1 手順 1 と同じ行数。

- [ ] **手順 2: 差分を取る**

```bash
diff /tmp/cspell-before.txt /tmp/cspell-after.txt && echo "IDENTICAL"
```

期待する結果: `IDENTICAL` が出る（差分ゼロ）。

差分が出た場合は、`.cspell/custom-words.txt` の 大文字・小文字の統合や抜けを疑う。特に `Datasources` のような複数形と `datasource` のような単数形は両方必要。

- [ ] **手順 3: lefthook pre-commit（現状 cspell は未登録だが他ジョブが壊れていないことを確認）**

```bash
lefthook run pre-commit --all-files 2>&1 | tail -20
```

期待する結果: 全ジョブが `skip` または `ok`。`fail` が出ないこと。

---

## タスク 5: コミットする

**目的:** 検証済みの変更をコミットする。

- [ ] **手順 1: 変更内容を確認する**

```bash
git status
git diff cspell.json
```

期待する結果: `cspell.json` の `words` 配列削除と、`.cspell/custom-words.txt` 新規追加の 2 ファイル変更。

- [ ] **手順 2: ステージしてコミットする**

```bash
git add .cspell/custom-words.txt cspell.json
git commit -m "$(cat <<'EOF'
♻️ cspell の words 配列を外部辞書に移設

cspell.json に散在していた words 配列 44 件を .cspell/custom-words.txt
に移設し、大文字・小文字の重複統合＋小文字化＋アルファベット順で整理。
移設前後で cspell の未知語レポートに差分なし。
EOF
)"
```

期待する結果: lefthook pre-commit が通り、commit が作成される。

- [ ] **手順 3: コミットログを確認する**

```bash
git log -1 --stat
```

期待する結果: 2 files changed（`cspell.json` 削減 + `.cspell/custom-words.txt` 新規）。
