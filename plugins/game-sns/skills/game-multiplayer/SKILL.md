---
name: game-multiplayer
description: 2〜8 人のオンライン対戦のゲーム（manifest の space と server.bundle.js）を作る。defineSpace でルールを書き、画面は同じ定義を app.space.join に渡す。ターン制と同時操作（予測・補間）、人数と役割（1 対 4 などの非対称）、順位、切断・時間切れ、待機と招待の画面、練習モード（依頼されたときだけ）を扱う。遊びの説明に「対戦」「〜人で」「相手」「勝負」と明示されているときだけ使う。multiplayer, versus, server, realtime, turn-based, prediction, roles.
---

# オンライン対戦（2〜8 人）

対戦は 2 つのファイルで作る。

| ファイル | 中身 | 動く場所 |
|---|---|---|
| `server/main.ts` → `server.bundle.js` | **ルール**（状態・入力・1 tick の計算・参加 / 離脱・決着）。`defineSpace({ … })` を `export default` | Platform の対戦サーバー。練習モードでは画面の中 |
| `src/main.ts` → `app.bundle.js` | 画面。**同じ定義を import して** `app.space.join(definition)` に渡し、届いた `state` を描く | ブラウザ |

**API の正本は `<kit>/sdk/app-server-sdk/spec.md`（定義）と `<kit>/sdk/app-sdk/spec.md` §3.3（画面）**。先に読む。
`<kit>/sdk/sample-app/`（○×。ターン制）が最小の実例。

接続・席の確認・通信量の上限・結果の記録は Platform が持つ。**サーバーの仕組み（Colyseus の Room・WebSocket・認証）は書かない。**

## 1. 守ること

- **勝敗と進行の判定は定義の中だけで行う。** 画面側で決めた結果は記録されない。
- **画面から届いた値を信用しない。** 手番違い・範囲外・重複・巨大な値が届く前提で、`onMessage` / `step` で
  形・手番・範囲を確かめ、合わないものは捨てる。入力（`ctx.input(slot)`）の数値も範囲を確かめる（`Math.sign` や上下限で丸める）。
- **Space ごとの値はすべて `ctx.state` に置く。** モジュールの `let` や Map に置かない
  （1 つの定義が同じサーバーで複数の対戦を同時に動かすので、混ざる）。秘密にしたい値（相手の手札など）だけは
  `ctx.state` をキーにした `WeakMap` に置き、本人へは `ctx.send(slot, …)` で送る。
- **schema の数値・真偽値・文字列の欄には `.default(値)` を付ける**（付けないと `undefined` から始まり `NaN` になる）。
  配列・Map は `t.array('uint8')` / `t.map(Player)` のように書く（数値の配列は型名の文字列）。
- 決着したら `ctx.finish({ outcomes, ranks? })` を **1 回だけ**呼ぶ。全員の slot に結果を入れる。
  3 人以上なら `ranks`（1 位が 1、同順位あり）も入れる。呼ばないと時間切れで結果が残らない。
- **時間切れを自分で持つ**: `maxDurationSec` より前に `ctx.elapsedMs` を見て判定勝ち・引き分けにする。
- `step` は `ctx.dt` と入力だけで決まる計算にする（`Date.now()` / `Math.random()` / `performance` を読まない）。
  画面の予測と練習モードも同じ `step` を呼ぶので、ずれると動きがガタつく。乱数が要るなら状態に種を持って自前の擬似乱数で進める。
- `slot` は **1 起点**。`0` は「誰でもない」（空きマス・勝者なし）の意味にだけ使う。
- `setTimeout` / `setInterval` は使わない（検証で落ちる）。周期処理は `tickRate` と `step`。

## 2. ルールの書き方

### 2.1 ターン制（盤・カード・すごろく）

`input` と `step` は要らない。手は `onMessage` で受け、`ctx.state` を書き換えるだけで全員に届く。

