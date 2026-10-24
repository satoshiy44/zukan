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
random.seed(91)


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



# ---- 効果音 ----
save("se_place", mix(tone(note(76), 0.07, "sq", 0.16, 0.002, 0.07), tone(note(83), 0.12, "sq", 0.16, 0.002, 0.12), offsets=[0, 0.06]))
save("se_cancel", mix(tone(note(72), 0.07, "tri", 0.25), tone(note(65), 0.12, "tri", 0.25), offsets=[0, 0.07]))
save("se_ng", tone(note(50), 0.15, "sq", 0.15))
save("se_pea", sweep(0.06, 900, 500, "sq", 0.12))
save("se_carrot", sweep(0.12, 300, 900, "saw", 0.12, 0.6))
save("se_ice", mix(bell(note(96), 0.25, 0.15), sweep(0.2, 2000, 1200, "tri", 0.06)))
save("se_splash", [v for v in lowpass(noise(0.3, 0.6, 1.2), 0.4)])
save("se_roar", mix(sweep(0.45, 160, 90, "saw", 0.3, 0.8), [v * 0.4 for v in lowpass(noise(0.45, 0.6, 1.0), 0.12)]))
save("se_hit", sweep(0.05, 400, 200, "sq", 0.1))
save("se_poof", mix(sweep(0.15, 700, 1400, "sq", 0.12), tone(note(88), 0.12, "sq", 0.1, 0.002, 0.12), offsets=[0, 0.08]))
save("se_castle", mix(sweep(0.25, 220, 60, "sq", 0.3), [v for v in lowpass(noise(0.3, 0.7, 1.5), 0.3)]))
save("se_break", mix(sweep(0.8, 300, 40, "saw", 0.3), [v for v in lowpass(noise(0.9, 0.8, 1.0), 0.25)]))
save("se_beep", tone(note(81), 0.15, "sq", 0.2))
save("se_go", mix(*[tone(note(n), 0.5 if i == 2 else 0.12, "sq", 0.18) for i, n in enumerate((72, 79, 84))], offsets=[0, 0.12, 0.24]))
save("se_finish", mix(*[tone(note(n), 0.5 if i == 3 else 0.14, "sq", 0.18) for i, n in enumerate((72, 76, 79, 84))], offsets=[0, 0.14, 0.28, 0.42]))

# ---- BGM: ぽんぽこマーチ(150BPM, 16小節) ----
def snare(vol=0.3):
    return [v * 0.6 for v in lowpass(noise(0.12, vol, 2.5), 0.5)]


def hat(vol=0.1):
    x = noise(0.04, vol, 3.0)
    lp = lowpass(x, 0.6)
    return [a - b for a, b in zip(x, lp)]


BPM = 150
beat = 60 / BPM
e8 = beat / 2
# ヘ長調: F C Dm Bb / F C Bb C
chords = [(53, [57, 60, 65]), (48, [55, 60, 64]), (50, [57, 62, 65]), (46, [58, 62, 65]),
          (53, [57, 60, 65]), (48, [55, 60, 64]), (46, [58, 62, 65]), (48, [55, 58, 64])] * 2
A = [77, None, 77, 79, 81, None, 77, None, 79, None, 76, None, 72, None, None, None,
     74, None, 74, 76, 77, None, 74, None, 70, -1, 72, None, 74, None, None, None,
     77, None, 79, 81, 82, None, 81, 79, 81, None, 77, None, 74, 77, None, None,
     74, None, 72, 70, 72, None, 76, None, 77, -1, -1, None, None, None, None, None]
B = [84, None, 81, None, 77, None, 81, None, 79, None, 76, None, 72, -1, None, None,
     74, 77, 81, None, 82, None, 81, None, 79, -1, -1, None, 72, None, None, None,
     84, None, 81, None, 77, None, 81, 82, 84, None, 82, 81, 79, None, 77, None,
     79, None, 77, 76, 74, None, 76, None, 77, -1, -1, -1, None, None, None, None]
mel = A + B
total = len(chords) * 4 * beat
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None or n == -1:
        continue
    ln = 1
    while i + ln < len(mel) and mel[i + ln] == -1:
        ln += 1
    tracks.append(tone(note(n), e8 * ln * 0.85, "sq", 0.085, 0.004, e8 * ln * 0.85))
    offs.append(i * e8)
    tracks.append(tone(note(n + 12), e8 * ln * 0.5, "tri", 0.04, 0.004, e8 * ln * 0.5))
    offs.append(i * e8)
for b, (root, ch) in enumerate(chords):
    t0 = b * 4 * beat
    for k in range(4):
        tracks.append(tone(note(root - 12 + (0, 7)[k % 2]), beat * 0.7, "tri", 0.26, 0.003, beat * 0.7))
        offs.append(t0 + k * beat)
    for k in range(8):
        if k % 2 == 1:
            for m in ch:
                tracks.append(tone(note(m), e8 * 0.45, "sq", 0.02, 0.003, e8 * 0.45))
                offs.append(t0 + k * e8)
    for k in range(4):
        tracks.append(kick(0.5) if k % 2 == 0 else snare(0.32))
        offs.append(t0 + k * beat)
    for k in range(8):
        tracks.append(hat(0.1 if k % 2 else 0.05))
        offs.append(t0 + k * e8)
raw = mix(*tracks, offsets=offs)
n = int(total * SR)
bgm = raw[:n]
for i in range(n, len(raw)):
    bgm[i - n] += raw[i]
save("bgm", bgm, 0.42)
