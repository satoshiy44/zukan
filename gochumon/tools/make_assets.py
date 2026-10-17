#!/usr/bin/env python3
"""オリジナルの画像・BGM・効果音を生成する。"""

import argparse
import math
import os
import struct
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "image"
AUDIO_DIR = ROOT / "audio"
TEMP_DIR = ROOT / "tools" / ".audio_work"
SOURCE_DIR = ROOT / "art_sources"
INK = (53, 42, 45, 255)
CREAM = (246, 231, 194, 255)
BURGUNDY = (112, 43, 53, 255)
GOLD = (205, 157, 72, 255)
TEAL = (40, 91, 91, 255)


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


def rounded(draw, box, radius, fill, outline=INK, width=4):
	draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paper_texture(image):
	pix = image.load()
	for y in range(0, image.height, 3):
		for x in range((y // 3) % 3, image.width, 5):
			r, g, b, a = pix[x, y]
			d = ((x * 17 + y * 11) % 9) - 4
			pix[x, y] = (max(0, r + d), max(0, g + d), max(0, b + d), a)


def draw_background():
	source = Image.open(SOURCE_DIR / "cafe-background.png").convert("RGB")
	target_ratio = 1280 / 720
	source_ratio = source.width / source.height
	if source_ratio > target_ratio:
		crop_width = int(source.height * target_ratio)
		left = (source.width - crop_width) // 2
		source = source.crop((left, 0, left + crop_width, source.height))
	else:
		crop_height = int(source.width / target_ratio)
		top = (source.height - crop_height) // 2
		source = source.crop((0, top, source.width, top + crop_height))
	im = source.resize((1280, 720), Image.Resampling.LANCZOS).convert("RGBA")
	overlay = Image.new("RGBA", im.size, (35, 24, 22, 22))
	im = Image.alpha_composite(im, overlay)
	im.save(IMAGE_DIR / "restaurant.png", optimize=True)


def fit_transparent(source, size, margin=6):
	alpha = source.getchannel("A")
	bbox = alpha.getbbox()
	if not bbox:
		return Image.new("RGBA", size, (0, 0, 0, 0))
	source = source.crop(bbox)
	ratio = min((size[0] - margin * 2) / source.width, (size[1] - margin * 2) / source.height)
	new_size = (max(1, int(source.width * ratio)), max(1, int(source.height * ratio)))
	source = source.resize(new_size, Image.Resampling.LANCZOS)
	result = Image.new("RGBA", size, (0, 0, 0, 0))
	x = (size[0] - source.width) // 2
	y = size[1] - source.height - margin
	result.alpha_composite(source, (x, y))
	return result


def prepare_generated_art():
	sheet = Image.open(SOURCE_DIR / "customers-sheet.png").convert("RGBA")
	third = sheet.width // 3
	for index in range(3):
		left = index * third
		right = sheet.width if index == 2 else (index + 1) * third
		customer = fit_transparent(sheet.crop((left, 0, right, sheet.height)), (220, 235), 3)
		customer.save(IMAGE_DIR / ("customer%d.png" % index), optimize=True)
	emblem = Image.open(SOURCE_DIR / "cafe-emblem.png").convert("RGBA")
	fit_transparent(emblem, (390, 260), 3).save(IMAGE_DIR / "emblem.png", optimize=True)


def dish_canvas():
	return Image.new("RGBA", (160, 120), (0, 0, 0, 0))


def draw_dishes():
	names = ["オムライス", "スープ", "ケーキ", "紅茶", "サンド", "パスタ"]
	for index in range(6):
		im = dish_canvas()
		d = ImageDraw.Draw(im)
		d.ellipse((10, 91, 150, 115), fill=(28, 20, 19, 72))
		d.ellipse((9, 43, 151, 109), fill=(224, 217, 196, 255), outline=INK, width=4)
		d.ellipse((19, 49, 141, 101), fill=(250, 244, 224, 255), outline=TEAL, width=3)
		d.arc((26, 55, 134, 95), 200, 340, fill=GOLD, width=2)
		if index == 0:
			d.ellipse((38, 43, 124, 88), fill=(234, 178, 56, 255), outline=INK, width=3)
			d.line((79, 51, 79, 77), fill=(188, 55, 43, 255), width=5)
		elif index == 1:
			d.ellipse((43, 37, 119, 91), fill=(73, 112, 118, 255), outline=INK, width=3)
			d.ellipse((49, 43, 113, 79), fill=(211, 126, 59, 255))
			d.arc((111, 49, 137, 80), 260, 100, fill=INK, width=4)
		elif index == 2:
			d.polygon((47, 83, 59, 25, 117, 83), fill=(228, 187, 136, 255), outline=INK)
			d.line((57, 49, 105, 49), fill=(250, 239, 211, 255), width=9)
			d.ellipse((76, 18, 90, 32), fill=(168, 49, 50, 255), outline=INK)
		elif index == 3:
			d.rounded_rectangle((50, 31, 113, 87), 9, fill=(231, 223, 193, 255), outline=INK, width=4)
			d.ellipse((57, 38, 106, 57), fill=(126, 75, 47, 255))
			d.arc((106, 45, 139, 79), 260, 100, fill=INK, width=4)
		elif index == 4:
			d.polygon((40, 82, 63, 35, 122, 82), fill=(223, 184, 99, 255), outline=INK)
			d.line((56, 58, 109, 58), fill=(95, 143, 77, 255), width=9)
			d.line((52, 69, 116, 69), fill=(181, 70, 59, 255), width=7)
		else:
			for k in range(5):
				d.arc((43 + k * 5, 38 + k * 3, 118 - k * 2, 90), 5, 170, fill=(210, 136, 46, 255), width=5)
			d.ellipse((84, 45, 100, 60), fill=(185, 57, 50, 255))
		im.save(IMAGE_DIR / ("dish%d.png" % index), optimize=True)
	return names


def draw_ui_assets():
	bubble = Image.new("RGBA", (130, 120), (0, 0, 0, 0))
	d = ImageDraw.Draw(bubble)
	d.ellipse((5, 4, 124, 101), fill=(255, 247, 218, 248), outline=INK, width=5)
	d.ellipse((26, 94, 48, 114), fill=(255, 250, 226, 248), outline=INK, width=3)
	bubble.save(IMAGE_DIR / "bubble.png", optimize=True)

	check = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
	d = ImageDraw.Draw(check)
	d.ellipse((5, 5, 91, 91), fill=(73, 142, 95, 245), outline=INK, width=5)
	d.line((27, 50, 43, 67, 72, 31), fill=(255, 247, 217, 255), width=10)
	check.save(IMAGE_DIR / "check.png", optimize=True)

	coin = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
	d = ImageDraw.Draw(coin)
	d.ellipse((5, 5, 67, 67), fill=(235, 185, 68, 255), outline=INK, width=4)
	d.ellipse((14, 14, 58, 58), outline=(255, 230, 140, 255), width=3)
	d.text((36, 35), "¥", font=font(32, True), anchor="mm", fill=INK)
	coin.save(IMAGE_DIR / "coin.png", optimize=True)

	panel = Image.new("RGBA", (180, 166), (0, 0, 0, 0))
	d = ImageDraw.Draw(panel)
	rounded(d, (4, 4, 176, 162), 22, (247, 232, 194, 250), INK, 5)
	d.rounded_rectangle((11, 11, 169, 155), 16, outline=GOLD, width=3)
	d.rectangle((13, 118, 167, 153), fill=(60, 87, 83, 255))
	d.line((21, 145, 159, 145), fill=GOLD, width=2)
	panel.save(IMAGE_DIR / "dish_panel.png", optimize=True)

	order_board = Image.new("RGBA", (590, 145), (0, 0, 0, 0))
	d = ImageDraw.Draw(order_board)
	rounded(d, (4, 4, 586, 141), 24, (255, 248, 221, 250), INK, 5)
	d.rounded_rectangle((12, 12, 578, 133), 18, outline=GOLD, width=3)
	d.rounded_rectangle((18, 14, 132, 48), 14, fill=BURGUNDY, outline=GOLD, width=2)
	d.text((75, 31), "ご注文", font=font(22, True), anchor="mm", fill=(255, 245, 216, 255))
	for i in range(5):
		x = 32 + i * 108
		d.ellipse((x, 55, x + 94, 127), fill=(239, 222, 183, 255), outline=TEAL, width=3)
	order_board.save(IMAGE_DIR / "order_board.png", optimize=True)

	tray = Image.new("RGBA", (600, 72), (0, 0, 0, 0))
	d = ImageDraw.Draw(tray)
	rounded(d, (4, 4, 596, 68), 25, (67, 48, 43, 245), INK, 5)
	d.rounded_rectangle((20, 13, 580, 57), 18, fill=(123, 75, 57, 255), outline=GOLD, width=3)
	for i in range(5):
		x = 45 + i * 110
		d.ellipse((x, 20, x + 70, 51), outline=(210, 166, 92, 255), width=2)
	tray.save(IMAGE_DIR / "tray.png", optimize=True)

	hud = Image.new("RGBA", (370, 70), (0, 0, 0, 0))
	d = ImageDraw.Draw(hud)
	rounded(d, (3, 3, 367, 67), 18, (46, 40, 39, 232), INK, 4)
	d.rounded_rectangle((10, 9, 360, 61), 13, outline=GOLD, width=2)
	hud.save(IMAGE_DIR / "hud_panel.png", optimize=True)

	intro = Image.new("RGBA", (1000, 490), (0, 0, 0, 0))
	d = ImageDraw.Draw(intro)
	rounded(d, (4, 4, 996, 486), 36, (244, 227, 188, 248), INK, 7)
	d.rounded_rectangle((17, 17, 983, 473), 27, outline=GOLD, width=4)
	d.line((72, 250, 928, 250), fill=TEAL, width=3)
	for x in (42, 958):
		d.ellipse((x - 12, 28, x + 12, 52), fill=BURGUNDY, outline=GOLD, width=2)
		d.ellipse((x - 12, 438, x + 12, 462), fill=BURGUNDY, outline=GOLD, width=2)
	paper_texture(intro)
	intro.save(IMAGE_DIR / "intro_panel.png", optimize=True)


def draw_logo():
	emblem = Image.open(IMAGE_DIR / "emblem.png")
	logo = Image.new("RGBA", (760, 220), (0, 0, 0, 0))
	emblem.thumbnail((290, 205), Image.Resampling.LANCZOS)
	logo.alpha_composite(emblem, (0, 4))
	d = ImageDraw.Draw(logo)
	d.text((505, 84), "ご注文を", font=font(55, True), anchor="mm", fill=CREAM,
		stroke_width=8, stroke_fill=INK)
	d.text((505, 150), "どうぞ！", font=font(65, True), anchor="mm", fill=(255, 211, 91, 255),
		stroke_width=8, stroke_fill=INK)
	d.line((340, 192, 685, 192), fill=GOLD, width=4)
	logo.save(IMAGE_DIR / "logo.png", optimize=True)


def draw_promo(names):
	bg = Image.open(IMAGE_DIR / "restaurant.png").copy()
	bg = Image.alpha_composite(bg, Image.new("RGBA", bg.size, (28, 20, 18, 45)))
	d = ImageDraw.Draw(bg)
	logo = Image.open(IMAGE_DIR / "logo.png")
	logo.thumbnail((610, 176), Image.Resampling.LANCZOS)
	bg.alpha_composite(logo, (335, 16))
	d.rounded_rectangle((383, 172, 1050, 215), 18, fill=(44, 37, 35, 225), outline=GOLD, width=3)
	d.text((716, 193), "注文どおりの小皿をトレーにそろえよう", font=font(28, True),
		anchor="mm", fill=CREAM)
	for i in range(2, 0, -1):
		customer = Image.open(IMAGE_DIR / ("customer%d.png" % i))
		customer.thumbnail((142 - i * 11, 170 - i * 9))
		bg.alpha_composite(customer, (45 + i * 62, 233 - i * 20))
	customer = Image.open(IMAGE_DIR / "customer0.png")
	bg.alpha_composite(customer, (225, 214))
	board = Image.open(IMAGE_DIR / "order_board.png")
	bg.alpha_composite(board, (405, 225))
	for i in range(4):
		dish = Image.open(IMAGE_DIR / ("dish%d.png" % i))
		dish.thumbnail((78, 58))
		bg.alpha_composite(dish, (443 + i * 108, 281))
	tray = Image.open(IMAGE_DIR / "tray.png")
	bg.alpha_composite(tray, (405, 376))
	for i in range(2):
		dish = Image.open(IMAGE_DIR / ("dish%d.png" % i))
		dish.thumbnail((76, 57))
		bg.alpha_composite(dish, (442 + i * 110, 382))
	for i in range(6):
		x = 330 + i % 3 * 205
		y = 466 + i // 3 * 112
		panel = Image.open(IMAGE_DIR / "dish_panel.png")
		panel.thumbnail((145, 134))
		bg.alpha_composite(panel, (x, y))
		dish = Image.open(IMAGE_DIR / ("dish%d.png" % i))
		dish.thumbnail((128, 96))
		bg.alpha_composite(dish, (x + 8, y))
		d.text((x + 73, y + 104), names[i], font=font(19, True), anchor="mm", fill=(248, 238, 210, 255))
	bg.convert("RGB").save(ROOT / "promo.png", quality=92, optimize=True)

	icon = Image.new("RGBA", (256, 256), BURGUNDY)
	d = ImageDraw.Draw(icon)
	d.ellipse((12, 12, 244, 244), fill=(42, 76, 74, 255), outline=GOLD, width=7)
	emblem = Image.open(IMAGE_DIR / "emblem.png")
	emblem.thumbnail((228, 178), Image.Resampling.LANCZOS)
	icon.alpha_composite(emblem, ((256 - emblem.width) // 2, 6))
	d.rounded_rectangle((32, 181, 224, 234), 17, fill=(246, 231, 194, 245), outline=INK, width=4)
	d.text((128, 207), "注文！", font=font(37, True), anchor="mm", fill=BURGUNDY)
	icon.convert("RGB").save(ROOT / "icon.png", quality=90, optimize=True)


def write_wav(path, samples, rate=44100):
	with wave.open(str(path), "wb") as wav:
		wav.setnchannels(1)
		wav.setsampwidth(2)
		wav.setframerate(rate)
		data = bytearray()
		for value in samples:
			v = int(max(-1.0, min(1.0, value)) * 32767)
			data.extend(struct.pack("<h", v))
		wav.writeframes(bytes(data))


def tone(freq, seconds, volume=0.35, rate=44100, wave_type="sine"):
	count = int(seconds * rate)
	result = []
	for i in range(count):
		t = i / rate
		env = min(1.0, i / (rate * 0.015)) * max(0.0, 1.0 - i / count)
		phase = 2 * math.pi * freq * t
		v = math.sin(phase)
		if wave_type == "triangle":
			v = 2 / math.pi * math.asin(math.sin(phase))
		result.append(v * volume * env)
	return result


def mix(parts):
	length = max([len(part) for part in parts])
	result = [0.0] * length
	for part in parts:
		for i in range(len(part)):
			result[i] += part[i]
	return result


def sequence(notes, beat=0.25, volume=0.22):
	result = []
	for freq, beats in notes:
		if freq == 0:
			result.extend([0.0] * int(44100 * beat * beats))
		else:
			result.extend(tone(freq, beat * beats, volume, wave_type="triangle"))
	return result


def encode(ffmpeg, name, samples, loop=False):
	wav_path = TEMP_DIR / (name + ".wav")
	write_wav(wav_path, samples)
	ogg_args = [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", "libvorbis", "-q:a", "4"]
	aac_args = [ffmpeg, "-y", "-loglevel", "error", "-i", str(wav_path), "-c:a", "aac", "-b:a", "128k"]
	subprocess.run(ogg_args + [str(AUDIO_DIR / (name + ".ogg"))], check=True)
	subprocess.run(aac_args + [str(AUDIO_DIR / (name + ".aac"))], check=True)


def draw_audio(ffmpeg):
	melody = [
		(392, 1), (494, 1), (587, 2), (494, 1), (440, 1), (392, 2),
		(330, 1), (392, 1), (494, 2), (440, 1), (392, 1), (330, 2),
		(349, 1), (440, 1), (523, 2), (494, 1), (440, 1), (392, 2),
		(330, 1), (370, 1), (392, 1), (494, 1), (392, 2), (0, 2)
	]
	bass = [(196, 4), (165, 4), (175, 4), (196, 4), (165, 4), (196, 4)]
	encode(ffmpeg, "bgm", mix([sequence(melody, 0.28, 0.16), sequence(bass, 0.28, 0.11)]))
	encode(ffmpeg, "tap", tone(520, 0.09, 0.25))
	encode(ffmpeg, "serve", sequence([(660, 1), (880, 1)], 0.11, 0.3))
	encode(ffmpeg, "cash", sequence([(523, 1), (659, 1), (784, 2)], 0.13, 0.32))
	encode(ffmpeg, "miss", sequence([(220, 1), (174, 2)], 0.12, 0.25))
	encode(ffmpeg, "count", tone(440, 0.14, 0.27))
	encode(ffmpeg, "finish", sequence([(523, 1), (392, 1), (330, 2)], 0.18, 0.27))


def main():
	parser = argparse.ArgumentParser()
	parser.add_argument("--ffmpeg", required=True)
	args = parser.parse_args()
	IMAGE_DIR.mkdir(exist_ok=True)
	AUDIO_DIR.mkdir(exist_ok=True)
	TEMP_DIR.mkdir(exist_ok=True)
	draw_background()
	prepare_generated_art()
	names = draw_dishes()
	draw_ui_assets()
	draw_logo()
	draw_promo(names)
	draw_audio(args.ffmpeg)
	print("画像と音声を生成しました")


if __name__ == "__main__":
	main()
