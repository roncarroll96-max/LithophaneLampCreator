// Christmas lantern (feature 12d, version 1.7): Christmas roofs, a topper and trim pieces to glue on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from '../js/core/settings.js';
import { lanternGeometry, lanternPart, topSdf, pillarSdf, baseSdf } from '../js/core/lantern.js';
import { trimPieces, trimPart, trimPartList, trimPreviewMesh, TH, TT } from '../js/core/christmas.js';
import { partList } from '../js/core/exportParts.js';
import { meshSdf } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';

function xmas(edit = {}) {
  const s = defaultSettings();
  s.shape = 'lantern'; s.tMax = 3;
  Object.assign(s.lantern, { theme: 'christmas', ...edit });
  return s;
}
/** How many separate pieces a mesh is (joined where triangles share corners). */
function pieces(m) {
  const nv = m.positions.length / 3, par = new Int32Array(nv).map((_, i) => i);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  const I = m.indices;
  for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); par[find(I[t + 1])] = a; par[find(I[t + 2])] = a; }
  const roots = new Set();
  for (let t = 0; t < I.length; t++) roots.add(find(I[t]));
  return roots.size;
}
/** Downward-facing area above height zAbove (things that would need supports). */
function overhangArea(m, zAbove, steep = -0.75) {
  const p = m.positions, I = m.indices;
  let area = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, L = Math.hypot(nx, ny, nz);
    if (L && nz / L < steep && (p[a + 2] + p[b + 2] + p[c + 2]) / 3 > zAbove) area += L / 2;
  }
  return area;
}

test('the Christmas theme: settings, roofs and the choices', () => {
  const plain = lanternGeometry(xmas({ theme: 'plain' }));
  assert.equal(plain.theme, 'plain'); assert.equal(plain.xmas, null);
  assert.deepEqual(trimPieces(xmas({ theme: 'plain' })), [], 'a plain lantern has no trim');
  const d = defaultSettings().lantern;
  assert.equal(d.theme, 'plain'); assert.equal(d.trimCover, 12);
  const g = lanternGeometry(xmas());
  assert.equal(g.top.style, 'low');
  assert.deepEqual(g.xmas, { roof: 'low', topper: 'ring', decor: 'snow', cover: 12 });
  assert.ok(Math.abs(Math.atan(g.top.k) - Math.PI / 6) < 0.01, 'the low roof is 30 degrees');
  assert.equal(lanternGeometry(xmas({ xRoof: 'tiered' })).top.style, 'tiered');
  // A wide lantern gets a slightly steeper roof, so the flat ceiling inside stays a short bridge
  const big = lanternGeometry(xmas({ sides: 6, overhang: 3 }));
  assert.ok(big.top.k > g.top.k && big.top.rc <= 15.01, `pitch ${big.top.k}, ceiling ${big.top.rc}`);
});

