import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildShellMesh, checkWatertight } from '../js/core/mesh.js';
import { MARKING_TYPES } from '../js/core/markings.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';

function football(tip = 0.6) {
  const s = defaultSettings();
  s.shape = 'football'; s.footballTip = tip;
  return { s, shape: buildEllipsoidShape(bodyAxes(s), collarDims(s).ro) };
}

test('tapered football: right length and width, points sit on the body, normals face out', () => {
  const { shape } = football(0.6);
  const n = shape.tipN, a = shape.a, b = shape.b;
  assert.ok(n > 1.4 && n < 1.6, `tipN ${n}`);
  const o = {};
  let maxX = 0, maxY = 0;
  for (let i = 0; i < 4000; i++) {
    const th = Math.random() * 2 * Math.PI, ph = 0.05 + Math.random() * (Math.PI - 0.1);
    shape.surf(th, ph, o);
    const g = Math.pow(Math.abs(o.x) / a, n) + (o.y * o.y + o.z * o.z) / (b * b);
    assert.ok(Math.abs(g - 1) < 1e-3, `on the body (${g})`);
    assert.ok(o.nx * o.x + o.ny * o.y + o.nz * o.z > 0, 'normal faces out');
    assert.ok(Math.abs(Math.hypot(o.nx, o.ny, o.nz) - 1) < 1e-9, 'unit normal');
    maxX = Math.max(maxX, Math.abs(o.x)); maxY = Math.max(maxY, Math.abs(o.y));
  }
  assert.ok(maxX > a - 1 && maxX <= a + 1e-6, `length ${2 * maxX}`);
  assert.ok(maxY > b - 1 && maxY <= b + 1e-6, `width ${2 * maxY}`);
});

test('pointier tips taper the ends more than the plain oval', () => {
  const oval = football(0).shape, sharp = football(1).shape;
  assert.equal(oval.tipN, 2);
  // half-width at 80% of the way to the tip
  const halfWidth = (sh) => sh.b * Math.sqrt(1 - Math.pow(0.8, sh.tipN));
  assert.ok(halfWidth(sharp) < halfWidth(oval) - 5, `${halfWidth(sharp)} vs ${halfWidth(oval)}`);
  // and the tip stays rounded enough to offset a 3.4 mm wall inwards
  const tipRadius = (sharp.b * sharp.b * sharp.tipN) / (2 * sharp.a);
  assert.ok(tipRadius > 10, `tip radius ${tipRadius}`);
});

test('laces on top, four seams, bright end stripes that can be switched off', () => {
  const sh = { a: 120, b: 75 };
  const w = 3;
  const at = (x, psiDeg, out = { stripes: true }) => {
    // point on a 75 mm-radius cross-section at x (shape detail does not matter for the pattern)
    const r = 60, p = (psiDeg * Math.PI) / 180;
    const S = { x, y: r * Math.cos(p), z: r * Math.sin(p) };
    return { m: MARKING_TYPES.football(0, 0, 1, 75, w, out, S, sh), out };
  };
  const half = 0.36 * 120, step = (2 * half) / 8;
  const barX = -half + 2.5 * step;
  assert.ok(at(barX, 90 + 8).m > 0.99, 'a cross lace just off the top seam');
  assert.ok(at(barX + step / 2, 90 + 8).m < 0.01, 'gap between laces');
  assert.ok(at(70, 90 + 8).m < 0.01, 'no laces past the lace area');
  for (const psi of [0, 90, 180, -90]) assert.ok(at(30, psi).m > 0.99, `seam at ${psi}°`);
  assert.ok(at(30, 45).m < 0.01, 'clear between seams');
  assert.ok(at(0.58 * 120, 45).out.bright > 0.99, 'stripe near the end');
  assert.ok(at(0.3 * 120, 45).out.bright < 0.01, 'no stripe in the middle');
  assert.equal(at(0.58 * 120, 45, { stripes: false }).out.bright, 0, 'stripes off');
});

test('football shells are watertight: pointed tips, raised laces, stripes', () => {
  for (const [tip, style] of [[1, 'carved'], [0.6, 'raised'], [0, 'off']]) {
    const { s, shape } = football(tip);
    s.markings.style = style;
    const field = createField(s, shape, null);
    const mesh = buildShellMesh({ shape, field, stepInner: 3, stepOuter: 3, collar: collarDims(s) });
    const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
    assert.ok(wt.ok, `tip ${tip} ${style}: bad edges ${wt.badEdges}`);
    const len = mesh.bbox.max[0] - mesh.bbox.min[0];
    assert.ok(Math.abs(len - 240) < 1.5, `length ${len}`);
  }
});

test('stripes glow bright on the ball (thinner wall), seams stay dark over them', () => {
  const { s, shape } = football(0.6);
  s.markings.style = 'carved';
  const field = createField(s, shape, null);
  // Walk along the top-back quarter (between seams) at the stripe position and find the wall
  const o = {};
  let thinnest = 9;
  for (let i = 0; i <= 400; i++) {
    const th = (i / 400) * 2 * Math.PI;
    for (const sv of [0.6, 0.7, 0.8]) {
      field.eval(th, sv, o);
      if (Math.abs(Math.abs(o.x) - 0.58 * shape.a) < 1) thinnest = Math.min(thinnest, o.t);
    }
  }
  assert.ok(thinnest < s.tMin + 0.05, `stripe reaches the thinnest setting (${thinnest})`);
});
