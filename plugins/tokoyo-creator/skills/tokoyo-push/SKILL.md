---
name: tokoyo-push
description: 手元で作った TOKOYO.games のゲームを Platform に送る。Creator Kit の CLI で outputs/ の 3 点（source.zip・dist.tar.gz・build-report.json）を作って検査し、Platform MCP（tokoyo）の begin_build → アップロード → submit_build → get_build で下書きにする。「送って」「push して」「Platform に上げて」「試遊できるようにして」のときに使う。push, submit, upload, build.
---

# Platform に送る

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。`<kit>` は `.tokoyo.json` の `kit_root`。
手順・結果の扱い・エラーは **`<kit>/profile/instructions.md` §8.3〜§8.5 が正本**。要点:

1. `source/` をビルドして `source/dist/` を作り、`outputs/build-report.json` を書く（§2）。
2. `node <kit>/scripts/kit.mjs pack` → 出力の JSON（`files` / `kit_version` / `kit_revision` / `base_revision_id` / `merge_theirs_revision_id`）。
3. `node <kit>/scripts/kit.mjs check` が通るまで直す（`pack` からやり直す）。
4. `begin_build`（`message` は利用者向けの 1 行、`request_key` は新しい UUID。`merge_theirs_revision_id` は null なら渡さない）
   → `kit.mjs upload --urls '<upload_urls の JSON>'` → `submit_build` → `get_build` を 3 秒ごとに終わるまで。
5. `ready` なら **`node <kit>/scripts/kit.mjs open --url <editor_url>` で制作画面をブラウザに開く**（この会話で最初の `ready` のときだけ。
   開けない環境では `opened: false` になるだけ。`open` がエラーで終わっても止まらない）。開けたかどうかに関わらず、**`editor_url` を返事の最後に目立つ形で毎回示す**
   （手元で遊ぶ仕組みは無い。試遊は制作画面）。
   `REVISION_CONFLICT` は §8.4、ほかのエラーは §8.5。公開・投稿は制作画面で利用者が行う。
