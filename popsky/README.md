# ぽっぷんスカイ

雲を撃ってベルを出し、ベルを撃って色をかえてパワーアップする、ポップな縦スクロールシューティング(ニコ生ランキングゲーム)。

- 画像: `node tools/gen-images.js`
- アイコン・紹介画像: `node tools/gen-brand.js`(アイコンはそのあと `ffmpeg -i icon.png -vf format=rgb24` で透過なしにする)
- 音: `python3 tools/gen-audio.py`(効果音は se_ をつける)
- 素材を足したら `npx akashic scan asset` して、bgm・boss_bgm を systemId "music"・loop true に直す
