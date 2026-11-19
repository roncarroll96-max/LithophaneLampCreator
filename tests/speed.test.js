// Speed work (version 1.2): the faster paths must give exactly the same results as the plain ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshSdf, gridStep } from '../js/core/sdf.js';
import { writeBinarySTL, writeBinarySTLParts } from '../js/core/stl.js';
import { buildBase } from '../js/core/base.js';
import { buildEllipsoidShape } from '../js/core/shapes.js';
import { buildPanel, resolvePanelSize } from '../js/core/panel.js';
import { bodyAxes, collarDims, defaultSettings } from '../js/core/settings.js';
import { shrinkBase } from '../js/image.js';

function baseFor(edit) {
  const s = defaultSettings();
  s.shape = edit.shape; Object.assign(s.base, edit.base);
  let shape;
  if (edit.shape === 'panel') {
    Object.assign(s.panel, edit.panel);
    if (s.panel.outline === 'rect') Object.assign(s.panel, resolvePanelSize(s.panel, null));
    shape = buildPanel(s);
  } else shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  return buildBase(s, shape);
}

test('the base mesher skips far-away space without changing the mesh', () => {
  const cases = [
    { shape: 'basketball', base: { light: 'strip' } },
    { shape: 'cube', base: { light: 'puck' } },
    { shape: 'basketball', base: { light: 'bulb' } },
    { shape: 'panel', panel: { outline: 'heart', curve: 40 }, base: { panelKind: 'lightbox' } },
  ];
  for (const c of cases) {
    const base = baseFor(c);
    const fast = meshSdf(base.sdf, base.bounds, 1.5);
    const plain = meshSdf(base.sdf, base.bounds, 1.5, { skip: false });
    assert.deepEqual(fast.positions, plain.positions, JSON.stringify(c));
    assert.deepEqual(fast.indices, plain.indices, JSON.stringify(c));
  }
});

test('very big bases get a coarser grid, normal ones keep the fine one', () => {
  const small = { min: [-60, -60, 0], max: [60, 60, 40] };
  assert.equal(gridStep(small, 0.45, 2e8), 0.45);
  const huge = { min: [-200, -200, 0], max: [200, 200, 400] };
  const step = gridStep(huge, 0.45, 2e8);
  assert.ok(step > 0.45);
  const cells = [0, 1, 2].reduce((v, a) => v * ((huge.max[a] - huge.min[a] + 4 * 0.45) / step), 1);
  assert.ok(cells <= 2e8 * 1.0001);
});

test('an STL written in parts is byte for byte the same file', () => {
  const positions = new Float32Array(3 * 50), indices = new Uint32Array(3 * 40);
  for (let i = 0; i < positions.length; i++) positions[i] = Math.sin(i * 1.7) * 30;
  for (let i = 0; i < indices.length; i++) indices[i] = (i * 7) % 50;
  const whole = new Uint8Array(writeBinarySTL(positions, indices, 'test'));
  const parts = writeBinarySTLParts(positions, indices, 'test', 7);
  assert.equal(parts.length, 1 + Math.ceil(40 / 7));
  const joined = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let o = 0;
  for (const p of parts) { joined.set(new Uint8Array(p), o); o += p.byteLength; }
  assert.deepEqual(joined, whole);
});

test('the small photo copy for tone sliders keeps the picture and its shape', () => {
  const w = 2000, h = 1500, lum = new Float32Array(w * h), alpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { lum[y * w + x] = x < w / 2 ? 0.2 : 0.9; alpha[y * w + x] = 1; }
  const small = shrinkBase({ w, h, lum, alpha }, 720);
  assert.ok(Math.max(small.w, small.h) <= 720);
  assert.ok(Math.abs(small.h / small.w - h / w) < 0.01);
  assert.ok(Math.abs(small.lum[10 * small.w + 5] - 0.2) < 1e-6);
  assert.ok(Math.abs(small.lum[10 * small.w + small.w - 5] - 0.9) < 1e-6);
  assert.equal(small.alpha[0], 1);
  const tiny = { w: 300, h: 200, lum: new Float32Array(300 * 200), alpha: null };
  assert.equal(shrinkBase(tiny, 720), tiny); // already small: used as it is
});
