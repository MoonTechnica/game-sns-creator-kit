---
name: game-3d-and-bundles
description: 3D のゲーム（同梱の three.js の WebGPURenderer。WebGPU が無い端末は自動で WebGL2）と、素材が多い大きいゲーム（bundles/ への分割ダウンロード）を作る。GLB と KTX2 テクスチャの読み込み、バンドルの宣言と読み込み・解放、スマートフォンで落ちないためのメモリの見積もりと減らし方を扱う。3D で描くとき、ステージが複数あるとき、画像・音・モデルの合計が数 MiB を超えそうなとき、検証で MEMORY_ESTIMATE_LARGE が出たときに使う。three.js, GLB, GLTFLoader, bundles, memory.
---

# 3D と大きいゲーム

## 1. バンドルの分割（大きいゲーム）

**最初の画面に要るものだけを `bundles/` の外（`assets/`）に置く。** 2 面目以降のステージ・BGM・3D モデルは
`bundles/<名前>/` に置き、`manifest.json` の `bundles` に同じ名前を宣言する
（名前は英小文字・数字・`_`・`-`。ディレクトリと宣言は 1 対 1。片方だけだと取り込みで落とされる）。

```jsonc
// manifest.json
"bundles": {
  "stage2": { "load": "background" },  // 起動後に裏で取り始める（次に要るもの）
  "boss":   { "load": "demand" }       // app.bundles.load() したときだけ取る
}
```

```ts
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// background でも、使う前に必ず load する（裏での取得が終わっている保証は無い）
await app.bundles.load('stage2', { onProgress: (loaded, total) => drawBar(loaded / total) })
const gltf = await new GLTFLoader().loadAsync(app.assets.url('bundles/stage2/map.glb'))
scene.add(gltf.scene)

// そのステージを抜けたら、three.js の資源を dispose() してからバンドルを解放する
app.bundles.unload('stage2')
```

- 読み込み中は進み具合を画面に出す（止まって見える時間を作らない）。`load` の失敗は `SdkError`。
  `retryable` なら「タップ / クリックで再試行」を出し、同じ `load` をもう一度呼ぶ。
- `bundles/` の外（起動前に全部届く分）は **20 MiB まで**、10 MiB を超えると警告
  （スマートフォンの回線で起動を待たせる）。
- `source.zip` に `bundles/` の素材を入れない。次のターンは `list_assets` から取り直す
  （自分で作った音・GLB は `upload_asset` で登録する。`$game-asset-tools` §4）。

## 2. 3D（Kit の three.js）

- `package.json` に `"three": "file:/workspace/sdk/node_modules/three"`（`dependencies`）と
  `"@types/three": "file:/workspace/sdk/node_modules/@types/three"`（`devDependencies`）を足す（Kit の lockfile で入っている版）。
  `tsc` で型を確かめるなら `tsconfig.json` に `"skipLibCheck": true`。
- `import` できる外部パッケージは `three` と `three/addons/*` だけ（build-config が Kit の three に解決する）。
  `three/src/*` や他のパッケージは解決できずビルドが失敗する。
- 3D の形式は **GLB 1 本**（`.gltf` + `.bin` の分割・Draco は使えない）。テクスチャは **KTX2**（下の「WebGPU と KTX2」）。
  `EXT_meshopt_compression` の GLB は読める。そのときは
  `import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'` を
  `new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)` に渡す。
- 画面は全面（`$game-screen-layout` §1 の three.js の行）。`app.lifecycle.onPause` で
  `renderer.setAnimationLoop(null)` にして止める。
- 操作は `$game-controls` の references/genres.md §10（左のスティックで移動、右半分のドラッグでカメラ。
  マウスの固定は使えない）。
- 生成モデルが無い・枠が無いときは、three.js の基本形状（Box / Sphere / Capsule）とマテリアルの色で作る。
  それでも遊べるゲームにする。

### WebGPU と KTX2（sdkVersion 2 の既定）

**描画は `three/webgpu` の `WebGPURenderer`**（`manifest.json` の `renderer` は `"webgpu"`）。WebGPU が無い端末では自動で WebGL2 で描く。
書き方の正本は `<kit>/sdk/app-sdk/spec.md` §10。次の 8 つを守る:

