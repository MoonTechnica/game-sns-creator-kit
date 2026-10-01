# TOKOYO.games Creator Kit

TOKOYO.games のミニゲームを、**手元の Coding Agent（Claude Code / Codex など）で作る**ための Kit です。
Platform の生成 Agent と**同じ Skills・指示書・SDK**を使い、Platform MCP（`tokoyo`）で
ゲームの取得・送信・素材の生成を行います。送った版は制作画面で試遊・公開できます。

> このリポジトリは TOKOYO.games の本体リポジトリから CI が生成しています。**直接編集しないでください**
> （変更は次の生成で上書きされます）。

## 必要なもの

- Node.js 20 以上、`git` 2.38 以上（`merge-tree --write-tree`）、`tar`（macOS / Linux は標準、Windows 10 以降は `tar.exe`）
- TOKOYO.games の本登録アカウント（ログインは初回にブラウザで行います）

## Claude Code

```text
/plugin marketplace add moontechnica/tokoyo-creator-kit
/plugin install tokoyo-creator@tokoyo-plugins
/mcp            # plugin:tokoyo-creator:tokoyo を選んでログイン（ブラウザで承認）
```

使い方: `/tokoyo-creator:new 星を集めるジャンプゲーム` / `/tokoyo-creator:pull <app_id>` / `/tokoyo-creator:check` / `/tokoyo-creator:push 操作説明を足した`。
リミックスと提案: `/tokoyo-creator:remix <ゲームのページの URL>` / `/tokoyo-creator:propose 敵を追加` / `/tokoyo-creator:proposals`。
提案を開く・取り下げる・コメントする・マージするは相手に届くので、Claude Code はそのたびに確認します（許可ルールでも省けません）。
更新は `/plugin marketplace update tokoyo-plugins`。

## Codex

```text
codex plugin marketplace add moontechnica/tokoyo-creator-kit
codex plugin add tokoyo-creator@tokoyo-plugins
codex mcp login tokoyo
# Codex で新しいセッションを始める
```

Codex の中の `/plugins` からも入れられます。更新は `codex plugin marketplace upgrade tokoyo-plugins`。

送信前の検査の hook は、`/hooks` で信頼するまで動きません（信頼しなくても `tokoyo-push` の手順で検査します）。
Skills は `$tokoyo-new` / `$tokoyo-pull` / `$tokoyo-push` / `$tokoyo-remix` / `$tokoyo-propose` / `$tokoyo-proposals` で呼べます。

**提案を開く・取り下げる・コメントする・マージするを承認制にしてください。** Codex はプラグインからこの設定を受け取れないので、
`~/.codex/config.toml` に次を足します（`node <kit>/scripts/kit.mjs codex-config` でも同じものが出ます）:

```toml
[plugins."tokoyo-creator@tokoyo-plugins".mcp_servers.tokoyo]
default_tools_approval_mode = "writes"

[plugins."tokoyo-creator@tokoyo-plugins".mcp_servers.tokoyo.tools.open_proposal]
approval_mode = "approve"

[plugins."tokoyo-creator@tokoyo-plugins".mcp_servers.tokoyo.tools.close_proposal]
approval_mode = "approve"

[plugins."tokoyo-creator@tokoyo-plugins".mcp_servers.tokoyo.tools.comment_proposal]
approval_mode = "approve"

[plugins."tokoyo-creator@tokoyo-plugins".mcp_servers.tokoyo.tools.merge_proposal]
approval_mode = "approve"
```

## その他のエージェント

1. Kit を置く: `git clone https://github.com/moontechnica/tokoyo-creator-kit ~/tokoyo-creator-kit`
   （Kit の root は `~/tokoyo-creator-kit/plugins/tokoyo-creator`）
2. Skills を置く: エージェントの Skills の置き場（例: `.agents/skills/`）に
   `plugins/tokoyo-creator/skills/*` をリンクする。知識だけでよければ `npx skills add moontechnica/tokoyo-creator-kit` でも入ります
   （その場合、送信には 1. の Kit が要ります。Skill が Kit の場所を尋ねます）
3. MCP を登録する: Streamable HTTP・OAuth で `https://tokoyo.games/mcp/creator`
   （OAuth の callback のポートを固定できるクライアントなら `43125`）
4. エージェントの MCP の画面からログインする

## 別の環境の Platform に繋ぐ

Claude Code では環境変数 `GAME_SNS_MCP_URL` で MCP の URL を差し替えられます
（例: ローカル開発 `http://localhost:4042/mcp/creator`）。

## ライセンス

このリポジトリの内容は **MIT No Attribution（MIT-0）** です（[`LICENSE`](LICENSE)）。
Skills のサンプルコードなど、Kit の内容をあなたのゲームへコピーしても著作権表示は要りません。

- `plugins/tokoyo-creator/scripts/kit.mjs` に同梱している npm パッケージは、それぞれのライセンスに従います
  （[`plugins/tokoyo-creator/THIRD_PARTY_NOTICES.md`](plugins/tokoyo-creator/THIRD_PARTY_NOTICES.md)）。
- `sdk/` に展開される SDK は Platform から取得するもので、このリポジトリのライセンスの対象外です
  （同梱の three.js は MIT）。
- 「TOKOYO.games」の名称・ロゴの使用は許諾していません。
