# さぼこ落としゲーム

さぼこを落として、同じ段階同士をくっつけて育てる落ちものパズルのプロトタイプです。
全12段階。`index.html` をブラウザで開くだけで動きます（サーバ不要・オフライン可）。

**当たり判定は絵の形そのまま**です。丸ではないので、横長の子は横に転がり、
でこぼこした子は引っかかって積み上がります。

## 遊び方

- マウス／指を左右に動かして、クリック（タップ）で落とす
- キーボードは `←` `→` で移動、`Space` / `↓` / `Enter` で落とす
- 同じさぼこ同士が触れると、1段階大きいさぼこになる
- 最大の「ラスボス犬」同士をくっつけると、消えて 100 点ボーナス
- 点線より上にさぼこが 2 秒居座るとゲームオーバー

## ファイル構成

```
index.html               画面（この1枚を開けば動く）
style.css                見た目
game.js                  ゲーム本体
audio.js                 効果音とBGM
assets/src/*.png         さぼこの元画像を置く場所
assets/audio/*.mp3       BGM・効果音を置く場所（→ assets/audio/README.md）
assets/sounds.js         音声ファイルを埋め込んだもの（自動生成）
assets/shapes.js         元画像から生成した「形」と画像データ（自動生成）
tools/build-assets.mjs   src の画像から shapes.js を作るツール
tools/build-audio.mjs    audio の音声から sounds.js を作るツール
tools/bundle.mjs         全部を1枚のHTMLにまとめる（dist/saboko-drop.html）
vendor/                  Matter.js と poly-decomp（どちらも MIT・同梱済み）
```

## 素材の入れかた

`assets/src/` に `saboko_1.png` 〜 `saboko_12.png` を置いて、

```
npm install          # 最初の1回だけ
npm run build:assets
```

素材・音・配布ファイルをまとめて作り直すなら `npm run build` です。

背景が透明な PNG なら、正方形でなくても余白があっても構いません。
透明部分の切り落とし・輪郭の抽出・縮小はビルドが全部やります。
素材が無い段階は仮の丸のままなので、1枚ずつ差し替えていけます。

詳しい条件は `assets/README.md` を参照。

## 当たり判定の確認

`index.html?debug` で開くと、当たり判定の輪郭がオレンジで重なって表示されます。

## 調整するときに触る場所

`game.js` の先頭にまとまっています。

| 変数 | 内容 |
|---|---|
| `TIERS` | 12段階の大きさ（`r` = 面積の基準になる半径）・色・名前 |
| `POINTS` / `CLEAR_BONUS` | 合体時の得点 |
| `SPAWN_TIERS` | 落ちてくるさぼこの種類数（現在は小さいほうから5種） |
| `DEATH_Y` / `OVER_LIMIT` / `OVER_GRACE` | ゲームオーバーの厳しさ |
| `DROP_COOLDOWN` | 連続で落とせる間隔 |
| `W` / `H` | 盤面の広さ |

物理の手触り（跳ね返り・摩擦）は `makeBall()` の `restitution` / `friction` あたりです。

## 音

`assets/audio/` に音声ファイルを置いて `npm run build:audio` を走らせると、
それが鳴ります。置いていないぶんはWebAudioで合成した音で代用するので、
ファイルが1つも無くても音は出ます（BGMだけ差し替える、も可）。

ファイル名と容量の目安は `assets/audio/README.md` を参照。
合成音のほうを変えたい場合は `audio.js` の先頭（BPM・コード進行・合体音の音階）です。

画面右上のボタンで消せます（設定はブラウザに残ります）。

## 画面に出さないもの

次に何が出てくるかは NEXT の1個先までしか見せていません。
段階の一覧（進化表）はネタバレになるので画面に置いていません。

## 未実装（プロトタイプの範囲外）

- タイトル画面、演出、リザルト共有
- スコアのオンラインランキング
