"""効果音・BGM生成スクリプト: 波形を合成して WAV を作り、ffmpeg で .ogg / .aac に変換する。
使い方: python3 tools/gen-audio.py
"""
import math
import os
import random
import struct
import subprocess
import tempfile
import wave

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), "..", "audio")
random.seed(11)


def env(t, dur, a=0.005, r=None):
    r = dur if r is None else r
    if t < a:
        return t / a
    return max(0.0, 1.0 - (t - a) / max(1e-6, r - a))


def osc(kind, phase):
    p = phase % 1.0
    if kind == "sin":
        return math.sin(2 * math.pi * p)
    if kind == "sq":
        return 1.0 if p < 0.5 else -1.0
    if kind == "saw":
        return 2 * p - 1
    if kind == "tri":
        return 4 * p - 1 if p < 0.5 else 3 - 4 * p
    return 0.0


def render(dur, fn):
    n = int(dur * SR)
    return [fn(i / SR) for i in range(n)]


def sweep(dur, f0, f1, kind="sin", vol=0.6, curve=1.0):
    ph = 0.0
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        f = f0 + (f1 - f0) * (t / dur) ** curve
        ph += f / SR
        out.append(osc(kind, ph) * env(t, dur) * vol)
    return out


def noise(dur, vol=0.6, decay=1.0):
    return [random.uniform(-1, 1) * vol * (1 - i / (dur * SR)) ** decay for i in range(int(dur * SR))]


def tone(freq, dur, kind="sq", vol=0.3, a=0.005, r=None):
    ph = 0.0
    out = []
    for i in range(int(dur * SR)):
        ph += freq / SR
        out.append(osc(kind, ph) * env(i / SR, dur, a, r) * vol)
    return out


def mix(*tracks, offsets=None):
    offsets = offsets or [0] * len(tracks)
    length = max(int(o * SR) + len(t) for t, o in zip(tracks, offsets))
    out = [0.0] * length
    for t, o in zip(tracks, offsets):
        s = int(o * SR)
        for i, v in enumerate(t):
            out[s + i] += v
    return out


def lowpass(x, k=0.2):
    y, prev = [], 0.0
    for v in x:
        prev += k * (v - prev)
        y.append(prev)
    return y


def save(name, samples, gain=1.0):
    peak = max(1e-6, max(abs(v) for v in samples))
    scale = min(1.0, 0.95 / peak) * gain
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, name + ".wav")
        with wave.open(wav, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, v * scale)) * 32767)) for v in samples))
        base = os.path.join(OUT, name)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "libvorbis", "-q:a", "3", base + ".ogg"], check=True)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "64k", "-f", "adts", base + ".aac"], check=True)
    print(name, round(len(samples) / SR, 2), "s")


def note(n):
    """MIDIノート番号 -> 周波数"""
    return 440.0 * 2 ** ((n - 69) / 12)


os.makedirs(OUT, exist_ok=True)


def bell(freq, dur, vol=0.3):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = (math.sin(2 * math.pi * freq * t) + 0.4 * math.sin(2 * math.pi * freq * 2.01 * t)) * math.exp(-t * 6)
        out.append(v * vol)
    return out


def chip(freq, dur, vol=0.25):
    return tone(freq, dur, "sq", vol, 0.003, dur)


def kick(vol=0.8):
    return sweep(0.15, 150, 40, "sin", vol)


# ボタンを押した(ウィーン)
save("move", sweep(0.25, 300, 520, "tri", 0.4))
# アームが下りる
save("down", [v * 0.6 for v in sweep(0.5, 600, 250, "sq", 0.25)])
# つかむ(ガシッ)
save("grab", mix(lowpass(noise(0.08, 1.0, 2), 0.5), sweep(0.1, 220, 120, "sq", 0.4)))
# 落とした(ぽろっ)
save("slip", mix(sweep(0.35, 700, 160, "sin", 0.5), offsets=[0]))
# スカッ
save("miss", mix(sweep(0.3, 500, 300, "tri", 0.35), sweep(0.3, 400, 200, "tri", 0.3), offsets=[0, 0.15]))
# ゲット
save("get", mix(*[bell(note(n), 0.4, 0.3) for n in (84, 88, 91, 96)], offsets=[0, 0.06, 0.12, 0.18]))
# 大当たり(金のたぬき)
save("jackpot", mix(*[chip(note(n), 0.14, 0.22) for n in (72, 76, 79, 84, 79, 84, 88, 91)], bell(note(96), 0.9, 0.35),
                    offsets=[i * 0.08 for i in range(8)] + [0.64]))
# 補充(ドドド)
save("refill", mix(*[lowpass(noise(0.08, 0.8, 2), 0.3) for _ in range(6)], offsets=[i * 0.07 for i in range(6)]))
# 景品が落ちて当たる(ぽすっ)
save("thud", lowpass(mix(sweep(0.12, 180, 60, "sin", 0.7), noise(0.05, 0.4, 2)), 0.3))
# アームが上で止まる(ガクッ)
save("jolt", mix(lowpass(noise(0.06, 0.9, 2), 0.4), sweep(0.08, 160, 90, "sq", 0.35)))
# ぬいぐるみがとりだし口に入る(ポンッ)
save("pop", mix(sweep(0.12, 300, 900, "sin", 0.6), lowpass(noise(0.05, 0.5, 2), 0.5)))
save("beep", tone(note(81), 0.12, "sq", 0.3))
save("go", mix(*[chip(note(n), 0.12, 0.25) for n in (72, 76, 79, 84)], offsets=[0, 0.08, 0.16, 0.24]))
save("finish", mix(*[chip(note(n), 0.25, 0.25) for n in (84, 79, 76, 72)], kick(), offsets=[0, 0.12, 0.24, 0.36, 0.36]))
save("fever", mix(*[chip(note(72 + (i % 4) * 4), 0.08, 0.22) for i in range(12)], offsets=[i * 0.06 for i in range(12)]))
save("result", mix(*[bell(note(n), 0.5, 0.3) for n in (72, 76, 79, 84, 88)], offsets=[i * 0.1 for i in range(5)]))

# ---- BGM: ゲームセンター風のピコピコ(140BPM, 8小節) ----
BPM = 140
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
mel = [
    72, None, 76, 79, 84, None, 79, 76, 77, None, 81, 84, 81, 79, 77, None,
    76, None, 79, 84, 88, 86, 84, 79, 81, 79, 77, 74, 72, None, None, None,
    72, None, 76, 79, 84, None, 79, 76, 77, None, 81, 84, 86, 84, 81, None,
    79, 81, 79, 77, 76, 74, 76, 79, 77, 74, 71, 74, 72, None, 72, None,
]
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(chip(note(n), beat * 0.45, 0.16))
    offs.append(i * beat / 2)
bass = [48, 48, 53, 53, 48, 48, 55, 48]
for b, n in enumerate(bass):
    for k in range(4):
        tracks.append(tone(note(n - 12 + (7 if k == 2 else 0)), beat * 0.45, "tri", 0.35))
        offs.append((b * 4 + k) * beat)
for b in range(bars * 4):
    tracks.append(kick(0.6))
    offs.append(b * beat)
    tracks.append([v * 0.15 for v in lowpass(noise(0.03, 1.0, 3), 0.8)])
    offs.append(b * beat + beat / 2)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.8)
