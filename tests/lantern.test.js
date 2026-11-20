// Lantern (feature 12c, version 1.4): four panels in a frame of pillars, a base and a top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../js/core/settings.js';
import {
  lanternGeometry, lanternPart, pillarSdf, baseSdf, topSdf, buildLanternStrip, createLanternField,
  lanternSidePanel, lanternFrameMesh, lanternLight, sideCenterU, sideOf,
} from '../js/core/lantern.js';
import { meshSdf } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';
import { buildPanelMesh } from '../js/core/panelMesh.js';

function lantern(edit = {}, tMax = 3) {
  const s = defaultSettings();
  s.shape = 'lantern'; s.tMax = tMax;
  Object.assign(s.lantern, edit);
  return s;
}
const ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** A point given in front-side terms (x along the panel, d out from the middle), on side k. */
function onSide(k, x, d, z) { const [c, s] = ROT[k]; return [x * c - (-d) * s, x * s + (-d) * c, z]; }
/** The pillar placed at corner k (lantern coordinates). */
function placedPillar(geo, k) {
  const f = pillarSdf(geo), [c, s] = ROT[k];
  const X = geo.c * (c + s), Y = geo.c * (s - c);
  return (x, y, z) => { const px = x - X, py = y - Y; return f(px * c + py * s, -px * s + py * c, z - geo.hB); };
}
const topPlaced = (geo) => { const f = topSdf(geo); return (x, y, z) => f(x, y, z - geo.zT); };

function photo(w = 120, h = 160, v = 0.2) {
  const data = new Float32Array(w * h).fill(v);
  return { w, h, data };
}

test('lantern sizes: the slots hold the panels about 6 mm deep, and the pillar stays in one piece', () => {
  const g = lanternGeometry(lantern());
  assert.ok(Math.abs(g.W - 101.6) < 1e-9 && Math.abs(g.H - 152.4) < 1e-9, '4x6 in portrait to start');
  assert.ok(Math.abs(g.insert - 6.2) < 0.01, `insert ${g.insert}`);
  for (const P of [14, 16, 20, 24]) for (const tMax of [2, 3, 5]) for (const slotFit of [0.1, 0.4, 1.2]) {
    const q = lanternGeometry(lantern({ pillar: P, slotFit }, tMax));
    assert.ok(q.o >= 0, 'slot inside the pillar');
    assert.ok(q.insert >= 4 - 1e-9, `P ${P} tMax ${tMax}: insert ${q.insert}`);
    // the two slots stop short of each other (the pillar's corner holds it together)
    assert.ok(q.xe < q.o - q.sw / 2 - 2, 'bridge between the slots');
    // the peg stays clear of both slots
    assert.ok(q.peg.x0 > q.xe + 0.5 && -q.peg.y1 > q.xe + 0.5, `peg clear of slots (P ${P})`);
  }
});

test('the panels fit: room all round in the slots and grooves, held in front by the pillars', () => {
  for (const top of ['classic', 'pagoda', 'lid']) for (const edit of [{}, { size: '5x7', orient: 'landscape' }, { outline: 'square', size: '4', pillar: 20 }]) {
    const s = lantern({ ...edit, top, topH: top === 'pagoda' ? 60 : 32 });
    const g = lanternGeometry(s);
    const parts = [baseSdf(g), topPlaced(g), ...[0, 1, 2, 3].map((k) => placedPillar(g, k))];
    const frame = (p) => Math.min(...parts.map((f) => f(...p)));
    for (let k = 0; k < 4; k++) {
      // Every bit of the panel (W x T x H slab) is clear of the frame
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) for (const d of [g.Dm - g.T / 2 + 0.02, g.Dm, g.Dm + g.T / 2 - 0.02]) {
        const x = -g.W / 2 + (g.W * i) / 40, z = g.zG + 0.02 + ((g.H - 0.04) * j) / 40;
        const p = onSide(k, x, d, z);
        assert.ok(frame(p) > 0, `${top} ${JSON.stringify(edit)} side ${k}: panel point ${p.map((v) => v.toFixed(1))} inside the frame`);
      }
      // Held in front: just outside the panel's face near its edges there is pillar
      for (const x of [-g.W / 2 + 1.5, g.W / 2 - 1.5]) {
        const p = onSide(k, x, g.Dm + g.T / 2 + 1, g.zG + g.H / 2);
        assert.ok(frame(p) < 0, 'a pillar lip in front of the panel edge');
      }
      // Held at the bottom and top: the base groove floor and the top's groove roof
      assert.ok(frame(onSide(k, 0, g.Dm, g.zG - 0.5)) < 0, 'groove floor under the panel');
      assert.ok(frame(onSide(k, 0, g.Dm, g.zG + g.H + 1.5)) < 0, 'top groove above the panel');
    }
  }
});

