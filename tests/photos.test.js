import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { defaultSettings, defaultPhotoSettings, photoSlot, bodyAxes, collarDims, MAX_PHOTOS, mergeSettings } from '../js/core/settings.js';
import { sForUp } from '../js/core/textLayer.js';
import { projectPhotos } from '../js/storage.js';

const flat = (v, w = 40, h = 30) => ({ w, h, data: new Float32Array(w * h).fill(v) });
const thick = (s, b) => s.tMin + (1 - b) * (s.tMax - s.tMin);

function setup(photoCfgs) {
  const s = defaultSettings();
  s.shape = 'sphere';
  s.photos = photoCfgs.map((c, i) => ({ ...defaultPhotoSettings(), id: `p${i}`, feather: 2, ...c }));
  const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  return { s, shape };
}
const at = (field, shape, aroundDeg, up = 0) => {
  const o = {};
  field.eval(THETA_FRONT + (aroundDeg * Math.PI) / 180, sForUp(shape, up), o);
  return o;
};

test('two photos on opposite sides each show on their own side', () => {
  const { s, shape } = setup([{ around: 0, coverage: 60 }, { around: 180, coverage: 60 }]);
  const f = createField(s, shape, { p0: flat(0.1), p1: flat(0.9) });
  assert.ok(Math.abs(at(f, shape, 0).t - thick(s, 0.1)) < 0.01, 'front photo');
  assert.ok(Math.abs(at(f, shape, 180).t - thick(s, 0.9)) < 0.01, 'back photo');
  assert.ok(Math.abs(at(f, shape, 90).t - thick(s, s.photo.surround)) < 0.01, 'plain ball between them');
  assert.equal(at(f, shape, 0).photoId, 'p0');
  assert.equal(at(f, shape, 180).photoId, 'p1');
  assert.equal(at(f, shape, 90).photoId, null);
});

test('where photos overlap, the one higher in the list (first) wins', () => {
  const cfgs = [{ around: 0, coverage: 50 }, { around: 10, coverage: 80 }];
  const { s, shape } = setup(cfgs);
  const f = createField(s, shape, { p0: flat(0.1), p1: flat(0.9) });
  assert.ok(Math.abs(at(f, shape, 2).t - thick(s, 0.1)) < 0.01, 'top photo in front');
  assert.equal(at(f, shape, 2).photoId, 'p0');
  assert.ok(Math.abs(at(f, shape, 40).t - thick(s, 0.9)) < 0.01, 'lower photo shows outside the top one');
  // swap the order: now the other one wins
  s.photos.reverse();
  const g = createField(s, shape, { p0: flat(0.1), p1: flat(0.9) });
  assert.ok(Math.abs(at(g, shape, 2).t - thick(s, 0.9)) < 0.01, 'order decides');
});

test('hidden photos and photos without a picture are skipped', () => {
  const { s, shape } = setup([{ around: 0, coverage: 60, hidden: true }, { around: 0, coverage: 60 }]);
  const f = createField(s, shape, { p0: flat(0.1), p1: flat(0.9) });
  assert.ok(Math.abs(at(f, shape, 0).t - thick(s, 0.9)) < 0.01, 'hidden top photo skipped');
  const g = createField(s, shape, { p0: flat(0.1) }); // p1's picture missing, p0 hidden
  assert.ok(Math.abs(at(g, shape, 0).t - thick(s, s.photo.surround)) < 0.01, 'nothing to show');
});

test('a flat photo on top of the ball covers the pole', () => {
  const s0 = defaultSettings();
  const shape = buildEllipsoidShape(bodyAxes(s0), collarDims(s0).ro);
  const topUp = Math.floor(shape.elev(1)) - 2;
  const { s } = setup([{ ...photoSlot(4, topUp) }]);
  const f = createField(s, shape, { p0: flat(0.2) });
  const o = {};
  f.eval(1.0, 0.999, o); // right at the top, any direction around
  assert.ok(Math.abs(o.t - thick(s, 0.2)) < 0.02, `top covered (t ${o.t})`);
  f.eval(THETA_FRONT, shape.sEquator, o);
  assert.ok(Math.abs(o.t - thick(s, s.photo.surround)) < 0.01, 'equator front stays plain');
});

test('new photos start on the next free side and the list is capped', () => {
  assert.equal(MAX_PHOTOS, 6);
  assert.deepEqual([0, 1, 2, 3].map((n) => photoSlot(n, 70).around), [0, 180, -90, 90]);
  assert.equal(photoSlot(4, 70).projection, 'flat');
  assert.equal(photoSlot(4, 70).centerY, 70);
});

test('older saved projects with one photo turn into a photo list', () => {
  const blob = { fake: true };
  assert.deepEqual(projectPhotos({ photoBlob: blob, photoName: 'a.jpg' }), [{ id: 'p1', name: 'a.jpg', blob }]);
  assert.deepEqual(projectPhotos({ photos: [{ id: 'x', name: 'b', blob }] }), [{ id: 'x', name: 'b', blob }]);
  assert.deepEqual(projectPhotos({}), []);
});

test('ball markings stay out of the photos (unless the fade is lowered)', () => {
  const thicknesses = (s) => {
    const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
    const f = createField(s, shape, { p0: flat(0.5) });
    const out = new Set();
    // a grid well inside the photo window (away from its soft edge)
    for (let a = -30; a <= 30; a += 1) for (let up = -30; up <= 30; up += 1) out.add(at(f, shape, a, up).t.toFixed(4));
    return out;
  };
  const s = defaultSettings();
  s.shape = 'basketball';
  s.photos = [{ ...defaultPhotoSettings(), id: 'p0', around: 0, coverage: 120, feather: 4 }];
  assert.equal(s.markings.fade, 1);
  assert.deepEqual([...thicknesses(s)], [thick(s, 0.5).toFixed(4)], 'only the photo inside its window');
  s.markings.fade = 0.3;
  assert.ok(thicknesses(s).size > 1, 'at 30% the lines show through');
});

test('projects saved before 1.2 at the old 30% line fade now hide the lines; a chosen fade is kept', () => {
  assert.equal(mergeSettings({ version: 1, markings: { fade: 0.3 } }).markings.fade, 1);
  assert.equal(mergeSettings({ version: 1, markings: { fade: 0.6 } }).markings.fade, 0.6);
  assert.equal(mergeSettings({ version: 2, markings: { fade: 0.3 } }).markings.fade, 0.3);
  assert.equal(mergeSettings({ markings: {} }).markings.fade, 1);
  assert.equal(mergeSettings({ version: 1 }).version, 3);
});