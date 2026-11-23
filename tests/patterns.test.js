// Version 1.10: the cylinder's lid, and background patterns where a panel has no photo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../js/core/settings.js';
import { buildCylinder, createCylinderField } from '../js/core/cylinder.js';
import { buildLid, LID_STYLES } from '../js/core/lid.js';
import { createPanelPattern, PANEL_PATTERNS, diamondDist, hexWallDist } from '../js/core/patterns.js';
import { buildPanel } from '../js/core/panel.js';
import { createPanelField } from '../js/core/panelField.js';
import { lanternGeometry, buildLanternStrip, createLanternField, sideCenterU } from '../js/core/lantern.js';
import { partList, lidMesh } from '../js/core/exportParts.js';
import { meshSdf } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';

function cyl(edit = {}) {
  const s = defaultSettings();
  s.shape = 'cylinder';
  Object.assign(s.cylinder, edit);
  return s;
}
/** Downward-facing area (mm²) above z (what would need supports). */
function overhangArea(m, zAbove) {
  const p = m.positions, idx = m.indices;
  let area = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz);
    if (L && nz / L < -0.75 && (p[a + 2] + p[b + 2] + p[c + 2]) / 3 > zAbove) area += L / 2;
  }
  return area;
}

test('the cylinder has no lid until one is chosen; every style is listed', () => {
  assert.equal(defaultSettings().cylinder.lid, 'none');
  assert.equal(buildLid(cyl(), buildCylinder(cyl())), null);
  assert.deepEqual(Object.keys(LID_STYLES), ['none', 'solid', 'diamond', 'honeycomb', 'snowflake', 'holes']);
});

