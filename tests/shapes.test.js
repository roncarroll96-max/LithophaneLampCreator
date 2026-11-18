import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildShellMesh, checkWatertight } from '../js/core/mesh.js';
import { MARKING_TYPES } from '../js/core/markings.js';
import { prepareMoon, moonMap } from '../js/core/moon.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';

const R = 75, W = 3;
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const mark = (kind, v, out) => { const u = norm(v); return MARKING_TYPES[kind](u[0], u[1], u[2], R, W, out); };

test('soccer: pentagons marked, hexagons not, seams between them', () => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const out = { fill: 0 };
  // A pentagon centre (icosahedron vertex) and a hexagon centre (icosahedron face centre)
  assert.equal(mark('soccer', [0, 1, phi], out), 0, 'no line at a pentagon centre');
  assert.equal(out.fill, 1, 'pentagon is filled');
  const fc = norm([0 + 0 + phi, 1 + -1 + 0, phi + phi + 1]); // centre of face (0,1,φ), (0,-1,φ), (φ,0,1)
  assert.equal(mark('soccer', fc, out), 0, 'no line at a hexagon centre');
  assert.equal(out.fill, 0, 'hexagon is not filled');
  // Between a pentagon centre and a neighbouring hexagon centre lies a seam,
  // so somewhere on that path the line must reach full coverage.
  const a = norm([0, 1, phi]);
  let peak = 0;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, v = norm(a.map((x, k) => x * (1 - t) + fc[k] * t));
    peak = Math.max(peak, mark('soccer', v));
  }
  assert.ok(peak > 0.99, `seam found between pentagon and hexagon (peak ${peak})`);
});

test('baseball: the seam lies on the curve, stitches stay close, far away is clear', () => {
  const B = 0.29, A = 1 - B, C = 2 * Math.sqrt(A * B);
  const curve = (t) => [A * Math.cos(t) + B * Math.cos(3 * t), A * Math.sin(t) - B * Math.sin(3 * t), C * Math.sin(2 * t)];
  for (let i = 0; i < 40; i++) {
    const t = (i / 40) * 2 * Math.PI + 0.01;
    assert.ok(mark('baseball', curve(t)) > 0.99, `on the seam at t=${t.toFixed(2)}`);
  }
  // Brute-force distance to the curve; anything beyond the stitches must be clear
  const pts = []; for (let i = 0; i < 4000; i++) pts.push(curve((i / 4000) * 2 * Math.PI));
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const u = norm([Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9 + 1)]);
    let best = -1; for (const p of pts) best = Math.max(best, p[0] * u[0] + p[1] * u[1] + p[2] * u[2]);
    const distMm = Math.acos(Math.min(1, best)) * R;
    if (distMm > 0.035 * R + 0.11 * R + W) { assert.equal(mark('baseball', u), 0, `clear at ${distMm.toFixed(1)} mm`); checked++; }
  }
  assert.ok(checked > 50, 'enough far points tested');
});

test('volleyball: lines on section edges and strip splits, clear in the middle of strips', () => {
  assert.equal(mark('volleyball', [1, 0, 0]), 0, 'middle of the centre strip');
  assert.ok(mark('volleyball', [1, 1, 0]) > 0.99, 'edge between two sections');
  assert.ok(mark('volleyball', [1, 1 / 3, 0]) > 0.99, 'strip split on the X section');
  assert.ok(mark('volleyball', [1, 0, 1 / 3]) < 0.01, 'X strips run along Z, so no split here');
  assert.ok(mark('volleyball', [0, 1, 1 / 3]) > 0.99, 'Y section is split the other way');
  assert.ok(mark('volleyball', [1, 2 / 3, 0]) < 0.01, 'middle of an outer strip');
});

for (const shape of ['soccer', 'baseball', 'volleyball']) {
  test(`${shape} shell is watertight with carved and raised lines`, () => {
    for (const style of ['carved', 'raised']) {
      const s = defaultSettings();
      s.shape = shape; s.markings.style = style;
      const col = collarDims(s);
      const sh = buildEllipsoidShape(bodyAxes(s), col.ro);
      const field = createField(s, sh, null);
      const mesh = buildShellMesh({ shape: sh, field, stepInner: 3, stepOuter: 3, collar: col });
      const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
      assert.ok(wt.ok, `${shape} ${style}: bad edges ${wt.badEdges}`);
    }
  });
}

