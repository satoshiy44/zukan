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
random.seed(501)


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



# ---- 効果音(やわらかい・上品) ----
def pluck(freq, dur, vol=0.25):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = (math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * freq * 2 * t) + 0.1 * math.sin(2 * math.pi * freq * 3 * t)) * math.exp(-t * 9)
        out.append(v * vol)
    return out


save("drop", mix(pluck(note(64), 0.18, 0.3), sweep(0.05, 180, 90, "sin", 0.3)))
save("land", sweep(0.07, 140, 70, "sin", 0.35))
save("turn", mix(sweep(0.28, 300, 700, "tri", 0.18, 0.7), [v * 0.3 for v in lowpass(noise(0.28, 0.5, 1.0), 0.15)]))
save("ng", mix(pluck(note(52), 0.2, 0.3), pluck(note(51), 0.25, 0.25), offsets=[0, 0.08]))
for k in range(6):
    base = 72 + [0, 2, 4, 7, 9, 12][k]
    save("clear%d" % k, mix(*[bell(note(base + d), 0.5, 0.16) for d in (0, 4, 7, 11)], offsets=[0, 0.04, 0.08, 0.12]))
save("bigclear", mix(*[bell(note(n), 0.8, 0.16) for n in (72, 76, 79, 83, 86, 88)], offsets=[0, 0.05, 0.1, 0.15, 0.2, 0.25]))
save("joker", mix(*[bell(note(n), 0.5, 0.15) for n in (84, 91, 96)], offsets=[0, 0.06, 0.12]))
save("count", pluck(note(81), 0.2, 0.3))
save("go", mix(*[bell(note(n), 0.6, 0.18) for n in (72, 79, 84)], offsets=[0, 0.08, 0.16]))
save("finish", mix(*[bell(note(n), 0.9, 0.16) for n in (72, 76, 79, 83, 84)], offsets=[0, 0.12, 0.24, 0.36, 0.5]))
save("over", mix(sweep(0.5, 400, 120, "tri", 0.25), [v * 0.4 for v in lowpass(noise(0.4, 0.5, 1.2), 0.2)]))

def hat_(vol=0.1):
    x = noise(0.04, vol, 3.0)
    lp = lowpass(x, 0.6)
    return [a - b for a, b in zip(x, lp)]


# ---- BGM: しっとりジャズ(BPM120・スウィング・16小節) ----
BPM = 120
beat = 60 / BPM
sw = beat * 0.66  # スウィングの1拍目の長さ
# Dm9 G13 Cmaj9 A7(b9) / Fmaj7 Em7 A7 Dm9 を2回
CH = [(50, [57, 60, 64, 65]), (43, [53, 57, 59, 64]), (48, [55, 59, 62, 64]), (45, [55, 58, 61, 64]),
      (41, [52, 55, 57, 64]), (40, [50, 55, 59, 62]), (45, [55, 58, 61, 64]), (50, [57, 60, 64, 65])] * 2
MEL = [[74, None, 77, 76], [74, 71, None, None], [76, None, 79, 76], [73, None, None, None],
       [72, None, 76, 77], [79, 76, 74, None], [73, None, 76, 79], [77, None, None, None],
       [81, None, 79, 77], [76, 74, None, None], [79, None, 76, 74], [73, 76, 79, 82],
       [81, None, 77, 76], [74, None, 71, 74], [73, None, None, 76], [74, None, None, None]]
tracks, offs = [], []
for b, (root, ch) in enumerate(CH):
    t0 = b * 4 * beat
    # ウォーキングベース
    walk = [root, root + 7, root + 12, root + (5 if b % 2 else 9)]
    for k in range(4):
        tracks.append(tone(note(walk[k] - 12), beat * 0.9, "tri", 0.28, 0.01, beat * 0.9))
        offs.append(t0 + k * beat)
    # ピアノのコード(2・4拍)
    for k in (1, 3):
        for m in ch:
            tracks.append(pluck(note(m), beat * 1.2, 0.05))
            offs.append(t0 + k * beat + (0.04 if k == 3 else 0))
    # ブラシのドラム: ハイハット(スウィング)とやわらかいキック
    for k in range(4):
        tracks.append([v * 0.5 for v in hat_(0.08)])
        offs.append(t0 + k * beat)
        tracks.append([v * 0.4 for v in hat_(0.06)])
        offs.append(t0 + k * beat + sw)
    tracks.append(sweep(0.12, 110, 50, "sin", 0.3)); offs.append(t0)
    # メロディ(ビブラフォン風)
    for k, n in enumerate(MEL[b]):
        if n is None:
            continue
        tracks.append(bell(note(n), beat * 1.6, 0.11))
        offs.append(t0 + k * beat)
total = len(CH) * 4 * beat
raw = mix(*tracks, offsets=offs)
n = int(total * SR)
bgm = raw[:n]
for i in range(n, len(raw)):
    bgm[i - n] += raw[i]
save("bgm", bgm, 0.45)
