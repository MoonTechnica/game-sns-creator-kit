---
name: tokoyo-propose
description: TOKOYO.gamesの自分のfeatの変更を同じゲームのmainへ提案する。提案への返事・直し・取り下げも行う。Platform MCPのget_app / open_proposal / get_proposal / comment_proposal / update_proposal / close_proposalを使う。
---

# 本流へ提案する

作業ディレクトリ（`.tokoyo.json` のあるところ）で行う。手順・エラーの正本は
**`<kit>/profile/instructions.md` §8.6**。要点:

1. `get_app({ app_id })` と `.tokoyo.json` で自分のsession_idを確認する。
   `proposals.from_me` に開いている提案があれば、新しく開かずに 4. へ。
2. **提案できるのは自分のfeatの検証済みhead**（公開しなくてよい。編集者はその版を試遊できる）。
   `latest_proposable_version_id` が null か、送った変更がまだ `ready` になっていなければ、`$tokoyo-push` して
   `get_build` が `ready` になるのを待つ。
3. `open_proposal({ app_id, session_id, title, body, discussion_id? })`（題名100文字・説明2000文字まで。何を変えたか・なぜかを書く）。
   応える話題があれば `discussion_id` を渡す（作者の「手を貸してほしい」はマージで閉じる）。
   自分のfeatの依頼文を公開提案に添える設定も確認する。見せたくなければ `include_requests: false`。
   **クライアントが利用者に確認を求める**。断られたらそれ以上押さない。返った `url` を利用者に伝える。
4. 返事を見る: `get_proposal({ proposal_id })` のコメントを読む。直すなら作って `$tokoyo-push` → `ready` を待つ →
   `update_proposal({ proposal_id, proposed_version_id: <新しい検証済みの版> })`。返事は `comment_proposal`（確認が出る）。
5. 取り下げるときは `close_proposal`（確認が出る）。
6. 返事やマージの結果は `list_notifications({ unread_only: true })` で届く（`proposal_commented` / `proposal_merged` /
   `proposal_declined` / `contribution_published`）。読んだら `mark_notifications_read`。
