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

# ぽんっ(いもが抜けた): 続けて抜くほど音が上がる
for k in range(1, 9):
    f = 330 * 2 ** ((k - 1) * 2 / 12)
    save("pop%d" % k, mix(sweep(0.14, f, f * 3, "sin", 0.8, 0.6), sweep(0.14, f * 2, f * 6, "tri", 0.18, 0.6),
                          tone(f * 4, 0.12, "tri", 0.06 * k, 0.002, 0.12)))
# 手もと確定(チャリーン)
save("bank", mix(*[tone(note(n), 0.25, "sq", 0.12, 0.002, 0.25) for n in (88, 93)],
                 *[tone(note(n), 0.5, "sin", 0.3, 0.002, 0.5) for n in (100, 105)],
                 offsets=[0, 0.07, 0.07, 0.14]))
# パー(しょんぼり)
save("lose", mix(sweep(0.25, 440, 330, "sq", 0.2), sweep(0.25, 415, 311, "sq", 0.2), sweep(0.6, 392, 196, "sq", 0.22, 1.5),
                 offsets=[0, 0.25, 0.5]))
# ドキドキ(心臓の音)
save("heart", mix(lowpass(sweep(0.09, 90, 50, "sin", 1.0), 0.3), lowpass(sweep(0.09, 80, 45, "sin", 0.7), 0.3), offsets=[0, 0.14]))
# 金のいも
gold = [tone(note(n), 0.35, "tri", 0.35, 0.002, 0.35) for n in (84, 88, 91, 96)]
save("gold", mix(*gold, tone(note(100), 0.6, "sin", 0.3, 0.002, 0.6), offsets=[0, 0.06, 0.12, 0.18, 0.24]))
# ブチッ(つるが切れた)
save("snap_se", mix(lowpass(noise(0.12, 1.0, 2.0), 0.5), sweep(0.35, 180, 40, "sq", 0.5, 0.5), lowpass(noise(0.3, 0.4, 1.5), 0.08), offsets=[0, 0.02, 0.05]))
# ギギ…(きしみ)
save("creak", [osc("saw", 0) * 0 + v for v in lowpass(sweep(0.22, 140, 190, "saw", 0.5), 0.3)])
# ガッ(石が引っかかる)
save("rock_se", mix(lowpass(noise(0.18, 1.0, 3.0), 0.35), sweep(0.18, 120, 60, "sq", 0.5)))
# まるごと収穫
fan = [(72, 0), (76, 0.1), (79, 0.2), (84, 0.3)]
save("harvest", mix(*[tone(note(n), 0.35 if i < 3 else 0.6, "sq", 0.18) for i, (n, _) in enumerate(fan)],
                    *[tone(note(n - 12), 0.35 if i < 3 else 0.6, "tri", 0.3) for i, (n, _) in enumerate(fan)],
                    offsets=[o for _, o in fan] * 2))
# カウントダウン
save("beep", tone(note(81), 0.12, "sq", 0.3))
save("go", mix(tone(note(88), 0.35, "sq", 0.3), tone(note(76), 0.35, "tri", 0.3)))
# 終了
save("finish", mix(tone(note(84), 0.2, "sq", 0.25), tone(note(79), 0.2, "sq", 0.25), tone(note(72), 0.9, "sq", 0.25),
                   tone(note(60), 0.9, "tri", 0.4), lowpass(noise(0.6, 0.3, 1.5), 0.1), offsets=[0, 0.15, 0.3, 0.3, 0.3]))
# ラスト大株(太鼓の連打+ジャーン)
drums = [lowpass(mix(sweep(0.12, 150, 60, "sin", 0.9), noise(0.05, 0.4, 2)), 0.4) for _ in range(8)]
save("last", mix(*drums, tone(note(79), 0.8, "sq", 0.2), tone(note(67), 0.8, "tri", 0.35), tone(note(74), 0.8, "sq", 0.15),
                 offsets=[i * 0.07 for i in range(8)] + [0.6, 0.6, 0.6]))
# 結果発表
save("result", mix(*[tone(note(n), 0.14, "sq", 0.2) for n in (72, 74, 76, 79, 81, 84)],
                   tone(note(84), 0.8, "tri", 0.35), tone(note(88), 0.8, "sq", 0.15),
                   offsets=[i * 0.08 for i in range(6)] + [0.5, 0.5]))

# ---- 後半: やきいも屋台 ----
# 極上(キラキラ)
save("perfect", mix(*[tone(note(n), 0.3, "tri", 0.3, 0.002, 0.3) for n in (84, 88, 91, 96, 100)],
                    *[tone(note(n), 0.3, "sq", 0.08, 0.002, 0.3) for n in (84, 88, 91, 96, 100)],
                    offsets=[i * 0.05 for i in range(5)] * 2))
# うまい
save("good", mix(tone(note(79), 0.15, "sq", 0.2), tone(note(84), 0.3, "tri", 0.3), offsets=[0, 0.08]))
# なま・こげ
save("bad", mix(sweep(0.35, 300, 150, "sq", 0.25), lowpass(noise(0.2, 0.3, 2), 0.2)))
# 屋台オープン
save("open", mix(*[tone(note(n), 0.16, "sq", 0.18) for n in (72, 76, 79, 84, 79, 84)],
                 tone(note(88), 0.7, "tri", 0.35), offsets=[i * 0.11 for i in range(6)] + [0.66]))

# ---- BGM: 祭囃子風のループ(ヨナ抜き音階, 140BPM, 8小節) ----
BPM = 140
beat = 60 / BPM
bars = 8
total = bars * 4 * beat
# メロディ(8分音符単位, None=休符)
mel = [
    76, 79, 81, 79, 76, 74, 72, None, 74, 76, 79, 76, 74, 72, 69, None,
    72, 74, 76, 79, 81, 84, 81, 79, 76, 79, 76, 74, 76, None, None, None,
    76, 79, 81, 79, 76, 74, 72, None, 74, 76, 79, 76, 74, 72, 69, None,
    72, 74, 76, 74, 72, 69, 67, 69, 72, 74, 72, 69, 72, None, 72, None,
]
bass = [48, 48, 55, 55, 45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 43, 50]  # 2拍ごと
tracks, offs = [], []
for i, n in enumerate(mel):
    if n is None:
        continue
    tracks.append(tone(note(n), beat * 0.45, "sq", 0.11, 0.004, beat * 0.45))
    offs.append(i * beat / 2)
    tracks.append(tone(note(n + 12), beat * 0.3, "tri", 0.05, 0.004, beat * 0.3))
    offs.append(i * beat / 2)
for i, n in enumerate(bass):
    for k in range(2):
        tracks.append(tone(note(n), beat * 0.8, "tri", 0.28, 0.004, beat * 0.8))
        offs.append((i * 2 + k) * beat)
# 太鼓とかね
for b in range(bars * 4):
    t = b * beat
    tracks.append(lowpass(sweep(0.16, 130, 55, "sin", 0.7), 0.5))
    offs.append(t)
    if b % 2 == 1:
        tracks.append(lowpass(mix(sweep(0.09, 260, 140, "sin", 0.35), noise(0.04, 0.25, 2)), 0.5))
        offs.append(t + beat / 2)
    tracks.append([v * 0.12 for v in tone(note(100), 0.05, "sq", 1.0)])
    offs.append(t + beat / 2)
bgm = mix(*tracks, offsets=offs)[: int(total * SR)]
save("bgm", bgm, 0.8)
