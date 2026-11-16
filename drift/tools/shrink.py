"""image/ の PNG を 256 色にへらして軽くする(透明はそのまま)。gen-images.js のあとに実行する。"""
import glob
import os
from PIL import Image

for f in glob.glob(os.path.join(os.path.dirname(__file__), "..", "image", "*.png")):
    im = Image.open(f).convert("RGBA")
    q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(f, optimize=True)
