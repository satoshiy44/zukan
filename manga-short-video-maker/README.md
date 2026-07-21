# manga-short-video-maker

漫画・イラスト素材と CSV 台本から、**YouTube Shorts 用の縦動画（1080×1920 / 30fps / H.264 / AAC の MP4）** を自動生成する Claude Code 用スキルです。VOICEVOX で複数話者の音声を生成し、画像のズーム/パン・字幕・効果音・エフェクト・BGM を組み合わせます。

- 外部の有料 API は使いません。
- インターネットから画像や漫画を自動取得しません。
- **ユーザーが用意した、使用許諾のある素材だけ** を使います。

## 目次

- [動作環境](#動作環境)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [ディレクトリ構成](#ディレクトリ構成)
- [入力ファイル](#入力ファイル)
  - [project.yaml](#projectyaml)
  - [script.csv](#scriptcsv)
- [コマンドとオプション](#コマンドとオプション)
- [処理の流れ](#処理の流れ)
- [モーションとエフェクト](#モーションとエフェクト)
- [字幕](#字幕)
- [音声・BGM・音量](#音声bgm音量)
- [出力物](#出力物)
- [台本テンプレート](#台本テンプレート)
- [テスト](#テスト)
- [制限事項](#制限事項)
- [トラブルシューティング](#トラブルシューティング)

## 動作環境

- macOS
- Python 3.11 以上
- FFmpeg / ffprobe
- VOICEVOX Engine（既定 `http://127.0.0.1:50021`）
- Python ライブラリ: **PyYAML**（それ以外は標準ライブラリのみ）

## インストール

未導入のものがあれば、以下を **手動で** 実行してください（スキルは許可なくインストールしません）。

```bash
# FFmpeg / ffprobe
brew install ffmpeg

# Python 依存
python3 -m pip install -r requirements.txt

# VOICEVOX
# https://voicevox.hiroshiba.jp/ からダウンロードし、アプリ（Engine）を起動しておく
```

導入確認:

```bash
ffmpeg -version
ffprobe -version
curl http://127.0.0.1:50021/version   # VOICEVOX Engine が起動していれば版番号が返る
```

## クイックスタート

```bash
# 1. 環境と素材を点検（VOICEVOX 起動確認も行う）
python scripts/validate_project.py sample_project --check-voicevox

# 2. 全工程を実行（VOICEVOX Engine を起動しておくこと）
python scripts/build_video.py sample_project

# 3. まず軽量プレビューで確認したい場合
python scripts/build_video.py sample_project --preview
```

完成動画は `sample_project/output/` に出力されます。

> `sample_project/images/` のプレースホルダ画像は動作確認用です。**本番では使用許諾のある画像に差し替えてください。** 画像を作り直す場合は `python3 sample_project/images/_generate_placeholders.py`。

## ディレクトリ構成

```text
manga-short-video-maker/
├── SKILL.md               # スキル定義（Claude Code が読む）
├── README.md              # このファイル
├── requirements.txt
├── scripts/
│   ├── build_video.py       # 全工程の統括
│   ├── generate_voice.py    # VOICEVOX 音声生成
│   ├── generate_subtitles.py# ASS 字幕生成
│   ├── validate_project.py  # 事前検証のみ
│   └── utils.py             # 共通処理（設定・CSV・ffprobe・コマンド生成 等）
├── templates/
│   ├── project.yaml
│   ├── script.csv
│   └── title_templates.txt
├── sample_project/
│   ├── project.yaml
│   ├── script.csv
│   ├── images/  audio/  bgm/  sfx/  cache/  output/
└── tests/
    └── test_manga_short.py
```

## 入力ファイル

### project.yaml

作品全体の設定。省略した項目は安全なデフォルト値で自動補完されます。主な項目:

| セクション | 主なキー | 説明 |
|---|---|---|
| `video` | `width/height/fps/video_codec/audio_codec/video_bitrate/pixel_format` | 出力仕様（既定 1080×1920/30fps/libx264/aac/yuv420p） |
| `video` | `fit_mode` | `contain_blur`(既定) / `cover` / `contain_black` |
| `voicevox` | `engine_url/cache/default_speed/pitch/intonation/volume/pre_/post_phoneme_length` | 音声パラメータ |
| `subtitles` | `font/font_size/max_lines/max_chars_per_line/position_y/outline_width/safe_margin_x/speaker_colors` | 字幕の見た目・位置 |
| `audio` | `bgm_volume/voice_volume/sfx_volume/normalize/target_lufs/true_peak/ducking/bgm_fade` | 音量・ラウドネス |
| `editing` | `default_motion/default_zoom_start/end/minimum_/maximum_scene_duration/random_seed` | 編集初期値 |
| `upload_text` | `title_template/hashtags` | 投稿用テキスト |

`random_slow` モーションは `editing.random_seed` で再現可能です。

### script.csv

1 行 = 1 セリフ / ナレーション単位。列:

`id, section, role, character, voicevox_name, voicevox_style, text, image, motion, effect, sfx, duration_override, subtitle, notes`（任意で `focus_x, focus_y, focus_scale`）

- **id**: 3 桁以上の連番（`001`, `002` …）。必須。
- **section**: `hook / intro / development / climax / ending`
- **role**: `narrator / male / female / other`
- **voicevox_name / voicevox_style**: VOICEVOX のキャラクター名・スタイル名。Engine の `/speakers` から ID を自動解決（**ID はソースへ固定しません**）。スタイルが見つからない場合は同キャラの先頭スタイルへフォールバックし警告。
- **text**: 読み上げ文。`text` にコンマを含める場合は `"..."` で囲みます。読み間違い対策として `reading_dict.json`（`{"表記":"よみ"}`）で置換可能。
- **subtitle**: 空欄なら `text` を字幕に流用。音声と表記を変えたいときに指定。
- **image**: `images/` 内のファイル名。存在しない行は **エラー終了せず** 不足一覧に記録して継続。
- **motion / effect / sfx**: 後述。
- **duration_override**: 指定時のみカット尺を上書き。ただし **音声より短くはなりません**。

## コマンドとオプション

```bash
python scripts/build_video.py <project>          # 全工程
python scripts/validate_project.py <project>     # 検証のみ（--check-voicevox で Engine も確認）
python scripts/generate_voice.py <project>       # 音声のみ
python scripts/generate_subtitles.py <project>   # 字幕のみ
```

`build_video.py` のオプション:

| オプション | 効果 |
|---|---|
| `--force` | 音声キャッシュを無視して再生成 |
| `--skip-voice` | 音声生成をスキップ（既存音声を利用） |
| `--skip-bgm` | BGM を使わない |
| `--preview` | 540×960・低ビットレート・先頭 15 秒・高速書き出し |
| `--debug` | 中間ファイルを残し詳細ログを出力 |
| `--start-id 010` / `--end-id 030` | 処理する行の範囲を id で限定 |

## 処理の流れ

1. 設定読み込み → 2. 素材検証 → 3. VOICEVOX 起動確認 → 4. 話者一覧取得 → 5. 音声生成 → 6. 尺取得(ffprobe) → 7. シーン尺確定 → 8. 縦画面配置 → 9. ズーム/パン → 10. エフェクト → 11. 字幕生成 → 12. 効果音配置 → 13. BGM 配置 → 14. 音量調整 → 15. 結合 → 16. MP4 書き出し → 17. ffprobe 検証 → 18. レポート出力。

再実行に強く（冪等）、途中失敗後もキャッシュ済み音声を再利用します。中間ファイルは `cache/` に置き、完了時に掃除します（`--debug` で保持）。

## モーションとエフェクト

**モーション**（`zoompan` で実装）: `none / zoom_in / zoom_out / pan_left / pan_right / pan_up / pan_down / face_zoom / random_slow`

- 通常カット: 開始 1.00 → 終了 1.08〜1.15 のゆっくりズーム
- 急ズーム: `default_zoom_end` を 1.20〜1.35 に、`duration_override` で 0.15〜0.30 秒に
- `face_zoom`: `focus_x/focus_y/focus_scale`(0〜1 の相対座標＋倍率)で注目位置を指定可能

**エフェクト**: `none / flash / shake / soft_glow / blur / vignette / darken / red_tint / blue_tint / speed_lines / glitch`

すべてのカットに強いエフェクトを掛けないのが基本方針です。目安:

| 場面 | 推奨 |
|---|---|
| 通常 | ゆっくりズーム/パン |
| 驚き | flash + 軽い shake + 急ズーム |
| 不穏 | darken / vignette + 低い効果音 |
| 意味深 | soft_glow + ゆっくりズーム + 心音 |
| クライマックス | ズーム + shake + 衝撃音 |
| 会話 | 話者交代で画角を変更 |

## 字幕

ASS 形式。画面下寄り・最大 2 行・1 行 12〜16 文字・白文字・太い黒縁・セーフエリア内。句読点を優先し、無ければ文節境界で改行します。話者名は通常表示しません。表示時間は音声と完全同期し、空白時間を作りません。絵文字や `{}` `\\` などは除去/無害化して FFmpeg が落ちないようにします。位置・サイズは `project.yaml` の `subtitles` で調整できます。

## 音声・BGM・音量

- **音声**: `audio_query` → 話速/音高/抑揚/音量/前後無音を調整 → `synthesis` → WAV 保存。ファイル名は `001_話者_冒頭.wav` 形式（使用不可文字は除去）。同一（話者・スタイル・文章・設定）はハッシュキャッシュで再生成しません。
- **BGM**: `bgm/` にファイルがある場合のみ使用。動画尺にループ、開始/終了フェード、`ducking: true` で音声区間の自動音量下げ（`sidechaincompress`）。無くても正常に出力します。
- **音量**: 音声最優先、BGM は大幅に小さく、効果音は一瞬。`normalize: true` で約 -14 LUFS / True Peak 約 -1.5 dBTP に調整しクリッピングを防ぎます。

## 出力物

`output/` に生成されます。

- `<output_filename>.mp4` … 完成動画（`--preview` 時は `*_preview.mp4`）
- `subtitles.ass` … 字幕
- `youtube_title.txt` / `youtube_description.txt` … 投稿用テキスト（動画には焼き込みません）
- `build.log` / `build_report.json` / `build_report.md` … ログと制作レポート（総尺・シーン数・話者別セリフ数・使用画像/効果音数・BGM 名・解像度・fps・ファイルサイズ・警告・不足素材・生成日時・実行コマンド）

## 台本テンプレート

`templates/title_templates.txt` に漫画紹介 Shorts 用のタイトル雛形と 60 秒構成を収録。基本構成:

```text
0〜2 秒  : タイトルと同等のフック
2〜8 秒  : 主人公と状況説明
8〜20 秒 : 意味深な出来事
20〜40 秒: 男女の会話と展開
40〜53 秒: 最も強い場面
53〜60 秒: オチ、または続きが気になる終わり
```

固定タグ: `#shorts #漫画 #漫画紹介`

## テスト

VOICEVOX / FFmpeg が無い環境でもモックで動く単体テストを同梱しています。

```bash
python3 -m unittest discover -s tests -v
```

網羅内容: 話者名解決 / スタイル名解決 / CSV 読み込み / 字幕自動改行 / ファイル名安全化 / 画像不足の警告 / キャッシュ判定 / project.yaml デフォルト値 / FFmpeg コマンド生成 / 出力の ffprobe 検証。

## 制限事項

- **エフェクトは FFmpeg 標準フィルタで安定実装できる範囲に限定** しています。以下は簡易版です:
  - `speed_lines`: 本物の集中線ではなく、強い水平モーションブラーで疾走感を表現します。
  - `glitch`: RGB ずらし＋時間ノイズによる簡易表現です。
  - `soft_glow`: 軽いぼかし＋わずかな増光による簡易発光です。
  - `shake`: 周辺 10px を使う控えめな手ぶれ（初期値は弱め）です。
- **顔認識は未使用**です。`face_zoom` は `focus_x/focus_y/focus_scale` で手動指定します（未指定時は中央やや上を注目）。
- 字幕フォントは既定 `Hiragino Sans`（macOS 標準）。他 OS では存在するフォント名に変更してください。
- `zoompan` は静止画を高解像度化してから適用しています。極端な倍率・極端に短い尺では動きがカクつくことがあります。
- ラウドネス調整は 1 パス `loudnorm` です。厳密な 2 パス測定は行いません。
- VOICEVOX の読み精度は Engine 依存です。読み間違いは `reading_dict.json` や `text`/`subtitle` の使い分けで対処します。

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| `FFmpeg が見つかりません` | `brew install ffmpeg` を実行 |
| `VOICEVOX Engine が起動していません` | VOICEVOX アプリ（Engine）を起動。`engine_url` を確認 |
| `指定された話者が見つかりません` | `voicevox_name` を `/speakers` の名称に合わせる |
| スタイルの警告が出る | `voicevox_style` を修正（未修正でも先頭スタイルで継続） |
| `必須列がありません` | `script.csv` の列を `templates/script.csv` に合わせる |
| 画像/効果音/BGM 不足の警告 | 該当ファイルを配置（不足でも可能な範囲で継続） |
| 文字化け/`文字コードが不正` | CSV を UTF-8 で保存 |
| 字幕が表示されない | フォント名を OS に存在するものへ変更 |
| もっと軽く試したい | `--preview` を付ける |
