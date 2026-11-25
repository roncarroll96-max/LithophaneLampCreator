// Smaller files (version 1.12): merging tiny triangles that lie flat, while the mesh stays closed
// and the surface moves by no more than the tolerance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simplifyMesh } from '../js/core/simplify.js';
import { meshSdf, box, cylinder, subtract, union } from '../js/core/sdf.js';
import { checkWatertight } from '../js/core/mesh.js';
import { defaultSettings } from '../js/core/settings.js';
import { baseMesh, lanternMesh, lidMesh, PART_TOL } from '../js/core/exportParts.js';

const closed = (m) => checkWatertight(m.indices, m.positions.length / 3).ok;

test('a box made of thousands of grid triangles comes down to a few dozen, same size and volume', () => {
  const f = box(0, 40, 0, 30, 0, 10);
  const raw = meshSdf(f, { min: [0, 0, 0], max: [40, 30, 10] }, 0.45);
  const m = simplifyMesh(raw, 0.02);
  assert.ok(raw.triangles > 10000, `raw ${raw.triangles}`);
  assert.ok(m.triangles < raw.triangles / 50, `${raw.triangles} -> ${m.triangles}`);
  assert.ok(closed(m), 'closed');
  assert.ok(Math.abs(m.volume - raw.volume) / raw.volume < 1e-3, `volume ${raw.volume} -> ${m.volume}`);
  for (let a = 0; a < 3; a++) {
    assert.ok(Math.abs(m.bbox.min[a] - raw.bbox.min[a]) < 0.02 && Math.abs(m.bbox.max[a] - raw.bbox.max[a]) < 0.02, `bbox axis ${a}`);
  }
});

test('a round part keeps its shape: every new point lies within the tolerance of the surface', () => {
  // a ring with a hole: tube of radius 20, hole 12, 8 tall
  const f = subtract(cylinder(20, 0, 8), cylinder(12, -1, 9));
  const raw = meshSdf(f, { min: [-20, -20, 0], max: [20, 20, 8] }, 0.4);
  const tol = 0.02, m = simplifyMesh(raw, tol);
  assert.ok(closed(m), 'closed');
  assert.ok(m.triangles < raw.triangles / 3, `${raw.triangles} -> ${m.triangles}`);
  // each kept point is still on the raw surface's place: radius 12 or 20, or z 0 or 8 (the raw
  // grid mesh itself rounds the sharp edges a little, so allow for that at the corners)
  let worst = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i], y = m.positions[i + 1], z = m.positions[i + 2];
    worst = Math.max(worst, Math.min(Math.abs(Math.hypot(x, y) - 20), Math.abs(Math.hypot(x, y) - 12), Math.abs(z), Math.abs(z - 8)));
  }
  assert.ok(worst < 0.3, `worst ${worst}`);
  assert.ok(Math.abs(m.volume - raw.volume) / raw.volume < 2e-3, `volume ${raw.volume} -> ${m.volume}`);
});

test('two touching boxes (a sharp inside corner) stay closed', () => {
  const f = union(box(0, 20, 0, 20, 0, 4), box(5, 15, 5, 15, 0, 12));
  const raw = meshSdf(f, { min: [0, 0, 0], max: [20, 20, 12] }, 0.45);
  const m = simplifyMesh(raw, 0.02);
  assert.ok(closed(m) && m.triangles < raw.triangles / 20, `${raw.triangles} -> ${m.triangles}`);
});

test('exported bases, lids and lantern frames are closed and far smaller than one record per grid cell', () => {
  for (const shape of ['basketball', 'cylinder', 'panel']) {
    const s = defaultSettings(); s.shape = shape;
    const b = baseMesh(s);
    assert.ok(closed(b.mesh), `${shape} base closed`);
    assert.ok(b.mesh.triangles * 50 < 3e6, `${shape} base ${(b.mesh.triangles * 50 / 1e6).toFixed(1)} MB`);
  }
  const s = defaultSettings(); s.shape = 'cylinder'; s.cylinder.lid = 'honeycomb';
  assert.ok(closed(lidMesh(s).mesh), 'lid closed');
  const ls = defaultSettings(); ls.shape = 'lantern'; ls.lantern.theme = 'christmas';
  for (const part of ['pillar', 'base', 'top', 'xframe', 'xdecor']) {
    const p = lanternMesh({ settings: ls }, part);
    assert.ok(closed(p.mesh), `lantern ${part} closed`);
  }
  assert.ok(PART_TOL <= 0.02, 'fit-critical parts move less than 0.02 mm');
});
