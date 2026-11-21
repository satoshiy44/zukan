# 100万円カード爆買い！

ATMで100万円をおろし、架空のカードショップでパック5種(30種から)とボックス3個(8種から)を選ぶと、100万円を使い切るまで安い順に1つずつ均等にまとめ買い(だいたい150〜250枚)。ぜんぶいっせいに開封。買取総額がスコアになるニコ生ランキングゲーム。

- 流れ: atm(2.8秒) → front(2.8秒) → packs(最大20秒) → boxes(最大14秒) → cart(2.8秒) → black(1.3秒) → opening(12秒) → appraisal。制限時間の5秒前に止める
- データ(モンスター20体・レアリティ20段階・パック30種・ボックス8種)は `tools/data.js`。`node tools/make-data.js` で `src/data.ts` を作り、`npx eslint src --fix` で整える
- 確率: レアリティの重み × exp(luck × `LUCK_K` × 段)、ミラクル以上はさらに × exp(chaos × `CHAOS_K` × (段-11))。ホイル12%で×1.35、エラーは `ERR_BASE`+chaos×`ERR_CHAOS`(0.0002+chaos×0.0002、1プレイに出るのは5〜9%くらい)で ×8〜12
- 実在のカードゲーム・お店・ロゴ・キャラクターは使っていない。モンスターは `tools/gen-images.js` で描いたオリジナル

## 作り直し
- 画像: `node tools/gen-images.js` のあと `python3 tools/shrink.py`
- アイコン・紹介画像: `node tools/gen-brand.js`(アイコンは ffmpeg の palettegen/paletteuse で256色にして、`-vf format=rgb24` で透過なし)
- 音: `python3 tools/gen-audio.py`(効果音は se_ をつける)
- 素材を足したら `npx akashic scan asset` して、bgm_shop・bgm_open を systemId "music"・loop true、se_* を systemId "sound" に
- 投稿用 zip: `npx akashic export zip -o ../dist/card-bakugai.zip --nicolive -f`
