/* さぼこ落としゲームの音まわり。
 *
 * assets/audio/ に音声ファイルを置いて tools/build-audio.mjs を走らせると、
 * assets/sounds.js 経由でそれを鳴らす。置いていないぶんは WebAudio で合成した
 * 音で代用するので、ファイルが1つも無くても音は出る。
 *
 * ブラウザは操作なしに音を鳴らさせてくれないので、最初のクリック／キー入力で
 * unlock() を呼んでから鳴らし始める。 */
window.SabokoAudio = (() => {
  'use strict';

  const MUTE_KEY = 'saboko-drop-muted';
  const FILE_BGM_VOLUME = 0.16;   // 用意されたBGMファイルの音量（効果音より控えめに）
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

  const FILES = window.SABOKO_SOUNDS || {};

  let ctx = null;
  let master, bgmGain, sfxGain;
  let bgmEl = null;               // BGMがファイルのときの <audio>
  const seBuffers = Object.create(null);
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

    for (const name of ['drop', 'merge', 'clear', 'gameover']) loadSe(name);
    return true;
  }

  // ---- 音声ファイルを使う場合 ----
  function dataUriToBuffer(uri) {
    const bin = atob(uri.slice(uri.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function loadSe(name) {
    if (!FILES[name]) return;
    // decodeAudioData は fetch を挟まないので file:// でも通る
    ctx.decodeAudioData(dataUriToBuffer(FILES[name]))
      .then((buf) => { seBuffers[name] = buf; })
      .catch(() => { /* 壊れたファイルなら合成音のまま */ });
  }

  // 鳴らせたら true。false のときは呼び出し側が合成音を鳴らす。
  function playSe(name, rate) {
    const buf = seBuffers[name];
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (rate) src.playbackRate.value = rate;
    src.connect(sfxGain);
    src.start();
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
    if (FILES.bgm) {
      if (!bgmEl) {
        bgmEl = new Audio(FILES.bgm);
        bgmEl.loop = true;
        bgmEl.volume = muted ? 0 : FILE_BGM_VOLUME;
      }
      bgmEl.play().catch(() => { /* 再生を断られたら次の操作でまた試す */ });
      return;
    }
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
      if (bgmEl) bgmEl.volume = muted ? 0 : FILE_BGM_VOLUME;
      return muted;
    },

    drop() {
      if (!ready()) return;
      if (playSe('drop')) return;
      tone(sfxGain, 320, ctx.currentTime, 0.1, 'sine', 0.25);
    },

    merge(tier) {
      if (!ready()) return;
      // ファイルを使う場合も、段階が上がるほど少しだけ高くして育つ感じを出す
      if (playSe('merge', Math.pow(2, (tier - 5) / 36))) return;
      const t = ctx.currentTime;
      const note = MERGE_NOTES[Math.min(tier, MERGE_NOTES.length - 1)];
      thud(t);
      tone(sfxGain, hz(note), t + 0.01, 0.22, 'triangle', 0.4);
      tone(sfxGain, hz(note + 7), t + 0.05, 0.2, 'sine', 0.25);
    },

    // 最大同士を消したとき
    clear() {
      if (!ready()) return;
      if (playSe('clear')) return;
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16].forEach((n, i) => {
        tone(sfxGain, hz(72 + n), t + i * 0.07, 0.35, 'triangle', 0.4);
      });
    },

    gameOver() {
      if (!ready()) return;
      if (playSe('gameover')) return;
      const t = ctx.currentTime;
      [69, 65, 62, 57].forEach((n, i) => {
        tone(sfxGain, hz(n), t + i * 0.16, 0.5, 'sine', 0.45);
      });
    },
  };
})();
