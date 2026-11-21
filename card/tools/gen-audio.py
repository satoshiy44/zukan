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
random.seed(1000000)


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


def song(name, bpm, chords, mel, lead_vol=0.085):
    beat = 60 / bpm
    e8 = beat / 2
    total = len(chords) * 4 * beat
    tracks, offs = [], []
    for i, n in enumerate(mel):
        if n is None or n == -1:
            continue
        ln = 1
        while i + ln < len(mel) and mel[i + ln] == -1:
            ln += 1
        tracks.append(tone(note(n), e8 * ln * 0.85, "sq", lead_vol, 0.004, e8 * ln * 0.85))
        offs.append(i * e8)
        tracks.append(tone(note(n - 12), e8 * ln * 0.6, "tri", 0.05, 0.004, e8 * ln * 0.6))
        offs.append(i * e8)
    for b, (root, ch) in enumerate(chords):
        t0 = b * 4 * beat
        for k in range(8):
            tracks.append(tone(note(root - 12 + (0, 12)[k % 2]), e8 * 0.8, "tri", 0.24, 0.003, e8 * 0.8))
            offs.append(t0 + k * e8)
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
    out = raw[:n]
    for i in range(n, len(raw)):
        out[i - n] += raw[i]
    save(name, out, 0.42)


# ---- 効果音 ----
save("se_atm", mix(*[tone(note(n), 0.08, "sq", 0.14) for n in (88, 88, 93)], offsets=[0, 0.12, 0.24]))
save("se_cash", mix(*[[v * 0.5 for v in lowpass(noise(0.05, 0.6, 2.0), 0.6)] for _ in range(14)], offsets=[k * 0.06 for k in range(14)]))
save("se_door", mix(bell(note(88), 0.6, 0.2), bell(note(84), 0.8, 0.2), offsets=[0, 0.25]))
save("se_select", mix(tone(note(84), 0.07, "sq", 0.14), tone(note(91), 0.1, "sq", 0.14), offsets=[0, 0.06]))
save("se_unselect", mix(tone(note(84), 0.07, "sq", 0.12), tone(note(77), 0.1, "sq", 0.12), offsets=[0, 0.06]))
save("se_decide", mix(*[tone(note(n), 0.12, "sq", 0.15) for n in (72, 76, 79, 84)], offsets=[0, 0.06, 0.12, 0.18]))
save("se_cart", mix(*[[v * 0.6 for v in lowpass(noise(0.09, 0.6, 1.5), 0.3)] for _ in range(4)], sweep(0.3, 300, 600, "tri", 0.15), offsets=[0, 0.08, 0.16, 0.24, 0]))
save("se_rip", [v * (1 - i / (0.25 * SR)) for i, v in enumerate(lowpass(noise(0.25, 0.8, 0.3), 0.7))])
save("se_flip", mix(sweep(0.09, 900, 1600, "tri", 0.12), [v * 0.3 for v in lowpass(noise(0.07, 0.4, 2.0), 0.6)]))
save("se_rare1", mix(*[bell(note(n), 0.5, 0.2) for n in (84, 91)], offsets=[0, 0.07]))
save("se_rare2", mix(*[bell(note(n), 0.6, 0.18) for n in (84, 88, 91, 96)], sweep(0.4, 500, 2000, "sq", 0.08, 0.5), offsets=[0, 0.07, 0.14, 0.21, 0]))
save("se_rare3", mix(*[tone(note(n), 0.5 if i == 5 else 0.12, "sq", 0.16) for i, n in enumerate((72, 76, 79, 84, 88, 91))],
                     *[bell(note(n), 0.8, 0.16) for n in (96, 100, 103)], offsets=[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.5, 0.6, 0.7]))
save("se_god", mix(sweep(0.8, 100, 1200, "saw", 0.18, 0.5), *[bell(note(n), 1.2, 0.18) for n in (84, 88, 91, 96, 100, 103, 108)],
                   [v * 0.5 for v in lowpass(noise(1.0, 0.5, 0.6), 0.2)], offsets=[0, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88, 0.3]))
glitch = []
for k in range(8):
    glitch.append(tone(random.choice([220, 330, 1200, 1800, 2600]), 0.05, "sq", 0.15, 0.001, 0.05))
save("se_error", mix(*glitch, [v * 0.6 for v in noise(0.4, 0.5, 0.8)], offsets=[k * 0.045 for k in range(8)] + [0]))
save("se_tick", tone(note(96), 0.05, "sq", 0.1, 0.001, 0.05))
save("se_finish", mix(*[tone(note(n), 0.5 if i == 3 else 0.14, "sq", 0.18) for i, n in enumerate((72, 76, 79, 84))], offsets=[0, 0.14, 0.28, 0.42]))
cheer = lowpass(noise(1.4, 0.5, 0.45), 0.35)
cheer = [v * min(1, i / (0.12 * SR)) for i, v in enumerate(cheer)]
voices, offs = [], []
for k in range(24):
    f = random.uniform(500, 1100)
    voices.append(sweep(random.uniform(0.3, 0.6), f, f * random.uniform(1.1, 1.4), "tri", 0.05, 0.5))
    offs.append(random.uniform(0, 0.6))
save("se_cheer", mix(cheer, *voices, offsets=[0] + offs))

# ---- BGM ----
CH = [(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67])] * 4
M = [72, None, 76, 79, 76, None, 72, None, 74, None, 77, 81, 79, -1, None, None,
     76, None, 79, 84, 81, None, 79, 77, 76, -1, -1, None, 74, None, None, None] * 4
song("bgm_shop", 132, CH, M, 0.07)
CH2 = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [60, 64, 67]), (43, [59, 62, 67])] * 4
M2 = [81, 81, 84, 81, 79, None, 76, None, 77, 77, 81, 77, 76, None, 72, None,
      79, 79, 83, 79, 84, None, 86, None, 88, None, 86, 84, 83, None, 79, None] * 4
song("bgm_open", 168, CH2, M2, 0.08)
