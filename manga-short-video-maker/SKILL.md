---
name: manga-short-video-maker
description: 漫画・イラスト素材とCSV台本から、VOICEVOXの複数話者音声・画像のズーム/パン・字幕・効果音・エフェクト・BGMを組み合わせてYouTube Shorts用の縦動画(1080x1920/30fps/H.264/AAC)を自動生成する。ユーザーが「このフォルダの台本と画像から漫画紹介Shortsを作って」「sample_projectを使って動画を生成して」「VOICEVOX音声だけ先に生成して」「字幕と仮動画まで作って」「エフェクトを弱めて再書き出しして」のように言ったとき、または用意済みのproject.yamlとscript.csvから漫画紹介ショート動画を組み立てたいときに使う。外部の有料APIやネット取得は使わず、ユーザーが用意した使用許諾のある素材だけを使う。macOS + Python 3.11以上 + FFmpeg + VOICEVOX Engineを前提とする。
---

# manga-short-video-maker

漫画・イラスト素材と台本(CSV)から YouTube Shorts 用の縦動画を自動生成するスキル。

## このスキルができること

- VOICEVOX で 3 人以上のキャラクター音声を生成（話者名・スタイル名から speaker ID を自動解決）
- 画像を 1080×1920 の縦画面へ配置（`contain_blur` / `cover` / `contain_black`）
- ズーム・パン（zoom_in / zoom_out / pan_* / face_zoom / random_slow）
- エフェクト（flash / shake / soft_glow / blur / vignette / darken / red_tint / blue_tint / speed_lines / glitch）
- 音声と完全同期する ASS 字幕（下寄り・最大 2 行・白文字太縁・句読点優先改行）
- 効果音の配置、BGM のループ・フェード・簡易ダッキング
- ラウドネス調整（約 -14 LUFS）付きで **1080×1920 / 30fps / H.264 / AAC** の MP4 を書き出し
- 出力を ffprobe で自動検証し、制作レポート（JSON / Markdown）と投稿用テキストを出力

## 必要な環境

- macOS
- Python 3.11 以上
- FFmpeg / ffprobe
- VOICEVOX Engine（既定 `http://127.0.0.1:50021`）
- Python ライブラリ: PyYAML（`pip install -r requirements.txt`）

未導入時は導入コマンドを表示するだけにとどめ、**許可なくインストールは実行しない**。

```bash
brew install ffmpeg          # FFmpeg / ffprobe
brew install python@3.11     # 必要に応じて
# VOICEVOX は https://voicevox.hiroshiba.jp/ から入手し、アプリを起動しておく
```

## 入力ファイル

プロジェクトフォルダ直下に置く。

- `project.yaml` … 動画・音声・字幕・音量・編集の設定（`templates/project.yaml` 参照。省略項目はデフォルト補完）
- `script.csv` … 1 行 = 1 セリフ/ナレーション（列は `templates/script.csv` 参照）
- `images/` … 使用画像（`script.csv` の `image` 列で参照）
- `audio/` … 生成された VOICEVOX 音声（自動生成）
- `bgm/` … BGM（任意。最初の音声ファイルを使用）
- `sfx/` … 効果音（`sfx` 列で参照）
- `cache/` … 中間ファイル・音声キャッシュ
- `output/` … 完成動画・字幕・レポート・投稿用テキスト

任意で `reading_dict.json`（読み仮名・固有名詞辞書、`{"表記":"よみ"}`）を置ける。

## 標準的な制作手順

1. `python scripts/validate_project.py <project>` で素材と環境を点検
2. VOICEVOX Engine を起動
3. `python scripts/build_video.py <project>` で全工程を実行
4. `output/*.mp4` を確認し、必要なら設定を変えて再書き出し
5. `output/youtube_title.txt` / `youtube_description.txt` を投稿に使用

## Claude Code がユーザーへ確認すべき項目

まず **フォルダを検査** し、`project.yaml` / `script.csv` / 各素材から判断できることは質問しない。軽微な不足はデフォルト値で補う。以下のように **判断できないときだけ** 確認する。

- プロジェクトフォルダの場所が不明なとき（候補が複数）
- 素材の**使用許諾**が不明なとき（→「権利確認」参照）
- VOICEVOX の話者/スタイル指定が台本に無く、既定も定めにくいとき
- エフェクトの強弱など、仕上がりの好みが結果を大きく変えるとき

## 実行コマンド

```bash
# 全工程
python scripts/build_video.py <project>

# 検証のみ（--check-voicevox で Engine 起動も確認）
python scripts/validate_project.py <project> --check-voicevox

# 音声のみ
python scripts/generate_voice.py <project>

# 字幕のみ
python scripts/generate_subtitles.py <project>
```

主なオプション: `--force`（音声キャッシュ無視）/ `--skip-voice` / `--skip-bgm` / `--preview`（540×960 高速・先頭15秒）/ `--debug`（中間ファイル保持）/ `--start-id 010` / `--end-id 030`

## 呼び出し例と対応

- 「このフォルダの台本と画像から漫画紹介Shortsを作って」→ フォルダを検査し `build_video.py`
- 「sample_projectを使って動画を生成して」→ `build_video.py sample_project`
- 「VOICEVOX音声だけ先に生成して」→ `generate_voice.py <project>`
- 「字幕と仮動画まで作って」→ `generate_subtitles.py` ののち `build_video.py --preview`
- 「エフェクトを弱めて再書き出しして」→ `project.yaml` の `editing`/`audio` や `script.csv` の `effect` を調整して再実行（音声キャッシュは再利用される）

## エラー時の対応

日本語メッセージを表示し、可能な限り処理を継続する。

- FFmpeg / ffprobe が無い → `brew install ffmpeg` を案内（自動実行しない）
- VOICEVOX Engine 未起動 → アプリ起動を案内（接続先も表示）
- 話者/スタイルが見つからない → 話者は中止、スタイルは同キャラの先頭スタイルへ自動フォールバック＋警告
- 画像/効果音/BGM が無い → エラー終了せず不足一覧に記録して継続（**全画像欠落や台本欠落は中止**）
- CSV の必須列欠落・文字コード不正・音声/結合の失敗 → 具体的な行や原因を表示

## 再書き出し方法

- `project.yaml` で解像度・字幕・音量・エフェクト初期値を変更
- `script.csv` で行ごとの `motion` / `effect` / `sfx` / `duration_override` を変更
- 音声を変えていなければ `--skip-voice` で高速に再書き出し（音声キャッシュも自動再利用）
- まず `--preview` で確認 → 問題なければ本書き出し

## 使用素材の権利確認

- **ユーザーが用意した、使用許諾のある素材だけ** を使う
- インターネットから画像・漫画を自動取得しない
- 権利が不明な素材は使わず、ユーザーに確認する
- VOICEVOX 音声は各キャラクターの利用規約に従う（クレジット表記が必要な場合がある）

## 完成動画のチェック項目

自動検証で確認する: 解像度 1080×1920 / 30fps / 映像 H.264 / 音声 AAC / 音声トラック有り / 尺が 0 秒でない / 出力に一時ファイルが混ざっていない。加えて目視で、字幕が画面内か・重要部分に被っていないか・音量バランス・エフェクトの強さを確認する。

詳細は `README.md`、制限事項は README の「制限事項」を参照。
