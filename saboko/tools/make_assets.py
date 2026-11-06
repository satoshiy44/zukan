#!/usr/bin/env python3
"""ゲーム用の画像、BGM、効果音を生成する。"""

import argparse
import math
import os
import struct
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "art_sources"
IMAGE_DIR = ROOT / "image"
AUDIO_DIR = ROOT / "audio"
TEMP_DIR = ROOT / "tools" / ".audio_work"
INK = (24, 25, 39, 255)
CREAM = (255, 239, 194, 255)
GOLD = (241, 186, 70, 255)
RED = (137, 43, 61, 255)
BLUE = (99, 181, 223, 255)


def font(size, bold=False):
    paths = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc" if bold else
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    ]
    for path in paths:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def fit_transparent(source, size, margin=2):
    bbox = source.getchannel("A").getbbox()
    if not bbox:
        return Image.new("RGBA", size, (0, 0, 0, 0))
    source = source.crop(bbox)
    ratio = min((size[0] - margin * 2) / source.width, (size[1] - margin * 2) / source.height)
    target = (max(1, int(source.width * ratio)), max(1, int(source.height * ratio)))
    source = source.resize(target, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - source.width) // 2
    y = size[1] - source.height - margin
    result.alpha_composite(source, (x, y))
    return result


def prepare_background():
    source = Image.open(SOURCE_DIR / "night-background.png").convert("RGB")
    ratio = 1280 / 720
    width = int(source.height * ratio)
    left = (source.width - width) // 2
    source = source.crop((left, 0, left + width, source.height))
    source = source.resize((1280, 720), Image.Resampling.LANCZOS)
    source = ImageEnhance.Contrast(source).enhance(1.04)
    source.save(IMAGE_DIR / "background.png", optimize=True)


def make_exact_face():
    source = Image.open(SOURCE_DIR / "hero-face-reference.png").convert("RGBA")
    source = source.crop((165, 0, 1115, 1005))
    alpha = source.getchannel("A")
    alpha = alpha.point(lambda value: 0 if value < 80 else value)
    shape = Image.new("L", source.size, 0)
    draw = ImageDraw.Draw(shape)
    draw.polygon([(0, 0), (950, 0), (950, 835), (675, 1005), (275, 1005), (0, 835)], fill=255)
    alpha = ImageChops.multiply(alpha, shape)
    fade_mask = Image.new("L", source.size, 255)
    fade_draw = ImageDraw.Draw(fade_mask)
    for y in range(930, 1005):
        fade = int(255 * (1005 - y) / 75)
        fade_draw.line((0, y, source.width, y), fill=fade)
    alpha = ImageChops.multiply(alpha, fade_mask)
    source.putalpha(alpha)
    return source


