---
description: 送る前の検査（Platform と同じ検証器の取り込み + 静的検証）を手元で走らせる
---

作業ディレクトリ（`.tokoyo.json` のあるところ）で、変更を `git commit` し `node <kit>/scripts/kit.mjs pack` を実行してから
`node <kit>/scripts/kit.mjs check` を実行し、結果を利用者に短く伝える（`<kit>` は `.tokoyo.json` の `kit_root`）。
落ちた項目があれば直し方を示す。通っても Platform 側の検証（動的検証を含む）は送信のたびに必ず走る。
