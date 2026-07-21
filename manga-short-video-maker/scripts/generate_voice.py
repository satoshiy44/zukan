"""VOICEVOX 音声生成。

処理の流れ:
1. /speakers で話者・スタイル一覧を取得
2. キャラクター名 + スタイル名から speaker ID を解決（ソースへ固定しない）
3. audio_query でクエリ生成
4. 話速・音高・抑揚・音量・前後無音を調整
5. synthesis で WAV を生成し保存
6. ハッシュキャッシュで再生成を回避

VOICEVOX Engine が無い環境でもテストできるよう、HTTP 部分は
VoicevoxClient に閉じ込め、話者解決ロジック（純粋関数）を分離している。
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import utils  # type: ignore
else:  # pragma: no cover
    from . import utils

from utils import MangaShortError, ScriptRow  # noqa: E402


# ---------------------------------------------------------------------------
# 話者解決（純粋関数・テスト可能）
# ---------------------------------------------------------------------------
def resolve_speaker_id(
    speakers: Sequence[Dict[str, Any]],
    character_name: str,
    style_name: str,
) -> Tuple[int, List[str]]:
    """/speakers のレスポンスから speaker(style) ID を解決する。

    戻り値: (speaker_id, 警告メッセージのリスト)

    - キャラクター名が見つからなければエラー。
    - スタイル名が見つからなければ、そのキャラクターの最初のスタイルを使い警告。
    """
    warnings: List[str] = []
    target = next(
        (s for s in speakers if s.get("name") == character_name), None
    )
    if target is None:
        available = "、".join(s.get("name", "?") for s in speakers)
        raise MangaShortError(
            f"指定された話者が見つかりません: '{character_name}'\n"
            f"利用可能な話者: {available}"
        )

    styles = target.get("styles", [])
    if not styles:
        raise MangaShortError(f"話者 '{character_name}' にスタイルがありません。")

    chosen = next((st for st in styles if st.get("name") == style_name), None)
    if chosen is None:
        chosen = styles[0]
        warnings.append(
            f"話者 '{character_name}' にスタイル '{style_name}' が見つかりません。"
            f"最初のスタイル '{chosen.get('name')}' を使用します。"
        )
    return int(chosen["id"]), warnings


# ---------------------------------------------------------------------------
# 読み仮名・固有名詞辞書によるテキスト前処理
# ---------------------------------------------------------------------------
def apply_reading_dict(text: str, reading_dict: Dict[str, str]) -> str:
    """読み間違い対策として辞書で置換する（長いキーから順に適用）。"""
    for key in sorted(reading_dict.keys(), key=len, reverse=True):
        text = text.replace(key, reading_dict[key])
    return text


# ---------------------------------------------------------------------------
# VOICEVOX HTTP クライアント
# ---------------------------------------------------------------------------
class VoicevoxClient:
    """VOICEVOX Engine への薄い HTTP クライアント。"""

    def __init__(self, engine_url: str, timeout: int = 60) -> None:
        self.engine_url = engine_url.rstrip("/")
        self.timeout = timeout
        self._speakers: Optional[List[Dict[str, Any]]] = None

    # -- 低レベル -----------------------------------------------------------
    def _get(self, path: str) -> Any:
        url = f"{self.engine_url}{path}"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _post(
        self, path: str, *, params: Dict[str, Any], body: Optional[bytes] = None
    ) -> bytes:
        query = urllib.parse.urlencode(params)
        url = f"{self.engine_url}{path}?{query}"
        headers = {"Content-Type": "application/json"} if body else {}
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return resp.read()

    # -- 公開 API -----------------------------------------------------------
    def check_alive(self) -> None:
        """Engine の起動を確認する。失敗時は分かりやすいエラー。"""
        try:
            self._get("/version")
        except (urllib.error.URLError, OSError) as exc:
            raise MangaShortError(
                "VOICEVOX Engine が起動していません。\n"
                f"  接続先: {self.engine_url}\n"
                "  VOICEVOX アプリを起動するか、Engine を立ち上げてください。\n"
                "  既定の起動先: http://127.0.0.1:50021"
            ) from exc

    def get_speakers(self) -> List[Dict[str, Any]]:
        if self._speakers is None:
            try:
                self._speakers = self._get("/speakers")
            except (urllib.error.URLError, OSError) as exc:
                raise MangaShortError("話者一覧の取得に失敗しました。") from exc
        return self._speakers

    def audio_query(self, text: str, speaker_id: int) -> Dict[str, Any]:
        try:
            raw = self._post(
                "/audio_query", params={"text": text, "speaker": speaker_id}
            )
        except (urllib.error.URLError, OSError) as exc:
            raise MangaShortError(f"audio_query に失敗しました: {text[:20]}") from exc
        return json.loads(raw.decode("utf-8"))

    def synthesis(self, query: Dict[str, Any], speaker_id: int) -> bytes:
        try:
            return self._post(
                "/synthesis",
                params={"speaker": speaker_id},
                body=json.dumps(query, ensure_ascii=False).encode("utf-8"),
            )
        except (urllib.error.URLError, OSError) as exc:
            raise MangaShortError("音声生成（synthesis）に失敗しました。") from exc


def tune_query(query: Dict[str, Any], voice_conf: Dict[str, Any]) -> Dict[str, Any]:
    """audio_query の結果に話速・音高・抑揚・音量・前後無音を反映する。"""
    query["speedScale"] = float(voice_conf.get("default_speed", 1.0))
    query["pitchScale"] = float(voice_conf.get("default_pitch", 0.0))
    query["intonationScale"] = float(voice_conf.get("default_intonation", 1.0))
    query["volumeScale"] = float(voice_conf.get("default_volume", 1.0))
    query["prePhonemeLength"] = float(voice_conf.get("pre_phoneme_length", 0.05))
    query["postPhonemeLength"] = float(voice_conf.get("post_phoneme_length", 0.1))
    return query


# ---------------------------------------------------------------------------
# 生成のオーケストレーション
# ---------------------------------------------------------------------------
@dataclass
class VoiceResult:
    """1 行分の音声生成結果。"""

    row_id: str
    wav_path: Path
    from_cache: bool
    warnings: List[str]


def generate_voices(
    rows: Sequence[ScriptRow],
    config: Dict[str, Any],
    paths: utils.ProjectPaths,
    *,
    client: Optional[VoicevoxClient] = None,
    force: bool = False,
    reading_dict: Optional[Dict[str, str]] = None,
    log: Optional[Any] = None,
) -> List[VoiceResult]:
    """全行の音声を生成する。キャッシュを活用し、失敗しても他行を続行できる形にする。"""
    voice_conf = config.get("voicevox", {})
    reading_dict = reading_dict or {}
    use_cache = bool(voice_conf.get("cache", True))

    if client is None:
        client = VoicevoxClient(
            voice_conf.get("engine_url", "http://127.0.0.1:50021"),
            timeout=int(voice_conf.get("timeout", 60)),
        )
        client.check_alive()

    speakers = client.get_speakers()
    paths.audio.mkdir(parents=True, exist_ok=True)
    paths.cache.mkdir(parents=True, exist_ok=True)

    results: List[VoiceResult] = []
    for row in rows:
        warnings: List[str] = []
        speaker_id, warns = resolve_speaker_id(
            speakers, row.voicevox_name, row.voicevox_style
        )
        warnings.extend(warns)

        spoken = apply_reading_dict(row.text, reading_dict)
        wav_path = paths.audio / utils.voice_filename(row)

        cache_key = utils.voice_cache_key(
            text=spoken,
            speaker_id=speaker_id,
            speed=float(voice_conf.get("default_speed", 1.0)),
            pitch=float(voice_conf.get("default_pitch", 0.0)),
            intonation=float(voice_conf.get("default_intonation", 1.0)),
            volume=float(voice_conf.get("default_volume", 1.0)),
            pre_phoneme=float(voice_conf.get("pre_phoneme_length", 0.05)),
            post_phoneme=float(voice_conf.get("post_phoneme_length", 0.1)),
        )
        cache_file = paths.cache / f"voice_{cache_key}.wav"

        if use_cache and not force and cache_file.exists():
            _copy(cache_file, wav_path)
            results.append(VoiceResult(row.id, wav_path, True, warnings))
            if log:
                log.info("音声キャッシュ利用: %s", wav_path.name)
            continue

        query = client.audio_query(spoken, speaker_id)
        query = tune_query(query, voice_conf)
        wav_bytes = client.synthesis(query, speaker_id)

        wav_path.write_bytes(wav_bytes)
        if use_cache:
            cache_file.write_bytes(wav_bytes)
        results.append(VoiceResult(row.id, wav_path, False, warnings))
        if log:
            log.info("音声生成: %s", wav_path.name)
    return results


def _copy(src: Path, dst: Path) -> None:
    dst.write_bytes(src.read_bytes())


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="VOICEVOX 音声のみを生成する")
    parser.add_argument("project_dir", help="プロジェクトフォルダ")
    parser.add_argument("--force", action="store_true", help="キャッシュを無視して再生成")
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
        reading_dict = load_reading_dict(project_dir)

        results = generate_voices(
            rows, config, paths, force=args.force, reading_dict=reading_dict, log=log
        )
        cached = sum(1 for r in results if r.from_cache)
        log.info(
            "完了: %d 件（新規 %d / キャッシュ %d）",
            len(results),
            len(results) - cached,
            cached,
        )
        for r in results:
            for w in r.warnings:
                log.warning("警告[%s]: %s", r.row_id, w)
        return 0
    except MangaShortError as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1


def load_reading_dict(project_dir: Path) -> Dict[str, str]:
    """reading_dict.json / yomi_dict.json があれば読み仮名辞書として読み込む。"""
    for name in ("reading_dict.json", "yomi_dict.json"):
        path = project_dir / name
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return {str(k): str(v) for k, v in data.items()}
            except (json.JSONDecodeError, OSError):
                continue
    return {}


if __name__ == "__main__":
    raise SystemExit(main())
