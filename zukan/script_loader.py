"""台本(YAML/CSV)を読み込み、models.Script に変換する。

YAML を第一形式とし、簡易台本用に CSV(text,speaker,...) も受ける。
不正な台本は ScriptError で早期に落とす(ffmpeg まで行かせない)。
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any

import yaml

from .config import Config
from .models import (
    Bgm,
    CastMember,
    Line,
    Script,
    SubtitleStyle,
    VideoConfig,
    VoiceParams,
)


class ScriptError(ValueError):
    """台本の内容が不正なときに投げる。"""


def load_script(path: str, config: Config | None = None) -> Script:
    """拡張子で YAML / CSV を振り分けてロードする。"""
    p = Path(path)
    if not p.exists():
        raise ScriptError(f"台本ファイルが見つかりません: {path}")
    if p.suffix.lower() in (".yaml", ".yml"):
        with p.open(encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return _from_dict(data, config, source=p)
    if p.suffix.lower() == ".csv":
        return _from_csv(p, config)
    raise ScriptError(f"未対応の台本形式です: {p.suffix}(.yaml / .csv に対応)")


def _default_speaker(config: Config | None) -> int:
    return config.default_speaker if config else VoiceParams().speaker


def _voice_from(data: dict[str, Any], defaults: VoiceParams) -> VoiceParams:
    """行 or defaults セクションから VoiceParams を組み立てる。"""
    return VoiceParams(
        speaker=int(data.get("speaker", defaults.speaker)),
        speed=float(data.get("speed", defaults.speed)),
        pitch=float(data.get("pitch", defaults.pitch)),
        intonation=float(data.get("intonation", defaults.intonation)),
        volume=float(data.get("volume", defaults.volume)),
        pre_phoneme_length=data.get("pre_phoneme_length", defaults.pre_phoneme_length),
        post_phoneme_length=data.get(
            "post_phoneme_length", defaults.post_phoneme_length
        ),
    )


def _cast_from(data: Any, config: Config | None) -> dict[str, CastMember]:
    """cast セクション(キャラ名→声/色)を解決する。

    記法は2通り:
      cast:
        ずんだもん: 3               # 名前 → 話者ID だけ
        めたん:                      # 名前 → 声パラメータ + 字幕色
          speaker: 2
          speed: 1.05
          color: "#FF6699"
    """
    if not data:
        return {}
    if not isinstance(data, dict):
        raise ScriptError("cast は 名前→設定 のマップである必要があります")
    base = VoiceParams(speaker=_default_speaker(config))
    cast: dict[str, CastMember] = {}
    for name, spec in data.items():
        if isinstance(spec, int):  # ずんだもん: 3
            member = CastMember(name=str(name), voice=VoiceParams(speaker=int(spec)))
        elif isinstance(spec, dict):
            if "speaker" not in spec:
                raise ScriptError(f"cast '{name}' に speaker がありません")
            member = CastMember(
                name=str(name),
                voice=_voice_from(spec, base),
                color=spec.get("color"),
            )
        else:
            raise ScriptError(f"cast '{name}' の形式が不正です: {spec!r}")
        cast[str(name)] = member
    return cast


def _from_dict(data: dict[str, Any], config: Config | None, source: Path) -> Script:
    raw_lines = data.get("lines")
    if not raw_lines:
        raise ScriptError("台本に 'lines' がありません(最低1行必要です)")

    cast = _cast_from(data.get("cast"), config)

    # defaults セクション: 全行に効く既定パラメータ
    defaults_data = data.get("defaults", {}) or {}
    base_voice = _voice_from(defaults_data, VoiceParams(speaker=_default_speaker(config)))
    default_post_gap = float(defaults_data.get("post_gap", 0.3))
    default_pre_gap = float(defaults_data.get("pre_gap", 0.0))

    lines: list[Line] = []
    for i, item in enumerate(raw_lines):
        # 文字列だけの行(- "こんにちは")も許可
        if isinstance(item, str):
            item = {"text": item}
        if not isinstance(item, dict):
            raise ScriptError(f"lines[{i}] の形式が不正です: {item!r}")
        text = item.get("text")
        if not text or not str(text).strip():
            raise ScriptError(f"lines[{i}] に text がありません")

        # speaker がキャラ名(文字列)なら cast から声・色を継承する
        speaker_name: str | None = None
        member_color: str | None = None
        line_base = base_voice
        speaker_val = item.get("speaker")
        if isinstance(speaker_val, str):
            member = cast.get(speaker_val)
            if member is None:
                raise ScriptError(
                    f"lines[{i}] の話者 '{speaker_val}' が cast に定義されていません"
                )
            speaker_name = member.name
            member_color = member.color
            line_base = member.voice
            # speaker はキャラ名なので、_voice_from に数値として渡さない
            item = {k: v for k, v in item.items() if k != "speaker"}

        lines.append(
            Line(
                text=str(text),
                voice=_voice_from(item, line_base),
                subtitle=item.get("subtitle"),
                pre_gap=float(item.get("pre_gap", default_pre_gap)),
                post_gap=float(item.get("post_gap", default_post_gap)),
                se=item.get("se"),
                se_volume=float(item.get("se_volume", 1.0)),
                speaker_name=speaker_name,
                color=item.get("color", member_color),
            )
        )

    bgm = _bgm_from(data.get("bgm"))
    video = _video_from(data.get("video", {}) or {})
    style = _style_from(data.get("subtitle", {}) or {})

    title = str(data.get("title", source.stem))
    output = str(data.get("output", f"output/{source.stem}.mp4"))

    return Script(
        title=title,
        output=output,
        lines=lines,
        cast=cast,
        bgm=bgm,
        video=video,
        subtitle_style=style,
    )


def _bgm_from(data: Any) -> Bgm | None:
    if not data:
        return None
    if isinstance(data, str):  # bgm: "path.mp3" の短縮記法
        return Bgm(path=data)
    if not isinstance(data, dict) or "path" not in data:
        raise ScriptError("bgm は path を含む必要があります")
    return Bgm(
        path=str(data["path"]),
        volume=float(data.get("volume", 0.15)),
        loop=bool(data.get("loop", True)),
        fade_out=float(data.get("fade_out", 1.5)),
    )


def _video_from(data: dict[str, Any]) -> VideoConfig:
    v = VideoConfig()
    return VideoConfig(
        width=int(data.get("width", v.width)),
        height=int(data.get("height", v.height)),
        fps=int(data.get("fps", v.fps)),
        background=str(data.get("background", v.background)),
        tail=float(data.get("tail", v.tail)),
    )


def _style_from(data: dict[str, Any]) -> SubtitleStyle:
    s = SubtitleStyle()
    return SubtitleStyle(
        font=str(data.get("font", s.font)),
        font_size=int(data.get("font_size", s.font_size)),
        primary_color=str(data.get("primary_color", s.primary_color)),
        outline_color=str(data.get("outline_color", s.outline_color)),
        outline=float(data.get("outline", s.outline)),
        shadow=float(data.get("shadow", s.shadow)),
        bold=bool(data.get("bold", s.bold)),
        margin_v=int(data.get("margin_v", s.margin_v)),
        alignment=int(data.get("alignment", s.alignment)),
    )


def _from_csv(path: Path, config: Config | None) -> Script:
    """簡易 CSV 台本。ヘッダ: text[,speaker,speed,se,subtitle,post_gap]。"""
    speaker_default = _default_speaker(config)
    lines: list[Line] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or "text" not in reader.fieldnames:
            raise ScriptError("CSV には 'text' 列が必要です")
        for i, row in enumerate(reader):
            text = (row.get("text") or "").strip()
            if not text:
                continue  # 空行はスキップ
            voice = VoiceParams(
                speaker=int(row["speaker"]) if row.get("speaker") else speaker_default,
                speed=float(row["speed"]) if row.get("speed") else 1.0,
            )
            lines.append(
                Line(
                    text=text,
                    voice=voice,
                    subtitle=row.get("subtitle") or None,
                    se=row.get("se") or None,
                    post_gap=float(row["post_gap"]) if row.get("post_gap") else 0.3,
                )
            )
    if not lines:
        raise ScriptError("CSV から有効な行を読み取れませんでした")
    return Script(title=path.stem, output=f"output/{path.stem}.mp4", lines=lines)
