// Picture detail on the outside (version 1.3): balls and cubes get it on the outer surface, panels
// on the front. The wall thickness (so the picture) is the same; only which side is bumpy changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape } from '../js/core/shapes.js';
import { createField, LINE_EXTRA } from '../js/core/field.js';
import { buildShellMesh, checkWatertight, flipUpsideDown } from '../js/core/mesh.js';
import { buildPanel, panelEdgeThickness } from '../js/core/panel.js';
import { createPanelField } from '../js/core/panelField.js';
import { buildPanelMesh } from '../js/core/panelMesh.js';
import { defaultSettings, mergeSettings, bodyAxes, collarDims } from '../js/core/settings.js';

function fakePhoto(w = 200, h = 150) {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    data[y * w + x] = ((Math.floor(x / 20) + Math.floor(y / 20)) % 2) * 0.8 + 0.1 * (x / w);
  }
  return { w, h, data };
}

function ball(edit = {}) {
  const s = defaultSettings();
  Object.assign(s, edit);
  const col = collarDims(s);
  return { s, col, shape: buildEllipsoidShape(bodyAxes(s), col.ro) };
}

test('ball, outside detail: watertight, and the collar edge is the same as inside detail', () => {
  for (const style of ['carved', 'raised']) {
    const { s, col, shape } = ball({ reliefSide: 'outside' });
    s.markings.style = style;
    const field = createField(s, shape, fakePhoto());
    assert.equal(field.reliefOutside, true);
    // fine outside, coarse inside (as the export does)
    const mesh = buildShellMesh({ shape, field, stepInner: 4, stepOuter: 2, collar: col });
    const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
    assert.ok(wt.ok, `${style}: bad edges ${wt.badEdges}`);
    assert.ok(Math.abs(mesh.bbox.min[2]) < 1e-4, 'collar bottom on z = 0');

    const sIn = structuredClone(s); sIn.reliefSide = 'inside';
    const fieldIn = createField(sIn, shape, fakePhoto());
    const a = {}, b = {};
    for (let i = 0; i < 50; i++) {
      const th = (i / 50) * Math.PI * 2;
      field.eval(th, 0, a); fieldIn.eval(th, 0, b);
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, 'outer edge unchanged');
      assert.ok(Math.hypot(a.ix - b.ix, a.iy - b.iy, a.iz - b.iz) < 1e-9, 'inner edge unchanged');
    }
  }
});

test('ball, outside detail: same wall thickness, smooth inside, nothing past the ball size', () => {
  const { s, shape } = ball({ reliefSide: 'outside' });
  s.markings.style = 'carved';
  const field = createField(s, shape, fakePhoto());
  const sIn = structuredClone(s); sIn.reliefSide = 'inside';
  const fieldIn = createField(sIn, shape, fakePhoto());
  const o = {}, p = {};
  const R = 75, tRef = s.tMax + LINE_EXTRA;
  let sunk = 0;
  for (let i = 0; i < 5000; i++) {
    const th = Math.random() * Math.PI * 2, sv = 0.15 + 0.85 * Math.random(); // away from the collar band
    field.eval(th, sv, o); fieldIn.eval(th, sv, p);
    assert.ok(Math.abs(o.t - p.t) < 1e-9, 'same thickness as inside detail');
    const wall = Math.hypot(o.x - o.ix, o.y - o.iy, o.z - o.iz);
    assert.ok(Math.abs(wall - o.t) < 1e-6, `wall ${wall} vs t ${o.t}`);
    assert.ok(Math.abs(Math.hypot(o.ix, o.iy, o.iz) - (R - tRef)) < 1e-6, 'inner surface is a smooth sphere');
    assert.ok(Math.hypot(o.x, o.y, o.z) <= R + 1e-6, 'outer surface never past the ball size');
    if (Math.hypot(o.x, o.y, o.z) < R - 0.5) sunk++;
  }
  assert.ok(sunk > 500, 'the picture really is pressed into the outside');
});

test('cube, outside detail: watertight, sides textured, top face still flat for the bed', () => {
  const s = defaultSettings();
  s.shape = 'cube'; s.reliefSide = 'outside';
  const col = collarDims(s);
  const shape = buildEllipsoidShape(bodyAxes(s), col.ro);
  s.photos = [{ id: 'a', coverage: 60, centerY: 0 }];
  const field = createField(s, shape, { a: fakePhoto() });
  const mesh = buildShellMesh({ shape, field, stepInner: 3, stepOuter: 2, collar: col });
  assert.ok(checkWatertight(mesh.indices, mesh.positions.length / 3).ok);
  // the top face prints on the bed: after turning over, plenty of points lie flat on z = 0
  flipUpsideDown(mesh);
  let onBed = 0;
  for (let i = 2; i < mesh.positions.length; i += 3) if (mesh.positions[i] < 1e-6) onBed++;
  assert.ok(onBed > 50, `flat top face on the bed (${onBed} points)`);
  // a side face with the photo is pressed in
  const o = {};
  let sunk = 0, top = 0;
  for (let i = 0; i < 4000; i++) {
    field.eval(Math.random() * Math.PI * 2, Math.random(), o);
    const moved = Math.hypot(o.x - o.sx, o.y - o.sy, o.z - o.sz);
    if (o.sz > shape.c - 1e-6) { top++; assert.ok(moved < 1e-9, 'top face not pressed in'); }
    else if (moved > 0.3) sunk++;
  }
  assert.ok(top > 20 && sunk > 200, `top ${top}, pressed-in side points ${sunk}`);
});

