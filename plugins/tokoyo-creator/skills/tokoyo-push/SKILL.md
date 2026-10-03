---
name: tokoyo-push
description: 手元で作った TOKOYO.games のゲームを Platform に送る。git で commit し、Creator Kit の CLI で outputs/ の 3 点（source.bundle = 新しい commit の差分 bundle・dist.tar.gz・build-report.json）を作って検査し、Platform MCP（tokoyo）の begin_build → アップロード（LFS → 3 点）→ submit_build → get_build で下書きにする。「送って」「push して」「Platform に上げて」「試遊できるようにして」のときに使う。push, submit, upload, build.
---

# Platform に送る

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。`<kit>` は `.tokoyo.json` の `kit_root`。
手順・結果の扱い・エラーは **`<kit>/profile/instructions.md` §8.3〜§8.5 が正本**。要点:

1. `source/` の変更を `git commit` する（未 commit の変更があると `pack` が断る。作者は `kit.mjs clone` が設定した本人のまま）。
2. `node <kit>/scripts/kit.mjs build` で `source/dist/` を作り（`build.mjs` を直接実行しない。§4.1）、`outputs/build-report.json` を書く（§2）。
3. `node <kit>/scripts/kit.mjs pack` → 出力の JSON（`session_id` / `files` / `commit_oid` / `base_commit_oid` / `kit_version` / `kit_revision`）。
4. `node <kit>/scripts/kit.mjs check` が通るまで直す（commit して `pack` からやり直す）。
5. `begin_build`（元ゲームのapp_idとpackのsession_idが必須。`message` は利用者向けの 1 行、`request_key` は新しい UUID、`commit_oid` / `base_commit_oid` / `files` は `pack` の出力のまま）
   → `kit.mjs upload --urls '<upload_urls の JSON>'`（LFS の実体を先に上げる。資格情報が無いと言われたら `kit.mjs login`）
   → `submit_build` → `get_build` を 3 秒ごとに終わるまで。
6. `ready` なら **`node <kit>/scripts/kit.mjs open --url <editor_url>` で制作画面をブラウザに開く**（この会話で最初の `ready` のときだけ。
   開けない環境では `opened: false` になるだけ。`open` がエラーで終わっても止まらない）。開けたかどうかに関わらず、**`editor_url` を返事の最後に目立つ形で毎回示す**
   （手元で遊ぶ仕組みは無い。試遊は制作画面）。そのあと `$tokoyo-pull` で取り込み直す（次の push の base になる）。
   `STALE_BASE` は `kit.mjs pull`（= `git pull --rebase`）してから 2. から（§8.4）、ほかのエラーは §8.5。公開・投稿は制作画面で利用者が行う。
