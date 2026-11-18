// Builds the STL in the background so the page stays responsive.
// Message in:  { settings, photo: { w, h, data } | null, textMasks | null, stepInner, stepOuter }
// Messages out: { type: 'progress', value } and { type: 'done', stl, stats } or { type: 'error', message }

import { buildEllipsoidShape } from './core/shapes.js';
import { createField } from './core/field.js';
import { buildShellMesh, diagonalFootprint } from './core/mesh.js';
import { writeBinarySTL } from './core/stl.js';
import { bodyAxes, collarDims } from './core/settings.js';

self.onmessage = (e) => {
  const { settings, photo, textMasks, stepInner, stepOuter } = e.data;
  try {
    const collar = collarDims(settings);
    const shape = buildEllipsoidShape(bodyAxes(settings), collar.ro);
    const field = createField(settings, shape, photo, textMasks || null);
    const mesh = buildShellMesh({
      shape, field, stepInner, stepOuter: field.hasRaised ? stepInner : stepOuter, collar,
      onProgress: (v) => self.postMessage({ type: 'progress', value: v * 0.9 }),
    });
    const stl = writeBinarySTL(mesh.positions, mesh.indices, `Lithophane ${settings.shape} ${settings.diameter}mm`);
    const size = mesh.bbox.max.map((v, i) => v - mesh.bbox.min[i]);
    const stats = {
      triangles: mesh.triangles,
      bytes: stl.byteLength,
      size,
      diagonal: diagonalFootprint(mesh.positions),
      volumeCm3: mesh.volume / 1000,
    };
    self.postMessage({ type: 'progress', value: 1 });
    self.postMessage({ type: 'done', stl, stats }, [stl]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
