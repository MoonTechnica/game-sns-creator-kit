---
name: game-asset-tools
description: ゲームの絵と音を用意する。CC0 のフリー素材の探し方と取り込み方、画像の作り方（内蔵の画像生成、無い環境では generate_image）、素材ツール（MCP）の使い方と予算、透過キャラクター・連番アニメ・アニメ付き 3D・効果音・BGM・動画の手順、自分で作った素材の登録（upload_asset。大きい物は台帳から参照）、失敗したときの対処を扱う。画像・キャラクター・背景・モーション・効果音・BGM・3D モデルを用意するとき、素材ツールが使えるときに使う。assets, sprites, stock assets, CC0, sound effects, music, budget.
---

# 絵と音の用意（画像生成 + 素材ツール）

**画像の作り方は環境で 2 通りある。** それ以外の規則はどちらでも同じ。

| 環境 | 画像の作り方 | できた PNG |
|---|---|---|
| **内蔵の画像生成がある** | 内蔵の画像生成で作る。**背景を透過できず、大きさの指定も効かない**（常に 1254px 四方前後・1〜2 MB）。画像の枠を使わない | `/workspace/generated_images/` に保存される |
| **内蔵の画像生成が無い**（手元のエージェントなど） | 素材ツール `generate_image(name, prompt, size, transparent)` で作る。透過は `transparent=true` で 1 回で済む。画像の枠を 1 回使う | 結果の `download_url` から取得する（§4） |

透過・3D・音は素材ツール（MCP）で作る。何を既存素材（CC0。§3.5）で済ませ、何を作るかは `$game-art-direction` §3 の判定表で決める。
**ツール一覧に素材ツール（`list_assets` など）が無いとき**は、絵は Canvas（three.js）で描き、音は Web Audio で合成する。

## 1. 最初にやること（ツールを呼ぶ前に）

**何をどの経路（素材・生成・描画・3D モデリング）で用意するかは `$game-art-direction` §3 の判定表で決め、`design/asset-manifest.md` に書いてから**ここの手順で作る。この節は取り寄せ方と枠の目安。

1. **`list_assets` を呼ぶ。** 前のターン（リミックス元を含む）で作った素材と、利用者が上げた素材
   （`source: user`）が並ぶ。**作り直さずに使う**。利用者の素材は§9 のとおり最優先。`kind` で種類を絞れる。
   足りない物だけを用意する。
2. **manifest で「素材」にした物（functional: UI・タイル・汎用の敵や小物・効果音）は `search_stock_assets` で探す**（§3.5）。
   キャラの歩き・ジャンプの連番、タイル、UI、効果音・ジングルは既存の素材で揃うことが多い。費用はかからず、
   予算の `stock` 枠（生成の枠とは別）だけを使う。**絵柄をそろえたいときは同じパック（`pack`）から取る**。
3. **manifest で「生成」にした物（identity: 主役・固有の敵・キーアート・アイコン・カバー）と、探しても無かった物を作る。
   何を作るかを先に決めて、予算に収める**。結果の `budget` に残りが出る。目安（1 本のゲーム）:

   | 種類 | 使う枠 | 目安 |
   |---|---|---|
   | 背景・タイトル画 | 内蔵の画像生成（枠を使わない）/ `generate_image`（画像の枠を 1 回） | 1〜3 枚 |
   | 透過キャラクター・アイテム | 内蔵の画像生成なら画像の枠を **2 回**（`upload_image` + `remove_background`）/ `generate_image(transparent=true)` なら 1 回 | 主役 1 + 敵・アイテム 2〜4 |
   | 効果音 | 音の枠を 1 回ずつ | 4〜6 種（決定・ジャンプ・得点・ヒット・失敗・クリア） |
   | BGM | 音の枠を 1 回（1 分単位で課金） | 1 本（30 秒前後をループ） |
   | 3D モデル | 3D の枠（**ツール一覧に `generate_model_3d` があるときだけ**） | 主役 1〜2 体 |
   | 人型のモーション | モーションの枠を 1 回ずつ（1 回 $0.08） | 主役の動作 3〜6 種（待機・歩き・走り・跳び・攻撃・やられ） |