```ts
import { defineSpace, schema, t } from '@workspace/app-server-sdk'

const Game = schema({
  cells: t.array('uint8'),
  turn: t.uint8().default(1),
  done: t.boolean().default(false),
})

export default defineSpace({
  state: Game,
  setup(ctx) {
    for (let i = 0; i < 9; i += 1) ctx.state.cells.push(0)
    ctx.state.turn = ctx.players[0]?.slot ?? 1
  },
  onMessage(ctx, player, type, payload) {
    if (type !== 'move' || ctx.state.done || player.slot !== ctx.state.turn) return
    const cell = (payload as { cell?: unknown }).cell
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) return
    if (ctx.state.cells[cell] !== 0) return
    ctx.state.cells[cell] = player.slot
    // 次の手番: 席の順に回す（3 人以上でも同じ）
    const order = ctx.players.map((p) => p.slot)
    ctx.state.turn = order[(order.indexOf(player.slot) + 1) % order.length]
  },
})
```

- 3 人以上の手番は `ctx.players` の順に回し、**抜けた人（`connected: false`）は飛ばす**。

### 2.2 同時操作（アクション・レース・格闘）

`input`（1 tick ぶんの入力の schema。数値と真偽値だけ）と `step` を持たせる。画面は 1 tick に 1 つ入力を送り、
サーバーは `step` で 1 つずつ使う。

```ts
const Fighter = schema({
  x: t.float32().default(0),
  hp: t.uint8().default(100),
  role: t.string().default(''),
})
const Arena = schema({ fighters: t.map(Fighter), timeLeftMs: t.uint32().default(90_000) })
const Pad = schema({ moveX: t.int8().default(0), attack: t.boolean().default(false) })

export const SPEED = 220

/** 1 人ぶんの移動。画面の予測（predict.reconciler）もこれを呼ぶ。 */
export function move(fighter: { x: number }, input: { moveX: number }, dt: number) {
  fighter.x = Math.min(960, Math.max(0, fighter.x + Math.sign(input.moveX) * SPEED * dt))
}

export default defineSpace({
  state: Arena,
  input: Pad,
  tickRate: 30,
  rewind: { collection: 'fighters', fields: ['x'] },   // 当たり判定を撃った人の見ていた位置で行う
  onJoin(ctx, player) {
    if (ctx.state.fighters.has(String(player.slot))) return   // 再接続
    const fighter = new Fighter()
    fighter.role = player.role
    ctx.state.fighters.set(String(player.slot), fighter)
  },
  step(ctx) {
    for (const player of ctx.players) {
      const me = ctx.state.fighters.get(String(player.slot))
      const input = ctx.input(player.slot)
      if (!me || !input) continue
      move(me, input, ctx.dt)
      if (input.attack) hitOthers(ctx, player.slot, me)   // 当たり判定（ctx.lastSeenBy を使う。自分で書く）
    }
    ctx.state.timeLeftMs = Math.max(0, ctx.state.timeLeftMs - ctx.dt * 1000)
    if (ctx.state.timeLeftMs === 0) finishByHp(ctx)       // 残り体力で順位を付けて ctx.finish（自分で書く）
  },
})
```

- **移動の計算は関数に切り出して export し、画面の予測からも呼ぶ**（上の `move`）。
- `tickRate` は 20〜30 が基本。60 は速い格闘だけ（通信と CPU が倍になる）。
- 当たり判定などの「誰かが見ていたもの」に依存する判定は `rewind` を宣言し、
  `ctx.lastSeenBy(slot).value(target, 'x')` で撃った人が見ていた位置を使う。

### 2.3 遅延に強い遊びにする（同時操作）

通信には往復 50〜150 ms の遅れがある。**遊びのほうを遅れに合わせる。**

- 攻撃の出だし（予備動作）は 6 フレーム（100 ms）以上。構えを見せてから当てる。
- 1 フレームの目押し・ジャストガードを勝敗の鍵にしない。判定は少し大きめに。
- ダメージ・撃破・得点は**サーバーの状態が変わってから**演出する（画面で先に決めない）。
- 自分の移動は予測ですぐ動かし、相手から受ける動き（ふっとび）は予測しない。

### 2.4 `step` で物理を使う（Rapier）

物理で動く対戦（押し合い・玉転がし・車・積み崩し）は、対戦サーバーでも同梱の Rapier を使える
（`@dimforge/rapier3d-compat` / `rapier2d-compat`。**対戦サーバーは Kit と同じ版を持ち、`init()` も済ませてある**）。
書き方の正本は `$game-physics`（同じ結果になる 5 つの規則）。対戦で守ることはこれだけ:

