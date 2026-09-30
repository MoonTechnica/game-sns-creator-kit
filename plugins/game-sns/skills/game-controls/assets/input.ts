/**
 * 入力キット — PC（キーボード・マウス）とスマホ（画面の操作部・タップ・スワイプ）とゲームパッド
 * （PS5 / Xbox / Switch Pro などの市販コントローラー。PC に USB / Bluetooth、スマホに Bluetooth）を 1 つの入力にまとめる。
 *
 * **`src/input.ts` にそのままコピーして使う**（依存なし。`@workspace/app-sdk` も要らない）。
 * ゲームのコードは「どのキーが押されたか」ではなく **アクション**（`jump` / `fire` / 移動量）だけを見る。
 *
 * ```ts
 * import { createInput } from './input'
 *
 * const input = createInput({
 *   root: document.body,
 *   move: { style: 'stick' },                                    // 左下のスティック + WASD / 矢印
 *   buttons: {
 *     jump: { keys: ['Space', 'KeyZ', 'ArrowUp', 'KeyW'], label: 'ジャンプ' },
 *     dash: { keys: ['ShiftLeft', 'KeyX'], label: 'ダッシュ' },
 *   },
 * })
 *
 * function frame() {
 *   player.vx = input.move.x * SPEED
 *   if (input.pressed('jump')) player.jump()
 *   input.endFrame()                                               // 毎フレームの最後に 1 回
 *   requestAnimationFrame(frame)
 * }
 * ```
 *
 * - 画面の操作部は **最後に使った入力がタッチのときだけ**出る（キーやゲームパッドを使うと消え、画面に触ると出る）。
 * - タイトル・リザルト画面では `input.setControlsVisible(false)` で隠し、タップ / クリック / キーで進める。
 * - `input.mode`（`'touch'` / `'keyboard'` / `'gamepad'`）で操作説明の文言を切り替える。ゲームパッドのボタン名は
 *   `input.padLabel('jump')`（つながっている機種の表記: `×` / `A` / `B`。分からなければ「下のボタン」）。
 * - ゲームパッドは**標準マッピング**（`mapping === 'standard'`）だけを読む。左スティックと十字キーが `move`、
 *   右スティックが `look`、ボタンは `buttons` の宣言順に 下（× / A）→ 左（□ / X）→ 右（○ / B）→ 上（△ / Y）→ L1 → R1 → L2 → R2。
 *   変えたいときは `pad: [9]`（OPTIONS / メニュー）のように番号で指定する。キットが毎フレーム読む（`poll`）。
 * - 盤面・カード・メニューのように「選んで決める」操作は `onNavigate`（十字キー / 左スティック / 矢印キーで 1 段ずつ、
 *   押し続けると繰り返す）と `onAction`（押した瞬間に 1 回）で書く。マウスやタッチと同じ選択の見た目を出す。
 * - マウスで視点を回すゲーム（FPS・TPS）は `import { createInput, pointerLock } from './input'` して
 *   `createInput({ ..., pointerLock })`（Manifest の `device.pointerLock` と揃える）。クリックでマウスを固定し、
 *   固定中の `look` はマウスの移動量になる。Esc で外れる。指だけの端末（iOS Safari）では固定できない。
 * - 端末を傾けて動かすゲームは `import { createInput, tilt } from './input'` して `createInput({ ..., tilt: tilt(app) })`
 *   （Manifest の device に motion を宣言する）。`input.tilt` が -1〜1 の傾き（最初の持ち方が基準）。Host が許可を得るまで
 *   （iOS は Host のボタンを押すまで）と、断られた・端末に無いとき（PC）は `tiltActive` が false で 0。代わりの操作を必ず用意する。
 * - このファイルのコメントには端末の API 名をそのまま書かない（Platform の検証はバンドルの中の文字列で宣言と突き合わせるので、
 *   残ったコメントが「使っている」と数えられる）。
 * - **ゲームパッドのボタンは「最初の操作」に数えない**。ブラウザはゲームパッドを利用者の操作と認めないので、
 *   音の開始と iframe へのキー入力の受け付けには、最初の 1 回だけタップ / クリック / キーが要る（開始画面で促す）。
 */

export type InputMode = 'keyboard' | 'touch' | 'gamepad'

/** つながっているゲームパッドの機種（ボタン名の表記に使う）。 */
export type PadStyle = 'playstation' | 'xbox' | 'nintendo' | 'generic'

/** フォーカス移動の向き（盤面のマス・カード・メニューの選択を 1 段動かす）。 */
export type Navigate = 'up' | 'down' | 'left' | 'right'

/** 1 つのアクションの割り当て。 */
export type ButtonSpec = {
  /** `KeyboardEvent.code`（配列の順に同じ意味）。例: `['Space', 'KeyZ']` */
  readonly keys: readonly string[]
  /** スマホの画面に出すボタンの文字（1〜4 文字）。省略すると画面には出さない（キー専用） */
  readonly label?: string
  /**
   * ゲームパッドのボタン番号（標準マッピング。0 = 下 × / A、1 = 右 ○ / B、2 = 左 □ / X、3 = 上 △ / Y、
   * 4 / 5 = L1 / R1、6 / 7 = L2 / R2、8 = CREATE / ビュー / −、9 = OPTIONS / メニュー / +、12〜15 = 十字キー）。
   * 省略すると宣言順に `[0]`, `[2]`, `[1]`, `[3]`, `[4]`, `[5]`, `[6]`, `[7]`（`defaultPadButtons`）。`[]` で割り当てなし
   */
  readonly pad?: readonly number[]
}

/**
 * 移動の入力。
 * - `stick`: 左下の仮想スティック（触れた場所が中心になる）。8 方向・アナログ
 * - `dpad-x`: 左下に ◀ ▶ の 2 ボタン（横スクロール・ブロック崩し向け。y は常に 0）
 * - `none`: 移動なし（タップ・ドラッグで遊ぶゲーム）
 */
export type MoveSpec = {
  readonly style: 'stick' | 'dpad-x' | 'none'
  /** キーボードの割り当て。既定は WASD と矢印キーの両方 */
  readonly keys?: 'wasd-arrows' | 'arrows' | 'wasd'
}

export type InputOptions<A extends string> = {
  /** 操作部を重ねる親要素。通常は `document.body` */
  readonly root: HTMLElement
  readonly move?: MoveSpec
  /** アクションのボタン。画面では右下に 1 つ目が一番大きく、親指の近くに並ぶ（最大 4 つ） */
  readonly buttons?: Readonly<Record<A, ButtonSpec>>
  /**
   * ゲームパッドの読み取り。`auto`（既定）はキットが毎フレーム読む。自分のループの先頭で `input.poll()` を呼ぶなら
   * `manual`（入力の遅れが 1 フレーム減る。テストでも使う）
   */
  readonly poll?: 'auto' | 'manual'
  /** ゲームパッドの取得元。既定は `navigator.getGamepads()`（テストで差し替える） */
  readonly getGamepads?: () => ReadonlyArray<Gamepad | null>
  /**
   * マウス固定（Pointer Lock）。このファイルの `pointerLock` を渡すと、操作部の外をマウスでクリックしたときに `root` へ
   * マウスを固定する（ブラウザは利用者の操作の中でしか固定を許さない）。Manifest の `device.pointerLock` を宣言した
   * ゲームだけが使える（宣言が無いと Host が許可しない）。渡さなければ固定しない
   */
  readonly pointerLock?: PointerLockDriver
  /**
   * 傾き（`app.device` の `motion`）。このファイルの `tilt(app)` を渡すと、Host に傾きを頼み、`input.tilt` で読める。
   * Manifest の device に motion を宣言したゲームだけが使える。渡さなければ傾きは使わない
   */
  readonly tilt?: TiltDriver
}

