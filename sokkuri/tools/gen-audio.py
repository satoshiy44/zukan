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
random.seed(41)


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


# つまむ
save("pick", sweep(0.08, 500, 900, "sin", 0.4))
# 置く(ぽん)
save("put", lowpass(mix(sweep(0.1, 700, 300, "sin", 0.6), noise(0.03, 0.2, 2)), 0.4))
# 判定(ひとつずつ)
save("check", mix(bell(note(84), 0.25, 0.25)))
save("great", mix(*[bell(note(n), 0.5, 0.25) for n in (79, 84, 88, 91)], offsets=[0, 0.07, 0.14, 0.21]))
save("round", mix(*[bell(note(n), 0.6, 0.25) for n in (72, 76, 79)], offsets=[0, 0.1, 0.2]))
save("beep", tone(note(81), 0.1, "sin", 0.25))
save("go", mix(*[bell(note(n), 0.4, 0.25) for n in (76, 84)], offsets=[0, 0.1]))
save("finish", mix(*[bell(note(n), 0.7, 0.25) for n in (84, 79, 76, 72)], offsets=[0, 0.12, 0.24, 0.36]))

# ---- BGM: のんびりしたオルゴール風(96BPM, 8小節) ----
def music_box(freq, dur, vol=0.3):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = (math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(2 * math.pi * freq * 3.01 * t) * math.exp(-t * 8)) * math.exp(-t * 3.5)
        out.append(v * vol)
    return out


BPM = 96
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
mel = [79, 81, 84, None, 81, 79, 76, None, 77, 79, 81, None, 79, 77, 76, None,
       79, 81, 84, 86, 88, 86, 84, None, 81, 84, 79, 76, 77, 74, 72, None]
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(music_box(note(n), beat * 1.5, 0.22))
    offs.append(i * beat)
bass = [48, 45, 41, 43, 48, 45, 41, 43]
for b, n in enumerate(bass):
    for k in range(4):
        tracks.append(music_box(note(n + (0, 7, 12, 7)[k]), beat, 0.12))
        offs.append((b * 4 + k) * beat)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.7)
