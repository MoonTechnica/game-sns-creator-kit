---
name: tokoyo-pull
description: Platform にある TOKOYO.games のゲームを手元に取り込む（続きを作る・制作画面で進んだ版を取り込む）。Platform MCP（tokoyo）の get_app / get_git_bundles と Creator Kit の CLI（clone / pull。手元は git のリポジトリ）を使う。app_id や制作画面の URL を渡されたとき、「続きを作って」「最新にして」「本流を取り込んで」のときに使う。pull, sync, continue, upstream.
---

# 手元に取り込む

`<kit>` は作業ディレクトリの `.tokoyo.json` の `kit_root`。まだ作業ディレクトリが無ければ、この Skill の
ディレクトリの 2 つ上（分からなければ利用者に Kit の場所を聞く）。git と Git LFS が要る。

1. **SDK を用意する**: `get_sdk()` → `node <kit>/scripts/kit.mjs setup --sdk-url <url> --sha256 <sha256>`（展開して Kit の lockfile どおりに `npm ci`。同じ版なら何もしない）。
2. **App を決める**: 渡された `app_id`（制作画面の URL なら `/create/<app_id>` の部分）。分からなければ
   `list_apps()` の一覧から利用者に選んでもらう。
3. `get_git_bundles({ app_id })` を呼ぶ（署名 URL は短命なので、すぐ次へ渡す）。
4. **取り込む**: その App の `.tokoyo.json` があるディレクトリなら
   `node <kit>/scripts/kit.mjs pull --bundles '<get_git_bundles の JSON>'`。
   無ければ新しいディレクトリを作って移り、`node <kit>/scripts/kit.mjs clone --bundles '<同じ JSON>'`。
   `pull` は commit していない変更があると断るので、先に `git commit` する（`<kit>/profile/instructions.md` §8.3 / §8.4）。
5. 結果の `status` が `conflict` なら、示されたファイルの衝突を解き `git add` → `git rebase --continue`（§8.4）。
6. **本流（リミックス元）を取り込む**（`get_app` の `upstream.behind` が true で、利用者が望むとき）:
   `sync_upstream({ app_id, request_key })`（Platform が合流する）。終わったら 3. から取り込み直す。
