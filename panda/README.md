# まもれ！パンダ城

迷彩服のどうぶつたちを配置して、パンダの王様のお城を敵からまもるタワーディフェンス(ニコ生ランキングゲーム)。

- 画像: `node tools/gen-images.js`(どうぶつ・敵・お城・背景・ロゴ・アイコン)。アイコンはそのあと `ffmpeg -i icon.png -vf format=rgb24 out.png` で透過なしにする
- 道の形: `tools/course.json`(src/main.ts の PATHS と同じにする)
- 紹介画像: `node tools/gen-promo.js`(素材は tools/promo-shot/ のプレイ画面)
- 音: `python3 tools/gen-audio.py`
- 素材を足したら `npx akashic scan asset` して、bgm を systemId "music"・loop true に直す
