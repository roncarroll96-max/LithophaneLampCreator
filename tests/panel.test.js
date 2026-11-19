// Flat panel (feature 12b, version 1.1): outlines, sizes, thickness, mesh and bases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPanel, resolvePanelSize, panelFeet, panelEdgeThickness, IN } from '../js/core/panel.js';
import { createPanelField } from '../js/core/panelField.js';
import { buildPanelMesh } from '../js/core/panelMesh.js';
import { checkWatertight } from '../js/core/mesh.js';
import { buildBase } from '../js/core/base.js';
import { meshSdf } from '../js/core/sdf.js';
import { defaultSettings } from '../js/core/settings.js';

function panelSettings(edit = {}) {
  const s = defaultSettings();
  s.shape = 'panel';
  Object.assign(s.panel, edit);
  if (s.panel.outline === 'rect') Object.assign(s.panel, resolvePanelSize(s.panel, null));
  return s;
}
const TAU = 2 * Math.PI;

test('rectangle sizes follow the photo: its own shape, or a print size turned to match', () => {
  const p = { ...defaultSettings().panel };
  assert.deepEqual(resolvePanelSize({ ...p, size: 'photo', longSide: 180 }, 1.5), { width: 120, height: 180 });
  assert.deepEqual(resolvePanelSize({ ...p, size: 'photo', longSide: 180 }, 0.5), { width: 180, height: 90 });
  const portrait = resolvePanelSize({ ...p, size: '5x7' }, 1.3);
  assert.equal(portrait.width, 5 * IN); assert.equal(portrait.height, 7 * IN);
  const landscape = resolvePanelSize({ ...p, size: '8x10' }, 0.7);
  assert.equal(landscape.width, 10 * IN); assert.equal(landscape.height, 8 * IN);
  assert.deepEqual(resolvePanelSize({ ...p, size: 'custom', width: 90, height: 60 }, 2), { width: 90, height: 60 });
});

test('every outline is the right size and its rings never cross (so the mesh stays clean)', () => {
  for (const outline of ['rect', 'square', 'circle', 'heart']) {
    const s = panelSettings({ outline, size: outline === 'rect' ? '5x7' : '6' });
    const panel = buildPanel(s);
    if (outline === 'rect') { assert.ok(Math.abs(panel.W - 127) < 0.01); assert.ok(Math.abs(panel.H - 177.8) < 0.01); }
    else assert.ok(Math.abs(panel.W - 152.4) < 0.01, outline);
    if (outline === 'circle' || outline === 'heart') assert.ok(panel.flatWidth > 20, `${outline} flat ${panel.flatWidth}`);
    const P = {};
    for (let j = 0; j < 720; j++) {
      let prev = Infinity;
      for (let k = 0; k <= 40; k++) {
        panel.pointAt((j / 720) * TAU, k / 40, P);
        const r = Math.hypot(P.u, P.v);
        assert.ok(r <= prev + 1e-9, `${outline} theta ${j}`);
        prev = r;
      }
    }
  }
});

test('the front stays smooth; bright photo areas are thin, dark ones thick; the frame is thickest', () => {
  const s = panelSettings({ outline: 'square', size: '4' });
  s.base.panelKind = 'none'; // no light box, so no even glow
  const panel = buildPanel(s);
  // A photo: left half black, right half white
  const w = 64, h = 64, data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = x < w / 2 ? 0 : 1;
  s.photos = [{ id: 'p1', panelW: null }];
  const field = createPanelField(s, panel, { p1: { w, h, data } });
  const ev = {};
  let maxFrontY = 0;
  for (let j = 0; j < 200; j++) for (let k = 0; k <= 50; k++) { field.eval((j / 200) * TAU, k / 50, ev); maxFrontY = Math.max(maxFrontY, Math.abs(ev.y)); }
  assert.equal(maxFrontY, 0);
  const at = (u, v) => {
    // find (theta, s) for a point by searching the right ring: easiest to sample the field
    let best = null, bd = Infinity;
    for (let j = 0; j < 400; j++) for (let k = 0; k <= 100; k++) {
      field.eval((j / 400) * TAU, k / 100, ev);
      const d = Math.hypot(ev.u - u, ev.v - v);
      if (d < bd) { bd = d; best = { ...ev }; }
    }
    return best;
  };
  assert.ok(at(-20, 0).t > 2.9, 'dark side thick');
  assert.ok(at(20, 0).t < 0.9, 'bright side thin');
  field.eval(0, 0, ev); // on the edge: the frame
  assert.ok(Math.abs(ev.t - (s.tMax + s.panel.frameExtra)) < 1e-9);
});

