import wave
from pathlib import Path

import pytest

from zukan.models import Line, VoiceParams
from zukan.timeline import build_timeline, wav_duration


def _make_wav(path: Path, seconds: float, rate: int = 24000) -> None:
    frames = int(seconds * rate)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * frames)


def test_wav_duration(tmp_path):
    p = tmp_path / "a.wav"
    _make_wav(p, 1.5)
    assert abs(wav_duration(p) - 1.5) < 0.01


def test_build_timeline_sequential():
    lines = [
        Line(text="a", post_gap=0.5, pre_gap=0.0),
        Line(text="b", post_gap=0.5, pre_gap=0.0),
    ]
    paths = ["a.wav", "b.wav"]
    durations = [1.0, 2.0]
    segments, total = build_timeline(lines, paths, durations)

    assert len(segments) == 2
    # 1行目: 0.0 .. 1.0
    assert segments[0].start == 0.0
    assert segments[0].end == 1.0
    # 2行目は 1行目の post_gap(0.5) の後から
    assert segments[1].start == 1.5
    assert segments[1].end == 3.5
    # 全体尺 = 3.5 + 最後の post_gap 0.5
    assert total == 4.0


def test_build_timeline_pre_gap():
    lines = [Line(text="a", pre_gap=1.0, post_gap=0.0)]
    segments, total = build_timeline(lines, ["a.wav"], [2.0])
    assert segments[0].start == 1.0
    assert segments[0].end == 3.0
    assert total == 3.0


def test_build_timeline_length_mismatch():
    with pytest.raises(ValueError):
        build_timeline([Line(text="a")], ["a.wav", "b.wav"], [1.0])


def test_segment_carries_se_and_caption():
    lines = [Line(text="本文", subtitle="字幕", se="pon.wav", se_volume=0.8)]
    segments, _ = build_timeline(lines, ["a.wav"], [1.0])
    assert segments[0].caption == "字幕"
    assert segments[0].text == "本文"
    assert segments[0].se == "pon.wav"
    assert segments[0].se_volume == 0.8
