import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildShellMesh, checkWatertight, flipUpsideDown } from '../js/core/mesh.js';
import { defaultSettings, defaultPhotoSettings, cubePhotoSlot, bodyAxes, collarDims } from '../js/core/settings.js';

function cube(edit = () => {}) {
  const s = defaultSettings();
  s.shape = 'cube'; s.reliefSide = 'inside'; // (outside detail presses into the faces)
  edit(s);
  const col = collarDims(s);
  return { s, col, shape: buildEllipsoidShape(bodyAxes(s), col.ro) };
}

test('cube body: flat faces where they should be, rounded edges, funnel underneath', () => {
  const { shape } = cube();
  const o = {};
  shape.surf(0, Math.PI, o);
  assert.ok(Math.abs(o.z - 50) < 1e-9, 'top face at +50');
  shape.surf(THETA_FRONT, Math.PI / 2, o);
  assert.ok(Math.abs(o.y + 50) < 1e-9 && Math.abs(o.ny + 1) < 1e-9, 'front face at -50, facing front');
  let upward = 0;
  for (let i = 0; i < 30000; i++) {
    shape.surf(Math.random() * 2 * Math.PI, 0.02 + Math.random() * 3.1, o);
    assert.ok(o.nx * o.x + o.ny * o.y + o.nz * o.z > 0, 'normal faces out');
    // Printed upside down, anything facing up now faces down; only the top face and its
    // rounded edge may do that (they sit on, or right next to, the print bed)
    if (o.nz > 0.71) { upward++; assert.ok(o.z > 50 - 5 - 1e-6, `upward-facing spot below the top edge (z ${o.z})`); }
    // The funnel's sides slope at 45°; its rounded corners are a little flatter, as in any square
    // funnel (the corner edges of a 45° pyramid run at 35°). Nothing on the underside is flatter
    // than that, apart from the small flat bottom around the opening: no flat ceilings to print.
    // Allowed exception: right where the funnel starts, about 1 mm of each of the cube's four
    // rounded bottom corners shows past it (patches of 1-2 mm, surrounded by printed plastic).
    const cTop = -(50 - 5 + 5 / Math.SQRT2);
    const cornerPatch = Math.abs(o.x) > 44 && Math.abs(o.y) > 44 && o.z > cTop - 1.5;
    if (o.nz < -0.71 && o.z > shape.funnelBottom + 1e-6 && !cornerPatch) {
      assert.ok(o.nz > -0.8166, `underside flatter than a 45° funnel corner at ${o.x.toFixed(1)},${o.y.toFixed(1)},${o.z.toFixed(1)} (nz ${o.nz})`);
      if (Math.abs(Math.abs(o.x) - Math.abs(o.y)) > 2 * 5) assert.ok(o.nz > -0.7072, `funnel side flatter than 45° (nz ${o.nz})`);
    }
  }
  assert.ok(upward > 0);
});

test('cube shell is watertight and is turned top-face-down for printing', () => {
  const { s, col, shape } = cube();
  const field = createField(s, shape, null);
  const mesh = buildShellMesh({ shape, field, stepInner: 3, stepOuter: 3, collar: col });
  const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
  assert.ok(wt.ok, `bad edges ${wt.badEdges}`);
  const height = mesh.bbox.max[2] - mesh.bbox.min[2];
  const volBefore = mesh.volume;
  flipUpsideDown(mesh);
  assert.ok(Math.abs(mesh.bbox.min[2]) < 1e-6, 'sits on z = 0');
  assert.ok(Math.abs(mesh.bbox.max[2] - mesh.bbox.min[2] - height) < 1e-6, 'same height');
  assert.ok(Math.abs(mesh.bbox.max[0] - mesh.bbox.min[0] - 100) < 0.01, '100 mm wide');
  // the old top face is now flat on the bed
  let onBed = 0;
  for (let i = 2; i < mesh.positions.length; i += 3) if (mesh.positions[i] < 1e-6) onBed++;
  assert.ok(onBed > 50, `flat top face on the bed (${onBed} points)`);
  assert.equal(checkWatertight(mesh.indices, mesh.positions.length / 3).ok, true, 'still closed after turning');
  assert.equal(mesh.volume, volBefore);
});