1. `import * as THREE from 'three/webgpu'`（`'three'` から `WebGLRenderer` を使わない）。Node material の色や模様は `three/tsl`
2. `await renderer.init()` のあとに描く
3. **最初の 1 枚を try し、失敗したら新しい canvas で `forceWebGL: true` の renderer を作り直す**（spec §10 の `createRenderer`。
   adapter は取れたのに描けない端末がある）
4. `ShaderMaterial` / GLSL を書かない（Node material / TSL）
5. スマートフォンは `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`
6. 色の精度は既定（8 bit。`outputBufferType` は既定の `UnsignedByteType`）のまま。HDR の中間バッファを増やさない。
   `requiredFeatures` / `requiredLimits` を指定しない（古い GPU の互換モード〔`featureLevel: 'compatibility'`〕でも動く範囲で書く）
7. WebGPU だけの機能（compute）は `renderer.backend.isWebGPUBackend` のときだけ使い、無くても遊べるようにする
8. 使い終わったら `dispose()`（下の §3）

**テクスチャは KTX2**（Basis Universal）: 画像を素材ツールの `convert_texture` で `.ktx2` にしてから同梱し、`KTX2Loader` で読む。
トランスコーダ（`<kit>/sdk/app-sdk/basis/basis_transcoder.js` / `.wasm`。CSP で動くよう作り直したもの）を Artifact の `basis/` にコピーし、
`LoadingManager.setURLModifier` で `app.assets.url()` に通す（spec §10 のコード）。PNG をそのまま 3D のテクスチャにしない。

## 3. メモリ（スマートフォンで落ちないために）

スマートフォンのブラウザは、**使えるメモリを超えるとエラーを出さずにページを閉じる**（iOS は上限を公表していない）。
効くのはダウンロードの大きさではなく、**展開して同時に持っている量**:

| 素材 | 展開後の大きさ（目安） |
|---|---|
| 画像・テクスチャ（PNG / JPEG / WebP） | **幅 × 高さ × 4 byte × 4/3**。1024×1024 で約 5.3 MiB、2048×2048 で約 21 MiB（ファイルが 200 KB でも同じ） |
| テクスチャ（KTX2 / Basis） | **幅 × 高さ × 1 byte × 4/3**（GPU の圧縮形式のまま持つ）。1024×1024 で約 1.3 MiB |
| GLB | 中のテクスチャ（同上）+ 頂点データ |
| 音（MP3 など） | **秒数 × 48,000 × チャンネル数 × 4 byte**。ステレオ 1 分で約 22 MiB |

- **検証は「起動前の分 + 同時に持つバンドル（同じ `group` の合計。`group` が無ければいちばん大きい 1 つ）」を見積もり、
  512 MiB を超えると `MEMORY_ESTIMATE_LARGE`、768 MiB を超えると `MEMORY_ESTIMATE_VERY_LARGE` の警告を出す。**
  警告が出たら下のどれかで減らして作り直す。2〜3 GB の端末でも動かしたいなら 256 MiB に収める。
- **テクスチャは 1 辺 1024px まで**を基本にする（2048px は画面の主役 1〜2 枚だけ）。
  UI・アイコン・遠くのものは 512px 以下。縦横は 2 のべき乗にする。
- **ステージは 1 つずつ読む。** 次のステージの `app.bundles.load()` の前に、今のステージを片付ける:
  - three.js: 使い終わった `geometry.dispose()` / `material.dispose()` / `texture.dispose()` を呼び、
    `scene.remove()` する（`dispose()` しないと GPU のメモリは返らない）
  - Canvas 2D: `createImageBitmap()` で作った画像は `bitmap.close()`、`Image` は参照を外す
  - 最後に `app.bundles.unload('<名前>')`
- **BGM は `<audio>` で流す**（`const bgm = new Audio(app.assets.url('bundles/town/bgm.mp3')); bgm.loop = true`）。
  `decodeAudioData` で丸ごと PCM にしない（ステレオ 1 分で約 22 MiB）。`<audio>` なら圧縮したまま少しずつ再生される。
  音が鳴るのは最初のタップ / クリックの後（`$game-controls`）。効果音は短いものだけまとめて 1 回 decode して使い回す。
- 同じ画像・モデルを何度も読み込まない（一度読んだものを使い回す）。
- 広い世界を歩き回るゲームは、ステージ単位ではなくチャンク単位で読み込み・解放する（`$game-open-world`）。
  地域ごとのバンドルは `group` で組にし、地域を移るたびに `app.bundles.hint([...])` で隣を先読みさせる。
