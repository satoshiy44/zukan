"""字幕（ASS）生成。

- 画面下寄り・最大 2 行・1 行 12〜16 文字・白文字・太い黒縁。
- 句読点を優先して改行し、無ければ自然な文節で改行する。
- 話者名は通常表示しない。表示時間は音声と完全同期。
- 絵文字や特殊文字で FFmpeg が落ちないようにサニタイズする。

単体でも実行でき、build_video.py からも import して使う。
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import utils  # type: ignore
else:  # pragma: no cover
    from . import utils

from utils import MangaShortError, ScriptRow  # noqa: E402


# 句読点・区切り記号（この直後で改行したい）
_BREAK_AFTER = "、。！？!?，,．."
# 改行してもよい文節境界（助詞の後ろなどの簡易判定に使う）
_SOFT_BREAK_AFTER = "はがをにへとでもねよかなの」』）)】"

# ASS が制御文字として扱う文字や、描画で問題になりやすい文字を除去
_EMOJI_AND_CTRL = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0000FE00-\U0000FE0F\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF\x00-\x08\x0b\x0c\x0e-\x1f]"
)


def sanitize_subtitle_text(text: str) -> str:
    """ASS で安全に描画できる文字列へ整形する。"""
    text = _EMOJI_AND_CTRL.sub("", text)
    # ASS の改行/エスケープに使う文字を無害化
    text = text.replace("\\", "＼").replace("{", "｛").replace("}", "｝")
    text = text.replace("\r", "").replace("\t", " ")
    return text.strip()


def wrap_subtitle(
    text: str, max_chars_per_line: int = 16, max_lines: int = 2
) -> List[str]:
    """字幕テキストを句読点優先で改行する。

    1) 句読点（、。！？等）を優先的な改行位置とする。
    2) 1 行が max_chars を超える場合は文節境界（助詞の後）で折る。
    3) それでも入り切らない場合は文字数で強制的に折る。
    4) 行数は max_lines に丸め、超過分は最終行へ結合する。
    """
    text = sanitize_subtitle_text(text)
    if not text:
        return [""]

    lines: List[str] = []
    current = ""
    for i, ch in enumerate(text):
        current += ch
        at_hard_break = ch in _BREAK_AFTER
        over_limit = len(current) >= max_chars_per_line
        if at_hard_break and len(current) >= max_chars_per_line * 0.5:
            lines.append(current)
            current = ""
        elif over_limit:
            split_pos = _find_soft_break(current)
            if split_pos > 0 and split_pos < len(current):
                lines.append(current[:split_pos])
                current = current[split_pos:]
            else:
                lines.append(current)
                current = ""
    if current:
        lines.append(current)

    lines = [ln.strip() for ln in lines if ln.strip()]
    if not lines:
        return [""]

    if len(lines) > max_lines:
        head = lines[: max_lines - 1]
        tail = "".join(lines[max_lines - 1 :])
        lines = head + [tail]
    return lines


def _find_soft_break(segment: str) -> int:
    """文節境界（助詞の後ろ）で改行できる位置を後ろから探す。無ければ 0。"""
    for i in range(len(segment) - 1, 0, -1):
        if segment[i - 1] in _SOFT_BREAK_AFTER:
            return i
    return 0


# ---------------------------------------------------------------------------
# 色名 → ASS カラー（&HAABBGGRR、AA は透明度で 00=不透明）
# ---------------------------------------------------------------------------
_COLOR_MAP: Dict[str, str] = {
    "white": "&H00FFFFFF",
    "black": "&H00000000",
    "red": "&H000000FF",
    "blue": "&H00FF0000",
    "green": "&H0000FF00",
    "yellow": "&H0000FFFF",
    "cyan": "&H00FFFF00",
    "magenta": "&H00FF00FF",
    "pink": "&H00B4A0FF",
    "orange": "&H0000A5FF",
}


def color_to_ass(name: str) -> str:
    """色名または #RRGGBB を ASS の &HAABBGGRR に変換する。"""
    name = (name or "white").strip().lower()
    if name in _COLOR_MAP:
        return _COLOR_MAP[name]
    m = re.fullmatch(r"#?([0-9a-f]{6})", name)
    if m:
        rr, gg, bb = m.group(1)[0:2], m.group(1)[2:4], m.group(1)[4:6]
        return f"&H00{bb}{gg}{rr}".upper().replace("0X", "")
    return _COLOR_MAP["white"]


