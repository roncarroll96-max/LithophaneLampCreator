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
import { lanternGeometry, buildLanternStrip, createLanternField, lanternSidePanel, lanternPart, lanternSideNames, LANTERN_TOPS } from './lantern.js';
import { ThreeMFWriter } from './threemf.js';
import { trimPart, trimPartList, ROOF_LABELS } from './christmas.js';
import { buildCylinder, createCylinderField, buildCylinderMesh } from './cylinder.js';
import { buildLid, LID_STYLES } from './lid.js';
import { simplifyMesh } from './simplify.js';

export const TRIM_STEP = 0.3; // mm grid for the trim pieces (fine filigree)

export const BASE_STEP = 0.45;     // mm grid for the base mesh
export const BASE_MAX_CELLS = 2e8; // a bigger base gets a slightly coarser grid (seconds, not minutes)
export const FRAME_STEP = 0.4;     // mm grid for the lantern's frame parts (pegs and slots need a fine fit)
export const LID_STEP = 0.4;       // mm grid for the cylinder's lid (its lip needs a fine fit)

// After meshing, triangles are merged wherever that moves the surface by less than this (mm).
// The grid-built parts (base, lid, frames) have big flat faces made of thousands of tiny
// triangles: merging them makes the file 85-99% smaller. The lamp keeps a tighter limit so the
// picture is untouched (its plain areas and smooth side still shrink, about half the file).
export const PART_TOL = 0.02;
export const LAMP_TOL = 0.01;

/**
 * The simplified mesh, or the original if simplifying fails (it needs extra memory, which a
 * phone may not have for a very big lamp). onProgress gets 0..1.
 */
function slim(mesh, tol, onProgress = () => {}) {
  try {
    return simplifyMesh(mesh, tol, onProgress);
  } catch {
    return mesh;
  }
}
/** Progress for the meshing (0..split) and the simplifying (split..1). */
const stages = (onProgress, split = 0.6) => [(v) => onProgress(v * split), (v) => onProgress(split + v * (1 - split))];

const isPanel = (settings) => SHAPES[settings.shape]?.body === 'panel';
const isLantern = (settings) => SHAPES[settings.shape]?.body === 'lantern';
const isCylinder = (settings) => SHAPES[settings.shape]?.body === 'cylinder';
const lampShape = (settings) => (isPanel(settings) ? buildPanel(settings) : isCylinder(settings) ? buildCylinder(settings)
  : buildEllipsoidShape(bodyAxes(settings), collarDims(settings).ro));

/** The lamp itself: a ball, cube, flat panel or cylinder. Returns { mesh, label }. */
export function lampMesh(data, onProgress = () => {}) {
  const [meshing, slimming] = stages(onProgress);
  const r = rawLampMesh(data, meshing);
  r.mesh = slim(r.mesh, LAMP_TOL, slimming);
  if (r.flip) flipUpsideDown(r.mesh);
  return { mesh: r.mesh, label: r.label };
}

function rawLampMesh({ settings, photos, textMasks, moon, stepInner, stepOuter }, onProgress) {
  if (isCylinder(settings)) {
    // Standing on its bottom edge; the picture side gets the fine spacing
    const shape = buildCylinder(settings);
    const field = createCylinderField(settings, shape, photos || null, textMasks || null);
    const out = field.reliefOutside;
    const mesh = buildCylinderMesh({ shape, field, stepOut: out ? stepInner : stepOuter, stepIn: out ? stepOuter : stepInner, onProgress });
    return { mesh, label: `Lithophane cylinder ${Math.round(shape.D)}x${Math.round(shape.H)}mm` };
  }
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
  const flip = shape.kind === 'cube'; // prints with its top face on the bed
  const ax = bodyAxes(settings);
  return { mesh, flip, label: `Lithophane ${settings.shape} ${Math.round(ax.a * 2)}x${Math.round(ax.b * 2)}x${Math.round(ax.c * 2)}mm` };
}

/**
 * The base under a ball, cube, cylinder or panel, or null when a panel has none. part: 'base', or
 * 'cover' (the bottom cover that holds the puck under a narrow opening; null when there is none).
 * Returns { mesh, label, info }.
 */
export function baseMesh(settings, part = 'base') {
  const base = buildBase(settings, lampShape(settings));
  if (!base) return null;
  const p = base.parts[part];
  if (!p) return null;
  const mesh = slim(meshSdf(p.sdf, p.bounds, gridStep(p.bounds, BASE_STEP, BASE_MAX_CELLS)), PART_TOL);
  if (p.flip) flipUpsideDown(mesh); // puck and bulb bases print with the top on the bed
  const label = base.info.box ? (part === 'cover' ? 'Panel box back' : 'Panel box')
    : base.info.panel ? `Panel ${base.info.light}` : part === 'cover' ? 'Lamp base bottom cover' : `Lamp base ${base.info.light}`;
  return { mesh, label, info: base.info };
}

