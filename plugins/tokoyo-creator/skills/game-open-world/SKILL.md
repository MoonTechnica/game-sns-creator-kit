---
name: game-open-world
description: 広い世界を歩き回るゲーム（オープンワールド・探索・サンドボックス・無限に続く地形）を、スマートフォンでも落ちないように作る。世界をチャンクに分けて今いる場所の周りだけを読み込み・解放する、地形と配置を seed から作る（決定的な乱数とノイズ）、遠くを隠す、地域ごとの素材を bundles の group にして先読みさせる、セーブを seed と差分だけにする、協力プレイで世界を共有して 30 分ごとに卓を立て直す、を扱う。遊びの説明に「広い世界」「探索」「歩き回る」「冒険」「島」「無限」「サンドボックス」「開拓」「クラフト」があるときに使う。open world, procedural, chunk streaming, seed, terrain.
---

# オープンワールド

**3D の書き方（`WebGPURenderer`・KTX2・メモリ）は `$game-3d-and-bundles`、API の正本は `<kit>/sdk/app-sdk/spec.md`**
（§3.2 `app.store` の `blob`、§3.6 `app.bundles` の `hint`、§8.2 `app.documents`、§10 描画）。先に読む。
下のコード（mulberry32・整数ハッシュ・チャンクの範囲）はそのまま使ってよい。

**原則: 世界を丸ごと持たない。** 持つのは seed（種）と、プレイヤーが変えたところだけ。地形と配置は、要るときに seed から作り直す。

## 1. チャンク（今いる場所の周りだけを持つ）

| 項目 | 値 |
|---|---|
| 1 チャンクの大きさ | **32〜64 m 四方**（3D）/ 32〜64 タイル（2D） |
| 読み込み半径 r | **PC 3 / スマートフォン 2**（`matchMedia('(pointer: coarse)')` で分ける） |
| 解放 | **半径 r + 1 の外へ出たら**解放する（境目を行き来しても読み込みと解放を繰り返さない） |
| 順番 | 近い順、同じ近さなら**進行方向を先**に |
| 1 フレームに作る数 | **1 チャンクまで**（まとめて作ると、そのフレームが止まって見える） |
| 同時に持つ量 | `(2r + 1)² × 1 チャンクの展開後の大きさ` を §5 の予算に収める（r = 3 なら 49 個） |

```ts
function streamChunks() {
  const center = chunkOf(player.x, player.z)
  for (const coord of chunksToRelease(loadedCoords(), center, RADIUS)) release(coord)  // r + 1 の外
  const next = chunksToLoad(center, RADIUS, heading).find((c) => !isLoaded(c))       // 近い順・進行方向優先
  if (next) build(next)                                                             // 1 フレームに 1 つ
}
```

- **解放は `dispose()` まで**: そのチャンクで作った `geometry.dispose()` / `texture.dispose()`、共有していない
  `material.dispose()` を呼んで `scene.remove()` する。`dispose()` しないと GPU のメモリは返らない。
  同じ形・同じ色のもの（木・岩・石）は geometry と material を**全チャンクで 1 つ**にして使い回す（`InstancedMesh` も可）。
- 開発中は `renderer.info.memory`（`geometries` / `textures`）を画面の隅に出し、歩き回っても**増え続けない**ことを確かめる。
- **遠くに穴を見せない**: 読み込み半径の少し手前から霧（`scene.fog`）で隠すか、低い解像度の地形の輪（LOD）を
  外側に置く。カメラの `far` を読み込み半径 + 1 チャンクに合わせる。

## 2. seed から作る（どの端末でも同じ世界）

- **`Math.random()` を世界の生成に使わない**（seed を渡せない）。seed 付きの擬似乱数 **mulberry32** を使い、
  チャンクごとに `seed` とチャンク座標から混ぜた値で作り直す（前のチャンクの乱数の続きにしない。読む順で世界が変わる）。
- **`Math.sin` / `Math.cos` / `Math.pow` / `Math.exp` などを世界の生成に使わない**（精度が決まっておらず、端末・ブラウザで
  結果が違ってよい。協力プレイで世界が食い違う）。ノイズは**整数のハッシュ（`Math.imul` / xor / シフト）と四則**で作る。
  カメラや演出（端末ごとに違ってよいもの）には使ってよい。

```ts
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(seed: number, x: number, z: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x1b873593)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}
// value noise: 格子点の hash3 を smoothstep（t * t * (3 - 2 * t)）で補間。大きな起伏 + 細かい起伏を足す
```

- 隣のチャンクとの境目は**同じ式の同じ座標**で高さを出す（`cx * SIZE + i * STEP`）。継ぎ目が出ない。
- 置き物の id は **`<cx>:<cz>:<番号>`** のように seed とチャンクで決まる形にする。拾った・壊したの印として保存できる。
- 生成の関数は描画から切り離した純粋関数にして、**同じ seed で同じチャンクになる**ことを単体テストで確かめる
  （`src/world.ts` + `src/world.test.ts`）。

## 3. 地域ごとの素材（`bundles/` と `group`）

地形と配置は seed から作り、**素材（建物・敵・その地域の BGM）だけ**を地域ごとのバンドルにする。

