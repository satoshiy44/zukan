"""動画生成の全工程を統括する。

処理順序（要件どおり）:
 1. プロジェクト設定を読み込む
 2. 必要ファイルを検証する
 3. VOICEVOX Engine の起動を確認する
 4. 話者・スタイル一覧を取得する
 5. 各行から音声を生成する
 6. 音声の長さを ffprobe で取得する
 7. 音声の長さから各シーンの尺を確定する
 8. 画像を 1080x1920 の縦画面へ配置する
 9. ズーム/パンを付ける
10. エフェクトを付ける
11. 字幕を生成する
12. 効果音を配置する
13. BGM を配置する
14. 音量を調整する
15. 各シーンを結合する
16. MP4 を書き出す
17. 最終ファイルを ffprobe で検証する
18. 制作レポートを出力する

FFmpeg コマンドを組み立てる関数は「純粋関数（リストを返すだけ）」にして、
FFmpeg が無い環境でも単体テストできるようにしている。
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import random
import shlex
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import utils  # type: ignore
    import generate_voice  # type: ignore
    import generate_subtitles  # type: ignore
else:  # pragma: no cover
    from . import utils, generate_voice, generate_subtitles

from utils import MangaShortError, ScriptRow, ProjectPaths  # noqa: E402


# ---------------------------------------------------------------------------
# シーン尺の確定
# ---------------------------------------------------------------------------
def resolve_scene_duration(
    audio_dur: float,
    duration_override: Optional[float],
    editing: Dict[str, Any],
) -> float:
    """シーンの尺を決める。

    - 基本は音声尺。
    - duration_override があればそれを優先。ただし音声より短くしない。
    - minimum / maximum で丸める（ただし音声尺は下回らない）。
    """
    min_d = float(editing.get("minimum_scene_duration", 0.8))
    max_d = float(editing.get("maximum_scene_duration", 5.0))
    dur = audio_dur
    if duration_override is not None and duration_override > 0:
        dur = max(duration_override, audio_dur)
    dur = max(dur, min_d)
    # 上限は音声尺を切らない範囲で適用
    dur = min(dur, max(max_d, audio_dur))
    return round(dur, 3)


# ---------------------------------------------------------------------------
# 画像フィット（背景合成）フィルタ
# ---------------------------------------------------------------------------
def build_fit_filter(
    fit_mode: str, width: int, height: int, blur: int, in_label: str, out_label: str
) -> str:
    """画像を縦画面へ配置するフィルタを返す。デフォルトは contain_blur。"""
    if fit_mode == "cover":
        return (
            f"[{in_label}]scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},setsar=1[{out_label}]"
        )
    if fit_mode == "contain_black":
        return (
            f"[{in_label}]scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[{out_label}]"
        )
    # contain_blur（デフォルト）: 背景に同じ画像を拡大・ぼかして配置し、中央へ原画像
    return (
        f"[{in_label}]split=2[bgsrc][fgsrc];"
        f"[bgsrc]scale={width}:{height}:force_original_aspect_ratio=increase,"
        f"crop={width}:{height},boxblur={blur}:1,setsar=1[bg];"
        f"[fgsrc]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
        f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[{out_label}]"
    )


# ---------------------------------------------------------------------------
# モーション（ズーム/パン）フィルタ
# ---------------------------------------------------------------------------
def build_motion_filter(
    motion: str,
    *,
    width: int,
    height: int,
    fps: int,
    frames: int,
    zoom_start: float,
    zoom_end: float,
    focus_x: Optional[float],
    focus_y: Optional[float],
    focus_scale: Optional[float],
    in_label: str,
    out_label: str,
    seed: int = 42,
) -> str:
    """zoompan によるモーションフィルタを返す。

    frames は総出力フレーム数。on（出力フレーム番号）で線形補間する。
    """
    denom = max(frames - 1, 1)
    # zoompan は入力を高解像度化しておくと破綻しにくい
    up_w, up_h = width * 2, height * 2

    if motion == "random_slow":
        motion = random.Random(seed).choice(
            ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "pan_down"]
        )

    if motion == "none":
        return (
            f"[{in_label}]scale={width}:{height},fps={fps},setsar=1[{out_label}]"
        )

    # ズーム量（z）とパン位置（x, y）の式を組み立てる
    if motion == "zoom_in":
        z = f"{zoom_start}+({zoom_end}-{zoom_start})*on/{denom}"
        x = "iw/2-(iw/zoom/2)"
        y = "ih/2-(ih/zoom/2)"
    elif motion == "zoom_out":
        z = f"{zoom_end}-({zoom_end}-{zoom_start})*on/{denom}"
        x = "iw/2-(iw/zoom/2)"
        y = "ih/2-(ih/zoom/2)"
    elif motion == "face_zoom":
        scale = focus_scale if focus_scale else max(zoom_end, 1.25)
        z = f"{zoom_start}+({scale}-{zoom_start})*on/{denom}"
        fx = focus_x if focus_x is not None else 0.5
        fy = focus_y if focus_y is not None else 0.4
        x = f"{fx}*iw-(iw/zoom/2)"
        y = f"{fy}*ih-(ih/zoom/2)"
    elif motion in ("pan_left", "pan_right"):
        zfix = max(zoom_end, 1.12)
        z = f"{zfix}"
        span = "(iw-iw/zoom)"
        prog = f"on/{denom}" if motion == "pan_right" else f"(1-on/{denom})"
        x = f"{span}*{prog}"
        y = "ih/2-(ih/zoom/2)"
    elif motion in ("pan_up", "pan_down"):
        zfix = max(zoom_end, 1.12)
        z = f"{zfix}"
        span = "(ih-ih/zoom)"
        prog = f"on/{denom}" if motion == "pan_down" else f"(1-on/{denom})"
        x = "iw/2-(iw/zoom/2)"
        y = f"{span}*{prog}"
    else:  # 未知のモーションは静止扱い
        return f"[{in_label}]scale={width}:{height},fps={fps},setsar=1[{out_label}]"

    return (
        f"[{in_label}]scale={up_w}:{up_h},"
        f"zoompan=z='{z}':x='{x}':y='{y}':d={frames}:s={width}x{height}:fps={fps},"
        f"setsar=1[{out_label}]"
    )


# ---------------------------------------------------------------------------
# エフェクトフィルタ
# ---------------------------------------------------------------------------
def build_effect_chain(effect: str, fps: int, duration: float) -> str:
    """エフェクトのフィルタ文字列（カンマ連結）を返す。none なら空文字。

    複雑な外部ライブラリを避け、FFmpeg 標準フィルタで安定実装できる範囲に絞る。
    一部は簡易版（README に制限を記載）。
    """
    if effect in ("", "none"):
        return ""
    if effect == "flash":
        # 開始 0.12 秒だけ白から明ける = 白フラッシュ
        return "fade=t=in:st=0:d=0.12:color=white"
    if effect == "shake":
        # 弱めの手ぶれ（初期値は控えめ）。周辺 10px を使い揺らす。
        return (
            "crop=w=in_w-20:h=in_h-20:"
            "x='10+6*sin(2*PI*t*7)':y='10+6*cos(2*PI*t*9)',"
            "scale=1080:1920"
        )
    if effect == "soft_glow":
        # 簡易発光（軽いぼかし＋わずかな増光）
        return "gblur=sigma=4:steps=1,eq=brightness=0.03:saturation=1.05"
    if effect == "blur":
        return "gblur=sigma=12"
    if effect == "vignette":
        return "vignette=PI/5"
    if effect == "darken":
        return "eq=brightness=-0.18:contrast=1.05"
    if effect == "red_tint":
        return "colorbalance=rs=0.25:rm=0.25:gm=-0.05:bm=-0.12"
    if effect == "blue_tint":
        return "colorbalance=bs=0.25:bm=0.25:rm=-0.1"
    if effect == "speed_lines":
        # 簡易版: 強い水平モーションブラーで疾走感を出す（本物の集中線ではない）
        return "boxblur=luma_radius=30:luma_power=1:chroma_radius=0:chroma_power=0"
    if effect == "glitch":
        # 簡易版: RGB ずらし＋時間ノイズ
        return "rgbashift=rh=6:bh=-6,noise=alls=14:allf=t"
    return ""


# ---------------------------------------------------------------------------
# シーン動画コマンド（純粋関数）
# ---------------------------------------------------------------------------
@dataclass
class SceneSpec:
    """1 シーン分の描画パラメータ。"""

    row: ScriptRow
    image_path: Path
    duration: float
    out_path: Path


def build_scene_cmd(
    ffmpeg: str,
    spec: SceneSpec,
    config: Dict[str, Any],
    *,
    preview: bool = False,
) -> List[str]:
    """1 シーンの無音動画を書き出す FFmpeg コマンド（リスト）を返す。"""
    video = config.get("video", {})
    editing = config.get("editing", {})
    width = 540 if preview else int(video.get("width", 1080))
    height = 960 if preview else int(video.get("height", 1920))
    fps = int(video.get("fps", 30))
    fit_mode = video.get("fit_mode", "contain_blur")
    blur = int(video.get("background_blur", 20))
    seed = int(editing.get("random_seed", 42))

    frames = max(int(round(spec.duration * fps)), 1)
    zoom_start = float(editing.get("default_zoom_start", 1.00))
    zoom_end = float(editing.get("default_zoom_end", 1.12))

    motion = spec.row.motion or editing.get("default_motion", "zoom_in")

    fit = build_fit_filter(fit_mode, width, height, blur, "0:v", "fit")
    mot = build_motion_filter(
        motion,
        width=width,
        height=height,
        fps=fps,
        frames=frames,
        zoom_start=zoom_start,
        zoom_end=zoom_end,
        focus_x=spec.row.focus_x,
        focus_y=spec.row.focus_y,
        focus_scale=spec.row.focus_scale,
        in_label="fit",
        out_label="mot",
        seed=seed + int(spec.row.id),
    )
    effect_chain = build_effect_chain(spec.row.effect, fps, spec.duration)
    if effect_chain:
        graph = f"{fit};{mot};[mot]{effect_chain},format={video.get('pixel_format','yuv420p')}[vout]"
    else:
        graph = f"{fit};{mot};[mot]format={video.get('pixel_format','yuv420p')}[vout]"

    preset = "veryfast" if preview else "medium"
    crf = "26" if preview else "18"

    return [
        ffmpeg,
        "-y",
        "-loop",
        "1",
        "-i",
        str(spec.image_path),
        "-filter_complex",
        graph,
        "-map",
        "[vout]",
        "-t",
        f"{spec.duration:.3f}",
        "-r",
        str(fps),
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        crf,
        "-pix_fmt",
        video.get("pixel_format", "yuv420p"),
        str(spec.out_path),
    ]


# ---------------------------------------------------------------------------
# シーン音声コマンド（音声＋効果音）
# ---------------------------------------------------------------------------
def build_scene_audio_cmd(
    ffmpeg: str,
    voice_path: Path,
    sfx_path: Optional[Path],
    duration: float,
    sfx_volume: float,
    out_path: Path,
    *,
    sample_rate: int = 48000,
) -> List[str]:
    """1 シーン分の音声（無音パディング＋効果音）を作るコマンド。"""
    inputs = ["-i", str(voice_path)]
    if sfx_path is not None:
        inputs += ["-i", str(sfx_path)]
        graph = (
            f"[0:a]apad,atrim=0:{duration:.3f},asetpts=PTS-STARTPTS[v];"
            f"[1:a]volume={sfx_volume},adelay=0|0,apad,atrim=0:{duration:.3f},"
            f"asetpts=PTS-STARTPTS[s];"
            f"[v][s]amix=inputs=2:duration=first:normalize=0[a]"
        )
    else:
        graph = f"[0:a]apad,atrim=0:{duration:.3f},asetpts=PTS-STARTPTS[a]"
    return [
        ffmpeg,
        "-y",
        *inputs,
        "-filter_complex",
        graph,
        "-map",
        "[a]",
        "-ac",
        "2",
        "-ar",
        str(sample_rate),
        "-c:a",
        "pcm_s16le",
        str(out_path),
    ]


# ---------------------------------------------------------------------------
# concat リスト
# ---------------------------------------------------------------------------
def build_concat_file(paths: Sequence[Path]) -> str:
    """concat demuxer 用のリストファイル内容を返す。"""
    lines = []
    for p in paths:
        escaped = str(p).replace("'", "'\\''")
        lines.append(f"file '{escaped}'")
    return "\n".join(lines) + "\n"


def build_concat_cmd(ffmpeg: str, list_file: Path, out_path: Path) -> List[str]:
    """concat demuxer でストリームコピー結合するコマンド。"""
    return [
        ffmpeg,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c",
        "copy",
        str(out_path),
    ]


# ---------------------------------------------------------------------------
# BGM ミックス
# ---------------------------------------------------------------------------
def build_bgm_mix_cmd(
    ffmpeg: str,
    voice_track: Path,
    bgm_path: Optional[Path],
    total_duration: float,
    audio_conf: Dict[str, Any],
    out_path: Path,
) -> List[str]:
    """音声トラックへ BGM を重ねるコマンド（BGM 無しならボイスをそのまま整形）。

    可能なら簡易ダッキング（音声がある区間で BGM を下げる）を行う。
    """
    bgm_volume = float(audio_conf.get("bgm_volume", 0.10))
    fade = float(audio_conf.get("bgm_fade", 0.8))
    ducking = bool(audio_conf.get("ducking", True))

    if bgm_path is None:
        # BGM 無し: そのまま（末尾のみ整える）
        return [
            ffmpeg,
            "-y",
            "-i",
            str(voice_track),
            "-c:a",
            "pcm_s16le",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(out_path),
        ]

    fade_start = max(total_duration - fade, 0.0)
    bgm_chain = (
        f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,"
        f"volume={bgm_volume},"
        f"afade=t=in:st=0:d={fade},"
        f"afade=t=out:st={fade_start:.3f}:d={fade}[bgmv]"
    )
    if ducking:
        graph = (
            f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[v0][vsc];"
            f"{bgm_chain};"
            f"[bgmv][vsc]sidechaincompress=threshold=0.02:ratio=8:attack=5:release=300[bgmduck];"
            f"[v0][bgmduck]amix=inputs=2:duration=first:normalize=0[a]"
        )
    else:
        graph = (
            f"[0:a]aformat=sample_rates=48000:channel_layouts=stereo[v0];"
            f"{bgm_chain};"
            f"[v0][bgmv]amix=inputs=2:duration=first:normalize=0[a]"
        )
    return [
        ffmpeg,
        "-y",
        "-i",
        str(voice_track),
        "-stream_loop",
        "-1",
        "-i",
        str(bgm_path),
        "-filter_complex",
        graph,
        "-map",
        "[a]",
        "-t",
        f"{total_duration:.3f}",
        "-c:a",
        "pcm_s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        str(out_path),
    ]


# ---------------------------------------------------------------------------
# 最終書き出し（映像＋音声＋字幕＋ラウドネス）
# ---------------------------------------------------------------------------
def build_final_cmd(
    ffmpeg: str,
    video_concat: Path,
    audio_mix: Path,
    subtitle_path: Optional[Path],
    config: Dict[str, Any],
    out_path: Path,
    *,
    preview: bool = False,
) -> List[str]:
    """字幕を焼き込み、音量を整えて最終 MP4 を書き出すコマンド。"""
    video = config.get("video", {})
    audio = config.get("audio", {})
    fps = int(video.get("fps", 30))
    pix_fmt = video.get("pixel_format", "yuv420p")
    v_codec = video.get("video_codec", "libx264")
    a_codec = video.get("audio_codec", "aac")
    v_bitrate = "3M" if preview else str(video.get("video_bitrate", "15M"))
    a_bitrate = str(video.get("audio_bitrate", "192k"))

    vf_parts: List[str] = []
    if subtitle_path is not None:
        sub = str(subtitle_path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        vf_parts.append(f"subtitles='{sub}'")
    vf_parts.append(f"format={pix_fmt}")
    vf = ",".join(vf_parts)

    af_parts: List[str] = []
    if audio.get("normalize", True):
        target = float(audio.get("target_lufs", -14.0))
        tp = float(audio.get("true_peak", -1.5))
        af_parts.append(f"loudnorm=I={target}:TP={tp}:LRA=11")
    af = ",".join(af_parts) if af_parts else None

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(video_concat),
        "-i",
        str(audio_mix),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vf",
        vf,
        "-r",
        str(fps),
        "-c:v",
        v_codec,
        "-preset",
        "veryfast" if preview else "medium",
        "-b:v",
        v_bitrate,
        "-pix_fmt",
        pix_fmt,
    ]
    if af:
        cmd += ["-af", af]
    cmd += [
        "-c:a",
        a_codec,
        "-b:a",
        a_bitrate,
        "-ar",
        "48000",
        "-movflags",
        "+faststart",
        "-shortest",
        str(out_path),
    ]
    return cmd


# ---------------------------------------------------------------------------
# 検証（ファイル存在チェック）
# ---------------------------------------------------------------------------
@dataclass
class ValidationReport:
    """事前検証の結果。"""

    fatal: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    missing_images: List[str] = field(default_factory=list)
    missing_sfx: List[str] = field(default_factory=list)
    missing_bgm: bool = False

    @property
    def ok(self) -> bool:
        return not self.fatal


def validate_materials(
    rows: Sequence[ScriptRow], paths: ProjectPaths, config: Dict[str, Any]
) -> ValidationReport:
    """素材（画像・効果音・BGM）の有無を検証する。

    致命的でない不足は warnings/missing に積み、処理は継続できるようにする。
    ただし「全画像が欠落」など動画が成立しない場合は fatal に積む。
    """
    report = ValidationReport()

    for col in utils.REQUIRED_CSV_COLUMNS:
        pass  # 列検証は read_script 側で実施済み

    for row in rows:
        if row.motion not in utils.VALID_MOTIONS:
            report.warnings.append(f"[{row.id}] 未知の motion '{row.motion}'（none 扱い）")
        if row.effect not in utils.VALID_EFFECTS:
            report.warnings.append(f"[{row.id}] 未知の effect '{row.effect}'（none 扱い）")
        if not row.image:
            report.missing_images.append(f"[{row.id}] image 列が空です")
        elif not (paths.images / row.image).exists():
            report.missing_images.append(f"[{row.id}] {row.image}")
        if row.sfx and not (paths.sfx / row.sfx).exists():
            report.missing_sfx.append(f"[{row.id}] {row.sfx}")

    # 画像が 1 枚も無ければ致命的
    available_images = [
        r for r in rows if r.image and (paths.images / r.image).exists()
    ]
    if not available_images:
        report.fatal.append(
            "有効な画像が 1 枚もありません。images/ フォルダと script.csv の image 列を確認してください。"
        )

    if not list(paths.bgm.glob("*")):
        report.missing_bgm = True

    if not paths.output.parent.exists():
        report.fatal.append("出力先フォルダが存在しません。")

    return report


def pick_bgm(paths: ProjectPaths) -> Optional[Path]:
    """bgm/ 内の最初の音声ファイルを BGM として使う。"""
    for pattern in ("*.mp3", "*.wav", "*.m4a", "*.aac", "*.flac", "*.ogg"):
        found = sorted(paths.bgm.glob(pattern))
        if found:
            return found[0]
    return None


# ---------------------------------------------------------------------------
# レポート
# ---------------------------------------------------------------------------
def build_report_data(
    *,
    rows: Sequence[ScriptRow],
    scene_durations: Dict[str, float],
    probe: utils.ProbeResult,
    bgm_name: Optional[str],
    warnings: Sequence[str],
    missing: Sequence[str],
    command: str,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """制作レポート（辞書）を組み立てる。"""
    role_counts: Dict[str, int] = {}
    for r in rows:
        role_counts[r.role] = role_counts.get(r.role, 0) + 1
    images = {r.image for r in rows if r.image}
    sfx = {r.sfx for r in rows if r.sfx}
    total = sum(scene_durations.values())
    return {
        "generated_at": _dt.datetime.now().isoformat(timespec="seconds"),
        "command": command,
        "total_duration_sec": round(total, 2),
        "scene_count": len(rows),
        "lines_by_role": role_counts,
        "image_count": len(images),
        "sfx_count": len(sfx),
        "bgm": bgm_name,
        "resolution": f"{probe.width}x{probe.height}" if probe.width else None,
        "fps": probe.fps,
        "video_codec": probe.video_codec,
        "audio_codec": probe.audio_codec,
        "file_size_bytes": probe.file_size,
        "warnings": list(warnings),
        "missing_materials": list(missing),
        "verification_ok": probe.ok,
        "verification_problems": probe.problems,
    }


def render_report_md(data: Dict[str, Any]) -> str:
    """制作レポートを Markdown で整形する。"""
    lines = [
        "# 制作レポート",
        "",
        f"- 生成日時: {data['generated_at']}",
        f"- 実行コマンド: `{data['command']}`",
        f"- 総尺: {data['total_duration_sec']} 秒",
        f"- シーン数: {data['scene_count']}",
        f"- 解像度: {data.get('resolution')}",
        f"- フレームレート: {data.get('fps')}",
        f"- 映像コーデック: {data.get('video_codec')}",
        f"- 音声コーデック: {data.get('audio_codec')}",
        f"- ファイルサイズ: {data['file_size_bytes']:,} bytes",
        f"- 使用画像数: {data['image_count']}",
        f"- 使用効果音数: {data['sfx_count']}",
        f"- BGM: {data.get('bgm') or 'なし'}",
        "",
        "## 話者別セリフ数",
    ]
    for role, count in data["lines_by_role"].items():
        lines.append(f"- {role}: {count}")
    lines.append("")
    lines.append("## 警告")
    lines += [f"- {w}" for w in data["warnings"]] or ["- なし"]
    lines.append("")
    lines.append("## 不足素材")
    lines += [f"- {m}" for m in data["missing_materials"]] or ["- なし"]
    lines.append("")
    lines.append("## 自動検証")
    lines.append(f"- 結果: {'OK' if data['verification_ok'] else '要確認'}")
    for p in data.get("verification_problems", []):
        lines.append(f"- 問題: {p}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 投稿用テキスト
# ---------------------------------------------------------------------------
def write_upload_text(config: Dict[str, Any], paths: ProjectPaths) -> None:
    """youtube_title.txt / youtube_description.txt を出力する。"""
    upload = config.get("upload_text", {})
    template = upload.get("title_template", "")
    # 未指定プレースホルダはそのまま残す（ユーザーが後で編集）
    title = template
    hashtags = upload.get("hashtags", ["shorts", "漫画", "漫画紹介"])
    tag_line = " ".join(f"#{h}" for h in hashtags)

    (paths.output / "youtube_title.txt").write_text(title + "\n", encoding="utf-8")
    (paths.output / "youtube_description.txt").write_text(
        f"{title}\n\n{tag_line}\n", encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------
def build(
    project_dir: Path,
    *,
    force: bool = False,
    skip_voice: bool = False,
    skip_bgm: bool = False,
    preview: bool = False,
    debug: bool = False,
    start_id: Optional[str] = None,
    end_id: Optional[str] = None,
    command_line: str = "",
) -> int:
    """全工程を実行する。"""
    config = utils.load_config(project_dir)
    paths = ProjectPaths.from_root(project_dir)
    paths.ensure()
    log = utils.setup_logger(paths.output / "build.log", debug=debug)
    log.info("=== manga-short-video-maker ===")
    log.info("プロジェクト: %s", project_dir)

    # 1-2. 読み込みと検証
    ffmpeg = utils.require_ffmpeg()
    utils.require_ffprobe()
    rows = utils.read_script(project_dir)
    rows = utils.filter_rows_by_id(rows, start_id, end_id)
    log.info("台本: %d 行", len(rows))

    report = validate_materials(rows, paths, config)
    for w in report.warnings:
        log.warning("警告: %s", w)
    for m in report.missing_images:
        log.warning("画像不足: %s", m)
    for m in report.missing_sfx:
        log.warning("効果音不足: %s", m)
    if not report.ok:
        for f in report.fatal:
            log.error("致命的: %s", f)
        raise MangaShortError("必須素材が不足しているため中止します。上のログを確認してください。")

    # 使用可能な行だけに絞る（画像が存在する行）
    usable_rows = [r for r in rows if r.image and (paths.images / r.image).exists()]
    if not usable_rows:
        raise MangaShortError("描画可能なシーンがありません。")

    # 3-5. 音声生成
    warnings: List[str] = list(report.warnings)
    if skip_voice:
        log.info("音声生成をスキップ（既存の音声を利用）")
    else:
        reading_dict = generate_voice.load_reading_dict(project_dir)
        voice_results = generate_voice.generate_voices(
            usable_rows, config, paths, force=force, reading_dict=reading_dict, log=log
        )
        for vr in voice_results:
            warnings.extend(vr.warnings)

    # 6-7. 尺の確定
    scene_durations: Dict[str, float] = {}
    scene_specs: List[SceneSpec] = []
    for row in usable_rows:
        wav = paths.audio / utils.voice_filename(row)
        if not wav.exists():
            log.warning("音声が無いためスキップ: [%s]", row.id)
            warnings.append(f"[{row.id}] 音声ファイルがありません")
            continue
        audio_dur = utils.audio_duration(wav, log=log)
        dur = resolve_scene_duration(audio_dur, row.duration_override, config.get("editing", {}))
        if preview:
            dur = min(dur, 15.0)
        scene_durations[row.id] = dur
        scene_specs.append(
            SceneSpec(
                row=row,
                image_path=paths.images / row.image,
                duration=dur,
                out_path=paths.cache / f"scene_{row.id}.mp4",
            )
        )

    if not scene_specs:
        raise MangaShortError("有効なシーンがありません（音声が生成されていない可能性があります）。")

    # preview は先頭 15 秒程度で打ち切り
    if preview:
        acc = 0.0
        limited: List[SceneSpec] = []
        for spec in scene_specs:
            limited.append(spec)
            acc += spec.duration
            if acc >= 15.0:
                break
        scene_specs = limited

    # 8-10. シーン動画の生成
    scene_video_paths: List[Path] = []
    for spec in scene_specs:
        cmd = build_scene_cmd(ffmpeg, spec, config, preview=preview)
        log.debug("scene cmd: %s", " ".join(shlex.quote(c) for c in cmd))
        utils.run_command(cmd, log=log)
        scene_video_paths.append(spec.out_path)
    log.info("シーン動画: %d 本", len(scene_video_paths))

    # 11. 字幕
    subtitle_path: Optional[Path] = None
    if config.get("subtitles", {}).get("enabled", True):
        cues = generate_subtitles.cues_from_rows(
            [s.row for s in scene_specs], scene_durations
        )
        ass = generate_subtitles.build_ass(cues, config)
        subtitle_path = paths.output / "subtitles.ass"
        subtitle_path.write_text(ass, encoding="utf-8")
        log.info("字幕: %s（%d 件）", subtitle_path.name, len(cues))

    # 12. シーン音声（音声＋効果音）
    scene_audio_paths: List[Path] = []
    sfx_volume = float(config.get("audio", {}).get("sfx_volume", 0.35))
    for spec in scene_specs:
        sfx_path = None
        if spec.row.sfx and (paths.sfx / spec.row.sfx).exists():
            sfx_path = paths.sfx / spec.row.sfx
        voice = paths.audio / utils.voice_filename(spec.row)
        out = paths.cache / f"sceneaudio_{spec.row.id}.wav"
        cmd = build_scene_audio_cmd(
            ffmpeg, voice, sfx_path, spec.duration, sfx_volume, out
        )
        utils.run_command(cmd, log=log)
        scene_audio_paths.append(out)

    # 15. 映像の結合
    video_list = paths.cache / "video_concat.txt"
    video_list.write_text(build_concat_file(scene_video_paths), encoding="utf-8")
    video_concat = paths.cache / "video_concat.mp4"
    utils.run_command(build_concat_cmd(ffmpeg, video_list, video_concat), log=log)

    audio_list = paths.cache / "audio_concat.txt"
    audio_list.write_text(build_concat_file(scene_audio_paths), encoding="utf-8")
    voice_track = paths.cache / "voice_track.wav"
    utils.run_command(build_concat_cmd(ffmpeg, audio_list, voice_track), log=log)

    total_duration = sum(s.duration for s in scene_specs)

    # 13-14. BGM ミックス＋音量
    bgm_path = None if skip_bgm else pick_bgm(paths)
    if bgm_path:
        log.info("BGM: %s", bgm_path.name)
    else:
        log.info("BGM: なし")
    audio_mix = paths.cache / "audio_mix.wav"
    utils.run_command(
        build_bgm_mix_cmd(
            ffmpeg, voice_track, bgm_path, total_duration, config.get("audio", {}), audio_mix
        ),
        log=log,
    )

    # 16. 最終書き出し
    out_name = config.get("output_filename", "output.mp4")
    if preview:
        stem = Path(out_name).stem
        out_name = f"{stem}_preview.mp4"
    output_path = paths.output / out_name
    final_cmd = build_final_cmd(
        ffmpeg, video_concat, audio_mix, subtitle_path, config, output_path, preview=preview
    )
    log.info("最終書き出し中: %s", output_path.name)
    utils.run_command(final_cmd, log=log)

    # 17. 自動検証
    info = utils.ffprobe_json(output_path, log=log)
    file_size = output_path.stat().st_size
    expect_w = 540 if preview else int(config["video"]["width"])
    expect_h = 960 if preview else int(config["video"]["height"])
    probe = utils.verify_output(
        info, file_size,
        expect_width=expect_w, expect_height=expect_h,
        expect_fps=float(config["video"]["fps"]),
    )
    if probe.ok:
        log.info("自動検証: OK")
    else:
        for p in probe.problems:
            log.warning("検証: %s", p)

    # 投稿用テキスト
    write_upload_text(config, paths)

    # 18. レポート
    missing = report.missing_images + report.missing_sfx
    if report.missing_bgm:
        missing.append("BGM: bgm/ にファイルがありません（BGM なしで出力）")
    report_data = build_report_data(
        rows=scene_specs and [s.row for s in scene_specs] or [],
        scene_durations=scene_durations,
        probe=probe,
        bgm_name=bgm_path.name if bgm_path else None,
        warnings=warnings,
        missing=missing,
        command=command_line,
        config=config,
    )
    (paths.output / "build_report.json").write_text(
        json.dumps(report_data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (paths.output / "build_report.md").write_text(
        render_report_md(report_data), encoding="utf-8"
    )

    # 一時ファイルの掃除（cache 内のみ。出力フォルダは汚さない）
    cleanup_cache(paths, keep_debug=debug, log=log)

    log.info("完成: %s", output_path)
    log.info("レポート: %s", paths.output / "build_report.md")
    return 0 if probe.ok else 2


def cleanup_cache(paths: ProjectPaths, *, keep_debug: bool, log: Any) -> None:
    """中間ファイルを掃除する（音声キャッシュ voice_* は残す）。"""
    if keep_debug:
        log.debug("--debug のため中間ファイルを保持します。")
        return
    patterns = [
        "scene_*.mp4",
        "sceneaudio_*.wav",
        "video_concat.*",
        "audio_concat.*",
        "voice_track.wav",
        "audio_mix.wav",
    ]
    for pat in patterns:
        for f in paths.cache.glob(pat):
            try:
                f.unlink()
            except OSError:
                pass


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="漫画・イラスト素材と台本から YouTube Shorts 動画を生成する"
    )
    parser.add_argument("project_dir", help="プロジェクトフォルダ")
    parser.add_argument("--force", action="store_true", help="音声キャッシュを無視して再生成")
    parser.add_argument("--skip-voice", action="store_true", help="音声生成をスキップ")
    parser.add_argument("--skip-bgm", action="store_true", help="BGM を使わない")
    parser.add_argument("--preview", action="store_true", help="540x960・低ビットレートの高速プレビュー")
    parser.add_argument("--debug", action="store_true", help="中間ファイルを残し詳細ログを出す")
    parser.add_argument("--start-id", default=None, help="この id 以上の行のみ処理")
    parser.add_argument("--end-id", default=None, help="この id 以下の行のみ処理")
    args = parser.parse_args(argv)

    command_line = "python scripts/build_video.py " + " ".join(argv or sys.argv[1:])
    try:
        project_dir = utils.resolve_project_dir(args.project_dir)
        return build(
            project_dir,
            force=args.force,
            skip_voice=args.skip_voice,
            skip_bgm=args.skip_bgm,
            preview=args.preview,
            debug=args.debug,
            start_id=args.start_id,
            end_id=args.end_id,
            command_line=command_line,
        )
    except MangaShortError as exc:
        print(f"\nエラー: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
