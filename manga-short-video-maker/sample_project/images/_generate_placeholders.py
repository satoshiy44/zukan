"""サンプル用のプレースホルダ画像を生成する（依存ライブラリなし・pure Python）。

実行:
    python3 sample_project/images/_generate_placeholders.py

本番では、必ず使用許諾のある画像に差し替えてください。
このスクリプトは PIL / numpy を使わず、標準ライブラリだけで PNG を書き出します。
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path
from typing import Tuple


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path: Path, width: int, height: int, color: Tuple[int, int, int]) -> None:
    """単色＋斜めグラデーションの縦長 PNG を書き出す。"""
    raw = bytearray()
    r0, g0, b0 = color
    for y in range(height):
        raw.append(0)  # filter type 0
        for x in range(width):
            t = (x + y) / (width + height)
            r = int(r0 * (0.6 + 0.4 * t))
            g = int(g0 * (0.6 + 0.4 * t))
            b = int(b0 * (0.6 + 0.4 * t))
            raw += bytes((min(r, 255), min(g, 255), min(b, 255)))
    compressed = zlib.compress(bytes(raw), 9)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    with path.open("wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(_png_chunk(b"IHDR", ihdr))
        fh.write(_png_chunk(b"IDAT", compressed))
        fh.write(_png_chunk(b"IEND", b""))


def main() -> None:
    here = Path(__file__).resolve().parent
    palette = [
        ("001.png", (60, 90, 160)),
        ("002.png", (160, 90, 70)),
        ("003.png", (150, 70, 130)),
        ("004.png", (70, 140, 110)),
        ("005.png", (120, 110, 60)),
    ]
    # 縦長（漫画コマ想定）。実行時間短縮のため中程度の解像度。
    for name, color in palette:
        write_png(here / name, 720, 1280, color)
        print(f"generated {name}")


if __name__ == "__main__":
    main()
