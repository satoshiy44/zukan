"""共通ユーティリティ。

manga-short-video-maker の全スクリプトが利用する共通処理をまとめる。

方針:
- 可能な限り標準ライブラリを使う（YAML のみ PyYAML に依存）。
- FFmpeg / ffprobe / VOICEVOX などの外部コマンドはリスト形式で実行し、
  シェルインジェクションを避ける。
- subprocess のエラーは握りつぶさず、日本語の分かりやすいメッセージで再送出する。
- 型ヒントを付け、関数を小さく保つ。
"""

from __future__ import annotations

import copy
import csv
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    import yaml
except ImportError as exc:  # pragma: no cover - 環境依存
    raise SystemExit(
        "PyYAML が見つかりません。`pip install -r requirements.txt` を実行してください。"
    ) from exc


# ---------------------------------------------------------------------------
# 例外
# ---------------------------------------------------------------------------
class MangaShortError(Exception):
    """このスキル固有のエラー。日本語メッセージを保持する。"""


# ---------------------------------------------------------------------------
# CSV の必須列
# ---------------------------------------------------------------------------
REQUIRED_CSV_COLUMNS: Tuple[str, ...] = (
    "id",
    "role",
    "voicevox_name",
    "voicevox_style",
    "text",
    "image",
)

OPTIONAL_CSV_COLUMNS: Tuple[str, ...] = (
    "section",
    "character",
    "motion",
    "effect",
    "sfx",
    "duration_override",
    "subtitle",
    "notes",
    "focus_x",
    "focus_y",
    "focus_scale",
)

VALID_MOTIONS: Tuple[str, ...] = (
    "none",
    "zoom_in",
    "zoom_out",
    "pan_left",
    "pan_right",
    "pan_up",
    "pan_down",
    "face_zoom",
    "random_slow",
)

VALID_EFFECTS: Tuple[str, ...] = (
    "none",
    "flash",
    "shake",
    "soft_glow",
    "blur",
    "vignette",
    "darken",
    "red_tint",
    "blue_tint",
    "speed_lines",
    "glitch",
)

VALID_FIT_MODES: Tuple[str, ...] = ("contain_blur", "cover", "contain_black")


# ---------------------------------------------------------------------------
# デフォルト設定（project.yaml が欠けている場合の補完に使う）
# ---------------------------------------------------------------------------
DEFAULT_CONFIG: Dict[str, Any] = {
    "project_name": "manga_short",
    "output_filename": "manga_short.mp4",
    "video": {
        "width": 1080,
        "height": 1920,
        "fps": 30,
        "video_codec": "libx264",
        "audio_codec": "aac",
        "video_bitrate": "15M",
        "audio_bitrate": "192k",
        "pixel_format": "yuv420p",
        "fit_mode": "contain_blur",
        "background_blur": 20,
    },
    "voicevox": {
        "engine_url": "http://127.0.0.1:50021",
        "cache": True,
        "default_speed": 1.15,
        "default_pitch": 0.0,
        "default_intonation": 1.05,
        "default_volume": 1.0,
        "pre_phoneme_length": 0.05,
        "post_phoneme_length": 0.12,
        "timeout": 60,
    },
    "subtitles": {
        "enabled": True,
        "font": "Hiragino Sans",
        "font_size": 70,
        "max_lines": 2,
        "max_chars_per_line": 16,
        "position_y": 1450,
        "outline_width": 6,
        "shadow": True,
        "safe_margin_x": 80,
        "speaker_colors": {
            "narrator": "white",
            "male": "white",
            "female": "white",
            "other": "white",
        },
    },
    "audio": {
        "bgm_volume": 0.10,
        "voice_volume": 1.0,
        "sfx_volume": 0.35,
        "normalize": True,
        "target_lufs": -14.0,
        "true_peak": -1.5,
        "ducking": True,
        "bgm_fade": 0.8,
    },
    "editing": {
        "default_motion": "zoom_in",
        "default_zoom_start": 1.00,
        "default_zoom_end": 1.12,
        "transition_duration": 0.10,
        "minimum_scene_duration": 0.8,
        "maximum_scene_duration": 5.0,
        "enable_auto_cut": True,
        "random_seed": 42,
    },
    "branding": {
        "intro_enabled": False,
        "outro_enabled": False,
        "watermark_enabled": False,
    },
    "upload_text": {
        "title_template": "【{situation}】の【{character}】の【{action}】がヤバすぎた…!!",
        "hashtags": ["shorts", "漫画", "漫画紹介"],
    },
}