def _fmt_time(seconds: float) -> str:
    """秒を ASS のタイム形式 H:MM:SS.cc に変換する。"""
    if seconds < 0:
        seconds = 0.0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:d}:{minutes:02d}:{secs:05.2f}"


@dataclass
class SubtitleCue:
    """1 つの字幕表示区間。"""

    start: float
    end: float
    text: str
    role: str = "narrator"


def build_ass(
    cues: Sequence[SubtitleCue],
    config: Dict[str, Any],
) -> str:
    """字幕キューのリストから ASS 文字列を生成する。"""
    sub = config.get("subtitles", {})
    video = config.get("video", {})
    width = int(video.get("width", 1080))
    height = int(video.get("height", 1920))
    font = sub.get("font", "Hiragino Sans")
    font_size = int(sub.get("font_size", 70))
    outline = int(sub.get("outline_width", 6))
    shadow = 2 if sub.get("shadow", True) else 0
    margin_x = int(sub.get("safe_margin_x", 80))
    position_y = int(sub.get("position_y", 1450))
    max_lines = int(sub.get("max_lines", 2))
    max_chars = int(sub.get("max_chars_per_line", 16))
    speaker_colors = sub.get("speaker_colors", {})

    # position_y は「字幕の基準 Y」。下マージンで表現する（Alignment=2: 下中央）。
    margin_v = max(0, height - position_y)

    header = f"""[Script Info]
Title: manga-short-video-maker subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
"""

    # role ごとにスタイルを作る（文字色のみ変える）
    styles = []
    used_roles = sorted({c.role for c in cues} | {"narrator"})
    for role in used_roles:
        primary = color_to_ass(speaker_colors.get(role, "white"))
        styles.append(
            f"Style: {_style_name(role)},{font},{font_size},{primary},"
            f"&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,"
            f"{outline},{shadow},2,{margin_x},{margin_x},{margin_v},1"
        )

    events_header = (
        "\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    events = []
    for cue in cues:
        lines = wrap_subtitle(cue.text, max_chars, max_lines)
        text = r"\N".join(lines)
        events.append(
            f"Dialogue: 0,{_fmt_time(cue.start)},{_fmt_time(cue.end)},"
            f"{_style_name(cue.role)},,0,0,0,,{text}"
        )

    return header + "\n".join(styles) + events_header + "\n".join(events) + "\n"


def _style_name(role: str) -> str:
    return "Sub_" + re.sub(r"[^A-Za-z0-9]", "", role) or "Sub_narrator"


def cues_from_rows(
    rows: Sequence[ScriptRow], durations: Dict[str, float]
) -> List[SubtitleCue]:
    """各行の尺を連結して字幕キューを作る（音声と完全同期・空白なし）。"""
    cues: List[SubtitleCue] = []
    t = 0.0
    for row in rows:
        dur = durations.get(row.id)
        if dur is None or dur <= 0:
            continue
        cues.append(
            SubtitleCue(start=t, end=t + dur, text=row.subtitle_text, role=row.role)
        )
        t += dur
    return cues


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="字幕（ASS）のみを生成する")
    parser.add_argument("project_dir", help="プロジェクトフォルダ")
    parser.add_argument("--start-id", default=None)
    parser.add_argument("--end-id", default=None)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args(argv)

    try:
        project_dir = utils.resolve_project_dir(args.project_dir)
        config = utils.load_config(project_dir)
        paths = utils.ProjectPaths.from_root(project_dir)
        paths.ensure()
        log = utils.setup_logger(paths.output / "build.log", debug=args.debug)

        rows = utils.read_script(project_dir)
        rows = utils.filter_rows_by_id(rows, args.start_id, args.end_id)

        # 音声が既にあれば尺を取得、無ければ推定（1 文字 ≒ 0.14 秒）
        durations: Dict[str, float] = {}
        for row in rows:
            wav = paths.audio / utils.voice_filename(row)
            if wav.exists() and utils.find_binary("ffprobe"):
                durations[row.id] = utils.audio_duration(wav, log=log)
            else:
                durations[row.id] = max(0.8, len(row.text) * 0.14)

        cues = cues_from_rows(rows, durations)
        ass = build_ass(cues, config)
        out_path = paths.output / "subtitles.ass"
        out_path.write_text(ass, encoding="utf-8")
        log.info("字幕を生成しました: %s（%d 件）", out_path, len(cues))
        return 0
    except MangaShortError as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
