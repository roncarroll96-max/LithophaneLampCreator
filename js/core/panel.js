// The flat panel (feature 12b): a lithophane picture panel, flat or bent side to side.
// Shapes: rectangle, square, circle and heart (circles and hearts get a small flat on the bottom so
// they stand up). This file is the geometry: outline, size, curve and the mesh. No DOM here.
//
// Panel coordinates: u = mm to the right along the front surface (around the curve), v = mm up,
// both from the middle of the panel. The front (the side you look at) is smooth; the picture
// relief and the frame are on the back.
//
// 3D (preview and export): x right, y away from the viewer, z up. The front of a flat panel is the
// plane y = 0. A curved panel bends round a vertical axis at (0, -R): its left and right edges come
// toward the viewer.
//
// So the panel can share the lamps' tools (preview grid, texture, mesh rings), a point on it is
// also named by (theta, s), like a point on a ball: theta = how far round the outline (as a
// fraction of its length, times 2π), s = 0 on the outline .. 1 in the middle.

import { TWO_PI } from './shapes.js';

export const IN = 25.4; // mm per inch

export const PANEL_OUTLINES = {
  rect: 'Rectangle', square: 'Square', circle: 'Circle', heart: 'Heart',
};
/** Photo print sizes for rectangles (inches, short × long side). */
export const RECT_SIZES = { '4x6': [4, 6], '5x7': [5, 7], '8x10': [8, 10] };
/** Sizes for squares, circles and hearts (inches across). */
export const SIDE_SIZES = { 4: 4, 6: 6, 8: 8 };

const FLAT_CIRCLE = 0.4;  // circles: the flat on the bottom is this share of the width
const FLAT_HEART = 0.16;  // hearts: the same (a small flat keeps most of the point)
const MAX_CURVE = 120;    // degrees of bend across the panel

export function defaultPanelSettings() {
  return {
    outline: 'rect',      // 'rect' | 'square' | 'circle' | 'heart'
    size: 'photo',        // rect: 'photo' | '4x6' | '5x7' | '8x10' | 'custom'; others: '4' | '6' | '8' | 'custom'
    longSide: 177.8,      // rect, size 'photo': the longer side (mm); the other follows the photo
    width: 127, height: 177.8, // rect: the size in use (mm), worked out by resolvePanelSize
    side: 152.4,          // square, circle, heart: size across (mm) when size is 'custom'
    curve: 0,             // degrees of bend side to side (0 = flat)
    frame: true,          // raised frame round the edge, on the back
    frameWidth: 6,        // mm
    frameExtra: 2,        // mm thicker than the thickest wall
    feet: false,          // small feet on the bottom edge
  };
}

const fmtIn = (mm) => `${+(mm / IN).toFixed(2)}`;
/** "5×7 in (127×178 mm)" style label. */
export function sizeLabel(wMM, hMM) {
  return `${fmtIn(wMM)}×${fmtIn(hMM)} in (${Math.round(wMM)}×${Math.round(hMM)} mm)`;
}

/**
 * The rectangle's width and height (mm) for its size setting. photoAspect = height / width of
 * the photo it starts from (null when there's no photo yet: portrait 5:7).
 */
export function resolvePanelSize(panel, photoAspect) {
  const p = { ...defaultPanelSettings(), ...panel };
  if (p.outline !== 'rect') return { width: p.width, height: p.height };
  const a = photoAspect && photoAspect > 0 ? photoAspect : 7 / 5;
  if (p.size === 'photo') {
    const L = Math.max(40, p.longSide);
    return a >= 1 ? { width: +(L / a).toFixed(1), height: L } : { width: L, height: +(L * a).toFixed(1) };
  }
  if (RECT_SIZES[p.size]) {
    const [sh, lg] = RECT_SIZES[p.size];
    return a >= 1 ? { width: sh * IN, height: lg * IN } : { width: lg * IN, height: sh * IN };
  }
  return { width: p.width, height: p.height };
}

/** Size across (mm) of a square, circle or heart. */
export function panelSide(panel) {
  const p = { ...defaultPanelSettings(), ...panel };
  return SIDE_SIZES[p.size] ? SIDE_SIZES[p.size] * IN : Math.max(40, p.side);
}

// ---------------------------------------------------------------- outlines
// Each outline is a list of [u, v] points going anticlockwise as seen from the front, starting in
// the middle of the bottom edge (so the texture seam is at the bottom, inside a base's slot).

function rectOutline(W, H) {
  return [[0, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2], [-W / 2, -H / 2]];
}

