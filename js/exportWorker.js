// Builds the STL (or 3MF) in the background so the page stays responsive.
// Message in:  { settings, photos: { [id]: { w, h, data, alpha? } }, textMasks | null, moon | null, stepInner, stepOuter }
//   or { kind: 'base', part: 'base' | 'cover', settings }
//   or { kind: 'lid', settings } (the cylinder's lid)
//   or { kind: 'lantern', part: 'panel' | 'pillar' | 'base' | 'top', side (0..3, for a panel), settings, photos, textMasks, stepInner, stepOuter }
//   or { kind: '3mf', title, settings, photos, textMasks, moon, stepInner, stepOuter } (every part in one 3MF file)
// Messages out: { type: 'progress', value } and { type: 'done', stl: [ArrayBuffer parts], stats } or { type: 'error', message }
//   (for a 3MF, 'stl' holds the 3MF file's parts)

import { diagonalFootprint } from './core/mesh.js';
import { writeBinarySTLParts } from './core/stl.js';
import { lampMesh, baseMesh, lidMesh, lanternMesh, build3MF } from './core/exportParts.js';

const progress = (v) => self.postMessage({ type: 'progress', value: v });

/** Sends the finished file (as parts, so no one huge block of memory is needed). */
function sendDone(parts, stats) {
  stats.bytes = parts.reduce((n, p) => n + p.byteLength, 0);
  progress(1);
  const transfer = [...new Set(parts.map((p) => p.buffer || p))];
  self.postMessage({ type: 'done', stl: parts, stats }, transfer);
}

/** Sends one mesh as an STL, with its size and plastic. */
function sendStl({ mesh, label }) {
  const stats = {
    triangles: mesh.triangles, size: mesh.bbox.max.map((v, i) => v - mesh.bbox.min[i]),
    diagonal: diagonalFootprint(mesh.positions), volumeCm3: mesh.volume / 1000,
  };
  const parts = writeBinarySTLParts(mesh.positions, mesh.indices, label);
  sendDone(parts, stats);
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.kind === '3mf') {
      const { parts, stats } = await build3MF(d, progress, d.title);
      sendDone(parts, stats);
    } else if (d.kind === 'lantern') {
      sendStl(lanternMesh(d, d.part, d.side, (v) => progress(v * 0.9)));
    } else if (d.kind === 'lid') {
      progress(0.1);
      const l = lidMesh(d.settings);
      if (!l) throw new Error('This cylinder has no lid.');
      progress(0.9);
      sendStl(l);
    } else if (d.kind === 'base') {
      progress(0.1);
      const b = baseMesh(d.settings, d.part || 'base');
      if (!b) throw new Error(d.part === 'cover' ? 'This base has no bottom cover.' : 'No base is chosen for this panel.');
      progress(0.9);
      sendStl(b);
    } else {
      sendStl(lampMesh(d, (v) => progress(v * 0.9)));
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
