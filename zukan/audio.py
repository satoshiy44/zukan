"""ffmpeg 呼び出し(コマンド構築 + 実行)。

コマンド構築(build_*_cmd)は副作用のない純関数で list[str] を返すので
単体テストできる。実際の実行(run_ffmpeg)とは分離してある。

処理は 2 段:
  1) build_narration_cmd … 各行 WAV を開始時刻に配置し SE を重ねて narration.wav
  2) build_render_cmd    … 背景 + ナレーション + BGM + 字幕(ASS)焼き込み → 出力
音声のみ出力(.wav/.mp3/.m4a)の場合は 2) の映像処理を省く。
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .models import Script
from .timeline import Segment

_AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".opus", ".ogg"}


class FfmpegError(RuntimeError):
    pass


def _is_color(background: str) -> bool:
    """背景指定が単色(#RRGGBB)か、ファイルパスかを判定する。"""
    return background.strip().startswith("#")


def _color_arg(background: str) -> str:
    """#RRGGBB → ffmpeg color ソース用 0xRRGGBB。"""
    return "0x" + background.lstrip("#")


def _escape_filter_path(path: str) -> str:
    """filtergraph 内のファイル名で特別扱いされる文字をエスケープする。"""
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def build_narration_cmd(
    segments: list[Segment],
    total: float,
    out_path: str,
    ffmpeg: str = "ffmpeg",
    sample_rate: int = 48000,
) -> list[str]:
    """各行の音声 + SE を1本の narration WAV にまとめるコマンドを作る。"""
    if not segments:
        raise FfmpegError("segments が空です")

    inputs: list[str] = []
    filters: list[str] = []
    mix_labels: list[str] = []
    idx = 0

    fmt = f"aformat=sample_rates={sample_rate}:channel_layouts=stereo"

    for seg in segments:
        delay_ms = int(round(seg.start * 1000))
        inputs += ["-i", seg.voice_path]
        label = f"a{idx}"
        filters.append(f"[{idx}:a]{fmt},adelay={delay_ms}:all=1[{label}]")
        mix_labels.append(f"[{label}]")
        idx += 1

    for seg in segments:
        if not seg.se:
            continue
        delay_ms = int(round(seg.start * 1000))
        inputs += ["-i", seg.se]
        label = f"a{idx}"
        filters.append(
            f"[{idx}:a]{fmt},volume={seg.se_volume},adelay={delay_ms}:all=1[{label}]"
        )
        mix_labels.append(f"[{label}]")
        idx += 1

    joined = "".join(mix_labels)
    filters.append(
        f"{joined}amix=inputs={len(mix_labels)}:normalize=0:dropout_transition=0[mixed]"
    )
    # 尺を total ぴったりに揃える(足りなければ無音で埋め、超過分は切る)
    filters.append(f"[mixed]apad=whole_dur={total:.3f},atrim=end={total:.3f}[out]")

    return [
        ffmpeg,
        "-y",
        *inputs,
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[out]",
        "-ac",
        "2",
        "-ar",
        str(sample_rate),
        "-c:a",
        "pcm_s16le",
        out_path,
    ]


def build_render_cmd(
    script: Script,
    narration_path: str,
    ass_path: str | None,
    total: float,
    ffmpeg: str = "ffmpeg",
) -> list[str]:
    """背景 + ナレーション + BGM + 字幕を合成し最終出力を作るコマンドを作る。"""
    out = script.output
    out_ext = Path(out).suffix.lower()
    audio_only = out_ext in _AUDIO_EXTS
    v = script.video
    bgm = script.bgm
    final_dur = total + v.tail

    inputs: list[str] = []
    filters: list[str] = []

    # --- 映像の入力(音声のみ出力なら省略) ---
    bg_index: int | None = None
    if not audio_only:
        if _is_color(v.background):
            inputs += [
                "-f",
                "lavfi",
                "-i",
                f"color=c={_color_arg(v.background)}:s={v.width}x{v.height}:r={v.fps}",
            ]
        elif Path(v.background).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".bmp"}:
            inputs += ["-loop", "1", "-framerate", str(v.fps), "-i", v.background]
        else:  # 動画背景
            inputs += ["-stream_loop", "-1", "-i", v.background]
        bg_index = 0

    # --- 音声の入力 ---
    narr_index = _count_inputs(inputs)
    inputs += ["-i", narration_path]

    bgm_index: int | None = None
    if bgm:
        loop_args = ["-stream_loop", "-1"] if bgm.loop else []
        bgm_index = _count_inputs(inputs)
        inputs += [*loop_args, "-i", bgm.path]

    # --- 映像フィルタ ---
    if not audio_only:
        vf = (
            f"[{bg_index}:v]scale={v.width}:{v.height}:force_original_aspect_ratio=increase,"
            f"crop={v.width}:{v.height},setsar=1,fps={v.fps}"
        )
        if ass_path:
            vf += f",ass=filename='{_escape_filter_path(ass_path)}'"
        vf += "[v]"
        filters.append(vf)

    # --- 音声フィルタ ---
    fmt = "aformat=sample_rates=48000:channel_layouts=stereo"
    filters.append(f"[{narr_index}:a]{fmt},apad[narr]")
    if bgm:
        b = f"[{bgm_index}:a]{fmt},volume={bgm.volume}"
        if bgm.fade_out > 0:
            fade_start = max(0.0, final_dur - bgm.fade_out)
            b += f",afade=t=out:st={fade_start:.3f}:d={bgm.fade_out}"
        b += "[bgm]"
        filters.append(b)
        filters.append("[narr][bgm]amix=inputs=2:normalize=0:dropout_transition=0[a]")
    else:
        filters.append("[narr]anull[a]")

    cmd = [ffmpeg, "-y", *inputs, "-filter_complex", ";".join(filters)]

    if not audio_only:
        cmd += ["-map", "[v]", "-map", "[a]"]
        cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", str(v.fps)]
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    else:
        cmd += ["-map", "[a]"]
        if out_ext == ".wav":
            cmd += ["-c:a", "pcm_s16le"]
        elif out_ext == ".mp3":
            cmd += ["-c:a", "libmp3lame", "-b:a", "192k"]
        else:
            cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd += ["-t", f"{final_dur:.3f}", out]
    return cmd


def _count_inputs(args: list[str]) -> int:
    """これまでに積んだ -i の数(= 次の入力インデックス)を数える。"""
    return sum(1 for a in args if a == "-i")


def run_ffmpeg(cmd: list[str], verbose: bool = False) -> None:
    """ffmpeg を実行する。失敗時は末尾ログ付きで FfmpegError。"""
    if shutil.which(cmd[0]) is None:
        raise FfmpegError(
            f"'{cmd[0]}' が見つかりません。ffmpeg をインストールしてください。"
        )
    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if verbose:
        print(proc.stdout)
    if proc.returncode != 0:
        tail = "\n".join(proc.stdout.splitlines()[-20:])
        raise FfmpegError(f"ffmpeg が失敗しました(code={proc.returncode}):\n{tail}")
