/* さぼこの元画像から、ゲームで使う「形」と画像データを書き出すツール。
 *
 *   node tools/build-assets.mjs
 *
 * 入力 : assets/src/saboko_1.png 〜 saboko_8.png（背景が透明な PNG）
 * 出力 : assets/shapes.js
 *
 * やっていること
 *   1. 透明な余白を切り落とす
 *   2. 不透明な部分の輪郭をたどって多角形にする（＝当たり判定の形）
 *   3. 頂点を間引いて、物理エンジンが扱いやすい程度まで単純化する
 *   4. 切り抜いた画像を data URI にして一緒に書き出す
 *
 * 画像を data URI で埋め込むのは、index.html をファイルから直接開いたときに
 * ブラウザが「別オリジンの画像」とみなして扱いを渋るのを避けるため。
 * これで build 後は index.html をダブルクリックするだけで動く。 */

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'src');
const OUT_FILE = path.join(ROOT, 'assets', 'shapes.js');

const TIER_COUNT = 8;
const ALPHA_THRESHOLD = 64;  // これ未満のピクセルは「無い」ものとして扱う
const TRACE_MAX = 140;       // 輪郭をたどるときの解像度（長辺）
const MAX_VERTS = 22;        // 単純化後の頂点数の上限

// ---------------------------------------------------------------- マスク
function toMask(png) {
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
  return { mask, w, h };
}

// いちばん大きい塊だけ残す（切り抜きの取りこぼしや、離れた小さな点を無視する）
function largestBlob({ mask, w, h }) {
  const label = new Int32Array(w * h).fill(-1);
  const stack = [];
  let bestId = -1, bestSize = 0, id = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] !== -1) continue;
    let size = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % w, y = (p - x) / w;
      if (x > 0 && mask[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && label[p - w] === -1) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && label[p + w] === -1) { label[p + w] = id; stack.push(p + w); }
    }
    if (size > bestSize) { bestSize = size; bestId = id; }
    id++;
  }
  if (bestId < 0) return null;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === bestId ? 1 : 0;
  return { mask: out, w, h, size: bestSize };
}

function bbox({ mask, w, h }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// 最近傍で縮小。輪郭をたどるのは粗い解像度で十分で、そのほうが線も滑らかになる。
function downscale({ mask, w, h }, maxSide) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  const nw = Math.max(4, Math.round(w * k));
  const nh = Math.max(4, Math.round(h * k));
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(h - 1, Math.floor((y + 0.5) / nh * h));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(w - 1, Math.floor((x + 0.5) / nw * w));
      out[y * nw + x] = mask[sy * w + sx];
    }
  }
  return { mask: out, w: nw, h: nh };
}

// ---------------------------------------------------------------- 輪郭たどり
// marching squares。2x2 の窓の埋まり方から次に進む向きを決めて外周を一周する。
function traceContour({ mask, w, h }) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);

  let sx = -1, sy = -1;
  outer:
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) { sx = x; sy = y; break outer; }
    }
  }
  if (sx < 0) return null;

  const pts = [];
  let x = sx, y = sy, dx = 0, dy = 0;
  const limit = w * h * 4;
  for (let step = 0; step < limit; step++) {
    const state = at(x - 1, y - 1) | (at(x, y - 1) << 1) | (at(x - 1, y) << 2) | (at(x, y) << 3);
    const pdx = dx, pdy = dy;
    switch (state) {
      case 1: case 5: case 13: dx = 0; dy = -1; break;
      case 2: case 3: case 7:  dx = 1; dy = 0;  break;
      case 8: case 10: case 11: dx = 0; dy = 1; break;
      case 4: case 12: case 14: dx = -1; dy = 0; break;
      case 6: dx = 0; dy = pdx === 1 ? -1 : 1; break;   // 鞍点。来た向きで分岐
      case 9: dx = pdy === -1 ? -1 : 1; dy = 0; break;
      default: return pts.length >= 3 ? pts : null;
    }
    pts.push([x, y]);
    x += dx;
    y += dy;
    if (x === sx && y === sy) break;
  }
  return pts.length >= 3 ? pts : null;
}

