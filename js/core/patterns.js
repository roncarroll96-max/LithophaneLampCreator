// Patterns (version 1.10): background patterns for the parts of a panel, lantern side or cylinder
// that have no photo, and the 2D shapes the cylinder's lattice lids are cut from.
// Units are mm on the panel (u right, v up). No DOM: runs in the browser, the export worker and Node.

export const PANEL_PATTERNS = {
  none: 'None', diamond: 'Diamond lattice', honeycomb: 'Honeycomb', wood: 'Wood grain', stars: 'Stars and snowflakes',
};

const SQ3 = Math.sqrt(3);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 1 well inside a stroke (d < 0), 0 outside, a soft step of +-aa mm across its edge. */
const cover = (d, aa = 0.35) => clamp01(0.5 - d / (2 * aa));
const fract = (x) => x - Math.floor(x);
const mod = (a, n) => ((a % n) + n) % n;

/** Distance to the nearest line of a diamond lattice (lines at 45 degrees, `pitch` apart along u). */
export function diamondDist(u, v, pitch) {
  const a = Math.abs(fract((u + v) / pitch + 0.5) - 0.5), b = Math.abs(fract((u - v) / pitch + 0.5) - 0.5);
  return (Math.min(a, b) * pitch) / Math.SQRT2;
}

/** The middle of the diamond lattice's cell round (u, v): [x, y]. The cell's corners are pitch/2 from it. */
export function diamondCell(u, v, pitch) {
  const X = (Math.floor((u + v) / pitch) + 0.5) * pitch, Y = (Math.floor((u - v) / pitch) + 0.5) * pitch;
  return [(X + Y) / 2, (X - Y) / 2];
}

/** The middle of the honeycomb's cell round (u, v): [x, y]. The cell's corners are pitch/sqrt(3) from it. */
export function hexCell(u, v, pitch) {
  const ry = pitch * SQ3;
  const near = (ox, oy) => {
    const cx = (Math.floor((u - ox) / pitch) + 0.5) * pitch + ox, cy = (Math.floor((v - oy) / ry) + 0.5) * ry + oy;
    return [cx, cy, (u - cx) ** 2 + (v - cy) ** 2];
  };
  const a = near(0, 0), b = near(pitch / 2, ry / 2);
  return a[2] < b[2] ? [a[0], a[1]] : [b[0], b[1]];
}

/** Distance to the nearest wall of a honeycomb of pointy-top hexagons `pitch` across the flats. */
export function hexWallDist(u, v, pitch) {
  const ry = pitch * SQ3;
  const cell = (x, y) => {
    const qx = mod(x, pitch) - pitch / 2, qy = mod(y, ry) - ry / 2;
    return [qx, qy];
  };
  const [ax, ay] = cell(u, v), [bx, by] = cell(u - pitch / 2, v - ry / 2);
  const [x, y] = ax * ax + ay * ay < bx * bx + by * by ? [ax, ay] : [bx, by];
  const ux = Math.abs(x), uy = Math.abs(y);
  const hexR = Math.max(ux, ux * 0.5 + uy * (SQ3 / 2)); // 0 in the middle, pitch/2 on the walls
  return Math.abs(pitch / 2 - hexR);
}

