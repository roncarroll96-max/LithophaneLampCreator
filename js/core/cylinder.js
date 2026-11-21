// The cylinder (feature 12e, version 1.8): a wide photo wrapped round an open tube that stands in
// a base with a light. No DOM: runs in the browser, the export worker and Node tests.
//
// The wall is handled like a flat panel rolled into a tube, so the panel's photo, collage, text
// and even-glow tools work on it unchanged. Panel coordinates: u runs round the tube (mm along
// the outside, u = 0 at the front, -C/2 and C/2 meet at the back), v is up from the middle.
// Lamp coordinates: mm, z up, the tube's axis on x = y = 0, the front facing -y.
//
// Bands: a plain band at the bottom drops into the base's seat, and a plain rim stiffens the open
// top. Both use the thickest wall, with the outside exactly on the tube's radius (so the seat fits).

import { createPanelField } from './panelField.js';
import { preparePhotoLayer } from './field.js';
import { defaultPhotoSettings } from './settings.js';
import { panelEdgeThickness } from './panel.js';
import { TWO_PI } from './shapes.js';
import { stitch, TriList, stitchCapacity } from './mesh.js';

export const CYL_SIZES = { small: { label: 'Small', d: 80, h: 120 }, medium: { label: 'Medium', d: 100, h: 150 }, large: { label: 'Large', d: 120, h: 200 } };
const SEAT_GAP = 2;     // the band shows this much above the base's seat

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

/** Default cylinder settings. */
export function defaultCylinderSettings() {
  return {
    size: 'medium',       // 'small' | 'medium' | 'large' | 'custom'
    diameter: 100, height: 150, // custom size, mm (outside diameter, height)
    wrap: 1,              // how far round the photo goes (0.2 .. 1; 1 = all the way)
    band: 12,             // plain band at the bottom (sits in the base's seat), mm
    rim: 3,               // plain rim at the top, mm
  };
}

/** The cylinder's outside diameter and height (mm). */
export function cylinderSize(settings) {
  const c = { ...defaultCylinderSettings(), ...(settings.cylinder || {}) };
  const p = CYL_SIZES[c.size];
  return p ? { D: p.d, H: p.h } : { D: clamp(c.diameter, 60, 200), H: clamp(c.height, 60, 250) };
}

/**
 * The cylinder shape: the flat panel's interface (pointAt, surfAt, distEdge, W, H, ...) on a
 * strip as wide as the tube is round, plus the sizes the base needs (collar: the bottom band).
 */
export function buildCylinder(settings) {
  const c = { ...defaultCylinderSettings(), ...(settings.cylinder || {}) };
  const { D, H } = cylinderSize(settings);
  const R = D / 2, C = Math.PI * D;
  const band = clamp(c.band, 6, 30), rim = clamp(c.rim, 1, 10);
  const tWall = panelEdgeThickness({ ...settings, panel: { frame: false } }); // the bands' wall
  /** (theta, s) -> panel coordinates: theta round from the back, s from the top (0) down (1). */
  function pointAt(theta, s, out) {
    let f = (theta / TWO_PI) % 1; if (f < 0) f += 1;
    if (theta >= TWO_PI - 1e-12) f = 1; // keep the closing column at the far end of the strip
    out.u = (f - 0.5) * C; out.v = H / 2 - s * H;
    return out;
  }
  /** The outside surface point and its outward normal at (u, v). */
  function surfAt(u, v, out) {
    const a = u / R, sn = Math.sin(a), cs = Math.cos(a);
    out.x = R * sn; out.y = -R * cs; out.z = v; out.nx = sn; out.ny = -cs; out.nz = 0;
    return out;
  }
  const seatD = Math.max(4, band - SEAT_GAP);
  return {
    kind: 'cylinder', R, D, C, W: C, H, band, rim, tWall,
    bottom: -H / 2, top: H / 2,
    a: R, b: R, c: H / 2, merLenMax: H,
    // the bottom band is the "collar" the base's seat holds
    collar: { ri: R - tWall, ro: R, height: seatD },
    pointAt, surfAt,
    distEdge: (u, v) => H / 2 - Math.abs(v),
  };
}

/** Is a point in one of the plain bands (bottom band or top rim)? */
const inBand = (shape, v) => v < shape.bottom + shape.band || v > shape.top - shape.rim;

/**
 * Photo layers round the cylinder. A photo with a window (panelW) sits where it was put, like on a
 * flat panel. A photo that "fills" goes round by the wrap setting: all the way round, its right
 * end fades into its left end at the back; less than that, a front window with soft sides.
 */
export function cylinderLayers(settings, shape, photos) {
  const wrap = clamp(settings.cylinder?.wrap ?? 1, 0.2, 1);
  const { C, H } = shape;
  // a filling photo covers the part that shows: between the bottom band and the top rim
  const Hv = H - shape.band - shape.rim, cyV = (shape.band - shape.rim) / 2;
  const out = [];
  for (const cfg of settings.photos || []) {
    if (cfg.hidden || !photos || !photos[cfg.id]) continue;
    const p = { ...defaultPhotoSettings(), ...cfg };
    if (p.panelW > 0) {
      const L = preparePhotoLayer(p, photos[cfg.id], p.panelW);
      L.cx = p.panelX || 0; L.cy = p.panelY || 0;
      out.push(L);
    } else if (wrap >= 0.999) {
      // All the way round: a window a little wider than the tube, and a copy of it one turn on, so
      // near the back the photo's right end fades into its left end
      const f = clamp(C * 0.06, 8, 24);
      const L = preparePhotoLayer({ ...p, feather: f, windowShape: 'rect' }, photos[cfg.id], C + 2 * f, Hv + 1);
      L.cx = 0; L.cy = cyV; L.featherY = 0.5; // soft only where the ends meet, not at the top and bottom
      out.push({ ...L, cx: C }, L); // the copy first: it lies on top where they overlap
    } else {
      const W = wrap * C;
      const L = preparePhotoLayer({ ...p, feather: Math.max(6, p.feather), windowShape: 'rect' }, photos[cfg.id], W, Hv + 1);
      L.cx = 0; L.cy = cyV; L.featherY = 0.5;
      out.push(L);
    }
  }
  return out;
}