4. **図形・文字・ボタン・パーティクル・弾・床のタイルは生成しない。** Canvas で描く方が速く、軽く、きれいで、
   画面の大きさにも追従できる。操作部とボタンは入力キット（`$game-controls`）が描く。

## 2. 作り方

| 作りたいもの | 手順 | 置き方 |
|---|---|---|
| 背景・タイトル画面 | 画像を作る（冒頭の表）→ `convert <PNG> -resize 1024x1024 -quality 85 assets/bg.jpg` | JPEG。長辺 1024px 以下 |
| キャラクター・アイテム（透過） | 内蔵の画像生成なら §3 の手順。`generate_image` なら `transparent=true` で作って取得する（§4） | 透過 PNG。長辺 512px 以下 |
| 効果音 | `generate_sound_effect(name, prompt, duration_sec)`。短く具体的に（「軽いジャンプ音、上がる音程、0.3 秒」） | MP3。0.5〜2 秒 |
| BGM | `generate_music(name, prompt, duration_sec=30)`。雰囲気・テンポ・楽器を書き「ループしやすい」と添える | MP3。ループ再生 |
| 3D モデル | 透過した元画像の `asset_id`（§3 の結果、または `generate_image(transparent=true)` の結果）で `generate_model_3d(name, asset_id, polycount="low")`。**数分かかる** | GLB を `bundles/` に置く（`$game-3d-and-bundles`） |
| 人型のモーション | フリー素材のアニメ付きキャラ（§3.5）に無い動きだけ `generate_motion(name, prompt, duration_sec)`。prompt は英語で 1 人の動きを具体的に（「A person swings a sword overhead, then steps back.」）。ループする動き（待機・歩き）は 1 周期の長さにする | **FBX のままゲームに入れない。** `$game-3d-studio` §4.3.1 でキャラの骨格にリターゲットし、キャラの GLB にクリップとして入れる |
| 自分で作った音（Web Audio の書き出し）・GLB | ほかのファイルと同じく commit する（Git LFS に入り、次のターンにも残る）。数 MiB を超えるものは `upload_asset(name, kind)` で台帳に載せて参照する（§4） | `assets/` か `bundles/` |

- 生成したままの PNG（1 枚 1〜2 MB）を `assets/` に入れない。必ず縮小する。
- 同じキャラクターの色違い・表情違いは、同じ指示文（絵柄・配色・構図）を使い回して描かせる。
- 絵柄はゲーム全体でそろえる（最初に「ドット絵 / フラットなイラスト / 水彩」などを決め、毎回の指示に入れる）。
- **画像に文字を入れない**（指示に「文字・ロゴ・数字を描かない」と書く）。看板やボタンの文字は canvas / DOM で描く（`$game-ux` §3）。
- 効果音は最低限「押す / 良い / 悪い」の 3 種類をそろえる（`$game-ux` references/feedback.md §6）。

## 3. 透過キャラクターの手順（内蔵の画像生成のとき）

1. 内蔵の画像生成で、キャラクターを**単色の背景**（白か緑）で 1 枚作る。全身が枠に収まり、影を落とさない構図で。
2. `upload_image(name, description)` を呼び、返った `upload_url` へアップロードする（`description` に
   「主人公の立ち絵・右向き」のように何の画像かを書く。次のターンの `list_assets` で手掛かりになる）:
   `curl -fsS -X PUT -F 'file=@/workspace/generated_images/<ファイル名>.png;type=image/png' '<upload_url>'`
3. **アップロードが終わってから**、その `asset_id` で `remove_background` を呼ぶ
   （先に呼ぶと `ASSET_NOT_READY`）。
4. 結果の `download_url` を取得する: `curl -fsSL -o /tmp/hero.png '<download_url>'`
   （URL は 10 分で失効する。切れたら `get_asset(asset_id)` で取り直す）。
5. 縮小して置く: `convert /tmp/hero.png -resize 512x512 assets/hero.png`

## 3.5 フリー素材（CC0）を探して取り込む

`search_stock_assets(kind, query)` で探し、合うものを `import_stock_asset(name, stock_id)` で取り込む。
取り込んだ素材は生成した素材と同じ扱いになる（`download_url` を取得する・`list_assets` に出る・リミックス先に残る）。

