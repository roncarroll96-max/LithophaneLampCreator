// The cylinder's lid (version 1.10): a flat cap as wide as the tube, with a short lip underneath
// that drops inside the top rim. Solid, or with an open pattern for light and air: a diamond
// lattice, a honeycomb, a snowflake or rings of round holes. A plain border always stays round
// the edge, over the rim and the lip.
//
// Coordinates: mm, z up, the tube's axis on x = y = 0. As it sits on the cylinder, z = 0 is the
// top of the rim; it prints upside down (the cap flat on the bed, the lip up). No DOM.

import { cylinder, subtract, union } from './sdf.js';
import { diamondDist, diamondCell, hexWallDist, hexCell, snowflakeSdf } from './patterns.js';

export const LID_STYLES = {
  none: 'No lid', solid: 'Solid', diamond: 'Diamond lattice', honeycomb: 'Honeycomb', snowflake: 'Snowflake', holes: 'Round holes',
};

const CAP_T = 2.4;   // the cap's thickness
const LIP_T = 1.6;   // the lip's wall
/** The larger of a and b, rounded over k mm where they meet. */
const smoothMax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + (h * h * k) / 4; };
const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : d));

/**
 * The 2D pattern of the lid's open middle: a signed distance, negative where the cap is solid.
 * rp: the open middle's radius.
 */
function lidPattern(style, rp) {
  // Lattices: only whole cells are open (a cell cut by the border would leave thin slivers)
  const whole = (c, reach) => Math.hypot(c[0], c[1]) + reach <= rp;
  if (style === 'diamond') {
    const p = 12, w = 2.4;
    return (x, y) => (whole(diamondCell(x, y, p), p / 2 - w / 2) ? diamondDist(x, y, p) - w / 2 : -1);
  }
  if (style === 'honeycomb') {
    const p = 12, w = 2.2;
    return (x, y) => (whole(hexCell(x, y, p), p / Math.sqrt(3) - w / 2) ? hexWallDist(x, y, p) - w / 2 : -1);
  }
  if (style === 'snowflake') { const w = 3; return (x, y) => snowflakeSdf(x, y, rp + w, w); }
  if (style === 'holes') {
    // a hole in the middle, then rings of holes about 9 mm apart
    const pitch = 9, rh = 3;
    return (x, y) => {
      const rr = Math.hypot(x, y), a = Math.atan2(y, x), k0 = Math.round(rr / pitch);
      let d = Infinity;
      for (let k = Math.max(0, k0 - 1); k <= k0 + 1; k++) {
        const rk = k * pitch;
        if (rk + rh > rp - 1) continue; // only whole holes inside the border
        if (k === 0) { d = Math.min(d, rr); continue; }
        const n = Math.floor((2 * Math.PI * rk) / pitch), step = (2 * Math.PI) / n;
        const j = Math.round(a / step), aj = j * step;
        d = Math.min(d, Math.hypot(x - rk * Math.cos(aj), y - rk * Math.sin(aj)));
      }
      return rh - d; // negative (solid) away from the holes
    };
  }
  return null; // solid
}

/**
 * The lid for a cylinder shape, or null for 'none'. Returns { sdf (as it prints, cap on the bed),
 * bounds, sitSdf (as it sits on the tube: z = 0 at the rim's top), sitBounds, info }.
 */
export function buildLid(settings, shape) {
  const c = settings.cylinder || {};
  const style = LID_STYLES[c.lid] ? c.lid : 'none';
  if (style === 'none') return null;
  const fit = clamp(c.lidFit, 0, 1, 0.2);
  const R = shape.R, ri = shape.collar.ri;              // the rim's outside and inside
  const lipR = ri - fit, lipIn = lipR - LIP_T;
  const lipH = clamp(shape.rim, 3, 10, 3);              // as deep as the plain rim, so it hides nothing
  const rp = lipIn;                                     // the open middle, inside the lip
  const pat = lidPattern(style, rp);
  const cap = cylinder(R, 0, CAP_T);
  const lip = subtract(cylinder(lipR, -lipH, 0.5), cylinder(lipIn, -lipH - 1, 1));
  let sit = union(cap, lip);
  if (pat) {
    // (the open shapes are rounded off where they meet the border, so no thin slivers are left)
    const open = (x, y, z) => Math.max(smoothMax(Math.hypot(x, y) - rp, -pat(x, y), 2), -1 - z, z - CAP_T - 1);
    sit = subtract(sit, open);
  }
  const H = CAP_T + lipH;
  return {
    sdf: (x, y, z) => sit(x, y, CAP_T - z),             // upside down: the cap on the bed
    bounds: { min: [-R - 1, -R - 1, 0], max: [R + 1, R + 1, H] },
    sitSdf: sit,
    sitBounds: { min: [-R - 1, -R - 1, -lipH], max: [R + 1, R + 1, CAP_T] },
    info: { style, width: 2 * R, height: H, cap: CAP_T, lipH, lipR, fit, openR: pat ? rp : 0 },
  };
}
