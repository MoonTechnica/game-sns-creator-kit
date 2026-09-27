# Generation Profile — `game` / SDK v2 — 仕様書

この文書は **生成 Agent が参照する仕様の目次**である。Agent が書くコードの契約そのものは
`<kit>/sdk/` に展開された SDK パッケージの中にあり、**そちらが正本**。
ここは「どれを、どの順に読むか」だけを示す。

Platform 側の対応行は `generation_profiles(kind='game', sdk_version=1)`
（`spec_key` = この文書、`instructions_key` = `instructions.md`）。

## 1. 置かれているもの

手元では、読むもの（`<kit>` = Creator Kit）と作業ディレクトリ（`./`）が分かれている。`<kit>` の下は
次の図の `sdk/` `profile/` `skills/` と同じ形で、ほかに `scripts/kit.mjs`（Kit の CLI）がある。
作業ディレクトリは `.game-sns.json`・`source/`（作るプロジェクト）・`input/`・`outputs/`・`assets-cache/`（`instructions.md` §8）。

```text
/workspace/
├── sdk/                     # Platform が配る契約（環境テンプレートの files）
│   ├── app-sdk/
│   │   ├── spec.md          # ★ App（画面）の API 契約。最初に読む
│   │   ├── MIGRATION.md     # 版を上げるときの差分
│   │   ├── types/           # .d.ts（TypeScript の型。実装は含まない）
│   │   └── build-config/    # バンドル設定（SDK を外部参照にする）
│   ├── app-server-sdk/
│   │   ├── spec.md          # ★ 対戦のルール（server.bundle.js の defineSpace）の API 契約
│   │   ├── types/
│   │   ├── src/             # defineSpace の実体と createLocalSpace（ルールをサーバー無しで動かす）
│   │   └── build-config/
│   ├── sample-app/          # 上の 2 つを使った最小の実例（動く形）
│   ├── package.json         # 使える第三者ライブラリ（版は完全一致）
│   ├── npm-shrinkwrap.json  # その lockfile（integrity。setup が npm ci で入れる）
│   └── node_modules/        # three / @types/three / Rapier の決定版 / @colyseus/schema（これ以外は無い）
├── profile/
│   ├── spec.md              # この文書
│   └── instructions.md      # 作業手順と出力の約束
├── skills/                  # Agent Skills（名前と説明が最初から見えている。`$<名前>` で使う）
│   ├── game-controls/       # PC とスマホの操作（入力キット assets/input.ts・ジャンル別の割り当て）
│   ├── game-screen-layout/  # 画面の追従・HUD・タイトル / ポーズ / リザルト
│   ├── game-asset-tools/    # 画像生成と素材ツール（MCP）
│   ├── game-3d-and-bundles/ # three.js・バンドルの分割・メモリ
│   ├── game-multiplayer/    # オンライン対戦（2〜8 人・役割・予測・練習モード）
│   ├── game-leaderboard/    # ランキング（ボードの決め方・送る瞬間・順位表の表示）
│   ├── game-documents/      # 非同期対戦・共有の場（Schema・手番・衝突・招待とマッチング）
│   ├── game-ai/             # ゲーム内 AI（指示文・Structured Outputs・費用・失敗しても遊べる作り）
│   └── game-merge/          # 2 つの版を合わせる（マージ）
├── input/                   # 前の版・マージの材料（instructions.md §4.0）
└── outputs/                 # ここに置いたものだけが Platform に渡る
```

## 2. 読む順序

| # | 読むもの | そこから得るもの |
|---|---|---|
| 1 | `<kit>/profile/instructions.md` | 何を作り、何を `outputs/` に置くか |
| 2 | `<kit>/sdk/app-sdk/spec.md` | `manifest.json` の形、Capability、`app.*` の API、CSP と禁止事項 |
| 3 | `<kit>/sdk/app-server-sdk/spec.md` | 対戦を作る場合のみ。`defineSpace` の書き方（状態・入力・`step`・`finish`） |
| 4 | `<kit>/sdk/sample-app/` | 1〜3 を満たした最小実装。**構成はこれに倣う** |
| 4b | `<kit>/skills/*/SKILL.md` | 操作・画面・素材・3D・対戦・ランキング・ゲーム内 AI の作り方（`instructions.md` §0 の表のとおりに使う） |
| 5 | `<kit>/sdk/*/build-config/` | バンドル設定。SDK を bundle に含めないための外部参照指定 |

## 3. この Profile が固定していること

| 項目 | 値 | 理由 |
|---|---|---|
| `manifest.json` の `kind` | `"game"` | この Profile の対象 |
| `manifest.json` の `sdkVersion` | `2` | 配る SDK の版。`./input/` の前の版が `1` なら 2 に上げる（`<kit>/sdk/app-sdk/MIGRATION.md`「1 → 2」） |
| `manifest.json` の `renderer` | 3D（同梱の `three/webgpu`）は `"webgpu"`、2D の Canvas は `"canvas2d"` | 3D の既定は `WebGPURenderer`（WebGPU が無い端末では自動で WebGL2）。省略すると `"webgpu"` |
| `manifest.json` の `runtimeVersion` | `1` | Shell の版。Platform が互換表で解決する |
| 対戦人数 | 2〜8（`{ "min", "max" }` か役割ごとの `roles`） | Platform の範囲。9 人以上・1 人の対戦は受け付けない（一人で遊ばせるなら練習モード） |
| 個人のセーブ（`app.store`） | 1 件 **1 MiB** まで（送る JSON の長さ。`blob` 型は gzip + base64 の後）・書き込みは毎分 12 回。大きな値は `blob` に置き、世界は seed + 変えたところだけ、オートセーブは 1 分に 1 回 | Platform の上限（`<kit>/sdk/app-sdk/spec.md` §3.2） |
| 外部通信 | 不可（`externalNetwork: false`） | Shell の CSP が `default-src 'none'` |
| 端末の機能（傾き・マウス固定・カメラ・マイク） | `capabilities` と `device` に宣言し、傾き・マウス固定は入力キット（`$game-controls`）の `tilt` / `pointerLock`、カメラ・マイクは `app.device.camera` / `microphone` を使う。`required` は原則 `false` | Platform が宣言と呼び出しを突き合わせる。宣言の無い機能は iframe で使えない（`<kit>/sdk/app-sdk/spec.md` §8.4） |
| 依存の追加 | 不可（Kit の lockfile にあるもの = `sdk/package.json` の three・`@types/three`・Rapier の決定版・`@colyseus/schema` だけが使える） | 版は Kit が固定し、検証器・対戦サーバーも同じ版を前提にする。足しても次のターンの Sandbox では入らない |

## 4. 仕様と食い違いが出たとき

**`<kit>/sdk/*/spec.md` が正本**。この文書や過去の記憶と食い違ったら spec.md に従う。
spec.md に書かれていない API・グローバル変数・ネットワーク経路は**存在しない**ものとして扱う
（静的検証と実行時の CSP がどちらも落とす）。
