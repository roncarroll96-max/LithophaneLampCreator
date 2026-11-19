// Safety limits added in 1.0.3: openings that fit, cube rounding that can't fold the inside wall,
// risers that stay inside the lamp, and project files that can't point the app at the internet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEllipsoidShape, THETA_FRONT } from '../js/core/shapes.js';
import { createField } from '../js/core/field.js';
import { buildBase } from '../js/core/base.js';
import { defaultSettings, bodyAxes, collarDims, maxOpening, cubeRound, minCubeRound } from '../js/core/settings.js';
import { readProjectFile } from '../js/storage.js';

test('the largest allowed opening always builds, for every shape and the smallest sizes', () => {
  for (const shape of ['basketball', 'cube', 'football']) {
    for (const size of [60, 100, 200]) {
      const s = defaultSettings();
      s.shape = shape; s.diameter = size; s.cube.size = size;
      s.footballWidth = Math.max(70, size); s.footballLength = Math.max(120, size * 1.6);
      s.opening.diameter = maxOpening(s);
      assert.doesNotThrow(() => buildEllipsoidShape(bodyAxes(s), collarDims(s).ro), `${shape} ${size}`);
      s.opening.diameter += 1;
      assert.throws(() => buildEllipsoidShape(bodyAxes(s), collarDims(s).ro), `${shape} ${size} + 1 mm`);
    }
  }
});

test('cube edge rounding never goes below the thickest wall', () => {
  const s = defaultSettings();
  s.shape = 'cube'; s.cube.round = 2;
  assert.equal(minCubeRound(s), 3.5);
  assert.equal(cubeRound(s), 3.5);
  s.tMax = 4.2;
  assert.equal(cubeRound(s), 5);
  s.cube.round = 8;
  assert.equal(cubeRound(s), 8);
});

test("the cube's inside wall doesn't fold back at the smallest rounding, even all dark", () => {
  for (const tMax of [3, 4.5]) {
    const s = defaultSettings();
    s.shape = 'cube'; s.tMax = tMax; s.cube.round = 1; s.photo.surround = 0;
    const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
    const f = createField(s, shape, null);
    const a = {}, b = {};
    let folds = 0;
    for (let k = 0; k < 8; k++) {
      const th = THETA_FRONT + (k * Math.PI) / 16; // front face to the corner
      // From just above the opening edge to the top. The flat rim next to the collar meets the
      // funnel at a sharp crease, which this rounding doesn't change, so it's left out here.
      for (let i = 20; i < 2000; i++) {
        f.eval(th, i / 2000, a); const p = { ...a }; f.eval(th, (i + 1) / 2000, b);
        if (p.sz < shape.funnelBottom + 1.5) continue;
        const dot = (b.sx - p.sx) * (b.ix - p.ix) + (b.sy - p.sy) * (b.iy - p.iy) + (b.sz - p.sz) * (b.iz - p.iz);
        if (dot < 0) folds++;
      }
    }
    assert.equal(folds, 0, `tMax ${tMax}`);
  }
});

test('a tall strip riser is kept inside the lamp; the automatic one is untouched', () => {
  const s = defaultSettings();
  s.diameter = 100; s.base.light = 'strip'; s.base.riserH = 200;
  const shape = buildEllipsoidShape(bodyAxes(s), collarDims(s).ro);
  const tall = buildBase(s, shape).info;
  assert.equal(tall.riserLimited, true);
  // the riser top stays below the lamp's inside top: base seat + collar + centre depth + radius - wall
  const o = {}; let zEdge = Infinity;
  for (let i = 0; i < 64; i++) { const th = (i / 64) * 2 * Math.PI; shape.surf(th, shape.phiEdge(th), o); zEdge = Math.min(zEdge, o.z); }
  const insideTop = tall.seatFloor + s.opening.collarHeight - zEdge + 50 - s.tMax;
  assert.ok(tall.totalHeight < insideTop, `${tall.totalHeight} < ${insideTop}`);
  s.base.riserH = 0;
  assert.equal(buildBase(s, shape).info.riserLimited, undefined);
});

test('project files only accept photos saved as pictures inside the file', async () => {
  const doc = {
    format: 'lithophane-lamp-creator-project', version: 2, settings: {},
    photos: [
      { id: 'web', name: 'x', data: 'https://example.invalid/x.png' },
      null,
      { id: 'script', data: 'data:text/html;base64,PHNjcmlwdD4=' },
      { id: 'ok', name: 'pic', data: 'data:image/png;base64,iVBORw0KGgo=' },
    ],
  };
  const file = { text: async () => JSON.stringify(doc) };
  const proj = await readProjectFile(file);
  assert.deepEqual(proj.photos.map((p) => p.id), ['ok']);
  assert.equal(proj.photos[0].blob.type, 'image/png');
  assert.equal(proj.photos[0].blob.size, 8);
});
