# ドリフトいっぽん

タップでジャンプ → 長押しでドリフト → はなしてミニターボ。カーブの出口でピタッとはなすとパーフェクトになる、ポップな疑似3Dドリフトレース(ニコ生ランキングゲーム)。
自作ゲームパーティー2026冬「レース・ドライブ部門」に応募する作品。

- コース3種(サーキット・マグマ城・山道)とドライバー10種(動物)は、ゲームごとにランダム
- ドリフトの段は8つ(ド〜ド)。`LV_SEC` 秒ごとに1段上がる
- ドリフトしているあいだだけ曲がる(`TURN`・`DRIFT_IN`)。しないとカーブの外へ押される(`PUSH`)。点数はカーブの中でドリフトした長さで決まる
- コースは短い直線と、1〜4個つづくS字カーブ(短い・ふつう・長い)のくり返し
- 調整用の数字は `src/main.ts` の上にまとめてある

## 作り直し
- 画像: `node tools/gen-images.js` のあと `python3 tools/shrink.py`(256色にへらして軽くする)
- アイコン・紹介画像: `node tools/gen-brand.js`(アイコンはそのあと `ffmpeg -i icon.png -vf format=rgb24` で透過なしにする)
- 音: `python3 tools/gen-audio.py`(効果音は se_ をつける)
- 素材を足したら `npx akashic scan asset` して、bgm_c・bgm_k・bgm_m を systemId "music"・loop true に直す
- 投稿用 zip: `npx akashic export zip -o ../dist/drift-ippon.zip --nicolive -f`
