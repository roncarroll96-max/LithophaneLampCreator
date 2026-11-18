import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape } from '../js/core/shapes.js';
import { checkWatertight, flipUpsideDown } from '../js/core/mesh.js';
import { meshSdf, cylinder, subtract, box } from '../js/core/sdf.js';
import { buildBase } from '../js/core/base.js';
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

for (const [shapeName, light] of [['basketball', 'puck'], ['basketball', 'strip'], ['basketball', 'bulb'], ['cube', 'puck'], ['cube', 'strip'], ['football', 'bulb']]) {
  test(`${light} base under a ${shapeName} is a closed solid`, () => {
    const { base } = setup(shapeName, light);
    const m = meshSdf(base.sdf, base.bounds, 0.6);
    const wt = checkWatertight(m.indices, m.positions.length / 3);
    assert.ok(wt.ok, `bad edges ${wt.badEdges}`);
    if (base.info.flip) {
      const h = m.bbox.max[2];
      flipUpsideDown(m);
      assert.ok(Math.abs(m.bbox.min[2]) < 1e-6 && Math.abs(m.bbox.max[2] - h) < 1e-6, 'turned over, same height');
    }
  });
}

test('the collar drops into the seat and rests on its floor', () => {
  for (const light of ['puck', 'strip', 'bulb']) {
    const { col, base } = setup('basketball', light);
    const f = base.sdf, i = base.info;
    const mid = i.seatFloor + col.height / 2;
    assert.ok(f(col.ro - 0.05, 0, mid) > 0, `${light}: room for the collar wall`);
    assert.ok(f(col.ro + 0.15, 0, mid) > 0, `${light}: clearance around it`);
    assert.ok(f(col.ro + 1.0, 0, mid) < 0, `${light}: seat wall beyond`);
    assert.ok(f(col.ri + 1, 0, i.seatFloor - 0.5) < 0, `${light}: floor under the collar`);
    assert.ok(Math.abs(i.seatR - (col.ro + 0.2)) < 1e-9, 'seat radius = collar + half the clearance');
  }
});

test('the puck fits, light gets through, the cable notch faces the back', () => {
  const { s, col, base } = setup('basketball', 'puck');
  const f = base.sdf, r = s.base.puckD / 2;
  assert.ok(f(r, 0, s.base.puckH / 2) > 0, 'puck edge inside the cavity');
  assert.ok(f(0, 0, s.base.puckH + 0.5) > 0 && f(0, 0, base.info.seatFloor + 1) > 0, 'open path for the light');
  assert.ok(f(col.ri - 1.6, 0, s.base.puckH + 2) > 0, 'light hole nearly as wide as the opening');
  assert.ok(f(0, base.info.width / 2 - 1, 2) > 0, 'notch through the back wall');
  assert.ok(f(base.info.width / 2 - 1, 0, 2) < 0, 'side wall solid');
  assert.equal(base.info.flip, true);
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