test('straight-on photos fill a cube face without distortion', () => {
  const { s, shape } = cube((st) => { st.evenGlow.on = false; });
  const w = 200, h = 200, data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = x / (w - 1); // dark left .. bright right
  s.photos = [{ ...defaultPhotoSettings(), ...cubePhotoSlot(0, s, shape), id: 'f', feather: 0.01, sharpen: 0 }];
  const field = createField(s, shape, { f: { w, h, data } });
  const W = (s.photos[0].coverage / 360) * shape.eqPerimeter;
  const o = {};
  for (const xmm of [-30, -10, 0, 20, 35]) {
    const theta = Math.atan2(-50, xmm);
    // find the point on the front face at height 0 and x = xmm
    const phi = Math.PI / 2;
    shape.surf(theta, phi, o);
    field.eval(theta, (phi - shape.phiEdge(theta)) / (Math.PI - shape.phiEdge(theta)), o);
    const want = 0.5 + xmm / W; // brightness should follow the face position exactly
    const got = 1 - (o.t - s.tMin) / (s.tMax - s.tMin);
    assert.ok(Math.abs(got - want) < 0.02, `x ${xmm}: brightness ${got.toFixed(3)} vs ${want.toFixed(3)}`);
  }
});

test('cube photo slots: five faces, each filling its face minus the border', () => {
  const { s, shape } = cube();
  const slots = [0, 1, 2, 3, 4].map((n) => cubePhotoSlot(n, s, shape));
  assert.deepEqual(slots.map((x) => x.around), [0, 180, -90, 90, 0]);
  assert.ok(Math.abs(slots[4].centerY - shape.elev(1)) < 0.1, 'top photo at the top');
  for (const sl of slots) {
    assert.equal(sl.projection, 'planar');
    const widthMm = (sl.coverage / 360) * shape.eqPerimeter;
    assert.ok(widthMm > 85 && widthMm < 90, `window ${widthMm.toFixed(1)} mm on a 100 mm face with a 5 mm border`);
  }
});

test('even glow thins the dim top of the walls, thickens the bright bottom, never past the limits', () => {
  const off = cube((s) => { s.evenGlow.on = false; });
  const on = cube((s) => { s.evenGlow.on = true; s.evenGlow.strength = 1; });
  const fOff = createField(off.s, off.shape, null), fOn = createField(on.s, on.shape, null);
  const atZ = (field, shape, z) => {
    // front face, x = 0, at height z
    let lo = 0.05, hi = 0.999; const o = {};
    for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; shape.surf(THETA_FRONT, shape.phiAt(THETA_FRONT, m), o); if (o.z < z) lo = m; else hi = m; }
    field.eval(THETA_FRONT, (lo + hi) / 2, o);
    return o;
  };
  const plain = off.s.tMin + (1 - off.s.photo.surround) * (off.s.tMax - off.s.tMin);
  assert.ok(Math.abs(atZ(fOff, off.shape, 40).t - plain) < 1e-6, 'off: plain everywhere');
  const top = atZ(fOn, on.shape, 40), mid = atZ(fOn, on.shape, 0), low = atZ(fOn, on.shape, -40);
  assert.ok(top.t < plain - 0.2, `top of wall thinner (${top.t})`);
  assert.ok(Math.abs(mid.t - plain) < 0.05, `middle of the face about unchanged (${mid.t})`);
  assert.ok(low.t > plain + 0.2, `bottom of wall thicker (${low.t})`);
  assert.ok(top.light < 1 && low.light > 1, 'light reported for the preview');
  const o = {};
  for (let i = 0; i < 3000; i++) {
    fOn.eval(Math.random() * 2 * Math.PI, Math.random(), o);
    assert.ok(o.t >= on.s.tMin - 1e-9 && o.t <= on.s.tMax + 0.4 + 1e-9, `t ${o.t} within limits`);
  }
  // balls report no light value (the preview keeps its simple fade there)
  const s = defaultSettings();
  const ball = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  createField(s, ball, null).eval(1, 0.5, o);
  assert.equal(o.light, null);
});
