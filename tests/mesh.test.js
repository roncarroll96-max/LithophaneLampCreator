import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildShellMesh, checkWatertight, estimateTriangles } from '../js/core/mesh.js';
import { writeBinarySTL } from '../js/core/stl.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';

function fakePhoto(w = 200, h = 150) {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    data[y * w + x] = ((Math.floor(x / 20) + Math.floor(y / 20)) % 2) * 0.8 + 0.1 * (x / w);
  }
  return { w, h, data };
}

function build(settings, step = 2, photo = fakePhoto()) {
  const col = collarDims(settings);
  const shape = buildEllipsoidShape(bodyAxes(settings), col.ro);
  const field = createField(settings, shape, photo);
  const mesh = buildShellMesh({ shape, field, stepInner: step, stepOuter: step * 2, collar: col });
  return { shape, field, mesh };
}

test('sphere shape: opening edge sits on the collar radius and arcs are sane', () => {
  const s = defaultSettings();
  const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const o = {};
  shape.surf(0.3, shape.phiAt(0.3, 0), o);
  assert.ok(Math.abs(Math.hypot(o.x, o.y) - 27) < 1e-3, 'edge on collar radius');
  const R = 75;
  assert.ok(Math.abs(shape.eqPerimeter - 2 * Math.PI * R) < 0.5, 'equator perimeter');
  assert.ok(Math.abs(shape.ringArc(THETA_FRONT + 0.5, shape.sEquator) - 0.5 * R) < 0.2, 'ring arc');
  assert.ok(Math.abs(shape.elev(1) - (Math.PI / 2) * R) < 0.5, 'elevation to pole');
});

for (const style of ['carved', 'raised', 'off']) {
  test(`basketball (${style}) shell is watertight, outward-facing, on the bed`, () => {
    const s = defaultSettings();
    s.markings.style = style;
    const { mesh } = build(s);
    const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
    assert.ok(wt.ok, `bad edges: ${wt.badEdges}`);
    const V = mesh.positions.length / 3, F = mesh.triangles, E = wt.edges;
    assert.equal(V - E + F, 2, 'Euler characteristic of a closed solid');
    assert.ok(Math.abs(mesh.bbox.min[2]) < 1e-4, 'collar bottom on z=0');
    const height = mesh.bbox.max[2];
    // collar replaces the ~5 mm bottom cap cut off by the opening, so height ≈ diameter (+ raised lines)
    assert.ok(height > 148 && height < 156, `height ${height}`);
    // shell volume ≈ area × average thickness (between tMin and tMax)
    const area = 4 * Math.PI * 75 * 75;
    assert.ok(mesh.volume > area * 0.8 && mesh.volume < area * 3.4, `volume ${mesh.volume}`);
  });
}

test('football (ellipsoid lying on its side) shell is watertight', () => {
  const s = defaultSettings();
  s.shape = 'football'; s.reliefSide = 'inside';
  s.markings.style = 'off';
  const { mesh } = build(s, 3);
  const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
  assert.ok(wt.ok, `bad edges: ${wt.badEdges}`);
  const dx = mesh.bbox.max[0] - mesh.bbox.min[0];
  assert.ok(Math.abs(dx - 240) < 1, `length ${dx}`);
});

test('wall thickness stays within the configured range', () => {
  const s = defaultSettings();
  const col = collarDims(s);
  const shape = buildEllipsoidShape(bodyAxes(s), col.ro);
  const field = createField(s, shape, fakePhoto());
  const o = {};
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 20000; i++) {
    field.eval(Math.random() * Math.PI * 2, Math.random(), o);
    lo = Math.min(lo, o.t); hi = Math.max(hi, o.t);
  }
  assert.ok(lo >= s.tMin - 1e-9, `min ${lo}`);
  assert.ok(hi <= s.tMax + 0.4 + 1e-9, `max ${hi}`);
});

test('STL writer produces the right byte size and triangle count', () => {
  const s = defaultSettings();
  const { mesh } = build(s, 4);
  const buf = writeBinarySTL(mesh.positions, mesh.indices);
  assert.equal(buf.byteLength, 84 + mesh.triangles * 50);
  assert.equal(new DataView(buf).getUint32(80, true), mesh.triangles);
});

test('triangle estimate is close to the real count', () => {
  const s = defaultSettings();
  const { shape, mesh } = build(s, 2);
  const est = estimateTriangles(shape, 2, 4);
  assert.ok(Math.abs(est - mesh.triangles) / mesh.triangles < 0.05, `est ${est} vs ${mesh.triangles}`);
});
