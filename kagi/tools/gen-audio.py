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
random.seed(31)


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


# 線を引きはじめる(さっ)
save("draw", [v * (1 - i / 3000) for i, v in enumerate(lowpass(noise(0.14, 0.35, 0.6), 0.25))])
# 入っていた(静かなチャイム)
save("ok_se", mix(*[bell(note(n), 0.6, 0.22) for n in (76, 83, 88)], offsets=[0, 0.07, 0.14]))
# 入っていなかった(低い音)
save("ng_se", mix(lowpass(sweep(0.3, 180, 90, "sin", 0.6), 0.3), tone(110, 0.2, "tri", 0.2)))
# 見つけた
save("found", mix(*[bell(note(n), 1.2, 0.25) for n in (72, 76, 79, 84, 88, 91)], offsets=[i * 0.12 for i in range(6)]))
save("beep", tone(note(81), 0.1, "sin", 0.25))
save("go", mix(*[bell(note(n), 0.5, 0.25) for n in (76, 83)], offsets=[0, 0.1]))
save("finish", mix(*[bell(note(n), 0.8, 0.25) for n in (84, 79, 72)], offsets=[0, 0.15, 0.3]))

# ---- BGM: 低めの静かなピアノ風(72BPM, 8小節) ----
def piano(freq, dur, vol=0.3):
    out = []
    for i in range(int(dur * SR)):
        t = i / SR
        v = (math.sin(2 * math.pi * freq * t) + 0.3 * math.sin(2 * math.pi * freq * 2 * t) * math.exp(-t * 4)) * math.exp(-t * 2.2)
        out.append(v * vol)
    return out


BPM = 72
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
chords = [(57, 60, 64), (53, 57, 60), (55, 59, 62), (52, 55, 59), (57, 60, 64), (53, 57, 60), (50, 53, 57), (52, 56, 59)]
mel = [76, None, 72, None, 74, None, 72, 71, 72, None, None, None, 71, None, 67, None,
       76, None, 79, None, 77, None, 76, 74, 72, None, None, None, 71, None, None, None]
tracks, offs = [], []
for b, ch in enumerate(chords):
    for k, n in enumerate(ch):
        tracks.append(piano(note(n), beat * 4, 0.12))
        offs.append(b * 4 * beat + k * 0.05)
    tracks.append(piano(note(ch[0] - 12), beat * 4, 0.16))
    offs.append(b * 4 * beat)
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(piano(note(n), beat * 2, 0.16))
    offs.append(i * beat)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.7)
