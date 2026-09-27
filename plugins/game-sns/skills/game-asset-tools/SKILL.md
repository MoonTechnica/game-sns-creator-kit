---
name: game-asset-tools
description: ゲームの絵と音を用意する。画像の作り方（内蔵の画像生成、無い環境では generate_image）と、素材ツール（MCP。generate_image / upload_image / remove_background / convert_texture / generate_sound_effect / generate_music / generate_model_3d / upload_asset / list_assets / get_asset）の使い方、予算の配分、透過キャラクター・効果音・BGM の手順、失敗したときの対処を扱う。画像・キャラクター・背景・効果音・BGM・3D モデルを作るとき、または素材ツールが使えるときに使う。assets, sprites, sound effects, music, MCP tools, budget.
---

# 絵と音の用意（画像生成 + 素材ツール）

**画像の作り方は環境で 2 通りある。** それ以外の規則はどちらでも同じ。

| 環境 | 画像の作り方 | できた PNG |
|---|---|---|
| **内蔵の画像生成がある** | 内蔵の画像生成で作る。**背景を透過できず、大きさの指定も効かない**（常に 1254px 四方前後・1〜2 MB）。画像の枠を使わない | `/workspace/generated_images/` に保存される |
| **内蔵の画像生成が無い**（手元のエージェントなど） | 素材ツール `generate_image(name, prompt, size, transparent)` で作る。透過は `transparent=true` で 1 回で済む。画像の枠を 1 回使う | 結果の `download_url` から取得する（§4） |

透過・3D・音は素材ツール（MCP）で作る。
**ツール一覧に素材ツール（`list_assets` など）が無いとき**は、絵は Canvas（three.js）で描き、音は Web Audio で合成する。

## 1. 最初にやること（ツールを呼ぶ前に）

1. **`list_assets` を呼ぶ。** 前のターン（リミックス元を含む）で作った素材が残っている。**作り直さずに使う**。
   足りない物だけを作る。
2. **何を作るかを先に決めて、予算に収める**。結果の `budget` に残りが出る。目安（1 本のゲーム）:

   | 種類 | 使う枠 | 目安 |
   |---|---|---|
   | 背景・タイトル画 | 内蔵の画像生成（枠を使わない）/ `generate_image`（画像の枠を 1 回） | 1〜3 枚 |
   | 透過キャラクター・アイテム | 内蔵の画像生成なら画像の枠を **2 回**（`upload_image` + `remove_background`）/ `generate_image(transparent=true)` なら 1 回 | 主役 1 + 敵・アイテム 2〜4 |
   | 効果音 | 音の枠を 1 回ずつ | 4〜6 種（決定・ジャンプ・得点・ヒット・失敗・クリア） |
   | BGM | 音の枠を 1 回（1 分単位で課金） | 1 本（30 秒前後をループ） |
   | 3D モデル | 3D の枠（**ツール一覧に `generate_model_3d` があるときだけ**） | 主役 1〜2 体 |

3. **図形・文字・ボタン・パーティクル・弾・床のタイルは生成しない。** Canvas で描く方が速く、軽く、きれいで、
   画面の大きさにも追従できる。操作部とボタンは入力キット（`$game-controls`）が描く。

## 2. 作り方

| 作りたいもの | 手順 | 置き方 |
|---|---|---|
| 背景・タイトル画面 | 画像を作る（冒頭の表）→ `convert <PNG> -resize 1024x1024 -quality 85 assets/bg.jpg` | JPEG。長辺 1024px 以下 |
| キャラクター・アイテム（透過） | 内蔵の画像生成なら §3 の手順。`generate_image` なら `transparent=true` で作って取得する（§4） | 透過 PNG。長辺 512px 以下 |
| 効果音 | `generate_sound_effect(name, prompt, duration_sec)`。短く具体的に（「軽いジャンプ音、上がる音程、0.3 秒」） | MP3。0.5〜2 秒 |
| BGM | `generate_music(name, prompt, duration_sec=30)`。雰囲気・テンポ・楽器を書き「ループしやすい」と添える | MP3。ループ再生 |
| 3D モデル | 透過した元画像の `asset_id`（§3 の結果、または `generate_image(transparent=true)` の結果）で `generate_model_3d(name, asset_id, polycount="low")`。**数分かかる** | GLB を `bundles/` に置く（`$game-3d-and-bundles`） |
| 自分で作った音（Web Audio の書き出し）・GLB | `upload_asset(name, kind)` で登録（§4）。登録しないと次のターンで消える | — |

