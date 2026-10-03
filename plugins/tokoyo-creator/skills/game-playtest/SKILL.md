---
name: game-playtest
description: 作ったゲームを自分で遊んで確かめ、直す。核が遊べる形になったときと、仕上げの前に使う。design/playtest.md の確かめる項目（rubric）の作り方、ルールを node で回す検査（assets/playtest-rules.mjs をコピーして使う）、利用者が頼んだときだけ Platform にしっかりした試遊を頼むこと、前の版の試遊結果（input/playtest-report.json）の読み方、直す順序を扱う。playtest, rubric, self-test, headless, simulation, autoplay, bug triage.
---

# 自分で遊んで確かめる

ビルドが通ることと遊べることは別。**操作が効かない・勝ち負けが起きない・状態が進まない**は、コードを読んでも見つからない。
ここでは遊びの振る舞いを確かめる。見た目の数値（文字・コントラスト・点滅）は `$game-ux` のチェックが担う。

## 1. 確かめる項目（`design/playtest.md`）

`design/brief.md` から 6〜10 項目を起こす。**1 項目 = 遊んで観察できる振る舞い 1 つ**（「面白い」「ちゃんと動く」は項目にしない）。

```markdown
| # | 項目 | 確かめ方 | 結果 |
|---|---|---|---|
| 1 | 1 回の操作で遊び始められる | Platform の試遊（§3。この版の結果は次のターン） | 次のターン |
| 2 | 左右の入力で自機が動く | ルール検査 | ✓ |
| 3 | 何もしなくても最初の 10 秒は終わらない | ルール検査 | ✓ |
| 4 | 針に触れると終わり、リザルトが出る | ルール検査 | ✓ |
| 5 | リザルトから 1 回の操作で最初に戻る | ルール検査 | ✓ |
| 6 | うまく取るほど点が増える | ルール検査 | ✓ |
| 7 | 10 秒ごとに星が速くなる | ルール検査（tuning の値） | ✓ |
| 8 | プレイ中もスコアが読める | Platform の試遊の画面（§3。この版の結果は次のターン） | 次のターン |
```

- 「結果」は、このターンで確かめて通ったものだけ ✓、通らなかったものは ✗（理由）。**確かめていないものに ✓ を付けない**。
  Platform の試遊で見る項目は、この版では「次のターン」と書き、次のターンで `input/playtest-report.json` を読んで埋める。

必須: 開始できる / 入力で状態が変わる / 最初は失敗しにくい / 終わりが必ず来る / 再挑戦できる / 上手さが結果に出る。
残りはジャンルの下限（`$game-design` references/genres-minimum.md）から選ぶ。

## 2. ルール検査（`rules.ts` があるターンは毎回・このターンの中で）

`src/rules.ts` の遊びのルールを、描画なしで `node` から回す（`$game-design` §3 の形が前提。`rules.ts` の無い前の版を続けるときは
省いて `notes` に 1 行書く。`$game-design` §1）。

1. `<kit>/skills/game-playtest/assets/playtest-rules.mjs` を `scripts/playtest-rules.mjs` にコピーする（初回だけ。以後はそのファイルを直す）。
2. 下の方の `CHECKS` を、このゲームの rubric に合わせて書き換える。`idle`（何もしない）と `play`（うまく遊ぶ人の入力）を rules.ts の `Input` の形にする。
   `simulate(rules, { seed, seconds, input })` が `over` / `endedAt` / `score` / `samples` / `brokenNumber` を返す。
   **雛形の `CHECKS` はアクション向け**（放置しても 10 秒は終わらない・放置すればいつか終わる）。放置で負ける遊び（ワンボタン）、
   入力が無いと進まない遊び（パズル・ターン制・クリッカー）では、その項目を遊びに合う形（「最初の手で状態が変わる」「解ける」など）に置き換える。
   「再挑戦で最初に戻る」は `init` が同じ seed で同じ状態を返すことだけを見る。リザルトから戻る操作は画面側なので、`main.ts` を読んで確かめる。
3. `node scripts/playtest-rules.mjs` を実行する。✗ が出たら直して、全部 ✓ になるまで回す。
4. 結果を `design/playtest.md` の「結果」に写す。

- **テストファイルはこれ 1 本だけ**。描画や入力キットの単体テストは書かない。
- 対戦のルールも `src/rules.ts` に書き、`server/main.ts` の `defineSpace` がそれを呼ぶ（`$game-design` §3）。検査はその `rules.ts` を回す。
- 数値を直すときは `src/tuning.ts` だけを変えて回し直す。

## 3. Platform の試遊（検証のついで）

Platform は版を検証するときに、描けたゲームを**毎回、最小限だけ**遊んでみる: 中央をタップして Enter / Space を送り、
1.5 秒後に 1 枚撮って「入力で画面が変わったか」を見る（時間も費用もほとんどかからない。頼まなくてよい）。

**利用者が明確に頼んだとき**（「遊んで確かめて」「ちゃんと動くかテストして」など）だけ、`build-report.json` に
`"playtest": { "level": "thorough" }` を書く。その版は 12 秒ほど矢印・Space・タップを押し続け、4 秒ごとに撮る（3 枚まで）。
**自分の判断では頼まない**（検証が長くなり、利用者を待たせる）。遊びの振る舞いは §2 のルール検査で確かめる。

結果は次のターンの `./input/playtest-report.json` と `input/playtest/*.png` に届く（前の版を遊んだときの結果）。
手元では `kit.mjs clone` / `kit.mjs pull` が `get_git_bundles` の `head.playtest` を同じ場所に置く（`instructions.md` §8.3）。
```jsonc
{ "versionId": "…",
  "findings": [ { "code": "STATIC_AFTER_INPUT", "message": "…" },   // 最初の入力で画面が変わらなかった
                { "code": "STATIC_SCREEN", "message": "…" },        // しっかりした試遊で最後まで変わらなかった
                { "code": "PAGE_ERROR", "message": "TypeError: …" } ],
  "screenshots": ["playtest/1.png"] }
```

- **届いていたら、依頼の作業より先に読む**。`PAGE_ERROR` と `STATIC_AFTER_INPUT` / `STATIC_SCREEN` は、依頼の作業のついでに直す
  （最初の画面でタップを待っているだけなら、タップで始まることを確かめて `notes` に 1 行書けばよい）。
- 画像を見て、HUD が読めるか・主役が見えるか・最初にすることが出ているかを確かめる。
- 乱数で押すだけなので、「勝てない」「点が入らない」は判断の根拠にしない（それはルール検査で見る）。

## 4. 直す順序

1. 起動しない・エラーが出る（`PAGE_ERROR`・ビルドの失敗）
2. 状態が進まない（入力が効かない・終わらない・再挑戦できない）
3. ルールが brief と違う（勝ち負けの条件・点数）
4. 手応えが無い（`$game-ux` §2）
5. 見た目（絵柄のずれ・読めない文字）

報告（`build-report.json` の `notes` と最後の返事）は、何を確かめて何が ✓ になったかを短く書く。✗ が残ったら、何が残ったかと理由を書く。
