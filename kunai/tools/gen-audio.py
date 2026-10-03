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


def pluck(freq, dur, vol=0.3):
    """三味線っぽいはじく音"""
    ph = 0.0
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        ph += freq / SR
        v = (osc("saw", ph) * 0.6 + osc("sq", ph * 2) * 0.2) * math.exp(-t * 9)
        out.append(v * vol)
    return lowpass(out, 0.45)


def taiko(vol=0.9):
    return lowpass(mix(sweep(0.25, 110, 45, "sin", vol), noise(0.06, 0.35, 2)), 0.35)


# 投げる(シュッ)
save("throw", [v * (1 - i / 3300) for i, v in enumerate(lowpass(noise(0.15, 0.7, 0.5), 0.35))])
# 刺さる(カッ)
save("hit", mix(lowpass(noise(0.05, 1.0, 3), 0.6), sweep(0.08, 900, 300, "sq", 0.35)))
# 小判(チャリン)
save("koban_se", mix(*[tone(note(n), 0.3, "sin", 0.35, 0.002, 0.3) for n in (96, 100, 103)], offsets=[0, 0.05, 0.1]))
# 失敗(カキーン)
save("clang", mix(*[tone(f, 0.7, "sin", 0.25, 0.001, 0.7) for f in (1850, 2630, 3720)], lowpass(noise(0.05, 0.8, 3), 0.7), sweep(0.4, 300, 120, "sq", 0.2)))
# 丸太が割れる
save("break", mix(lowpass(noise(0.4, 1.0, 1.5), 0.25), sweep(0.3, 200, 60, "sin", 0.6), taiko(0.6)))
# 修行クリア
save("clear", mix(*[pluck(note(n), 0.5, 0.35) for n in (69, 72, 74, 76, 79, 81)], taiko(0.8), offsets=[i * 0.09 for i in range(6)] + [0.5]))
# 師匠の丸太(太鼓の連打)
save("boss", mix(*[taiko(0.9) for _ in range(6)], pluck(note(57), 0.8, 0.4), offsets=[i * 0.12 for i in range(6)] + [0.7]))
save("beep", tone(note(81), 0.12, "sq", 0.3))
save("go", mix(taiko(1.0), pluck(note(81), 0.5, 0.4)))
save("finish", mix(taiko(1.0), taiko(1.0), pluck(note(69), 1.0, 0.4), offsets=[0, 0.25, 0.25]))
save("fever", mix(*[taiko(0.9) for _ in range(8)], offsets=[i * 0.07 for i in range(8)]))
save("result", mix(*[pluck(note(n), 0.4, 0.35) for n in (69, 72, 74, 76, 79, 81, 84)], offsets=[i * 0.08 for i in range(7)]))

# ---- BGM: 和風(ヨナ抜き短調, 132BPM, 8小節, 三味線と太鼓) ----
BPM = 132
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
mel = [
    69, 72, 74, 76, 74, 72, 69, None, 76, 79, 81, 79, 76, 74, 76, None,
    81, 79, 76, 74, 76, 74, 72, 69, 72, 74, 72, 69, 67, 69, None, None,
    69, 72, 74, 76, 74, 72, 69, None, 76, 79, 81, 84, 81, 79, 76, None,
    74, 76, 74, 72, 69, 72, 74, 76, 74, 72, 69, 67, 69, None, 69, None,
]
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(pluck(note(n), beat * 0.9, 0.28))
    offs.append(i * beat / 2)
bass = [45, 45, 52, 45, 45, 45, 52, 40]
for b, n in enumerate(bass):
    for k in range(4):
        if k % 2 == 0:
            tracks.append(pluck(note(n), beat * 1.5, 0.22))
            offs.append((b * 4 + k) * beat)
for b in range(bars * 4):
    if b % 2 == 0:
        tracks.append(taiko(0.7))
        offs.append(b * beat)
    tracks.append([v * 0.18 for v in lowpass(noise(0.03, 1.0, 3), 0.8)])
    offs.append(b * beat + beat / 2)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.8)
