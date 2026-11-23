// Lantern (feature 12c, version 1.4; 3 to 6 sides in 1.6): panels in a frame of pillars, a base and a top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../js/core/settings.js';
import {
  lanternGeometry, lanternPart, pillarSdf, baseSdf, topSdf, buildLanternStrip, createLanternField,
  lanternSidePanel, lanternFrameMesh, lanternLight, sideCenterU, sideOf, lanternSideNames, polyBox,
} from '../js/core/lantern.js';
import { meshSdf } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';
import { buildPanelMesh } from '../js/core/panelMesh.js';

const SIDES = [3, 4, 5, 6];

function lantern(edit = {}, tMax = 3, hold) {
  const s = defaultSettings();
  s.shape = 'lantern'; s.tMax = tMax;
  if (hold) s.base.puckHold = hold;
  Object.assign(s.lantern, edit);
  return s;
}
/** A point given in side terms (x along the panel, d out from the middle), on side k. */
function onSide(g, k, x, d, z) { const F = g.frames[k]; return [x * F.tx + d * F.nx, x * F.ty + d * F.ny, z]; }
/** The pillar placed at corner k (lantern coordinates). */
function placedPillar(g, k) {
  const f = pillarSdf(g), th = k * g.a, c = Math.cos(th), s = Math.sin(th);
  return (x, y, z) => { const px = x * c + y * s, py = -x * s + y * c; return f(px - g.Q[0], py - g.Q[1], z - g.hB); };
}
const topPlaced = (g) => { const f = topSdf(g); return (x, y, z) => f(x, y, z - g.zT); };
/** The point at corner 0 that is d0 out along side 0's normal and d1 along side 1's. */
const atD = (g, d0, d1) => [(d1 - d0 * g.ca) / g.sa, -d0];

function photo(w = 120, h = 160, v = 0.2) {
  const data = new Float32Array(w * h).fill(v);
  return { w, h, data };
}

test('lantern sizes: the slots hold the panels about 6 mm deep, and the pillar stays in one piece', () => {
  const g = lanternGeometry(lantern());
  assert.equal(g.n, 4);
  assert.ok(Math.abs(g.W - 101.6) < 1e-9 && Math.abs(g.H - 152.4) < 1e-9, '4x6 in portrait to start');
  assert.ok(Math.abs(g.insert - 6.2) < 0.01, `insert ${g.insert}`);
  assert.ok(Math.abs(g.half - g.inner - 16) < 1e-9 && Math.abs(g.peg.h - 2.8) < 1e-9, 'the 4-sided lantern keeps its sizes');
  for (const n of SIDES) for (const P of [14, 16, 20, 24]) for (const tMax of [2, 3, 5]) for (const slotFit of [0.1, 0.4, 1.2]) {
    const q = lanternGeometry(lantern({ sides: n, pillar: P, slotFit }, tMax));
    const tag = `n ${n} P ${P} tMax ${tMax} fit ${slotFit}`;
    assert.ok(q.insert >= 4 - 1e-9, `${tag}: insert ${q.insert}`);
    assert.ok(q.Dm - q.sw / 2 > q.inner + 1, `${tag}: pillar wall behind the panel`);
    // the slot for side 0 stops BRIDGE mm short of side 1's slot (the corner holds the pillar together)
    const end = Math.max(...[-1, 1].map((e) => q.sEnd * q.sa + (q.Dm + (e * q.sw) / 2) * q.ca));
    assert.ok(end <= q.Dm - q.sw / 2 - 2.5 + 1e-9, `${tag}: bridge between the slots`);
    // the peg stays clear of both slots' ends and inside the pillar
    const { dp, h } = q.peg;
    for (const d0 of [dp - h, dp + h]) for (const d1 of [dp - h, dp + h]) {
      const [x] = atD(q, d0, d1);
      assert.ok(x >= q.sEnd + 0.99, `${tag}: peg clear of the slot ends`);
      assert.ok(Math.max(d0, d1) <= q.half - 1.99, `${tag}: peg inside the pillar`);
    }
  }
});

