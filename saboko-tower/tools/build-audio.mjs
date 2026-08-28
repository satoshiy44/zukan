/* saboko-tower/assets/audio/ に置いた音声ファイルを埋め込み形式に変換する。
 *
 *   node saboko-tower/tools/build-audio.mjs
 *
 * 出力 : saboko-tower/assets/sounds.js
 * 置いていないものは audio.js が合成音で代わりを鳴らす。 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(HERE, 'assets', 'audio');
const OUT_FILE = path.join(HERE, 'assets', 'sounds.js');

const SLOTS = { bgm: 'BGM（自動でループ再生）' };
const MIME = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

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
  // 曲名のまま置いても使えるように、名前が合わない曲が1つだけならそれをBGMにする
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
    report.push(`  ${slot} (なし) — 合成したループを鳴らします / ${label}`);
    continue;
  }
  const buf = fs.readFileSync(file);
  entries.push(`  ${slot}: 'data:${MIME[path.extname(file).toLowerCase()]};base64,${buf.toString('base64')}',`);
  const kb = Math.round(buf.length / 1024);
  report.push(`  ${slot} ${path.basename(file)} / ${kb}KB`);
  if (buf.length > 3 * 1024 * 1024) {
    warnings.push(`${path.basename(file)} が ${Math.round(kb / 102.4) / 10}MB あります。1枚HTMLがその1.33倍ぶん重くなるので、短いループにするかビットレートを落とすと快適です`);
  }
}

fs.writeFileSync(
  OUT_FILE,
  `/* saboko-tower/tools/build-audio.mjs が生成。直接編集しないでください。 */\n` +
  `window.TOWER_SOUNDS = {\n${entries.join('\n')}\n};\n`
);
console.log('saboko-tower/assets/sounds.js を書き出しました');
console.log(report.join('\n'));
console.log(`  合計 ${Math.round(fs.statSync(OUT_FILE).size / 1024)}KB`);
if (warnings.length) {
  console.log('\n注意:');
  for (const w of warnings) console.log(`  - ${w}`);
}
