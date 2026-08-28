/* さぼこタワーの音。効果音は WebAudio で合成する。
 * BGMは assets/audio/ に曲を置けばそれを、無ければ合成した穏やかなループを鳴らす。 */
window.TowerAudio = (() => {
  'use strict';

  const MUTE_KEY = 'saboko-tower-muted';
  const FILE_BGM_VOLUME = 0.16;
  const FILES = window.TOWER_SOUNDS || {};

  const BPM = 84;
  const BEAT = 60 / BPM;
  const STEP = BEAT / 2;
  const CHORDS = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];

  let ctx = null, master, sfx, bgmGain;
  let bgmEl = null, schedulerId = null, nextStepTime = 0, step = 0;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.45;
    sfx.connect(master);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.06;
    bgmGain.connect(master);
    return true;
  }

  function tone(dest, freq, start, dur, type, peak, slideTo) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  }

  function noise(dur, cutoff, peak) {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    src.connect(f).connect(g).connect(sfx);
    src.start(t);
  }

  function schedule() {
    const lookahead = ctx.currentTime + 0.25;
    while (nextStepTime < lookahead) {
      const bar = Math.floor(step / 8) % 4;
      const i = step % 8;
      const chord = CHORDS[bar];
      tone(bgmGain, hz(chord[[0, 2, 1, 3, 2, 1, 3, 0][i]]), nextStepTime, STEP * 1.8, 'sine', 0.5);
      if (i === 0) tone(bgmGain, hz(chord[0] - 24), nextStepTime, BEAT * 1.6, 'triangle', 0.7);
      nextStepTime += STEP;
      step++;
    }
  }

  function startBgm() {
    if (FILES.bgm) {
      if (!bgmEl) {
        bgmEl = new Audio(FILES.bgm);
        bgmEl.loop = true;
        bgmEl.volume = muted ? 0 : FILE_BGM_VOLUME;
      }
      bgmEl.play().catch(() => {});
      return;
    }
    if (schedulerId !== null) return;
    nextStepTime = ctx.currentTime + 0.1;
    step = 0;
    schedule();
    schedulerId = setInterval(schedule, 80);
  }

  const on = () => ctx && !muted;

  return {
    unlock() {
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended') ctx.resume();
      startBgm();
    },
    isMuted: () => muted,
    toggle() {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      if (bgmEl) bgmEl.volume = muted ? 0 : FILE_BGM_VOLUME;
      return muted;
    },
    drop()  { if (on()) tone(sfx, 420, ctx.currentTime, 0.08, 'sine', 0.2); },
    // 積むたびに音が上がっていく。高さが伸びている手応えを音でも出す。
    land(n) {
      if (!on()) return;
      noise(0.07, 900, 0.22);
      const scale = [0, 2, 4, 7, 9];
      tone(sfx, hz(60 + scale[n % 5] + Math.floor(n / 5) * 12), ctx.currentTime + 0.01, 0.2, 'triangle', 0.3);
    },
    record() { if (on()) [0, 4, 7, 12].forEach((n, i) => setTimeout(() => on() && tone(sfx, hz(72 + n), ctx.currentTime, 0.28, 'triangle', 0.3), i * 80)); },
    fall()   { if (on()) { noise(0.3, 400, 0.4); tone(sfx, 220, ctx.currentTime, 0.4, 'sawtooth', 0.2, 70); } },
    over()   { if (on()) [349, 294, 233, 175].forEach((f, i) => setTimeout(() => on() && tone(sfx, f, ctx.currentTime, 0.5, 'sine', 0.32), i * 170)); },
  };
})();
