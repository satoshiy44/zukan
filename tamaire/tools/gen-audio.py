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


def whistle(dur, f=2400, vol=0.35):
    """運動会の笛(ピーッ)"""
    ph = 0.0
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        fr = f + 60 * math.sin(2 * math.pi * 28 * t)
        ph += fr / SR
        out.append((osc("sin", ph) * 0.85 + random.uniform(-1, 1) * 0.15) * env(t, dur, 0.01, dur) * vol)
    return out


# 発射(ポン)
save("shoot", mix(sweep(0.12, 180, 520, "sin", 0.8, 0.5), lowpass(noise(0.08, 0.3, 2), 0.3)))
# ピンに当たる音(当てるほど音が上がる)
scale = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96, 98]
for i, n in enumerate(scale):
    save("hit%d" % (i + 1), mix(tone(note(n), 0.16, "tri", 0.45, 0.002, 0.16), tone(note(n + 12), 0.1, "sin", 0.15, 0.002, 0.1)))
# 赤い玉
save("red", mix(tone(note(88), 0.25, "sq", 0.18, 0.002, 0.25), tone(note(95), 0.3, "tri", 0.3, 0.002, 0.3), offsets=[0, 0.05]))
# 金メダル
save("gold", mix(*[tone(note(n), 0.35, "tri", 0.32, 0.002, 0.35) for n in (84, 88, 91, 96, 100)], offsets=[i * 0.06 for i in range(5)]))
# かごイン
save("kago_se", mix(*[tone(note(n), 0.2, "sq", 0.16) for n in (79, 84, 88)], tone(note(91), 0.6, "tri", 0.35), whistle(0.25, 2600, 0.2),
                 offsets=[0, 0.08, 0.16, 0.24, 0.24]))
# 種目クリア
fan = [(72, 0), (76, 0.12), (79, 0.24), (84, 0.36), (88, 0.5)]
save("clear", mix(*[tone(note(n), 0.35 if i < 4 else 0.9, "sq", 0.16) for i, (n, _) in enumerate(fan)],
                  *[tone(note(n - 12), 0.35 if i < 4 else 0.9, "tri", 0.3) for i, (n, _) in enumerate(fan)],
                  offsets=[o for _, o in fan] * 2))
save("beep", tone(note(81), 0.12, "sq", 0.3))
save("go", mix(whistle(0.5), tone(note(88), 0.3, "sq", 0.15)))
save("finish", mix(whistle(0.25), whistle(0.25), whistle(0.6), offsets=[0, 0.3, 0.6]))
drums = [lowpass(mix(sweep(0.12, 150, 60, "sin", 0.9), noise(0.05, 0.4, 2)), 0.4) for _ in range(8)]
save("fever", mix(*drums, whistle(0.7, 2200, 0.3), offsets=[i * 0.07 for i in range(8)] + [0.6]))
save("result", mix(*[tone(note(n), 0.14, "sq", 0.2) for n in (72, 74, 76, 79, 81, 84)],
                   tone(note(84), 0.8, "tri", 0.35), tone(note(88), 0.8, "sq", 0.15),
                   offsets=[i * 0.08 for i in range(6)] + [0.5, 0.5]))
# ポップ(たおした玉が消える)
save("pop", sweep(0.08, 900, 1500, "sin", 0.35, 0.5))

# ---- BGM: 運動会の行進曲ふう(150BPM, 8小節) ----
BPM = 150
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
mel = [
    67, None, 72, 72, 72, None, 76, 74, 72, None, 67, None, 69, 71, 72, None,
    74, None, 74, 76, 77, None, 76, 74, 72, None, 71, None, 74, None, None, None,
    67, None, 72, 72, 72, None, 76, 74, 72, None, 79, None, 77, 76, 74, None,
    72, None, 76, None, 74, None, 71, None, 72, None, 72, 72, 72, None, None, None,
]
bass = [48, 43, 48, 43, 50, 43, 55, 43, 48, 43, 48, 52, 43, 47, 48, 43]
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(tone(note(n), beat * 0.42, "sq", 0.12, 0.004, beat * 0.42))
    offs.append(i * beat / 2)
    tracks.append(tone(note(n + 12), beat * 0.3, "tri", 0.05, 0.004, beat * 0.3))
    offs.append(i * beat / 2)
for i, n in enumerate(bass):
    for k in range(2):
        tracks.append(tone(note(n if k == 0 else n + 7), beat * 0.6, "tri", 0.3, 0.004, beat * 0.6))
        offs.append((i * 2 + k) * beat)
for b in range(bars * 4):
    t = b * beat
    tracks.append(lowpass(sweep(0.14, 120, 55, "sin", 0.6), 0.5))  # 大太鼓
    offs.append(t)
    tracks.append([v * 0.3 for v in lowpass(noise(0.07, 1.0, 2.5), 0.7)])  # 小太鼓
    offs.append(t + beat / 2)
    if b % 4 == 3:
        tracks.append([v * 0.25 for v in lowpass(noise(0.05, 1.0, 2.5), 0.7)])
        offs.append(t + beat * 0.75)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.8)
