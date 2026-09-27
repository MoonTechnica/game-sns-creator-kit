---
name: game-sns-remix
description: 他の人が公開した game-sns のゲームをリミックスして（GitHub の fork）、自分の派生を手元で作り始める。Platform MCP（platform-creator）の resolve_app / remix / download_source と Creator Kit の CLI（init / pull）を使う。ゲームのページの URL（/g/…・/p/…）を渡されて「これを改造して」「リミックスして」「fork して」と言われたとき、他人のゲームを直して本流へ提案したいときに使う。remix, fork, derive.
---

# リミックスして作り始める

`<kit>` は作業ディレクトリの `.game-sns.json` の `kit_root`。まだ無ければ、この Skill のディレクトリの 2 つ上。
手順・エラーの正本は **`<kit>/profile/instructions.md` §8.6**。要点:

1. `resolve_app({ reference: <URL か id> })`。
   - `my_forks` があれば**新しく fork しない**。その `app_id` で `$game-sns-pull` から続ける。
   - `remix.allowed` が false なら、`remix.reason`（`remix_not_allowed` / `not_published` / `no_published_version`）を利用者に伝えて止まる。
2. `remix({ parent_version_id: <remix.version_id>, request_key: <新しい UUID> })`。チームに作るなら `owner_account_id`
   （`whoami` の `accounts` から利用者に選んでもらう）。やり直すときは同じ `request_key` を使う（fork が増えない）。
3. 返った `app_id` で `$game-sns-pull` の 2. から（`get_app` → `kit.mjs init` → `download_source` → `kit.mjs pull`）。
4. 作って `$game-sns-push` で送る。本流へ出すなら `$game-sns-propose`。