test('the side names, strip positions and outline boxes', () => {
  assert.deepEqual(lanternSideNames(4), ['Front', 'Right', 'Back', 'Left']);
  assert.deepEqual(lanternSideNames(3), ['Front', 'Side 2', 'Side 3']);
  for (const n of SIDES) for (let k = 0; k < n; k++) assert.equal(sideOf(100, sideCenterU(100, k, n), n), k);
  assert.deepEqual(polyBox(4, 10), [-10, 10, -10, 10]);
  const b3 = polyBox(3, 10);
  assert.ok(Math.abs(b3[2] + 10) < 1e-6 && Math.abs(b3[3] - 20) < 1e-6, 'a triangle: flat front, point at the back');
  const b6 = polyBox(6, 10);
  assert.ok(Math.abs(b6[3] - 10) < 1e-6 && Math.abs(b6[1] - 20 / Math.sqrt(3)) < 1e-6, 'a hexagon: flat front and back');
});

test('the panels fit: room all round in the slots and grooves, held in front by the pillars', () => {
  const cases = [];
  for (const n of SIDES) cases.push([n, 'classic', {}]);
  cases.push([4, 'pagoda', { size: '5x7', orient: 'landscape' }], [4, 'lid', { outline: 'square', size: '4', pillar: 20 }],
    [3, 'pagoda', {}], [6, 'lid', {}], [5, 'classic', { outline: 'square', size: '4', pillar: 20 }]);
  for (const [n, top, edit] of cases) {
    const s = lantern({ sides: n, ...edit, top, topH: top === 'pagoda' ? 60 : 32 });
    const g = lanternGeometry(s);
    const parts = [baseSdf(g), topPlaced(g), ...Array.from({ length: n }, (_, k) => placedPillar(g, k))];
    const frame = (p) => Math.min(...parts.map((f) => f(...p)));
    const tag = `${n} sides ${top} ${JSON.stringify(edit)}`;
    for (let k = 0; k < n; k++) {
      // Every bit of the panel (W x T x H slab) is clear of the frame
      for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) for (const d of [g.Dm - g.T / 2 + 0.02, g.Dm, g.Dm + g.T / 2 - 0.02]) {
        const x = -g.W / 2 + (g.W * i) / 30, z = g.zG + 0.02 + ((g.H - 0.04) * j) / 30;
        const p = onSide(g, k, x, d, z);
        assert.ok(frame(p) > 0, `${tag} side ${k}: panel point ${p.map((v) => v.toFixed(1))} inside the frame`);
      }
      // Held in front: just outside the panel's face near its edges there is pillar
      for (const x of [-g.W / 2 + 1.5, g.W / 2 - 1.5]) {
        assert.ok(frame(onSide(g, k, x, g.Dm + g.T / 2 + 1, g.zG + g.H / 2)) < 0, `${tag}: a pillar lip in front of the panel edge`);
      }
      // Held at the bottom and top: the base groove floor and the top's groove roof
      assert.ok(frame(onSide(g, k, 0, g.Dm, g.zG - 0.5)) < 0, `${tag}: groove floor under the panel`);
      assert.ok(frame(onSide(g, k, 0, g.Dm, g.zG + g.H + 1.5)) < 0, `${tag}: top groove above the panel`);
    }
  }
});

test('the pegs fit their holes: snug, with the fit room all round', () => {
  for (const n of SIDES) {
    const s = lantern({ sides: n });
    const g = lanternGeometry(s), f = g.pegFit, { dp, h, len } = g.peg;
    const pillar = placedPillar(g, 0), base = baseSdf(g), top = topPlaced(g);
    const grid = (grow, z0, z1) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) for (const z of [z0, (z0 + z1) / 2, z1]) {
        pts.push([...atD(g, dp - h - grow + ((2 * (h + grow)) * i) / 8, dp - h - grow + ((2 * (h + grow)) * j) / 8), z]);
      }
      return pts;
    };
    // The base's peg goes up into the pillar's foot without touching it; the pillar's peg into the top
    for (const p of grid(-0.6, g.hB + 0.6, g.hB + len - 0.6)) { assert.ok(base(...p) < 0); assert.ok(pillar(...p) > 0, `${n}: base peg clear of the pillar`); }
    for (const p of grid(-0.6, g.zT + 0.6, g.zT + len - 0.6)) { assert.ok(pillar(...p) < 0); assert.ok(top(...p) > 0, `${n}: pillar peg clear of the top`); }
    // ...and the hole is only `fit` bigger: just past it there is plastic
    const out = h + f + 0.15;
    for (let i = 0; i <= 8; i++) {
      const a = dp - out + (2 * out * i) / 8;
      for (const [d0, d1] of [[dp - out, a], [dp + out, a], [a, dp - out], [a, dp + out]]) {
        assert.ok(pillar(...atD(g, d0, d1), g.hB + 3) < 0, `${n}: snug hole`);
      }
    }
  }
});