```jsonc
// manifest.json（sdkVersion 2）
"bundles": {
  "town":    { "load": "background" },                  // 始まりの地域
  "forest":  { "load": "demand", "group": "north" },    // group = 同時に読む組（メモリの見積もりもこの単位）
  "ruins":   { "load": "demand", "group": "north" },
  "desert":  { "load": "demand", "group": "south" }
}
```

```ts
async function enterRegion(region: string, leaving: string) {
  // 地域を移るたびに、今いる地域の隣を先読みさせる（任意。最大 8 個。同じ group は一緒に取られる）
  app.bundles.hint(neighborsOf(region))
  // 使う前には必ず load（先読みが終わっている保証は無い）。離れた地域は dispose() してから unload
  await app.bundles.load(region, { onProgress: drawBar })
  app.bundles.unload(leaving)
}
```

- 先読みは Host が 32 MiB まで持つ。`hint` に入らなくなった地域の先読みは手放される。
- **検証のメモリ見積もりは「起動前の分 + いちばん大きい group の合計」**。地域を group に分けると、同時に持たない地域が
  見積もりに入らない。group を付けないと、いちばん大きい 1 つだけが数えられる。

## 4. セーブは seed + 差分

- 保存するのは **seed、プレイヤーが変えたところ（拾った・壊した・置いたものの id と中身）、位置と持ち物**だけ。
  地形・木・岩の位置は保存しない（seed から作り直せる）。
- 差分は **`storeSchema` の `blob` 型**のフィールドに置く（SDK が gzip して送る。上限は圧縮後で **1 MiB**）。

```jsonc
"storeSchema": { "fields": {
  "seed":    { "type": "number", "default": 0 },     // 0 = まだ世界が無い（初めて遊ぶ）
  "changes": { "type": "blob",   "default": null }   // { collected: [...], placed: [...], position: {...} }
} },
"capabilities": ["store.read", "store.write"]
```

- **オートセーブは 1 分に 1 回まとめる**（変わった印を付け、タイマーで `set`）。`app.lifecycle.onPause` でも書く。
  書き込みは毎分 12 回までなので、拾うたびに書かない。
- 新しい世界の seed は `crypto.getRandomValues(new Uint32Array(1))`（0 は「無い」の印なので避ける）。
- 差分が 1 MiB に近づく遊び（何でも置ける・壊せる）は、チャンクごとにまとめて古い変更を上書きする
  （同じマスの変更は最後の 1 つだけ持つ）。

## 5. メモリ（スマートフォンで落ちないために）

`$game-3d-and-bundles` §3 に従う。オープンワールドで特に効くもの:

- テクスチャは **KTX2**（`convert_texture`）。PNG のままだと 1 画素 4 byte で、チャンクが増えるほど効いてくる。
- 地形の頂点色・単色のマテリアルで済むところはテクスチャを使わない。
- チャンク 1 つの展開後の大きさ × `(2r + 1)²` + 起動前の分 + group の合計 ≤ **512 MiB**（2〜3 GB の端末も狙うなら 256 MiB）。
- BGM は地域ごとに `<audio>` でストリーミングする（`decodeAudioData` で丸ごと持たない）。

## 6. 協力プレイの世界（2 人以上で同じ世界を歩く）

| 何 | 誰が持つ |
|---|---|
| 地形・配置（seed から決まるもの） | **各端末が seed から作る**（通信しない） |
| 改変・プレイヤーの位置・敵 | 一緒に遊んでいる間は **対戦サーバー**（`$game-multiplayer`） |
| 世界の保存（次に集まるときまで） | **`app.documents`** の `worlds` コレクションに seed + 差分（`$game-documents`。`maxBytes` は 1 MiB まで） |
| 各自の持ち物 | 各自の `app.store` |

- `documentSchema` の `worlds` は `members` を遊ぶ人数に、`write` を `owner`（卓を立てた人だけが書く）か `member` にする。
- **1 回の卓は最長 30 分**（`maxDurationSec` は 1800 まで）。長く遊ぶなら **30 分ごとに世界を保存して卓を立て直す**:
  `session.onFinish` に `finish.reason === 'timeout'`（時間切れ）が来たら差分を `worlds` に書き、「続きから」ボタンで新しい卓を立てて同じ場を読む
  （`session` は `app.space.join` が返したもの。`app-sdk/spec.md` §3.3）。
  終わる数分前に画面で知らせる。
- 全員が同じ seed を使う（場の作成時に seed を決めて `worlds` に書き、入った人はそれを読む）。

## 7. チェック

- [ ] 生成に `Math.random` / `Math.sin` などを使っていない（mulberry32 + 整数ハッシュ + 四則）
- [ ] 同じ seed で同じチャンクになる単体テストがある
- [ ] 読み込み半径（PC 3 / スマホ 2）と解放半径（+ 1）、1 フレームに 1 チャンク、進行方向優先
- [ ] 解放で `dispose()` し、`renderer.info` が歩き回っても増え続けない
- [ ] 遠くを霧か LOD で隠している
- [ ] セーブは seed + 差分（`blob`）、オートセーブは 1 分に 1 回 + `onPause`
- [ ] 地域の素材は `bundles` + `group`、地域を移るたびに `hint`
- [ ] 協力プレイなら `worlds` に保存し、30 分で卓を立て直す流れがある