- 生成したままの PNG（1 枚 1〜2 MB）を `assets/` に入れない。必ず縮小する。
- 同じキャラクターの色違い・表情違いは、同じ指示文（絵柄・配色・構図）を使い回して描かせる。
- 絵柄はゲーム全体でそろえる（最初に「ドット絵 / フラットなイラスト / 水彩」などを決め、毎回の指示に入れる）。

## 3. 透過キャラクターの手順（内蔵の画像生成のとき）

1. 内蔵の画像生成で、キャラクターを**単色の背景**（白か緑）で 1 枚作る。全身が枠に収まり、影を落とさない構図で。
2. `upload_image(name)` を呼び、返った `upload_url` へアップロードする:
   `curl -fsS -X PUT -F 'file=@/workspace/generated_images/<ファイル名>.png;type=image/png' '<upload_url>'`
3. **アップロードが終わってから**、その `asset_id` で `remove_background` を呼ぶ
   （先に呼ぶと `ASSET_NOT_READY`）。
4. 結果の `download_url` を取得する: `curl -fsSL -o /tmp/hero.png '<download_url>'`
   （URL は 10 分で失効する。切れたら `get_asset(asset_id)` で取り直す）。
5. 縮小して置く: `convert /tmp/hero.png -resize 512x512 assets/hero.png`

## 4. 取得と登録

- 結果の `download_url` は `curl -fsSL -o <suggested_path> '<download_url>'` で取得する（`suggested_path` は `assets/…`）。
- コードからは **`app.assets.url('assets/hero.png')`** が返す URL で読む
  （`<img src="assets/…">` のような相対 URL は解決されない）。
- 自分で作った音（MP3）や 3D（GLB）は **`upload_asset(name, kind)`**（`kind` は `audio` か `model_3d`）で登録する。
  返った `upload_url` に `curl -fsS -X PUT -F 'file=@<パス>;type=audio/mpeg' '<upload_url>'`
  （GLB は `type=model/gltf-binary`）でアップロードし、`get_asset` を呼ぶと確定する。同じ種類の生成の枠を 1 回使う。

## 5. 待ち時間

- ツールの処理は数秒〜数分かかる（3D と BGM が長い）。**素材を待つ間もコードは書ける**:
  先に仮の絵（色付きの四角・円）でゲームを動かし、素材が揃ったら差し替える。
- `PROVIDER_TIMEOUT` は「まだ終わっていない」。他の作業を進めてから、同じ `asset_id` で `get_asset` を呼ぶ。

## 6. 失敗したとき

| エラー | 意味 | すること |
|---|---|---|
| `BUDGET_EXCEEDED` | その種類の枠を使い切った | 残りは Canvas の描画と Web Audio の合成で作る。やり直さない |
| `INSUFFICIENT_CREDITS` | 利用者のクレジットが尽きた（どのツールも使えない） | 以後ツールを呼ばない。手元の素材と描画・合成だけで、いまの状態をすぐ完成させる |
| `CONTENT_BLOCKED` | 内容で断られた | 表現を変えて 1 回だけやり直す。だめなら描画で作る |
| `ASSET_NOT_READY` | アップロードがまだ届いていない | アップロードの `curl` が成功したか確かめてから呼び直す |
| `ASSET_NOT_UPLOADED` / `INVALID_UPLOAD` | アップロードされていない / PNG ではない | `upload_image` からやり直す（PNG を送る） |
| `PROVIDER_TIMEOUT` | 処理に時間がかかっている | §5。`get_asset` で受け取る |
| `PROVIDER_FAILED` | 生成に失敗した | 1 回だけやり直す。だめなら描画・合成で作る |
| `ASSET_TOO_LARGE` | ファイルが大きすぎる | 縮小・短くしてからアップロードする |
| `TOOL_NOT_ALLOWED` | このターンでは使えないツール | 使わない（描画・合成で作る） |
| `TEXTURE_SOURCE_UNSUPPORTED` | `convert_texture` の元が PNG / JPEG ではない（WebP など） | PNG の素材（`upload_image` したもの）を渡す |
| `CONVERSION_FAILED` | KTX2 に変換できなかった | 1 回だけやり直す。だめならその画像は PNG のまま 2D で使う |

**素材が 1 つ手に入らなくてもゲームは完成させる。** 素材は見た目を良くするもので、遊べることが先。

## 7. 音の鳴らし方（素材の使い方）

- `AudioContext` は 1 つ。最初の操作で `resume()` する（`$game-controls` §3）。
- 効果音は起動時に全部 `decodeAudioData` して `AudioBuffer` を使い回す（鳴らすたびに読み込まない）。
- BGM は `AudioBufferSourceNode` を `loop = true` で鳴らす。音量は効果音より小さく（0.3〜0.5）。
- ミュートのボタンで BGM と効果音をまとめて止められるようにする。
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
