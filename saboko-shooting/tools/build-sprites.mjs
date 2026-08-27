/* さぼこの元画像から、シューティング用のスプライトを書き出す。
 *
 *   node saboko-shooting/tools/build-sprites.mjs
 *
 * 入力 : assets/src/saboko_*.PNG（スイカゲームと共用。重複して持たない）
 * 出力 : saboko-shooting/assets/sprites.js
 *
 * こちらのゲームは当たり判定を矩形で取るので、輪郭の多角形は要らない。
 * 透明な余白を落として、画面に出る最大サイズぶんまで縮めるだけ。 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC_DIR = path.join(ROOT, 'assets', 'src');
const OUT_FILE = path.resolve(import.meta.dirname, '..', 'assets', 'sprites.js');

const COUNT = 12;
const ALPHA_THRESHOLD = 64;
const EXPORT_MAX = 256;   // 画面に出る最大が約190pxなので、その程度で足りる

function mask(png) {
  const m = new Uint8Array(png.width * png.height);
  for (let i = 0; i < m.length; i++) m[i] = png.data[i * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  return m;
}

function bbox(png) {
  const m = mask(png);
  let x0 = png.width, y0 = png.height, x1 = -1, y1 = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (!m[y * png.width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? { x0: 0, y0: 0, w: png.width, h: png.height } : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function crop(png, box) {
  const out = new PNG({ width: box.w, height: box.h });
  for (let y = 0; y < box.h; y++) {
    const src = ((box.y0 + y) * png.width + box.x0) * 4;
    png.data.copy(out.data, y * box.w * 4, src, src + box.w * 4);
  }
  return out;
}

// 透明度で重みを付けて平均するので、フチに黒い縁が出ない
function shrink(png, maxSide) {
  const k = Math.min(1, maxSide / Math.max(png.width, png.height));
  if (k === 1) return png;
  const nw = Math.max(1, Math.round(png.width * k));
  const nh = Math.max(1, Math.round(png.height * k));
  const out = new PNG({ width: nw, height: nh });
  const box = Math.max(1, Math.floor(1 / k));
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const sy0 = Math.floor(y / k), sx0 = Math.floor(x / k);
      for (let j = 0; j < box; j++) {
        const sy = Math.min(png.height - 1, sy0 + j);
        for (let i = 0; i < box; i++) {
          const sx = Math.min(png.width - 1, sx0 + i);
          const p = (sy * png.width + sx) * 4;
          const av = png.data[p + 3];
          r += png.data[p] * av; g += png.data[p + 1] * av; b += png.data[p + 2] * av;
          a += av; n++;
        }
      }
      const q = (y * nw + x) * 4;
      out.data[q] = a ? Math.round(r / a) : 0;
      out.data[q + 1] = a ? Math.round(g / a) : 0;
      out.data[q + 2] = a ? Math.round(b / a) : 0;
      out.data[q + 3] = Math.round(a / n);
    }
  }
  return out;
}

function findSource(i) {
  const want = `saboko_${i}.png`;
  const hit = fs.readdirSync(SRC_DIR).find((n) => n.toLowerCase() === want);
  return hit ? path.join(SRC_DIR, hit) : null;
}

const out = [];
const report = [];
for (let i = 1; i <= COUNT; i++) {
  const file = findSource(i);
  if (!file) { out.push('  null,'); report.push(`  ${i}. (なし)`); continue; }
  const png = PNG.sync.read(fs.readFileSync(file));
  const small = shrink(crop(png, bbox(png)), EXPORT_MAX);
  const buf = PNG.sync.write(small);
  out.push(`  { w: ${small.width}, h: ${small.height}, src: 'data:image/png;base64,${buf.toString('base64')}' },`);
  report.push(`  ${i}. ${path.basename(file)} → ${small.width}x${small.height} / ${Math.round(buf.length / 1024)}KB`);
}

fs.writeFileSync(
  OUT_FILE,
  `/* saboko-shooting/tools/build-sprites.mjs が生成。直接編集しないでください。 */\n` +
  `window.WAVE_SPRITES = [\n${out.join('\n')}\n];\n`
);
console.log('saboko-shooting/assets/sprites.js を書き出しました');
console.log(report.join('\n'));
console.log(`  合計 ${Math.round(fs.statSync(OUT_FILE).size / 1024)}KB`);
