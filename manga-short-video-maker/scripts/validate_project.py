"""プロジェクトの事前検証のみを行う（動画は生成しない）。

環境（FFmpeg / ffprobe / VOICEVOX）と素材（画像 / 効果音 / BGM）を点検し、
不足を分かりやすい日本語で一覧表示する。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional, Sequence

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import utils  # type: ignore
    import generate_voice  # type: ignore
    import build_video  # type: ignore
else:  # pragma: no cover
    from . import utils, generate_voice, build_video

from utils import MangaShortError  # noqa: E402


def check_environment() -> tuple[list[str], list[str]]:
    """FFmpeg / ffprobe / VOICEVOX の有無を確認する。"""
    fatal: list[str] = []
    info: list[str] = []
    if utils.find_binary("ffmpeg"):
        info.append("FFmpeg: OK")
    else:
        fatal.append(
            "FFmpeg が見つかりません。導入例: brew install ffmpeg（許可なくインストールしません）"
        )
    if utils.find_binary("ffprobe"):
        info.append("ffprobe: OK")
    else:
        fatal.append("ffprobe が見つかりません。導入例: brew install ffmpeg")
    return fatal, info


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="プロジェクトの検証のみ実行する")
    parser.add_argument("project_dir", help="プロジェクトフォルダ")
    parser.add_argument("--start-id", default=None)
    parser.add_argument("--end-id", default=None)
    parser.add_argument("--check-voicevox", action="store_true", help="VOICEVOX Engine の起動も確認")
    args = parser.parse_args(argv)

    try:
        project_dir = utils.resolve_project_dir(args.project_dir)
        config = utils.load_config(project_dir)
        paths = utils.ProjectPaths.from_root(project_dir)
        rows = utils.read_script(project_dir)
        rows = utils.filter_rows_by_id(rows, args.start_id, args.end_id)
    except MangaShortError as exc:
        print(f"エラー: {exc}", file=sys.stderr)
        return 1

    print("=== 環境チェック ===")
    env_fatal, env_info = check_environment()
    for i in env_info:
        print(f"  ✓ {i}")
    for f in env_fatal:
        print(f"  ✗ {f}")

    if args.check_voicevox:
        voice_conf = config.get("voicevox", {})
        client = generate_voice.VoicevoxClient(
            voice_conf.get("engine_url", "http://127.0.0.1:50021")
        )
        try:
            client.check_alive()
            speakers = client.get_speakers()
            print(f"  ✓ VOICEVOX Engine: OK（話者 {len(speakers)} 名）")
            # 台本で使う話者/スタイルが解決できるか
            for row in rows:
                try:
                    _, warns = generate_voice.resolve_speaker_id(
                        speakers, row.voicevox_name, row.voicevox_style
                    )
                    for w in warns:
                        print(f"  ! [{row.id}] {w}")
                except MangaShortError as exc:
                    print(f"  ✗ [{row.id}] {exc}")
        except MangaShortError as exc:
            print(f"  ✗ {exc}")

    print("\n=== 台本チェック ===")
    print(f"  行数: {len(rows)}")

    print("\n=== 素材チェック ===")
    report = build_video.validate_materials(rows, paths, config)
    if not report.missing_images:
        print("  ✓ 画像: すべて存在")
    else:
        print("  ✗ 画像不足:")
        for m in report.missing_images:
            print(f"      {m}")
    if report.missing_sfx:
        print("  ! 効果音不足:")
        for m in report.missing_sfx:
            print(f"      {m}")
    else:
        print("  ✓ 効果音: 参照分はすべて存在")
    print("  ! BGM: なし" if report.missing_bgm else "  ✓ BGM: あり")

    for w in report.warnings:
        print(f"  ! {w}")

    print("\n=== 結果 ===")
    fatal = env_fatal + report.fatal
    if fatal:
        print("  中止が必要な問題があります:")
        for f in fatal:
            print(f"    - {f}")
        return 1
    print("  ✓ 動画生成を開始できます。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
