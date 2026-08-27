/* さぼこウェーブの音。
 *
 * 効果音は WebAudio で合成する（撃つ音は毎秒何発も鳴るので、ファイル再生より軽い）。
 * BGM はスイカゲーム側の assets/sounds.js を共用し、無ければ何も鳴らさない。 */
window.WaveAudio = (() => {
  'use strict';

  const MUTE_KEY = 'saboko-wave-muted';
  const BGM_VOLUME = 0.14;

  const SOUNDS = window.SABOKO_SOUNDS || {};
  let ctx = null, master, sfx;
  let bgmEl = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

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
    return true;
  }

  function tone(freq, dur, type, peak, slideTo) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.03);
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

  const on = () => ctx && !muted;

  return {
    unlock() {
      if (!ctx && !build()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (SOUNDS.bgm) {
        if (!bgmEl) {
          bgmEl = new Audio(SOUNDS.bgm);
          bgmEl.loop = true;
          bgmEl.volume = muted ? 0 : BGM_VOLUME;
        }
        bgmEl.play().catch(() => {});
      }
    },

    isMuted: () => muted,

    toggle() {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      if (bgmEl) bgmEl.volume = muted ? 0 : BGM_VOLUME;
      return muted;
    },

    shoot()  { if (on()) tone(880, 0.05, 'square', 0.06, 420); },
    hit()    { if (on()) noise(0.05, 2600, 0.12); },
    kill()   { if (on()) { noise(0.14, 1100, 0.3); tone(220, 0.12, 'triangle', 0.18, 90); } },
    boss()   { if (on()) { tone(110, 0.5, 'sawtooth', 0.22, 70); tone(165, 0.5, 'triangle', 0.14); } },
    heal()   { if (on()) [0, 4, 7].forEach((n, i) => setTimeout(() => on() && tone(440 * Math.pow(2, n / 12), 0.18, 'sine', 0.25), i * 60)); },
    hurt()   { if (on()) { noise(0.2, 500, 0.4); tone(160, 0.25, 'sawtooth', 0.2, 70); } },
    levelUp(){ if (on()) [0, 4, 7, 12].forEach((n, i) => setTimeout(() => on() && tone(523 * Math.pow(2, n / 12), 0.25, 'triangle', 0.3), i * 70)); },
    gameOver(){ if (on()) [392, 330, 262, 196].forEach((f, i) => setTimeout(() => on() && tone(f, 0.45, 'sine', 0.35), i * 170)); },
  };
})();