// ---------------------------------------------------------------- 単純化
function rdp(points, eps) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const vx = bx - ax, vy = by - ay;
    const len = Math.hypot(vx, vy) || 1;
    let far = -1, farD = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((points[i][0] - ax) * vy - (points[i][1] - ay) * vx) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function simplify(points, diag) {
  let eps = diag * 0.012;
  let out = rdp(points, eps);
  // 頂点が多すぎると凸分割の部品が増えて物理が重くなるので、収まるまで粗くする
  while (out.length > MAX_VERTS && eps < diag) {
    eps *= 1.35;
    out = rdp(points, eps);
  }
  return out;
}

// ---------------------------------------------------------------- 画像の切り出し
function cropPng(png, box) {
  const out = new PNG({ width: box.w, height: box.h });
  for (let y = 0; y < box.h; y++) {
    const src = ((box.y0 + y) * png.width + box.x0) * 4;
    png.data.copy(out.data, y * box.w * 4, src, src + box.w * 4);
  }
  return out;
}

// 長辺が maxSide を超えるなら、最近傍＋平均で縮める（素材が巨大なときの保険）
function shrinkPng(png, maxSide) {
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

// ---------------------------------------------------------------- 本体
function buildTier(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const blob = largestBlob(toMask(png));
  if (!blob) throw new Error(`${path.basename(file)}: 不透明なピクセルが見つかりません`);

  const box = bbox(blob);

  // 背景が透明になっていない画像は、輪郭がただの長方形になってしまう。
  // 絵の形で当たり判定を作るのが売りなので、ここで気づけるように警告を出す。
  const fill = blob.size / (box.w * box.h);
  if (fill > 0.95) {
    warnings.push(
      `${path.basename(file)}: 不透明部分が矩形の ${Math.round(fill * 100)}% を占めています。` +
      '背景が透明になっていない可能性が高く、このままだと当たり判定が長方形になります'
    );
  }
  const cropped = shrinkPng(cropPng(png, box), 512);

  // 輪郭は切り抜き後のマスクからたどる
  const croppedMask = { mask: new Uint8Array(box.w * box.h), w: box.w, h: box.h };
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      croppedMask.mask[y * box.w + x] = blob.mask[(box.y0 + y) * blob.w + (box.x0 + x)];
    }
  }
  const small = downscale(croppedMask, TRACE_MAX);
  const contour = traceContour(small);
  if (!contour) throw new Error(`${path.basename(file)}: 輪郭をたどれませんでした`);

  const simplified = simplify(contour, Math.hypot(small.w, small.h));
  // 0〜1 に正規化しておくと、ゲーム側で段階ごとの大きさに掛けるだけで済む
  const poly = simplified.map(([x, y]) => [
    +(x / small.w).toFixed(4),
    +(y / small.h).toFixed(4),
  ]);

  return {
    w: box.w,
    h: box.h,
    poly,
    src: 'data:image/png;base64,' + PNG.sync.write(cropped).toString('base64'),
    _stats: { verts: poly.length, crop: `${box.w}x${box.h}`, kb: Math.round(PNG.sync.write(cropped).length / 1024) },
  };
}

const tiers = [];
const report = [];
const warnings = [];
for (let i = 1; i <= TIER_COUNT; i++) {
  const file = path.join(SRC_DIR, `saboko_${i}.png`);
  if (!fs.existsSync(file)) {
    tiers.push(null);
    report.push(`  ${i}. (なし) — assets/src/saboko_${i}.png を置くと仮の丸から差し替わります`);
    continue;
  }
  const tier = buildTier(file);
  const stats = tier._stats;
  delete tier._stats;
  tiers.push(tier);
  report.push(`  ${i}. ${stats.crop} → 頂点 ${stats.verts} / ${stats.kb}KB`);
}

const body = tiers
  .map((t) => (t ? `  { w: ${t.w}, h: ${t.h}, poly: ${JSON.stringify(t.poly)}, src: '${t.src}' },` : '  null,'))
  .join('\n');

fs.writeFileSync(OUT_FILE, `/* tools/build-assets.mjs が生成。直接編集しないでください。 */\nwindow.SABOKO_SHAPES = [\n${body}\n];\n`);

console.log('assets/shapes.js を書き出しました');
console.log(report.join('\n'));
console.log(`  合計 ${Math.round(fs.statSync(OUT_FILE).size / 1024)}KB`);
if (warnings.length) {
  console.log('\n注意:');
  for (const w of warnings) console.log(`  - ${w}`);
}