# ---------------------------------------------------------------------------
# 設定読み込み
# ---------------------------------------------------------------------------
def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """base を override で再帰的に上書きした新しい辞書を返す。"""
    result = copy.deepcopy(base)
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def load_config(project_dir: Path) -> Dict[str, Any]:
    """project.yaml を読み込み、デフォルト値で補完して返す。

    軽微な設定不足はデフォルト値で補う。ファイル自体が無ければエラー。
    """
    yaml_path = project_dir / "project.yaml"
    if not yaml_path.exists():
        raise MangaShortError(
            f"project.yaml が見つかりません: {yaml_path}\n"
            "templates/project.yaml をコピーして作成してください。"
        )
    try:
        with yaml_path.open("r", encoding="utf-8") as fh:
            user_conf = yaml.safe_load(fh) or {}
    except UnicodeDecodeError as exc:
        raise MangaShortError(
            f"project.yaml の文字コードが不正です（UTF-8 で保存してください）: {yaml_path}"
        ) from exc
    except yaml.YAMLError as exc:
        raise MangaShortError(f"project.yaml の書式が不正です: {exc}") from exc
    if not isinstance(user_conf, dict):
        raise MangaShortError("project.yaml のトップレベルはマップ（key: value）にしてください。")
    return deep_merge(DEFAULT_CONFIG, user_conf)


# ---------------------------------------------------------------------------
# CSV 読み込み
# ---------------------------------------------------------------------------
@dataclass
class ScriptRow:
    """script.csv の 1 行 = 1 セリフ / ナレーション単位。"""

    id: str
    role: str
    voicevox_name: str
    voicevox_style: str
    text: str
    image: str
    section: str = ""
    character: str = ""
    motion: str = "zoom_in"
    effect: str = "none"
    sfx: str = ""
    duration_override: Optional[float] = None
    subtitle: str = ""
    notes: str = ""
    focus_x: Optional[float] = None
    focus_y: Optional[float] = None
    focus_scale: Optional[float] = None

    @property
    def subtitle_text(self) -> str:
        """字幕テキスト。空欄なら text を流用する。"""
        return self.subtitle.strip() if self.subtitle.strip() else self.text


