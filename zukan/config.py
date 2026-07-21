"""接続・環境まわりの設定(VOICEVOX の場所、作業ディレクトリ等)。

台本(script.yaml)は「中身」を、この Config は「環境」を表す。
config.yaml があれば読み、無ければ既定値と環境変数でまかなう。
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class Config:
    voicevox_url: str = "http://127.0.0.1:50021"
    default_speaker: int = 3
    work_dir: str = ".zukan_work"  # 中間ファイル(合成wav等)の置き場
    ffmpeg: str = "ffmpeg"  # ffmpeg 実行ファイル
    ffprobe: str = "ffprobe"  # ffprobe 実行ファイル
    timeout: float = 60.0  # VOICEVOX HTTP タイムアウト(秒)

    @classmethod
    def load(cls, path: Optional[str] = None) -> "Config":
        """config.yaml(任意) → 環境変数 の順に上書きして生成する。"""
        data: dict = {}
        # 明示パス、なければカレントの config.yaml を探す
        candidate = Path(path) if path else Path("config.yaml")
        if candidate.exists():
            with candidate.open(encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}

        cfg = cls(
            voicevox_url=data.get("voicevox_url", cls.voicevox_url),
            default_speaker=int(data.get("default_speaker", cls.default_speaker)),
            work_dir=data.get("work_dir", cls.work_dir),
            ffmpeg=data.get("ffmpeg", cls.ffmpeg),
            ffprobe=data.get("ffprobe", cls.ffprobe),
            timeout=float(data.get("timeout", cls.timeout)),
        )

        # 環境変数が最優先(CI やマシン差の吸収用)
        cfg.voicevox_url = os.environ.get("VOICEVOX_URL", cfg.voicevox_url)
        if "ZUKAN_WORK_DIR" in os.environ:
            cfg.work_dir = os.environ["ZUKAN_WORK_DIR"]
        cfg.ffmpeg = os.environ.get("FFMPEG_BIN", cfg.ffmpeg)
        cfg.ffprobe = os.environ.get("FFPROBE_BIN", cfg.ffprobe)
        return cfg