/**
 * Downward-facing area above height zAbove (things that would need supports). Surfaces cut at
 * 45 degrees come out as small steps in the mesh, so a little area always shows up: a real flat
 * overhang (a cap's or beam's underside) would be hundreds of mm².
 */
function overhangArea(m, zAbove) {
  const p = m.positions, I = m.indices;
  let area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz);
    const zc = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
    if (L && nz / L < -0.75 && zc > zAbove) area += L / 2;
  }
  return area;
}

test('every frame part is a closed solid that prints without supports (only short bridges)', () => {
  for (const n of SIDES) for (const [top, topH] of [['classic', 32], ['pagoda', 60], ['lid', 14]]) {
    const s = lantern({ sides: n, top, topH });
    const g = lanternGeometry(s);
    for (const part of top === 'classic' ? ['pillar', 'base', 'top'] : ['top']) {
      const p = lanternPart(s, part);
      const m = meshSdf(p.sdf, p.bounds, 0.5);
      const wt = checkWatertight(m.indices, m.positions.length / 3);
      const tag = `${n} sides ${top} ${part}`;
      assert.ok(wt.ok, `${tag}: bad edges ${wt.badEdges}`);
      assert.ok(Math.abs(m.bbox.min[2]) < 0.3, `${tag} sits on the bed`);
      const size = m.bbox.max.map((v, i) => v - m.bbox.min[i]);
      assert.ok(size.every((v, i) => v <= p.size[i] + 1.5), `${tag}: size ${size.map((v) => v.toFixed(1))} within ${p.size.map((v) => v.toFixed(1))}`);
      // Allowed: the ceilings of the peg holes, grooves, cable notch and vents (short bridges)
      const limit = part === 'pillar' ? g.peg.len + 1.5 : part === 'base' ? g.cableH + 1 : top === 'pagoda' ? g.top.hF - 1.5 : g.peg.len + 1.5;
      const a = overhangArea(m, limit);
      assert.ok(a < 200, `${tag}: ${a.toFixed(0)} mm² of overhang above z ${limit}`);
    }
  }
  // A pillar too tall for the printer lies down, still without supports
  for (const n of [4, 6]) {
    const tall = lantern({ sides: n, size: '8x10' }); tall.bed.z = 200;
    const p = lanternPart(tall, 'pillar');
    assert.ok(p.size[2] < 30 && p.size[1] > 200, 'lies down');
    const m = meshSdf(p.sdf, p.bounds, 0.5);
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok);
    assert.ok(Math.abs(m.bbox.min[2]) < 0.3, 'lies on the bed');
    assert.ok(overhangArea(m, 8) < 50, `${n} sides: only the slot and peg-hole bridges`);
  }
});

test('the preview frame is the parts put together', () => {
  for (const n of SIDES) {
    const s = lantern({ sides: n });
    const g = lanternGeometry(s);
    const fm = lanternFrameMesh(s, meshSdf, 2);
    let zMin = Infinity, zMax = -Infinity, yMin = Infinity;
    for (let i = 0; i < fm.positions.length; i += 3) {
      zMin = Math.min(zMin, fm.positions[i + 2]); zMax = Math.max(zMax, fm.positions[i + 2]); yMin = Math.min(yMin, fm.positions[i + 1]);
    }
    assert.ok(Math.abs(zMin) < 1.5, 'on the table');
    assert.ok(Math.abs(zMax - g.totalHeight) < 1.5, `top at ${zMax} vs ${g.totalHeight}`);
    if (n === 4) assert.ok(Math.abs(-yMin - (g.half + g.top.ov)) < 2, 'beams reach out in front by the overhang');
    // nothing sticks out past the lantern's footprint (beam ends included)
    assert.ok(yMin >= g.footBox[2] - 1.5, `${n}: front ${yMin.toFixed(1)} within the footprint ${g.footBox[2].toFixed(1)}`);
    assert.equal(fm.info.seatFloor, g.zG);
    // Every corner has its pillar: a point in each pillar's middle is in the assembled frame's mesh box
    const pillar = placedPillar(g, 0);
    for (let k = 0; k < n; k++) {
      const th = k * g.a, [qx, qy] = g.Q, x = qx * Math.cos(th) - qy * Math.sin(th), y = qx * Math.sin(th) + qy * Math.cos(th);
      assert.ok(placedPillar(g, k)(x, y, g.hB + g.pillarL / 2) < 0, `${n}: pillar ${k} in place`);
      if (k > 0) assert.ok(pillar(x, y, g.hB + g.pillarL / 2) > 0);
    }
  }
});

