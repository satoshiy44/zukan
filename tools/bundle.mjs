/* 全部を1枚の HTML にまとめて配布用ファイルを作る。
 *
 *   node tools/bundle.mjs
 *
 * 出力
 *   dist/saboko-drop.html  … 単体で動く HTML。これ1枚を渡せば誰でも遊べる
 *   dist/artifact.html     … Artifact として公開するときの中身（外枠のタグ無し）
 *
 * 画像は assets/shapes.js の中で data URI になっているので、
 * このファイル以外は何も要らない。 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// インラインした JS の中の </script> が HTML を途中で閉じてしまわないように
const safe = (js) => js.replace(/<\/script>/gi, '<\\/script>');

const css = read('style.css');
const scripts = [
  'assets/sounds.js',
  'audio.js',
  'vendor/matter.min.js',
  'vendor/poly-decomp.min.js',
  'assets/shapes.js',
  'game.js',
].map((f) => `<script>${safe(read(f))}</script>`).join('\n');

// index.html から <body> の中身だけ取り出し、<script src> の行を落とす
const markup = read('index.html')
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/^\s*<!--[\s\S]*?-->\s*$/gm, '')
  .replace(/^\s*<script src=[^>]*><\/script>\s*$/gm, '')
  .trim();

const title = 'さぼこ落としゲーム';
const head = `<title>${title}</title>\n<style>\n${css}</style>`;
const body = `${markup}\n${scripts}`;

fs.mkdirSync(DIST, { recursive: true });
// Artifact 側は <html>/<head>/<body> を公開時に被せてくれるので中身だけ書く
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n`);
fs.writeFileSync(
  path.join(DIST, 'saboko-drop.html'),
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n` +
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n` +
  `${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`
);

for (const f of ['saboko-drop.html', 'artifact.html']) {
  console.log(`dist/${f}  ${Math.round(fs.statSync(path.join(DIST, f)).size / 1024)}KB`);
}
