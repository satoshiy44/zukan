# zukan — YAML → VOICEVOX → ffmpeg パイプライン

台本(YAML/CSV)から **VOICEVOX** で音声を合成し、**ffmpeg** で
「音声結合 ＋ 字幕(ASS)焼き込み ＋ BGM/SE 合成」までを一気通貫で行う、
純コードの音声/動画生成パイプライン。YMM4(`.ymmp`)を介さずコードだけで完結する。

```
script.yaml ──▶ VOICEVOX(localhost:50021) ──▶ 各行 WAV
                                              │
              タイムライン計算(開始/終了秒) ─┤
                                              ├─▶ 字幕(ASS/SRT)生成
              ffmpeg ◀───────────────────────┘
                └─ ナレーション結合 + SE + BGM合成 + 字幕焼き込み ─▶ output.mp4
```

## 必要なもの

- **Python 3.10+**（依存は `PyYAML` と `requests` のみ）
- **VOICEVOX**（アプリ or Docker）が `http://127.0.0.1:50021` で起動していること
- **ffmpeg / ffprobe**（Mac は `brew install ffmpeg`）

```bash
pip install -r requirements.txt      # もしくは pip install -e .
```

## クイックスタート

```bash
# 0) 環境の疎通確認(VOICEVOX と ffmpeg が見えているか)
python -m zukan doctor

# 1) 話者IDを調べる
python -m zukan speakers

# 2) まずコマンドだけ確認(VOICEVOX/ffmpeg を実行しない)
python -m zukan build examples/sample_script.yaml --dry-run

# 3) 実際に生成
python -m zukan build examples/sample_script.yaml
#   → output/sample.mp4
```

出力の拡張子で形式が決まる：`.mp4`（動画・字幕焼き込み）/ `.wav` `.mp3`（音声のみ）。

## 台本フォーマット（YAML）

```yaml
title: "デモ"
output: "output/demo.mp4"

defaults:            # 全行に効く既定値(行側で上書き可)
  speaker: 3         # 話者ID(`python -m zukan speakers` で確認)
  speed: 1.0
  post_gap: 0.35     # 各行の後ろの無音(秒)

video:
  width: 1920
  height: 1080
  fps: 30
  background: "#101820"   # 単色、または画像/動画パス(assets/bg.png 等)
  tail: 1.0

subtitle:
  font: "Noto Sans CJK JP"
  font_size: 64
  primary_color: "#FFFFFF"
  outline_color: "#101820"
  outline: 4

bgm:                 # 任意。`bgm: "assets/bgm.mp3"` の短縮記法も可
  path: "assets/bgm.mp3"
  volume: 0.12
  fade_out: 1.5

lines:
  - text: "こんにちは、ずんだもんなのだ。"
  - text: "本文と字幕を分けたいときは subtitle を書くのだ。"
    subtitle: "本文と字幕は分けられる"
    se: "assets/se/pon.wav"      # 行頭で鳴らす効果音
  - text: "話者や速度は行ごとに変えられるのだ。"
    speaker: 1
    speed: 1.1
  - "文字列だけの行も書けるのだ。"
```

行で指定できるキー：
`text` / `speaker` / `speed` / `pitch` / `intonation` / `volume` /
`subtitle` / `pre_gap` / `post_gap` / `se` / `se_volume`。

### CSV 台本（簡易）

`text` 列は必須。`speaker,speed,se,subtitle,post_gap` は任意。

```csv
text,speaker,speed,se,subtitle,post_gap
こんにちは、ずんだもんなのだ。,3,1.0,,,0.35
効果音も付けられるのだ。,3,1.0,assets/se/pon.wav,,0.35
```

## 環境設定（config.yaml）

接続先やバイナリのパスは `config.yaml`（`config.example.yaml` をコピー）で指定する。
環境変数（`VOICEVOX_URL` / `FFMPEG_BIN` / `FFPROBE_BIN` / `ZUKAN_WORK_DIR`）があれば優先される。

## 仕組み（モジュール構成）

| モジュール | 役割 |
|---|---|
| `script_loader.py` | YAML/CSV 台本 → `Script` モデル（検証つき） |
| `voicevox.py` | VOICEVOX API クライアント（`audio_query` → `synthesis`） |
| `timeline.py` | 合成 WAV の尺から各行の開始/終了秒を計算（`wave` 標準ライブラリ） |
| `subtitles.py` | `Segment` 列 → ASS / SRT 字幕を生成 |
| `audio.py` | ffmpeg コマンド構築（純関数）＋ 実行 |
| `pipeline.py` | 上記を順に束ねるオーケストレーション |

- 合成音声は本文＋話者のハッシュで **キャッシュ**（`--no-cache` で無効化）。
- ffmpeg コマンド構築は副作用のない純関数なので **単体テスト**で検証している。

## テスト

```bash
pip install pytest
pytest            # タイムライン/字幕/コマンド構築/台本ロードを検証(27ケース)
```

VOICEVOX と ffmpeg に依存しないロジックをカバーしているので、
実バイナリが無い環境（CI 等）でも実行できる。

## 中間ファイル

`.zukan_work/`（`config.yaml` の `work_dir`）に合成 WAV・`narration.wav`・
`subtitles.ass` / `.srt` が残る。デバッグや字幕の外部利用に使える。
