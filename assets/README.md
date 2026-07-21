# assets/

台本から参照する素材（BGM・効果音・背景画像/動画）を置く場所。

サンプル台本（`examples/sample_script.yaml`）は以下を参照している：

- `assets/bgm.mp3` … BGM
- `assets/se/pon.wav` … 行頭で鳴らす効果音

これらの音源は各自で用意して同じパスに置くこと（著作権の都合でリポジトリには含めない）。
BGM/SE 無しで試す場合は、台本の `bgm:` と各行の `se:` を消せばよい。