/** Distance from (x, y) to the segment (ax, ay)-(bx, by). */
function segDist(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  const t = clamp01(((x - ax) * dx + (y - ay) * dy) / L2);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/**
 * A six-armed snowflake of strokes w wide reaching r from the middle, with two pairs of side
 * branches on each arm. Returns the signed distance (negative inside a stroke).
 */
export function snowflakeSdf(x, y, r, w) {
  // fold into one 60 degree sector round an arm along +x
  const a0 = Math.atan2(y, x), sector = Math.PI / 3;
  const a = mod(a0 + sector / 2, sector) - sector / 2, rr = Math.hypot(x, y);
  const px = rr * Math.cos(a), py = Math.abs(rr * Math.sin(a));
  let d = segDist(px, py, 0, 0, r, 0);
  for (const [f, len] of [[0.42, 0.3], [0.7, 0.22]]) {
    const bx = f * r, L = len * r;
    d = Math.min(d, segDist(px, py, bx, 0, bx + L * 0.5, L * (SQ3 / 2)));
  }
  return Math.min(d - w / 2, rr - w * 0.9);
}

/** A five-pointed star of outer radius r (signed distance, negative inside). */
export function starSdf(x, y, r, rf = 0.45) {
  // (after Inigo Quilez's sdStar5: fold into one point's half, then measure to its edge)
  const k1x = 0.809016994375, k1y = -0.587785252292, k2x = -k1x, k2y = k1y;
  let px = Math.abs(x), py = y;
  let d = Math.max(k1x * px + k1y * py, 0); px -= 2 * d * k1x; py -= 2 * d * k1y;
  d = Math.max(k2x * px + k2y * py, 0); px -= 2 * d * k2x; py -= 2 * d * k2y;
  px = Math.abs(px); py -= r;
  const bax = rf * -k1y, bay = rf * k1x - 1;
  const h = Math.min(r, Math.max(0, (px * bax + py * bay) / (bax * bax + bay * bay)));
  return Math.hypot(px - bax * h, py - bay * h) * Math.sign(py * bax - px * bay);
}

/** A whole number hash of two cell numbers, as 0..1. */
function hash(i, j, k = 0) {
  let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise, repeating every nx cells along x (nx = 0: no repeat). */
function noise(x, y, nx) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const wx = fx * fx * (3 - 2 * fx), wy = fy * fy * (3 - 2 * fy);
  const c = (i, j) => hash(nx ? mod(i, nx) : i, j, 7);
  const a = c(xi, yi) + (c(xi + 1, yi) - c(xi, yi)) * wx;
  const b = c(xi, yi + 1) + (c(xi + 1, yi + 1) - c(xi, yi + 1)) * wx;
  return a + (b - a) * wy;
}

/** A spacing near `want` that fits a whole number of times into `period` (if there is one). */
const fit = (want, period) => (period > 0 ? period / Math.max(1, Math.round(period / want)) : want);

/**
 * The background pattern for a panel's plain parts, or null for none. Returns
 * bright(u, v, surround): the brightness there (0 dark .. 1 bright), where surround is the plain
 * brightness setting. opts.periodU: the pattern repeats every periodU mm along u (a cylinder's
 * circumference, so it joins up at the back).
 */
export function createPanelPattern(settings, opts = {}) {
  const pt = settings.pattern || {};
  const kind = PANEL_PATTERNS[pt.kind] && pt.kind !== 'none' ? pt.kind : null;
  if (!kind) return null;
  const size = Math.min(60, Math.max(6, +pt.size || 15));
  const P = opts.periodU || 0;
  const LINE = 0.05; // lattice lines: nearly the thickest wall
  if (kind === 'diamond') {
    const p = fit(size, P), w = Math.max(1.6, size * 0.13);
    return (u, v, s) => s + (LINE - s) * cover(diamondDist(u, v, p) - w / 2);
  }
  if (kind === 'honeycomb') {
    const p = fit(size, P), w = Math.max(1.4, size * 0.11);
    return (u, v, s) => s + (LINE - s) * cover(hexWallDist(u, v, p) - w / 2);
  }
  if (kind === 'wood') {
    // Wavy grain running across, with darker late-wood bands and a fine streaky texture
    const cells = (L) => (P ? Math.round(P / L) : 0); // (so the noise repeats round a cylinder)
    const band = size * 0.6, L = fit(size * 3, P), Lf = fit(size * 0.8, P), Lg = fit(size * 2, P);
    const nx = cells(L), nf = cells(Lf), ng = cells(Lg);
    return (u, v, s) => {
      const warp = 1.6 * noise(u / L, v / (size * 2.2), nx) + 0.5 * noise(u / Lf, v / size + 9.1, nf);
      const g = v / band + warp;
      const late = Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * g), 3);
      const fine = noise(u / Lg, v / (size * 0.12), ng) - 0.5;
      return clamp01(Math.min(1, s + 0.2) - 0.6 * late + 0.12 * fine);
    };
  }
  // Stars and snowflakes, scattered: one per cell, bright on a darker ground
  const c = fit(size * 1.8, P), n = P ? Math.round(P / c) : 0;
  return (u, v, s) => {
    const i = Math.floor(u / c), j = Math.floor(v / c), hi = n ? mod(i, n) : i;
    const h1 = hash(hi, j, 1), h2 = hash(hi, j, 2), h3 = hash(hi, j, 3), h4 = hash(hi, j, 4);
    const r = c * (0.25 + 0.08 * h1);
    const cx = (i + 0.5 + (h2 - 0.5) * 0.24) * c, cy = (j + 0.5 + (h3 - 0.5) * 0.24) * c;
    const rot = h4 * Math.PI * 2, cs = Math.cos(rot), sn = Math.sin(rot);
    const x = (u - cx) * cs - (v - cy) * sn, y = (u - cx) * sn + (v - cy) * cs;
    const d = h1 < 0.55 ? snowflakeSdf(x, y, r, Math.max(1.2, r * 0.13)) : starSdf(x, y, r);
    const bg = s * 0.5;
    return bg + (1 - bg) * cover(d);
  };
}
