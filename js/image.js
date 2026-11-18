// Photo loading and lithophane adjustments (browser only).
// Output is a grey "brightness map" (Float32Array, 0 = darkest/thickest .. 1 = brightest/thinnest).

const MAX_SIDE = 2400; // enough for Large balls at Fine detail

const isSvg = (blob) => blob.type === 'image/svg+xml' || /\.svg$/i.test(blob.name || '');

/**
 * SVGs have no fixed pixel size: browsers draw them at whatever width/height the file lists,
 * which can be tiny. Draw them at MAX_SIDE on the long side instead, keeping their shape.
 */
async function rasterizeSvg(blob) {
  const doc = new DOMParser().parseFromString(await blob.text(), 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('That SVG file could not be read.');
  let w = 0, h = 0;
  const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; }
  else { w = parseFloat(svg.getAttribute('width')) || 0; h = parseFloat(svg.getAttribute('height')) || 0; }
  if (!(w > 0 && h > 0)) { w = 1; h = 1; }
  if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const scale = MAX_SIDE / Math.max(w, h);
  const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decodes an image file (JPG/PNG/WebP/SVG, HEIC where the browser supports it). */
export async function decodeImage(blob) {
  if (isSvg(blob)) {
    try { return await rasterizeSvg(blob); } catch { /* fall through to the normal path */ }
  }
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    // Fallback through an <img> element
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new Error('This browser could not open that picture. Try a JPG or PNG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Draws the image scaled down to MAX_SIDE and returns its luminance (0..1). */
export function extractLuma(image) {
  const iw = image.width || image.naturalWidth, ih = image.height || image.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale)), h = Math.max(1, Math.round(ih * scale));
  const canvas = new OffscreenCanvasOr(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
    // Rec. 709 luma on gamma-encoded values (matches how people judge brightness)
    lum[i] = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255;
  }
  return { w, h, lum, originalW: iw, originalH: ih };
}

function OffscreenCanvasOr(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Automatic adjustments: black/white points from the histogram, gamma that centres the midtones. */
export function autoAdjust(base) {
  const bins = 1024, hist = new Uint32Array(bins);
  const { lum } = base;
  for (let i = 0; i < lum.length; i++) hist[Math.min(bins - 1, (lum[i] * bins) | 0)]++;
  const pct = (q) => {
    const target = q * lum.length; let acc = 0;
    for (let b = 0; b < bins; b++) { acc += hist[b]; if (acc >= target) return b / (bins - 1); }
    return 1;
  };
  let blackPoint = pct(0.005), whitePoint = pct(0.995);
  if (whitePoint - blackPoint < 0.1) { blackPoint = 0; whitePoint = 1; }
  const median = Math.min(0.95, Math.max(0.05, (pct(0.5) - blackPoint) / (whitePoint - blackPoint)));
  let gamma = Math.log(median) / Math.log(0.5);
  gamma = Math.min(1.8, Math.max(0.7, gamma));
  return {
    blackPoint: +blackPoint.toFixed(3), whitePoint: +whitePoint.toFixed(3),
    gamma: +gamma.toFixed(2), brightness: 0, contrast: 1, sharpen: 0.6,
  };
}

/** Separable box blur, 3 passes ≈ Gaussian. */
function blur(src, w, h, r) {
  if (r < 1) return src.slice();
  const a = src.slice(), b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const n = horizontal ? w : h, m = horizontal ? h : w;
    const step = horizontal ? 1 : w, lineStep = horizontal ? w : 1;
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < m; l++) {
      const o = l * lineStep;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += from[o + Math.min(n - 1, Math.max(0, k)) * step];
      for (let i = 0; i < n; i++) {
        to[o + i * step] = acc * inv;
        const add = Math.min(n - 1, i + r + 1), sub = Math.max(0, i - r);
        acc += from[o + add * step] - from[o + sub * step];
      }
    }
  };
  for (let it = 0; it < 3; it++) { pass(a, b, true); pass(b, a, false); }
  return a;
}

/** Applies the tone settings and sharpening. Returns { w, h, data }. */
export function processPhoto(base, p) {
  const { w, h, lum } = base;
  const out = new Float32Array(lum.length);
  const bp = p.blackPoint, range = Math.max(0.01, p.whitePoint - p.blackPoint);
  const invGamma = 1 / Math.max(0.1, p.gamma);
  for (let i = 0; i < lum.length; i++) {
    let v = (lum[i] - bp) / range;
    v = (v - 0.5) * p.contrast + 0.5 + p.brightness;
    v = v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, invGamma);
    out[i] = v;
  }
  if (p.sharpen > 0) {
    const r = Math.max(1, Math.round(Math.max(w, h) / 900));
    const soft = blur(out, w, h, r);
    const k = p.sharpen * 1.5;
    for (let i = 0; i < out.length; i++) out[i] = out[i] + k * (out[i] - soft[i]);
  }
  for (let i = 0; i < out.length; i++) {
    let v = out[i];
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    out[i] = p.invert ? 1 - v : v;
  }
  return { w, h, data: out };
}

/** Draws a 0..1 grey map into a canvas (for the photo panel). */
export function drawGray(canvas, map, maxW = 640) {
  const scale = Math.min(1, maxW / map.w);
  const w = Math.max(1, Math.round(map.w * scale)), h = Math.max(1, Math.round(map.h * scale));
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const src = map.data || map.lum;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(map.h - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const v = src[sy * map.w + Math.min(map.w - 1, Math.floor(x / scale))] * 255;
      const o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
