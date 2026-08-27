/* さぼこしゅーてぃんぐを1枚のHTMLにまとめる。
 *
 *   node saboko-shooting/tools/bundle.mjs
 *
 * 出力
 *   saboko-shooting/dist/saboko-shooting.html  … 単体で動く。これ1枚を渡せば遊べる
 *   saboko-shooting/dist/artifact.html          … Artifact 公開用（外枠タグ無し）
 *
 * BGMを差し替えていなければ sounds.js は空で、合成したループが鳴る。 */

import fs from 'node:fs';
import path from 'node:path';

const HERE = path.resolve(import.meta.dirname, '..');
const DIST = path.join(HERE, 'dist');

const read = (p) => fs.readFileSync(p, 'utf8');
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read(path.join(HERE, 'style.css'));
const scripts = [
  path.join(HERE, 'assets', 'sounds.js'),
  path.join(HERE, 'assets', 'sprites.js'),
  path.join(HERE, 'audio.js'),
  path.join(HERE, 'game.js'),
].map((f) => `<script>${safe(read(f))}</script>`).join('\n');

const markup = read(path.join(HERE, 'index.html'))
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/^\s*<!--[\s\S]*?-->\s*$/gm, '')
  .replace(/^\s*<script src=[^>]*><\/script>\s*$/gm, '')
  .trim();

const head = `<title>さぼこしゅーてぃんぐ</title>\n<style>\n${css}</style>`;
const body = `${markup}\n${scripts}`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n`);
fs.writeFileSync(
  path.join(DIST, 'saboko-shooting.html'),
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n` +
  `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
);

for (const f of ['saboko-shooting.html', 'artifact.html']) {
  console.log(`saboko-shooting/dist/${f}  ${Math.round(fs.statSync(path.join(DIST, f)).size / 1024)}KB`);
}