```ts
import RAPIER from '@dimforge/rapier3d-compat'

const worlds = new WeakMap<object, { world: RAPIER.World; bodies: Map<number, RAPIER.RigidBody> }>()

export default defineSpace({
  state: Arena,
  input: Pad,
  tickRate: 30,
  setup(ctx) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
    world.timestep = 1 / 30                        // 1 / tickRate に揃える
    worlds.set(ctx.state, { world, bodies: new Map() })
  },
  onJoin(ctx, player) {
    // 剛体は slot の昇順で足す（届いた順に任せない）。再接続なら足さない
  },
  step(ctx) {
    const { world, bodies } = worlds.get(ctx.state)!
    for (const player of [...ctx.players].sort((a, b) => a.slot - b.slot)) {
      // 入力を力・速度にする（ctx.input(player.slot)）
    }
    world.step()                                   // 1 tick に 1 回
    // 位置・向きを ctx.state に書く（画面はそれを補間して描く）
  },
})
```

- `world` は**卓ごとに 1 つ**（上のように `ctx.state` をキーにする）。モジュールの一番外に 1 つだけ作らない（同じ Sandbox の卓が相乗りする）。
- 状態に書くのは描画に要る数値（位置・向き・速度）だけ。Rapier のオブジェクトを状態に入れない。
- 画面の予測・練習モードは**同じ関数**（`server/main.ts` から export したもの）で同じ世界を作る。

## 3. 人数と役割

`manifest.json` の `space.participants` で決める。**遊びの説明から人数を決め、どの人数でも成立させる。**

```jsonc
// 人数だけ（2〜8）。min 人そろって全員が準備完了なら開始、max 人で自動開始
"participants": { "min": 2, "max": 4 }

// 役割（非対称）。役割ごとの人数。例: 追う側 1 人・逃げる側 4 人
"participants": {
  "roles": [
    { "id": "hunter",   "min": 1, "max": 1 },
    { "id": "survivor", "min": 1, "max": 4 }
  ]
}
```

- 「2 人で」→ `{ "min": 2, "max": 2 }`。「みんなで」「〜人まで」→ 上限をその数に、下限は 2。
  人数の説明が無い対戦は `{ "min": 2, "max": 2 }`。
- `min < max` なら、**実際に集まった人数（`ctx.players.length`）で遊びが成立する**ように書く
  （盤の大きさ・スタート位置・勝利条件を人数から決める）。空いた席は `ctx.players` に入らない。
- 役割は `player.role`（役割の無いゲームは `player`）。役割ごとに初期位置・能力・勝利条件を変える。
  チーム戦も役割で表す（`red` / `blue`）。結果は席ごとに `win` / `lose` を入れる（チームの勝ちは全員 `win`）。
- `id` は英小文字・数字・`_` で、画面に出す名前は画面側で日本語にする。

## 4. 切断・再接続

- 切断すると Platform が約 20 秒再接続を待つ。その間 `player.connected` は `false`。
- 待ちが切れると `onLeave` が呼ばれる。そこで**残った人で続けるか、終わらせるか**を決める
  （2 人対戦なら残った側の勝ち、多人数なら抜けた人を最下位にして続ける、など）。戻ってきたら `onJoin` がもう一度呼ばれる。
- 状態は `ctx.state` にあるので、再接続した画面には自動で今の状態が届く（送り直しは要らない）。
  `ctx.send` で送った一回きりの知らせ（手札など）は、`onJoin` で送り直す。

## 5. 画面

```ts
import { app } from '@workspace/app-sdk'
import definition, { move } from '../server/main'

const session = await app.space.join(definition)   // 席が用意されるまで待つ
```

- **`app.space.mode()` で分岐**: `online`（対戦）/ `practice`（練習）/ `null`（Space 無し。ソロの App か、ソロと対戦の両方を持つ App のソロ側）。
- **ターン制**: `session.onChange(draw)` で描き直し、自分の手番（`state.turn === session.slot`）だけ操作を受け付ける。
  手は `session.send('move', { cell })`。`send` は失敗すると**同期で throw** するので `try` で囲み、画面に出す。
- **同時操作**: `requestAnimationFrame` の中で次のとおりに書く（`app-sdk/spec.md` §3.3 の例と同じ）。
  1. `const due = session.predict.tick(now)` の回数だけ `session.input.data` に今の操作（`$game-controls` の入力キットの値）を書いて
     `session.input.send()`
  2. 自分は `session.predict.reconciler(me, { input: session.input, step: (ctx, s, i) => move(s, i, ctx.dt) })` の `value('x')` で描く
  3. 相手は `session.predict.attachAll('fighters', { x: 'lerp' })` を 1 回呼んでおき、`session.predict.value(fighter, 'x')` で描く