/** The cylinder's lid, upside down for printing, or null when it has none. Returns { mesh, label, info }. */
export function lidMesh(settings) {
  if (!isCylinder(settings)) return null;
  const lid = buildLid(settings, buildCylinder(settings));
  if (!lid) return null;
  const mesh = slim(meshSdf(lid.sdf, lid.bounds, gridStep(lid.bounds, LID_STEP, BASE_MAX_CELLS)), PART_TOL);
  return { mesh, label: `Cylinder lid ${lid.info.style}`, info: lid.info };
}

/**
 * One lantern part: 'panel' (side 0..n-1), 'pillar', 'base' or 'top', or a Christmas trim part
 * ('xframe', 'xbase', 'xlattice', 'xdecor', 'xtopper'). Returns { mesh, label }.
 */
export function lanternMesh({ settings, photos, textMasks, stepInner, stepOuter }, part, side = 0, onProgress = () => {}, geo = lanternGeometry(settings)) {
  if (part === 'panel') {
    const strip = buildLanternStrip(settings, geo);
    const field = createLanternField(settings, strip, photos || null, textMasks || null);
    const panel = lanternSidePanel(settings, geo);
    // The picture faces out (the front), so the front gets the fine spacing
    const [meshing, slimming] = stages(onProgress);
    const mesh = slim(buildPanelMesh({ panel, field: field.sideField(side, panel), stepInner: stepOuter, stepOuter: stepInner, onProgress: meshing }), LAMP_TOL, slimming);
    return { mesh, label: `Lantern ${lanternSideNames(geo.n)[side].toLowerCase()} panel ${Math.round(geo.W)}x${Math.round(geo.H)}mm` };
  }
  const trim = part.startsWith('x');
  const p = trim ? trimPart(settings, part, geo) : lanternPart(settings, part, geo);
  if (!p) throw new Error('This lantern has no such part.');
  onProgress(0.1);
  const mesh = slim(meshSdf(p.sdf, p.bounds, gridStep(p.bounds, trim ? TRIM_STEP : FRAME_STEP, BASE_MAX_CELLS)), PART_TOL, (v) => onProgress(0.5 + v * 0.5));
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
      ...lanternSideNames(geo.n).map((side, k) => ({ name: `${side} panel`, copies: 1, weight: 4, make: (p) => lanternMesh(data, 'panel', k, p, geo).mesh })),
      { name: 'Pillar', copies: geo.n, weight: 1, make: (p) => lanternMesh(data, 'pillar', 0, p, geo).mesh },
      { name: 'Base', copies: 1, weight: 1, make: (p) => lanternMesh(data, 'base', 0, p, geo).mesh },
      { name: `Top (${LANTERN_TOPS[geo.top.style] || ROOF_LABELS[geo.top.style]})`, copies: 1, weight: 1, make: (p) => lanternMesh(data, 'top', 0, p, geo).mesh },
      // Christmas trim, each its own part so it can get the second colour in the slicer
      ...trimPartList(s, geo).map(([key, label]) => ({
        name: `Trim: ${label.replace(/ [(].*[)]$/, '')}`, copies: key === 'xframe' || key === 'xbase' || key === 'xlattice' ? geo.n : 1, weight: 1,
        make: (p) => lanternMesh(data, key, 0, p, geo).mesh,
      })),
    ];
  }
  const label = SHAPES[s.shape]?.label || s.shape;
  const list = [{ name: isPanel(s) ? 'Panel' : isCylinder(s) ? 'Cylinder' : label, copies: 1, weight: 6, make: (p) => lampMesh(data, p).mesh }];
  if (isCylinder(s) && LID_STYLES[s.cylinder?.lid] && s.cylinder.lid !== 'none') {
    list.push({ name: `Lid (${LID_STYLES[s.cylinder.lid]})`, copies: 1, weight: 1, make: () => lidMesh(s).mesh });
  }
  if (!(isPanel(s) && (s.base?.panelKind || 'lightbox') === 'none')) {
    const box = isPanel(s) && s.base?.panelKind === 'enclosure';
    list.push({ name: box ? 'Box' : 'Base', copies: 1, weight: 1, make: () => { const b = baseMesh(s); return b && b.mesh; } });
    if (buildBase(s, lampShape(s))?.parts.cover) { // a puck tray under a narrow opening, or the panel box's back
      list.push({ name: box ? 'Box back' : 'Base bottom cover', copies: 1, weight: 1, make: () => baseMesh(s, 'cover').mesh });
    }
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
