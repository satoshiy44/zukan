# かたぬきダッシュ

ダンボールの板にくりぬかれた角刈りの型に合わせて走りぬける、擬似3Dのドット絵ランニングゲーム(ニコ生ランキングゲーム)。

- 画像: `node tools/gen-images.js`(ドット絵・ロゴ・アイコン)
- 紹介画像: `node tools/gen-promo.js`(素材は tools/promo-shot/ のプレイ画面)
- 音: `python3 tools/gen-audio.py`
- 素材を足したら `npx akashic scan asset` して、bgm を systemId "music"・loop true に直す
