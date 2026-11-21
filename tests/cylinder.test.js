// Cylinder (feature 12e, version 1.8): a wide photo round an open tube, in a base with a light.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../js/core/settings.js';
import { buildCylinder, createCylinderField, buildCylinderMesh, cylinderSize, cylinderLight, estimateCylinderTriangles } from '../js/core/cylinder.js';
import { buildBase } from '../js/core/base.js';
import { partList, lampMesh } from '../js/core/exportParts.js';
import { meshSdf, gridStep } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';

function cyl(edit = {}, settings = {}) {
  const s = defaultSettings();
  s.shape = 'cylinder';
  Object.assign(s.cylinder, edit);
  Object.assign(s, settings);
  return s;
}
/** A test picture w x h: brightness rising left to right (so the two ends differ). */
function ramp(w = 300, h = 100) {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = x / (w - 1);
  return { w, h, data };
}

test('sizes: presets and custom', () => {
  assert.deepEqual(cylinderSize(cyl()), { D: 100, H: 150 });
  assert.deepEqual(cylinderSize(cyl({ size: 'small' })), { D: 80, H: 120 });
  assert.deepEqual(cylinderSize(cyl({ size: 'large' })), { D: 120, H: 200 });
  assert.deepEqual(cylinderSize(cyl({ size: 'custom', diameter: 70, height: 300 })), { D: 70, H: 250 }, 'custom, kept to 250 mm tall');
  const sh = buildCylinder(cyl());
  assert.equal(sh.kind, 'cylinder');
  assert.ok(Math.abs(sh.C - Math.PI * 100) < 1e-9 && sh.W === sh.C, 'the strip is as wide as the tube is round');
  // u = 0 is the front (-y); the two ends of the strip meet at the back
  const a = {}, b = {}, c = {};
  sh.surfAt(0, 0, a); sh.surfAt(-sh.C / 2, 0, b); sh.surfAt(sh.C / 2, 0, c);
  assert.ok(Math.abs(a.y + 50) < 1e-9 && Math.abs(a.ny + 1) < 1e-9, 'front');
  assert.ok(Math.hypot(b.x - c.x, b.y - c.y) < 1e-9 && Math.abs(b.y - 50) < 1e-9, 'the ends meet at the back');
});

test('the wall: plain bands, the photo all the way round with a soft join, or a front window', () => {
  const s = cyl({}, { photos: [{ id: 'a' }] });
  const sh = buildCylinder(s), f = createCylinderField(s, sh, { a: ramp() });
  const o = {};
  // Bands: the thickest wall, outside exactly on the tube's radius (so the seat fits)
  for (const v of [sh.bottom + 4, sh.top - 1]) {
    f.evalUV(30, v, o);
    assert.ok(Math.abs(o.t - sh.tWall) < 1e-9, `band at ${v}: t ${o.t}`);
    assert.ok(Math.abs(Math.hypot(o.x, o.y) - sh.R) < 1e-9, 'outside on the radius');
  }
  // The photo covers the visible part, right up to the band edges (no fade at top and bottom)
  f.evalUV(0, sh.bottom + sh.band + 1, o); assert.equal(o.photoId, 'a'); assert.ok(o.mask > 0.9, `near the bottom band: ${o.mask}`);
  f.evalUV(0, sh.top - sh.rim - 1, o); assert.ok(o.mask > 0.9, `near the top rim: ${o.mask}`);
  // All the way round: no jump at the back (the right end fades into the left end)
  const e = 0.3, l = {}, r = {};
  f.evalUV(sh.C / 2 - e, 0, r); f.evalUV(-sh.C / 2 + e, 0, l);
  assert.ok(Math.abs(r.t - l.t) < 0.05, `join: ${r.t} vs ${l.t}`);
  assert.ok(r.mask > 0.99 && l.mask > 0.99, 'photo right across the join');
  // A front window: the back glows plain
  const s2 = cyl({ wrap: 0.5 }, { photos: [{ id: 'a' }] });
  const f2 = createCylinderField(s2, buildCylinder(s2), { a: ramp() });
  f2.evalUV(sh.C / 2 - 1, 0, o); assert.equal(o.mask, 0);
  f2.evalUV(0, 0, o); assert.equal(o.photoId, 'a');
  f2.evalUV(sh.C * 0.25 + 3, 0, o); assert.equal(o.mask, 0, 'just past the window');
});

