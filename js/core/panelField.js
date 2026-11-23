// The flat panel's thickness field: for any point (theta, s) on the panel (see panel.js), how
// thick the plastic is. Shares the lamps' photo blending and text masks, adds the raised frame
// and the light box's even glow. The preview and the STL export both use it.
//
// Brighter photo pixel -> thinner plastic -> more light gets through. By default the front stays
// smooth and the relief and the frame are on the back. With reliefSide 'outside' it is the other
// way round: the back is flat and the picture (and the frame) face the front. The edge then sits
// in the same place as before when there is a frame, so the stand's slot still fits.

import { preparePhotoLayer, blendLayers, LINE_EXTRA } from './field.js';
import { createPanelTextLayer } from './textLayer.js';
import { defaultPhotoSettings } from './settings.js';
import { defaultPanelSettings, panelEdgeThickness } from './panel.js';
import { MU } from './previewData.js';
import { createPanelPattern } from './patterns.js';

const STRIP_TILT = (30 * Math.PI) / 180; // the light box's LED strip leans 30° toward the panel

/** Where the light box's LED strip sits, relative to the panel: { v, depth } in mm. */
export function lightBoxStrip(settings, panel) {
  const T = panelEdgeThickness(settings) + (settings.base?.clearance ?? 0.4);
  const stripW = settings.base?.stripW ?? 10;
  return { v: panel.bottom - 2, depth: T + 2.5 + (stripW + 3) / 2 };
}

/**
 * photos: { [photo id]: { w, h, data, alpha? } } (the adjusted pictures), textMasks as for the lamps.
 * opts (the lantern uses these): layers = photo layers already placed (each with cx, cy), and
 * light(u, v) = how much light reaches that spot compared with the middle (for even glow), and
 * plain(u, v) = true where the wall is a plain band (the cylinder's), tRef thick.
 * The background pattern (settings.pattern, version 1.10) fills what the photos leave plain:
 * opts.patternUV(u, v, out) maps to pattern coordinates (a lantern centres it on each side) and
 * opts.periodU makes it repeat round a cylinder.
 * Returns { eval(theta, s, out), evalUV(u, v, out, S?), layers, hasRaised: false, tMount } where
 * out receives x,y,z (front), ix,iy,iz (back), sx,sy,sz, t (mm), raise (0), mask, photoId, light,
 * u, v. evalUV works on panel coordinates directly; S (optional) is the front surface point and
 * normal to build on, instead of the panel's own.
 */