def prepare_characters():
    raw_hero_sheet = Image.open(SOURCE_DIR / "hero-body-sheet.png").convert("RGBA")
    hero_sheet = raw_hero_sheet.copy()
    red, green, blue, original_alpha = hero_sheet.split()
    white_level = ImageChops.darker(ImageChops.darker(red, green), blue)
    background_alpha = white_level.point(lambda value: 0 if value > 225 else 255)
    hero_sheet.putalpha(ImageChops.multiply(original_alpha, background_alpha))
    ghost_sheet = Image.open(SOURCE_DIR / "ghost-sheet.png").convert("RGBA")
    face = make_exact_face()
    hero_width = hero_sheet.width // 4
    ghost_width = ghost_sheet.width // 4
    for index in range(4):
        raw_hero = raw_hero_sheet.crop((index * hero_width, 0, (index + 1) * hero_width,
                                       raw_hero_sheet.height))
        hero = hero_sheet.crop((index * hero_width, 0, (index + 1) * hero_width, hero_sheet.height))
        alpha = hero.getchannel("A")
        clear = Image.new("L", hero.size, 0)
        clear_draw = ImageDraw.Draw(clear)
        clear_draw.rounded_rectangle((82, 0, hero.width - 78, 304), 55, fill=255)
        alpha = Image.composite(Image.new("L", hero.size, 0), alpha, clear)
        hero.putalpha(alpha)
        joined = Image.new("RGBA", hero.size, (0, 0, 0, 0))
        joined_draw = ImageDraw.Draw(joined)
        leaf_color = (57, 118, 63, 255)
        joined_draw.ellipse((145, 262, hero.width - 132, 332), fill=leaf_color, outline=INK, width=5)
        joined_draw.polygon([(158, 302), (192, 362), (223, 306), (267, 365),
                             (306, 306), (350, 358), (393, 298)], fill=leaf_color, outline=INK)
        joined.alpha_composite(hero)
        head = face.copy()
        head.thumbnail((275, 310), Image.Resampling.LANCZOS)
        joined.alpha_composite(head, ((hero.width - head.width) // 2 + 8, 10))
        hat_mask_values = []
        for red_value, green_value, blue_value, unused_alpha in raw_hero.getdata():
            orange_pixel = red_value > 135 and red_value > green_value * 1.25 and green_value > blue_value
            green_pixel = green_value > 60 and green_value > red_value * 0.72 and green_value > blue_value * 1.18
            hat_mask_values.append(255 if orange_pixel or green_pixel else 0)
        hat_mask = Image.new("L", raw_hero.size, 0)
        hat_mask.putdata(hat_mask_values)
        hat_mask = hat_mask.filter(ImageFilter.MaxFilter(7))
        limit = Image.new("L", raw_hero.size, 0)
        ImageDraw.Draw(limit).polygon([(55, 0), (raw_hero.width - 45, 0),
                                       (raw_hero.width - 72, 78), (raw_hero.width - 145, 104),
                                       (raw_hero.width // 2, 112), (142, 104), (75, 78)], fill=255)
        raw_hero.putalpha(ImageChops.multiply(hat_mask, limit))
        joined.alpha_composite(raw_hero)
        hero = fit_transparent(joined, (300, 320), 2)
        hero.save(IMAGE_DIR / ("hero%d.png" % index), optimize=True)
        ghost = ghost_sheet.crop((index * ghost_width, 0, (index + 1) * ghost_width, ghost_sheet.height))
        ghost = fit_transparent(ghost, (330, 330), 2)
        ghost.save(IMAGE_DIR / ("ghost%d.png" % index), optimize=True)


def prepare_helper():
    helper_sheet = Image.open(SOURCE_DIR / "helper-sheet.png").convert("RGBA")
    frame_width = helper_sheet.width // 4
    for index in range(4):
        left = index * frame_width
        right = helper_sheet.width if index == 3 else (index + 1) * frame_width
        helper = helper_sheet.crop((left, 0, right, helper_sheet.height))
        helper = fit_transparent(helper, (240, 240), 2)
        helper.save(IMAGE_DIR / ("helper%d.png" % index), optimize=True)


def draw_obstacles():
    names = ["gravestone", "root", "puddle"]
    for index, name in enumerate(names):
        image = Image.new("RGBA", (140, 115), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse((8, 91, 132, 112), fill=(14, 15, 26, 90))
        if index == 0:
            draw.rounded_rectangle((38, 17, 102, 105), 22, fill=(86, 96, 110, 255), outline=INK, width=5)
            draw.line((70, 37, 70, 80), fill=(45, 50, 61, 255), width=6)
            draw.line((54, 54, 86, 54), fill=(45, 50, 61, 255), width=6)
            draw.arc((42, 20, 98, 76), 195, 345, fill=(163, 174, 174, 255), width=3)
        elif index == 1:
            draw.polygon((4, 89, 38, 69, 70, 77, 97, 46, 136, 63, 109, 84, 140, 100, 5, 100),
                         fill=(88, 54, 43, 255), outline=INK)
            draw.line((39, 73, 77, 88, 103, 55), fill=(177, 118, 72, 255), width=5)
        else:
            draw.ellipse((7, 60, 133, 105), fill=(47, 92, 130, 220), outline=INK, width=4)
            draw.ellipse((31, 69, 105, 91), fill=(103, 179, 209, 210))
            draw.arc((26, 62, 116, 100), 200, 338, fill=(197, 234, 239, 255), width=3)
        image.save(IMAGE_DIR / (name + ".png"), optimize=True)
    bat = Image.new("RGBA", (140, 90), (0, 0, 0, 0))
    draw = ImageDraw.Draw(bat)
    draw.polygon((70, 42, 20, 10, 5, 42, 32, 36, 18, 72, 70, 55,
                  122, 72, 108, 36, 135, 42, 120, 10), fill=(48, 36, 68, 255), outline=INK)
    draw.ellipse((54, 27, 86, 62), fill=(90, 64, 113, 255), outline=INK, width=4)
    draw.ellipse((60, 35, 66, 42), fill=GOLD)
    draw.ellipse((74, 35, 80, 42), fill=GOLD)
    bat.save(IMAGE_DIR / "bat.png", optimize=True)
    pumpkins = Image.new("RGBA", (110, 165), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pumpkins)
    for left, top, right, bottom in [(8, 92, 102, 160), (18, 43, 92, 108), (27, 5, 83, 58)]:
        draw.ellipse((left, top, right, bottom), fill=(224, 93, 25, 255), outline=INK, width=5)
        center = (left + right) // 2
        draw.line((center, top + 8, center, bottom - 8), fill=(151, 58, 20, 255), width=4)
    pumpkins.save(IMAGE_DIR / "pumpkin_stack.png", optimize=True)
    platform = Image.new("RGBA", (320, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(platform)
    draw.rounded_rectangle((3, 5, 317, 98), 18, fill=(72, 78, 91, 255), outline=INK, width=6)
    draw.polygon((8, 20, 52, 8, 102, 23, 151, 7, 205, 22, 258, 8, 312, 19,
                  312, 40, 8, 40), fill=(121, 128, 132, 255))
    for x in range(24, 305, 54):
        draw.line((x, 48, x - 10, 89), fill=(43, 47, 59, 255), width=5)
    platform.save(IMAGE_DIR / "platform.png", optimize=True)


def draw_pickups():
    for name, color in [("light", BLUE), ("gold_light", GOLD)]:
        image = Image.new("RGBA", (90, 90), (0, 0, 0, 0))
        glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(glow)
        for radius in range(38, 8, -5):
            opacity = int(9 + (38 - radius) * 2)
            fill = (color[0], color[1], color[2], opacity)
            draw.ellipse((45 - radius, 45 - radius, 45 + radius, 45 + radius), fill=fill)
        glow = glow.filter(ImageFilter.GaussianBlur(4))
        image = Image.alpha_composite(image, glow)
        draw = ImageDraw.Draw(image)
        draw.ellipse((29, 29, 61, 61), fill=color, outline=CREAM, width=4)
        draw.line((45, 8, 45, 22), fill=CREAM, width=4)
        draw.line((45, 68, 45, 82), fill=CREAM, width=4)
        draw.line((8, 45, 22, 45), fill=CREAM, width=4)
        draw.line((68, 45, 82, 45), fill=CREAM, width=4)
        image.save(IMAGE_DIR / (name + ".png"), optimize=True)
    candy = Image.new("RGBA", (90, 70), (0, 0, 0, 0))
    draw = ImageDraw.Draw(candy)
    draw.polygon((5, 35, 22, 12, 31, 25, 59, 25, 68, 12, 85, 35,
                  68, 58, 58, 45, 31, 45, 22, 58), fill=(247, 104, 154, 255), outline=INK)
    draw.rounded_rectangle((26, 20, 64, 50), 11, fill=(255, 188, 77, 255), outline=INK, width=4)
    candy.save(IMAGE_DIR / "candy.png", optimize=True)
    lollipop = Image.new("RGBA", (90, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(lollipop)
    draw.line((47, 54, 66, 96), fill=CREAM, width=7)
    draw.ellipse((10, 5, 72, 67), fill=(247, 104, 154, 255), outline=INK, width=5)
    draw.arc((18, 13, 64, 59), 5, 330, fill=CREAM, width=7)
    draw.arc((26, 21, 56, 51), 10, 330, fill=(99, 181, 223, 255), width=6)
    lollipop.save(IMAGE_DIR / "lollipop.png", optimize=True)
    hole = Image.new("RGBA", (300, 80), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hole)
    draw.ellipse((3, 12, 297, 75), fill=(8, 8, 16, 245), outline=INK, width=6)
    draw.ellipse((30, 22, 270, 60), outline=(82, 68, 98, 255), width=5)
    hole.save(IMAGE_DIR / "hole.png", optimize=True)
    slope = Image.new("RGBA", (340, 150), (0, 0, 0, 0))
    draw = ImageDraw.Draw(slope)
    draw.polygon((2, 145, 338, 8, 338, 148), fill=(78, 82, 91, 255), outline=INK)
    draw.line((8, 137, 333, 5), fill=(148, 139, 117, 255), width=12)
    slope.save(IMAGE_DIR / "slope.png", optimize=True)
    ground = Image.new("RGBA", (320, 150), (0, 0, 0, 0))
    draw = ImageDraw.Draw(ground)
    draw.rectangle((0, 12, 319, 149), fill=(48, 44, 53, 255), outline=INK, width=5)
    draw.polygon((0, 12, 42, 2, 86, 15, 132, 3, 180, 15, 225, 2, 274, 14, 319, 4,
                  319, 42, 0, 42), fill=(118, 111, 98, 255), outline=INK)
    for y in range(52, 145, 34):
        offset = 22 if (y // 34) % 2 else 0
        for x in range(-20 + offset, 340, 55):
            draw.rounded_rectangle((x, y, x + 48, y + 27), 5,
                                   fill=(72, 68, 77, 255), outline=(29, 27, 36, 255), width=3)
    ground.save(IMAGE_DIR / "ground_tile.png", optimize=True)


def rounded_panel(size, fill):
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, size[0] - 5, size[1] - 5), 22, fill=fill, outline=INK, width=5)
    draw.rounded_rectangle((11, 11, size[0] - 12, size[1] - 12), 16, outline=GOLD, width=3)
    return image


def draw_ui():
    rounded_panel((390, 72), (26, 29, 48, 235)).save(IMAGE_DIR / "hud.png", optimize=True)
    rounded_panel((1020, 500), (22, 27, 48, 242)).save(IMAGE_DIR / "intro.png", optimize=True)
    logo = Image.new("RGBA", (760, 180), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logo)
    draw.text((380, 98), "にげろさぼこ！", font=font(76, True), anchor="mm", fill=GOLD,
              stroke_width=11, stroke_fill=RED)
    logo.save(IMAGE_DIR / "logo.png", optimize=True)


def draw_promo_and_icon():
    background = Image.open(IMAGE_DIR / "background.png").convert("RGBA")
    shade = Image.new("RGBA", background.size, (9, 12, 30, 70))
    background = Image.alpha_composite(background, shade)
    hero = Image.open(IMAGE_DIR / "hero1.png")
    ghost = Image.open(IMAGE_DIR / "ghost1.png")
    hero = hero.resize((280, 300), Image.Resampling.LANCZOS)
    ghost = ghost.resize((315, 315), Image.Resampling.LANCZOS)
    background.alpha_composite(ghost, (95, 365))
    background.alpha_composite(hero, (575, 390))
    platform = Image.open(IMAGE_DIR / "platform.png").resize((280, 88), Image.Resampling.LANCZOS)
    candy = Image.open(IMAGE_DIR / "candy.png").resize((70, 54), Image.Resampling.LANCZOS)
    lollipop = Image.open(IMAGE_DIR / "lollipop.png").resize((62, 70), Image.Resampling.LANCZOS)
    background.alpha_composite(platform, (820, 590))
    background.alpha_composite(candy, (810, 470))
    background.alpha_composite(lollipop, (1015, 435))
    logo = Image.open(IMAGE_DIR / "logo.png")
    background.alpha_composite(logo, (390, 70))
    draw = ImageDraw.Draw(background)
    draw.rounded_rectangle((412, 235, 1134, 290), 22, fill=(20, 24, 45, 225), outline=GOLD, width=4)
    draw.text((773, 262), "タップでジャンプ！　白凸男から逃げきれ！", font=font(29, True),
              anchor="mm", fill=CREAM)
    background.convert("RGB").save(ROOT / "promo.png", quality=91, optimize=True)
    icon = Image.new("RGBA", (256, 256), (26, 34, 68, 255))
    draw = ImageDraw.Draw(icon)
    draw.ellipse((12, 12, 244, 244), fill=(40, 55, 95, 255), outline=GOLD, width=7)
    moon = (183, 197, 218, 255)
    draw.ellipse((53, 33, 203, 183), fill=moon)
    face = Image.open(IMAGE_DIR / "hero0.png")
    face.thumbnail((190, 202), Image.Resampling.LANCZOS)
    icon.alpha_composite(face, ((256 - face.width) // 2, 25))
    draw.rounded_rectangle((32, 186, 224, 239), 17, fill=(137, 43, 61, 245), outline=INK, width=4)
    draw.text((128, 212), "逃げろ！", font=font(36, True), anchor="mm", fill=CREAM)
    icon.convert("RGB").save(ROOT / "icon.png", quality=90, optimize=True)


def write_wav(path, samples, rate=44100):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        data = bytearray()
        for value in samples:
            value = int(max(-1.0, min(1.0, value)) * 32767)
            data.extend(struct.pack("<h", value))
        wav.writeframes(bytes(data))


def tone(freq, seconds, volume=0.3, rate=44100, triangle=False):
    result = []
    count = int(seconds * rate)
    for index in range(count):
        position = index / rate
        envelope = min(1.0, index / (rate * 0.01)) * max(0.0, 1.0 - index / count)
        phase = 2 * math.pi * freq * position
        value = 2 / math.pi * math.asin(math.sin(phase)) if triangle else math.sin(phase)
        result.append(value * volume * envelope)
    return result


def sequence(notes, beat=0.18, volume=0.2):
    result = []
    for freq, beats in notes:
        if freq == 0:
            result.extend([0.0] * int(44100 * beat * beats))
        else:
            result.extend(tone(freq, beat * beats, volume, triangle=True))
    return result


def mix(parts):
    length = max([len(part) for part in parts])
    result = [0.0] * length
    for part in parts:
        for index in range(len(part)):
            result[index] += part[index]
    return result


def encode(ffmpeg, name, samples):
    wav_path = TEMP_DIR / (name + ".wav")
    write_wav(wav_path, samples)
    ogg = [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", "libvorbis", "-q:a", "4"]
    aac = [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", "aac", "-b:a", "96k"]
    subprocess.run(ogg + [str(AUDIO_DIR / (name + ".ogg"))], check=True)
    subprocess.run(aac + [str(AUDIO_DIR / (name + ".aac"))], check=True)


def draw_audio(ffmpeg):
    melody = [(392, 1), (466, 1), (523, 1), (466, 1), (349, 1), (392, 1), (466, 2),
              (330, 1), (392, 1), (440, 1), (392, 1), (294, 1), (330, 1), (392, 2)]
    bass = [(196, 4), (174, 4), (165, 4), (174, 4)]
    encode(ffmpeg, "bgm", mix([sequence(melody * 2, 0.20, 0.14), sequence(bass * 2, 0.20, 0.09)]))
    encode(ffmpeg, "rush_bgm", mix([sequence(melody * 3, 0.13, 0.16),
                                     sequence(bass * 3, 0.13, 0.11)]))
    encode(ffmpeg, "jump", sequence([(523, 1), (784, 1)], 0.08, 0.28))
    encode(ffmpeg, "pickup", sequence([(659, 1), (880, 1)], 0.10, 0.32))
    encode(ffmpeg, "gold", sequence([(659, 1), (880, 1), (1046, 2)], 0.10, 0.32))
    encode(ffmpeg, "hit", sequence([(196, 1), (155, 2)], 0.14, 0.30))
    encode(ffmpeg, "count", tone(440, 0.14, 0.28))
    encode(ffmpeg, "finish", sequence([(523, 1), (659, 1), (784, 1), (1046, 3)], 0.15, 0.30))
    encode(ffmpeg, "fever", sequence([(523, 1), (659, 1), (784, 1), (1046, 1), (1318, 2)], 0.09, 0.34))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", required=True)
    args = parser.parse_args()
    IMAGE_DIR.mkdir(exist_ok=True)
    AUDIO_DIR.mkdir(exist_ok=True)
    TEMP_DIR.mkdir(exist_ok=True)
    prepare_background()
    prepare_characters()
    prepare_helper()
    draw_obstacles()
    draw_pickups()
    draw_ui()
    draw_promo_and_icon()
    draw_audio(args.ffmpeg)
    print("画像と音声を生成しました")


if __name__ == "__main__":
    main()
