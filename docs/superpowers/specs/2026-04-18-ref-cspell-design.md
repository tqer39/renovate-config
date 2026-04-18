# ref-cspell 設計書

## 目的

`cspell.json` にインライン定義されている `words` 配列（約 45 件）を、既に参照先として宣言済みの外部辞書ファイル `.cspell/custom-words.txt` へ移設し、設定ファイルをスリム化する。

機能追加（lefthook への cspell ジョブ統合、辞書のカテゴリ分割など）は本タスクのスコープ外とする。

## 背景

現状の `cspell.json` は以下の状態にある。

- `dictionaryDefinitions` で `./.cspell/custom-words.txt` を `addWords: true` で参照しているが、**そのファイル / ディレクトリは存在しない**
- 代わりに `words` 配列へ約 45 語がインラインで列挙されている
- 大文字 / 小文字が重複しているエントリが複数ある（例: `autobuild` / `Autobuild`、`openrouter` / `OPENROUTER`）

つまり宣言上の意図（外部辞書で管理）と実態（インライン列挙）が乖離している。

## 変更内容

### 1. 新規ファイル `.cspell/custom-words.txt`

既存 `cspell.json` の `words` 配列 45 件を移設する。

- 1 行 1 単語、末尾改行あり
- 並び順: **アルファベット順（case-insensitive）**
- 正規化: 原則 **小文字化**
  - 根拠: cspell の仕様上、辞書の小文字エントリは任意の case（`Autobuild` / `AUTOBUILD` など）にマッチする。大文字を含むエントリはその case にのみマッチする。従って小文字に寄せた方が最小セットで最大カバレッジになる。
- 例外: アポストロフィや特殊文字を含む固有名詞は原形維持
  - 該当: `O'oyama`

### case 重複の統合例

| 現状（`words` 配列） | 移設後 |
|---|---|
| `autobuild`, `Autobuild` | `autobuild` |
| `openrouter`, `OPENROUTER` | `openrouter` |
| `CODEOWNERS` | `codeowners` |
| `SSIA` | `ssia` |
| `Takeru` | `takeru` |
| `O'oyama` | `O'oyama`（原形維持） |

### 2. `cspell.json` の変更

- `words: [...]` を **削除**
- `dictionaryDefinitions` / `ignorePaths` / `files` はそのまま

`dictionaryDefinitions` は既に `.cspell/custom-words.txt` を `addWords: true` で参照しているため、単語は外部辞書から読み込まれる。

#### 変更後のイメージ

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

## 想定差分

| 操作 | パス | 規模 |
|---|---|---|
| 新規 | `.cspell/custom-words.txt` | 約 40 行（case 重複統合後） |
| 変更 | `cspell.json` | `words` 配列削除のみ（約 47 行削除） |

その他のファイルへの変更はなし。

## 検証方法

1. リファクタ前に `npx --yes cspell "**/*" --no-progress --no-summary 2>&1 | wc -l` を実行し、未知語レポート件数を記録する
2. リファクタ後に同じコマンドを実行し、**件数が変わっていない** ことを確認する
3. `lefthook run pre-commit --all-files` がエラーなく完了すること（現状 cspell は lefthook 未登録だが念のため）

## リスク

低。cspell は `words` 配列と `dictionaryDefinitions` で指定した外部辞書の両方を語彙として読み込むため、移設前後でスペルチェック結果は等価になる想定。case 統合については上記の cspell 仕様により挙動不変。

## スコープ外（将来タスク候補）

以下は本タスクに含めない。

- cspell を lefthook の pre-commit ジョブとして登録する
- 辞書のカテゴリ分割（人名 / ツール / 略称など複数辞書化）
- `ignorePaths` / `files` の見直し