/** 傾きのサンプルのうちキットが使う部分（`app.device` の `motion` の `onSample` の値）。 */
export type TiltSample = {
  readonly beta: number | null
  readonly gamma: number | null
  readonly screenAngle: number
}

/** 傾きの実装（`tilt`）が入力キットに知らせること。 */
export type TiltHooks = {
  readonly onActive: (active: boolean) => void
  readonly onSample: (sample: TiltSample) => void
}

export type TiltDriver = (hooks: TiltHooks) => { stop(): void }

/** `tilt` が使う `app` の部分（`import { app } from '@workspace/app-sdk'` をそのまま渡す）。 */
export type MotionSource = {
  readonly device: {
    readonly motion: {
      start(): Promise<{
        onSample(listener: (sample: TiltSample) => void): () => void
        onStop(listener: (reason: string) => void): () => void
        stop(): Promise<void>
      }>
    }
  }
}

/** マウス固定の実装が入力キットに知らせること。 */
export type PointerLockHooks = {
  readonly onChange: (locked: boolean) => void
  readonly onMove: (dx: number, dy: number) => void
}

/** マウス固定の実装（`pointerLock`）。キットの中から呼ぶ。 */
export type PointerLockHandle = {
  readonly supported: boolean
  request(): void
  exit(): void
  destroy(): void
}

export type PointerLockDriver = (root: HTMLElement, hooks: PointerLockHooks) => PointerLockHandle

export type Vector = { readonly x: number; readonly y: number }

export type Swipe = {
  readonly direction: 'left' | 'right' | 'up' | 'down'
  readonly startX: number
  readonly startY: number
  readonly endX: number
  readonly endY: number
}

export type Tap = { readonly x: number; readonly y: number; readonly pointerType: string }

export type PointerState = {
  /** `root` の左上を原点にした CSS ピクセル */
  readonly x: number
  readonly y: number
  readonly down: boolean
  readonly pointerType: string
}

export type Input<A extends string> = {
  /** 移動量（キーボード + 画面のスティック + ゲームパッドの左スティック / 十字キー）。x は右が +、y は下が +。長さは 0〜1 */
  readonly move: Vector
  /**
   * 照準・カメラ。ふだんはゲームパッドの右スティック（-1〜1。速さとして毎フレーム掛ける）。
   * **マウス固定中（`pointerLocked`）はこのフレームのマウスの移動量（CSS px。`endFrame` で 0 に戻る）**——
   * 単位が違うので、`pointerLocked` で感度の掛け方を分ける
   */
  readonly look: Vector
  /**
   * 端末の傾き（-1〜1。x は右に傾けると +、y は手前に倒すと +）。**持ち始めの角度が基準**（`calibrateTilt` で取り直す）。
   * 傾きを使っていない・許可が無い・端末に無いときは 0
   */
  readonly tilt: Vector
  /** 傾きが届いている（Host が許可を得て流し始めた）。false の間は代わりの操作を案内する */
  readonly tiltActive: boolean
  /** 傾きが使えるようになった / 止まった。解除関数を返す */
  onTiltChange(listener: (active: boolean) => void): () => void
  /** 今の持ち方を傾きの基準にし直す（次に届いた角度が 0 になる） */
  calibrateTilt(): void
  /** マウスを固定している（Esc やタブの切り替えで外れる） */
  readonly pointerLocked: boolean
  /** この端末でマウスを固定できる（iOS Safari と指だけの端末は false。代わりの操作を出す） */
  readonly pointerLockSupported: boolean
  /** 固定した / 外れた（「クリックで視点操作」「Esc で解除」の表示を切り替える）。解除関数を返す */
  onPointerLockChange(listener: (locked: boolean) => void): () => void
  /** 押している間 true */
  down(action: A): boolean
  /** このフレームで押された（`endFrame` までに 1 回だけ true） */
  pressed(action: A): boolean
  /** このフレームで離された */
  released(action: A): boolean
  /** 毎フレームの最後に呼ぶ（`pressed` / `released` を消す） */
  endFrame(): void
  readonly mode: InputMode
  /** 入力方法が変わったとき（操作説明の描き直し）。解除関数を返す */
  onModeChange(listener: (mode: InputMode) => void): () => void
  /** アクションが押された瞬間（キー / 画面のボタン / ゲームパッド）。ループを持たない（盤面・カード）ゲームはこれで受ける */
  onAction(listener: (action: A) => void): () => void
  /**
   * 選択を 1 段動かす（十字キー / 左スティック。`move` が `none` のゲームでは矢印キー / WASD も）。
   * 押し続けると `NAV_REPEAT_DELAY_MS` の後に `NAV_REPEAT_MS` ごとに繰り返す。マスやカードやメニューのフォーカス移動に使う
   */
  onNavigate(listener: (direction: Navigate) => void): () => void
  /** つながっているゲームパッド（標準マッピングのもの） */
  readonly pad: { readonly connected: boolean; readonly style: PadStyle }
  /** 操作説明に書くボタン名（`×` / `A` / `B` / 位置の言葉）。ゲームパッドに割り当てが無いアクションは空文字 */
  padLabel(action: A): string
  /** 振動（対応する端末・ブラウザだけ。Firefox と iOS Safari では何も起きない。効果音の代わりにはしない） */
  rumble(options?: {
    readonly durationMs?: number
    readonly strong?: number
    readonly weak?: number
  }): void
  /** ゲームパッドを読む。`poll: 'auto'`（既定）なら呼ばなくてよい。`manual` のときは自分のループの先頭で呼ぶ */
  poll(now?: number): void
  /** 操作部の外でのタップ / クリック（ドラッグやスワイプではないもの） */
  onTap(listener: (tap: Tap) => void): () => void
  /** 操作部の外でのスワイプ（素早く 1 方向へ動かして離した） */
  onSwipe(listener: (swipe: Swipe) => void): () => void
  /** 最後に見たポインタ（マウスの照準・ドラッグ操作に使う） */
  readonly pointer: PointerState
  /**
   * 最初の操作（指を離した / クリック / キー）の**イベント処理の中で**同期で 1 回だけ呼ぶ。
   * `AudioContext.resume()` はここで呼ぶ（ブラウザは利用者の操作の中でしか音を許さない）
   */
  onFirstInteraction(listener: () => void): () => void
  /** 最初の操作で解決する（開始画面を抜ける合図） */
  readonly firstInteraction: Promise<void>
  /** タイトル・リザルト・ポーズ中は false にして画面の操作部を隠す */
  setControlsVisible(visible: boolean): void
  /** 押しっぱなしを全部離す（ポーズ・画面外に出たとき。自動でも呼ばれる） */
  reset(): void
  destroy(): void
}

