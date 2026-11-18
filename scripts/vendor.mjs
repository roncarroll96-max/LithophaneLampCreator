// Copies the Three.js files the app needs from node_modules into vendor/,
// so the app runs offline and can be hosted as plain static files.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'three');
const dst = join(root, 'vendor', 'three');

const files = [
  ['build/three.module.js', 'three.module.js'],
  ['build/three.core.js', 'three.core.js'],
  ['examples/jsm/controls/OrbitControls.js', 'OrbitControls.js'],
  ['LICENSE', 'LICENSE'],
];

mkdirSync(dst, { recursive: true });
for (const [from, to] of files) {
  const p = join(src, from);
  if (!existsSync(p)) { console.warn('skip (not found):', from); continue; }
  copyFileSync(p, join(dst, to));
  console.log('copied', from, '->', 'vendor/three/' + to);
}
