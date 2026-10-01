---
name: tokoyo-remix
description: 他の人が公開した TOKOYO.games のゲームをリミックスして（GitHub の fork）、自分の派生を手元で作り始める。Platform MCP（tokoyo）の resolve_app / remix / download_source と Creator Kit の CLI（init / pull）を使う。ゲームのページの URL（/g/…・/p/…）を渡されて「これを改造して」「リミックスして」「fork して」と言われたとき、他人のゲームを直して本流へ提案したいときに使う。remix, fork, derive.
---

# リミックスして作り始める

`<kit>` は作業ディレクトリの `.tokoyo.json` の `kit_root`。まだ無ければ、この Skill のディレクトリの 2 つ上。
手順・エラーの正本は **`<kit>/profile/instructions.md` §8.6**。要点:

0. **何を直すか決まっていなければ**、作者が「手を貸してほしい」と出している話題から選ぶ:
   `list_apps_wanting_help()` → `list_discussions({ app_id, help_wanted: true })`。選んだ話題の `id` は
   提案のときに `discussion_id` として渡す（`$tokoyo-propose`）。
1. `resolve_app({ reference: <URL か id> })`。
   - `my_forks` があれば**新しく fork しない**。その `app_id` で `$tokoyo-pull` から続ける。
   - `remix.allowed` が false なら、`remix.reason`（`remix_not_allowed` / `not_published` / `no_published_version`）を利用者に伝えて止まる。
2. `remix({ parent_version_id: <remix.version_id>, request_key: <新しい UUID> })`。チームに作るなら `owner_account_id`
   （`whoami` の `accounts` から利用者に選んでもらう）。やり直すときは同じ `request_key` を使う（fork が増えない）。
3. 返った `app_id` で `$tokoyo-pull` の 2. から（`get_app` → `kit.mjs init` → `download_source` → `kit.mjs pull`）。
4. 作って `$tokoyo-push` で送る。本流へ出すなら `$tokoyo-propose`。
   **1 つの提案には 1 つの目的だけ**を入れる。頼まれた変更に必要なファイルだけを変え、整形し直し・名前の付け替え・
   ついでの改善をしない（本流と衝突しやすくなり、作者が読みにくくなる）。掲載情報（`listing/`）は頼まれない限り変えない。
5. 本流に新しい版が出たら（`list_notifications` の `upstream_published`）、`sync_upstream({ app_id, request_key })` で
   取り込んでから続ける（衝突が減る。fork の支払い元のクレジットを使う）。
