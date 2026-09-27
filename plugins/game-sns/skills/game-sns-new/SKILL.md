---
name: game-sns-new
description: game-sns のミニゲームを手元の Coding Agent で新しく作り始める。Platform MCP（game-sns）で App を作り、Creator Kit の SDK を用意し、作業ディレクトリ（.game-sns.json・source/）を作る。「新しいゲームを作って」「game-sns で〜を作りたい」のように、まだ Platform に無いゲームを作るときに使う。new game, create app, setup.
---

# 新しいゲームを作り始める

`<kit>` は Creator Kit の置き場で、この Skill のディレクトリの 2 つ上（`skills/game-sns-new/` の上の上）。
分からなければ利用者に Kit の場所を聞く。

1. **SDK を用意する**: `get_sdk()` → `node <kit>/scripts/kit.mjs setup --sdk-url <url> --sha256 <sha256>`（展開して、Kit の lockfile どおりに `npm ci` で three などを入れる。npm とネットワークが要る）
   （同じ版なら何もしないので毎回呼んでよい）。
2. **持ち主を決める**: `whoami()` の `accounts` がチームを含むなら、どのアカウント（個人かチーム）の
   ゲームにするかを利用者に聞く。個人なら `owner_account_id` は省く。
3. **App を作る**: `create_app({ title, owner_account_id? })` → `app_id` / `session_id` / `editor_url`。
   `title` は遊びの説明から短く付ける。
4. **作業ディレクトリを作る**: 今のディレクトリの下に、題名を英数字にした新しいディレクトリを作って移り、
   `node <kit>/scripts/kit.mjs init --app-id <app_id> --session-id <session_id>` を実行する
   （`.game-sns.json`・`source/`（sample-app を写したもの）・`input/`・`outputs/`・`AGENTS.md` ができる）。
5. **作る**: `<kit>/profile/instructions.md` を読み、その約束（§4.1 と §8）どおりに `source/` で作る。
6. **送る**: `$game-sns-push`。送った版は制作画面（`editor_url`）で試遊できる。
