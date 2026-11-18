// Draws text items into coverage masks (browser only: needs the bundled fonts and a canvas).
// The masks are mapped onto the ball by core/textLayer.js.

import { TEXT_FONTS, TEXT_OUTLINE_MM, TEXT_GAP_MM, TEXT_MM_PER_PX, maskKey } from './core/textLayer.js';

const fontLoads = new Map(); // font key -> Promise<void>

/** Loads a bundled font once. Resolves even if it fails (the browser then uses a fallback). */
export function loadFont(key) {
  const f = TEXT_FONTS[key] || TEXT_FONTS.varsity;
  if (!fontLoads.has(key)) {
    const face = new FontFace(f.family, `url(${new URL(`../vendor/fonts/${f.file}`, import.meta.url)})`, { weight: String(f.weight) });
    fontLoads.set(key, face.load().then((ff) => { document.fonts.add(ff); }).catch((err) => {
      console.warn('Font failed to load:', f.file, err);
    }));
  }
  return fontLoads.get(key);
}

/** Starts loading every bundled font (so the Text tab can show each font in its own style). */
export const loadAllFonts = () => Promise.all(Object.keys(TEXT_FONTS).map(loadFont));

const cache = new Map(); // item id -> { key, mask }

/**
 * Returns masks for every item with text, reusing ones whose text/font/size/arc are unchanged.
 * Result: { [id]: { w, h, mmPerPx, cx, cy, letters, halo, clear } }
 */
export async function buildTextMasks(items) {
  const out = {};
  const live = new Set();
  for (const it of items || []) {
    if (!it.text || !it.text.trim()) continue;
    live.add(it.id);
    const key = maskKey(it);
    const hit = cache.get(it.id);
    if (hit && hit.key === key) { out[it.id] = hit.mask; continue; }
    await loadFont(it.font);
    const mask = renderMask(it);
    cache.set(it.id, { key, mask });
    out[it.id] = mask;
  }
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
  return out;
}

/** True when every item with text already has an up-to-date mask in `masks`. */
export function masksCurrent(items, masks) {
  for (const it of items || []) {
    if (!it.text || !it.text.trim()) continue;
    const hit = cache.get(it.id);
    if (!masks || !masks[it.id] || !hit || hit.key !== maskKey(it) || hit.mask !== masks[it.id]) return false;
  }
  return true;
}

function renderMask(it) {
  const f = TEXT_FONTS[it.font] || TEXT_FONTS.varsity;
  const ppm = 1 / TEXT_MM_PER_PX;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${f.weight} 100px ${f.family}`;
  const capRatio = (probe.measureText('H').actualBoundingBoxAscent || 72) / 100;
  const fontPx = (it.size * ppm) / capRatio;
  const fontCss = `${f.weight} ${fontPx}px ${f.family}`;
  probe.font = fontCss;

  // Glyph layout in mm, y up, text centre at (0, 0). Letters are centred on their cap height.
  const capMm = it.size;
  const asc = (probe.measureText('Hgjy').actualBoundingBoxAscent || fontPx) / ppm;
  const desc = (probe.measureText('Hgjy').actualBoundingBoxDescent || fontPx * 0.3) / ppm;
  const chars = [...it.text];
  const widths = chars.map((ch) => probe.measureText(ch).width / ppm);
  const total = probe.measureText(it.text).width / ppm; // whole-string width keeps kerning
  const A = (it.arc * Math.PI) / 180;
  const glyphs = [];
  if (Math.abs(A) < 1e-3) {
    glyphs.push({ text: it.text, x: 0, y: 0, rot: 0, w: total });
  } else {
    const sum = widths.reduce((a, b) => a + b, 0) || 1;
    const R = sum / Math.abs(A);
    let pos = -sum / 2;
    for (let i = 0; i < chars.length; i++) {
      const phi = (pos + widths[i] / 2) / R;
      pos += widths[i];
      if (A > 0) glyphs.push({ text: chars[i], x: R * Math.sin(phi), y: R * Math.cos(phi) - R, rot: -phi, w: widths[i] });
      else glyphs.push({ text: chars[i], x: R * Math.sin(phi), y: R - R * Math.cos(phi), rot: phi, w: widths[i] });
    }
  }

  // Bounds of all glyph boxes, plus room for the gap around the letters
  const pad = TEXT_GAP_MM + 1;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const g of glyphs) {
    const c = Math.cos(g.rot), s = Math.sin(g.rot);
    for (const [lx, ly] of [[-g.w / 2, -capMm / 2 - desc], [g.w / 2, -capMm / 2 - desc], [-g.w / 2, asc - capMm / 2], [g.w / 2, asc - capMm / 2]]) {
      const x = g.x + lx * c - ly * s, y = g.y + lx * s + ly * c;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  }
  // Keep the text centre at the mask centre so rotation turns it about its middle
  const halfW = Math.max(-minX, maxX) + pad, halfH = Math.max(-minY, maxY) + pad;
  const w = Math.ceil(2 * halfW * ppm), h = Math.ceil(2 * halfH * ppm);
  const cx = w / 2, cy = h / 2;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const pass = (strokeMm) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = strokeMm * 2 * ppm;
    ctx.font = fontCss; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const g of glyphs) {
      ctx.setTransform(1, 0, 0, 1, cx + g.x * ppm, cy - g.y * ppm);
      ctx.rotate(-g.rot);
      // baseline sits half a cap height below the glyph centre
      if (strokeMm > 0) ctx.strokeText(g.text, 0, (capMm / 2) * ppm);
      ctx.fillText(g.text, 0, (capMm / 2) * ppm);
    }
    const px = ctx.getImageData(0, 0, w, h).data;
    const a = new Float32Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = px[i * 4] / 255;
    return a;
  };
  return {
    w, h, cx, cy, mmPerPx: TEXT_MM_PER_PX,
    letters: pass(0), halo: pass(TEXT_OUTLINE_MM), clear: pass(TEXT_GAP_MM),
  };
}