| kind | 何がある | 探す語の例 |
|---|---|---|
| `image` | 2D のキャラ・敵・アイテム・タイル・背景の部品・UI・アイコン。**歩き・ジャンプ・攻撃の連番フレーム** | `platformer player walk` / `enemy walking` / `coin` / `tile grass` / `button` |
| `audio` | 効果音（打撃・足音・UI・レトロ・カジノ・RPG）、短いジングル（勝利・失敗・レベルアップ）、ボイス | `jump` / `footstep` / `click` / `coin` / `jingle win` / `laser` |
| `model_3d` | 低ポリの 3D キット（建物・乗り物・武器・自然）、**アニメ付きのキャラクター**（idle / walk / sprint / jump / attack…）、人型のアニメ集 | `character` / `blocky character` / `car` / `tree` / `animation library` |

- **語は英語で短く**（素材の名前が英語）。1 つ目で見つからなければ語を変えて 2〜3 回まで。
- 結果は良く合う順。`pack`（パック名）が同じものは絵柄がそろっている。続きは `next_cursor` を渡す。
- **連番フレーム**（`playerBlue_walk1` … `playerBlue_walk5`）は `name` の末尾の数字順に 1 枚ずつ取り込む
  （1 枚で `stock` 枠を 1 回）。`name` は `hero-walk-1` のように付け、コードで 8〜12 fps で切り替える:

  ```js
  const walk = [1, 2, 3, 4, 5].map((n) => loadImage(app.assets.url(`assets/hero-walk-${n}.png`)))
  // 毎フレーム: frame = walk[Math.floor(time * 10) % walk.length]
  ```

- **3D は結果の `animations`**（クリップ名の一覧）を `AnimationMixer` で再生する（`$game-3d-and-bundles`）:

  ```js
  async function loadHero() {
    const gltf = await new GLTFLoader().loadAsync(app.assets.url('bundles/hero.glb'))
    const mixer = new THREE.AnimationMixer(gltf.scene)
    mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'walk')).play()
    return mixer // 毎フレーム: mixer.update(deltaSeconds)
  }
  ```

  人型のアニメ集（`universal-animation-library`）は同じ骨格のモデル用。別のモデルに当てるなら
  `three/addons/utils/SkeletonUtils.js` の `retargetClip` を使う。
- 画像は PNG、音は MP3（元が OGG でも変換済み）、3D はテクスチャを埋め込んだ 1 つの GLB で届く。
- 素材はどれも CC0（クレジット表記は不要。ゲームのページに Platform が出典をまとめて表示する）。
- 3D の枠が閉じている（ツール一覧に `generate_model_3d` が無い）間は、3D の取り込みも `TOOL_NOT_ALLOWED` になる。
  自分で作った GLB（3D スタジオ・手続き生成）の `upload_asset` は別枠なので、閉じていても登録できる（§4）。

## 4. 取得と登録

- 結果の `download_url` は `curl -fsSL -o <suggested_path> '<download_url>'` で取得する（`suggested_path` は `assets/…`）。
- コードからは **`app.assets.url('assets/hero.png')`** が返す URL で読む
  （`<img src="assets/…">` のような相対 URL は解決されない）。
- 自分で作った音（MP3）・3D（GLB）・動画（MP4）は **`upload_asset(name, kind)`**（`kind` は `audio` / `model_3d` / `video`）で登録する。
  返った `upload_url` に `curl -fsS -X PUT -F 'file=@<パス>;type=audio/mpeg' '<upload_url>'`
  （GLB は `type=model/gltf-binary`、動画は `type=video/mp4`）でアップロードし、`get_asset` を呼ぶと確定する。
  **1 つ 256 MiB まで**。持ち込みの枠（`upload`）を 1 回使い、生成の枠は減らない。
- **大きい素材（1 ファイル数 MiB 以上の音・3D・動画）はゲームに同梱しない。** 台帳に載せた `asset_id` を
  `source/bundles.refs.json` で参照する（書庫の 1 ファイルは 30 MiB まで。書き方は `$game-3d-and-bundles` §1）。
