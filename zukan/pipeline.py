"""台本 → 音声合成 → タイムライン → 字幕 → 合成 の一連を束ねる。

各ステージは他モジュールに実装済みで、ここは順番に呼ぶだけ。
dry_run=True なら VOICEVOX/ffmpeg を実行せず、実行予定のコマンドを表示する。
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from . import audio, subtitles
from .config import Config
from .models import Script
from .timeline import Segment, build_timeline, wav_duration
from .voicevox import VoicevoxClient


class Pipeline:
    def __init__(self, config: Config, verbose: bool = False):
        self.config = config
        self.verbose = verbose

    def _work(self, *parts: str) -> Path:
        p = Path(self.config.work_dir, *parts)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    def _voice_filename(self, index: int, text: str, speaker: int) -> Path:
        """本文+話者のハッシュでキャッシュ可能なファイル名を作る。"""
        h = hashlib.sha1(f"{speaker}:{text}".encode("utf-8")).hexdigest()[:10]
        return self._work("voice", f"{index:04d}_{speaker}_{h}.wav")

    def synthesize(self, script: Script, use_cache: bool = True) -> list[str]:
        """全行を VOICEVOX で合成し、WAV パス列を返す。"""
        client = VoicevoxClient(self.config)
        if not client.is_alive():
            raise RuntimeError(
                f"VOICEVOX に接続できません: {self.config.voicevox_url}\n"
                "エンジン(アプリ or Docker)が起動しているか確認してください。"
            )
        paths: list[str] = []
        for i, line in enumerate(script.lines):
            out = self._voice_filename(i, line.text, line.voice.speaker)
            if use_cache and out.exists():
                if self.verbose:
                    print(f"  [{i}] cache hit: {out.name}")
            else:
                if self.verbose:
                    print(f"  [{i}] synth speaker={line.voice.speaker}: {line.text[:24]}")
                client.synthesize(line.text, line.voice, out)
            paths.append(str(out))
        return paths

    def plan(self, script: Script, voice_paths: list[str]) -> tuple[list[Segment], float]:
        """合成済み WAV の尺からタイムラインを構築する。"""
        durations = [wav_duration(p) for p in voice_paths]
        return build_timeline(script.lines, voice_paths, durations)

    def build(self, script: Script, use_cache: bool = True, dry_run: bool = False) -> str:
        """台本1本を最終出力まで通す。出力ファイルパスを返す。"""
        # 1) 音声合成(dry_run 時はプレースホルダのパスだけ用意)
        if dry_run:
            voice_paths = [
                str(self._voice_filename(i, ln.text, ln.voice.speaker))
                for i, ln in enumerate(script.lines)
            ]
            # 尺が読めないので概算(1文字≒0.12秒)でタイムラインを組む
            durations = [max(0.6, len(ln.text) * 0.12) for ln in script.lines]
            segments, total = build_timeline(script.lines, voice_paths, durations)
        else:
            voice_paths = self.synthesize(script, use_cache=use_cache)
            segments, total = self.plan(script, voice_paths)

        # 2) ナレーション(音声 + SE)を1本化
        narration = str(self._work("narration.wav"))
        narr_cmd = audio.build_narration_cmd(
            segments, total, narration, ffmpeg=self.config.ffmpeg
        )

        # 3) 字幕(ASS)を生成。音声のみ出力なら焼き込みは省く
        out_ext = Path(script.output).suffix.lower()
        ass_path: str | None = None
        if out_ext not in audio._AUDIO_EXTS:
            ass = self._work("subtitles.ass")
            subtitles.write_ass(
                segments, script.subtitle_style, script.video.width,
                script.video.height, ass,
            )
            subtitles.write_srt(segments, self._work("subtitles.srt"))
            ass_path = str(ass)

        # 4) 最終合成
        render_cmd = audio.build_render_cmd(
            script, narration, ass_path, total, ffmpeg=self.config.ffmpeg
        )

        if dry_run:
            print("# ナレーション結合:")
            print(" ".join(_quote(a) for a in narr_cmd))
            print("\n# 最終合成:")
            print(" ".join(_quote(a) for a in render_cmd))
            print(f"\n# 想定尺: {total + script.video.tail:.2f}s / 出力: {script.output}")
            return script.output

        Path(script.output).parent.mkdir(parents=True, exist_ok=True)
        audio.run_ffmpeg(narr_cmd, verbose=self.verbose)
        audio.run_ffmpeg(render_cmd, verbose=self.verbose)
        return script.output


def _quote(arg: str) -> str:
    """dry-run 表示用の最小限のシェルクオート。"""
    if arg and all(c.isalnum() or c in "-_./:=" for c in arg):
        return arg
    return "'" + arg.replace("'", "'\\''") + "'"
