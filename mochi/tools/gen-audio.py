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
random.seed(2027)


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


def chip(freq, dur, vol=0.25):
    return tone(freq, dur, "sq", vol, 0.003, dur)



def snare(vol=0.3):
    return [v * 0.6 for v in lowpass(noise(0.12, vol, 2.5), 0.5)]


def hat(vol=0.1):
    x = noise(0.04, vol, 3.0)
    lp = lowpass(x, 0.6)
    return [a - b for a, b in zip(x, lp)]




def koto(freq, dur, vol=0.3):
    """琴っぽい音: はじいてすぐ減る、少しうなりのある音"""
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = math.sin(2 * math.pi * freq * t) + 0.5 * math.sin(2 * math.pi * freq * 2.003 * t) + 0.25 * math.sin(2 * math.pi * freq * 3.01 * t)
        out.append(v * math.exp(-t * 7) * vol * min(1, t / 0.002))
    return out


def taiko(vol=0.9):
    return mix(sweep(0.35, 120, 50, "sin", vol), [v * 0.4 for v in lowpass(noise(0.08, 0.6, 2.0), 0.15)])


# ---- 太鼓・かね・琴(ゲームがリズムに合わせて鳴らす) ----
save("se_don", taiko(0.9))
save("se_ka", mix(tone(1800, 0.06, "sq", 0.05, 0.001, 0.06), [v * 0.4 for v in noise(0.04, 0.4, 3.0)]))
# 陽音階(レ ミ ソ ラ シ)を2オクターブ
for i, n in enumerate((62, 64, 67, 69, 71, 74, 76, 79, 81, 83)):
    save("se_k%d" % i, koto(note(n), 0.5, 0.3))
# ---- 効果音 ----
save("se_pettan", mix(sweep(0.18, 180, 60, "sin", 0.8), [v * 0.7 for v in lowpass(noise(0.12, 0.8, 2.5), 0.45)], sweep(0.12, 600, 200, "tri", 0.15), offsets=[0, 0, 0.03]))
save("se_perfect", mix(*[koto(note(n), 0.5, 0.2) for n in (86, 91)], bell(note(98), 0.4, 0.12), offsets=[0, 0.05, 0.08]))
save("se_good", koto(note(86), 0.3, 0.2))
save("se_miss", mix(sweep(0.15, 140, 80, "sin", 0.4), [v * 0.3 for v in lowpass(noise(0.1, 0.4, 2.0), 0.2)]))
save("se_ouch", mix([v * 0.8 for v in lowpass(noise(0.08, 0.8, 2.0), 0.6)], sweep(0.5, 900, 200, "sq", 0.15), offsets=[0, 0.05]))
save("se_hai", mix(sweep(0.08, 500, 700, "sq", 0.12), sweep(0.1, 800, 600, "sq", 0.12), offsets=[0, 0.08]))
save("se_complete", mix(*[koto(note(n), 0.6, 0.22) for n in (74, 76, 79, 81, 86)], bell(note(98), 0.6, 0.14), offsets=[0, 0.07, 0.14, 0.21, 0.28, 0.35]))
save("se_count", tone(note(81), 0.14, "sq", 0.2))
save("se_go", mix(taiko(0.8), taiko(0.8), *[koto(note(n), 0.6, 0.25) for n in (74, 79, 86)], offsets=[0, 0.15, 0.15, 0.2, 0.25]))
save("se_finish", mix(taiko(0.9), taiko(0.9), taiko(0.9), *[koto(note(n), 0.8, 0.25) for n in (74, 76, 79, 86)], offsets=[0, 0.14, 0.28, 0.4, 0.46, 0.52, 0.58]))
save("se_rush", mix(sweep(0.5, 1200, 2400, "sin", 0.15, 0.5), *[taiko(0.6) for _ in range(6)], offsets=[0, 0, 0.07, 0.14, 0.21, 0.28, 0.35]))
cheer = lowpass(noise(1.2, 0.5, 0.5), 0.35)
cheer = [v * min(1, i / (0.12 * SR)) for i, v in enumerate(cheer)]
voices, offs = [], []
for k in range(22):
    f = random.uniform(500, 1100)
    voices.append(sweep(random.uniform(0.3, 0.6), f, f * random.uniform(1.1, 1.4), "tri", 0.05, 0.5))
    offs.append(random.uniform(0, 0.5))
save("se_cheer", mix(cheer, *voices, offsets=[0] + offs))


# ---- 曲を5つにするための楽器: 三味線(s)・笛(f) ----
def shamisen(freq, dur, vol=0.3):
    out = []
    ph = 0.0
    for i in range(int(dur * SR)):
        t = i / SR
        ph += freq / SR
        p = ph % 1.0
        v = (2 * p - 1) * 0.6 + math.sin(2 * math.pi * ph * 2) * 0.3
        out.append(v * math.exp(-t * 11) * vol * min(1, t / 0.001))
    return lowpass(out, 0.5)


def fue(freq, dur, vol=0.25):
    out = []
    ph = 0.0
    for i in range(int(dur * SR)):
        t = i / SR
        f = freq * (1 + 0.012 * math.sin(2 * math.pi * 5.5 * t) * min(1, t / 0.15))
        ph += f / SR
        v = math.sin(2 * math.pi * ph) + 0.15 * math.sin(4 * math.pi * ph)
        e = min(1, t / 0.04) * max(0.0, 1 - max(0.0, t - dur * 0.6) / (dur * 0.4))
        out.append((v + random.uniform(-0.08, 0.08)) * e * vol)
    return out


for i, n in enumerate((62, 64, 67, 69, 71, 74, 76, 79, 81, 83)):
    save("se_s%d" % i, shamisen(note(n - 12), 0.35, 0.32))
    save("se_f%d" % i, fue(note(n + 12), 0.32, 0.22))