- 素材の保存量はアカウントで 20 GiB まで（超えると `STORAGE_QUOTA_EXCEEDED`）。同じ物を何度も上げない。

## 5. 待ち時間

- ツールの処理は数秒〜数分かかる（3D と BGM が長い）。**素材を待つ間もコードは書ける**:
  先に仮の絵（色付きの四角・円）でゲームを動かし、素材が揃ったら差し替える。
- `PROVIDER_TIMEOUT` は「まだ終わっていない」。他の作業を進めてから、同じ `asset_id` で `get_asset` を呼ぶ。

## 6. 失敗したとき

| エラー | 意味 | すること |
|---|---|---|
| `BUDGET_EXCEEDED` | その種類の枠（取り込みなら `stock`、持ち込みなら `upload` の枠）を使い切った | 取り込みの枠が尽きたら生成で、生成の枠が尽きたら Canvas の描画と Web Audio の合成で作る。やり直さない |
| `STORAGE_QUOTA_EXCEEDED` | ゲームの持ち主の素材が 20 GiB を超えた | 新しく上げない。`list_assets` の既存の素材を使うか、描画・合成で作る。`notes` に 1 行書く（利用者が素材の画面で消せる） |
| `INSUFFICIENT_CREDITS` | 利用者のクレジットが尽きた（どのツールも使えない） | 以後ツールを呼ばない。手元の素材と描画・合成だけで、いまの状態をすぐ完成させる |
| `CONTENT_BLOCKED` | 内容で断られた | 表現を変えて 1 回だけやり直す。だめなら描画で作る |
| `ASSET_NOT_READY` | アップロードがまだ届いていない | アップロードの `curl` が成功したか確かめてから呼び直す |
| `ASSET_NOT_UPLOADED` / `INVALID_UPLOAD` | アップロードされていない / PNG ではない | `upload_image` からやり直す（PNG を送る） |
| `PROVIDER_TIMEOUT` | 処理に時間がかかっている | §5。`get_asset` で受け取る |
| `PROVIDER_FAILED` | 生成に失敗した | 1 回だけやり直す。だめなら描画・合成で作る |
| `ASSET_TOO_LARGE` | ファイルが大きすぎる | 縮小・短くしてからアップロードする |
| `TOOL_NOT_ALLOWED` | このターンでは使えないツール | 使わない（描画・合成で作る） |
| `TEXTURE_SOURCE_UNSUPPORTED` | `convert_texture` の元が PNG / JPEG ではない（WebP など） | PNG の素材（`upload_image` したもの）を渡す |
| `CONVERSION_FAILED` | KTX2 に変換できなかった / フリー素材の音を MP3 にできなかった | 1 回だけやり直す。だめならその画像は PNG のまま 2D で使う。音は別の素材を探す |
| `ASSET_NOT_FOUND`（`import_stock_asset`） | その `stock_id` が無い | `search_stock_assets` の結果の `stock_id` をそのまま渡す |
| `STUDIO_BUSY`（`run_3d_script`） | このジョブの 3D スタジオが別のスクリプトを動かしている | 前の実行を `get_3d_run` で受け取ってから呼ぶ（`$game-3d-studio`） |

**素材が 1 つ手に入らなくてもゲームは完成させる。** 素材は見た目を良くするもので、遊べることが先。

## 7. 音の鳴らし方（素材の使い方）

- `AudioContext` は 1 つ。最初の操作で `resume()` する（`$game-controls` §3）。
- 効果音は起動時に全部 `decodeAudioData` して `AudioBuffer` を使い回す（鳴らすたびに読み込まない）。
- BGM は `AudioBufferSourceNode` を `loop = true` で鳴らす。音量は効果音より小さく（0.3〜0.5）。
- 効果音と BGM は**別の `GainNode`** に通す。ミュートの持ち方（まとめて / 個別）と `app.store` への保存は `$game-ux` §7。
- Artifact の上限（`<kit>/profile/instructions.md` §2）とメモリ（`$game-3d-and-bundles` §3）に素材も入る。

## 8. 3D のテクスチャ（KTX2）

