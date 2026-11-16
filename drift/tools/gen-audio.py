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
random.seed(4242)


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
# ドリフトが続くと ド レ ミ ファ ソ ラ シ ド と上がっていく
for i, n in enumerate((72, 74, 76, 77, 79, 81, 83, 84)):
    save("se_do%d" % i, mix(bell(note(n + 12), 0.45, 0.2), tone(note(n), 0.16, "sq", 0.1, 0.003, 0.16), sweep(0.12, 800, 2400, "sin", 0.06)))
save("se_hop", sweep(0.12, 300, 900, "sq", 0.14))
save("se_land", [v * 0.5 for v in lowpass(noise(0.1, 0.6, 2.0), 0.2)])
save("se_drift", mix([v * 0.5 for v in lowpass(noise(0.35, 0.5, 0.6), 0.6)], sweep(0.35, 1800, 1500, "tri", 0.1)))
save("se_boost1", mix(sweep(0.35, 200, 900, "saw", 0.16, 0.6), [v * 0.5 for v in lowpass(noise(0.35, 0.5, 1.0), 0.3)]))
save("se_boost2", mix(sweep(0.5, 200, 1400, "saw", 0.18, 0.5), [v * 0.6 for v in lowpass(noise(0.5, 0.6, 0.8), 0.35)], bell(note(96), 0.3, 0.12), offsets=[0, 0, 0.1]))
save("se_boost3", mix(sweep(0.7, 150, 2000, "saw", 0.2, 0.5), [v * 0.7 for v in lowpass(noise(0.7, 0.7, 0.7), 0.35)],
                      *[bell(note(n), 0.5, 0.13) for n in (84, 88, 91, 96, 100)], offsets=[0, 0, 0.1, 0.16, 0.22, 0.28, 0.34]))
save("se_great", mix(*[tone(note(n), 0.12, "sq", 0.14) for n in (79, 84)], offsets=[0, 0.08]))
save("se_perfect", mix(*[bell(note(n), 0.5, 0.18) for n in (84, 88, 91, 96)], *[tone(note(n), 0.1, "sq", 0.08) for n in (84, 88, 91, 96)],
                       offsets=[0, 0.06, 0.12, 0.18, 0, 0.06, 0.12, 0.18]))
save("se_spin", mix(sweep(0.8, 900, 150, "sq", 0.14), [v * 0.5 for v in lowpass(noise(0.8, 0.5, 0.5), 0.5)]))
save("se_scrape", [v * (0.6 + 0.4 * math.sin(i / 90)) for i, v in enumerate(lowpass(noise(0.3, 0.6, 0.3), 0.7))])
save("se_wall", mix(sweep(0.2, 220, 60, "sq", 0.25), [v for v in lowpass(noise(0.2, 0.7, 1.5), 0.3)]))
save("se_warn", mix(*[tone(note(n), 0.09, "sq", 0.14) for n in (88, 88)], offsets=[0, 0.13]))
save("se_count", tone(note(81), 0.14, "sq", 0.2))
save("se_go", mix(*[tone(note(n), 0.45 if i == 2 else 0.1, "sq", 0.18) for i, n in enumerate((72, 79, 84))], offsets=[0, 0.1, 0.2]))
save("se_finish", mix(*[tone(note(n), 0.5 if i == 3 else 0.14, "sq", 0.18) for i, n in enumerate((72, 76, 79, 84))], offsets=[0, 0.14, 0.28, 0.42]))
# 観客のわーっ
cheer = lowpass(noise(1.4, 0.5, 0.4), 0.35)
cheer = [v * min(1, i / (0.15 * SR)) for i, v in enumerate(cheer)]
voices = []
offs = []
for k in range(26):
    f = random.uniform(500, 1100)
    d = random.uniform(0.3, 0.7)
    voices.append(sweep(d, f, f * random.uniform(1.1, 1.4), "tri", 0.05, 0.5))
    offs.append(random.uniform(0, 0.6))
save("se_cheer", mix(cheer, *voices, offsets=[0] + offs))
save("se_firework", mix(sweep(0.25, 400, 1600, "sin", 0.1), [v for v in lowpass(noise(0.5, 0.6, 1.2), 0.4)], offsets=[0, 0.22]))

# ---- BGM ----
# サーキット: 明るいポップ(C)
CH_C = [(48, [60, 64, 67]), (45, [60, 64, 69]), (41, [60, 65, 69]), (43, [59, 62, 67]),
        (48, [60, 64, 67]), (45, [60, 64, 69]), (50, [62, 65, 69]), (43, [59, 62, 67])] * 2
M_C = [72, None, 76, 79, 84, None, 79, None, 81, None, 79, 76, 77, -1, None, None,
       76, None, 79, 81, 84, None, 81, None, 79, 77, 76, None, 74, -1, None, None,
       72, None, 76, 79, 84, None, 86, 84, 81, None, 84, None, 77, 79, 81, None,
       79, None, 77, 76, 74, None, 76, 74, 72, -1, -1, None, None, None, None, None,
       84, None, 83, 84, 86, None, 84, None, 81, None, 79, 81, 84, -1, None, None,
       81, None, 79, 77, 76, None, 77, None, 79, 81, 79, None, 74, -1, None, None,
       84, None, 86, 88, 89, None, 88, 86, 84, None, 81, None, 79, 81, 79, None,
       76, None, 77, 79, 74, None, 76, None, 72, -1, -1, -1, None, None, None, None]
song("bgm_c", 160, CH_C, M_C)
# マグマ城: 少しあやしいけどノリのいい曲(Am)
CH_K = [(45, [57, 60, 64]), (41, [57, 60, 65]), (43, [59, 62, 67]), (40, [56, 59, 64])] * 4
M_K = [69, None, 72, 69, 76, None, 74, 72, 71, None, 72, 74, 76, -1, None, None,
       77, None, 76, 74, 72, None, 71, 69, 68, None, 71, None, 76, -1, None, None,
       69, None, 72, 76, 81, None, 79, 77, 76, None, 74, None, 72, 74, 76, None,
       74, None, 72, 71, 72, None, 71, None, 69, -1, -1, None, None, None, None, None] * 2
song("bgm_k", 168, CH_K, M_K, 0.08)
# 山道: さわやかな冒険の曲(D)
CH_M = [(50, [62, 66, 69]), (47, [62, 66, 71]), (43, [62, 67, 71]), (45, [61, 64, 69])] * 4
M_M = [74, None, 78, 81, 86, -1, 85, None, 83, None, 81, 83, 78, -1, None, None,
       79, None, 81, 83, 86, None, 83, None, 81, 79, 78, None, 76, -1, None, None,
       74, None, 78, 81, 86, -1, 88, 86, 85, None, 83, None, 81, 83, 85, None,
       86, None, 85, 83, 81, None, 76, None, 74, -1, -1, None, None, None, None, None] * 2
song("bgm_m", 150, CH_M, M_M)
