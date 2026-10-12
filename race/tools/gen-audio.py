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

# ---- 効果音 ----
save("se_coin", mix(tone(note(88), 0.06, "sq", 0.18, 0.002, 0.06), tone(note(95), 0.16, "sq", 0.18, 0.002, 0.16), offsets=[0, 0.05]))
save("se_gem", mix(*[bell(note(n), 0.5, 0.22) for n in (84, 88, 91, 96, 100)], offsets=[0, 0.05, 0.1, 0.15, 0.2]))
save("se_boost", mix(sweep(0.5, 200, 900, "saw", 0.25, 0.6), [v * 0.5 for v in lowpass(noise(0.5, 0.5, 0.5), 0.3)]))
save("se_crash", mix(sweep(0.3, 160, 40, "sq", 0.4), [v for v in lowpass(noise(0.4, 0.8, 1.5), 0.25)]))
save("se_beep", tone(note(81), 0.15, "sq", 0.2))
save("se_go", tone(note(93), 0.5, "sq", 0.22, 0.005, 0.5))
save("se_finish", mix(*[tone(note(n), 0.5 if i == 3 else 0.14, "sq", 0.18) for i, n in enumerate((72, 76, 79, 84))], offsets=[0, 0.14, 0.28, 0.42]))
save("se_combo", mix(bell(note(91), 0.3, 0.2), bell(note(96), 0.4, 0.2), offsets=[0, 0.06]))

# ---- BGM: 軽快なドライブ曲(152BPM, 16小節) ----
def snare(vol=0.3):
    return [v * 0.6 for v in lowpass(noise(0.12, vol, 2.5), 0.5)]


def hat(vol=0.1):
    x = noise(0.04, vol, 3.0)
    lp = lowpass(x, 0.6)
    return [a - b for a, b in zip(x, lp)]


BPM = 152
beat = 60 / BPM
e8 = beat / 2
chords = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])] * 2 + \
         [(41, [57, 60, 65]), (43, [55, 59, 62]), (45, [57, 60, 64]), (45, [57, 61, 64])] * 2
A = [76, None, 76, 79, 81, None, 79, 76, 74, None, 72, None, 74, 76, None, None,
     72, None, 72, 74, 76, None, 74, 72, 71, None, 67, None, 71, 74, None, None,
     76, None, 76, 79, 81, None, 84, 83, 81, None, 79, None, 76, 79, None, None,
     77, 76, 74, 72, 74, None, 76, None, 74, 71, 67, 71, 74, -1, None, None]
B = [77, None, 81, None, 84, -1, 83, 81, 79, None, 83, None, 86, -1, 84, 83,
     81, None, 76, None, 81, 83, 84, None, 85, -1, -1, None, 88, -1, None, None,
     77, None, 81, None, 84, -1, 83, 81, 79, None, 83, None, 86, -1, 84, 83,
     81, None, 84, 83, 81, 79, 76, 79, 81, -1, -1, -1, None, None, None, None]
mel = A + B
total = len(chords) * 4 * beat
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None or n == -1:
        continue
    ln = 1
    while i + ln < len(mel) and mel[i + ln] == -1:
        ln += 1
    tracks.append(tone(note(n), e8 * ln * 0.92, "sq", 0.09, 0.004, e8 * ln * 0.92))
    offs.append(i * e8)
    tracks.append(tone(note(n + 12), e8 * ln * 0.6, "tri", 0.05, 0.004, e8 * ln * 0.6))
    offs.append(i * e8)
for b, (root, ch) in enumerate(chords):
    t0 = b * 4 * beat
    for k in range(8):
        tracks.append(tone(note(root + (0, 12)[k % 2] - 12), e8 * 0.85, "tri", 0.22, 0.003, e8 * 0.85))
        offs.append(t0 + k * e8)
    for k in range(8):
        if k % 2 == 1:
            for m in ch:
                tracks.append(tone(note(m), e8 * 0.6, "sq", 0.022, 0.003, e8 * 0.6))
                offs.append(t0 + k * e8)
    for k in range(4):
        tracks.append(kick(0.55) if k % 2 == 0 else snare(0.35))
        offs.append(t0 + k * beat)
    for k in range(8):
        tracks.append(hat(0.12 if k % 2 else 0.06))
        offs.append(t0 + k * e8)
raw = mix(*tracks, offsets=offs)
n = int(total * SR)
bgm = raw[:n]
for i in range(n, len(raw)):
    bgm[i - n] += raw[i]
save("bgm", bgm, 0.42)
