"""Segment 列から字幕ファイル(ASS / SRT)を生成する。

焼き込みには ASS を使う(フォント・縁取り・位置をファイル内で指定できるため)。
SRT も出力できるようにしておく(YouTube 等へ外部字幕として渡す用途)。
色指定は #RRGGBB / #AARRGGBB を受け、ASS の &HAABBGGRR に変換する。
ここも純ロジックなので単体テスト対象。
"""

from __future__ import annotations

from pathlib import Path

from .models import SubtitleStyle
from .timeline import Segment


def _hex_to_ass_color(value: str) -> str:
    """#RRGGBB / #AARRGGBB → ASS の &HAABBGGRR。

    ASS はアルファが「透明度」なので、00 が不透明・FF が透明。
    入力アルファは「不透明度」として受け、内部で反転させる。
    """
    v = value.lstrip("#")
    if len(v) == 6:
        rr, gg, bb, aa_opacity = v[0:2], v[2:4], v[4:6], "FF"
    elif len(v) == 8:
        aa_opacity, rr, gg, bb = v[0:2], v[2:4], v[4:6], v[6:8]
    else:
        raise ValueError(f"色の形式が不正です: {value}")
    alpha = 255 - int(aa_opacity, 16)  # 不透明度→透明度へ反転
    return f"&H{alpha:02X}{bb}{gg}{rr}".upper()


def _fmt_ass_time(seconds: float) -> str:
    """ASS 時刻 H:MM:SS.cc(センチ秒)。"""
    if seconds < 0:
        seconds = 0.0
    cs = int(round(seconds * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _fmt_srt_time(seconds: float) -> str:
    """SRT 時刻 HH:MM:SS,mmm。"""
    if seconds < 0:
        seconds = 0.0
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _escape_ass(text: str) -> str:
    # ASS は \N で改行。生の改行や波括弧はエスケープ/変換する。
    return (
        text.replace("\\", "\\\\")
        .replace("{", "(")
        .replace("}", ")")
        .replace("\r\n", "\\N")
        .replace("\n", "\\N")
    )


def build_ass(
    segments: list[Segment],
    style: SubtitleStyle,
    width: int,
    height: int,
) -> str:
    """ASS 字幕ファイルの中身(文字列)を組み立てる。"""
    primary = _hex_to_ass_color(style.primary_color)
    outline = _hex_to_ass_color(style.outline_color)
    bold = -1 if style.bold else 0

    header = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        (
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
            "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
            "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
            "Alignment, MarginL, MarginR, MarginV, Encoding"
        ),
        (
            f"Style: Default,{style.font},{style.font_size},{primary},"
            f"&H000000FF,{outline},&H00000000,{bold},0,0,0,"
            f"100,100,0,0,1,{style.outline},{style.shadow},"
            f"{style.alignment},40,40,{style.margin_v},1"
        ),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    events = []
    for seg in segments:
        if not seg.caption.strip():
            continue
        start = _fmt_ass_time(seg.start)
        end = _fmt_ass_time(seg.end)
        text = _escape_ass(seg.caption)
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return "\n".join(header + events) + "\n"


def build_srt(segments: list[Segment]) -> str:
    """SRT 字幕ファイルの中身(文字列)を組み立てる。"""
    blocks = []
    n = 1
    for seg in segments:
        if not seg.caption.strip():
            continue
        start = _fmt_srt_time(seg.start)
        end = _fmt_srt_time(seg.end)
        blocks.append(f"{n}\n{start} --> {end}\n{seg.caption}\n")
        n += 1
    return "\n".join(blocks)


def write_ass(
    segments: list[Segment],
    style: SubtitleStyle,
    width: int,
    height: int,
    out_path: str | Path,
) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_ass(segments, style, width, height), encoding="utf-8")
    return out


def write_srt(segments: list[Segment], out_path: str | Path) -> Path:
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_srt(segments), encoding="utf-8")
    return out
