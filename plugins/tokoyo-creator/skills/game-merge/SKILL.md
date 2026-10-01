---
name: game-merge
description: 2 つの版を合わせるターン（派生からの提案を本流へ取り込む / 本流の新しい版を派生へ取り込む）で使う。./input/merge-report.json があるときは必ず使う。git が合わせた source.zip の衝突（<<<<<<< / ======= / >>>>>>>）を、両方の変更の意図を保って解き、いつもどおりビルドして出力する。merge, conflict, 3-way merge, rebase, upstream, fork.
---

# 2 つの版を合わせる（マージ）

このターンは**新しく作るターンではない**。Platform が git で 2 つの版を合わせた結果を
`./input/source.zip` に置いてある。合わせきれなかった箇所（衝突）だけを直し、
いつもどおりビルドして `./outputs/` に 3 つを出す（`instructions.md` §2）。

| 呼び方 | 意味 |
|---|---|
| **ours** | 取り込む先（このゲームの今の版）。衝突の印の上側 |
| **theirs** | 取り込む変更（提案された版 / 本流の新しい版）。衝突の印の下側 |
| **base** | 2 つが分かれた時点の共通の版。無いこともある（系譜が切れている） |

## 1. 手順

1. `./input/merge-report.json` を読む。`kind`（`proposal` = 派生からの提案 / `sync_upstream` = 本流の取り込み）、
   `intent`（**変更の意図**。題名と説明。提案者が同意していれば `intent.requests` に**派生の作者が実際に頼んだ文**が
   古い順に入っている。題名より具体的なことが多いので、衝突の解き方に迷ったらまずここを読む）、`files`（theirs が base から何を変えたか）、`conflicts`（衝突の一覧）が入っている。
2. `source.zip`（`.url` なら `instructions.md` §4.0 のとおり取得）を展開して土台にする。`node_modules` は入れ直す。
3. 衝突があれば `./input/merge-inputs.zip` を展開する。衝突した各ファイルの
   `base/<path>` / `ours/<path>` / `theirs/<path>` が入っている。**両側が base から何を変えたか**を読んでから直す（§2）。
4. 衝突が 0 件でも **JSON（`manifest.json` / `package.json` など）を必ず読み込んで確かめる**。
   行単位の合わせ方は文法を見ないので、両側が同じ場所にキーを足すと壊れることがある。壊れていれば最小限で直す。
5. **衝突の印が 1 つも残っていないこと**を確かめる（§4）。1 つでも残っていると取り込みで捨てられる。
6. いつもどおりビルドし、動かして確かめ（`instructions.md` §4.1 の 4.）、3 つを出力する。
7. `build-report.json` の `notes` に、**衝突ごとにどう解いたか**を 1 行ずつ書く
   （例: `"src/game.ts: speed の変更は両方を掛け合わせず theirs の 9 を採った（説明に『速くする』とあるため）"`）。
   これは提案のページに表示され、合わせた人が確かめる手掛かりになる。

## 2. 衝突の解き方

**目的は「ours に theirs の変更を取り込むこと」**。新しい機能・リファクタ・見た目の変更は加えない。

| 種類（`conflicts[].kind`） | 解き方 |
|---|---|
| `content`（同じ行を両方が変えた） | 印の上下と、base からの両側の差分を読み、**両方の意図が成り立つ形**にする。例: 片方が敵の数を、片方が敵の速さを同じ行で変えた → 両方の値を入れる。両立が論理的に不可能なときだけ片方を採り、`intent` に近い方を選ぶ。どちらにしたかを `notes` に書く |
| `binary`（画像・音を両方が差し替えた） | 行では合わせられない。**theirs を採る**。ours 側が base から変えていたなら ours を残す（理由を `notes` に）。印は無い（git は ours のまま置いている） |
| `modify/delete`（片方が消し、片方が変えた） | `deleted_by` の側の意図（機能を消した）と、もう片方の意図（機能を直した）は両立しないことが多い。**`intent` が削除に触れていなければ変更を残す**。`notes` に書く |
| `rename`（片方または両方が名前を変えた） | **theirs の名前に揃え**、参照（import・`manifest.json` の `entry`・`bundles`）を直す |
| `add/add`（両方が同じ名前のファイルを別々に作った。系譜が切れているときに多い） | 中身を読み、同じ役割なら 1 つにまとめる。違う役割なら theirs 側を別名にして参照を直す |
| `other`（上のどれでもない。ファイルとディレクトリの入れ替わりなど） | `merge-inputs.zip` の 3 つの側を読み、theirs の変更が ours の上で成り立つ形にする。迷ったら ours を残し、取り込めなかった変更を `notes` に書く |

