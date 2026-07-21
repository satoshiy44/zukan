"""パイプライン全体で使うデータモデル。

台本(YAML)をパースした結果をこれらの dataclass に落とし込み、
以降の各ステージ(TTS / タイムライン / 字幕 / ffmpeg)はこの構造だけを見る。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class VoiceParams:
    """VOICEVOX の音声合成パラメータ(1行分)。

    audio_query の返り値を上書きするために使う。None の項目は
    audio_query のデフォルト値をそのまま採用する。
    """

    speaker: int = 3  # 話者ID(3 = ずんだもん/ノーマル が既定)
    speed: float = 1.0  # speedScale
    pitch: float = 0.0  # pitchScale
    intonation: float = 1.0  # intonationScale
    volume: float = 1.0  # volumeScale
    pre_phoneme_length: Optional[float] = None  # 発話前の無音(秒)
    post_phoneme_length: Optional[float] = None  # 発話後の無音(秒)


@dataclass
class Line:
    """台本の1行(=1発話)。"""

    text: str  # 読み上げる本文
    voice: VoiceParams = field(default_factory=VoiceParams)
    subtitle: Optional[str] = None  # 字幕に出す文字(None なら text を使う)
    pre_gap: float = 0.0  # この行の前に挿入する無音(秒)
    post_gap: float = 0.3  # この行の後に挿入する無音(秒)
    se: Optional[str] = None  # 行頭で鳴らす効果音ファイルのパス
    se_volume: float = 1.0  # SE の音量倍率

    @property
    def caption(self) -> str:
        """字幕として表示する文字列。"""
        return self.subtitle if self.subtitle is not None else self.text


@dataclass
class Bgm:
    """BGM 設定。"""

    path: str
    volume: float = 0.15  # ナレーションに対する相対音量
    loop: bool = True  # 尺が足りなければループさせる
    fade_out: float = 1.5  # 末尾のフェードアウト(秒, 0で無効)


@dataclass
class SubtitleStyle:
    """字幕(ASS)の見た目。色は #RRGGBB または #AARRGGBB で受ける。"""

    font: str = "Noto Sans CJK JP"
    font_size: int = 64
    primary_color: str = "#FFFFFF"  # 文字色
    outline_color: str = "#000000"  # 縁取り色
    outline: float = 4.0  # 縁取りの太さ
    shadow: float = 0.0  # 影
    bold: bool = True
    margin_v: int = 80  # 下端からの余白(px)
    alignment: int = 2  # ASS の数値(2 = 下中央)


@dataclass
class VideoConfig:
    """出力動画の基本設定。background は色(#RRGGBB)か画像/動画ファイルのパス。"""

    width: int = 1920
    height: int = 1080
    fps: int = 30
    background: str = "#101820"  # 単色 or 画像/動画パス
    tail: float = 1.0  # 最後の発話後に足す尺(秒)


@dataclass
class Script:
    """台本1本ぶんの全情報。"""

    title: str
    output: str  # 出力ファイルパス(.mp4 / .wav)
    lines: list[Line]
    bgm: Optional[Bgm] = None
    video: VideoConfig = field(default_factory=VideoConfig)
    subtitle_style: SubtitleStyle = field(default_factory=SubtitleStyle)
