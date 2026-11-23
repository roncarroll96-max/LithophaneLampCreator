import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape } from '../js/core/shapes.js';
import { checkWatertight, flipUpsideDown } from '../js/core/mesh.js';
import { meshSdf, cylinder, subtract, box } from '../js/core/sdf.js';
import { buildBase, trayDims } from '../js/core/base.js';
import { buildCylinder } from '../js/core/cylinder.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';

function setup(shapeName, light, edit = () => {}) {
  const s = defaultSettings();
  s.shape = shapeName; s.base.light = light;
  edit(s);
  const col = collarDims(s);
  const shape = buildEllipsoidShape(bodyAxes(s), col.ro);
  return { s, col, shape, base: buildBase(s, shape) };
}

test('the solid-shape mesher makes closed, outward-facing meshes of the right size', () => {
  const f = subtract(cylinder(30, 0, 20), cylinder(20, -1, 10), box(-5, 5, 0, 40, -1, 6));
  const m = meshSdf(f, { min: [-30, -30, 0], max: [30, 30, 20] }, 0.5);
  assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok);
  const want = Math.PI * 900 * 20 - Math.PI * 400 * 10 - (6 * 10 * 10 - 0); // notch mostly through the wall
  assert.ok(Math.abs(m.volume - want) / want < 0.01, `volume ${m.volume} vs about ${want}`);
  assert.ok(Math.abs(m.bbox.max[2] - 20) < 0.05 && Math.abs(m.bbox.min[0] + 30) < 0.05, 'exact size');
});

for (const [shapeName, light, hold] of [['basketball', 'puck', 'hole'], ['basketball', 'puck', 'tray'], ['basketball', 'strip'], ['basketball', 'bulb'],
  ['cube', 'puck', 'hole'], ['cube', 'puck', 'tray'], ['cube', 'strip'], ['football', 'bulb']]) {
  test(`${light}${hold ? ` (${hold})` : ''} base under a ${shapeName} is a closed solid`, () => {
    const { base } = setup(shapeName, light, (s) => { if (hold) s.base.puckHold = hold; });
    for (const [name, p] of [['whole', { ...base, flip: base.info.flip }], ...Object.entries(base.parts)]) {
      const m = meshSdf(p.sdf, p.bounds, 0.6);
      const wt = checkWatertight(m.indices, m.positions.length / 3);
      assert.ok(wt.ok, `${name}: bad edges ${wt.badEdges}`);
      if (p.flip) {
        const h = m.bbox.max[2];
        flipUpsideDown(m);
        assert.ok(Math.abs(m.bbox.min[2]) < 1e-6 && Math.abs(m.bbox.max[2] - h) < 1e-6, 'turned over, same height');
      }
    }
  });
}

test('the collar drops into the seat and rests on its floor', () => {
  for (const [light, hold] of [['puck', 'hole'], ['puck', 'tray'], ['strip'], ['bulb']]) {
    const { col, base } = setup('basketball', light, (s) => { if (hold) s.base.puckHold = hold; });
    const f = base.sdf, i = base.info;
    const mid = i.seatFloor + col.height / 2;
    assert.ok(f(col.ro - 0.05, 0, mid) > 0, `${light}: room for the collar wall`);
    assert.ok(f(col.ro + 0.15, 0, mid) > 0, `${light}: clearance around it`);
    assert.ok(f(col.ro + 1.0, 0, mid) < 0, `${light}: seat wall beyond`);
    assert.ok(f(col.ri + 1, 0, i.seatFloor - 0.5) < 0, `${light}: floor under the collar`);
    assert.ok(Math.abs(i.seatR - (col.ro + 0.2)) < 1e-9, 'seat radius = collar + half the clearance');
  }
});

