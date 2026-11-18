// Text on the ball: settings for text items, and how a rendered text mask is mapped onto the
// surface. The masks themselves are drawn by js/text.js in the browser (it needs fonts and a
// canvas); everything here is plain math so it also runs in the export worker and in tests.
//
// A text item sits at a centre point on the ball. Around that point the surface is unrolled
// with an azimuthal equidistant projection: distances from the centre are kept true, so the
// letters keep their size wherever they are placed (front, side or top).

import { THETA_FRONT } from './shapes.js';

/** Bundled fonts (vendor/fonts). minSize = smallest letter height (mm) that reliably prints. */
export const TEXT_FONTS = {
  varsity: { label: 'Varsity', family: 'LithoVarsity', file: 'Graduate.woff2', weight: 400, minSize: 6 },
  sans: { label: 'Bold sans', family: 'LithoSans', file: 'Montserrat.woff2', weight: 800, minSize: 6 },
  script: { label: 'Script', family: 'LithoScript', file: 'Pacifico.woff2', weight: 400, minSize: 10 },
  serif: { label: 'Serif', family: 'LithoSerif', file: 'PlayfairDisplay.woff2', weight: 700, minSize: 6 },
};

export const TEXT_OUTLINE_MM = 0.8; // width of the optional bright outline around letters
export const TEXT_GAP_MM = 1.5;     // lines stop this far from letters
export const TEXT_MM_PER_PX = 0.125; // mask resolution (8 px per mm)

let nextId = 1;
/** A new text item. `n` only varies the default height so new items don't stack exactly. */
export function defaultTextItem(n = 0) {
  return {
    id: `t${Date.now().toString(36)}${(nextId++).toString(36)}`,
    text: 'TEXT',
    font: 'varsity',
    style: 'carved',   // 'carved' (dark) | 'bright' (thinner, glows light) | 'raised'
    size: 15,          // letter height (capital letters), mm
    around: 0,         // degrees around the ball, 0 = front, + = to the right seen from the front
    up: -25 - 20 * (n % 3), // mm above (+) or below (-) the equator, along the surface
    rotate: 0,         // degrees, + = counter-clockwise seen from outside
    arc: 0,            // degrees of bend over the text's length, + = arch (centre higher)
    outline: false,    // thin bright outline around the letters
    raise: 1.0,        // height of raised text, mm
    hidden: false,
  };
}

/** Key that changes whenever the mask for an item must be redrawn. */
export const maskKey = (it) => JSON.stringify([it.text, it.font, it.size, it.arc]);

/** Finds s (0..1) whose height above the equator is `up` mm. */
export function sForUp(shape, up) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (shape.elev(mid) < up) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Inverse of the placement: (theta, s) on the ball -> { around, up } for a text item. */
export function placementAt(shape, theta, s) {
  let d = theta - THETA_FRONT;
  d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return { around: +(d * 180 / Math.PI).toFixed(1), up: +shape.elev(s).toFixed(1) };
}

function sampleMask(mask, arr, px, py) {
  const x0 = Math.floor(px), y0 = Math.floor(py);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= mask.w || y0 + 1 >= mask.h) return 0;
  const wx = px - x0, wy = py - y0, i = y0 * mask.w + x0;
  const a = arr[i] * (1 - wx) + arr[i + 1] * wx;
  const b = arr[i + mask.w] * (1 - wx) + arr[i + mask.w + 1] * wx;
  return a * (1 - wy) + b * wy;
}

/**
 * Prepares the visible text items for fast evaluation.
 * masks: { [id]: { w, h, mmPerPx, cx, cy, letters, halo, clear } } where (cx, cy) is the pixel
 * at the text's centre and the three Float32Arrays are 0..1 coverage:
 *   letters = the letters, halo = letters grown by TEXT_OUTLINE_MM, clear = grown by TEXT_GAP_MM.
 * Returns { items, sample(dx, dy, dz, out) } or null when there is no visible text.
 */
export function createTextLayer(settings, shape, masks) {
  const list = (settings.texts || []).filter((it) => !it.hidden && it.text && it.text.trim() && masks && masks[it.id]);
  if (!list.length) return null;
  const tmp = {};
  const items = list.map((it) => {
    const mask = masks[it.id];
    shape.surf(THETA_FRONT + (it.around * Math.PI) / 180, shape.phiAt(THETA_FRONT + (it.around * Math.PI) / 180, sForUp(shape, it.up)), tmp);
    const N = [tmp.dx, tmp.dy, tmp.dz];
    const Rc = Math.hypot(tmp.x, tmp.y, tmp.z);
    // Right (U) and up (V) as seen from outside; near the poles fall back to the front's right (+X)
    let U = [-N[1], N[0], 0];
    let ul = Math.hypot(U[0], U[1]);
    if (ul < 1e-6) { U = [1, 0, 0]; ul = 1; }
    U = [U[0] / ul, U[1] / ul, 0];
    const V = [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]];
    const rot = (it.rotate * Math.PI) / 180;
    // Farthest the mask reaches from its centre, as an angle on the ball (with a margin)
    const reach = Math.hypot(Math.max(mask.cx, mask.w - mask.cx), Math.max(mask.cy, mask.h - mask.cy)) * mask.mmPerPx;
    return {
      it, mask, N, U, V, Rc,
      cr: Math.cos(rot), sr: Math.sin(rot),
      cosReach: Math.cos(Math.min(Math.PI * 0.95, reach / Rc + 0.02)),
    };
  });

  /**
   * For a unit direction from the ball's centre, fills `out` per item:
   *   out.hits = [{ item, letters, halo, clear }] for items that cover this point.
   */
  function sample(dx, dy, dz, out) {
    out.hits.length = 0;
    out.clear = 0;
    for (const p of items) {
      const c = dx * p.N[0] + dy * p.N[1] + dz * p.N[2];
      if (c < p.cosReach) continue;
      const tx = dx - c * p.N[0], ty = dy - c * p.N[1], tz = dz - c * p.N[2];
      const sn = Math.hypot(tx, ty, tz);
      const a = Math.atan2(sn, c);
      const k = sn > 1e-12 ? (p.Rc * a) / sn : p.Rc;
      // local mm (x right, y up), then undo the item's rotation
      const lx0 = (tx * p.U[0] + ty * p.U[1] + tz * p.U[2]) * k;
      const ly0 = (tx * p.V[0] + ty * p.V[1] + tz * p.V[2]) * k;
      const lx = lx0 * p.cr + ly0 * p.sr, ly = -lx0 * p.sr + ly0 * p.cr;
      const m = p.mask;
      const px = m.cx + lx / m.mmPerPx, py = m.cy - ly / m.mmPerPx;
      const clear = sampleMask(m, m.clear, px, py);
      if (clear <= 0) continue;
      out.hits.push({
        item: p.it,
        letters: sampleMask(m, m.letters, px, py),
        halo: p.it.outline ? sampleMask(m, m.halo, px, py) : 0,
      });
      if (clear > out.clear) out.clear = clear;
    }
    return out;
  }

  return { items, sample, hasRaised: list.some((it) => it.style === 'raised') };
}
