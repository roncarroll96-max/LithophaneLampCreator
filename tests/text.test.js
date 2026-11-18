import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildShellMesh, checkWatertight } from '../js/core/mesh.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';
import { defaultTextItem, sForUp, placementAt } from '../js/core/textLayer.js';

/**
 * A synthetic text mask (what js/text.js draws in the browser): `inLetters(x, y)` in mm
 * (x right, y up, from the text centre) decides letter pixels; the gap zone is everything
 * within `gap` mm of the mask's letter box.
 */
function makeMask(halfW, halfH, inLetters, gap = 1.5, mmPerPx = 0.25) {
  const pad = gap + 1;
  const w = Math.ceil((2 * (halfW + pad)) / mmPerPx), h = Math.ceil((2 * (halfH + pad)) / mmPerPx);
  const cx = w / 2, cy = h / 2;
  const letters = new Float32Array(w * h), halo = new Float32Array(w * h), clear = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i - cx) * mmPerPx, y = (cy - j) * mmPerPx;
    const k = j * w + i;
    letters[k] = inLetters(x, y) ? 1 : 0;
    halo[k] = Math.abs(x) <= halfW + 0.8 && Math.abs(y) <= halfH + 0.8 ? 1 : 0;
    clear[k] = Math.abs(x) <= halfW + gap && Math.abs(y) <= halfH + gap ? 1 : 0;
  }
  return { w, h, cx, cy, mmPerPx, letters, halo, clear };
}

function setup(itemProps, inLetters = () => true, markings = 'off') {
  const s = defaultSettings();
  s.markings.style = markings;
  s.markings.yaw = 0; s.markings.pitch = 0; s.markings.roll = 0; // basketball: a line runs round the equator
  const it = { ...defaultTextItem(), up: 0, ...itemProps };
  s.texts = [it];
  const col = collarDims(s);
  const shape = buildEllipsoidShape(bodyAxes(s), col.ro);
  const masks = { [it.id]: makeMask(10, 5, inLetters) };
  return { s, it, shape, col, masks, field: createField(s, shape, null, masks) };
}

// Point on the ball `dx` mm to the right and `dy` mm up from the front centre (on a 75 mm sphere)
function at(shape, dx, dy, field) {
  const theta = THETA_FRONT + dx / 75;
  const o = {};
  field.eval(theta, sForUp(shape, dy), o);
  return o;
}

test('carved, bright and raised text set the wall the way each style says', () => {
  for (const [style, check] of [
    ['carved', (o, s) => assert.ok(Math.abs(o.t - (s.tMax + 0.4)) < 1e-6, `carved t ${o.t}`)],
    ['bright', (o, s) => assert.ok(Math.abs(o.t - s.tMin) < 1e-6, `bright t ${o.t}`)],
    ['raised', (o) => assert.ok(Math.abs(o.raise - 1.0) < 1e-6, `raise ${o.raise}`)],
  ]) {
    const { s, shape, field } = setup({ style });
    check(at(shape, 0, 0, field), s);
  }
});

test('text is placed the right way round: right is right, up is up, seen from the front', () => {
  // letters only in the upper-right quarter of the text box
  const { s, shape, field } = setup({ style: 'carved' }, (x, y) => x > 1 && y > 1);
  const carved = s.tMax + 0.4;
  assert.ok(Math.abs(at(shape, 5, 2.5, field).t - carved) < 1e-6, 'upper right is letters');
  assert.ok(at(shape, -5, 2.5, field).t < carved - 0.5, 'upper left is not');
  assert.ok(at(shape, 5, -2.5, field).t < carved - 0.5, 'lower right is not');
});

test('rotate turns the text counter-clockwise seen from outside', () => {
  // letters only on the right; rotated 90° they should end up on top
  const { s, shape, field } = setup({ style: 'carved', rotate: 90 }, (x) => x > 2);
  const carved = s.tMax + 0.4;
  assert.ok(Math.abs(at(shape, 0, 4, field).t - carved) < 1e-6, 'right side turned to the top');
  assert.ok(at(shape, 0, -4, field).t < carved - 0.5, 'bottom stays clear');
});

test('basketball lines stop around text but not elsewhere', () => {
  const { s, shape, field } = setup({ style: 'carved', around: 0 }, () => false, 'carved');
  const plain = s.tMin + (1 - s.photo.surround) * (s.tMax - s.tMin);
  // On the equator line, inside the text's gap zone (letters are empty here): line removed
  assert.ok(Math.abs(at(shape, 0, 0, field).t - plain) < 1e-6, 'line cleared under text');
  // Same line, well away from the text: line still there
  const far = at(shape, 40, 0, field);
  assert.ok(far.t > plain + 1, `line kept away from text (t ${far.t})`);
});

test('hidden or empty text does nothing', () => {
  const plainField = setup({ style: 'carved', hidden: true });
  const o = at(plainField.shape, 0, 0, plainField.field);
  const s = plainField.s;
  assert.ok(Math.abs(o.t - (s.tMin + (1 - s.photo.surround) * (s.tMax - s.tMin))) < 1e-6);
  const empty = setup({ style: 'carved', text: '   ' });
  assert.ok(Math.abs(at(empty.shape, 0, 0, empty.field).t - o.t) < 1e-9);
});

test('raised text makes a watertight shell and asks for fine outer detail', () => {
  const { shape, col, field } = setup({ style: 'raised', up: 20, around: 30 });
  assert.equal(field.hasRaised, true);
  const mesh = buildShellMesh({ shape, field, stepInner: 2, stepOuter: 2, collar: col });
  const wt = checkWatertight(mesh.indices, mesh.positions.length / 3);
  assert.ok(wt.ok, `bad edges: ${wt.badEdges}`);
});

test('placementAt is the inverse of placing text at around/up', () => {
  const { shape } = setup({});
  for (const [around, up] of [[0, 0], [35, 20], [-120, -30], [170, 50]]) {
    const theta = THETA_FRONT + (around * Math.PI) / 180;
    const p = placementAt(shape, theta, sForUp(shape, up));
    assert.ok(Math.abs(p.around - around) < 0.11 && Math.abs(p.up - up) < 0.11, JSON.stringify(p));
  }
});