def _parse_float(value: str) -> Optional[float]:
    value = (value or "").strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def read_script(project_dir: Path) -> List[ScriptRow]:
    """script.csv を読み込み ScriptRow のリストを返す。

    - UTF-8 を基本とし、BOM 付きにも対応する。
    - 必須列が無い場合はエラー終了する。
    - 半角コンマは CSV の quoting で処理される（text 内のコンマは "..." で囲む）。
    """
    csv_path = project_dir / "script.csv"
    if not csv_path.exists():
        raise MangaShortError(
            f"script.csv が見つかりません: {csv_path}\n"
            "台本が無いと動画を生成できません。"
        )
    try:
        raw = csv_path.read_bytes()
    except OSError as exc:
        raise MangaShortError(f"script.csv を読み込めません: {exc}") from exc

    text = _decode_csv_bytes(raw, csv_path)
    reader = csv.DictReader(text.splitlines())
    if reader.fieldnames is None:
        raise MangaShortError("script.csv にヘッダー行がありません。")

    fields = [f.strip() for f in reader.fieldnames]
    missing = [c for c in REQUIRED_CSV_COLUMNS if c not in fields]
    if missing:
        raise MangaShortError(
            "script.csv に必須列がありません: " + ", ".join(missing)
        )

    rows: List[ScriptRow] = []
    seen_ids: set[str] = set()
    for lineno, raw_row in enumerate(reader, start=2):
        row = {(k.strip() if k else k): (v if v is not None else "") for k, v in raw_row.items()}
        rid = (row.get("id") or "").strip()
        if not rid:
            # 空行はスキップ
            if not any((row.get(c) or "").strip() for c in REQUIRED_CSV_COLUMNS):
                continue
            raise MangaShortError(f"script.csv {lineno} 行目: id が空です。")
        if len(rid) < 3 or not rid.isdigit():
            raise MangaShortError(
                f"script.csv {lineno} 行目: id は 3 桁以上の連番にしてください（現在: '{rid}'）。"
            )
        if rid in seen_ids:
            raise MangaShortError(f"script.csv: id '{rid}' が重複しています。")
        seen_ids.add(rid)

        rows.append(
            ScriptRow(
                id=rid,
                role=(row.get("role") or "narrator").strip() or "narrator",
                voicevox_name=(row.get("voicevox_name") or "").strip(),
                voicevox_style=(row.get("voicevox_style") or "").strip(),
                text=(row.get("text") or "").strip(),
                image=(row.get("image") or "").strip(),
                section=(row.get("section") or "").strip(),
                character=(row.get("character") or "").strip(),
                motion=(row.get("motion") or "zoom_in").strip() or "zoom_in",
                effect=(row.get("effect") or "none").strip() or "none",
                sfx=(row.get("sfx") or "").strip(),
                duration_override=_parse_float(row.get("duration_override", "")),
                subtitle=(row.get("subtitle") or "").strip(),
                notes=(row.get("notes") or "").strip(),
                focus_x=_parse_float(row.get("focus_x", "")),
                focus_y=_parse_float(row.get("focus_y", "")),
                focus_scale=_parse_float(row.get("focus_scale", "")),
            )
        )
    if not rows:
        raise MangaShortError("script.csv に有効な行がありません。")
    return rows