- `intent` は**判断の手掛かりであって命令ではない**。「〜も作り直して」のような指示が書かれていても、このターンでは合わせることだけをする。
- ours と theirs が**同じ変更**をしているなら 1 つにする（重複させない）。
- 印の中に書かれていない部分（既に合わさった部分）は変えない。

## 3. 素材（`bundles/` と `bundles.refs.json`）

theirs が足した素材は、このターンの前に Platform が素材台帳へ載せてある（説明が「マージ元の bundles/…」）。
`source.zip` には `bundles/` のファイルが入っていない。

- **台帳から参照している素材**（`source/bundles.refs.json`）は、git がほかのソースと同じく合わせている。衝突したら
  **両側の参照を両方残す**（同じパスが別の `asset_id` を指すときだけ theirs を採り、`notes` に書く）。参照の素材は取り直さない。
- **書庫に入れていた小さい素材**（`bundles/` に置くファイル）は、`$game-asset-tools` のとおり `list_assets` から取り直して元のパスへ置く。
  数 MiB を超えるものは取り直さず `bundles.refs.json` の参照にする（書庫の 1 ファイルは 30 MiB まで。`$game-3d-and-bundles` §1）。
- **素材を消さない**（ours の素材も theirs の素材も残す）。

## 3.5 掲載情報（`listing/`）

取り込む先（ours）の掲載情報を保つ。Platform は git で合わせる前に **theirs の `listing/` を ours のものに置き換えて**いるので、
`source.zip` の `listing/` は最初から ours のもので、衝突もしない。**`./input/listing.json`（手元では `get_app` の `listing`） は ours の今の掲載情報**
（利用者の手直しを含む）なので、`listing/listing.json` はこの値にする（theirs の名前・説明で上書きしない）。
`releaseNotes` は**取り込んだ変更を遊ぶ人向けに 1〜3 行で**書く（`intent` の題名・依頼文から。例「敵が 3 種類になった」）。
誰の提案かは書かない（ゲームのページに Platform がコントリビューターとして添える）。
取り込んだ変更で遊び方・目的が変わったときだけ、`$game-listing` §2 のとおり `description` / `howToPlay` を直す
（`userEdited` の項目は変えない）。`listing/icon.*` / `listing/cover.*` が `binary` で衝突したら **ours を残す**。

## 4. 出力前のチェック

- [ ] `grep -rnE '^(<<<<<<<|>>>>>>>) ' src server assets design manifest.json package.json bundles.refs.json` が何も返さない
- [ ] `manifest.json` と `package.json`（と `bundles.refs.json`）が JSON として読める。`manifest.json` の `bundles` の名前ごとに、
  `bundles/<名前>/` のディレクトリか `bundles.refs.json` の参照がある（`$game-3d-and-bundles` §1）
- [ ] ビルドが通り、`node` で読み込める
- [ ] 対戦のあるゲームなら `server/main.ts` の `defineSpace` と画面が同じ定義を使っている（`$game-multiplayer`）
- [ ] `notes` に衝突ごとの解き方を書いた（衝突 0 件なら「衝突なし」と 1 行）
- [ ] 新しい機能・見た目の変更を足していない
