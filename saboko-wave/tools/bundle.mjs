/* さぼこウェーブを1枚のHTMLにまとめる。
 *
 *   node saboko-wave/tools/bundle.mjs
 *
 * 出力
 *   saboko-wave/dist/saboko-wave.html  … 単体で動く。これ1枚を渡せば遊べる
 *   saboko-wave/dist/artifact.html     … Artifact 公開用（外枠タグ無し）
 *
 * BGMはスイカゲーム側の assets/sounds.js を共用しているので、
 * 音源ファイルを二重に持たずに済んでいる。 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(HERE, '..');
const DIST = path.join(HERE, 'dist');

const read = (p) => fs.readFileSync(p, 'utf8');
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read(path.join(HERE, 'style.css'));
const scripts = [
  path.join(ROOT, 'assets', 'sounds.js'),
  path.join(HERE, 'assets', 'sprites.js'),
  path.join(HERE, 'audio.js'),
  path.join(HERE, 'game.js'),
].map((f) => `<script>${safe(read(f))}</script>`).join('\n');

const markup = read(path.join(HERE, 'index.html'))
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/^\s*<!--[\s\S]*?-->\s*$/gm, '')
  .replace(/^\s*<script src=[^>]*><\/script>\s*$/gm, '')
  .trim();

const head = `<title>さぼこウェーブ</title>\n<style>\n${css}</style>`;
const body = `${markup}\n${scripts}`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n`);
fs.writeFileSync(
  path.join(DIST, 'saboko-wave.html'),
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n` +
  `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
);

for (const f of ['saboko-wave.html', 'artifact.html']) {
  console.log(`saboko-wave/dist/${f}  ${Math.round(fs.statSync(path.join(DIST, f)).size / 1024)}KB`);
}
