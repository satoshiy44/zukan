/* さぼこしゅーてぃんぐの音。
 *
 * 効果音とうなり声は WebAudio で合成する。撃つ音は毎秒5発鳴るので、
 * ファイル再生より合成のほうが軽くて遅延も出ない。
 *
 * BGMは assets/audio/bgm.mp3 を置けばそれを鳴らし、無ければ合成した
 * ループを鳴らす。合成のほうは暗めで前へ押す感じの進行にしてある。 */
window.WaveAudio = (() => {
  'use strict';

  // 名前を変える前からの保存値。変えるとミュート設定が戻ってしまうので据え置き。
  const MUTE_KEY = 'saboko-wave-muted';
  const FILE_BGM_VOLUME = 0.16;

  const FILES = window.WAVE_SOUNDS || {};

  // 合成BGM。Aマイナーの押し続ける感じ。
  const BPM = 132;
  const BEAT = 60 / BPM;
  const STEP = BEAT / 2;
  const STEPS_PER_BAR = 8;
  const BASS = [45, 45, 41, 43];               // A, A, F, G
  const LEAD = [
    [69, null, 72, null, 76, null, 72, null],
    [69, null, 72, null, 76, null, 79, null],
    [65, null, 69, null, 72, null, 69, null],
    [67, null, 71, null, 74, null, 71, null],
  ];

  let ctx = null, master, sfx, bgmGain;
  let bgmEl = null, schedulerId = null, nextStepTime = 0, step = 0;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.4;
    sfx.connect(master);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.075;
    bgmGain.connect(master);
    return true;
  }

  // pan を渡すと左右に振れる。対応していないブラウザでは素通しする。
  function out(pan) {
    if (!pan || !ctx.createStereoPanner) return sfx;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(sfx);
    return p;
  }

  function tone(dest, freq, start, dur, type, peak, slideTo) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.04);
  }

  function noise(dest, dur, cutoff, peak, type) {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  // ---- うなり声 ----
  // 低いノコギリ波をゆっくり下げ、声の揺れをLFOで付ける。
  // そこに息づかいのノイズを重ねると、それらしいうめき声になる。
  function groanAt(start, intensity, pan) {
    const dest = out(pan);
    const dur = 0.45 + Math.random() * 0.55;
    const base = 58 + Math.random() * 46;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.18, start);
    osc.frequency.exponentialRampToValueAtTime(base * 0.68, start + dur);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4.5 + Math.random() * 4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = base * 0.14;
    lfo.connect(lfoGain).connect(osc.frequency);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620 + intensity * 1000, start);
    filter.Q.value = 5;

    const g = ctx.createGain();
    const peak = 0.05 + intensity * 0.14;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter).connect(g).connect(dest);
    osc.start(start); osc.stop(start + dur + 0.05);
    lfo.start(start); lfo.stop(start + dur + 0.05);

    // 息
    const bre = ctx.createGain();
    bre.gain.setValueAtTime(peak * 0.5, start);
    bre.gain.exponentialRampToValueAtTime(0.0001, start + dur * 0.8);
    bre.connect(dest);
    noise(bre, dur * 0.8, 900, 0.5, 'bandpass');
  }

  // ---- 合成BGM ----
  function schedule() {
    const lookahead = ctx.currentTime + 0.25;
    while (nextStepTime < lookahead) {
      const bar = Math.floor(step / STEPS_PER_BAR) % 4;
      const i = step % STEPS_PER_BAR;

      // 8分で刻むベース。これが前へ押す感じを作る。
      tone(bgmGain, hz(BASS[bar] + (i === 6 ? 12 : 0)), nextStepTime, STEP * 0.85, 'sawtooth', 0.5);

      const lead = LEAD[bar][i];
      if (lead !== null) tone(bgmGain, hz(lead), nextStepTime, STEP * 1.5, 'triangle', 0.22);

      // 裏拍の刻み
      if (i % 2 === 1) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, nextStepTime);
        g.connect(bgmGain);
        noise(g, 0.03, 7000, 0.5, 'highpass');
      }

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

    // intensity 0〜1（近いほど大きく明るい）、pan -1〜1
    groan(intensity, pan) { if (on()) groanAt(ctx.currentTime, intensity || 0.4, pan || 0); },

    // 群れが湧いたとき。声を重ねて厚みを出す。
    horde() {
      if (!on()) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        groanAt(t + i * 0.09 + Math.random() * 0.12, 0.55 + Math.random() * 0.3, (Math.random() * 2 - 1) * 0.8);
      }
    },

    shoot()  { if (on()) tone(out(0), 880, ctx.currentTime, 0.05, 'square', 0.06, 420); },
    hit()    { if (on()) noise(sfx, 0.05, 2600, 0.12); },
    kill(pan) {
      if (!on()) return;
      noise(out(pan), 0.14, 1100, 0.3);
      tone(out(pan), 220, ctx.currentTime, 0.12, 'triangle', 0.18, 90);
      if (Math.random() < 0.45) groanAt(ctx.currentTime, 0.75, pan || 0);
    },
    boss()   { if (on()) { tone(sfx, 110, ctx.currentTime, 0.6, 'sawtooth', 0.24, 62); groanAt(ctx.currentTime + 0.1, 1, 0); groanAt(ctx.currentTime + 0.35, 0.9, -0.3); } },
    heal()   { if (on()) [0, 4, 7].forEach((n, i) => setTimeout(() => on() && tone(sfx, 440 * Math.pow(2, n / 12), ctx.currentTime, 0.18, 'sine', 0.25), i * 60)); },
    hurt()   { if (on()) { noise(sfx, 0.2, 500, 0.4); tone(sfx, 160, ctx.currentTime, 0.25, 'sawtooth', 0.2, 70); } },
    levelUp(){ if (on()) [0, 4, 7, 12].forEach((n, i) => setTimeout(() => on() && tone(sfx, 523 * Math.pow(2, n / 12), ctx.currentTime, 0.25, 'triangle', 0.3), i * 70)); },
    gameOver(){ if (on()) { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => on() && tone(sfx, f, ctx.currentTime, 0.45, 'sine', 0.35), i * 170)); groanAt(ctx.currentTime + 0.2, 1, 0); } },
  };
})();