function circleOutline(D) {
  const r = D / 2, hw = (FLAT_CIRCLE * D) / 2;
  const vc = -Math.sqrt(r * r - hw * hw); // height of the flat
  const a0 = Math.atan2(vc, hw), a1 = Math.PI - a0;
  const n = Math.max(64, Math.ceil(((a1 - a0) * r) / 0.5));
  const pts = [[0, vc], [hw, vc]];
  for (let i = 1; i < n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([r * Math.cos(a), r * Math.sin(a)]); }
  pts.push([-hw, vc]);
  return pts;
}

/** Classic heart curve, 32 units wide, with its bottom point cut off to a flat. */
function heartUnit() {
  const N = 2400, raw = [];
  for (let i = 0; i < N; i++) {
    const t = Math.PI - (i / N) * TWO_PI; // from the bottom point, anticlockwise
    const s = Math.sin(t);
    raw.push([16 * s * s * s, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
  }
  // Height where the heart is FLAT_HEART of its width across
  const across = (y) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < N; i++) {
      const [x0, y0] = raw[i], [x1, y1] = raw[(i + 1) % N];
      if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue;
      const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    return hi - lo;
  };
  let lo = -17, hi = -6;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (across(m) < FLAT_HEART * 32) lo = m; else hi = m; }
  const vc = (lo + hi) / 2;
  let i1 = 0; while (raw[i1][1] < vc) i1++;
  let i2 = N - 1; while (raw[i2][1] < vc) i2--;
  const cut = (a, b) => { const k = (vc - a[1]) / (b[1] - a[1]); return [a[0] + k * (b[0] - a[0]), vc]; };
  return [[0, vc], cut(raw[i1 - 1], raw[i1]), ...raw.slice(i1, i2 + 1), cut(raw[i2], raw[(i2 + 1) % N])];
}
let heartCache = null;

/** Moves the outline so its bounding box is centred on (0, 0); returns its size. */
function centre(pts) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (const p of pts) { p[0] -= cx; p[1] -= cy; }
  return { W: x1 - x0, H: y1 - y0, shift: [cx, cy] };
}