/** 傾きの最大（度）。基準からこれだけ傾けると長さ 1 */
export const TILT_MAX_DEGREES = 30
/** 傾きの遊び（最大に対する割合）。手の震えで動かないように */
export const TILT_DEAD_ZONE = 0.1
/** スティックの半径（CSS px）。これより遠くへ動かしても長さ 1 で頭打ち */
export const STICK_RADIUS_PX = 56
/** スティックの遊び（半径に対する割合）。指の震えで動かないように */
export const STICK_DEAD_ZONE = 0.18
/** これより短い移動はタップ（CSS px） */
export const TAP_SLOP_PX = 10
/** これより長く押したらタップではない（ms） */
export const TAP_MAX_MS = 300
/** スワイプとみなす最短距離（CSS px）と最長時間（ms） */
export const SWIPE_MIN_PX = 40
export const SWIPE_MAX_MS = 600
/** 画面の端から操作部までの余白（CSS px）。ここにセーフエリアが足される */
export const EDGE_PX = 20
/** ゲームパッドのスティックの遊び（0〜1 の割合。半径方向）。XInput の推奨値（7849 / 32767 ≈ 0.24）に合わせる */
export const PAD_DEAD_ZONE = 0.24
/** 左スティックでフォーカス移動と見なす傾き（倒し始め）と、戻ったと見なす傾き（ヒステリシス。1 回の傾けを 1 段にする） */
export const NAV_STICK_THRESHOLD = 0.5
export const NAV_STICK_RELEASE = 0.3
/**
 * フォーカス移動を押し続けたときの、最初の繰り返しまでの遅延と、その後の間隔（ms）。
 * Unity uGUI の既定（Repeat Delay 0.5 s / 10 回/s）と Windows のキーリピートの範囲（250 ms〜1 s / 2.5〜30 回/s）に合わせる
 */
export const NAV_REPEAT_DELAY_MS = 500
export const NAV_REPEAT_MS = 100
/**
 * キーボードとゲームパッドの切り替えを待つ時間（ms）。両方を同時に使っているとき、もう一方を最後に触ってから
 * これだけ経つまで操作説明を切り替えない（表示が点滅しないように）。タッチへの切り替えは待たない
 */
export const MODE_SWITCH_MS = 1000
const PRIMARY_BUTTON_PX = 76
const SECONDARY_BUTTON_PX = 60
const BUTTON_GAP_PX = 14
const MAX_BUTTONS = 4

const KEY_SCHEMES = {
  arrows: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'] },
  wasd: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'] },
  'wasd-arrows': {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
  },
} as const

type KeyScheme = keyof typeof KEY_SCHEMES

/** 標準マッピング（W3C Gamepad: Standard Gamepad）のボタン番号。 */
const PAD = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  l1: 4,
  r1: 5,
  l2: 6,
  r2: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
  home: 16,
} as const

/** 宣言順のアクションに割り当てるボタン。1 つ目は必ず「下のボタン」（× / A = 決定・主アクション）。 */
const PAD_DEFAULT_ORDER: readonly number[] = [
  PAD.south,
  PAD.west,
  PAD.east,
  PAD.north,
  PAD.l1,
  PAD.r1,
  PAD.l2,
  PAD.r2,
]

/** 機種ごとのボタン名（0〜16）。generic は位置の言葉（どの機種でも通じる） */
const PAD_BUTTON_NAMES: Record<PadStyle, readonly string[]> = {
  playstation: [
    '×',
    '○',
    '□',
    '△',
    'L1',
    'R1',
    'L2',
    'R2',
    'CREATE',
    'OPTIONS',
    'L3',
    'R3',
    '↑',
    '↓',
    '←',
    '→',
    'PS',
  ],
  xbox: [
    'A',
    'B',
    'X',
    'Y',
    'LB',
    'RB',
    'LT',
    'RT',
    'ビュー',
    'メニュー',
    'LS',
    'RS',
    '↑',
    '↓',
    '←',
    '→',
    'Xbox',
  ],
  nintendo: [
    'B',
    'A',
    'Y',
    'X',
    'L',
    'R',
    'ZL',
    'ZR',
    '−',
    '+',
    'L スティック',
    'R スティック',
    '↑',
    '↓',
    '←',
    '→',
    'HOME',
  ],
  generic: [
    '下のボタン',
    '右のボタン',
    '左のボタン',
    '上のボタン',
    'L1',
    'R1',
    'L2',
    'R2',
    'セレクトボタン',
    'メニューボタン',
    'L スティック押し込み',
    'R スティック押し込み',
    '↑',
    '↓',
    '←',
    '→',
    'ホームボタン',
  ],
}

/** USB の vendor id → 機種。Chrome の id は `Vendor: 054c`、Firefox は `054c-0ce6-…` の形で含む */
const PAD_VENDORS: Record<string, PadStyle> = {
  '054c': 'playstation',
  '045e': 'xbox',
  '057e': 'nintendo',
}

// ---------------------------------------------------------------------------
// 純粋な計算（テスト対象）
// ---------------------------------------------------------------------------

/** 長さを 1 以下にそろえる（キーボードの斜め移動が速くならないように）。 */
/**
 * 端末の傾き（度）を移動量にする。基準（`neutral`）からの差を画面の向きに合わせて軸を入れ替え、
 * `TILT_MAX_DEGREES` で長さ 1、`TILT_DEAD_ZONE` の内側は 0（外側は 0 から滑らかに増える）。
 */
export function tiltVector(
  sample: { readonly beta: number | null; readonly gamma: number | null },
  neutral: { readonly beta: number; readonly gamma: number },
  screenAngle: number
): Vector {
  if (sample.beta === null || sample.gamma === null) return { x: 0, y: 0 }
  const forward = sample.beta - neutral.beta
  const side = sample.gamma - neutral.gamma
  const [x, y] =
    screenAngle === 90
      ? [forward, -side]
      : screenAngle === 180
        ? [-side, -forward]
        : screenAngle === 270
          ? [-forward, side]
          : [side, forward]
  const degrees = Math.hypot(x, y)
  const length = degrees / TILT_MAX_DEGREES
  if (length <= TILT_DEAD_ZONE) return { x: 0, y: 0 }
  const scaled = Math.min(1, (length - TILT_DEAD_ZONE) / (1 - TILT_DEAD_ZONE))
  // -0 を 0 にそろえる（比較や表示で紛れないように）
  return { x: (x / degrees) * scaled + 0, y: (y / degrees) * scaled + 0 }
}

export function clampLength(vector: Vector): Vector {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= 1) return vector
  return { x: vector.x / length, y: vector.y / length }
}

/**
 * スティックの中心からの指のずれ（px）を、遊びを除いた 0〜1 の移動量にする。
 * 遊びの外側は 0 から滑らかに増える（遊びの境目で急に 0.18 へ飛ばない）。
 */
export function stickVector(
  dx: number,
  dy: number,
  radius = STICK_RADIUS_PX,
  deadZone = STICK_DEAD_ZONE
): Vector {
  const distance = Math.hypot(dx, dy)
  if (radius <= 0 || distance === 0) return { x: 0, y: 0 }
  const normalized = Math.min(distance / radius, 1)
  if (normalized <= deadZone) return { x: 0, y: 0 }
  const scaled = (normalized - deadZone) / (1 - deadZone)
  return { x: (dx / distance) * scaled, y: (dy / distance) * scaled }
}

