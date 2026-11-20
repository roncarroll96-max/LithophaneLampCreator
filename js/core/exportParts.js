// Builds the printable parts (meshes in printing position) for the STL and 3MF exports.
// Used by the export worker and by the tests. No DOM.
//
// data: { settings, photos, textMasks, moon, stepInner, stepOuter }
//   stepInner is the fine (detail) spacing, stepOuter the coarse one for smooth surfaces.

import { buildEllipsoidShape } from './shapes.js';
import { createField } from './field.js';
import { buildShellMesh, flipUpsideDown } from './mesh.js';
import { bodyAxes, collarDims, SHAPES } from './settings.js';
import { buildPanel, panelFeet } from './panel.js';
import { createPanelField } from './panelField.js';
import { buildPanelMesh } from './panelMesh.js';
import { buildBase } from './base.js';
import { meshSdf, gridStep } from './sdf.js';
import { lanternGeometry, buildLanternStrip, createLanternField, lanternSidePanel, lanternPart, LANTERN_SIDES, LANTERN_TOPS } from './lantern.js';
import { ThreeMFWriter } from './threemf.js';

export const BASE_STEP = 0.45;     // mm grid for the base mesh
export const BASE_MAX_CELLS = 2e8; // a bigger base gets a slightly coarser grid (seconds, not minutes)
export const FRAME_STEP = 0.4;     // mm grid for the lantern's frame parts (pegs and slots need a fine fit)

const isPanel = (settings) => SHAPES[settings.shape]?.body === 'panel';
const isLantern = (settings) => SHAPES[settings.shape]?.body === 'lantern';
const lampShape = (settings) => (isPanel(settings) ? buildPanel(settings) : buildEllipsoidShape(bodyAxes(settings), collarDims(settings).ro));

/** The lamp itself: a ball, cube or flat panel. Returns { mesh, label }. */
export function lampMesh({ settings, photos, textMasks, moon, stepInner, stepOuter }, onProgress = () => {}) {
  if (isPanel(settings)) {
    // The panel stands on its bottom edge, as exported
    const panel = buildPanel(settings);
    const field = createPanelField(settings, panel, photos || null, textMasks || null);
    // the picture side gets the fine spacing, the flat side the coarse one
    const front = field.reliefOutside ? stepInner : stepOuter, back = field.reliefOutside ? stepOuter : stepInner;
    const mesh = buildPanelMesh({ panel, field, stepInner: back, stepOuter: front, feet: panelFeet(settings, panel), onProgress });
    return { mesh, label: `Lithophane panel ${panel.outline} ${Math.round(panel.W)}x${Math.round(panel.H)}mm` };
  }
  const collar = collarDims(settings);
  const shape = buildEllipsoidShape(bodyAxes(settings), collar.ro);
  const field = createField(settings, shape, photos || null, textMasks || null, moon || null);
  // the picture relief (and raised parts) need the fine spacing on whichever side they are
  const out = field.reliefOutside;
  const mesh = buildShellMesh({
    shape, field, collar, onProgress,
    stepInner: out ? stepOuter : stepInner,
    stepOuter: field.hasRaised || out ? stepInner : stepOuter,
  });
  if (shape.kind === 'cube') flipUpsideDown(mesh); // prints with its top face on the bed
  const ax = bodyAxes(settings);
  return { mesh, label: `Lithophane ${settings.shape} ${Math.round(ax.a * 2)}x${Math.round(ax.b * 2)}x${Math.round(ax.c * 2)}mm` };
}

/** The base under a ball, cube or panel, or null when a panel has none. Returns { mesh, label, info }. */
export function baseMesh(settings) {
  const base = buildBase(settings, lampShape(settings));
  if (!base) return null;
  const mesh = meshSdf(base.sdf, base.bounds, gridStep(base.bounds, BASE_STEP, BASE_MAX_CELLS));
  if (base.info.flip) flipUpsideDown(mesh); // puck and bulb bases print with the top on the bed
  return { mesh, label: base.info.panel ? `Panel ${base.info.light}` : `Lamp base ${base.info.light}`, info: base.info };
}

