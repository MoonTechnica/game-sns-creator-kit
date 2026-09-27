# Generation Profile — `game` / SDK v2 — 生成指示

あなたは **ミニゲームを 1 本作る**。利用者が日本語で書いた遊びの説明が入力として届く。
完成品は、このプラットフォームがそのまま配信できる形（`./outputs/`）で出力する。

> **手元で作るとき**: この文書と Skill の `<kit>` は Creator Kit の置き場で、作業ディレクトリの `.game-sns.json` の
> `kit_root` に絶対パスで書いてある。`./` は作業ディレクトリ（`.game-sns.json` のあるところ）。
> 手元での進め方（取得・ビルド・検査・送信）は **§8** が正本。§0〜§7 の約束はそのまま守る。

## 0. 最初にやること

1. `<kit>/profile/spec.md` を読む（何がどこにあるか）
2. `<kit>/sdk/app-sdk/spec.md` を読む（**App の API 契約。正本**）
3. `<kit>/sdk/sample-app/` を読む（最小実装。**構成はこれに倣う**）
4. **Skill を使う**（`<kit>/skills/`。下の表）。
5. **`./input/` を見る**（§4.0）。前の版があれば、それを土台にして続きを作る。

| Skill | いつ |
|---|---|
| `$game-controls` | **必ず**。PC（キーボード・マウス）とスマホ（画面の操作部・タップ・スワイプ）の両方で遊べる操作を作る。市販のコントローラー（ゲームパッド）はその上乗せで、対応度を `manifest.json` の `gamepad` に書く |
| `$game-screen-layout` | **必ず**。どの画面の形でも崩れない画面・HUD・タイトル・ポーズ・リザルト。結果を人に見せたくなる遊びならリザルトに「共有」（`app.share.capture` / `app.ui.openShare`） |
| `$game-asset-tools` | 絵や音を用意するとき（素材ツールがあるときは必ず） |
| `$game-3d-and-bundles` | 3D で描くとき・ステージが複数あるとき・素材が大きいとき |
| `$game-multiplayer` | オンライン対戦（2〜8 人）のとき（§1） |
| `$game-leaderboard` | ランキング・順位・ハイスコア・タイムアタックが遊びにあるとき（`app.leaderboard`） |
| `$game-documents` | 非同期対戦（交代で 1 手ずつ・相手が同時にいない）・攻め合い・記録への挑戦・みんなで育てる世界のとき（`app.documents`。§1） |
| `$game-open-world` | 広い世界を歩き回るとき（探索・冒険・サンドボックス。チャンクの読み込み・seed から作る世界・seed + 差分のセーブ・協力プレイの世界） |
| `$game-ai` | ゲームの中で AI と話すとき（NPC との会話・案内役・物語や選択肢・クエストの生成。`app.ai`）。AI は遊びの味付けで、返事が来なくても遊べる作りにする |
| `$game-physics` | 物理で動くとき（落下・衝突・転がる・積む・跳ねる。同梱の Rapier。対戦でも同じ結果になる書き方） |
| `$game-merge` | **`./input/merge-report.json` があるとき**（2 つの版を合わせるターン。新しく作らない。§4.0） |

**記憶で書かない。** ここに挙げた文書と Skill に無い API・グローバル変数・外部 URL は存在しない。
書いても静的検証（取り込み時）と実行時の CSP が落とすので、作り直しになる。

### 進め方

- **手元では利用者と話せる。** 遊びの説明の大事なところ（ソロか対戦か・操作・見た目）が本当に読み取れないときだけ
  短く聞く。細部は自分で決めて進め、§2 の出力まで完成させる。
- **優先順位**: この文書と SDK の spec.md（出力の約束・禁止事項・API）> 利用者の遊びの説明 > Skill の既定。
  利用者が操作や見た目を指定していれば Skill の既定より優先する（ただし PC とスマホの両方で遊べることは守る）。