test('open bottom: the puck fits, light gets through, the cable notch faces the back', () => {
  const { s, col, base } = setup('basketball', 'puck', (st) => { st.base.puckHold = 'hole'; });
  const f = base.sdf, r = s.base.puckD / 2;
  assert.ok(f(r, 0, s.base.puckH / 2) > 0, 'puck edge inside the cavity');
  assert.ok(f(0, 0, s.base.puckH + 0.5) > 0 && f(0, 0, base.info.seatFloor + 1) > 0, 'open path for the light');
  assert.ok(f(col.ri - 1.6, 0, s.base.puckH + 2) > 0, 'light hole nearly as wide as the opening');
  assert.ok(f(0, base.info.width / 2 - 1, 2) > 0, 'notch through the back wall');
  assert.ok(f(base.info.width / 2 - 1, 0, 2) < 0, 'side wall solid');
  assert.equal(base.info.flip, true);
  assert.equal(base.parts.cover, undefined, 'no bottom cover');
});

test('the default puck is 59.5 x 8 mm in a tray with a 5 mm wall', () => {
  const s = defaultSettings();
  assert.equal(s.base.puckD, 59.5); assert.equal(s.base.puckH, 8); assert.equal(s.base.puckHold, 'tray');
  assert.equal(s.base.rimH, 5);
  const td = trayDims(s.base, 30);
  assert.equal(td.hw * 2, 16.5, 'plug hole 1 mm wider than the plug'); assert.equal(td.hl, 16);
  assert.equal(td.cw, 4, 'cable hole 1 mm wider than the cable'); assert.equal(td.ch, 4);
});

/** Checks a tray (in its own coordinates, z = 0 on the table, the back at +y). */
function checkTray(f, td, R, tag) {
  const { F, pr, rimH, hw, y0, y1, cw, ch } = td, ym = (y0 + y1) / 2;
  assert.ok(f(0, 0, 0.5) < 0 && f(0, 0, F - 0.5) < 0, `${tag}: closed floor under the puck`);
  assert.ok(f(0, 0, F + 1) > 0 && f(pr - 0.5, 0, F + rimH / 2) > 0, `${tag}: room for the puck`);
  assert.ok(f(pr + 1, 0, F + rimH / 2) < 0 && f(-(pr + 1), 0, F + rimH - 0.3) < 0, `${tag}: a ${rimH} mm wall round the puck`);
  for (const z of [0.5, F - 0.5, F + rimH / 2]) assert.ok(f(0, ym, z) > 0, `${tag}: plug hole open at z ${z}`);
  assert.ok(f(hw - 0.3, ym, F - 0.5) > 0 && f(hw + 0.3, ym, F - 0.5) < 0, `${tag}: plug hole ${2 * hw} mm wide`);
  assert.ok(f(0, R - 0.5, ch - 0.5) > 0, `${tag}: cable hole out through the back`);
  assert.ok(f(0, R - 0.5, ch + 0.5) < 0 && f(cw / 2 + 0.5, R - 0.5, 1) < 0, `${tag}: only a ${cw} x ${ch} mm hole shows`);
  assert.ok(f(0, (y1 + R) / 2, ch + 0.5) < 0, `${tag}: floor over the channel`);
  assert.ok(f(-R + 0.5, 0, 1) < 0, `${tag}: front edge solid`);
}

