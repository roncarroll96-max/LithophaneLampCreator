// The lithophane "field": for any point (theta, s) on the ball, how thick the wall is
// and how far raised markings stick out. Both the preview and the STL export use this,
// so what you see is what gets printed.
//
// Brighter photo pixel -> thinner wall (tMin) -> more light gets through.
// The photo relief is on the INSIDE; the outside stays smooth except raised markings.

import { THETA_FRONT, wrapAngle } from './shapes.js';
import { MARKING_TYPES, rotationMatrix } from './markings.js';
import { SHAPES, markingWidth, defaultPhotoSettings } from './settings.js';
import { createTextLayer, sForUp } from './textLayer.js';
import { boxBlur } from './blur.js';

// Softened copies of cut-out photo transparency, reused while the softness stays the same
const softAlphaCache = new WeakMap();
function softAlpha(alpha, w, h, r) {
  const hit = softAlphaCache.get(alpha);
  if (hit && hit.r === r) return hit.soft;
  const soft = r >= 1 ? boxBlur(alpha, w, h, r) : alpha;
  softAlphaCache.set(alpha, { r, soft });
  return soft;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

const LINE_EXTRA = 0.4;     // carved lines go this much past tMax so they stay visible over dark areas
const MOUNT_ARC = 4;        // mm above the opening edge kept plain (no photo/markings)
const MOUNT_BLEND = 6;      // mm to blend from the plain mount band into the design

/**
 * The photos to place, as layers, top first. `photos` is either one image (older callers and
 * tests: it uses settings.photos[0], or the older single-photo keys in settings.photo) or a map
 * { [photo id]: image } for the entries of settings.photos.
 * An image is { w, h, data: Float32Array brightness 0..1, alpha?: Float32Array 0..1 }.
 */
function resolveLayers(settings, photos) {
  if (!photos) return [];
  if (photos.data) {
    const cfg = { ...defaultPhotoSettings(), ...settings.photo, ...((settings.photos && settings.photos[0]) || {}) };
    return [{ cfg, img: photos }];
  }
  return (settings.photos || [])
    .filter((c) => !c.hidden && photos[c.id])
    .map((c) => ({ cfg: { ...defaultPhotoSettings(), ...c }, img: photos[c.id] }));
}

/**
 * photos: see resolveLayers (one image, a map of images by photo id, or null)
 * textMasks: rendered text masks by item id (see textLayer.js), or null
 * moon: { w, h, data: Float32Array brightness 0..1 } equirectangular Moon map (see moon.js), or null
 * Returns { eval(theta, s, out) } where out receives:
 *   x,y,z (outer surface), ix,iy,iz (inner surface), t (wall mm), raise (mm), mask (0..1 photo),
 *   photoId (id of the top photo covering this point, or null)
 */
export function createField(settings, shape, photos, textMasks = null, moon = null) {
  const { tMin, tMax } = settings;
  const mk = settings.markings;
  const tMount = Math.min(Math.max(settings.opening.collarWall, tMin), tMax);
  const surround = settings.photo?.surround ?? 0.55;

  // Moon: its surface replaces the plain ball; in 'moon' mode the photos are not used at all
  const isMoon = SHAPES[settings.shape]?.markings === 'moon' && !!moon;
  const moonOnly = isMoon && settings.moon?.mode !== 'photo';
  const moonSpin = ((settings.moon?.spin || 0) * Math.PI) / 180;

  // ---- Photo layers (top first), each with its own window on the ball
  const ftmp = {};
  const layers = (moonOnly ? [] : resolveLayers(settings, photos)).map(({ cfg: p, img }) => {
    const W = (p.coverage / 360) * shape.eqPerimeter;
    const imgAspect = img.h / img.w;
    const aspect = p.aspect && p.aspect > 0 ? p.aspect : imgAspect;
    const zoom = Math.max(0.05, p.zoom);
    const cover = Math.max(1, aspect / imgAspect);
    const rot = (-p.rotate * Math.PI) / 180;
    const L = {
      id: p.id || null, p, img, W, H: W * aspect, imgAspect, zoom, cover,
      cr: Math.cos(rot), sr: Math.sin(rot),
      feather: Math.max(0.01, p.feather),
      oval: p.windowShape === 'oval',
      projection: p.projection || 'natural',
      aroundRad: ((p.around || 0) * Math.PI) / 180,
      bgMode: p.background || 'blend', // cut-outs: 'blend' (whatever is below) | 'bright' | 'dark'
      alphaMap: null,
    };
    if (img.alpha) {
      const mmPerPx = (W * zoom * cover) / img.w;
      L.alphaMap = softAlpha(img.alpha, img.w, img.h, Math.round(Math.max(0, p.edgeSoft ?? 2) / 2 / mmPerPx));
    }
    if (L.projection === 'flat') {
      // Flat: unrolled around the window centre (keeps distances true from the centre;
      // works anywhere, including the top of the ball)
      const th = THETA_FRONT + L.aroundRad;
      shape.surf(th, shape.phiAt(th, sForUp(shape, p.centerY)), ftmp);
      const N = [ftmp.dx, ftmp.dy, ftmp.dz];
      let U = [-N[1], N[0], 0];
      const ul = Math.hypot(U[0], U[1]);
      U = ul < 1e-6 ? [Math.cos(L.aroundRad), Math.sin(L.aroundRad), 0] : [U[0] / ul, U[1] / ul, 0];
      const V = [N[1] * U[2] - N[2] * U[1], N[2] * U[0] - N[0] * U[2], N[0] * U[1] - N[1] * U[0]];
      Object.assign(L, { N, U, V, Rc: Math.hypot(ftmp.x, ftmp.y, ftmp.z) });
    }
    return L;
  });

  // Markings
  const markFn = mk.style === 'off' ? null : MARKING_TYPES[SHAPES[settings.shape]?.markings] || null;
  const R = rotationMatrix(mk.yaw, mk.pitch, mk.roll);
  const lineW = markingWidth(settings);
  const markR = shape.markRadius;
  const carved = mk.style === 'carved';
  const raised = mk.style === 'raised';
  const panelDark = mk.panelDark ?? 0.5;
  const mo = { fill: 0, bright: 0, stripes: settings.footballStripes !== false };
  const fixedFrame = !!(markFn && markFn.usesPoint);

  const tmp = {};
  const textLayer = createTextLayer(settings, shape, textMasks);
  const tx = { hits: [], clear: 0 };

  function samplePhoto(img, u, v, d = img.data) { // u,v in 0..1 image space
    const fx = u * img.w - 0.5, fy = v * img.h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const wx = fx - x0, wy = fy - y0;
    const W1 = img.w - 1, H1 = img.h - 1;
    const xa = x0 < 0 ? 0 : x0 > W1 ? W1 : x0, xb = x0 + 1 > W1 ? W1 : x0 + 1 < 0 ? 0 : x0 + 1;
    const ya = y0 < 0 ? 0 : y0 > H1 ? H1 : y0, yb = y0 + 1 > H1 ? H1 : y0 + 1 < 0 ? 0 : y0 + 1;
    const a = d[ya * img.w + xa] * (1 - wx) + d[ya * img.w + xb] * wx;
    const b = d[yb * img.w + xa] * (1 - wx) + d[yb * img.w + xb] * wx;
    return a * (1 - wy) + b * wy;
  }

  /** Window coordinates (mm, x right, y up from the window centre) of a surface point. */
  function windowXY(L, theta, s, S, outXY) {
    if (L.projection === 'flat') {
      const c = S.dx * L.N[0] + S.dy * L.N[1] + S.dz * L.N[2];
      const tx = S.dx - c * L.N[0], ty = S.dy - c * L.N[1], tz = S.dz - c * L.N[2];
      const sn = Math.hypot(tx, ty, tz);
      const k = sn > 1e-12 ? (L.Rc * Math.atan2(sn, c)) / sn : L.Rc;
      outXY[0] = (tx * L.U[0] + ty * L.U[1] + tz * L.U[2]) * k;
      outXY[1] = (tx * L.V[0] + ty * L.V[1] + tz * L.V[2]) * k;
      return;
    }
    const centre = THETA_FRONT + L.aroundRad;
    const natural = shape.ringArcFrom(centre, theta, s);
    const wrapX = wrapAngle(theta - centre) * shape.eqRho;
    outXY[0] = L.projection === 'wrap' ? wrapX : natural;
    outXY[1] = shape.elev(s) - L.p.centerY;
  }
  const xy = [0, 0];

  function sampleMoon(theta, dz) {
    // Longitude 0 (the side that faces Earth) at the front, east to the right as seen from Earth
    const lon = wrapAngle(theta - THETA_FRONT + moonSpin);
    const lat = Math.asin(Math.max(-1, Math.min(1, dz)));
    const fx = (0.5 + lon / (2 * Math.PI)) * moon.w - 0.5, fy = (0.5 - lat / Math.PI) * moon.h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), wx = fx - x0, wy = fy - y0;
    const xa = ((x0 % moon.w) + moon.w) % moon.w, xb = (xa + 1) % moon.w;
    const ya = Math.max(0, Math.min(moon.h - 1, y0)), yb = Math.max(0, Math.min(moon.h - 1, y0 + 1));
    const d = moon.data;
    const a = d[ya * moon.w + xa] * (1 - wx) + d[ya * moon.w + xb] * wx;
    const b = d[yb * moon.w + xa] * (1 - wx) + d[yb * moon.w + xb] * wx;
    return a * (1 - wy) + b * wy;
  }

  function evalAt(theta, s, out) {
    const phi = shape.phiAt(theta, s);
    const S = shape.surf(theta, phi, tmp);

    // ---- Base surface: the Moon, or the plain ball
    const base = isMoon ? sampleMoon(theta, S.dz) : surround;

    // ---- Photos, bottom layer first so the top one wins (its soft edge fades into what's below)
    let bright = base, mask = 0, photoId = null;
    for (let li = layers.length - 1; li >= 0; li--) {
      const L = layers[li];
      windowXY(L, theta, s, S, xy);
      const xmm = xy[0], ymm = xy[1];
      const hx = L.W / 2, hy = L.H / 2;
      let m;
      if (L.oval) {
        const r = Math.hypot(xmm / hx, ymm / hy);
        m = 1 - smooth(1 - L.feather / Math.min(hx, hy), 1, r);
      } else {
        m = smooth(0, L.feather, hx - Math.abs(xmm)) * smooth(0, L.feather, hy - Math.abs(ymm));
      }
      if (m <= 0) continue;
      // window coords in units of window width, centred
      const p = L.p;
      const px = xmm / L.W, py = -ymm / L.W;
      const qx = (px * L.cr - py * L.sr) / L.zoom, qy = (px * L.sr + py * L.cr) / L.zoom;
      const u = 0.5 + p.panX + qx / L.cover;
      const v = 0.5 + p.panY + qy / (L.cover * L.imgAspect);
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      let val = samplePhoto(L.img, u, v);
      if (L.alphaMap) {
        const a = samplePhoto(L.img, u, v, L.alphaMap);
        const bg = L.bgMode === 'bright' ? 1 : L.bgMode === 'dark' ? 0 : bright;
        val = val * a + bg * (1 - a);
        // Blend: what's below carries on behind the subject, so it no longer counts as this photo
        if (L.bgMode === 'blend') { bright += (val - bright) * m; m *= a; if (m > 0.5) photoId = L.id; mask = Math.max(mask, m); continue; }
      }
      bright += (val - bright) * m;
      if (m > 0.5) photoId = L.id;
      mask = Math.max(mask, m);
    }
    let t = tMin + (1 - bright) * (tMax - tMin);
    let raise = 0;

    // ---- Text coverage here (needed first: lines stop around text)
    if (textLayer) textLayer.sample(S.dx, S.dy, S.dz, tx);

    // ---- Markings (evaluated on the ball's own rotated frame)
    if (markFn && !(textLayer && tx.clear >= 1)) {
      const dx = S.dx, dy = S.dy, dz = S.dz;
      // R^T * d (rotating the markings by R); the football's markings are fixed to its body
      const lx = fixedFrame ? dx : R[0] * dx + R[3] * dy + R[6] * dz;
      const ly = fixedFrame ? dy : R[1] * dx + R[4] * dy + R[7] * dz;
      const lz = fixedFrame ? dz : R[2] * dx + R[5] * dy + R[8] * dz;
      mo.fill = 0; mo.bright = 0;
      let m = markFn(lx, ly, lz, markR, lineW, mo, S, shape);
      if (textLayer) m *= 1 - tx.clear;
      const k = 1 - mk.fade * mask;
      // Darker panels (soccer pentagons), then the lines on top
      if (mo.fill > 0 && panelDark > 0) t += (tMax - t) * mo.fill * panelDark * k;
      // Bright bands (football end stripes): thinner plastic
      if (mo.bright > 0) t += (tMin - t) * mo.bright * (1 - (textLayer ? tx.clear : 0)) * k;
      if (m > 0) {
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

    out.t = t; out.raise = raise; out.mask = mask; out.photoId = photoId;
    out.x = S.x + S.nx * raise; out.y = S.y + S.ny * raise; out.z = S.z + S.nz * raise;
    out.ix = S.x - S.nx * t; out.iy = S.y - S.ny * t; out.iz = S.z - S.nz * t;
    out.sx = S.x; out.sy = S.y; out.sz = S.z;
    return out;
  }

  return {
    eval: evalAt, layers: layers.map((L) => ({ id: L.id, W: L.W, H: L.H })), tMount,
    hasRaised: (raised && !!markFn) || !!(textLayer && textLayer.hasRaised),
  };
}
