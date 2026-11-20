// Default project settings, size presets and helpers shared by the UI and the export worker.

import { defaultPanelSettings } from './panel.js';

export const SIZE_PRESETS = {
  S: { label: 'Small', diameter: 100, footballLength: 160, footballWidth: 100, cubeSize: 80 },
  M: { label: 'Medium', diameter: 150, footballLength: 240, footballWidth: 150, cubeSize: 100 },
  L: { label: 'Large', diameter: 200, footballLength: 280, footballWidth: 175, cubeSize: 130 },
};

export const SHAPES = {
  basketball: { label: 'Basketball', body: 'sphere', markings: 'basketball', ready: true },
  sphere: { label: 'Plain sphere', body: 'sphere', markings: 'none', ready: true },
  soccer: { label: 'Soccer ball', body: 'sphere', markings: 'soccer', ready: true },
  football: { label: 'Football', body: 'football', markings: 'football', ready: true },
  baseball: { label: 'Baseball / softball', body: 'sphere', markings: 'baseball', ready: true },
  volleyball: { label: 'Volleyball', body: 'sphere', markings: 'volleyball', ready: true },
  moon: { label: 'Moon', body: 'sphere', markings: 'moon', ready: true },
  cube: { label: 'Cube (5 photos)', body: 'cube', markings: 'none', ready: true },
  panel: { label: 'Flat panel', body: 'panel', markings: 'none', ready: true },
};

/** Export detail presets: spacing between mesh points on the photo surface (mm). */
export const DETAIL_PRESETS = {
  draft: { label: 'Draft', step: 0.5 },
  standard: { label: 'Standard', step: 0.3 },
  fine: { label: 'Fine', step: 0.2 },
};

export function defaultSettings() {
  return {
    version: 3,               // 2 (app 1.2): markings hidden under photos by default; 3 (app 1.3): reliefSide
    shape: 'basketball',
    sizePreset: 'M',
    diameter: 150,
    footballLength: 240,
    footballWidth: 150,
    footballTip: 0.6,         // 0 = smooth oval .. 1 = most pointed (still printable)
    footballStripes: true,    // bright end stripes
    reliefSide: 'inside',     // picture relief: 'inside' (smooth outside; a panel's back) | 'outside' (a panel's front)
    tMin: 0.8,
    tMax: 3.0,
    opening: { diameter: 50, collarHeight: 5, collarWall: 2.0 },
    photo: {
      surround: 0.55,         // brightness of the plain ball outside the photos (0 dark .. 1 bright)
    },
    photos: [],               // up to MAX_PHOTOS photo layers, top first (see defaultPhotoSettings)
    markings: {
      style: 'carved',        // 'carved' | 'raised' | 'off'
      width: null,            // mm; null = 2% of the ball size
      darkness: 1,            // carved lines: 0..1
      raise: 1.0,             // raised lines: height in mm
      fade: 1,                // how much lines fade inside the photo (0..1; 1 = hidden under photos)
      panelDark: 0.5,         // soccer: how much darker the pentagons glow (0 = same as hexagons)
      yaw: 60, pitch: 20, roll: 0,
    },
    texts: [],                // text items (see core/textLayer.js defaultTextItem)
    cube: {
      size: 100,              // edge length, mm
      round: 5,               // edge rounding, mm
      border: 5,              // plain border around each face photo, mm
    },
    evenGlow: { on: true, strength: 0.5 }, // cube and panel light box: thinner plastic farther from the light
    panel: defaultPanelSettings(), // flat panel (see core/panel.js)
    base: {
      light: 'puck', puckD: 70, puckH: 20, socket: 'E12', riserD: 30, riserH: 0,
      clearance: 0.4, shape: 'auto', extra: 0, cableW: 10, cableH: 8,
      panelKind: 'lightbox', stripW: 10, // flat panel: 'lightbox' | 'stand' | 'none'; LED strip width (mm)
    },                        // the lamp or panel base (see core/base.js)
    moon: {
      mode: 'moon',           // 'moon' (Moon only) | 'photo' (photo in a front window, fading into the Moon)
      craters: 0.4,           // how strongly NASA's height map deepens craters (0..1)
      spin: 0,                // degrees; turns the Moon (0 = the side that faces Earth at the front)
    },
    bed: { x: 256, y: 256, z: 256 },
    detail: 'standard',
  };
}

export const MAX_PHOTOS = 6;

/** Settings for one photo layer. Each photo on the ball has its own copy. */
export function defaultPhotoSettings() {
  return {
    id: null,
    hidden: false,
    auto: true,
    blackPoint: 0, whitePoint: 1,
    brightness: 0, contrast: 1, gamma: 1, sharpen: 0.6,
    invert: false,
    zoom: 1, panX: 0, panY: 0, rotate: 0,
    coverage: 140,          // degrees around the ball the photo window spans
    aspect: null,           // window height / width; null = match the photo
    around: 0,              // window centre, degrees around the ball (0 = front, + = to the right)
    centerY: 0,             // window centre height above the equator (mm)
    feather: 8,             // soft edge width (mm)
    windowShape: 'rect',    // 'rect' | 'oval'
    projection: 'natural',  // 'natural' (no squeeze) | 'wrap' (fills 360°) | 'flat' (any spot, e.g. the top)
    background: 'blend',    // cut-out photos: transparent areas 'blend' into what's below | 'bright' | 'dark'
    edgeSoft: 2,            // cut-out photos: how gently the subject's outline fades (mm)
    panelX: 0, panelY: 0,   // flat panel: window centre, mm right of / above the middle
    panelW: null,           // flat panel: window width (mm); null = the photo fills the panel
  };
}

