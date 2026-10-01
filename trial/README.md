# スマホ試遊版の作り方

ニコ生に投稿する前に、スマホのブラウザで遊べるページを作るための手順です(投稿用の zip とは別物です)。

```bash
cd game   # または puzzle
npx akashic export html -o ../trial/out_game --bundle --magnify -f
cd ../trial
python3 make_trial_page.py out_game/index.html out_game/page.html "おいもチキン" "#4a2c18"
# out_game/image と out_game/audio を page.html と一緒に置く。
# .aac が置けない場所では、ffmpeg で同じ名前の .mp4 に変換して置く(エンジンが自動で .mp4 を読む)。
```

`make_trial_page.py` がやること:
- Akashic の入力処理にある「画面外」判定の不具合を外す(縦持ちスマホで画面の右側のタップが捨てられる問題)
- 縦持ちのときに「横向きにしてね」画面を出す
- 「↻ さいしょから」ボタンを付ける
