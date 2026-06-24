#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
コマ切り抜きShorts 動画生成（土台mp4の自動書き出し）

入力: videos.json （build_spreadsheet.py と同じフォーマット）
出力: 各動画の mp4（縦1080x1920）

フォーマット:
  - 背景: 暗めの星空（bg=海 のときは深い青系）
  - 上=起 / 下=転 の2分割
  - 各コマを reveal_sec かけてフェードで出す → 一拍おく
  - 質問文を上部、オチ/引きを下部に表示

仕上げの微調整は、この mp4 を Vrew に読み込んで行う想定。

使い方:
  python3 render_video.py [videos.json] [出力ディレクトリ]
"""
import json
import math
import os
import random
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

import imageio_ffmpeg

W, H = 1080, 1920
FPS = 24
FONT_PATH = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"

SIDE_MARGIN = 70
GAP = 40            # 上下コマの間
INTRO = 0.6         # 背景+質問文の導入
HOLD_AFTER = 0.8    # 各コマが出きった後の“チラ見せ/一拍”
OUTRO = 1.4         # 最後の余韻


def font(size):
    return ImageFont.truetype(FONT_PATH, size)


def make_background(bg_type):
    """縦グラデ + 星 の背景画像を1枚作る。"""
    base = Image.new("RGB", (W, H))
    px = base.load()
    if bg_type == "海":
        top_c, bot_c = (8, 18, 46), (2, 6, 20)
    else:  # 星空
        top_c, bot_c = (12, 14, 40), (2, 2, 10)
    for y in range(H):
        t = y / (H - 1)
        r = int(top_c[0] + (bot_c[0] - top_c[0]) * t)
        g = int(top_c[1] + (bot_c[1] - top_c[1]) * t)
        b = int(top_c[2] + (bot_c[2] - top_c[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    d = ImageDraw.Draw(base)
    rnd = random.Random(7)
    for _ in range(220):
        x, y = rnd.randint(0, W - 1), rnd.randint(0, H - 1)
        s = rnd.choice([1, 1, 1, 2, 2, 3])
        b = rnd.randint(120, 255)
        d.ellipse([x, y, x + s, y + s], fill=(b, b, min(255, b + 10)))
    return base


def fit_panel(img, max_w, max_h):
    iw, ih = img.size
    scale = min(max_w / iw, max_h / ih)
    return img.resize((max(1, int(iw * scale)), max(1, int(ih * scale))), Image.LANCZOS)


def rounded(img, rad=24):
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], rad, fill=255)
    img.putalpha(mask)
    return img


def draw_center_text(draw, cx, cy, text, fnt, fill=(255, 255, 255)):
    bbox = draw.textbbox((0, 0), text, font=fnt, stroke_width=6)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - w / 2, cy - h / 2), text, font=fnt, fill=fill,
              stroke_width=6, stroke_fill=(0, 0, 0))


def render_one(v, base_dir, out_path):
    bg = make_background(v.get("bg", "星空"))
    reveal = float(v.get("reveal_sec", 4) or 4)

    # コマ読み込み
    def load(key):
        p = v.get(key)
        if not p:
            return None
        p = p if os.path.isabs(p) else os.path.join(base_dir, p)
        return Image.open(p).convert("RGB")

    top_img = load("top_img")
    bot_img = load("bottom_img")

    region_w = W - 2 * SIDE_MARGIN
    region_h = (H - 2 * SIDE_MARGIN - GAP) // 2 - 60  # 文字スペース確保
    top_fit = rounded(fit_panel(top_img, region_w, region_h)) if top_img else None
    bot_fit = rounded(fit_panel(bot_img, region_w, region_h)) if bot_img else None

    top_y = 260
    bot_y = H // 2 + 60

    q_font = font(64)
    hook_font = font(52)
    small = font(40)

    # タイムライン
    t_top0 = INTRO
    t_top1 = t_top0 + reveal
    t_bot0 = t_top1 + HOLD_AFTER
    t_bot1 = t_bot0 + reveal
    total = t_bot1 + HOLD_AFTER + OUTRO
    nframes = int(total * FPS)

    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc = subprocess.Popen(
        [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def alpha(t, t0, t1):
        if t <= t0:
            return 0.0
        if t >= t1:
            return 1.0
        return (t - t0) / (t1 - t0)

    for i in range(nframes):
        t = i / FPS
        frame = bg.copy().convert("RGBA")
        d = ImageDraw.Draw(frame)

        # 質問文（導入でフェードイン）
        qa = alpha(t, 0, INTRO)
        if v.get("question") and qa > 0:
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            draw_center_text(ld, W / 2, 150, v["question"], q_font)
            frame = Image.alpha_composite(frame, Image.blend(
                Image.new("RGBA", (W, H), (0, 0, 0, 0)), layer, qa))

        # 上コマ
        if top_fit is not None:
            a = alpha(t, t_top0, t_top1)
            if a > 0:
                x = (W - top_fit.size[0]) // 2
                tmp = top_fit.copy()
                tmp.putalpha(tmp.getchannel("A").point(lambda p: int(p * a)))
                frame.alpha_composite(tmp, (x, top_y))

        # 下コマ
        if bot_fit is not None:
            a = alpha(t, t_bot0, t_bot1)
            if a > 0:
                x = (W - bot_fit.size[0]) // 2
                tmp = bot_fit.copy()
                tmp.putalpha(tmp.getchannel("A").point(lambda p: int(p * a)))
                frame.alpha_composite(tmp, (x, bot_y))

        # オチ/引き（最後にフェードイン）
        ha = alpha(t, t_bot1 + HOLD_AFTER, total - 0.4)
        if v.get("hook") and ha > 0:
            layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            draw_center_text(ld, W / 2, H - 150, v["hook"], hook_font, fill=(255, 240, 150))
            frame = Image.alpha_composite(frame, Image.blend(
                Image.new("RGBA", (W, H), (0, 0, 0, 0)), layer, ha))

        proc.stdin.write(frame.convert("RGB").tobytes())

    proc.stdin.close()
    proc.wait()
    return out_path


def main():
    json_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "videos.json")
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(here), "出力動画")
    os.makedirs(out_dir, exist_ok=True)
    base_dir = os.path.dirname(os.path.abspath(json_path))
    with open(json_path, encoding="utf-8") as f:
        videos = json.load(f)
    for v in videos:
        out = os.path.join(out_dir, f"{v.get('no','out')}.mp4")
        print("生成中:", out)
        render_one(v, base_dir, out)
        print("完了:", out)


if __name__ == "__main__":
    main()