/**
 * How much light reaches a spot on the wall (height v), compared with the middle (even glow). The
 * light sits on the axis: a puck low in the base, a strip up the riser, or a bulb above the base.
 */
export function cylinderLight(settings, shape) {
  const kind = settings.base?.light || 'puck';
  const Ri = shape.R - (settings.tMax ?? 3);
  const z0 = shape.bottom;
  const sources = kind === 'strip'
    ? [0.1, 0.25, 0.4, 0.55].map((f) => z0 + f * shape.H) // a strip up the riser (to about the middle)
    : kind === 'bulb' ? [z0 + 25] : [z0 - 4];
  const irr = (v) => {
    let sum = 0;
    for (const zs of sources) {
      const dz = v - zs, d2 = Ri * Ri + dz * dz, d = Math.sqrt(d2);
      const emit = kind === 'puck' ? 0.35 + 0.65 * Math.max(0, dz / d) : 1; // a puck shines mostly up
      sum += (emit * (Ri / d)) / d2;
    }
    return sum;
  };
  const ref = irr(0);
  return (u, v) => irr(v) / ref;
}

/** The cylinder's thickness field (like a flat panel's), with its bands and even glow. */
export function createCylinderField(settings, shape, photos, textMasks = null) {
  const f = createPanelField({ ...settings, panel: { frame: false } }, shape, photos, textMasks, {
    layers: cylinderLayers(settings, shape, photos),
    light: cylinderLight(settings, shape),
    plain: (u, v) => inBand(shape, v),
  });
  return { ...f, kind: 'cylinder' };
}

/** Signed volume of a triangle list (positive when the triangles face outward). */
function signedVolume(p, idx) {
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
         - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
         + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return vol / 6;
}

/**
 * The printable tube: outside and inside surfaces joined at the top and bottom, as one closed
 * solid standing on its bottom edge (z = 0). stepOut / stepIn: spacing on the outside / inside
 * (the picture side gets the fine one). Returns { positions, indices, bbox, triangles, volume }.
 */
export function buildCylinderMesh({ shape, field, stepOut, stepIn, onProgress }) {
  const { C, H } = shape;
  const grid = (step) => ({ n: Math.max(48, Math.ceil(C / step)), m: Math.max(2, Math.ceil(H / step)) + 1 });
  const go = grid(stepOut), gi = grid(stepIn);
  const pos = new Float32Array((go.n * go.m + gi.n * gi.m) * 3);
  let vCount = 0;
  const ev = {};
  const total = go.m + gi.m;
  let done = 0;
  // Rows of rings round the tube, top to bottom
  const rowsOf = (g, inner) => {
    const rings = [];
    for (let r = 0; r < g.m; r++) {
      const v = H / 2 - (r / (g.m - 1)) * H, ring = new Uint32Array(g.n);
      for (let j = 0; j < g.n; j++) {
        field.evalUV(-C / 2 + (j / g.n) * C, v, ev);
        const o = vCount * 3;
        if (inner) { pos[o] = ev.ix; pos[o + 1] = ev.iy; pos[o + 2] = ev.iz; } else { pos[o] = ev.x; pos[o + 1] = ev.y; pos[o + 2] = ev.z; }
        ring[j] = vCount++;
      }
      rings.push(ring);
      if (onProgress && ++done % 16 === 0) onProgress((0.85 * done) / total);
    }
    return rings;
  };
  const outer = rowsOf(go, false), inner = rowsOf(gi, true);
  // One loop: outside top -> bottom, across the bottom edge, inside bottom -> top, across the top
  const seq = [...outer, ...inner.slice().reverse(), outer[0]];
  const tris = new TriList(stitchCapacity(seq));
  for (let r = 0; r + 1 < seq.length; r++) stitch(seq[r], seq[r + 1], tris);
  const indices = tris.done();
  const positions = pos.subarray(0, vCount * 3);
  if (signedVolume(positions, indices) < 0) {
    for (let t = 0; t < indices.length; t += 3) { const x = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = x; }
  }
  // Stand it on the bed
  let zMin = Infinity;
  for (let v = 0; v < vCount; v++) zMin = Math.min(zMin, positions[v * 3 + 2]);
  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let v = 0; v < vCount; v++) {
    positions[v * 3 + 2] -= zMin;
    for (let a = 0; a < 3; a++) {
      const x = positions[v * 3 + a];
      if (x < bbox.min[a]) bbox.min[a] = x;
      if (x > bbox.max[a]) bbox.max[a] = x;
    }
  }
  if (onProgress) onProgress(1);
  return { positions, indices, bbox, triangles: indices.length / 3, volume: Math.abs(signedVolume(positions, indices)) };
}

/** Rough triangle count of the tube's STL (for the file size estimate). */
export function estimateCylinderTriangles(shape, stepOut, stepIn) {
  const n = (s) => Math.ceil(shape.C / s) * (Math.ceil(shape.H / s) + 1);
  return 2 * (n(stepOut) + n(stepIn));
}