test('the Christmas roofs are closed and print without supports', () => {
  for (const [n, roof, overhang] of [[4, 'low', 12], [3, 'low', 30], [6, 'low', 3], [4, 'tiered', 12], [3, 'tiered', 3], [5, 'tiered', 30]]) {
    const s = xmas({ sides: n, xRoof: roof, overhang });
    const g = lanternGeometry(s), p = lanternPart(s, 'top');
    const m = meshSdf(p.sdf, p.bounds, 0.5);
    const tag = `${n} sides ${roof} eaves ${overhang}`;
    assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${tag}: closed`);
    assert.ok(Math.abs(m.bbox.min[2]) < 0.3, `${tag}: on the bed`);
    // only the short flat ceiling inside (a bridge) and the grooves' and peg holes' roofs face down
    const ceiling = (2 * g.top.rc) ** 2 * 1.2;
    // (-0.88: the 45 degree faces come out of the mesh a little steeper; a real overhang is flat)
    const a = overhangArea(m, g.peg.len + 1.5, -0.88);
    assert.ok(a < ceiling + 250, `${tag}: ${a.toFixed(0)} mm² facing down (ceiling allowance ${ceiling.toFixed(0)})`);
    // the socket for the topper is open at the peak, and solid round it
    assert.ok(topSdf(g)(0, 0, g.top.height - 1) > 0, `${tag}: socket open`);
    assert.ok(topSdf(g)(g.top.socketW / 2 + 1.5, 0, g.top.height - 3) < 0, `${tag}: plastic round the socket`);
  }
});

test('every trim piece is one closed piece, for every number of sides and design', () => {
  const combos = [[4, 'snow', 'low', 'ring'], [4, 'holly', 'tiered', 'star'], [3, 'snow', 'tiered', 'star'], [5, 'holly', 'low', 'ring'],
    [6, 'snow', 'low', 'star'], [6, 'holly', 'tiered', 'ring']];
  for (const [n, decor, xRoof, topper] of combos) {
    const s = xmas({ sides: n, decor, xRoof, topper });
    const list = trimPartList(s);
    assert.ok(list.some(([k]) => k === 'xlattice') === (decor === 'holly' && xRoof === 'tiered'), 'lattice strips only with holly on the two-tier roof');
    for (const [key] of list) {
      const p = trimPart(s, key);
      const m = meshSdf(p.sdf, p.bounds, 0.3);
      const tag = `${n} sides ${decor} ${xRoof} ${key}`;
      assert.ok(checkWatertight(m.indices, m.positions.length / 3).ok, `${tag}: closed`);
      assert.ok(Math.abs(m.bbox.min[2]) < 0.2 && m.bbox.max[2] - m.bbox.min[2] <= (key === 'xtopper' ? TT : TH) + 0.2, `${tag}: flat on the bed`);
      const expect = key === 'xdecor' ? trimPieces(s).filter((q) => q.small).reduce((k, q) => k + q.copies, 0) : 1;
      assert.equal(pieces(m), expect, `${tag}: every piece in one part`);
    }
  }
});

test('the trim fits its places on the lantern', () => {
  for (const n of [3, 4, 6]) for (const [decor, xRoof] of [['snow', 'low'], ['holly', 'tiered']]) {
    const s = xmas({ sides: n, decor, xRoof });
    const g = lanternGeometry(s), list = trimPieces(s), F = g.frames, ta = Math.tan(g.a / 2);
    const tag = `${n} sides ${decor}`;
    const frame = list.find((p) => p.key === 'xframe'), base = list.find((p) => p.key === 'xbase');
    assert.equal(frame.copies, n); assert.equal(frame.places.length, n);
    // The side frame: between the corners, above the base and below the top (so the top lifts off)
    const [u0, u1, v0, v1] = frame.box, z0 = frame.places[0].origin[2];
    assert.ok(u1 <= g.half * ta && u0 >= -g.half * ta, `${tag}: frame within the side`);
    assert.ok(z0 >= g.hB && z0 + v1 <= g.zT - 0.3, `${tag}: frame from the base's top to just under the roof`);
    // ...glued onto the pillars: right behind its side bands there is pillar
    const pillar = pillarSdf(g), behind = (u, z) => {
      const x = F[0].tx * u + F[0].nx * (g.half - 0.4), y = F[0].ty * u + F[0].ny * (g.half - 0.4);
      return pillar(x - g.Q[0], y - g.Q[1], z - g.hB);
    };
    assert.ok(behind(u1 - 3, g.hB + 40) < 0, `${tag}: pillar behind the frame's side band`);
    // ...and it covers the picture's edge by the chosen amount
    const opening = frame.d2(0, (v0 + v1) / 2);
    assert.ok(opening > 0, 'the middle is open');
    // The base strip sits between the feet, below the base's top
    const [b0, b1, , bv1] = base.box, bz = base.places[0].origin[2];
    assert.ok(bz + bv1 <= g.hB && bz >= 1, `${tag}: base strip on the base's wall`);
    const bs = baseSdf(g), wallBehind = (u) => bs(F[0].tx * u + F[0].nx * (g.half - 0.4), F[0].ty * u + F[0].ny * (g.half - 0.4), bz + bv1 / 2);
    assert.ok(wallBehind(b0 + 1) < 0 && wallBehind(b1 - 1) < 0, `${tag}: base wall behind the strip's ends`);
    assert.ok(bs(F[0].tx * (b1 - 0.1) + F[0].nx * (g.half + 1), F[0].ty * (b1 - 0.1) + F[0].ny * (g.half + 1), bz + bv1 / 2) > 0, `${tag}: clear of the feet`);
    // Roof decorations lie on the roof (just under each one there is roof) and inside its face
    const top = topSdf(g);
    for (const p of list.filter((q) => q.small)) for (const pl of p.places) {
      const o = pl.origin, under = [o[0] - pl.ez[0] * 0.5, o[1] - pl.ez[1] * 0.5, o[2] - pl.ez[2] * 0.5 - g.zT];
      assert.ok(top(...under) < 0, `${tag}: ${p.name} on the roof`);
      const over = [o[0] + pl.ez[0] * 0.6, o[1] + pl.ez[1] * 0.6, o[2] + pl.ez[2] * 0.6 - g.zT];
      assert.ok(top(...over) > 0, `${tag}: ${p.name} not sunk into the roof`);
    }
    // The topper's tab fits the socket
    const tp = list.find((p) => p.key === 'xtopper');
    assert.ok(tp.thick <= g.top.socketT - 0.3, 'tab thinner than the socket');
    assert.ok(tp.d2(0, 1) < 0 && tp.d2(g.top.socketW / 2 - 0.1, 1) > 0, 'tab narrower than the socket');
  }
});

test('the preview shows the trim, and the 3MF has it as separate parts', () => {
  const s = xmas({ sides: 4 });
  const m = trimPreviewMesh(s, meshSdf);
  assert.ok(m.indices.length > 1000);
  let zMax = -Infinity;
  for (let i = 2; i < m.positions.length; i += 3) zMax = Math.max(zMax, m.positions[i]);
  const g = lanternGeometry(s);
  assert.ok(zMax > g.totalHeight && zMax < g.totalHeight + 40, 'the topper stands on the peak');
  const names = partList({ settings: s }).map((p) => [p.name, p.copies]);
  for (const want of [['Trim: Side frame', 4], ['Trim: Base trim', 4], ['Trim: Snowflakes', 1], ['Trim: Ring', 1]]) {
    assert.ok(names.some(([nm, c]) => nm === want[0] && c === want[1]), `3MF has ${want[0]} x${want[1]}: ${JSON.stringify(names)}`);
  }
  assert.ok(names.some(([nm]) => nm.startsWith('Top (Low roof')));
});
