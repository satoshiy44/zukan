/* assets/audio/ に置いた音声ファイルを、ゲームが読める形に変換する。
 *
 *   node tools/build-audio.mjs
 *
 * 入力 : assets/audio/bgm.mp3 など（下の SLOTS 参照。拡張子は mp3/m4a/ogg/wav）
 * 出力 : assets/sounds.js
 *
 * 画像と同じく data URI で埋め込む。index.html をファイルから直接開いても、
 * 1枚にまとめた配布用HTMLでも、同じように鳴らすため。
 * ファイルが無いスロットは、audio.js が合成音で代わりを鳴らす。 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'audio');
const OUT_FILE = path.join(ROOT, 'assets', 'sounds.js');

const SLOTS = {
  bgm:      'BGM（自動でループ再生）',
  drop:     'さぼこを落としたとき',
  merge:    '合体したとき',
  clear:    '最大どうしを消したとき',
  gameover: 'ゲームオーバー',
};

const MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function audioFiles() {
  if (!fs.existsSync(SRC_DIR)) return [];
  return fs.readdirSync(SRC_DIR).filter((n) => MIME[path.extname(n).toLowerCase()]);
}

function findFile(slot) {
  const names = audioFiles();
  for (const ext of Object.keys(MIME)) {
    const hit = names.find((n) => n.toLowerCase() === slot + ext);
    if (hit) return path.join(SRC_DIR, hit);
  }
  // bgm だけは、決まった名前のファイルが無くても、名前が合わない曲が1つだけなら
  // それを使う。曲名のまま置いても動くようにするため。
  if (slot === 'bgm') {
    const known = Object.keys(SLOTS);
    const leftover = names.filter((n) => !known.includes(path.basename(n, path.extname(n)).toLowerCase()));
    if (leftover.length === 1) return path.join(SRC_DIR, leftover[0]);
  }
  return null;
}

const entries = [];
const report = [];
const warnings = [];

for (const [slot, label] of Object.entries(SLOTS)) {
  const file = findFile(slot);
  if (!file) {
    report.push(`  ${slot.padEnd(9)} (なし) — 合成音を使います / ${label}`);
    continue;
  }
  const buf = fs.readFileSync(file);
  const mime = MIME[path.extname(file).toLowerCase()];
  entries.push(`  ${slot}: '${`data:${mime};base64,${buf.toString('base64')}`}',`);
  const kb = Math.round(buf.length / 1024);
  report.push(`  ${slot.padEnd(9)} ${path.basename(file)} / ${kb}KB`);

  if (slot === 'bgm' && buf.length > 3 * 1024 * 1024) {
    warnings.push(`bgm が ${Math.round(kb / 1024 * 10) / 10}MB あります。配布用の1枚HTMLがその1.33倍ぶん重くなるので、短いループにするかビットレートを落とすと快適です`);
  }
  if (slot !== 'bgm' && buf.length > 400 * 1024) {
    warnings.push(`${slot} が ${kb}KB あります。効果音は1秒以内・数十KBが目安です`);
  }
}

fs.writeFileSync(
  OUT_FILE,
  `/* tools/build-audio.mjs が生成。直接編集しないでください。 */\n` +
  `window.SABOKO_SOUNDS = {\n${entries.join('\n')}\n};\n`
);

console.log('assets/sounds.js を書き出しました');
console.log(report.join('\n'));
console.log(`  合計 ${Math.round(fs.statSync(OUT_FILE).size / 1024)}KB`);
if (warnings.length) {
  console.log('\n注意:');
  for (const w of warnings) console.log(`  - ${w}`);
}