test('tray under a ball or cube: a bottom cover holds the puck and presses into the base', () => {
  for (const [diameter, square] of [[150, false], [100, false], [100, true]]) {
    const { s, col, base } = setup(square ? 'cube' : 'basketball', 'puck', (st) => { st.diameter = diameter; st.cube.size = diameter; });
    const i = base.info, td = trayDims(s.base, s.base.puckD / 2 + 0.6), R = i.width / 2, tag = `${diameter}${square ? ' cube' : ''}`;
    assert.equal(i.tray, 'cover', `${tag}: the puck can't pass the ${col.ri * 2} mm opening, so a cover holds it`);
    const cover = base.parts.cover, bp = base.parts.base;
    assert.equal(cover.flip, false, 'the cover prints as it sits'); assert.equal(bp.flip, true, 'the base prints upside down');
    checkTray(cover.sdf, td, R, tag);
    // The cover's wall fits inside the base with the cover fit all round
    const rc = td.pr + td.rimT + s.base.coverFit;
    assert.ok(bp.sdf(-(rc - 0.05), 0, td.rimH / 2) > 0 && bp.sdf(-(rc + 0.3), 0, td.rimH / 2) < 0, `${tag}: room for the cover's wall`);
    assert.ok(bp.sdf(R - 1.5, 0, 2) < 0 && bp.sdf(0, R - 1.5, 2) < 0, `${tag}: the base's wall is whole (no notch: the cable leaves through the cover)`);
    assert.ok(bp.sdf(0, td.y1 - 0.3, 2) > 0, `${tag}: room in the base for the cable over the plug hole`);
    // Put together: the collar still drops into the seat
    assert.ok(base.sdf(col.ri + 1, 0, i.seatFloor - 0.5) < 0 && base.sdf(col.ro - 0.05, 0, i.seatFloor + 1) > 0, `${tag}: seat`);
  }
});

test('tray under a cylinder: one piece, the puck drops in from above', () => {
  for (const size of ['small', 'medium', 'large']) {
    const s = defaultSettings(); s.shape = 'cylinder'; s.cylinder.size = size;
    const shape = buildCylinder(s), base = buildBase(s, shape), i = base.info;
    const td = i.td, col = shape.collar;
    assert.equal(i.tray, 'dropin', size); assert.equal(i.flip, false, 'prints as it sits');
    assert.equal(base.parts.cover, undefined, 'no cover');
    checkTray(base.sdf, td, i.width / 2, size);
    // open from the seat down to the tray, wide enough for the puck and the plug
    assert.ok(base.sdf(td.hw, td.y1, i.seatFloor - 1) > 0, `${size}: the plug passes down to its hole`);
    assert.ok(base.sdf(col.ri + 1, 0, i.seatFloor - 0.5) < 0 && base.sdf(col.ro - 0.05, 0, i.seatFloor + 1) > 0, `${size}: seat`);
    const m = meshSdf(base.sdf, base.bounds, 0.6);
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${size}: closed`);
  }
});

test('the strip riser fits through the opening and reaches about the middle of the lamp', () => {
  const { col, shape, base } = setup('basketball', 'strip');
  assert.ok(base.info.riserD / 2 < col.ri, 'riser narrower than the opening');
  // lamp middle above the seat floor: collar height plus the opening's depth below the centre
  const o = {}; let zEdge = Infinity;
  for (let i = 0; i < 64; i++) { const th = (i / 64) * 2 * Math.PI; shape.surf(th, shape.phiEdge(th), o); zEdge = Math.min(zEdge, o.z); }
  const middle = base.info.seatFloor + col.height - zEdge;
  assert.ok(base.info.totalHeight < middle && base.info.totalHeight > middle - 15, `riser top ${base.info.totalHeight} vs middle ${middle}`);
  assert.equal(base.info.flip, false, 'prints standing up');
  const f = base.sdf;
  assert.ok(f(0, 0, base.info.totalHeight - 20) > 0, 'hollow riser for the wires');
  assert.ok(f(base.info.riserD / 2 - 1, 0, base.info.totalHeight - 20) < 0, 'riser wall');
});

test('the base matches the lamp: round under balls, square under the cube', () => {
  assert.equal(setup('basketball', 'puck').base.info.square, false);
  assert.equal(setup('cube', 'puck').base.info.square, true);
  assert.equal(setup('cube', 'puck', (s) => { s.base.shape = 'round'; }).base.info.square, false);
  const sq = setup('cube', 'puck').base, w = sq.info.width / 2;
  assert.ok(sq.sdf(w - 3, w - 3, 2) < 0, 'square corner is solid');
  assert.ok(setup('basketball', 'puck').base.sdf(w - 3, w - 3, 2) > 0, 'round base has no corner there');
});