- **毎フレーム `send` しない**（1 通 4 KiB・毎秒 60 通まで）。同時操作の入力は `input.send()`（1 tick に 1 つ）、
  `send` はボタンを押したときの一回きりの操作（アイテム使用・降参など）だけ。
- **待機**: 人数がそろうまでは Platform の待機室が面倒を見る。App が起動したとき `mode()` が `null` なら、
  `join` はそろうまで待つ。その間は「相手を待っています」と招待ボタン（`app.ui.openInvite()`。`ui.openInvite` を宣言）を出す。
- **席**: `session.players`（`onPlayers` で変化を受ける）で参加者の名前・役割・接続中かを常に出す。
  **自分がどれか**を色と「あなた」の表示で示す。`displayName` は空のことがある（「プレイヤー 2」などで補う）。
- **接続**: `session.onConnection` で切断を表示し、戻ったら消す（再接続は SDK が行う）。
- **決着**: `session.onFinish` の `finish.outcomes?.[session.slot]` で勝ち・負け・引き分け、`finish.ranks` で順位を大きく出す。
  `outcomes` が `null` なら「時間切れ（結果なし）」と出す。
- 操作説明・操作部・画面の追従は、ソロと同じく `$game-controls` と `$game-screen-layout` に従う。

## 6. 練習モード（依頼されたときだけ）

**遊びの説明に「練習」「一人でも」「CPU と」などがあるときだけ** `"practice": true` にする。無ければ `false`。

- 練習では同じ定義が画面の中で動き、`ctx.players` には本人の 1 席だけが入る（役割は Platform が選ぶ）。
  結果は成績に残らない。
- 相手が要る遊びなら、**定義の中で空いた役割を自動で動かす**（例: `step` で `ctx.players` に居ない側の CPU を動かす）。
  CPU は `ctx.state` に置き、オンラインで人がそろったときは動かさない（`ctx.players.length` で分ける）。
- 画面は `mode() === 'practice'` のとき「練習（成績に残りません）」と出す。

## 7. manifest

```jsonc
"space": {
  "server": "server.bundle.js",
  "participants": { "min": 2, "max": 4 },   // 2〜8。または { "roles": [...] }
  "maxDurationSec": 600,                    // 30〜1800。実際の対戦時間 + 余裕
  "practice": false                         // 練習モード。依頼されたときだけ true
},
"capabilities": ["identity.read", "space.connect", "ui.openInvite"]
```

ビルドは `@workspace/app-server-sdk/build-config`（`server.bundle.js`）と `@workspace/app-sdk/build-config`
（`app.bundle.js`。画面が import した定義も `@workspace/app-server-sdk` を同梱せずに済む）を使う。

## 8. 出力前のチェック

- [ ] `server/main.ts` が `export default defineSpace({ … })` で、`@workspace/app-server-sdk` 以外を import していない
- [ ] Space ごとの値が `ctx.state`（か `ctx.state` をキーにした `WeakMap`）にあり、モジュールの変数に無い
- [ ] schema の数値・真偽値・文字列の欄に `.default(…)` がある
- [ ] 勝敗は定義だけが決め、`finish` は 1 回だけ・全員の slot に結果が入る（3 人以上は `ranks` も）
- [ ] 時間切れ・全員の離脱でも決着する（`maxDurationSec` より前に自分で終える）
- [ ] 不正な入力（手番違い・範囲外・重複・大きすぎ）を捨てる
- [ ] `step` が `dt` と入力だけで決まる（時刻・乱数を直接読まない）。移動の計算を画面の予測と共用している
- [ ] 集まった人数（`min`〜`max`）のどれでも遊びが成立する。役割ごとの違いがある
- [ ] 画面が毎フレーム `send` していない（同時操作は `input.send()` を `predict.tick` の回数だけ）
- [ ] キーボードでもタッチでも同じ入力が届く
- [ ] 席の一覧・自分の席・切断・決着（順位）が画面に出る
- [ ] 練習モードは依頼されたときだけ。付けたなら CPU が空いた役割を動かす
