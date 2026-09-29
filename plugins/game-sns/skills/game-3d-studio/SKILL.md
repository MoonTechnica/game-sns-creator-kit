---
name: game-3d-studio
description: Blender（bpy）で 3D の素材を作る「3D スタジオ」。手続き的なモデリング（小物・建物・地形・ローポリのキャラ）、GLB の手直し（大きさ・原点・向き・デシメート・結合）、リグとアニメーション（自動ウェイト + フリー素材のクリップ）、3D から 2D（8 方向スプライト・アイコン）、ベイク（AO・ライトマップ）に使う。three.js のコードで組めない形の GLB が要るとき、3D モデルを動かしたいとき、2D のゲームに 3D から描いたスプライトが欲しいときに使う。Blender, bpy, GLB, glTF, rig, sprite sheet, bake.
---

# 3D スタジオ（Blender を使用）

three.js のコードで組める形（箱・球・床・パーティクル）は、そのままコードで描くほうが安く速い。
**GLB が要る・リグやアニメーションを付ける・3D から 2D を描く・焼き込む**ときだけ使う。

手元の Blender（4.5 LTS 以上。無ければ blender.org から無料で入る）を
`blender -b --factory-startup -Y --python-exit-code 1 -P art/3d/<name>.py` で動かす。
書き出した GLB は `upload_asset`（`model_3d`）、PNG は `upload_image` で素材に登録する。
Blender が無く、利用者が入れない場合は 3D スタジオを使わずに作る（コードのジオメトリ・フリー素材・`generate_model_3d`）。

## 1. スクリプトはソースに置く

- スクリプトは **`art/3d/<name>.py`** に置く（`source.zip` に入り、配信物には入らない）。
  「剣を長くして」のような直しは、このスクリプトの数値を変えて**もう一度実行**する。
- 同じ結果が出るようにする: 最初に `bpy.ops.wm.read_factory_settings(use_empty=True)` で空のシーンにし、
  乱数は `random.seed(<固定値>)`。時刻やファイルの一覧順に依存しない。
- 書き出し先は環境変数 `OUT` の下（`os.environ["OUT"]`）。入力の素材は `INPUTS` の下。
  手元では、スクリプトの先頭で `OUT` が無ければ `art/3d/out` を使うようにしておく。- 版で変わる API を使うときは `bpy.app.version` を見て分ける（5.x で名前が変わったものがある）。

## 2. 形の決まりごと

| 項目 | 決まり |
|---|---|
| 単位 | 1 = 1 m。キャラの身長は 1.6〜2.0 |
| 向き | 正面は -Y（Blender）。上は +Z。書き出し器が glTF の +Y up に直す |
| 原点 | 足元（地面に立つもの）・中心（浮くもの・回すもの） |
| 変形 | 書き出す前に大きさ・回転を適用する（`transform_apply`） |
| 三角形 | 小物 2,000 まで・キャラ 15,000 まで・背景 1 つ 30,000 まで |
| テクスチャ | 1024 px まで（スマートフォンのメモリ。KTX2 にするなら書き出した PNG を `convert_texture`） |
| マテリアル | Principled BSDF の基本色・粗さ・金属だけ（ほかのノードは glTF に出ない） |
| 1 ファイル | 8 MiB まで |

## 3. 書き出し

- GLB: `bpy.ops.export_scene.gltf` に `export_format="GLB"`・`export_meshopt_compression_enable=True`
  （拡張は既定の `EXT_meshopt_compression`。three.js の `GLTFLoader` が読む）。
  テクスチャは GLB に埋め込まれる（別ファイルにしない）。
- アニメーション: 1 動作 = 1 アクション。名前は `Idle` / `Walk` / `Run` / `Jump` / `Attack` のように英語の動詞。
  複数のアクションを出すときは NLA トラックに積んで `export_animation_mode="NLA_TRACKS"`。
- PNG: 背景を透明にするなら `scene.render.film_transparent = True`、形式は `PNG` / `RGBA`。

## 4. 作業ごとの手順

### 4.1 手続き的なモデリング

プリミティブ（立方体・円柱・円錐・ico 球）とモディファイア（ベベル・配列・ミラー）で組み、
使った色ごとにマテリアルを 1 つ作る。細かい形は頂点を増やさず、色と配置で見せる（ローポリ）。

### 4.2 手直し（生成した GLB・フリー素材）

`import_scene.gltf` で読む。
大きさを揃え・原点を足元へ・向きを -Y へ・デシメート（`DECIMATE`、目標の三角形数 ÷ 今の数）をかけて書き出す。

### 4.3 リグとアニメーション

- 人型は、フリー素材の Quaternius UAL（`search_stock_assets` で `universal animation`）の骨格とクリップに合わせるのが早い。
- 自分のメッシュに骨を付けるときは、骨を編集モードで作り、メッシュ → 骨の順に選んで
  `parent_set(type="ARMATURE_AUTO")`（自動ウェイト）。頂点グループが骨の数だけできたか確かめる。
- キーフレームは `pose.bones[<名前>].keyframe_insert(...)`。1 アクションずつ NLA トラックへ。

### 4.4 3D から 2D（スプライト）

正射影カメラ（`ORTHO`）を斜め上 30〜60° に置き、物を 45° ずつ回して 8 枚描く。
描画は **Cycles（CPU）**、サンプル 16〜32、解像度はゲームで表示する大きさ（64〜256 px）。
背景は透明。できた PNG を Phaser のスプライトシートにする（`$game-phaser`）。

### 4.5 ベイク

AO やライトを Cycles でテクスチャに焼き込むと、three.js 側でライトを減らせる。
UV を展開（`smart_project`）→ 画像テクスチャのノードを作って選択 → `bpy.ops.object.bake(type="AO")` → PNG で保存。
1024 px・32 サンプルで数秒〜十数秒。