export function createPanelField(settings, panel, photos, textMasks = null, opts = {}) {
  const { tMin, tMax } = settings;
  const pp = { ...defaultPanelSettings(), ...(settings.panel || {}) };
  const surround = settings.photo?.surround ?? 0.55;
  const pattern = createPanelPattern(settings, { periodU: opts.periodU });
  const puv = [0, 0];
  const reliefFront = settings.reliefSide === 'outside';
  const tRef = panelEdgeThickness(settings); // the thickest the panel gets (frame or carved text)

  // ---- Photos: a window on the panel; "fill" (no width set) covers the whole panel
  const layers = opts.layers || (settings.photos || [])
    .filter((c) => !c.hidden && photos && photos[c.id])
    .map((c) => {
      const p = { ...defaultPhotoSettings(), ...c };
      const fill = !(p.panelW > 0);
      const L = fill ? preparePhotoLayer(p, photos[c.id], panel.W, panel.H) : preparePhotoLayer(p, photos[c.id], p.panelW);
      L.cx = fill ? 0 : p.panelX || 0;
      L.cy = fill ? 0 : p.panelY || 0;
      return L;
    });
  let curU = 0, curV = 0;
  const xyOf = (L, out) => { out[0] = curU - L.cx; out[1] = curV - L.cy; };
  const pr = {};

  const textLayer = createPanelTextLayer(settings, textMasks);
  const tx = { hits: [], clear: 0 };

  // ---- Frame: tF thick within frameWidth of the edge, then a 45° slope down to the picture
  const frameOn = !!pp.frame;
  const fw = Math.max(0, pp.frameWidth), tF = tMax + Math.max(0, pp.frameExtra);

  // ---- Even glow (light box): an LED strip along the bottom, behind the panel, leaning toward it
  const lightFn = opts.light || null;
  const lightBox = !lightFn && (settings.base?.panelKind ?? 'lightbox') === 'lightbox';
  const glowOn = (lightBox || !!lightFn) && settings.evenGlow?.on !== false;
  const glowK = glowOn ? Math.max(0, Math.min(1, settings.evenGlow?.strength ?? 0.5)) / MU : 0;
  const strip = lightBox ? lightBoxStrip(settings, panel) : null;
  const ex = -Math.sin(STRIP_TILT), ey = Math.cos(STRIP_TILT); // (depth, up) the strip faces
  function irradiance(v) {
    // A long strip: light falls off with distance; LEDs shine most straight ahead; the panel's
    // back catches light best when it arrives head-on
    const dd = -strip.depth, dv = v - strip.v; // from the strip to the panel (depth, up)
    const d = Math.hypot(dd, dv) || 1;
    const emit = Math.max(0.02, (ex * dd + ey * dv) / d);
    const catchLight = Math.max(0.02, -dd / d);
    return (emit * catchLight) / d;
  }
  const lightRef = lightBox ? irradiance(0) : 1;

  const P = {}, Sbuf = {};
  function evalAt(theta, s, out) {
    panel.pointAt(theta, s, P);
    return evalUV(P.u, P.v, out);
  }
  function evalUV(u, v, out, Sgiven = null) {
    const S = Sgiven || panel.surfAt(u, v, Sbuf);

    curU = u; curV = v;
    let ground = surround;
    if (pattern) {
      if (opts.patternUV) opts.patternUV(u, v, puv); else { puv[0] = u; puv[1] = v; }
      ground = pattern(puv[0], puv[1], surround);
    }
    blendLayers(layers, ground, xyOf, pr);
    let t = tMin + (1 - pr.bright) * (tMax - tMin);

    // Text: optional bright outline first, then the letters (raised text is carved on a panel,
    // since the front stays smooth)
    if (textLayer) {
      textLayer.sample(u, v, tx);
      for (const h of tx.hits) {
        const ring = Math.max(0, h.halo - h.letters);
        if (ring > 0) t += (tMin - t) * ring;
        if (h.letters <= 0) continue;
        if (h.item.style === 'bright') t += (tMin - t) * h.letters;
        else t += (tMax + LINE_EXTRA - t) * h.letters;
      }
    }

    // Even glow
    let light = 1;
    if (lightBox || lightFn) {
      light = lightFn ? lightFn(u, v) : irradiance(v) / lightRef;
      if (glowOn) t = Math.min(tMax + LINE_EXTRA, Math.max(tMin, t + glowK * Math.log(light)));
    }

    // Frame
    if (frameOn) {
      const tf = tF - Math.max(0, panel.distEdge(u, v) - fw);
      if (tf > t) t = tf;
    }
    // Plain bands (the cylinder's bottom band and top rim): the thickest wall, outside on the surface
    if (opts.plain && opts.plain(u, v)) t = tRef;

    out.t = t; out.raise = 0; out.mask = pr.mask; out.photoId = pr.photoId; out.light = light;
    out.u = u; out.v = v;
    out.sx = S.x; out.sy = S.y; out.sz = S.z;
    // Picture on the front: the back is a flat sheet tRef behind the front, the front sinks in
    const sink = reliefFront ? Math.max(0, tRef - t) : 0, back = t + sink;
    out.x = S.x - S.nx * sink; out.y = S.y - S.ny * sink; out.z = S.z - S.nz * sink;
    out.ix = S.x - S.nx * back; out.iy = S.y - S.ny * back; out.iz = S.z - S.nz * back;
    return out;
  }

  return { eval: evalAt, evalUV, layers: layers.map((L) => ({ id: L.id, W: L.W, H: L.H })), hasRaised: false, tMount: tF, reliefOutside: reliefFront };
}