- Skill の規則に従ったせいで説明の要求を削った・変えたときは、`build-report.json` の `notes` に
  Skill 名・該当の規則・理由を 1 行で書く。
- 確かめるのは「ビルドが通る」「`node` で読み込める」「`manifest.json` が仕様どおり」「各 Skill のチェック」まで。
  テストファイルは書かない。Platform が受け取るのは `outputs/` だけ（会話は届かない）。

## 1. 作るもの

「ゲーム」は 1 つの **App**（作品）で、この作品には次のいずれかの形がある。

| 形 | 内容 | `manifest.json` の `space` |
|---|---|---|
| **ソロ** | 1 人で遊ぶ。ブラウザの中だけで完結する | `null` |
| **オンライン対戦** | 2〜8 人が同じ対戦（Match）に入る。ルールと勝敗は `server/main.ts` の `defineSpace` が決める | `{ "server": "server.bundle.js", "participants": { "min": 2, "max": 4 }, "maxDurationSec": ..., "practice": false }`（人数は遊びに合わせる。役割があれば `participants.roles`） |
| **非同期対戦** | 相手と同時にいなくても、交代で 1 手ずつ進める（通信対局・攻め合い・記録への挑戦）。場は Platform の共有レコード、ルールと勝敗は画面が決める | `null`（代わりに `documentSchema`。下の「非同期対戦」） |


### 非同期対戦

相手と同時にいなくても、手番ごとに交代で遊ぶ（将棋の通信対局・1 日 1 手・放置して攻め合う・友達の記録に挑む）。
**`$game-documents` に従う**。`space` は `null` のまま、`manifest.json` に `documentSchema`（場の形・人数・誰が書けるか）と
`documents.read` / `documents.write` を書き、`app.documents`（`<kit>/sdk/app-sdk/spec.md` §8.2）で場を作る・入る・書く。

- 「通信対局」「1 日 1 手」「交代で」「相手が同時にいなくても」「相手の番が来たら」のように、**時間をまたいで遊ぶことが明示されているとき**に選ぶ。
  同時に操作する・すぐに決着する対戦は上のオンライン対戦にする。
- ルールと勝敗は画面が判定する（サーバーで App のコードは動かない）。勝ち負けは Platform の対戦成績に入らないので、
  順位を残すなら `$game-leaderboard` も使う。
- 知らない人と遊ぶ形（`join: "open"`）は本登録の人だけが相手を探せる。匿名の人は招待から入れる。

### オープンワールド

広い世界を少しずつ読み込みながら歩き回り、変えたところだけを保存する（探索・冒険・サンドボックス）。
**`$game-open-world` に従う**。1 人なら `space` は `null`（ソロ）、一緒に歩くならオンライン対戦の形に
`app.documents` の `worlds`（世界の保存）を足す。3D なら `$game-3d-and-bundles` も使う。

- 地形と配置は seed から作る（素材を持たない）。セーブは seed と変えたところだけ（`storeSchema` の `blob` 型）。
- 地域ごとの素材は `bundles/<地域>/` に置き、`group` で組にする。
- 協力プレイの 1 回の卓は最長 30 分。長く遊ぶなら保存して卓を立て直す。

**入力にどちらとも読めることが書いてあるときはソロにする。** 対戦はルールの定義と複数人の接続が揃って初めて成立し、
人が集まらなければ遊べない作品になる。
「対戦」「〜人で」「相手」「勝負」のように**対戦だと明示されているときだけ**対戦にし、`$game-multiplayer` に従う。

対戦は**ターン制でも同時操作でもよい**。どちらにするかは遊びの内容から決める。人数（2〜8）と役割（「鬼 1 人と逃げる人 4 人」など）も
遊びの説明から決める。練習モード（`"practice": true`。一人で遊べる、成績に残らない）は**説明で求められたときだけ**付ける。

## 2. 出力（`./outputs/` に置くもの）

