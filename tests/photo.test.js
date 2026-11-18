import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { defaultSettings, bodyAxes, collarDims } from '../js/core/settings.js';

// A cut-out photo: a mid-grey subject (0.3) in the middle third, transparent everywhere else
function cutout(w = 300, h = 300) {
  const data = new Float32Array(w * h).fill(0.6), alpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x > w / 3 && x < (2 * w) / 3 && y > h / 3 && y < (2 * h) / 3) { data[y * w + x] = 0.3; alpha[y * w + x] = 1; }
  }
  return { w, h, data, alpha };
}

function setup(background, edgeSoft = 0) {
  const s = defaultSettings();
  s.shape = 'sphere';
  s.photo.background = background;
  s.photo.edgeSoft = edgeSoft;
  s.photo.coverage = 120;
  const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  return { s, shape, field: createField(s, shape, cutout()) };
}

const thick = (s, b) => s.tMin + (1 - b) * (s.tMax - s.tMin);

test('cut-out photo: the subject prints, the transparent area follows the Background choice', () => {
  for (const [bg, want] of [['blend', (s) => s.photo.surround], ['bright', () => 1], ['dark', () => 0]]) {
    const { s, shape, field } = setup(bg);
    const o = {};
    field.eval(THETA_FRONT, shape.sEquator, o); // centre of the photo: the subject
    assert.ok(Math.abs(o.t - thick(s, 0.3)) < 0.02, `${bg}: subject t ${o.t}`);
    // Inside the photo window but outside the subject (transparent)
    field.eval(THETA_FRONT + 0.6, shape.sEquator, o);
    assert.ok(Math.abs(o.t - thick(s, want(s))) < 0.02, `${bg}: background t ${o.t} vs ${thick(s, want(s))}`);
  }
});

test('blend mode: transparent area matches the plain ball exactly, so no window edge shows', () => {
  const { s, shape, field } = setup('blend');
  const o = {};
  for (const d of [0.5, 0.8, 1.2, 2.0]) { // from inside the window to well outside it
    field.eval(THETA_FRONT + d, shape.sEquator, o);
    assert.ok(Math.abs(o.t - thick(s, s.photo.surround)) < 0.02, `offset ${d}: t ${o.t}`);
  }
});

test('edge softness widens the fade around the subject', () => {
  const sharp = setup('dark', 0), soft = setup('dark', 8);
  // Just outside the subject's edge: sharp is fully background, soft is partly subject
  const o1 = {}, o2 = {};
  const edge = THETA_FRONT + 0.36; // subject spans about ±0.33 rad here
  sharp.field.eval(edge, sharp.shape.sEquator, o1);
  soft.field.eval(edge, soft.shape.sEquator, o2);
  assert.ok(o1.t > o2.t + 0.05, `soft edge reaches further (sharp ${o1.t}, soft ${o2.t})`);
});

test('photos without transparency work exactly as before', () => {
  const s = defaultSettings();
  const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const w = 50, h = 50, photo = { w, h, data: new Float32Array(w * h).fill(0.25) };
  const o = {};
  createField(s, shape, photo).eval(THETA_FRONT, shape.sEquator, o);
  assert.ok(Math.abs(o.t - thick(s, 0.25)) < 0.02);
});