/** 押しているキー（`code`）から移動量を出す。反対方向の同時押しは打ち消し合う。 */
export function keyboardVector(
  pressed: ReadonlySet<string>,
  scheme: KeyScheme = 'wasd-arrows'
): Vector {
  const keys = KEY_SCHEMES[scheme]
  const any = (codes: readonly string[]) => codes.some((code) => pressed.has(code))
  const x = (any(keys.right) ? 1 : 0) - (any(keys.left) ? 1 : 0)
  const y = (any(keys.down) ? 1 : 0) - (any(keys.up) ? 1 : 0)
  return clampLength({ x, y })
}

/** 指を離したときの動きを、タップ・スワイプ・どちらでもない（ドラッグ）に分ける。 */
export function classifyGesture(
  start: { readonly x: number; readonly y: number; readonly time: number },
  end: { readonly x: number; readonly y: number; readonly time: number }
):
  | { readonly kind: 'tap' }
  | { readonly kind: 'swipe'; readonly direction: Swipe['direction'] }
  | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.hypot(dx, dy)
  const duration = end.time - start.time
  if (distance <= TAP_SLOP_PX) return duration <= TAP_MAX_MS ? { kind: 'tap' } : null
  if (distance < SWIPE_MIN_PX || duration > SWIPE_MAX_MS) return null
  if (Math.abs(dx) >= Math.abs(dy)) return { kind: 'swipe', direction: dx > 0 ? 'right' : 'left' }
  return { kind: 'swipe', direction: dy > 0 ? 'down' : 'up' }
}

/**
 * 次の入力方法。**最後に使った入力**に合わせる（タッチ付き PC・キーボード付きタブレットの両方で正しく出る）。
 * マウスでは切り替えない（マウスでも画面のボタンは押せるので、出ていても邪魔にならない）。
 */
export function nextMode(
  current: InputMode,
  event:
    | { readonly kind: 'key' }
    | { readonly kind: 'pad' }
    | { readonly kind: 'pointer'; readonly pointerType: string },
  /** 競合する入力（キーならゲームパッド、ゲームパッドならキー）を最後に使ってからの時間（ms） */
  competingIdleMs = Number.POSITIVE_INFINITY
): InputMode {
  if (event.kind === 'key') {
    return current === 'gamepad' && competingIdleMs < MODE_SWITCH_MS ? 'gamepad' : 'keyboard'
  }
  if (event.kind === 'pad') {
    return current === 'keyboard' && competingIdleMs < MODE_SWITCH_MS ? 'keyboard' : 'gamepad'
  }
  if (event.pointerType === 'touch' || event.pointerType === 'pen') return 'touch'
  return current
}

/** `buttons` の `index` 番目のアクションに割り当てる既定のボタン番号（9 つ目からは無し）。 */
export function defaultPadButtons(index: number): readonly number[] {
  const button = PAD_DEFAULT_ORDER[index]
  return button === undefined ? [] : [button]
}

/** ゲームパッドの左スティック（軸 0・1）と十字キー（12〜15）から移動量を出す。 */
export function padVector(axes: readonly number[], buttons: readonly boolean[]): Vector {
  const stick = stickVector(axes[0] ?? 0, axes[1] ?? 0, 1, PAD_DEAD_ZONE)
  const x = (buttons[PAD.right] ? 1 : 0) - (buttons[PAD.left] ? 1 : 0)
  const y = (buttons[PAD.down] ? 1 : 0) - (buttons[PAD.up] ? 1 : 0)
  return clampLength({ x: stick.x + x, y: stick.y + y })
}

/** ゲームパッドの右スティック（軸 2・3）。照準・カメラ。 */
export function padLook(axes: readonly number[]): Vector {
  return stickVector(axes[2] ?? 0, axes[3] ?? 0, 1, PAD_DEAD_ZONE)
}

/**
 * フォーカス移動の向き。十字キーを優先し、無ければしきい値を超えた左スティックの大きい方の軸。
 * `holding`（前回の向き）がスティック由来なら、その軸が `NAV_STICK_RELEASE` を下回るまで同じ向きを保つ
 * （倒し戻しの途中で別の向きに跳ねない）。
 */
export function padDirection(
  axes: readonly number[],
  buttons: readonly boolean[],
  holding: Navigate | null = null
): Navigate | null {
  if (buttons[PAD.up]) return 'up'
  if (buttons[PAD.down]) return 'down'
  if (buttons[PAD.left]) return 'left'
  if (buttons[PAD.right]) return 'right'
  const x = axes[0] ?? 0
  const y = axes[1] ?? 0
  if (holding) {
    const along = holding === 'left' ? -x : holding === 'right' ? x : holding === 'up' ? -y : y
    if (along >= NAV_STICK_RELEASE) return holding
  }
  if (Math.max(Math.abs(x), Math.abs(y)) < NAV_STICK_THRESHOLD) return null
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? 'right' : 'left'
  return y > 0 ? 'down' : 'up'
}

export type RepeatState = {
  readonly direction: Navigate
  /** 押し始めた時刻（ms） */
  readonly since: number
  readonly lastFired: number
}

/**
 * 押し続けたフォーカス移動の繰り返し（キーボードのキーリピートと同じ形）。
 * 押した瞬間に 1 回、`NAV_REPEAT_DELAY_MS` 後から `NAV_REPEAT_MS` ごと。向きが変わったら即座に 1 回。
 */
export function nextRepeat(
  state: RepeatState | null,
  held: Navigate | null,
  now: number
): { readonly state: RepeatState | null; readonly fire: Navigate | null } {
  if (!held) return { state: null, fire: null }
  if (!state || state.direction !== held) {
    return { state: { direction: held, since: now, lastFired: now }, fire: held }
  }
  const interval = state.lastFired === state.since ? NAV_REPEAT_DELAY_MS : NAV_REPEAT_MS
  if (now - state.lastFired < interval) return { state, fire: null }
  return { state: { ...state, lastFired: now }, fire: held }
}

/** `Gamepad.id` から機種を見分ける（vendor id を優先し、無ければ名前）。分からなければ generic。 */
export function padStyleOf(id: string): PadStyle {
  const lower = id.toLowerCase()
  const vendor =
    /vendor:\s*([0-9a-f]{4})/.exec(lower)?.[1] ?? /^([0-9a-f]{4})-[0-9a-f]{4}-/.exec(lower)?.[1]
  if (vendor && PAD_VENDORS[vendor]) return PAD_VENDORS[vendor]
  // 名前で見分ける。Sony の製品名は「Wireless Controller」なので、他社の「Xbox Wireless Controller」を先に除く
  if (/xbox|xinput|microsoft/.test(lower)) return 'xbox'
  if (/pro controller|joy-con|nintendo|switch/.test(lower)) return 'nintendo'
  if (/dualsense|dualshock|playstation|sony|wireless controller/.test(lower)) return 'playstation'
  return 'generic'
}

/** 標準マッピングのボタン番号を、その機種の表記にする（操作説明用）。 */
export function padButtonName(index: number, style: PadStyle): string {
  return PAD_BUTTON_NAMES[style][index] ?? `ボタン ${index}`
}

