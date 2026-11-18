// Default project settings, size presets and helpers shared by the UI and the export worker.

export const SIZE_PRESETS = {
  S: { label: 'Small', diameter: 100, footballLength: 160, footballWidth: 100 },
  M: { label: 'Medium', diameter: 150, footballLength: 240, footballWidth: 150 },
  L: { label: 'Large', diameter: 200, footballLength: 280, footballWidth: 175 },
};

export const SHAPES = {
  basketball: { label: 'Basketball', body: 'sphere', markings: 'basketball', ready: true },
  sphere: { label: 'Plain sphere', body: 'sphere', markings: 'none', ready: true },
  soccer: { label: 'Soccer ball', body: 'sphere', markings: 'soccer', ready: true },
  football: { label: 'Football', body: 'football', markings: 'football', ready: true },
  baseball: { label: 'Baseball / softball', body: 'sphere', markings: 'baseball', ready: true },
  volleyball: { label: 'Volleyball', body: 'sphere', markings: 'volleyball', ready: true },
  moon: { label: 'Moon', body: 'sphere', markings: 'moon', ready: true },
};

/** Export detail presets: spacing between mesh points on the photo surface (mm). */
export const DETAIL_PRESETS = {
  draft: { label: 'Draft', step: 0.5 },
  standard: { label: 'Standard', step: 0.3 },
  fine: { label: 'Fine', step: 0.2 },
};

export function defaultSettings() {
  return {
    version: 1,
    shape: 'basketball',
    sizePreset: 'M',
    diameter: 150,
    footballLength: 240,
    footballWidth: 150,
    footballTip: 0.6,         // 0 = smooth oval .. 1 = most pointed (still printable)
    footballStripes: true,    // bright end stripes
    tMin: 0.8,
    tMax: 3.0,
    opening: { diameter: 50, collarHeight: 5, collarWall: 2.0 },
    photo: {
      auto: true,
      blackPoint: 0, whitePoint: 1,
      brightness: 0, contrast: 1, gamma: 1, sharpen: 0.6,
      invert: false,
      zoom: 1, panX: 0, panY: 0, rotate: 0,
      coverage: 140,          // degrees around the ball the photo window spans
      aspect: null,           // window height / width; null = match the photo
      centerY: 0,             // window centre height above the equator (mm)
      feather: 8,             // soft edge width (mm)
      windowShape: 'rect',    // 'rect' | 'oval'
      projection: 'natural',  // 'natural' (no squeeze) | 'wrap' (fills 360°)
      surround: 0.55,         // brightness of the plain ball outside the photo (0 dark .. 1 bright)
      background: 'blend',    // cut-out photos: transparent areas 'blend' into the ball | 'bright' | 'dark'
      edgeSoft: 2,            // cut-out photos: how gently the subject's outline fades (mm)
    },
    markings: {
      style: 'carved',        // 'carved' | 'raised' | 'off'
      width: null,            // mm; null = 2% of the ball size
      darkness: 1,            // carved lines: 0..1
      raise: 1.0,             // raised lines: height in mm
      fade: 0.3,              // how much lines fade inside the photo (0..1)
      panelDark: 0.5,         // soccer: how much darker the pentagons glow (0 = same as hexagons)
      yaw: 60, pitch: 20, roll: 0,
    },
    texts: [],                // text items (see core/textLayer.js defaultTextItem)
    moon: {
      mode: 'moon',           // 'moon' (Moon only) | 'photo' (photo in a front window, fading into the Moon)
      craters: 0.4,           // how strongly NASA's height map deepens craters (0..1)
      spin: 0,                // degrees; turns the Moon (0 = the side that faces Earth at the front)
    },
    bed: { x: 256, y: 256, z: 256 },
    detail: 'standard',
  };
}

/** Semi-axes of the shape body for the current settings. */
export function bodyAxes(settings) {
  const body = SHAPES[settings.shape]?.body || 'sphere';
  if (body === 'football') {
    const a = settings.footballLength / 2, b = settings.footballWidth / 2;
    const tip = Math.max(0, Math.min(1, settings.footballTip ?? 0.6));
    return { a, b, c: b, kind: 'football', tipN: 2 - 0.8 * tip };
  }
  const r = settings.diameter / 2;
  return { a: r, b: r, c: r, kind: 'sphere' };
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
  return d;
}