/** One lantern part: 'panel' (side 0..3), 'pillar', 'base' or 'top'. Returns { mesh, label }. */
export function lanternMesh({ settings, photos, textMasks, stepInner, stepOuter }, part, side = 0, onProgress = () => {}, geo = lanternGeometry(settings)) {
  if (part === 'panel') {
    const strip = buildLanternStrip(settings, geo);
    const field = createLanternField(settings, strip, photos || null, textMasks || null);
    const panel = lanternSidePanel(settings, geo);
    // The picture faces out (the front), so the front gets the fine spacing
    const mesh = buildPanelMesh({ panel, field: field.sideField(side, panel), stepInner: stepOuter, stepOuter: stepInner, onProgress });
    return { mesh, label: `Lantern ${LANTERN_SIDES[side].toLowerCase()} panel ${Math.round(geo.W)}x${Math.round(geo.H)}mm` };
  }
  const p = lanternPart(settings, part, geo);
  onProgress(0.1);
  const mesh = meshSdf(p.sdf, p.bounds, gridStep(p.bounds, FRAME_STEP, BASE_MAX_CELLS));
  onProgress(1);
  return { mesh, label: `Lantern ${part}` };
}

/**
 * Every part of the current design, for the 3MF: [{ name, copies, weight, make(onProgress) }].
 * weight is the rough share of the work (for the progress bar).
 */
export function partList(data) {
  const s = data.settings;
  if (isLantern(s)) {
    const geo = lanternGeometry(s);
    return [
      ...LANTERN_SIDES.map((side, k) => ({ name: `${side} panel`, copies: 1, weight: 4, make: (p) => lanternMesh(data, 'panel', k, p, geo).mesh })),
      { name: 'Pillar', copies: 4, weight: 1, make: (p) => lanternMesh(data, 'pillar', 0, p, geo).mesh },
      { name: 'Base', copies: 1, weight: 1, make: (p) => lanternMesh(data, 'base', 0, p, geo).mesh },
      { name: `Top (${LANTERN_TOPS[geo.top.style]})`, copies: 1, weight: 1, make: (p) => lanternMesh(data, 'top', 0, p, geo).mesh },
    ];
  }
  const label = SHAPES[s.shape]?.label || s.shape;
  const list = [{ name: isPanel(s) ? 'Panel' : label, copies: 1, weight: 6, make: (p) => lampMesh(data, p).mesh }];
  if (!(isPanel(s) && (s.base?.panelKind || 'lightbox') === 'none')) {
    list.push({ name: 'Base', copies: 1, weight: 1, make: () => { const b = baseMesh(s); return b && b.mesh; } });
  }
  return list;
}

/**
 * The whole design as one 3MF. Returns { parts: [byte arrays for a Blob], stats }.
 * Each part is built, written into the file and let go before the next, to save memory.
 */
export async function build3MF(data, onProgress = () => {}, title = 'Lithophane Lamp Creator') {
  const list = partList(data);
  const total = list.reduce((n, j) => n + j.weight, 0);
  const w = new ThreeMFWriter({ title });
  let done = 0, triangles = 0, volume = 0, pieces = 0;
  const names = [];
  for (const job of list) {
    const share = job.weight / total;
    const mesh = job.make((v) => onProgress((done + v * share * 0.85) * 0.95));
    if (mesh) {
      triangles += await w.addObject(job.name, mesh, job.copies);
      volume += mesh.volume * job.copies;
      pieces += job.copies;
      names.push(job.copies > 1 ? `${job.name} ×${job.copies}` : job.name);
    }
    done += share;
    onProgress(done * 0.95);
  }
  const parts = await w.finish(data.settings.bed);
  const bytes = parts.reduce((n, p) => n + p.byteLength, 0);
  onProgress(1);
  return { parts, stats: { triangles, volumeCm3: volume / 1000, pieces, names, bytes } };
}
