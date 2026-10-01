---
name: game-physics
description: 物理で動くゲーム（落下・衝突・転がる・積む・跳ねる・車・ラグドール・ピンボール・物理パズル）を、同梱の Rapier（2D / 3D。決定版）で作る。画面と対戦サーバーで同じ結果になる書き方（seed 付きの乱数・固定の dt・剛体を足す順番）、three.js への反映（syncMeshes）、画面側の補間を扱う。遊びに物理の動きが要るときに使う。physics, rapier, rigid body, collision, deterministic.
---

# 物理（同梱の Rapier）

物理は Kit の lockfile にある **Rapier 0.21.0 の決定版**だけを使う（2D は `rapier2d-deterministic-compat`、3D は `rapier3d-deterministic-compat`）。
**同じ入力なら、画面でも対戦サーバーでも同じ結果になる**（対戦サーバーも同じ版を持つ）。
ほかの物理ライブラリ（cannon-es / ammo.js / Jolt など）は入らない。自前で衝突判定を書くより Rapier を使う。
**例外: 2D を同梱の Phaser 4 で作る 1 人用のゲーム**は、Phaser の Arcade（四角と円の当たり・重力）や Matter でもよい
（`$game-phaser` §6）。**オンライン対戦のルールの物理は必ずこの Rapier**（Phaser の物理は端末ごとに結果が同じになる約束が無い）。

**API の正本は `<kit>/sdk/app-sdk/spec.md` §9** と、Rapier の型（`<kit>/sdk/node_modules/@dimforge/rapier3d-deterministic-compat/dist/rapier.d.ts`）。先に読む。

## 1. 入れ方

`package.json`（`dependencies`）に使う方だけを書く:

```json
{ "dependencies": { "@dimforge/rapier3d-compat": "file:/workspace/sdk/node_modules/@dimforge/rapier3d-deterministic-compat" } }
```

2D なら `"@dimforge/rapier2d-compat": "file:/workspace/sdk/node_modules/@dimforge/rapier2d-deterministic-compat"`。中身は決定版で、build-config がそれを確かめて
`app.bundle.js` に取り込む（3D で約 4.2 MiB、2D で約 3.3 MiB。起動前に届く 20 MiB に数える）。

```ts
import RAPIER from '@dimforge/rapier3d-compat'
import { syncMeshes } from '@workspace/app-sdk/physics'

await RAPIER.init()   // 必須。呼ばずに new RAPIER.World すると失敗する
```

- **three.js の `three/addons/physics/RapierPhysics.js` は使わない**（Rapier を CDN から読み込もうとして検証で落ちる）。
  three.js への反映は `syncMeshes(world, map)`（剛体の handle → Mesh）、当たりの形の確認は `debugLines`。
- 2D の遊び（横スクロール・ピンボール・積み上げ）は 2D、奥行きのある遊びは 3D。2D の遊びに 3D を使わない（重い）。

## 2. 同じ結果になる書き方（必ず守る）

画面の予測・練習モードと対戦サーバーで**結果が割れると、相手と違う世界を見る**。次の 5 つを守る。

1. **世界の初期値を `Math.random()` で作らない。** seed 付きの乱数（mulberry32）を使い、seed は状態（`ctx.state`）に持つ。
   `Math.sin` / `Math.cos` / `Math.pow` などは JS エンジンで結果が違うことがある（仕様で許されている）ので、
   **初期の位置・速度は四則と整数のハッシュで作る**。角度から向きを作るなら、サーバーで 1 回だけ計算して結果の数値を状態で配る。

   ```ts
   export function mulberry32(seed: number) {
     return () => {
       seed = (seed + 0x6d2b79f5) | 0
       let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
       t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296
     }
   }
   ```

2. **`dt` は固定。** `world.timestep = 1 / tickRate`（対戦）/ `1 / 60`（1 人用）。**可変のフレーム時間（`requestAnimationFrame` の差分）を
   `step` に入れない。** 画面のフレームと物理の step がずれる分は、step を回数で追いかけ（1 フレームに最大 3 回まで）、描画は補間する（§3）。
3. **剛体を足す・消す順番を入力から決める。** 参加者の `slot` の昇順、ID の昇順のように決める。`Map` / `Set` の走査順や
   届いた順（通信の順）に任せない。handle は足した順で決まるので、順番がずれると以後の結果が全部ずれる。
4. **物理の計算はルールの関数に切り出して export し、画面の予測・練習からも同じものを呼ぶ**（`$game-multiplayer` §2.2 と同じ）。
5. **物理の世界を作るコードを画面とサーバーで二重に書かない。** `server/main.ts` の関数を画面が import する。

## 3. 画面に描く（補間）

- 1 人用: 固定 dt で step し、`syncMeshes(world, meshes)` で three.js に写してから描く。
  スマホで重いときは剛体の数を減らす（目安: 3D で動く剛体 200 まで、2D で 500 まで）。
- 対戦: 物理の結果（位置・向き）は**サーバーの状態**で届く。画面はそれを補間して描く（`$game-multiplayer` §2.2 の予測・補間）。
  自分の操作で動くものだけ予測してよい。相手や落ちてくる物は予測しない。
- 描画のフレームが step より速いときは、前後 2 つの step の位置を線形に補間して描く（カクつかない）。

## 4. GPU の物理は飾りだけ

WebGPU（TSL の compute）で動かす粒子・布・水しぶきは**結果が端末ごとに違う**（対戦サーバーでは回せない）。
**勝敗・当たり・得点に関わるものは Rapier で計算し、GPU の物理は見た目の飾りにだけ使う。**
WebGPU が使えない端末（WebGL2 で描いている）では飾りを減らすか消しても遊べるようにする。

## 5. 出力前のチェック

- [ ] `package.json` の Rapier は `file:/workspace/sdk/node_modules/@dimforge/rapier3d-deterministic-compat`（または 2d）で、import は `@dimforge/rapier3d-compat`（`rapier2d-compat`）
- [ ] `await RAPIER.init()` を最初に 1 回
- [ ] `world.timestep` が固定値（`1 / tickRate` か `1 / 60`）。step に可変の時間を入れていない
- [ ] 初期配置に `Math.random()` / `Math.sin` / `Math.cos` を使っていない（seed 付きの乱数と四則）
- [ ] 剛体を足す順番が入力（slot・ID の昇順）で決まっている
- [ ] 消した剛体の Mesh を `syncMeshes` の map から外している（残っていると例外）
- [ ] `RapierPhysics.js` を import していない
