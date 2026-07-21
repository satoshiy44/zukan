"""VOICEVOX ローカルAPI(既定 http://127.0.0.1:50021)クライアント。

合成フローは 2 段階:
  1) POST /audio_query  … テキスト+話者から合成用クエリ(JSON)を得る
  2) POST /synthesis    … クエリ+話者から WAV バイト列を得る
speed/pitch 等のパラメータは 1) の返り値を上書きしてから 2) に渡す。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import requests

from .config import Config
from .models import VoiceParams


class VoicevoxError(RuntimeError):
    """VOICEVOX との通信・合成に失敗したときに投げる。"""


class VoicevoxClient:
    def __init__(self, config: Config):
        self._url = config.voicevox_url.rstrip("/")
        self._timeout = config.timeout
        self._session = requests.Session()

    def is_alive(self) -> bool:
        """エンジンが起動しているかを軽く確認する。"""
        try:
            r = self._session.get(f"{self._url}/version", timeout=5)
            return r.ok
        except requests.RequestException:
            return False

    def version(self) -> str:
        r = self._session.get(f"{self._url}/version", timeout=self._timeout)
        r.raise_for_status()
        return r.text.strip().strip('"')

    def speakers(self) -> list[dict[str, Any]]:
        """利用可能な話者一覧(名前 / スタイル名 / ID)。"""
        r = self._session.get(f"{self._url}/speakers", timeout=self._timeout)
        r.raise_for_status()
        return r.json()

    def _audio_query(self, text: str, speaker: int) -> dict[str, Any]:
        r = self._session.post(
            f"{self._url}/audio_query",
            params={"text": text, "speaker": speaker},
            timeout=self._timeout,
        )
        if not r.ok:
            raise VoicevoxError(
                f"audio_query 失敗 (speaker={speaker}): {r.status_code} {r.text[:200]}"
            )
        return r.json()

    @staticmethod
    def _apply_params(query: dict[str, Any], voice: VoiceParams) -> None:
        """audio_query の結果に VoiceParams を反映する(破壊的)。"""
        query["speedScale"] = voice.speed
        query["pitchScale"] = voice.pitch
        query["intonationScale"] = voice.intonation
        query["volumeScale"] = voice.volume
        if voice.pre_phoneme_length is not None:
            query["prePhonemeLength"] = voice.pre_phoneme_length
        if voice.post_phoneme_length is not None:
            query["postPhonemeLength"] = voice.post_phoneme_length

    def _synthesis(self, query: dict[str, Any], speaker: int) -> bytes:
        r = self._session.post(
            f"{self._url}/synthesis",
            params={"speaker": speaker},
            json=query,
            headers={"Content-Type": "application/json"},
            timeout=self._timeout,
        )
        if not r.ok:
            raise VoicevoxError(
                f"synthesis 失敗 (speaker={speaker}): {r.status_code} {r.text[:200]}"
            )
        return r.content

    def synthesize(self, text: str, voice: VoiceParams, out_path: str | Path) -> Path:
        """1発話ぶんを合成して WAV に書き出し、パスを返す。"""
        query = self._audio_query(text, voice.speaker)
        self._apply_params(query, voice)
        wav = self._synthesis(query, voice.speaker)
        out = Path(out_path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(wav)
        return out