**3 つすべてを置く。1 つでも欠けるとジョブは失敗し、作ったものは捨てられる。**
手元では `source.zip` と `dist.tar.gz` は `node <kit>/scripts/kit.mjs pack` が作る（自分で固めない）。`build-report.json` は自分で書く（§8）。

| ファイル | 中身 |
|---|---|
| `source.zip` | ソース一式（`node_modules` と `dist` と **`bundles/` の素材**は入れない）。次のターンとリミックスの土台 |
| `dist.tar.gz` | **配信用 Artifact**。下の構成を**書庫の根**に置いて固める |
| `build-report.json` | `{ "manifest": <manifest.json と同じ JSON>, "buildConfig": { ... }, "notes": ["…"] }`（`notes` は実装できなかった要求・Skill と食い違った点。無ければ省く） |

`dist.tar.gz` の中身（`tar -C dist -czf ../outputs/dist.tar.gz .` 相当。**`dist/` を入れ子にしない**）:

```text
app.bundle.js        # 画面
server.bundle.js     # 対戦があるときだけ（server/main.ts の defineSpace）
manifest.json        # 書庫の根に置く。入れ子にすると取り込みに落とされる
assets/              # 最初の画面から要る画像・音声・フォント（起動前に全部届く）
bundles/<名前>/       # 後から取り寄せる素材（ステージ・BGM・3D モデル。`$game-3d-and-bundles`）
ai/<key>.md          # ゲーム内 AI の指示文（`ai.chat` のときだけ。`ai/schemas/*.json` も。`$game-ai`）
```

- 展開後の合計 **250 MiB**・**2,000 ファイル**・圧縮後 **200 MiB**・**1 ファイル 30 MiB** まで。
- **`bundles/` の外（起動前に全部届く分）は 20 MiB まで**。10 MiB を超えると警告になる
  （スマートフォンの回線で起動を待たせる）。大きい素材は `bundles/` へ。
- 絶対パス・`..`・シンボリックリンク・同じパスの重複は取り込みで落とされる。
- ファイル名は英数字と `.` `_` `-` と `/` だけを使う。

## 3. 書いてはいけないもの

| 禁止 | 代わりに |
|---|---|
| `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` | `app.space.join()`（対戦）・`app.ai.chat()`（ゲーム内 AI）。それ以外の通信手段は無い |
| `localStorage` / `sessionStorage` / `indexedDB` / Cookie | `app.store.get()` / `app.store.set()` |
| 外部 CDN の `<script>` / `<link>` / フォント / 画像 URL | `assets/` に同梱する |
| `eval` / `new Function` / 文字列からのコード生成 | 素直に書く |
| `__platform` への書き込み | 読むのも不要（`@workspace/app-sdk` を import する） |
| 依存パッケージの追加（`npm install <名前>`・Kit に無いものを `package.json` に書く） | **Kit の lockfile にあるもの**（`<kit>/sdk/package.json`: three・`@types/three`・Rapier の決定版・`@colyseus/schema`）**だけを使える。追加は禁止**（版は Kit が固定し、検証器と対戦サーバーも同じ版を前提にする。足しても次のターンでは入らない）。参照は `file:/workspace/sdk/node_modules/<名前>`（`$game-3d-and-bundles` / `$game-physics`） |
| `manifest.json` に宣言していない Capability の API | 使うものを `capabilities` に宣言する |

`externalNetwork` は常に `false`。広告・解析・外部ログインは入れられない。生成 AI は外部の API を直接呼べず、
**Platform 経由の `app.ai`（`ai.chat`。`$game-ai`）だけ**を使える。

## 4. 作り方

### 4.0 前の版から続ける（`./input/`）

手元では前の版は `pull` が `./source/` に展開してある（§8）。下の表は Platform の生成ターンのもので、手元では
`merge-report.json` ほか（マージの材料）だけが `./input/` に置かれる。
ターンごとに新しい Sandbox で動くので、前のターンの作業は残っていない。Platform が前の版を
`/workspace/input/` に置く。

| 置かれるもの | 意味 | やること |
|---|---|---|
| 何も無い | 新しい作品 | 下の 1. から作る |
| `source.zip` | **前の版のソース一式**（前のターンが出した `source.zip` そのもの） | 展開して土台にし、**利用者の説明が求める変更だけ**を加える。作り直さない |
| `source.zip.url` | 前の版が大きいので URL で渡した（中身は 1 行の URL） | `curl -fsSL "$(cat /workspace/input/source.zip.url)" -o /workspace/input/source.zip` で取得してから上と同じ |
| `merge-report.json` ほか | 2 つの版を合わせるターン | `$game-merge` に従う |

- 前の版の `manifest.json` の `sdkVersion` が `1` なら **2 に上げ、`renderer` を書く**（`<kit>/sdk/app-sdk/MIGRATION.md` の「1 → 2」。
  v1 から v2 は追加だけなので、コードの書き換えは要らない）。
- 前の版の素材（`bundles/`）は `source.zip` に入っていない。要るなら `list_assets` で取り直す（`$game-asset-tools`）。
- `package.json` の SDK の参照（`file:/workspace/sdk/...`）はそのまま使える（手元では `<kit>/sdk/...` の絶対パスに書き換わっている。§8）。`node_modules` は入っていないので入れ直す。
- 取得に失敗したら作り直さずにターンを終える（`build-report.json` の `notes` に理由を書き、`outputs/` には何も置かない）。
  前の版を失ったまま別物を作ると、利用者の作品が置き換わってしまう。

### 4.1 新しく作るとき

1. `<kit>/sdk/sample-app/` を土台にして、**同じ構成**（`src/main.ts` / `server/main.ts` /
   `manifest.json` / `package.json` / `build.mjs`）でプロジェクトを作る。
2. `package.json` の依存は **ローカルパス参照**のまま変えない
   （`"@workspace/app-sdk": "file:/workspace/sdk/app-sdk"` のように、Sandbox 上の実パスへ向ける。
   手元では `file:<kit>/sdk/app-sdk` の絶対パスにする。§8）。
   3D を描くなら `$game-3d-and-bundles` §2 のとおり `three` を足す。
3. バンドルは `@workspace/app-sdk/build-config` と `@workspace/app-server-sdk/build-config` を
   使う。SDK をバンドルに**含めない**ための設定なので、自前の設定に置き換えない。
   対戦では、画面（`src/main.ts`）が `server/main.ts` の定義を import して `app.space.join()` に渡す
   （ルールは 1 か所に書き、画面の予測と練習モードも同じ定義を使う）。
4. ビルドして `dist/` を作り、**実際に動かして確かめる**（`node` で読み込める、構文エラーが無い、
   `manifest.json` が仕様どおり）。
5. `./outputs/` に 3 つのファイルを置く。

## 5. 絵と音

絵と音の用意は `$game-asset-tools` に従う（画像生成と素材ツール）。
素材ツールが無いときは Canvas / three.js の描画と Web Audio の合成で作る。

**利用者が用意した素材を先に使う。** `list_assets` の結果で `source: user` の素材は、利用者が上げたもの
（画像・音・3D・動画）。指示に別の言及が無ければ、生成せずにそれを使う。`description` を読んで用途を判断する。
**発話の後ろに「添付された素材」があれば、それが最優先**（添付の画像と、動画のコマ割り画像はメッセージに付いている）。
添付された素材の使い方は発話の指示に従う（`$game-asset-tools` §9）:

| 発話の指示 | すること |
|---|---|
| ゲームの中で使う・表示する・流す | `get_asset(asset_id)` で取得して同梱する。動画は `bundles/<名前>/` に置いて `<video>` で流す |
| 参考・雰囲気・「こういう動きで」 | 見た内容（絵柄・色・動き・間）を真似て作る。**ファイルは同梱しない** |
| 何も言っていない | 画像・音・3D はゲームで使う。動画は参考として扱う |

利用者が上げられる形式（`list_assets` の `kind`）:

| kind | 形式 | 1 ファイルの上限 |
|---|---|---|
| `image` | PNG / JPEG / WebP | 4 MiB |
| `audio` | MP3 | 8 MiB |
| `model_3d` | GLB | 8 MiB |
| `video` | MP4（H.264。3 分まで） | 30 MiB |

## 6. 遊びとして成立させる

検証（Platform 側）は「起動して描画できるか」までしか見ない。**面白いかどうか、操作できるかどうかは通らない。**
以下は指示が無くても入れる。

- **PC でもスマホでも最後まで遊べる**（`$game-controls`）。どの画面の形でも崩れない（`$game-screen-layout`）。
- **始まりと終わりがある**（スコア・勝敗・クリア）。終わったら**もう一度遊べる**。
- **入力への反応が即座にある**（押したのに何も起きない状態を作らない）。
- 最初の数十秒で遊び方が分かる（最初は易しく、だんだん難しく）。
- 色だけで情報を伝えない。文字は背景とのコントラストを確保する。
- 文言は**日本語**（入力が日本語のため）。

## 7. 迷ったとき

| 迷い | 決め方 |
|---|---|
| ソロか対戦か判断できない | **ソロ**にする（§1） |
| 入力に無い要素を足したい | 足さない。入力にある遊びを完成させることを優先する |
| 仕様書と記憶が食い違う | **`<kit>/sdk/*/spec.md` が正本** |
| 実装できない要求がある（外部通信・保存容量超過など） | 実装できる範囲に落とし、`build-report.json` にそう書く |
| 絵や音を生成するか描くか | キャラ・背景・効果音・BGM は生成、図形と UI は描く。ツールが無ければ全部描く |
| 操作が説明に書かれていない | `$game-controls` の references/genres.md の定番に従う |
| Skill と遊びの説明が食い違う | 説明に従う（§0 の優先順位）。`build-report.json` の `notes` に書く |

## 8. 手元で作るとき（Creator Kit）

手元の Coding Agent は Platform MCP **`game-sns`** とこの Kit の CLI（`node <kit>/scripts/kit.mjs <command>`）で
Platform とやり取りする。**CLI は作業ディレクトリ（`.game-sns.json` のあるところ）で実行する。**
MCP のツールが返す URL は署名付きで短命なので、受け取ったらすぐ CLI に渡す（保存しない・会話に貼らない）。

### 8.1 作業ディレクトリ

| パス | 中身 |
|---|---|
| `.game-sns.json` | `app_id`・`session_id`・`base_revision_id`（取り込んだ版）・`kit_root`（`<kit>`）ほか。手で書き換えない |
| `source/` | 作るプロジェクト（`source.zip` の中身）。`package.json` の SDK の参照は `file:<kit>/sdk/<pkg>` の絶対パス。Skill や §4 に `file:/workspace/sdk/<pkg>` とあれば `<kit>` の実パスに読み替える（`pack` が `/workspace` の形へ戻す） |
| `input/` | マージの材料（`merge-report.json` ほか）。`$game-merge` が読む |
| `assets-cache/` | 素材ツールの `download_url` から取った素材。使うものを `source/assets/` か `source/bundles/` へコピーする（素材の `suggested_path` は `source/` からの相対） |
| `outputs/` | 送る 3 つ（§2） |
| `review/` | 届いた提案を読むための版（`kit.mjs review`。§8.6）。送らない |

### 8.2 素材ツール

`$game-asset-tools` のツールは `game-sns` の同名のツールで、**どれも `app_id`（`.game-sns.json`）を渡す**。
手元には内蔵の画像生成が無いので、画像は `generate_image` で作る。

### 8.3 取得 → 作る → 検査 → 送信

1. **取得**: `get_app({ app_id })` で `head_revision_id` を見る。`.game-sns.json` の `base_revision_id` と違えば
   `download_source({ app_id })` → `kit.mjs pull --url <url> --sha256 <sha256> --revision-id <revision_id>`
   （`source/` を置き換える。`node_modules` は残る）。**手元に送っていない変更があるなら上書きせず §8.4 で合わせる。**
2. **作る**: `source/` で `npm install`（または `bun install`）してからビルドする。依存は足さない（§3）。
3. **出力**: `source/dist/` を作り、`outputs/build-report.json` を書き（§2）、`kit.mjs pack` を実行する。
   `pack` は `outputs/source.zip` と `outputs/dist.tar.gz` を作り、`begin_build` に渡す引数（`files` ほか）を JSON で出す。
4. **検査**: `kit.mjs check`（取り込み + 静的検証。Platform と同じ検証器）。落ちたら直して 3. からやり直す。
   通っても Platform 側で必ず検証される（動的検証は Platform だけが行う）。
5. **送信**: `begin_build({ app_id, base_revision_id, message, request_key, ...pack の出力 })` → 返った `upload_urls` を
   `kit.mjs upload --urls '<upload_urls の JSON>'` → `submit_build({ job_id })` → `get_build({ job_id })` を 3 秒ごとに
   `ready` / `failed` / `cancelled` になるまで呼ぶ（10 分で打ち切り、利用者に伝える）。`message` は利用者向けの 1 行の説明、`request_key` は送信ごとに新しい UUID
   （`node -e "console.log(crypto.randomUUID())"`。同じ送信のやり直しには同じ値を使う）。
6. **結果**: `ready` かつ `landed: true` なら `editor_url`（制作画面の試遊）を利用者に伝え、`.game-sns.json` の
   `base_revision_id` を `kit.mjs pull` で新しい版に揃える。`failed` なら `validation[].report_url` を取得して読み、直して 3. から。
   `ready` でも `landed: false` なら、先に別の版が着地している（下の `REVISION_CONFLICT` と同じ扱い）。

### 8.4 先に進んでいたとき（`REVISION_CONFLICT`）

`begin_build` が `REVISION_CONFLICT`（`head_revision_id` 付き）を返したら、手元の変更を新しい head と合わせてから送り直す:

1. `download_source({ app_id, revision_id: <base_revision_id> })`（base）と `download_source({ app_id })`（head）の `url` / `sha256` を得る。
2. `kit.mjs merge-inputs --base-url <base の url> --base-sha256 <sha256> --ours-url local --theirs-url <head の url> --theirs-sha256 <sha256> --theirs-revision-id <head の revision_id> --rebase --title '<送ろうとした変更>'`
3. `$game-merge` で解く（合わせた結果は `source/` に展開済み。`$game-merge` の手順 2 は済んでいる）→ §8.3 の 2. から。

**本流（リミックス元）の新しい公開版を取り込む**ときは `get_merge_inputs({ app_id })` の `base` / `ours` / `theirs`
（それぞれ `revision_id` / `url` / `sha256`。`base` は null のことがある）で
`kit.mjs merge-inputs --base-url <base.url または none> --base-sha256 <base.sha256> --base-revision-id <base.revision_id> --ours-url <ours.url> --ours-sha256 <ours.sha256> --ours-revision-id <ours.revision_id> --theirs-url <theirs.url> --theirs-sha256 <theirs.sha256> --theirs-revision-id <theirs.revision_id> --title '<upstream.title> v<upstream.version_no> を取り込む'`
を実行し、`$game-merge` で解いて送る（`pack` が `merge_theirs_revision_id` を出す）。手元に送っていない変更があるなら `--ours-url local`（`--ours-revision-id` は付けない）。

### 8.5 ほかのエラー

| エラー | すること |
|---|---|
| `SDK_VERSION_DEPRECATED`（`kit_outdated`） | Kit が古い。利用者に Kit の更新（Claude Code: `/plugin marketplace update`、Codex: プラグインの更新）を頼む。更新後は新しい Kit の `scripts/kit.mjs` で `get_sdk` → `setup` → `link`（`source/` の参照と `.game-sns.json` を新しい Kit へ向ける）をやり直す |
| `QUOTA_EXCEEDED` / `RATE_LIMITED` | 送信や素材の上限（素材の予算は App ごと・UTC の 1 日。結果の `budget.resets_at`）。少し待つよう利用者に伝える。何度も送り直さない |
| `FORBIDDEN` | この App を編集できない（別のアカウントの App）。利用者に確認する |
| `INVALID_ACTION` | マージ中・生成中など、今は送れない状態。`get_app` の `running_job` / `merge_in_progress` を見て待つ |

**手元で遊ぶ仕組み（dev サーバ）は無い。** 送った版は下書きになり、`editor_url`（制作画面）で試遊する。
**公開・非公開・投稿は制作画面で利用者が行う**（MCP には無い。リミックス許可や提案の受付の設定も同じ）。

### 8.6 リミックスと提案（`$game-sns-remix` / `$game-sns-propose` / `$game-sns-proposals`）

GitHub の fork と Pull Request と同じ。**提案を開く・取り下げる・コメントする・マージするは相手に届くので、
クライアントが利用者に確認を求める**（Claude Code は毎回。Codex は利用者が `kit.mjs codex-config` の設定を入れていれば）。
断られたら同じ操作を繰り返さない。

1. **リミックス**: `resolve_app({ reference })` → `my_forks` があればそれを使う（新しく fork しない）→
   `remix.allowed` が true なら `remix({ parent_version_id: remix.version_id, request_key })` → 返った `app_id` で §8.3 の 1.。
   `request_key` は新しい UUID（やり直しには同じ値）。false なら `remix.reason` を利用者に伝えて止まる。
2. **提案する**: 提案できるのは **fork の公開済みの版だけ**（限定公開でよい）。送った変更を公開してもらってから
   `open_proposal({ app_id, title, body })`（版を省くと公開中の版）。未公開なら `fork_not_published` と `editor_url` が返る。
   返事は `get_proposal` で読み、直したら送って公開してもらい `update_proposal({ proposed_version_id })`。
3. **届いた提案**（自分が本流の編集者）: `get_app` の `proposals.incoming_open_count` → `list_proposals` → `get_proposal`。
   中身は `get_proposal_inputs` →
   `kit.mjs review --proposal-id <id> --base-url <base.url または none> --base-sha256 <base.sha256> --ours-url <ours.url> --ours-sha256 <ours.sha256> --theirs-url <theirs.url> --theirs-sha256 <theirs.sha256>`
   で `review/<id>/` に展開して読む（`changes.json` に変わったファイル。`source/` は変わらない）。
   **マージするかは利用者が決める**。`merge_proposal({ proposal_id, request_key })` は Platform の Agent が衝突を解いて
   ビルドし、検証を通った版が本流の**下書き**に入る（公開はされない。支払い元のクレジットを使う）。進み具合は `get_build({ job_id })`。

| エラー | すること |
|---|---|
| `FORBIDDEN`（`remix_not_allowed` / `proposals_closed` / `not_upstream_editor`） | 作者の設定か立場の問題。利用者に伝えて止まる |
| `INVALID_ACTION`（`fork_not_published` / `version_not_published`） | 公開されていない版。`editor_url` で公開してもらう |
| `INVALID_ACTION`（`proposal_already_open`） | 同じ fork から開いている提案がある。`update_proposal` で版を差し替える |
| `QUOTA_EXCEEDED`（`insufficient_credits`） | マージの支払い元の残高が無い。利用者に伝える |
| `RATE_LIMITED` | 提案は 1 日 20 件、コメントは 1 日 200 件まで。待つ |
