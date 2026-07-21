"""合成済み各行の「長さ」から動画上の配置(開始/終了秒)を計算する。

VOICEVOX の出力 WAV は標準ヘッダを持つので、尺の取得は標準ライブラリ
wave だけで完結する(ffprobe 不要)。ここは純ロジックなので単体テスト対象。
"""

from __future__ import annotations

import contextlib
import wave
from dataclasses import dataclass
from pathlib import Path

from .models import Line


@dataclass
class Segment:
    """タイムライン上の1行。時刻はすべて秒。"""

    index: int
    start: float  # 発話(=字幕表示)開始
    end: float  # 発話終了
    text: str  # 読み上げ本文
    caption: str  # 字幕文字
    voice_path: str  # 合成済み WAV のパス
    se: str | None = None  # 行頭 SE パス
    se_volume: float = 1.0
    speaker_name: str | None = None  # 字幕の名前表示用(cast のキャラ名)
    color: str | None = None  # 字幕文字色(#RRGGBB, cast/行から)

    @property
    def duration(self) -> float:
        return self.end - self.start


def wav_duration(path: str | Path) -> float:
    """WAV の再生時間(秒)を wave モジュールで求める。"""
    with contextlib.closing(wave.open(str(path), "rb")) as w:
        frames = w.getnframes()
        rate = w.getframerate()
        if rate == 0:
            return 0.0
        return frames / float(rate)


def build_timeline(
    lines: list[Line],
    voice_paths: list[str],
    durations: list[float],
) -> tuple[list[Segment], float]:
    """行・WAVパス・尺から Segment 列と全体尺(発話部分)を返す。

    各行は  pre_gap → 発話 → post_gap  の順に時間を進める。
    戻り値の total は最後の post_gap までを含む(video.tail は含めない)。
    """
    if not (len(lines) == len(voice_paths) == len(durations)):
        raise ValueError("lines / voice_paths / durations の長さが一致しません")

    segments: list[Segment] = []
    cursor = 0.0
    for i, (line, path, dur) in enumerate(zip(lines, voice_paths, durations)):
        cursor += line.pre_gap
        start = cursor
        cursor += dur
        end = cursor
        cursor += line.post_gap
        segments.append(
            Segment(
                index=i,
                start=round(start, 3),
                end=round(end, 3),
                text=line.text,
                caption=line.caption,
                voice_path=path,
                se=line.se,
                se_volume=line.se_volume,
                speaker_name=line.speaker_name,
                color=line.color,
            )
        )
    return segments, round(cursor, 3)