/**
 * Where the n-th photo starts (n = how many photos are already on the ball):
 * front, back, left, right, top, then front-right. Later photos start smaller.
 */
export function photoSlot(n, topUp) {
  const slots = [
    { around: 0, centerY: 0, coverage: 140, projection: 'natural' },
    { around: 180, centerY: 0, coverage: 90, projection: 'natural' },
    { around: -90, centerY: 0, coverage: 70, projection: 'natural' },
    { around: 90, centerY: 0, coverage: 70, projection: 'natural' },
    { around: 0, centerY: topUp, coverage: 45, projection: 'flat' },
    { around: 45, centerY: 10, coverage: 50, projection: 'natural' },
  ];
  return slots[Math.min(n, slots.length - 1)];
}

/**
 * Where the n-th photo starts on the cube: front, back, left, right, top (then a smaller one on
 * the front). Each fills its face minus the plain border, straight on (planar projection).
 * shape: the built cube shape (for its ring length and top height).
 */
export function cubePhotoSlot(n, settings, shape) {
  const size = settings.cube?.size ?? 100, border = settings.cube?.border ?? 5;
  const faceW = Math.max(10, size - 2 * border - 2 * (settings.cube?.round ?? 5) * 0.3);
  const coverage = +((faceW / shape.eqPerimeter) * 360).toFixed(1);
  const faces = [
    { around: 0, centerY: 0 }, { around: 180, centerY: 0 }, { around: -90, centerY: 0 }, { around: 90, centerY: 0 },
    { around: 0, centerY: +shape.elev(1).toFixed(1) },
  ];
  const f = n < faces.length ? faces[n] : { around: 0, centerY: 0 };
  return {
    ...f, projection: 'planar', aspect: 1, feather: Math.min(4, border),
    coverage: n < faces.length ? coverage : +(coverage / 2).toFixed(1),
  };
}

/** Semi-axes of the shape body for the current settings. */
export function bodyAxes(settings) {
  const body = SHAPES[settings.shape]?.body || 'sphere';
  if (body === 'cube') {
    const h = (settings.cube?.size ?? 100) / 2;
    return { a: h, b: h, c: h, kind: 'cube', round: cubeRound(settings) };
  }
  if (body === 'football') {
    const a = settings.footballLength / 2, b = settings.footballWidth / 2;
    const tip = Math.max(0, Math.min(1, settings.footballTip ?? 0.6));
    return { a, b, c: b, kind: 'football', tipN: 2 - 0.8 * tip };
  }
  const r = settings.diameter / 2;
  return { a: r, b: r, c: r, kind: 'sphere' };
}

/**
 * Smallest edge rounding that keeps the cube's inside wall from folding over itself: the inside is
 * the outside pushed in by the wall thickness, so a tighter curve than the thickest wall
 * (tMax plus carved lines) would turn it inside out.
 */
export function minCubeRound(settings) {
  return Math.ceil(((settings.tMax ?? 3) + 0.5) * 2) / 2;
}

/** The edge rounding actually used for the cube (the setting, kept within safe limits). */
export function cubeRound(settings) {
  const h = (settings.cube?.size ?? 100) / 2;
  return Math.max(1, Math.min(h * 0.4, Math.max(minCubeRound(settings), settings.cube?.round ?? 5)));
}

/** Largest opening diameter (0.5 mm steps) that leaves room for the collar on this lamp size. */
export function maxOpening(settings) {
  const ax = bodyAxes(settings);
  const wall = settings.opening?.collarWall ?? 2;
  return Math.floor((2 * (0.9 * Math.min(ax.a, ax.b) - wall) - 0.5) * 2) / 2;
}

export function collarDims(settings) {
  const ri = settings.opening.diameter / 2;
  return { ri, ro: ri + settings.opening.collarWall, height: settings.opening.collarHeight };
}

export function markingWidth(settings) {
  const m = settings.markings.width;
  if (m && m > 0) return m;
  const ax = bodyAxes(settings);
  return Math.max(1.5, +(Math.min(ax.a, ax.b) * 2 * 0.02).toFixed(1));
}

/** Deep-merges saved settings over defaults so older project files still open. */
export function mergeSettings(saved) {
  const d = defaultSettings();
  if (!saved || typeof saved !== 'object') return d;
  for (const k of Object.keys(d)) {
    if (!(k in saved)) continue;
    if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k])) Object.assign(d[k], saved[k]);
    else d[k] = saved[k];
  }
  // Before version 2 the lines showed through photos (fade 30%). Projects still at that old
  // default now hide them, as asked (2026-11-19); a fade someone chose themselves is kept.
  if (!(saved.version >= 2) && d.markings.fade === 0.3) d.markings.fade = 1;
  // A 0.2.0 project may still say 'outside' from the option that was removed in 0.2.1
  if (!(saved.version >= 3)) d.reliefSide = 'inside';
  if (d.reliefSide !== 'outside') d.reliefSide = 'inside';
  d.version = 3;
  return d;
}