/** 最初の入力方法。指が主な端末（スマホ・タブレット）ならタッチ。 */
export function initialMode(coarsePointer: boolean): InputMode {
  return coarsePointer ? 'touch' : 'keyboard'
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

type ButtonState = { down: boolean; pressed: boolean; released: boolean }

export function createInput<A extends string>(options: InputOptions<A>): Input<A> {
  const { root } = options
  const moveSpec: MoveSpec = options.move ?? { style: 'none' }
  const scheme: KeyScheme = moveSpec.keys ?? 'wasd-arrows'
  const buttonSpecs = (options.buttons ?? {}) as Readonly<Record<A, ButtonSpec>>
  const actions = Object.keys(buttonSpecs) as A[]

  const states = new Map<A, ButtonState>(
    actions.map((action) => [action, { down: false, pressed: false, released: false }])
  )
  /** アクション → それを押している入力源（キーの code / 画面ボタンの pointerId） */
  const holders = new Map<A, Set<string>>(actions.map((action) => [action, new Set()]))
  const keyToActions = new Map<string, A[]>()
  for (const action of actions) {
    for (const code of buttonSpecs[action].keys) {
      keyToActions.set(code, [...(keyToActions.get(code) ?? []), action])
    }
  }
  const moveKeys = new Set<string>(
    moveSpec.style === 'none' ? [] : Object.values(KEY_SCHEMES[scheme]).flat()
  )
  // 移動の無いゲーム（盤面・カード）では、矢印キー / WASD をフォーカス移動（onNavigate）に使う
  const navKeys = new Map<string, Navigate>()
  if (moveSpec.style === 'none') {
    for (const [direction, codes] of Object.entries(KEY_SCHEMES[scheme])) {
      for (const code of codes) navKeys.set(code, direction as Navigate)
    }
  }
  const pressedKeys = new Set<string>()

  // --- ゲームパッド（標準マッピングの 1 台目だけを読む） -------------------------------
  const getGamepads =
    options.getGamepads ??
    (() =>
      typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'
        ? navigator.getGamepads()
        : [])
  const padToActions = new Map<number, A[]>()
  const actionToPad = new Map<A, readonly number[]>()
  actions.forEach((action, index) => {
    const buttons = buttonSpecs[action].pad ?? defaultPadButtons(index)
    actionToPad.set(action, buttons)
    for (const button of buttons)
      padToActions.set(button, [...(padToActions.get(button) ?? []), action])
  })
  let currentPad: Gamepad | null = null
  let padStyle: PadStyle = 'generic'
  /** 前回 poll したときのボタン（押している = true） */
  let padButtons: boolean[] = []
  let padMove: Vector = { x: 0, y: 0 }
  let padLookVector: Vector = { x: 0, y: 0 }
  let repeat: RepeatState | null = null
  let padBroken = false
  let lastKeyAt = Number.NEGATIVE_INFINITY
  let lastPadAt = Number.NEGATIVE_INFINITY

  let mode: InputMode = initialMode(matchesMedia('(pointer: coarse)'))
  let controlsVisible = true
  let stick: Vector = { x: 0, y: 0 }
  let dpad = { left: false, right: false }
  let pointer: PointerState = { x: 0, y: 0, down: false, pointerType: 'mouse' }
  const modeListeners = new Set<(mode: InputMode) => void>()
  const actionListeners = new Set<(action: A) => void>()
  const navigateListeners = new Set<(direction: Navigate) => void>()
  const tapListeners = new Set<(tap: Tap) => void>()
  const swipeListeners = new Set<(swipe: Swipe) => void>()
  const firstListeners = new Set<() => void>()
  let interactedOnce = false
  const cleanups: (() => void)[] = []

  // --- マウス固定（`pointerLock` を渡したゲームだけ） -----------------------------
  let pointerLocked = false
  let mouseLook: Vector = { x: 0, y: 0 }
  const lockListeners = new Set<(locked: boolean) => void>()
  const lock = options.pointerLock?.(root, {
    onChange(locked) {
      if (locked === pointerLocked) return
      pointerLocked = locked
      mouseLook = { x: 0, y: 0 }
      emit(lockListeners, pointerLocked)
    },
    onMove(dx, dy) {
      if (pointerLocked) mouseLook = { x: mouseLook.x + dx, y: mouseLook.y + dy }
    },
  })
  if (lock) cleanups.push(() => lock.destroy())
  const pointerLockSupported = lock?.supported ?? false

  // --- 傾き（`tilt` を渡したゲームだけ） -----------------------------------------
  let tiltActive = false
  let tiltNow: Vector = { x: 0, y: 0 }
  let tiltNeutral: { beta: number; gamma: number } | null = null
  const tiltListeners = new Set<(active: boolean) => void>()
  const tiltHandle = options.tilt?.({
    onActive(active) {
      if (active === tiltActive) return
      tiltActive = active
      tiltNow = { x: 0, y: 0 }
      tiltNeutral = null
      emit(tiltListeners, tiltActive)
    },
    onSample(sample) {
      if (!tiltActive || sample.beta === null || sample.gamma === null) return
      tiltNeutral ??= { beta: sample.beta, gamma: sample.gamma }
      tiltNow = tiltVector(sample, tiltNeutral, sample.screenAngle)
    },
  })
  if (tiltHandle) cleanups.push(() => tiltHandle.stop())

  let resolveFirst: () => void = () => {}
  const firstInteraction = new Promise<void>((resolve) => {
    resolveFirst = resolve
  })

  // --- 操作部（DOM）。canvas の上に重ね、操作部の外は下の canvas に触れる ------------
  const layer = element('div', {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '10',
  })
  layer.setAttribute('aria-hidden', 'true')
  root.appendChild(layer)
  cleanups.push(() => layer.remove())

  // ブラウザの既定動作（スクロール・拡大・長押しメニュー・文字選択）をゲームの中では止める
  const rootStyle = root.style as CSSStyleDeclaration & {
    webkitTouchCallout?: string
    webkitUserSelect?: string
  }
  rootStyle.touchAction = 'none'
  rootStyle.userSelect = 'none'
  rootStyle.webkitUserSelect = 'none'
  rootStyle.webkitTouchCallout = 'none'
  listen(root, 'contextmenu', (event) => event.preventDefault())

  const controls: HTMLElement[] = []
  if (moveSpec.style === 'stick') buildStick()
  if (moveSpec.style === 'dpad-x') buildDpad()
  buildButtons()
  applyVisibility()

  // --- キーボード ------------------------------------------------------------
  listen(window, 'keydown', (event) => {
    const code = event.code
    const bound = keyToActions.has(code) || moveKeys.has(code) || navKeys.has(code)
    if (!bound) return
    // 矢印・スペースで親ページがスクロールしないように（iframe の中でも親へ伝わる）。
    // Escape はブラウザ（全画面の解除など）と Platform のものなので奪わない
    if (code !== 'Escape') event.preventDefault()
    interacted()
    const at = event.timeStamp
    lastKeyAt = at
    setMode(nextMode(mode, { kind: 'key' }, at - lastPadAt))
    pressedKeys.add(code)
    // フォーカス移動はキーリピートでも進める（OS のリピートがそのまま繰り返しになる）
    const direction = navKeys.get(code)
    if (direction) emit(navigateListeners, direction)
    if (event.repeat) return
    for (const action of keyToActions.get(code) ?? []) hold(action, `key:${code}`)
  })
  listen(window, 'keyup', (event) => {
    pressedKeys.delete(event.code)
    for (const action of keyToActions.get(event.code) ?? []) release(action, `key:${event.code}`)
  })
  // 押したまま別の画面へ行くと keyup が届かない（キーが押しっぱなしになる）
  listen(window, 'blur', () => reset())
  listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') reset()
  })

  // --- 操作部の外のポインタ（タップ・スワイプ・照準） -------------------------------
  const gestures = new Map<number, { x: number; y: number; time: number }>()
  listen(root, 'pointerdown', (event) => {
    // iframe の中はクリックされるまでキー入力が届かない。最初のクリックで受け取れるようにする
    window.focus()
    setMode(nextMode(mode, { kind: 'pointer', pointerType: event.pointerType }))
    if (isControl(event.target)) return
    // タイトル・ポーズ中（操作部を隠している間）は固定しない。メニューをマウスで押せるように
    if (event.pointerType === 'mouse' && controlsVisible && !pointerLocked) lock?.request()
    const point = local(event)
    pointer = { ...point, down: true, pointerType: event.pointerType }
    gestures.set(event.pointerId, { ...point, time: event.timeStamp })
  })
  listen(root, 'pointermove', (event) => {
    if (isControl(event.target)) return
    pointer = { ...local(event), down: pointer.down, pointerType: event.pointerType }
  })
  const endGesture = (event: PointerEvent, cancelled: boolean) => {
    const start = gestures.get(event.pointerId)
    gestures.delete(event.pointerId)
    if (!start) return
    const point = local(event)
    pointer = { ...point, down: gestures.size > 0, pointerType: event.pointerType }
    if (cancelled) return
    const gesture = classifyGesture(start, { ...point, time: event.timeStamp })
    if (gesture?.kind === 'tap') emit(tapListeners, { ...point, pointerType: event.pointerType })
    if (gesture?.kind === 'swipe') {
      emit(swipeListeners, {
        direction: gesture.direction,
        startX: start.x,
        startY: start.y,
        endX: point.x,
        endY: point.y,
      })
    }
  }
  listen(root, 'pointerup', (event) => {
    // タッチの pointerdown はブラウザが「利用者の操作」と認めない（音を鳴らせない）。離したときに数える
    interacted()
    endGesture(event, false)
  })
  listen(root, 'pointercancel', (event) => endGesture(event, true))

  // --- ゲームパッドの読み取り（毎フレーム） ------------------------------------------
  if ((options.poll ?? 'auto') === 'auto' && typeof requestAnimationFrame === 'function') {
    let frame = 0
    const tick = () => {
      poll()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    cleanups.push(() => cancelAnimationFrame(frame))
  }

  // ---------------------------------------------------------------------------

  function poll(at = performance.now()): void {
    if (padBroken) return
    let list: ReadonlyArray<Gamepad | null>
    try {
      list = getGamepads()
    } catch (error: unknown) {
      // Permissions Policy で禁止されていると SecurityError になる。ゲームパッド無しで続ける（他の入力は動く）
      padBroken = true
      console.error('gamepad: getGamepads failed; continuing without gamepad', error)
      return
    }
    const pad =
      list.find((candidate) => candidate?.connected && candidate.mapping === 'standard') ?? null
    if (!pad) {
      if (currentPad) {
        // 抜かれた: 押していたボタンを離す
        for (const [button, bound] of padToActions) {
          if (padButtons[button]) for (const action of bound) release(action, `pad:${button}`)
        }
        currentPad = null
        padButtons = []
        padMove = { x: 0, y: 0 }
        padLookVector = { x: 0, y: 0 }
        repeat = null
      }
      return
    }
    currentPad = pad
    padStyle = padStyleOf(pad.id)
    const buttons = pad.buttons.map((button) => button.pressed)
    const axes = [...pad.axes]
    let active = false
    const count = Math.max(buttons.length, padButtons.length)
    for (let button = 0; button < count; button++) {
      const down = buttons[button] ?? false
      const was = padButtons[button] ?? false
      if (down) active = true
      if (down === was) continue
      for (const action of padToActions.get(button) ?? []) {
        if (down) hold(action, `pad:${button}`)
        else release(action, `pad:${button}`)
      }
    }
    padButtons = buttons
    padMove = padVector(axes, buttons)
    padLookVector = padLook(axes)
    if (padMove.x !== 0 || padMove.y !== 0 || padLookVector.x !== 0 || padLookVector.y !== 0)
      active = true
    if (active) {
      // つないであるだけでは切り替えない。触ったときだけ（操作説明と操作部の表示が変わる）
      lastPadAt = at
      setMode(nextMode(mode, { kind: 'pad' }, at - lastKeyAt))
    }
    const step = nextRepeat(repeat, padDirection(axes, buttons, repeat?.direction ?? null), at)
    repeat = step.state
    if (step.fire) emit(navigateListeners, step.fire)
  }

  function buildStick(): void {
    // 画面の左下 55% × 下 70% のどこに触れても、そこがスティックの中心になる（固定位置より外しにくい）
    const zone = element('div', {
      position: 'absolute',
      left: '0',
      bottom: '0',
      width: '55%',
      height: '70%',
      pointerEvents: 'auto',
      touchAction: 'none',
    })
    const base = element('div', {
      position: 'absolute',
      width: `${STICK_RADIUS_PX * 2}px`,
      height: `${STICK_RADIUS_PX * 2}px`,
      marginLeft: `${-STICK_RADIUS_PX}px`,
      marginTop: `${-STICK_RADIUS_PX}px`,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.55)',
      background: 'rgba(0,0,0,0.25)',
      boxSizing: 'border-box',
    })
    const knob = element('div', {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '52px',
      height: '52px',
      marginLeft: '-26px',
      marginTop: '-26px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.7)',
    })
    base.appendChild(knob)
    zone.appendChild(base)
    layer.appendChild(zone)
    controls.push(zone)

    const rest = () => {
      // 触れていないときは左下の定位置に薄く出して「ここで動かす」と分かるようにする
      base.style.left = `calc(${EDGE_PX + STICK_RADIUS_PX}px + var(--app-safe-area-left, env(safe-area-inset-left, 0px)))`
      base.style.top = `calc(100% - ${EDGE_PX + STICK_RADIUS_PX}px - var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))`
      base.style.opacity = '0.5'
      knob.style.transform = 'translate(0px, 0px)'
      stick = { x: 0, y: 0 }
    }
    rest()

    let active: { id: number; x: number; y: number } | null = null
    zone.addEventListener('pointerdown', (event) => {
      if (active) return
      zone.setPointerCapture(event.pointerId)
      const origin = localTo(zone, event)
      active = { id: event.pointerId, ...origin }
      base.style.left = `${origin.x}px`
      base.style.top = `${origin.y}px`
      base.style.opacity = '0.9'
    })
    zone.addEventListener('pointermove', (event) => {
      if (active?.id !== event.pointerId) return
      const point = localTo(zone, event)
      const dx = point.x - active.x
      const dy = point.y - active.y
      stick = stickVector(dx, dy)
      const distance = Math.hypot(dx, dy)
      const shown = distance > STICK_RADIUS_PX ? STICK_RADIUS_PX / distance : 1
      knob.style.transform = `translate(${dx * shown}px, ${dy * shown}px)`
    })
    const end = (event: PointerEvent) => {
      if (active?.id !== event.pointerId) return
      active = null
      rest()
    }
    zone.addEventListener('pointerup', end)
    zone.addEventListener('pointercancel', end)
    zone.addEventListener('lostpointercapture', end)
    cleanups.push(rest)
  }

  function buildDpad(): void {
    const make = (side: 'left' | 'right', index: number) => {
      const button = roundButton(side === 'left' ? '◀' : '▶', SECONDARY_BUTTON_PX + 8)
      button.style.left = `calc(${EDGE_PX + index * (SECONDARY_BUTTON_PX + 8 + BUTTON_GAP_PX)}px + var(--app-safe-area-left, env(safe-area-inset-left, 0px)))`
      button.style.bottom = `calc(${EDGE_PX}px + var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))`
      bindPointerHold(button, (down) => {
        dpad = { ...dpad, [side]: down }
      })
    }
    make('left', 0)
    make('right', 1)
  }

  function buildButtons(): void {
    const visible = actions
      .filter((action) => buttonSpecs[action].label !== undefined)
      .slice(0, MAX_BUTTONS)
    // 1 つ目（主アクション）を右下の角に大きく。2 つ目以降はその左と上に並べる（親指が届く弧の中）
    const slots = [
      { right: 0, bottom: 0 },
      { right: PRIMARY_BUTTON_PX + BUTTON_GAP_PX, bottom: 8 },
      { right: 8, bottom: PRIMARY_BUTTON_PX + BUTTON_GAP_PX },
      { right: PRIMARY_BUTTON_PX + BUTTON_GAP_PX, bottom: PRIMARY_BUTTON_PX + BUTTON_GAP_PX },
    ]
    visible.forEach((action, index) => {
      const size = index === 0 ? PRIMARY_BUTTON_PX : SECONDARY_BUTTON_PX
      const slot = slots[index] ?? slots[0]
      const button = roundButton(buttonSpecs[action].label ?? '', size)
      button.style.right = `calc(${EDGE_PX + slot.right}px + var(--app-safe-area-right, env(safe-area-inset-right, 0px)))`
      button.style.bottom = `calc(${EDGE_PX + slot.bottom}px + var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))`
      bindPointerHold(button, (down, id) => (down ? hold(action, id) : release(action, id)))
    })
  }

  function roundButton(label: string, size: number): HTMLElement {
    const button = element('div', {
      position: 'absolute',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.6)',
      background: 'rgba(0,0,0,0.3)',
      color: '#fff',
      font: `bold ${label.length > 2 ? 13 : 20}px sans-serif`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      lineHeight: '1.1',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      touchAction: 'none',
      opacity: '0.75',
      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
    })
    button.textContent = label
    layer.appendChild(button)
    controls.push(button)
    return button
  }

  /** 画面のボタンを「押している間」扱いにする。指がボタンの外へずれても離すまで押したまま */
  function bindPointerHold(
    button: HTMLElement,
    onChange: (down: boolean, id: string) => void
  ): void {
    const active = new Set<number>()
    button.addEventListener('pointerdown', (event) => {
      button.setPointerCapture(event.pointerId)
      active.add(event.pointerId)
      button.style.opacity = '1'
      button.style.background = 'rgba(255,255,255,0.35)'
      onChange(true, `pointer:${event.pointerId}`)
    })
    const end = (event: PointerEvent) => {
      if (!active.delete(event.pointerId)) return
      if (active.size === 0) {
        button.style.opacity = '0.75'
        button.style.background = 'rgba(0,0,0,0.3)'
      }
      onChange(false, `pointer:${event.pointerId}`)
    }
    button.addEventListener('pointerup', end)
    button.addEventListener('pointercancel', end)
    button.addEventListener('lostpointercapture', end)
    cleanups.push(() => {
      for (const id of active) onChange(false, `pointer:${id}`)
      active.clear()
    })
  }

  function hold(action: A, source: string): void {
    const sources = holders.get(action)
    const state = states.get(action)
    if (!sources || !state) return
    const wasDown = sources.size > 0
    sources.add(source)
    if (!wasDown) {
      state.down = true
      state.pressed = true
      emit(actionListeners, action)
    }
  }

  function release(action: A, source: string): void {
    const sources = holders.get(action)
    const state = states.get(action)
    if (!sources || !state) return
    if (!sources.delete(source) || sources.size > 0) return
    state.down = false
    state.released = true
  }

  function reset(): void {
    pressedKeys.clear()
    for (const action of actions) {
      holders.get(action)?.clear()
      const state = states.get(action)
      if (state?.down) {
        state.down = false
        state.released = true
      }
    }
    stick = { x: 0, y: 0 }
    dpad = { left: false, right: false }
    gestures.clear()
    pointer = { ...pointer, down: false }
  }

  function setMode(next: InputMode): void {
    if (next === mode) return
    mode = next
    applyVisibility()
    emit(modeListeners, mode)
  }

  function applyVisibility(): void {
    layer.style.display = mode === 'touch' && controlsVisible ? 'block' : 'none'
  }

  function interacted(): void {
    if (interactedOnce) return
    interactedOnce = true
    for (const listener of firstListeners) {
      try {
        listener()
      } catch (error: unknown) {
        // 1 つの失敗で残り（と開始）を止めない。握りつぶさずに出す
        console.error('onFirstInteraction listener failed', error)
      }
    }
    firstListeners.clear()
    resolveFirst()
  }

  function isControl(target: EventTarget | null): boolean {
    return target instanceof Node && controls.some((control) => control.contains(target))
  }

  function local(event: PointerEvent): { x: number; y: number } {
    return localTo(root, event)
  }

  function listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    handler: (event: WindowEventMap[K]) => void
  ): void
  function listen<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    handler: (event: DocumentEventMap[K]) => void
  ): void
  function listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void
  ): void
  function listen(target: EventTarget, type: string, handler: (event: never) => void): void {
    const listener = handler as unknown as EventListener
    // passive: false — preventDefault を効かせる（スクロール・長押しメニューの抑止）
    target.addEventListener(type, listener, { passive: false })
    cleanups.push(() => target.removeEventListener(type, listener))
  }

  return {
    get move() {
      const keyboard = keyboardVector(pressedKeys, scheme)
      const touch =
        moveSpec.style === 'dpad-x'
          ? { x: (dpad.right ? 1 : 0) - (dpad.left ? 1 : 0), y: 0 }
          : stick
      const combined = clampLength({
        x: keyboard.x + touch.x + padMove.x,
        y: keyboard.y + touch.y + padMove.y,
      })
      return moveSpec.style === 'dpad-x' ? { x: combined.x, y: 0 } : combined
    },
    get look() {
      return pointerLocked ? mouseLook : padLookVector
    },
    get tilt() {
      return tiltNow
    },
    get tiltActive() {
      return tiltActive
    },
    onTiltChange: (listener) => subscribe(tiltListeners, listener),
    calibrateTilt() {
      tiltNeutral = null
      tiltNow = { x: 0, y: 0 }
    },
    get pointerLocked() {
      return pointerLocked
    },
    pointerLockSupported,
    onPointerLockChange: (listener) => subscribe(lockListeners, listener),
    down: (action) => states.get(action)?.down ?? false,
    pressed: (action) => states.get(action)?.pressed ?? false,
    released: (action) => states.get(action)?.released ?? false,
    endFrame() {
      mouseLook = { x: 0, y: 0 }
      for (const state of states.values()) {
        state.pressed = false
        state.released = false
      }
    },
    get mode() {
      return mode
    },
    onModeChange: (listener) => subscribe(modeListeners, listener),
    onAction: (listener) => subscribe(actionListeners, listener),
    onNavigate: (listener) => subscribe(navigateListeners, listener),
    get pad() {
      return { connected: currentPad !== null, style: currentPad ? padStyle : 'generic' }
    },
    padLabel(action) {
      const button = actionToPad.get(action)?.[0]
      if (button === undefined) return ''
      return padButtonName(button, currentPad ? padStyle : 'generic')
    },
    rumble({ durationMs = 120, strong = 0.6, weak = 0.3 } = {}) {
      // 振動の API は端末・ブラウザで有無が分かれる（Chrome 68+ / Safari 16.4+。Firefox と iOS Safari は無し）。
      // 無くてもゲームは成立するので、あるときだけ鳴らす
      const actuator = (
        currentPad as {
          vibrationActuator?: { playEffect?: (type: string, params: object) => Promise<unknown> }
        } | null
      )?.vibrationActuator
      if (!actuator || typeof actuator.playEffect !== 'function') return
      actuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          strongMagnitude: strong,
          weakMagnitude: weak,
        })
        .catch((error: unknown) => {
          console.warn('gamepad: rumble failed', error)
        })
    },
    poll,
    onTap: (listener) => subscribe(tapListeners, listener),
    onSwipe: (listener) => subscribe(swipeListeners, listener),
    onFirstInteraction(listener) {
      if (interactedOnce) {
        listener()
        return () => {}
      }
      return subscribe(firstListeners, listener)
    },
    get pointer() {
      return pointer
    },
    firstInteraction,
    setControlsVisible(visible) {
      controlsVisible = visible
      if (!visible) {
        stick = { x: 0, y: 0 }
        dpad = { left: false, right: false }
        // タイトル・リザルト・ポーズではマウスを返す（メニューをクリックできるように）
        if (pointerLocked) lock?.exit()
      }
      applyVisibility()
    },
    reset,
    destroy() {
      if (pointerLocked) lock?.exit()
      reset()
      for (const cleanup of cleanups.splice(0)) cleanup()
      modeListeners.clear()
      actionListeners.clear()
      navigateListeners.clear()
      tapListeners.clear()
      swipeListeners.clear()
      firstListeners.clear()
      lockListeners.clear()
      tiltListeners.clear()
    },
  }
}