test('the strip folds round the sides, each photo fills its own side, and panels export closed', () => {
  for (const n of SIDES) {
    const s = lantern({ sides: n });
    s.photos = [{ id: 'a', side: 0 }, { id: 'b', side: 2 }, { id: 'c', side: n }];
    const strip = buildLanternStrip(s);
    const g = strip.geo;
    assert.equal(strip.sides, n);
    assert.ok(Math.abs(strip.W - n * g.W) < 1e-9, 'one panel width per side');
    const field = createLanternField(s, strip, { a: photo(120, 160, 0), b: photo(120, 160, 1), c: photo(120, 160, 1) });
    const o = {};
    for (let k = 0; k < n; k++) {
      const u = sideCenterU(g.W, k, n);
      assert.equal(sideOf(g.W, u, n), k);
      field.evalUV(u, 0, o);
      // The panel's outer face is Dout from the middle, on side k, facing out
      const [ex, ey] = onSide(g, k, 0, g.Dout, 0);
      assert.ok(Math.hypot(o.sx - ex, o.sy - ey) < 1e-6, `${n} sides: side ${k} position`);
      assert.ok(Math.hypot(o.ix, o.iy) < Math.hypot(o.sx, o.sy), 'back faces in');
      assert.equal(o.photoId, k === 0 ? 'a' : k === 2 ? 'b' : null, `${n} sides: side ${k} photo (a photo set to a missing side is not shown)`);
    }
  }
  const s = lantern();
  const strip = buildLanternStrip(s), g = strip.geo;
  s.photos = [{ id: 'a', side: 0 }];
  const field = createLanternField(s, strip, { a: photo(120, 160, 0) });
  // Even glow: the panel is thinner higher up (farther from the puck) for the same photo shade
  s.evenGlow = { on: true, strength: 0.6 };
  s.photos = [];
  const f2 = createLanternField(s, strip, {});
  const lo = {}, hi = {};
  f2.evalUV(sideCenterU(g.W, 1), -g.H / 2 + 20, lo); f2.evalUV(sideCenterU(g.W, 1), g.H / 2 - 20, hi);
  assert.ok(hi.t < lo.t, `top ${hi.t} vs bottom ${lo.t}`);
  assert.ok(lanternLight(g, 0, g.H / 2) < 1 && lanternLight(g, 0, 0) === 1);
  // One side on its own: a flat, closed panel W x T x H standing on its edge, picture side out
  const panel = lanternSidePanel(s);
  const mesh = buildPanelMesh({ panel, field: field.sideField(0, panel), stepInner: 3, stepOuter: 1.5 });
  assert.ok(checkWatertight(mesh.indices, mesh.positions.length / 3).ok);
  const size = mesh.bbox.max.map((v, i) => v - mesh.bbox.min[i]);
  assert.ok(Math.abs(size[0] - g.W) < 0.01 && Math.abs(size[2] - g.H) < 0.01 && size[1] <= g.T + 1e-6, `size ${size}`);
});

