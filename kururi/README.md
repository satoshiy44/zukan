# くるりグラビティ

盤を90度回して重力の向きを変える、落ちもの×回転のパズル(ニコ生ランキングゲーム)。

- 画像(タイル・盤・ボタン・背景・ロゴ): `node tools/gen-images.js`
- アイコン・紹介画像: `node tools/gen-brand.js`(アイコンはそのあと `ffmpeg -i icon.png -vf format=rgb24` で透過なしにする)
- 音: `python3 tools/gen-audio.py`
- 素材を足したら `npx akashic scan asset` して、bgm を systemId "music"・loop true に直す