3D の地面・壁・モデルの**テクスチャは PNG のまま同梱しない**。`convert_texture` で KTX2 にしてから同梱する
（GPU の圧縮形式のまま読むので、メモリが PNG の約 1/4。`$game-3d-and-bundles` §2・§3）。

1. 元の画像を素材にする（内蔵の画像生成の PNG なら `upload_image` → アップロード。§3 の 2.）。
2. `convert_texture(name, asset_id, mode, mipmaps)` を呼ぶ。色のテクスチャは `mode: "color"`（既定）、
   法線マップは `mode: "normal"`。3D の面に貼るものは `mipmaps: true`（既定）、画面に等倍で出すだけなら `false`。
3. 結果の `download_url` を `suggested_path`（`assets/<name>.ktx2`）に取得し、`KTX2Loader` で読む（spec §10 のコード）。

- 画像の枠を 1 回使う（費用はかからない）。WebP の素材は変換できない。
- 2D のスプライト・UI の画像は PNG / WebP のままでよい（`<img>` や Canvas で描くもの）。

## 9. 利用者の素材（`source: user`）と「添付された素材」

利用者は自分の画像・音・3D・動画を素材として上げられる。`list_assets` / `get_asset` の結果の
`source` が `user` の素材がそれで、`description` は利用者の覚え書き（用途の手掛かり）。
発話に素材を添付すると、メッセージの後ろに「添付された素材」の一覧（`asset_id`・名前・種類・大きさ・寸法・長さ・説明）が付き、
**画像はそのまま、動画は等間隔 6 コマのコマ割り画像**（左上から右へ、上段から下段へ時刻順。各コマの左下に時刻）として
同じメッセージに添えられる。一覧に URL は無い。ファイルが要るときは `get_asset(asset_id)` で取る。

- **利用者の素材を最優先で使う。** 指示に別の言及が無ければ、同じ物を生成しない。
- **使い方は発話の指示に従う。**

  | 発話の指示 | すること |
  |---|---|
  | ゲームの中で使う・表示する・流す（「この画像を主人公に」「この動画をオープニングで流して」） | 画像は `get_asset` で取得し、§2 のとおり縮小して `assets/` に同梱する。音・3D は小さければ同梱、数 MiB を超えるもの・動画は取得せず `bundles.refs.json` で参照する（§4） |
  | 参考・雰囲気・「こういう動きで」「この感じの絵柄で」 | 添えられた画像（動画はコマ割り）を見て、絵柄・色・動き・間を真似て作る。**ファイルは同梱しない** |
  | 何も言っていない | 画像・音・3D はゲームで使う。**動画は参考として扱う**（同梱しない） |

- **動画をゲームで流すとき**: ファイルは取得せず、`source/bundles.refs.json` に
  `{"refs": {"bundles/intro/opening.mp4": "<asset_id>"}}` と書いて台帳から参照し、`manifest.json` の `bundles` に `intro` を宣言する
  （書庫にも初期ダウンロードの 20 MiB にも入らない。`$game-3d-and-bundles` §1）。
  `app.bundles.load('intro')` の後、`app.assets.url()` が返す URL（Host が渡す blob URL）を `<video>` に渡す:

  ```js
  async function playOpening() {
    await app.bundles.load('intro')
    const video = document.createElement('video')
    video.src = app.assets.url('bundles/intro/opening.mp4')
    video.playsInline = true
    video.muted = true // 自動で流すなら muted が要る。音を出すのは最初の操作の後（`$game-controls` §3）
    await video.play()
    // 描画に使うなら毎フレーム ctx.drawImage(video, …) / three.js は new THREE.VideoTexture(video)
    // 終わったら video.pause(); video.removeAttribute('src'); app.bundles.unload('intro')
    return video
  }
  ```

  結果の `duration_ms` と `width` / `height` で長さと縦横比が分かる（読み込み前に枠を決められる）。
- 利用者が上げられる形式: 画像 PNG / JPEG / WebP（4 MiB）、音 MP3・3D GLB（256 MiB）、動画 MP4（H.264・3 分・256 MiB）。
- 利用者の素材は予算を使わない（`get_asset` は何度呼んでもよい）。