/**
 * マウス固定（Pointer Lock。sdk-v2.md §7.2）。**使うゲームだけ import して `createInput({ pointerLock })` に渡す**。
 * 別の関数にしてあるのは、使わないゲームのバンドルに `requestPointerLock` を入れないため（Platform の検証は
 * バンドルの中の requestPointerLock の呼び出しと Manifest の宣言を突き合わせる）。
 *
 * - 生のマウス移動（`unadjustedMovement`。OS の加速なし）を先に頼み、使えない端末（Linux 等は `NotSupportedError`）では
 *   付けずに頼み直す。古いブラウザは Promise を返さない
 * - Esc はブラウザが必ず解除に使う（`pointerlockchange` で知らせる）
 * - iOS Safari には API が無い（`supported: false`）
 */
export const pointerLock: PointerLockDriver = (root, hooks) => {
  const target = root as HTMLElement & {
    requestPointerLock?: (options?: { unadjustedMovement?: boolean }) => Promise<void> | undefined
  }
  const supported = typeof target.requestPointerLock === 'function'
  const onChange = () => hooks.onChange(document.pointerLockElement === root)
  const onError = () => {
    // 固定が断られた（操作の外で頼んだ・解除の直後に頼み直したなど）。ゲームは固定なしで続く
    console.warn('pointer lock: the browser refused to lock the pointer')
  }
  const onMove = (event: MouseEvent) => hooks.onMove(event.movementX, event.movementY)
  if (supported) {
    document.addEventListener('pointerlockchange', onChange)
    document.addEventListener('pointerlockerror', onError)
    document.addEventListener('mousemove', onMove)
  }
  const refused = (error: unknown) => console.warn('pointer lock was refused', error)
  const retryWithoutRaw = (error: unknown) => {
    if (!(error instanceof DOMException) || error.name !== 'NotSupportedError')
      return refused(error)
    console.warn('pointer lock: unadjustedMovement is not supported; retrying without it', error)
    try {
      target.requestPointerLock()?.catch(refused)
    } catch (retryError: unknown) {
      refused(retryError)
    }
  }
  return {
    supported,
    request() {
      if (!supported || !target.requestPointerLock) return
      try {
        target.requestPointerLock({ unadjustedMovement: true })?.catch(retryWithoutRaw)
      } catch (error: unknown) {
        retryWithoutRaw(error)
      }
    },
    exit() {
      if (document.pointerLockElement === root && typeof document.exitPointerLock === 'function') {
        document.exitPointerLock()
      }
    },
    destroy() {
      document.removeEventListener('pointerlockchange', onChange)
      document.removeEventListener('pointerlockerror', onError)
      document.removeEventListener('mousemove', onMove)
    },
  }
}