test('even glow: the puck sits low, so the wall is thinner higher up', () => {
  const s = cyl();
  const sh = buildCylinder(s);
  const light = cylinderLight(s, sh);
  assert.ok(Math.abs(light(0, 0) - 1) < 1e-9);
  assert.ok(light(0, sh.top - 10) < light(0, 0) && light(0, sh.bottom + 20) > light(0, 0), 'puck: brighter low down');
  const strip = cylinderLight(cyl({}, { base: { ...s.base, light: 'strip' } }), sh);
  const ratio = (fn) => fn(0, sh.bottom + sh.band + 5) / fn(0, sh.top - sh.rim - 5);
  assert.ok(ratio(strip) < ratio(light) / 2, 'a strip up the riser lights it far more evenly');
  const f = createCylinderField(s, sh, null), lo = {}, hi = {};
  f.evalUV(0, sh.bottom + sh.band + 10, lo); f.evalUV(0, sh.top - sh.rim - 10, hi);
  assert.ok(hi.t < lo.t, `top ${hi.t} vs bottom ${lo.t}`);
});

test('the tube is one closed solid standing on its edge, the picture side finer', () => {
  for (const reliefSide of ['inside', 'outside']) {
    const s = cyl({ size: 'small' }, { photos: [{ id: 'a' }], reliefSide });
    const sh = buildCylinder(s), f = createCylinderField(s, sh, { a: ramp() });
    const out = reliefSide === 'outside';
    const m = buildCylinderMesh({ shape: sh, field: f, stepOut: out ? 0.6 : 1.5, stepIn: out ? 1.5 : 0.6 });
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${reliefSide}: closed`);
    const size = m.bbox.max.map((v, i) => v - m.bbox.min[i]);
    assert.ok(Math.abs(size[0] - 80) < 0.1 && Math.abs(size[1] - 80) < 0.1 && Math.abs(size[2] - 120) < 1e-6, `${reliefSide}: ${size}`);
    assert.ok(Math.abs(m.bbox.min[2]) < 1e-6, 'on the bed');
    // the wall is between tMin and the band thickness: volume of a tube that thick
    const v0 = Math.PI * 80 * 120 * s.tMin * 0.95, v1 = Math.PI * 80 * 120 * sh.tWall;
    assert.ok(m.volume > v0 && m.volume < v1, `${reliefSide}: volume ${m.volume}`);
    const est = estimateCylinderTriangles(sh, out ? 0.6 : 1.5, out ? 1.5 : 0.6);
    assert.ok(Math.abs(m.triangles - est) / est < 0.05, `estimate ${est} vs ${m.triangles}`);
  }
});

test('the base holds the cylinder: its bottom band drops into the seat, for every light', () => {
  for (const light of ['puck', 'strip', 'bulb']) for (const size of ['small', 'large']) {
    const s = cyl({ size }, { base: { ...defaultSettings().base, light } });
    const sh = buildCylinder(s), b = buildBase(s, sh);
    const tag = `${light} ${size}`;
    assert.ok(Math.abs(b.info.seatR - (sh.R + s.base.clearance / 2)) < 1e-9, `${tag}: seat fits the tube`);
    assert.equal(sh.collar.height, sh.band - 2, 'the band shows 2 mm above the seat');
    const m = meshSdf(b.sdf, b.bounds, gridStep(b.bounds, 0.8, 1e7));
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${tag}: closed`);
    assert.ok(b.info.height < 50, `${tag}: a low base (${b.info.height.toFixed(0)} mm)`);
    if (light === 'strip') {
      const up = b.info.riserHeight + sh.collar.height; // riser top above the cylinder's bottom
      assert.ok(up > sh.H * 0.35 && up < sh.H - 10, `${tag}: riser about to the middle (${up.toFixed(0)} of ${sh.H})`);
    }
  }
});

test('export: the cylinder and its base, in the STL and the 3MF', () => {
  const s = cyl({ size: 'small' });
  assert.deepEqual(partList({ settings: s }).map((p) => p.name), ['Cylinder', 'Base']);
  const { mesh, label } = lampMesh({ settings: s, photos: null, textMasks: null, stepInner: 1.2, stepOuter: 2 });
  assert.match(label, /cylinder 80x120mm/);
  assert.ok(checkWatertight(mesh.indices, mesh.positions.length / 3).ok);
});
