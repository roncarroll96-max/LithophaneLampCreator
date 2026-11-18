// The lithophane "field": for any point (theta, s) on the ball, how thick the wall is
// and how far raised markings stick out. Both the preview and the STL export use this,
// so what you see is what gets printed.
//
// Brighter photo pixel -> thinner wall (tMin) -> more light gets through.
// The photo relief is on the INSIDE; the outside stays smooth except raised markings.

import { THETA_FRONT, wrapAngle } from './shapes.js';
import { MARKING_TYPES, rotationMatrix } from './markings.js';
import { SHAPES, markingWidth } from './settings.js';
import { createTextLayer } from './textLayer.js';

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

const LINE_EXTRA = 0.4;     // carved lines go this much past tMax so they stay visible over dark areas
const MOUNT_ARC = 4;        // mm above the opening edge kept plain (no photo/markings)
const MOUNT_BLEND = 6;      // mm to blend from the plain mount band into the design

/**
 * photo: { w, h, data: Float32Array brightness 0..1 } or null
 * textMasks: rendered text masks by item id (see textLayer.js), or null
 * Returns { eval(theta, s, out) } where out receives:
 *   x,y,z (outer surface), ix,iy,iz (inner surface), t (wall mm), raise (mm), mask (0..1 photo)
 */
export function createField(settings, shape, photo, textMasks = null) {
  const { tMin, tMax } = settings;
  const p = settings.photo;
  const mk = settings.markings;
  const tMount = Math.min(Math.max(settings.opening.collarWall, tMin), tMax);

  // Photo window (mm on the surface)
  const W = (p.coverage / 360) * shape.eqPerimeter;
  const imgAspect = photo ? photo.h / photo.w : 0.75;
  const aspect = p.aspect && p.aspect > 0 ? p.aspect : imgAspect;
  const H = W * aspect;
  const feather = Math.max(0.01, p.feather);
  const wrapBlend = p.projection === 'wrap' ? 1 : 0;
  const cover = Math.max(1, aspect / imgAspect);
  const zoom = Math.max(0.05, p.zoom);
  const rot = (-p.rotate * Math.PI) / 180;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const surround = p.surround;
  const oval = p.windowShape === 'oval';

  // Markings
  const markFn = mk.style === 'off' ? null : MARKING_TYPES[SHAPES[settings.shape]?.markings] || null;
  const R = rotationMatrix(mk.yaw, mk.pitch, mk.roll);
  const lineW = markingWidth(settings);
  const markR = shape.markRadius;
  const carved = mk.style === 'carved';
  const raised = mk.style === 'raised';

  const tmp = {};
  const textLayer = createTextLayer(settings, shape, textMasks);
  const tx = { hits: [], clear: 0 };

  function samplePhoto(u, v) { // u,v in 0..1 image space
    const fx = u * photo.w - 0.5, fy = v * photo.h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const wx = fx - x0, wy = fy - y0;
    const W1 = photo.w - 1, H1 = photo.h - 1;
    const xa = x0 < 0 ? 0 : x0 > W1 ? W1 : x0, xb = x0 + 1 > W1 ? W1 : x0 + 1 < 0 ? 0 : x0 + 1;
    const ya = y0 < 0 ? 0 : y0 > H1 ? H1 : y0, yb = y0 + 1 > H1 ? H1 : y0 + 1 < 0 ? 0 : y0 + 1;
    const d = photo.data;
    const a = d[ya * photo.w + xa] * (1 - wx) + d[ya * photo.w + xb] * wx;
    const b = d[yb * photo.w + xa] * (1 - wx) + d[yb * photo.w + xb] * wx;
    return a * (1 - wy) + b * wy;
  }

  function evalAt(theta, s, out) {
    const phi = shape.phiAt(theta, s);
    const S = shape.surf(theta, phi, tmp);

    // ---- Photo
    let bright = surround, mask = 0;
    if (photo) {
      const dTheta = wrapAngle(theta - THETA_FRONT);
      const natural = shape.ringArc(theta, s);
      const xmm = natural * (1 - wrapBlend) + dTheta * shape.eqRho * wrapBlend;
      const ymm = shape.elev(s) - p.centerY;
      const hx = W / 2, hy = H / 2;
      if (oval) {
        const r = Math.hypot(xmm / hx, ymm / hy);
        const f = feather / Math.min(hx, hy);
        mask = 1 - smooth(1 - f, 1, r);
      } else {
        const ex = hx - Math.abs(xmm), ey = hy - Math.abs(ymm);
        mask = smooth(0, feather, ex) * smooth(0, feather, ey);
      }
      if (mask > 0) {
        // window coords in units of window width, centred
        const px = xmm / W, py = -ymm / W;
        const qx = (px * cr - py * sr) / zoom, qy = (px * sr + py * cr) / zoom;
        const u = 0.5 + p.panX + qx / cover;
        const v = 0.5 + p.panY + qy / (cover * imgAspect);
        if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
          bright = surround + (samplePhoto(u, v) - surround) * mask;
        } else {
          mask = 0;
        }
      }
    }
    let t = tMin + (1 - bright) * (tMax - tMin);
    let raise = 0;

    // ---- Text coverage here (needed first: lines stop around text)
    if (textLayer) textLayer.sample(S.dx, S.dy, S.dz, tx);

    // ---- Markings (evaluated on the ball's own rotated frame)
    if (markFn && !(textLayer && tx.clear >= 1)) {
      const dx = S.dx, dy = S.dy, dz = S.dz;
      // R^T * d (rotating the markings by R)
      const lx = R[0] * dx + R[3] * dy + R[6] * dz;
      const ly = R[1] * dx + R[4] * dy + R[7] * dz;
      const lz = R[2] * dx + R[5] * dy + R[8] * dz;
      let m = markFn(lx, ly, lz, markR, lineW);
      if (textLayer) m *= 1 - tx.clear;
      if (m > 0) {
        const k = 1 - mk.fade * mask;
        if (carved) t += (tMax + LINE_EXTRA - t) * m * mk.darkness * k;
        else if (raised) raise = mk.raise * m * k;
      }
    }

    // ---- Text: optional bright outline first, then the letters on top
    if (textLayer) {
      for (const h of tx.hits) {
        const ring = Math.max(0, h.halo - h.letters);
        if (ring > 0) t += (tMin - t) * ring;
        if (h.letters <= 0) continue;
        const st = h.item.style;
        if (st === 'carved') t += (tMax + LINE_EXTRA - t) * h.letters;
        else if (st === 'bright') t += (tMin - t) * h.letters;
        else if (st === 'raised') raise = Math.max(raise, (h.item.raise || 1) * h.letters);
      }
    }

    // ---- Plain band above the opening so the ball seats cleanly on the collar
    const arcE = shape.merArc(theta, s);
    if (arcE < MOUNT_ARC + MOUNT_BLEND) {
      const mz = 1 - smooth(MOUNT_ARC, MOUNT_ARC + MOUNT_BLEND, arcE);
      t += (tMount - t) * mz;
      raise *= 1 - mz;
    }

    out.t = t; out.raise = raise; out.mask = mask;
    out.x = S.x + S.nx * raise; out.y = S.y + S.ny * raise; out.z = S.z + S.nz * raise;
    out.ix = S.x - S.nx * t; out.iy = S.y - S.ny * t; out.iz = S.z - S.nz * t;
    out.sx = S.x; out.sy = S.y; out.sz = S.z;
    return out;
  }

  return {
    eval: evalAt, window: { W, H }, tMount,
    hasRaised: (raised && !!markFn) || !!(textLayer && textLayer.hasRaised),
  };
}
