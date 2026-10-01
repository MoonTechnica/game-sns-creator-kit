---
name: tokoyo-propose
description: リミックスした TOKOYO.games のゲーム（fork）の変更を本流（リミックス元）へ提案する（GitHub の Pull Request）。提案への返事・直し・取り下げも行う。Platform MCP（tokoyo）の get_app / open_proposal / get_proposal / comment_proposal / update_proposal / close_proposal を使う。「本流に提案して」「作者に送って」「PR を出して」「提案のコメントに返事して」のときに使う。propose, pull request, contribute.
---

# 本流へ提案する

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。手順・エラーの正本は
**`<kit>/profile/instructions.md` §8.6**。要点:

1. `get_app({ app_id })`。`upstream` が無ければリミックスではないので提案できない。
   `proposals.from_me` に開いている提案があれば、新しく開かずに 4. へ。
2. **提案できるのは fork の公開済みの版だけ**。`published_version_id` が null か、送った変更がまだ公開されていなければ、
   `editor_url` を利用者に渡して「公開（限定公開でよい）」を頼み、公開されるまで待つ（公開は利用者だけができる）。
3. `open_proposal({ app_id, title, body, discussion_id? })`（題名 100 文字・説明 2000 文字まで。説明には何を変えたか・なぜかを書く）。
   応える話題があれば `discussion_id` を渡す（作者の「手を貸してほしい」はマージで閉じる）。
   fork で頼んだ文（チャットの依頼）は既定で提案に添えられ、公開ページに出る。利用者が見せたくなければ `include_requests: false`。
   **クライアントが利用者に確認を求める**。断られたらそれ以上押さない。返った `url` を利用者に伝える。
4. 返事を見る: `get_proposal({ proposal_id })` のコメントを読む。直すなら作って `$tokoyo-push` → 公開を頼む →
   `update_proposal({ proposal_id, proposed_version_id: <新しい公開版> })`。返事は `comment_proposal`（確認が出る）。
5. 取り下げるときは `close_proposal`（確認が出る）。
6. 返事やマージの結果は `list_notifications({ unread_only: true })` で届く（`proposal_commented` / `proposal_merged` /
   `proposal_declined` / `contribution_published`）。読んだら `mark_notifications_read`。