/** Distance to the outline, on a grid (used for the heart, which has no simple formula). */
function distanceGrid(pts, W, H) {
  // A lighter copy of the outline is plenty for distances
  const stepPts = Math.max(1, Math.floor(pts.length / 500));
  const poly = pts.filter((_, i) => i % stepPts === 0);
  const g = Math.max(0.5, Math.max(W, H) / 320), pad = 2;
  const nx = Math.ceil((W + 2 * pad) / g) + 1, ny = Math.ceil((H + 2 * pad) / g) + 1;
  const x0 = -W / 2 - pad, y0 = -H / 2 - pad;
  const d = new Float32Array(nx * ny);
  const n = poly.length;
  for (let j = 0; j < ny; j++) {
    const y = y0 + j * g;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * g;
      let best = Infinity;
      for (let k = 0; k < n; k++) {
        const a = poly[k], b = poly[(k + 1) % n];
        const ex = b[0] - a[0], ey = b[1] - a[1];
        const l2 = ex * ex + ey * ey || 1;
        let t = ((x - a[0]) * ex + (y - a[1]) * ey) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = x - a[0] - t * ex, dy = y - a[1] - t * ey;
        const dd = dx * dx + dy * dy;
        if (dd < best) best = dd;
      }
      d[j * nx + i] = Math.sqrt(best);
    }
  }
  return (u, v) => {
    const fx = (u - x0) / g, fy = (v - y0) / g;
    const i = Math.max(0, Math.min(nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
    const wx = Math.min(1, Math.max(0, fx - i)), wy = Math.min(1, Math.max(0, fy - j));
    const a = d[j * nx + i] * (1 - wx) + d[j * nx + i + 1] * wx;
    const b = d[(j + 1) * nx + i] * (1 - wx) + d[(j + 1) * nx + i + 1] * wx;
    return a * (1 - wy) + b * wy;
  };
}
const heartDistCache = new Map();

/**
 * Builds the panel for the current settings.
 * Returns the outline, its size, the bend and the functions the field, preview and mesh use.
 */
export function buildPanel(settings) {
  const p = { ...defaultPanelSettings(), ...(settings.panel || {}) };
  const outline = PANEL_OUTLINES[p.outline] ? p.outline : 'rect';
  let pts, W, H, distEdge;

  if (outline === 'rect' || outline === 'square') {
    if (outline === 'rect') { W = Math.max(30, p.width); H = Math.max(30, p.height); } else { W = H = panelSide(p); }
    pts = rectOutline(W, H);
    distEdge = (u, v) => Math.min(W / 2 - Math.abs(u), H / 2 - Math.abs(v));
  } else if (outline === 'circle') {
    const D = panelSide(p);
    pts = circleOutline(D);
    const c = centre(pts); W = c.W; H = c.H;
    const cy = -c.shift[1], r = D / 2, vFlat = pts[0][1];
    distEdge = (u, v) => Math.min(r - Math.hypot(u, v - cy), v - vFlat);
  } else {
    const side = panelSide(p);
    if (!heartCache) heartCache = heartUnit();
    const k = side / 32;
    pts = heartCache.map(([x, y]) => [x * k, y * k]);
    const c = centre(pts); W = c.W; H = c.H;
    const key = side.toFixed(2);
    if (!heartDistCache.has(key)) { heartDistCache.clear(); heartDistCache.set(key, distanceGrid(pts, W, H)); }
    distEdge = heartDistCache.get(key);
  }

  // Even spacing along the outline: a table of points every perimeter / NT
  const n = pts.length, cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const perim = cum[n];
  const NT = 8192, tu = new Float64Array(NT + 1), tv = new Float64Array(NT + 1);
  for (let k = 0, i = 0; k <= NT; k++) {
    const L = (k / NT) * perim;
    while (i < n - 1 && cum[i + 1] < L) i++;
    const a = pts[i], b = pts[(i + 1) % n], seg = cum[i + 1] - cum[i] || 1, f = (L - cum[i]) / seg;
    tu[k] = a[0] + f * (b[0] - a[0]); tv[k] = a[1] + f * (b[1] - a[1]);
  }
  let maxR = 0;
  for (let k = 0; k < NT; k++) maxR = Math.max(maxR, Math.hypot(tu[k], tv[k]));

  // Bend: the front lies on a circle of radius R round (0, -R); flat when there's no curve
  const curve = Math.max(0, Math.min(MAX_CURVE, +p.curve || 0));
  const R = curve >= 0.5 ? W / ((curve * Math.PI) / 180) : Infinity;
  const flat = !Number.isFinite(R);
  const chordHalf = flat ? W / 2 : R * Math.sin(W / 2 / R);
  const sag = flat ? 0 : R * (1 - Math.cos(W / 2 / R));

  /** (theta, s) -> panel coordinates (u, v) in mm. */
  function pointAt(theta, s, out) {
    let f = (theta / TWO_PI) % 1; if (f < 0) f += 1;
    const x = f * NT, k = Math.min(NT - 1, Math.floor(x)), w = x - k;
    const m = 1 - s;
    out.u = (tu[k] + (tu[k + 1] - tu[k]) * w) * m;
    out.v = (tv[k] + (tv[k + 1] - tv[k]) * w) * m;
    return out;
  }

  /** Front surface point and its normal (pointing toward the viewer) at panel coordinates (u, v). */
  function surfAt(u, v, out) {
    if (flat) {
      out.x = u; out.y = 0; out.z = v; out.nx = 0; out.ny = -1; out.nz = 0;
    } else {
      const a = u / R, sn = Math.sin(a), cs = Math.cos(a);
      out.x = R * sn; out.y = R * cs - R; out.z = v; out.nx = -sn; out.ny = -cs; out.nz = 0;
    }
    return out;
  }

  /** Width of the outline (mm) at height v. */
  function widthAt(v) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
      if ((y0 - v) * (y1 - v) > 0) continue;
      if (y0 === y1) { lo = Math.min(lo, x0, x1); hi = Math.max(hi, x0, x1); continue; }
      const x = x0 + ((v - y0) / (y1 - y0)) * (x1 - x0);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    return hi > lo ? hi - lo : 0;
  }

  return {
    kind: 'panel', outline, W, H, pts, perim, maxR, R, flat, curve, chordHalf, sag,
    bottom: -H / 2, flatWidth: widthAt(-H / 2 + 0.01),
    // Shared names the app and mesh planner use for every shape
    a: chordHalf, b: chordHalf, c: H / 2,
    merLenMax: maxR,
    ringPerimeter: (s) => perim * (1 - s),
    pointAt, surfAt, distEdge, widthAt,
  };
}

/** Thickness of the panel at its bottom edge (what a base's slot must hold), mm. */
export function panelEdgeThickness(settings) {
  const p = { ...defaultPanelSettings(), ...(settings.panel || {}) };
  return p.frame ? settings.tMax + p.frameExtra : settings.tMax + 0.4;
}

/** Feet on the bottom edge: [{ u, width, front, back, height }] in panel terms (mm). */
export function panelFeet(settings, panel) {
  const p = { ...defaultPanelSettings(), ...(settings.panel || {}) };
  if (!p.feet) return [];
  const half = Math.min(panel.flatWidth, panel.W) / 2;
  const u = Math.max(7, half - 10);
  const reach = Math.max(15, Math.min(35, panel.H * 0.12));
  const T = panelEdgeThickness(settings);
  return [-u, u].map((uc) => ({ u: uc, width: 12, front: reach, back: T + reach, height: 5 }));
}
