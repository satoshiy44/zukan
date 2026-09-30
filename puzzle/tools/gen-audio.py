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
random.seed(7)


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

# ポン(消した数で3段階)
save("pop_s", mix(sweep(0.12, 500, 1200, "sin", 0.8, 0.6), sweep(0.12, 1000, 2400, "tri", 0.15, 0.6)))
save("pop_m", mix(sweep(0.18, 400, 1300, "sin", 0.8, 0.6), tone(note(84), 0.2, "tri", 0.25), tone(note(88), 0.2, "tri", 0.2), offsets=[0, 0.05, 0.1]))
save("pop_l", mix(sweep(0.25, 300, 1400, "sin", 0.9, 0.6), *[tone(note(n), 0.3, "sq", 0.12) for n in (79, 84, 88, 91)],
                  lowpass(noise(0.4, 0.3, 1.5), 0.15), offsets=[0, 0.04, 0.1, 0.16, 0.22, 0]))
# ぶぶー(つながっていない)
save("miss", tone(110, 0.15, "sq", 0.25))
# やきいも投入(ボッ+キラキラ)
save("imo", mix(lowpass(noise(0.35, 0.8, 1.2), 0.25), sweep(0.3, 90, 200, "sin", 0.6),
                *[tone(note(n), 0.3, "tri", 0.3, 0.002, 0.3) for n in (84, 88, 91, 96)],
                offsets=[0, 0, 0.12, 0.18, 0.24, 0.3]))
# 全消し
fan = [(72, 0), (76, 0.12), (79, 0.24), (84, 0.36), (88, 0.5)]
save("clear", mix(*[tone(note(n), 0.35 if i < 4 else 0.9, "sq", 0.16) for i, (n, _) in enumerate(fan)],
                  *[tone(note(n - 12), 0.35 if i < 4 else 0.9, "tri", 0.3) for i, (n, _) in enumerate(fan)],
                  offsets=[o for _, o in fan] * 2))
# 盤面おわり(次の盤面へ)
save("next", mix(tone(note(79), 0.15, "sq", 0.2), tone(note(74), 0.15, "sq", 0.2), tone(note(72), 0.4, "tri", 0.3), offsets=[0, 0.12, 0.24]))
save("beep", tone(note(81), 0.12, "sq", 0.3))
save("go", mix(tone(note(88), 0.35, "sq", 0.3), tone(note(76), 0.35, "tri", 0.3)))
save("finish", mix(tone(note(84), 0.2, "sq", 0.25), tone(note(79), 0.2, "sq", 0.25), tone(note(72), 0.9, "sq", 0.25),
                   tone(note(60), 0.9, "tri", 0.4), offsets=[0, 0.15, 0.3, 0.3]))
drums = [lowpass(mix(sweep(0.12, 150, 60, "sin", 0.9), noise(0.05, 0.4, 2)), 0.4) for _ in range(8)]
save("fever", mix(*drums, tone(note(79), 0.8, "sq", 0.2), tone(note(67), 0.8, "tri", 0.35), tone(note(74), 0.8, "sq", 0.15),
                  offsets=[i * 0.07 for i in range(8)] + [0.6, 0.6, 0.6]))
save("result", mix(*[tone(note(n), 0.14, "sq", 0.2) for n in (72, 74, 76, 79, 81, 84)],
                   tone(note(84), 0.8, "tri", 0.35), tone(note(88), 0.8, "sq", 0.15),
                   offsets=[i * 0.08 for i in range(6)] + [0.5, 0.5]))

# ---- BGM: のんびりした秋の夕暮れ(ヨナ抜き, 112BPM, 8小節) ----
BPM = 112
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
mel = [
    72, None, 74, 76, 79, None, 76, None, 74, None, 72, 74, 69, None, None, None,
    72, None, 74, 76, 79, None, 81, 79, 76, None, 74, None, 76, None, None, None,
    81, None, 79, 76, 79, None, 76, 74, 72, None, 74, 76, 74, None, 72, None,
    69, None, 72, 74, 76, None, 74, 72, 69, None, 67, None, 72, None, None, None,
]
bass = [48, 45, 41, 43, 48, 45, 41, 43, 41, 43, 48, 45, 41, 43, 48, 48]
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(tone(note(n), beat * 0.9, "tri", 0.2, 0.01, beat * 0.9))
    offs.append(i * beat / 2)
    tracks.append(tone(note(n + 12), beat * 0.5, "sin", 0.06, 0.01, beat * 0.5))
    offs.append(i * beat / 2)
for i, n in enumerate(bass):
    tracks.append(tone(note(n), beat * 1.8, "tri", 0.26, 0.01, beat * 1.8))
    offs.append(i * 2 * beat)
    # アルペジオ
    for k, d in enumerate((0, 7, 12, 7)):
        tracks.append(tone(note(n + 12 + d), beat * 0.4, "sq", 0.035, 0.005, beat * 0.4))
        offs.append(i * 2 * beat + k * beat / 2)
for b in range(bars * 4):
    if b % 2 == 0:
        tracks.append(lowpass(sweep(0.14, 120, 55, "sin", 0.5), 0.5))
        offs.append(b * beat)
    tracks.append([v * 0.08 for v in lowpass(noise(0.04, 1.0, 3), 0.6)])
    offs.append(b * beat + beat / 2)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.8)
