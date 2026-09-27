# game-sns Creator Kit

game-sns のミニゲームを、**手元の Coding Agent（Claude Code / Codex など）で作る**ための Kit です。
Platform の生成 Agent と**同じ Skills・指示書・SDK**を使い、Platform MCP（`game-sns`）で
ゲームの取得・送信・素材の生成を行います。送った版は制作画面で試遊・公開できます。

> このリポジトリは game-sns の本体リポジトリから CI が生成しています。**直接編集しないでください**
> （変更は次の生成で上書きされます）。

## 必要なもの

- Node.js 20 以上、`git` 2.38 以上（`merge-tree --write-tree`）、`tar`（macOS / Linux は標準、Windows 10 以降は `tar.exe`）
- game-sns の本登録アカウント（ログインは初回にブラウザで行います）

## Claude Code

```text
/plugin marketplace add moontechnica/game-sns-creator-kit
/plugin install game-sns@game-sns
/mcp            # plugin:game-sns:game-sns を選んでログイン（ブラウザで承認）
```

使い方: `/game-sns:new 星を集めるジャンプゲーム` / `/game-sns:pull <app_id>` / `/game-sns:check` / `/game-sns:push 操作説明を足した`。
リミックスと提案: `/game-sns:remix <ゲームのページの URL>` / `/game-sns:propose 敵を追加` / `/game-sns:proposals`。
提案を開く・取り下げる・コメントする・マージするは相手に届くので、Claude Code はそのたびに確認します（許可ルールでも省けません）。
更新は `/plugin marketplace update game-sns`。

## Codex

```text
codex plugin marketplace add moontechnica/game-sns-creator-kit
codex plugin add game-sns@game-sns
codex mcp login game-sns
# Codex で新しいセッションを始める
```

Codex の中の `/plugins` からも入れられます。更新は `codex plugin marketplace upgrade game-sns`。

送信前の検査の hook は、`/hooks` で信頼するまで動きません（信頼しなくても `game-sns-push` の手順で検査します）。
Skills は `$game-sns-new` / `$game-sns-pull` / `$game-sns-push` / `$game-sns-remix` / `$game-sns-propose` / `$game-sns-proposals` で呼べます。

**提案を開く・取り下げる・コメントする・マージするを承認制にしてください。** Codex はプラグインからこの設定を受け取れないので、
`~/.codex/config.toml` に次を足します（`node <kit>/scripts/kit.mjs codex-config` でも同じものが出ます）:

```toml
[plugins."game-sns@game-sns".mcp_servers.game-sns]
default_tools_approval_mode = "writes"

[plugins."game-sns@game-sns".mcp_servers.game-sns.tools.open_proposal]
approval_mode = "approve"

[plugins."game-sns@game-sns".mcp_servers.game-sns.tools.close_proposal]
approval_mode = "approve"

[plugins."game-sns@game-sns".mcp_servers.game-sns.tools.comment_proposal]
approval_mode = "approve"

[plugins."game-sns@game-sns".mcp_servers.game-sns.tools.merge_proposal]
approval_mode = "approve"
```

## その他のエージェント

1. Kit を置く: `git clone https://github.com/moontechnica/game-sns-creator-kit ~/game-sns-creator-kit`
   （Kit の root は `~/game-sns-creator-kit/plugins/game-sns`）
2. Skills を置く: エージェントの Skills の置き場（例: `.agents/skills/`）に
   `plugins/game-sns/skills/*` をリンクする。知識だけでよければ `npx skills add moontechnica/game-sns-creator-kit` でも入ります
   （その場合、送信には 1. の Kit が要ります。Skill が Kit の場所を尋ねます）
3. MCP を登録する: Streamable HTTP・OAuth で `https://game-sns-seven.vercel.app/mcp/creator`
   （OAuth の callback のポートを固定できるクライアントなら `43125`）
4. エージェントの MCP の画面からログインする

## 別の環境の Platform に繋ぐ

Claude Code では環境変数 `GAME_SNS_MCP_URL` で MCP の URL を差し替えられます
（例: ローカル開発 `http://localhost:4042/mcp/creator`）。

## ライセンス

このリポジトリの内容は **MIT No Attribution（MIT-0）** です（[`LICENSE`](LICENSE)）。
Skills のサンプルコードなど、Kit の内容をあなたのゲームへコピーしても著作権表示は要りません。

- `plugins/game-sns/scripts/kit.mjs` に同梱している npm パッケージは、それぞれのライセンスに従います
  （[`plugins/game-sns/THIRD_PARTY_NOTICES.md`](plugins/game-sns/THIRD_PARTY_NOTICES.md)）。
- `sdk/` に展開される SDK は Platform から取得するもので、このリポジトリのライセンスの対象外です
  （同梱の three.js は MIT）。
- 「game-sns」の名称・ロゴの使用は許諾していません。