/**
 * 傾き（sdk-v2.md §7.2）。**使うゲームだけ** `createInput({ tilt: tilt(app) })` に渡す（使わないゲームのバンドルに
 * 傾きの呼び出しを入れない。Platform の検証はバンドルの中の呼び出しと Manifest の宣言を突き合わせる）。
 *
 * Host が端末から取り、許可（iOS は Host のボタン）を得てから届く。断られた・端末に無いときはログに残して
 * 傾きなし（`tiltActive: false`）で続ける。
 */
export function tilt(app: MotionSource): TiltDriver {
  return (hooks) => {
    let stream: Awaited<ReturnType<MotionSource['device']['motion']['start']>> | null = null
    let stopped = false
    const stopStream = (target: NonNullable<typeof stream>) => {
      target.stop().catch((error: unknown) => {
        console.warn('tilt: stopping motion failed', error)
      })
    }
    app.device.motion.start().then(
      (started) => {
        if (stopped) {
          stopStream(started)
          return
        }
        stream = started
        started.onSample((sample) => hooks.onSample(sample))
        started.onStop(() => {
          stream = null
          hooks.onActive(false)
        })
        hooks.onActive(true)
      },
      (error: unknown) => {
        // 断られた（FORBIDDEN）・端末に無い（PC）・許可を待ちきれなかった。ゲームは代わりの操作で続く
        console.warn('tilt: motion is not available; use the other controls', error)
      }
    )
    return {
      stop() {
        stopped = true
        if (!stream) return
        const current = stream
        stream = null
        stopStream(current)
      },
    }
  }
}

function element(tag: 'div', style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const node = document.createElement(tag)
  Object.assign(node.style, style)
  return node
}

function localTo(target: HTMLElement, event: PointerEvent): { x: number; y: number } {
  const rect = target.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function matchesMedia(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

function subscribe<T>(
  listeners: Set<(value: T) => void>,
  listener: (value: T) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of listeners) listener(value)
}