test('with the light box, even glow thins the plastic farther from the strip', () => {
  const s = panelSettings({ outline: 'rect', size: '5x7', frame: false });
  s.photo.surround = 0.5;
  const panel = buildPanel(s);
  const ev = {};
  const tAt = (field, f, sv) => { field.eval(f * TAU, sv, ev); return ev.t; };
  const box = createPanelField(s, panel, null);
  // theta 0.5 of the way round is the middle of the top edge; s near 1 is the middle
  assert.ok(tAt(box, 0.5, 0.1) < tAt(box, 0.5, 0.9) - 0.3, 'top thinner than the middle');
  s.base.panelKind = 'stand';
  const stand = createPanelField(s, panel, null);
  assert.ok(Math.abs(tAt(stand, 0.5, 0.1) - tAt(stand, 0.5, 0.9)) < 1e-9, 'no light box: even');
});

test('panel meshes are closed, the right size, and stand on their bottom edge', () => {
  const cases = [['rect', 0, false], ['square', 60, true], ['circle', 0, true], ['heart', 40, false]];
  for (const [outline, curve, feet] of cases) {
    const s = panelSettings({ outline, curve, feet, size: outline === 'rect' ? '4x6' : '4' });
    const panel = buildPanel(s);
    const field = createPanelField(s, panel, null);
    const feetList = panelFeet(s, panel);
    const mesh = buildPanelMesh({ panel, field, stepInner: 0.8, stepOuter: 1.5, feet: feetList });
    const body = mesh.indices.subarray(0, mesh.indices.length - feetList.length * 36);
    assert.ok(checkWatertight(body, mesh.positions.length / 3).ok, `${outline} body`);
    if (feetList.length) assert.ok(checkWatertight(mesh.indices.subarray(body.length), mesh.positions.length / 3).ok, `${outline} feet`);
    assert.equal(mesh.bbox.min[2], 0);
    assert.ok(Math.abs(mesh.bbox.max[2] - panel.H) < 0.01, `${outline} height`);
    if (!curve && !feet) assert.ok(Math.abs(mesh.bbox.max[0] - mesh.bbox.min[0] - panel.W) < 0.01, `${outline} width`);
    assert.ok(mesh.volume > 0);
  }
});

test('light box and slot stand are closed solids with a slot that fits the panel edge', () => {
  for (const [outline, curve, kind] of [['rect', 0, 'lightbox'], ['rect', 90, 'lightbox'], ['heart', 0, 'lightbox'], ['circle', 40, 'stand']]) {
    const s = panelSettings({ outline, curve, size: outline === 'rect' ? '5x7' : '6' });
    s.base.panelKind = kind;
    const panel = buildPanel(s);
    const base = buildBase(s, panel);
    const m = meshSdf(base.sdf, base.bounds, 0.45);
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${outline} ${curve} ${kind}`);
    assert.equal(base.info.flip, false);
    if (!curve) {
      // Across the slot at mid-height of the slot, in the middle: empty exactly over the slot width
      const z = (base.info.seatFloor + base.info.height) / 2, T = panelEdgeThickness(s), c = s.base.clearance;
      assert.ok(base.sdf(0, T / 2, z) > 0, 'slot is open');
      assert.ok(base.sdf(0, -c / 2 - 0.3, z) < 0, 'front wall');
      assert.ok(base.sdf(0, T + c / 2 + 0.3, z) < 0, 'back wall');
      assert.ok(base.sdf(0, T / 2, base.info.seatFloor - 0.3) < 0, 'slot floor');
    }
  }
  const s = panelSettings({ outline: 'rect' });
  s.base.panelKind = 'none';
  assert.equal(buildBase(s, buildPanel(s)), null);
});