test('the pegs fit their holes: snug, with the fit room all round', () => {
  const s = lantern();
  const g = lanternGeometry(s), f = g.pegFit, pg = g.peg;
  const pillar = placedPillar(g, 0), base = baseSdf(g), top = topPlaced(g);
  const X = g.c, Y = -g.c; // the front-right corner (pillar coordinates = lantern minus this)
  const inPeg = (z0, z1, grow) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) for (const z of [z0, (z0 + z1) / 2, z1]) {
      pts.push([X + pg.x0 - grow + ((pg.x1 - pg.x0 + 2 * grow) * i) / 8, Y + pg.y0 - grow + ((pg.y1 - pg.y0 + 2 * grow) * j) / 8, z]);
    }
    return pts;
  };
  // The base's peg goes up into the pillar's foot without touching it; the pillar's peg into the top
  for (const p of inPeg(g.hB + 0.6, g.hB + pg.len - 0.6, -0.6)) { assert.ok(base(...p) < 0); assert.ok(pillar(...p) > 0, 'base peg clear of the pillar'); }
  for (const p of inPeg(g.zT + 0.6, g.zT + pg.len - 0.6, -0.6)) { assert.ok(pillar(...p) < 0); assert.ok(top(...p) > 0, 'pillar peg clear of the top'); }
  // ...and the hole is only `fit` bigger: just past it there is plastic
  for (const p of inPeg(g.hB + 2, g.hB + 4, f + 0.15)) {
    const onEdge = Math.abs(p[0] - X - (pg.x0 - f - 0.15)) < 1e-9 || Math.abs(p[0] - X - (pg.x1 + f + 0.15)) < 1e-9
      || Math.abs(p[1] - Y - (pg.y0 - f - 0.15)) < 1e-9 || Math.abs(p[1] - Y - (pg.y1 + f + 0.15)) < 1e-9;
    if (onEdge) assert.ok(pillar(...p) < 0, 'snug hole');
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
  for (const [top, topH] of [['classic', 32], ['pagoda', 60], ['lid', 14]]) {
    const s = lantern({ top, topH });
    const g = lanternGeometry(s);
    for (const part of top === 'classic' ? ['pillar', 'base', 'top'] : ['top']) {
      const p = lanternPart(s, part);
      const m = meshSdf(p.sdf, p.bounds, 0.5);
      const wt = checkWatertight(m.indices, m.positions.length / 3);
      assert.ok(wt.ok, `${top} ${part}: bad edges ${wt.badEdges}`);
      assert.ok(Math.abs(m.bbox.min[2]) < 0.3, `${top} ${part} sits on the bed`);
      // Allowed: the ceilings of the peg holes, grooves, cable notch and vents (short bridges)
      const limit = part === 'pillar' ? g.peg.len + 1.5 : part === 'base' ? g.cableH + 1 : top === 'pagoda' ? g.top.hF - 1.5 : g.peg.len + 1.5;
      const a = overhangArea(m, limit);
      assert.ok(a < 200, `${top} ${part}: ${a.toFixed(0)} mm² of overhang above z ${limit}`);
    }
  }
  // A pillar too tall for the printer lies down, still without supports
  const tall = lantern({ size: '8x10' }); tall.bed.z = 200;
  const p = lanternPart(tall, 'pillar');
  assert.ok(p.size[2] < 30 && p.size[1] > 200, 'lies down');
  const m = meshSdf(p.sdf, p.bounds, 0.5);
  assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok);
  assert.ok(overhangArea(m, 8) < 50, 'only the slot and peg-hole bridges');
});

test('the preview frame is the parts put together', () => {
  const s = lantern();
  const g = lanternGeometry(s);
  const fm = lanternFrameMesh(s, meshSdf, 2);
  let zMin = Infinity, zMax = -Infinity, xMax = -Infinity;
  for (let i = 0; i < fm.positions.length; i += 3) {
    zMin = Math.min(zMin, fm.positions[i + 2]); zMax = Math.max(zMax, fm.positions[i + 2]); xMax = Math.max(xMax, fm.positions[i]);
  }
  assert.ok(Math.abs(zMin) < 1.5, 'on the table');
  assert.ok(Math.abs(zMax - g.totalHeight) < 1.5, `top at ${zMax} vs ${g.totalHeight}`);
  assert.ok(Math.abs(xMax - (g.half + g.top.ov)) < 2, 'beams reach out by the overhang');
  assert.equal(fm.info.seatFloor, g.zG);
});

test('the strip folds round the four sides, each photo fills its own side, and panels export closed', () => {
  const s = lantern();
  s.photos = [{ id: 'a', side: 0 }, { id: 'b', side: 2 }];
  const strip = buildLanternStrip(s);
  const g = strip.geo;
  const field = createLanternField(s, strip, { a: photo(120, 160, 0), b: photo(120, 160, 1) });
  const o = {};
  for (let k = 0; k < 4; k++) {
    const u = sideCenterU(g.W, k);
    assert.equal(sideOf(g.W, u), k);
    field.evalUV(u, 0, o);
    // The panel's outer face is Dout from the middle, on side k, facing out
    const [ex, ey] = onSide(k, 0, g.Dout, 0);
    assert.ok(Math.hypot(o.sx - ex, o.sy - ey) < 1e-6, `side ${k} position`);
    assert.ok(Math.hypot(o.ix, o.iy) < Math.hypot(o.sx, o.sy), 'back faces in');
    if (k === 0) assert.equal(o.photoId, 'a');
    if (k === 2) assert.equal(o.photoId, 'b');
    if (k === 1 || k === 3) assert.equal(o.photoId, null);
  }
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
  const g3 = lanternGeometry(lantern({ top: 'lid', topH: 5 }));
  assert.ok(g3.top.hRing >= g3.top.hF);
});
