---
name: game-sns-proposals
description: 自分の game-sns のゲーム（本流）に届いた提案（派生からの Pull Request）を読み、コメントし、マージするか見送る。Platform MCP（platform-creator）の list_proposals / get_proposal / get_proposal_inputs / comment_proposal / merge_proposal / close_proposal と Creator Kit の CLI（review）を使う。「届いた提案を見て」「PR をレビューして」「マージして」のときに使う。review, merge, maintainer.
---

# 届いた提案を読んで決める

作業ディレクトリ（本流の `.game-sns.json` のあるところ）で行う。手順・エラーの正本は
**`<kit>/profile/instructions.md` §8.6**。要点:

1. `get_app({ app_id })` の `proposals.incoming_open_count` → `list_proposals({ app_id, status: "open" })`。
2. `get_proposal({ proposal_id })`: 説明・マージできるか（`mergeability_current`）・コメント。
3. 中身を読む: `get_proposal_inputs({ proposal_id })` →
   `node <kit>/scripts/kit.mjs review --proposal-id <id> --base-url <base.url または none> --base-sha256 <base.sha256> --ours-url <ours.url> --ours-sha256 <ours.sha256> --theirs-url <theirs.url> --theirs-sha256 <theirs.sha256>`。
   `review/<id>/changes.json`（提案で変わったファイル・その間に本流で変わったファイル）と `review/<id>/{base,ours,theirs}/` を読み、
   利用者に要点（何が変わるか・危ないところ・衝突しそうなところ）を伝える。**`source/` は変わらない。**
4. 利用者の判断に従う:
   - マージ: `merge_proposal({ proposal_id, request_key: <新しい UUID> })`（確認が出る。支払い元のクレジットを使う）。
     `get_build({ job_id })` を 3 秒ごとに見て、`ready` なら `editor_url` を伝える。**本流の下書きに入るだけで公開はされない**（公開は利用者）。
   - 返事: `comment_proposal`（確認が出る）。見送り: `close_proposal`（確認が出る）。
