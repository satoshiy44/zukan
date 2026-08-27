/* さぼこ落としゲームの音まわり。
 *
 * 音声ファイルは持たず、WebAudio で全部その場で合成する。
 * 配布用の1枚HTMLに素材を抱えずに済み、権利関係も発生しない。
 *
 * ブラウザは操作なしに音を鳴らさせてくれないので、最初のクリック／キー入力で
 * unlock() を呼んでから鳴らし始める。 */
window.SabokoAudio = (() => {
  'use strict';

  const MUTE_KEY = 'saboko-drop-muted';
  const BPM = 96;
  const BEAT = 60 / BPM;
  const STEP = BEAT / 2;          // 8分音符
  const BARS = 4;
  const STEPS_PER_BAR = 8;

  // 4小節のループ。素朴で邪魔にならない進行にしてある。
  const CHORDS = [
    [57, 60, 64, 67], // Am7
    [53, 57, 60, 64], // Fmaj7
    [48, 52, 55, 59], // Cmaj7
    [55, 59, 62, 65], // G
  ];
  const BASS = [45, 41, 36, 43];

  // 合体音は段階が上がるほど高くする。ペンタトニックに乗せると音痴に聞こえない。
  const MERGE_NOTES = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

  let ctx = null;
  let master, bgmGain, sfxGain;
  let muted = localStorage.getItem(MUTE_KEY) === '1';
  let schedulerId = null;
  let nextStepTime = 0;
  let step = 0;

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.08;
    bgmGain.connect(master);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(master);
    return true;
  }

  // 単音。エンベロープを付けてプツプツ鳴らないようにする。
  function tone(dest, freq, start, dur, type, peak, detune) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (detune) osc.detune.setValueAtTime(detune, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  // 落下・着地用の短いノイズ
  function thud(start) {
    const len = Math.floor(ctx.sampleRate * 0.09);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, start);
    src.connect(filter).connect(gain).connect(sfxGain);
    src.start(start);
  }

  // ---- BGM ----
  // 少し先の分まで前もって予約する方式。setInterval のブレを音に出さないため。
  function schedule() {
    const lookahead = ctx.currentTime + 0.25;
    while (nextStepTime < lookahead) {
      const bar = Math.floor(step / STEPS_PER_BAR) % BARS;
      const i = step % STEPS_PER_BAR;
      const chord = CHORDS[bar];

      // アルペジオ（上って下りる）
      const order = [0, 1, 2, 3, 2, 1, 0, 2];
      tone(bgmGain, hz(chord[order[i]] + 12), nextStepTime, STEP * 1.6, 'triangle', 0.5);

      // ベースは1拍目と3拍目だけ
      if (i === 0 || i === 4) {
        tone(bgmGain, hz(BASS[bar]), nextStepTime, BEAT * 1.4, 'sine', 0.75);
      }

      nextStepTime += STEP;
      step++;
    }
  }

  function startBgm() {
    if (schedulerId !== null) return;
    nextStepTime = ctx.currentTime + 0.1;
    step = 0;
    schedule();
    schedulerId = setInterval(schedule, 80);
  }

  // ---- 公開する操作 ----
  function unlock() {
    if (!ctx && !build()) return;
    if (ctx.state === 'suspended') ctx.resume();
    startBgm();
  }

  const ready = () => ctx && !muted;

  return {
    unlock,

    isMuted: () => muted,

    toggle() {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      if (ctx) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02);
      return muted;
    },

    drop() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(sfxGain, 320, t, 0.1, 'sine', 0.25);
    },

    merge(tier) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const note = MERGE_NOTES[Math.min(tier, MERGE_NOTES.length - 1)];
      thud(t);
      tone(sfxGain, hz(note), t + 0.01, 0.22, 'triangle', 0.4);
      tone(sfxGain, hz(note + 7), t + 0.05, 0.2, 'sine', 0.25);
    },

    // 最大同士を消したとき
    clear() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16].forEach((n, i) => {
        tone(sfxGain, hz(72 + n), t + i * 0.07, 0.35, 'triangle', 0.4);
      });
    },

    gameOver() {
      if (!ready()) return;
      const t = ctx.currentTime;
      [69, 65, 62, 57].forEach((n, i) => {
        tone(sfxGain, hz(n), t + i * 0.16, 0.5, 'sine', 0.45);
      });
    },
  };
})();
