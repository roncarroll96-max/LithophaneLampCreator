// Builds the STL in the background so the page stays responsive.
// Message in:  { settings, photos: { [id]: { w, h, data, alpha? } }, textMasks | null, moon | null, stepInner, stepOuter }
// Messages out: { type: 'progress', value } and { type: 'done', stl: [ArrayBuffer parts], stats } or { type: 'error', message }

import { buildEllipsoidShape } from './core/shapes.js';
import { createField } from './core/field.js';
import { buildShellMesh, diagonalFootprint, flipUpsideDown } from './core/mesh.js';
import { writeBinarySTLParts } from './core/stl.js';
import { bodyAxes, collarDims, SHAPES } from './core/settings.js';
import { buildPanel, panelFeet } from './core/panel.js';
import { createPanelField } from './core/panelField.js';
import { buildPanelMesh } from './core/panelMesh.js';
import { buildBase } from './core/base.js';
import { meshSdf, gridStep } from './core/sdf.js';

const BASE_STEP = 0.45; // mm grid for the base mesh
const BASE_MAX_CELLS = 2e8; // a bigger base gets a slightly coarser grid (seconds, not minutes)

/** Sends the finished STL (as parts, so no one huge block of memory is needed). */
function sendDone(parts, stats) {
  stats.bytes = parts.reduce((n, p) => n + p.byteLength, 0);
  self.postMessage({ type: 'progress', value: 1 });
  self.postMessage({ type: 'done', stl: parts, stats }, parts);
}

const isPanel = (settings) => SHAPES[settings.shape]?.body === 'panel';
const lampShape = (settings) => (isPanel(settings) ? buildPanel(settings) : buildEllipsoidShape(bodyAxes(settings), collarDims(settings).ro));

function exportBase(settings) {
  const shape = lampShape(settings);
  const base = buildBase(settings, shape);
  if (!base) throw new Error('No base is chosen for this panel.');
  self.postMessage({ type: 'progress', value: 0.1 });
  const mesh = meshSdf(base.sdf, base.bounds, gridStep(base.bounds, BASE_STEP, BASE_MAX_CELLS));
  if (base.info.flip) flipUpsideDown(mesh); // puck and bulb bases print with the top on the bed
  self.postMessage({ type: 'progress', value: 0.9 });
  const parts = writeBinarySTLParts(mesh.positions, mesh.indices, base.info.panel ? `Panel ${base.info.light}` : `Lamp base ${base.info.light}`);
  const size = mesh.bbox.max.map((v, i) => v - mesh.bbox.min[i]);
  sendDone(parts, { triangles: mesh.triangles, size, diagonal: diagonalFootprint(mesh.positions), volumeCm3: mesh.volume / 1000 });
}

self.onmessage = (e) => {
  const { settings, photos, textMasks, moon, stepInner, stepOuter } = e.data;
  if (e.data.kind === 'base') {
    try { exportBase(settings); } catch (err) { self.postMessage({ type: 'error', message: err.message || String(err) }); }
    return;
  }
  try {
    const onProgress = (v) => self.postMessage({ type: 'progress', value: v * 0.9 });
    let mesh, label;
    if (isPanel(settings)) {
      // The panel stands on its bottom edge, as exported
      const panel = buildPanel(settings);
      const field = createPanelField(settings, panel, photos || null, textMasks || null);
      // stepInner is the fine (detail) spacing; the picture side gets it, the flat side the coarse one
      const front = field.reliefOutside ? stepInner : stepOuter, back = field.reliefOutside ? stepOuter : stepInner;
      mesh = buildPanelMesh({ panel, field, stepInner: back, stepOuter: front, feet: panelFeet(settings, panel), onProgress });
      label = `Lithophane panel ${panel.outline} ${Math.round(panel.W)}x${Math.round(panel.H)}mm`;
    } else {
      const collar = collarDims(settings);
      const shape = buildEllipsoidShape(bodyAxes(settings), collar.ro);
      const field = createField(settings, shape, photos || null, textMasks || null, moon || null);
      // stepInner is the fine (detail) spacing, stepOuter the coarse one for smooth surfaces;
      // the picture relief (and raised parts) need the fine one on whichever side they are
      const out = field.reliefOutside;
      mesh = buildShellMesh({
        shape, field, collar, onProgress,
        stepInner: out ? stepOuter : stepInner,
        stepOuter: field.hasRaised || out ? stepInner : stepOuter,
      });
      if (shape.kind === 'cube') flipUpsideDown(mesh); // prints with its top face on the bed
      const ax = bodyAxes(settings);
      label = `Lithophane ${settings.shape} ${Math.round(ax.a * 2)}x${Math.round(ax.b * 2)}x${Math.round(ax.c * 2)}mm`;
    }
    const stats = {
      triangles: mesh.triangles,
      size: mesh.bbox.max.map((v, i) => v - mesh.bbox.min[i]),
      diagonal: diagonalFootprint(mesh.positions),
      volumeCm3: mesh.volume / 1000,
    };
    const parts = writeBinarySTLParts(mesh.positions, mesh.indices, label);
    mesh = null; // let the mesh go before the file is handed over
    sendDone(parts, stats);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