test('panel, picture on the front: watertight, flat back, same thickness, frame edge unchanged', () => {
  for (const frame of [true, false]) {
    const s = defaultSettings();
    s.shape = 'panel'; s.reliefSide = 'outside';
    Object.assign(s.panel, { outline: 'heart', size: '4', curve: 40, frame, feet: true });
    s.photos = [{ id: 'p1', panelW: null }];
    const panel = buildPanel(s);
    const field = createPanelField(s, panel, { p1: fakePhoto() });
    assert.equal(field.reliefOutside, true);
    const mesh = buildPanelMesh({ panel, field, stepInner: 3, stepOuter: 1.5 });
    assert.ok(checkWatertight(mesh.indices, mesh.positions.length / 3).ok, `frame ${frame}`);

    const sIn = structuredClone(s); sIn.reliefSide = 'inside';
    const fieldIn = createPanelField(sIn, panel, { p1: fakePhoto() });
    const T = panelEdgeThickness(s), o = {}, p = {};
    for (let i = 0; i < 3000; i++) {
      const th = Math.random() * Math.PI * 2, sv = Math.random();
      field.eval(th, sv, o); fieldIn.eval(th, sv, p);
      assert.ok(Math.abs(o.t - p.t) < 1e-9, 'same thickness');
      // the back is the front surface pushed back by T everywhere: a flat (or evenly curved) sheet
      assert.ok(Math.abs(Math.hypot(o.ix - o.sx, o.iy - o.sy, o.iz - o.sz) - T) < 1e-6, 'flat back');
      assert.ok(Math.abs(Math.hypot(o.x - o.ix, o.y - o.iy, o.z - o.iz) - o.t) < 1e-6, 'wall t thick');
      // the stand's slot holds the edge: with a frame the edge sits exactly where it did before
      if (frame && sv === 0) assert.ok(Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) < 1e-9);
    }
    if (frame) for (let i = 0; i < 40; i++) {
      field.eval((i / 40) * Math.PI * 2, 0, o); fieldIn.eval((i / 40) * Math.PI * 2, 0, p);
      assert.ok(Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) < 1e-9, 'front edge unchanged');
      assert.ok(Math.hypot(o.ix - p.ix, o.iy - p.iy, o.iz - p.iz) < 1e-9, 'back edge unchanged');
    }
  }
});

test('new projects put the detail outside (1.9); older projects keep what they had', () => {
  assert.equal(defaultSettings().reliefSide, 'outside');
  assert.equal(mergeSettings({ reliefSide: 'outside' }).reliefSide, 'inside'); // a 0.2.0 project
  assert.equal(mergeSettings({ version: 2 }).reliefSide, 'inside');
  assert.equal(mergeSettings({ version: 3, reliefSide: 'outside' }).reliefSide, 'outside');
  assert.equal(mergeSettings({ version: 3, reliefSide: 'inside' }).reliefSide, 'inside');
  assert.equal(mergeSettings({ version: 3, reliefSide: 'sideways' }).reliefSide, 'inside');
  assert.equal(mergeSettings({ version: 3 }).version, 4);
});

test('1.9 defaults: older projects at the old puck and peg defaults get the new ones; chosen sizes stay', () => {
  const old = mergeSettings({ version: 3, base: { puckD: 70, puckH: 20 }, lantern: { pegFit: 0.25 } });
  assert.equal(old.base.puckD, 59.5); assert.equal(old.base.puckH, 8); assert.equal(old.lantern.pegFit, 0.15);
  const mine = mergeSettings({ version: 3, base: { puckD: 70, puckH: 12 }, lantern: { pegFit: 0.3 } });
  assert.equal(mine.base.puckD, 70); assert.equal(mine.base.puckH, 12); assert.equal(mine.lantern.pegFit, 0.3);
  const now = mergeSettings({ version: 4, base: { puckD: 70, puckH: 20 }, lantern: { pegFit: 0.25 } });
  assert.equal(now.base.puckD, 70); assert.equal(now.lantern.pegFit, 0.25);
  assert.equal(defaultSettings().lantern.pegFit, 0.15);
});
