from zukan.models import SubtitleStyle
from zukan.subtitles import (
    _fmt_ass_time,
    _fmt_srt_time,
    _hex_to_ass_color,
    build_ass,
    build_srt,
)
from zukan.timeline import Segment


def _seg(i, start, end, caption="字幕"):
    return Segment(
        index=i, start=start, end=end, text=caption, caption=caption,
        voice_path=f"{i}.wav",
    )


def test_hex_to_ass_color_rrggbb():
    # 白 #FFFFFF → 不透明(alpha=00) BBGGRR=FFFFFF
    assert _hex_to_ass_color("#FFFFFF") == "&H00FFFFFF"
    # 赤 #FF0000 → BGR 並びなので 0000FF
    assert _hex_to_ass_color("#FF0000") == "&H000000FF"


def test_hex_to_ass_color_with_opacity():
    # 不透明度 80(=0x80) → 透明度 0x7F
    assert _hex_to_ass_color("#80FFFFFF") == "&H7FFFFFFF"


def test_fmt_ass_time():
    assert _fmt_ass_time(0) == "0:00:00.00"
    assert _fmt_ass_time(1.5) == "0:00:01.50"
    assert _fmt_ass_time(3661.23) == "1:01:01.23"


def test_fmt_srt_time():
    assert _fmt_srt_time(0) == "00:00:00,000"
    assert _fmt_srt_time(1.5) == "00:00:01,500"
    assert _fmt_srt_time(3661.234) == "01:01:01,234"


def test_build_ass_structure():
    segs = [_seg(0, 0.0, 1.0, "こんにちは"), _seg(1, 1.5, 2.5, "さようなら")]
    ass = build_ass(segs, SubtitleStyle(), 1920, 1080)
    assert "[Script Info]" in ass
    assert "PlayResX: 1920" in ass
    assert "[V4+ Styles]" in ass
    assert "[Events]" in ass
    assert "こんにちは" in ass
    assert "さようなら" in ass
    # ダイアログ行が2つ
    assert ass.count("Dialogue:") == 2


def test_build_ass_skips_empty_caption():
    segs = [_seg(0, 0.0, 1.0, ""), _seg(1, 1.5, 2.5, "あり")]
    ass = build_ass(segs, SubtitleStyle(), 1920, 1080)
    assert ass.count("Dialogue:") == 1


def test_build_ass_escapes_newline():
    segs = [_seg(0, 0.0, 1.0, "一行目\n二行目")]
    ass = build_ass(segs, SubtitleStyle(), 1920, 1080)
    assert "一行目\\N二行目" in ass


def test_build_srt():
    segs = [_seg(0, 0.0, 1.0, "A"), _seg(1, 1.5, 2.5, "B")]
    srt = build_srt(segs)
    assert "1\n00:00:00,000 --> 00:00:01,000\nA" in srt
    assert "2\n00:00:01,500 --> 00:00:02,500\nB" in srt
