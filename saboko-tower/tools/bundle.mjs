/* さぼこタワーを1枚のHTMLにまとめる。
 *
 *   node saboko-tower/tools/bundle.mjs
 *
 * 出力
 *   saboko-tower/dist/saboko-tower.html  … 単体で動く。これ1枚を渡せば遊べる
 *   saboko-tower/dist/artifact.html          … Artifact 公開用（外枠タグ無し）
 *
 * 形データと物理エンジンはスイカゲームのものを共用している。 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(import.meta.dirname, '..');
const DIST = path.join(HERE, 'dist');

const read = (p) => fs.readFileSync(p, 'utf8');
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read(path.join(HERE, 'style.css'));
const ROOT = path.resolve(HERE, '..');
const scripts = [
  path.join(ROOT, 'vendor', 'matter.min.js'),
  path.join(ROOT, 'vendor', 'poly-decomp.min.js'),
  path.join(ROOT, 'assets', 'shapes.js'),   // スイカゲームと共用の形データ
  path.join(HERE, 'assets', 'sounds.js'),
  path.join(HERE, 'audio.js'),
  path.join(HERE, 'game.js'),
].map((f) => `<script>${safe(read(f))}</script>`).join('\n');

const markup = read(path.join(HERE, 'index.html'))
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/^\s*<!--[\s\S]*?-->\s*$/gm, '')
  .replace(/^\s*<script src=[^>]*><\/script>\s*$/gm, '')
  .trim();

const head = `<title>さぼこタワー</title>\n<style>\n${css}</style>`;
const body = `${markup}\n${scripts}`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n`);
fs.writeFileSync(
  path.join(DIST, 'saboko-tower.html'),
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n` +
  `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
);

for (const f of ['saboko-tower.html', 'artifact.html']) {
  console.log(`saboko-tower/dist/${f}  ${Math.round(fs.statSync(path.join(DIST, f)).size / 1024)}KB`);
}
