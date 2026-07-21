"""コマンドラインインタフェース。

  python -m zukan build script.yaml          # 台本→動画/音声を生成
  python -m zukan build script.yaml --dry-run # ffmpeg コマンドの確認だけ
  python -m zukan doctor                       # VOICEVOX/ffmpeg の疎通確認
  python -m zukan speakers                      # 話者ID一覧
"""

from __future__ import annotations

import argparse
import shutil
import sys

from .config import Config
from .pipeline import Pipeline
from .script_loader import ScriptError, load_script
from .voicevox import VoicevoxClient


def _cmd_build(args: argparse.Namespace) -> int:
    config = Config.load(args.config)
    try:
        script = load_script(args.script, config)
    except ScriptError as e:
        print(f"台本エラー: {e}", file=sys.stderr)
        return 2
    if args.output:
        script.output = args.output

    pipeline = Pipeline(config, verbose=args.verbose)
    try:
        out = pipeline.build(script, use_cache=not args.no_cache, dry_run=args.dry_run)
    except Exception as e:  # VoicevoxError / FfmpegError / RuntimeError 等
        print(f"エラー: {e}", file=sys.stderr)
        return 1
    if not args.dry_run:
        print(f"完成: {out}")
    return 0


def _cmd_doctor(args: argparse.Namespace) -> int:
    config = Config.load(args.config)
    ok = True

    # ffmpeg / ffprobe
    for name, binpath in (("ffmpeg", config.ffmpeg), ("ffprobe", config.ffprobe)):
        found = shutil.which(binpath)
        mark = "OK " if found else "NG "
        print(f"[{mark}] {name}: {found or '見つかりません'}")
        if name == "ffmpeg" and not found:
            ok = False

    # VOICEVOX
    client = VoicevoxClient(config)
    if client.is_alive():
        try:
            print(f"[OK ] VOICEVOX: {config.voicevox_url} (version {client.version()})")
        except Exception:
            print(f"[OK ] VOICEVOX: {config.voicevox_url}")
    else:
        print(f"[NG ] VOICEVOX: {config.voicevox_url} に接続できません")
        ok = False

    return 0 if ok else 1


def _cmd_speakers(args: argparse.Namespace) -> int:
    config = Config.load(args.config)
    client = VoicevoxClient(config)
    if not client.is_alive():
        print(f"VOICEVOX に接続できません: {config.voicevox_url}", file=sys.stderr)
        return 1
    for sp in client.speakers():
        name = sp.get("name", "?")
        for style in sp.get("styles", []):
            print(f"{style.get('id'):>4}  {name} / {style.get('name')}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="zukan",
        description="YAML → VOICEVOX → ffmpeg 音声/動画生成パイプライン",
    )
    p.add_argument("-c", "--config", help="config.yaml のパス")
    sub = p.add_subparsers(dest="command", required=True)

    b = sub.add_parser("build", help="台本から動画/音声を生成する")
    b.add_argument("script", help="台本ファイル(.yaml / .csv)")
    b.add_argument("-o", "--output", help="出力パスを上書き")
    b.add_argument("--dry-run", action="store_true", help="ffmpeg コマンドを表示するだけ")
    b.add_argument("--no-cache", action="store_true", help="音声合成キャッシュを使わない")
    b.add_argument("-v", "--verbose", action="store_true", help="詳細ログ")
    b.set_defaults(func=_cmd_build)

    d = sub.add_parser("doctor", help="VOICEVOX/ffmpeg の疎通確認")
    d.set_defaults(func=_cmd_doctor)

    s = sub.add_parser("speakers", help="話者ID一覧を表示")
    s.set_defaults(func=_cmd_speakers)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
