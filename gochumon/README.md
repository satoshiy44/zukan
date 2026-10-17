# ご注文をどうぞ！

ニコニコ生放送「ニコ生ゲーム」のランキングモード専用ゲームです。
先頭のお客さんが注文した1〜5品を見て、同じ料理の小皿をタップします。
選んだ料理がトレーに並び、注文の全品がそろうと会計して次のお客さんへ交代します。

## ゲーム仕様

- Akashic Engine v3 / TypeScript
- 1280×720 / 30fps
- 制限時間：60秒（`param.sessionParameter.totalTimeLimit` を優先）
- 開始説明：6秒（後半3秒はカウントダウン）
- 終了処理：残り3秒で操作と進行を停止
- スコア：整数の合計金額を `g.game.vars.gameState.score` に随時反映
- 正しい料理：トレーへ追加
- 注文の全品をトレーへ追加：料理代の合計＋連続会計ボーナスを加算
- 会計後：先頭のお客さんが退場し、次のお客さんが1〜5品を注文
- 間違った料理：100円減点、連続ボーナスをリセット

## 開発と確認

```sh
npm install
npm run build
npm test -- --runInBand
npm start
```

素材を作り直す場合は Python 3 と Pillow が必要です。
音声のエンコードにはプロジェクトに含まれる FFmpeg パッケージを使います。

```sh
npm run assets
npx akashic scan asset
npm run build
```

素材を再スキャンした場合は、`game.json` のBGM設定が次の状態か確認してください。

```json
"systemId": "music",
"loop": true
```

## 投稿用ZIPの作成

`game.json` の `environment` に以下が入っていることを確認します。

```json
"akashic-runtime": {
  "version": "~3.13.4-0",
  "flavor": "-canvas"
}
```

その後、指定のコマンドで書き出します。

```sh
npx akashic export zip -o game.zip --nicolive -f
```

同じ処理は `npm run export-zip` でも実行できます。

## 素材

- `image/`：ゲーム内画像（すべて自作）
- `art_sources/`：オリジナル背景・人物・紋章の生成元と使用プロンプト
- `audio/`：BGM・効果音の `.ogg` / `.aac`（すべて自作）
- `tools/make_assets.py`：画像・音声波形の生成スクリプト
- `tools/make_assets.mjs`：FFmpegを呼び出す素材生成ランナー
- `icon.png`：投稿用アイコン（256×256、100KB以下）
- `promo.png`：投稿用紹介画像（1280×720、5MB以下）

美術は、セピア色の古い欧州カフェと手描き水彩の絵本を軸にした独自デザインです。
既存作品のキャラクター、ロゴ、固有意匠は使用していません。