test('soccer pentagons glow darker by the pentagon darkness setting', () => {
  const s = defaultSettings();
  s.shape = 'soccer'; s.markings.yaw = 0; s.markings.pitch = 0; s.markings.roll = 0;
  const sh = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const phi = (1 + Math.sqrt(5)) / 2;
  // Direction of a pentagon centre near the equator: (φ, 0, 1) -> theta 0, a bit above the equator
  const u = norm([phi, 0, 1]);
  const theta = Math.atan2(u[1], u[0]);
  // find s whose surface direction matches u's height
  let lo = 0, hi = 1; const o = {};
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; sh.surf(theta, sh.phiAt(theta, m), o); if (o.dz < u[2]) lo = m; else hi = m; }
  const plain = s.tMin + (1 - s.photo.surround) * (s.tMax - s.tMin);
  for (const dark of [0, 0.5, 1]) {
    s.markings.panelDark = dark;
    const f = createField(s, sh, null);
    f.eval(theta, (lo + hi) / 2, o);
    const want = plain + (s.tMax - plain) * dark;
    assert.ok(Math.abs(o.t - want) < 0.02, `darkness ${dark}: t ${o.t} vs ${want}`);
  }
});

function fakeMoon() {
  const w = 64, h = 32;
  const albedo = { w, h, data: new Float32Array(w * h) }, height = { w: 32, h: 16, data: new Float32Array(32 * 16) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) albedo.data[y * w + x] = x < w / 2 ? 0.2 : 0.6; // west dark, east bright
  for (let i = 0; i < height.data.length; i++) height.data[i] = 0.5 + 0.1 * Math.sin(i);
  return prepareMoon(albedo, height);
}

test('Moon: brightness map is stretched, crater depth adds detail, map faces the right way', () => {
  const prep = fakeMoon();
  const flat = moonMap(prep, 0);
  assert.ok(Math.min(...flat.data) < 0.05 && Math.max(...flat.data) > 0.95, 'stretched to the full range');
  const deep = moonMap(prep, 1);
  let diff = 0; for (let i = 0; i < deep.data.length; i++) diff += Math.abs(deep.data[i] - flat.data[i]);
  assert.ok(diff > 0, 'crater depth changes the map');

  const s = defaultSettings();
  s.shape = 'moon'; s.moon.craters = 0;
  const sh = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const o = {};
  // East (+longitude) is to the right of the front as seen from Earth: bright in the fake map
  createField(s, sh, null, null, flat).eval(THETA_FRONT + 0.6, sh.sEquator, o);
  assert.ok(Math.abs(o.t - s.tMin) < 0.05, `east side is bright/thin (t ${o.t})`);
  createField(s, sh, null, null, flat).eval(THETA_FRONT - 0.6, sh.sEquator, o);
  assert.ok(Math.abs(o.t - s.tMax) < 0.05, `west side is dark/thick (t ${o.t})`);
});

test('Moon only ignores the photo; Photo + Moon shows it', () => {
  const prep = fakeMoon();
  const map = moonMap(prep, 0);
  const s = defaultSettings();
  s.shape = 'moon';
  const sh = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const white = { w: 10, h: 10, data: new Float32Array(100).fill(1) };
  const o = {};
  s.moon.mode = 'moon';
  createField(s, sh, white, null, map).eval(THETA_FRONT - 0.3, sh.sEquator, o);
  assert.ok(o.t > s.tMax - 0.1, 'Moon only: dark west side, photo ignored');
  s.moon.mode = 'photo';
  createField(s, sh, white, null, map).eval(THETA_FRONT - 0.3, sh.sEquator, o);
  assert.ok(Math.abs(o.t - s.tMin) < 0.01, 'Photo + Moon: the white photo shows');
});
