// Copies the Three.js files and the text fonts the app needs from node_modules into vendor/,
// so the app runs offline and can be hosted as plain static files.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function copyAll(pkg, outDir, files) {
  const src = join(root, 'node_modules', pkg);
  const dst = join(root, 'vendor', outDir);
  mkdirSync(dst, { recursive: true });
  for (const [from, to] of files) {
    const p = join(src, from);
    if (!existsSync(p)) { console.warn('skip (not found):', pkg + '/' + from); continue; }
    copyFileSync(p, join(dst, to));
    console.log('copied', pkg + '/' + from, '->', `vendor/${outDir}/${to}`);
  }
}

copyAll('three', 'three', [
  ['build/three.module.js', 'three.module.js'],
  ['build/three.core.js', 'three.core.js'],
  ['examples/jsm/controls/OrbitControls.js', 'OrbitControls.js'],
  ['LICENSE', 'LICENSE'],
]);

// Text fonts (SIL Open Font License), Latin subset, one weight each
const fonts = [
  ['@fontsource/graduate', 'graduate-latin-400-normal.woff2', 'Graduate'],
  ['@fontsource/montserrat', 'montserrat-latin-800-normal.woff2', 'Montserrat'],
  ['@fontsource/pacifico', 'pacifico-latin-400-normal.woff2', 'Pacifico'],
  ['@fontsource/playfair-display', 'playfair-display-latin-700-normal.woff2', 'PlayfairDisplay'],
];
for (const [pkg, file, name] of fonts) {
  copyAll(pkg, 'fonts', [[`files/${file}`, `${name}.woff2`], ['LICENSE', `${name}-LICENSE.txt`]]);
}