test('every top style has a sensible height', () => {
  const g1 = lanternGeometry(lantern({ top: 'classic', topH: 10 }));
  assert.ok(g1.top.height >= g1.top.hF + g1.top.bh + g1.top.capH, 'classic never shorter than its beams and caps');
  const g2 = lanternGeometry(lantern({ top: 'pagoda', topH: 500, overhang: 30 }));
  assert.ok(g2.top.height <= g2.top.zA + 1e-9, 'pagoda no taller than its peak');
  assert.ok(g2.top.ov <= g2.top.hF - 3, 'eaves capped so they stay above the bed');
  assert.equal(lanternGeometry(lantern({ top: 'pagoda', overhang: 2 })).top.ov, 0, 'very short eaves are left off');
  const g3 = lanternGeometry(lantern({ top: 'lid', topH: 5 }));
  assert.ok(g3.top.hRing >= g3.top.hF);
});

test('the base can hold the puck in a tray: closed floor, a wall round the puck, a plug hole and a hidden cable channel', () => {
  for (const n of SIDES) {
    const s = lantern({ sides: n }); s.base.puckHold = 'tray'; s.base.puckD = 30;
    const g = lanternGeometry(s), base = baseSdf(g), td = g.td;
    assert.ok(g.tray && Math.abs(g.puckZ - (s.base.cableHoleH + 1.6)) < 1e-9, 'the floor is the cable hole plus 1.6 mm thick');
    assert.equal(g.trayRim, 5, 'a 5 mm wall round the puck');
    const r = td.pr, zr = g.puckZ + g.trayRim / 2;
    // the back: the cable notch's side (side n/2, rounded down)
    const F = g.frames[g.notchSide], at = (d, x = 0) => [x * F.tx + d * F.nx, x * F.ty + d * F.ny];
    assert.ok(base(0, 0, g.puckZ - 0.5) < 0 && base(0, 0, 0.5) < 0, `${n}: closed floor under the puck`);
    assert.ok(base(0, 0, g.puckZ + 1) > 0, 'room for the puck above the floor');
    assert.ok(base(...at(-(r + 1)), zr) < 0, `${n}: wall round the puck (front)`);
    assert.ok(base(...at(-(r - 1)), zr) > 0, `${n}: the puck fits inside the wall`);
    // the plug hole: through the floor and the wall at the back, as big as the plug plus 1 mm
    const ym = (td.y0 + td.y1) / 2;
    for (const z of [0.5, g.puckZ - 0.5, zr]) assert.ok(base(...at(ym), z) > 0, `${n}: plug hole open at z ${z}`);
    assert.ok(base(...at(ym, td.hw - 0.3), g.puckZ - 0.5) > 0 && base(...at(ym, td.hw + 0.3), g.puckZ - 0.5) < 0, `${n}: plug hole ${2 * td.hw} mm wide`);
    assert.ok(td.hl >= s.base.plugH + 1 - 1e-9 || td.y1 > g.inner, 'plug hole long enough');
    // the cable channel: under the floor, out through the back wall; only a small hole shows
    const cw = s.base.cableD + 1, ch = s.base.cableHoleH;
    assert.ok(base(...at(g.half - 1), ch - 0.5) > 0, `${n}: the cable hole goes out through the back wall`);
    assert.ok(base(...at(g.half - 1), ch + 0.5) < 0, `${n}: the back wall is solid above the cable hole`);
    assert.ok(base(...at(g.half - 1, cw / 2 + 0.5), 1) < 0, `${n}: the cable hole is only ${cw} mm wide`);
    assert.ok(base(...at(Math.min(td.y1 + 1, g.inner + 2)), ch + 0.5) < 0, `${n}: floor (or wall) over the channel`);
    // The hole version is still open under the puck
    assert.ok(baseSdf(lanternGeometry(lantern({ sides: n }, 3, 'hole')))(0, 0, 1) > 0);
  }
  for (const n of SIDES) {
    const s = lantern({ sides: n }); s.base.puckHold = 'tray';
    const g = lanternGeometry(s);
    // Closed and printable (the channel's ceiling is a short bridge)
    const p = lanternPart(s, 'base');
    const m = meshSdf(p.sdf, p.bounds, 0.5);
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${n} sides: closed`);
    assert.ok(overhangArea(m, g.cableH + 1) < 200);
  }
  // The puck sits higher in the tray, so the light is a little higher too
  const g = lanternGeometry(lantern());
  assert.ok(lanternLight(g, 0, -g.H / 2) !== lanternLight(lanternGeometry(lantern({}, 3, 'hole')), 0, -g.H / 2));
});