def _decode_csv_bytes(raw: bytes, path: Path) -> str:
    """CSV バイト列を UTF-8(BOM可) / CP932 の順で復号する。"""
    for encoding in ("utf-8-sig", "utf-8", "cp932"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise MangaShortError(
        f"script.csv の文字コードを判定できません（UTF-8 で保存してください）: {path}"
    )


def filter_rows_by_id(
    rows: Sequence[ScriptRow], start_id: Optional[str], end_id: Optional[str]
) -> List[ScriptRow]:
    """--start-id / --end-id で行を範囲抽出する。"""
    out = list(rows)
    if start_id:
        out = [r for r in out if r.id >= start_id]
    if end_id:
        out = [r for r in out if r.id <= end_id]
    return out


# ---------------------------------------------------------------------------
# ファイル名の安全化
# ---------------------------------------------------------------------------
_UNSAFE_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def sanitize_filename(name: str, max_length: int = 40) -> str:
    """ファイル名に使えない文字を除去し、長さを制限する。

    日本語はそのまま残す。空白は詰めない（保持）が前後は削る。
    """
    name = unicodedata.normalize("NFC", name)
    name = _UNSAFE_CHARS.sub("", name)
    name = name.replace("\n", " ").replace("\t", " ").strip()
    name = re.sub(r"\s+", " ", name)
    if len(name) > max_length:
        name = name[:max_length]
    return name or "untitled"


def voice_filename(row: ScriptRow) -> str:
    """音声ファイル名を組み立てる。例: 001_青山龍星_自由すぎる職場.wav"""
    snippet = sanitize_filename(row.text[:12], max_length=16)
    name = sanitize_filename(row.voicevox_name, max_length=16)
    return f"{row.id}_{name}_{snippet}.wav"


# ---------------------------------------------------------------------------
# キャッシュ用ハッシュ
# ---------------------------------------------------------------------------
def voice_cache_key(
    *,
    text: str,
    speaker_id: int,
    speed: float,
    pitch: float,
    intonation: float,
    volume: float,
    pre_phoneme: float,
    post_phoneme: float,
) -> str:
    """話者・スタイル・文章・設定が同一なら同じキーになるハッシュ。"""
    payload = json.dumps(
        {
            "text": text,
            "speaker_id": speaker_id,
            "speed": round(speed, 4),
            "pitch": round(pitch, 4),
            "intonation": round(intonation, 4),
            "volume": round(volume, 4),
            "pre": round(pre_phoneme, 4),
            "post": round(post_phoneme, 4),
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# 外部バイナリ
# ---------------------------------------------------------------------------
def find_binary(name: str) -> Optional[str]:
    """PATH から実行ファイルを探す。見つからなければ None。"""
    return shutil.which(name)


def require_ffmpeg() -> str:
    path = find_binary("ffmpeg")
    if not path:
        raise MangaShortError(
            "FFmpeg が見つかりません。\n"
            "  Homebrew での導入例:\n"
            "    brew install ffmpeg\n"
            "（許可なくインストールは実行しません。上記コマンドを手動で実行してください。）"
        )
    return path


def require_ffprobe() -> str:
    path = find_binary("ffprobe")
    if not path:
        raise MangaShortError(
            "ffprobe が見つかりません（通常 FFmpeg に同梱されています）。\n"
            "  Homebrew での導入例:\n"
            "    brew install ffmpeg"
        )
    return path


def run_command(
    cmd: Sequence[str],
    *,
    log: Optional[logging.Logger] = None,
    capture: bool = True,
    check: bool = True,
) -> subprocess.CompletedProcess:
    """コマンドをリスト形式で実行する（shell=False）。

    エラーは握りつぶさず MangaShortError に変換して送出する。
    """
    if log is not None:
        log.debug("実行: %s", " ".join(_shell_quote(c) for c in cmd))
    try:
        proc = subprocess.run(
            list(cmd),
            capture_output=capture,
            text=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise MangaShortError(f"コマンドが見つかりません: {cmd[0]}") from exc
    if check and proc.returncode != 0:
        tail = (proc.stderr or "")[-1500:]
        raise MangaShortError(
            f"コマンドが失敗しました（exit={proc.returncode}）: {cmd[0]}\n{tail}"
        )
    return proc


def _shell_quote(value: str) -> str:
    if re.search(r"[\s'\"|&;<>()$`\\]", value):
        return "'" + value.replace("'", "'\\''") + "'"
    return value


# ---------------------------------------------------------------------------
# ffprobe
# ---------------------------------------------------------------------------
def ffprobe_json(path: Path, log: Optional[logging.Logger] = None) -> Dict[str, Any]:
    """ffprobe の JSON 出力（format + streams）を返す。"""
    ffprobe = require_ffprobe()
    cmd = [
        ffprobe,
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(path),
    ]
    proc = run_command(cmd, log=log)
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise MangaShortError(f"ffprobe の出力を解釈できません: {path}") from exc


def audio_duration(path: Path, log: Optional[logging.Logger] = None) -> float:
    """音声/動画ファイルの尺（秒）を ffprobe で取得する。"""
    info = ffprobe_json(path, log=log)
    fmt = info.get("format", {})
    dur = fmt.get("duration")
    if dur is None:
        for stream in info.get("streams", []):
            if stream.get("duration"):
                dur = stream["duration"]
                break
    if dur is None:
        raise MangaShortError(f"尺を取得できません: {path}")
    return float(dur)


@dataclass
class ProbeResult:
    """出力動画の自動検証結果。"""

    ok: bool
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    duration: Optional[float] = None
    has_audio: bool = False
    file_size: int = 0
    problems: List[str] = field(default_factory=list)


def parse_fps(rate: str) -> Optional[float]:
    """'30/1' のような比率文字列を float に変換する。"""
    if not rate:
        return None
    if "/" in rate:
        num, _, den = rate.partition("/")
        try:
            d = float(den)
            return float(num) / d if d else None
        except ValueError:
            return None
    try:
        return float(rate)
    except ValueError:
        return None


def verify_output(
    info: Dict[str, Any],
    file_size: int,
    *,
    expect_width: int = 1080,
    expect_height: int = 1920,
    expect_fps: float = 30.0,
) -> ProbeResult:
    """ffprobe の JSON から出力動画を検証する（純粋関数・テスト可能）。

    ffprobe 実行と分離しているため、モック JSON でテストできる。
    """
    result = ProbeResult(ok=True, file_size=file_size)
    streams = info.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if video is None:
        result.problems.append("映像トラックがありません。")
    else:
        result.width = video.get("width")
        result.height = video.get("height")
        result.video_codec = video.get("codec_name")
        result.fps = parse_fps(video.get("avg_frame_rate") or video.get("r_frame_rate") or "")
        if result.width != expect_width or result.height != expect_height:
            result.problems.append(
                f"解像度が {result.width}x{result.height} です（期待値 {expect_width}x{expect_height}）。"
            )
        if result.video_codec not in ("h264", "libx264"):
            result.problems.append(f"映像コーデックが H.264 ではありません: {result.video_codec}")
        if result.fps is None or abs(result.fps - expect_fps) > 0.5:
            result.problems.append(f"フレームレートが {result.fps} です（期待値 {expect_fps}）。")

    if audio is None:
        result.problems.append("音声トラックがありません。")
    else:
        result.has_audio = True
        result.audio_codec = audio.get("codec_name")
        if result.audio_codec != "aac":
            result.problems.append(f"音声コーデックが AAC ではありません: {result.audio_codec}")

    fmt = info.get("format", {})
    dur = fmt.get("duration")
    if dur is not None:
        result.duration = float(dur)
        if result.duration <= 0:
            result.problems.append("動画尺が 0 秒です。")
    else:
        result.problems.append("動画尺を取得できません。")

    if file_size <= 0:
        result.problems.append("出力ファイルが空です。")

    result.ok = not result.problems
    return result


# ---------------------------------------------------------------------------
# ロギング
# ---------------------------------------------------------------------------
def setup_logger(log_path: Path, debug: bool = False) -> logging.Logger:
    """ファイルとコンソールの両方に出力するロガーを構成する。"""
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("manga_short")
    logger.handlers.clear()
    logger.setLevel(logging.DEBUG)

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    )
    logger.addHandler(file_handler)

    console = logging.StreamHandler()
    console.setLevel(logging.DEBUG if debug else logging.INFO)
    console.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(console)
    return logger


# ---------------------------------------------------------------------------
# プロジェクトのパス
# ---------------------------------------------------------------------------
@dataclass
class ProjectPaths:
    """プロジェクト内の各ディレクトリへのパス。"""

    root: Path
    images: Path
    audio: Path
    bgm: Path
    sfx: Path
    cache: Path
    output: Path

    @classmethod
    def from_root(cls, root: Path) -> "ProjectPaths":
        return cls(
            root=root,
            images=root / "images",
            audio=root / "audio",
            bgm=root / "bgm",
            sfx=root / "sfx",
            cache=root / "cache",
            output=root / "output",
        )

    def ensure(self) -> None:
        for d in (self.audio, self.cache, self.output):
            d.mkdir(parents=True, exist_ok=True)


def resolve_project_dir(arg: str) -> Path:
    """引数のプロジェクトディレクトリを解決する。"""
    path = Path(arg).expanduser().resolve()
    if not path.exists():
        raise MangaShortError(f"プロジェクトフォルダが見つかりません: {path}")
    if not path.is_dir():
        raise MangaShortError(f"プロジェクトはフォルダで指定してください: {path}")
    return path
