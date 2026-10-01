---
name: tokoyo-pull
description: Platform にある TOKOYO.games のゲームを手元に取り込む（続きを作る・制作画面で進んだ版を取り込む・リミックス元の本流の新しい公開版を取り込む）。Platform MCP（tokoyo）の get_app / download_source / get_merge_inputs と Creator Kit の CLI（pull / merge-inputs）を使う。app_id や制作画面の URL を渡されたとき、「続きを作って」「最新にして」「本流を取り込んで」のときに使う。pull, sync, continue, upstream.
---

# 手元に取り込む

`<kit>` は作業ディレクトリの `.tokoyo.json` の `kit_root`。まだ作業ディレクトリが無ければ、この Skill の
ディレクトリの 2 つ上（分からなければ利用者に Kit の場所を聞く）。

1. **SDK を用意する**: `get_sdk()` → `node <kit>/scripts/kit.mjs setup --sdk-url <url> --sha256 <sha256>`（展開して Kit の lockfile どおりに `npm ci`。同じ版なら何もしない）。
2. **App を決める**: 渡された `app_id`（制作画面の URL なら `/create/<app_id>` の部分）。分からなければ
   `list_apps()` の一覧から利用者に選んでもらう。
3. `get_app({ app_id })` を呼ぶ。
4. **作業ディレクトリ**: その App の `.tokoyo.json` があるディレクトリで作業する。無ければ新しいディレクトリを作って移り、
   `node <kit>/scripts/kit.mjs init --app-id <app_id> --session-id <session_id> --head-revision-id <head_revision_id>`
   （`head_revision_id` が null なら `--head-revision-id` を付けない）。
5. **取り込む**: `<kit>/profile/instructions.md` §8.3 の 1.（手元に送っていない変更があるときは §8.4）。
6. **本流を取り込む**（`get_app` の `upstream.behind` が true で、利用者が望むとき）: §8.4 の後半のとおり
   `get_merge_inputs` → `kit.mjs merge-inputs` → `$game-merge` で解き、`$tokoyo-push` で送る。