test('every lid is one closed part that fits the rim and prints upside down with no supports', () => {
  for (const style of ['solid', 'diamond', 'honeycomb', 'snowflake', 'holes']) for (const size of ['small', 'large']) {
    const s = cyl({ size, lid: style }), sh = buildCylinder(s), lid = buildLid(s, sh), i = lid.info, tag = `${style} ${size}`;
    // as it sits: the cap covers the tube, the lip drops inside the rim with the fit all round
    const f = lid.sitSdf, ri = sh.collar.ri;
    assert.ok(f(sh.R - 0.5, 0, i.cap / 2) < 0 && f(sh.R + 0.5, 0, i.cap / 2) > 0, `${tag}: the cap is as wide as the tube`);
    assert.ok(Math.abs(i.lipR - (ri - s.cylinder.lidFit)) < 1e-9, `${tag}: lip ${s.cylinder.lidFit} mm inside the rim`);
    assert.ok(f(i.lipR - 0.5, 0, -i.lipH / 2) < 0 && f(i.lipR + 0.1, 0, -i.lipH / 2) > 0, `${tag}: the lip`);
    assert.ok(f(ri - 0.05, 0, -i.lipH / 2) > 0, `${tag}: room for the rim's wall`);
    assert.equal(i.lipH, sh.rim, 'the lip is as deep as the plain rim, so it hides none of the picture');
    // open in the middle (except the solid lid), with a solid border over the rim
    const openAt = [];
    for (let x = -i.lipR; x <= i.lipR; x += 0.5) if (f(x * Math.cos(0.5), x * Math.sin(0.5), i.cap / 2) > 0) openAt.push(x); // (a line off the snowflake's arms)
    if (style === 'solid') assert.equal(openAt.length, 0, 'solid');
    else assert.ok(openAt.length > 10 && openAt.every((x) => Math.abs(x) < i.openR), `${tag}: open only inside the border`);
    // the printed part: closed, flat on the bed, no overhangs
    const m = meshSdf(lid.sdf, lid.bounds, 0.4);
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${tag}: closed`);
    assert.ok(Math.abs(m.bbox.min[2]) < 0.05 && Math.abs(m.bbox.max[2] - i.height) < 0.3, `${tag}: on the bed, ${i.height} mm tall`);
    assert.ok(overhangArea(m, 0.5) < 1, `${tag}: no overhangs`); // (above the bottom layer's mesh edge)
  }
});

test('the lid exports on its own and in the 3MF', () => {
  assert.deepEqual(partList({ settings: cyl({ size: 'small' }) }).map((p) => p.name), ['Cylinder', 'Base']);
  const s = cyl({ size: 'small', lid: 'honeycomb' });
  assert.deepEqual(partList({ settings: s }).map((p) => p.name), ['Cylinder', 'Lid (Honeycomb)', 'Base']);
  const { mesh, label } = lidMesh(s);
  assert.match(label, /lid honeycomb/);
  assert.ok(checkWatertight(mesh.indices, mesh.positions.length / 3).ok);
  assert.equal(lidMesh(cyl()), null);
});

test('patterns: none by default; lattices have dark lines round brighter cells', () => {
  const s = defaultSettings();
  assert.deepEqual(s.pattern, { kind: 'none', size: 15 });
  assert.equal(createPanelPattern(s), null);
  assert.deepEqual(Object.keys(PANEL_PATTERNS), ['none', 'diamond', 'honeycomb', 'wood', 'stars']);
  for (const [kind, dist] of [['diamond', diamondDist], ['honeycomb', hexWallDist]]) {
    s.pattern = { kind, size: 15 };
    const f = createPanelPattern(s);
    let line = null, cell = null;
    for (let u = 0; u < 30 && (line == null || cell == null); u += 0.1) {
      const d = dist(u, 3.3, 15);
      if (d < 0.1 && line == null) line = f(u, 3.3, 0.55);
      if (d > 2.5 && cell == null) cell = f(u, 3.3, 0.55);
    }
    assert.ok(line < 0.1 && Math.abs(cell - 0.55) < 1e-9, `${kind}: line ${line}, cell ${cell}`);
  }
  for (const kind of ['wood', 'stars']) {
    s.pattern = { kind, size: 15 };
    const f = createPanelPattern(s);
    let lo = 1, hi = 0;
    for (let u = 0; u < 80; u += 0.7) for (let v = 0; v < 80; v += 0.7) { const b = f(u, v, 0.55); lo = Math.min(lo, b); hi = Math.max(hi, b); }
    assert.ok(lo >= 0 && hi <= 1 && hi - lo > 0.4, `${kind}: varies between ${lo.toFixed(2)} and ${hi.toFixed(2)}`);
  }
});

test('patterns fill the panel where there is no photo, and a photo covers them', () => {
  const s = defaultSettings(); s.shape = 'panel'; s.base.panelKind = 'none';
  const panel = buildPanel(s), out = {};
  const plain = createPanelField(s, panel, null);
  s.pattern = { kind: 'diamond', size: 15 };
  const pat = createPanelField(s, panel, null);
  let differ = 0;
  for (let u = -30; u <= 30; u += 1.3) { plain.evalUV(u, 4.1, out); const a = out.t; pat.evalUV(u, 4.1, out); if (Math.abs(out.t - a) > 0.5) differ++; }
  assert.ok(differ > 3, 'the lattice lines are thicker');
  // a photo filling the panel hides the pattern
  const w = 8, h = 8, photos = { p: { w, h, data: new Float32Array(w * h).fill(1) } };
  s.photos = [{ id: 'p', panelW: null }];
  pat.evalUV(0, 0, out); const t0 = out.t;
  const covered = createPanelField(s, panel, photos), plainPhoto = createPanelField({ ...s, pattern: { kind: 'none' } }, panel, photos);
  for (let u = -20; u <= 20; u += 2.1) {
    covered.evalUV(u, 3, out); const a = out.t; plainPhoto.evalUV(u, 3, out);
    assert.ok(Math.abs(a - out.t) < 1e-9, 'covered by the photo');
  }
  assert.ok(Number.isFinite(t0));
});

test('round a cylinder the pattern joins up at the back; on a lantern it is centred on each side', () => {
  for (const kind of ['diamond', 'honeycomb', 'wood', 'stars']) {
    const s = cyl({ size: 'medium' }); s.pattern = { kind, size: 15 };
    const sh = buildCylinder(s), f = createPanelPattern(s, { periodU: sh.C });
    for (let v = -40; v <= 40; v += 7.7) for (let u = -10; u <= 10; u += 3.1) {
      assert.ok(Math.abs(f(u, v, 0.55) - f(u + sh.C, v, 0.55)) < 1e-6, `${kind}: repeats every ${sh.C.toFixed(1)} mm round`);
    }
    // the cylinder's own field uses it
    const field = createCylinderField(s, sh, null), o = {};
    field.evalUV(sh.C / 2 - 0.01, 10, o); const a = o.t; field.evalUV(-sh.C / 2 + 0.01, 10, o);
    assert.ok(Math.abs(a - o.t) < 0.2, `${kind}: smooth across the join (${a.toFixed(2)} vs ${o.t.toFixed(2)})`);
  }
  const s = defaultSettings(); s.shape = 'lantern'; s.pattern = { kind: 'stars', size: 15 }; s.evenGlow.on = false;
  const geo = lanternGeometry(s), strip = buildLanternStrip(s, geo), field = createLanternField(s, strip, null), o = {};
  for (let x = -40; x <= 40; x += 6.3) {
    field.evalUV(sideCenterU(geo.W, 0, geo.n) + x, 12, o); const a = o.t;
    field.evalUV(sideCenterU(geo.W, 2, geo.n) + x, 12, o);
    assert.ok(Math.abs(a - o.t) < 1e-9, 'the same pattern on every side');
  }
});
