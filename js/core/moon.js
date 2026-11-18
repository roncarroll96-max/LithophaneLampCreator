// Moon surface for the Moon shape, built from two NASA maps (vendor/moon, from NASA's
// Scientific Visualization Studio "CGI Moon Kit"):
//   - lroc_color_2k.jpg: surface brightness as seen from Earth (dark maria, bright highlands)
//   - ldem_3_8bit.jpg:   height map, used to deepen craters
// Both are equirectangular: longitude -180..180 left to right (0 = the side facing Earth),
// latitude +90 at the top. No DOM here: the browser decodes the JPEGs (js/moonData.js).

function percentile(data, q) {
  const bins = 2048, hist = new Uint32Array(bins);
  for (let i = 0; i < data.length; i++) hist[Math.min(bins - 1, Math.max(0, (data[i] * bins) | 0))]++;
  const target = q * data.length;
  let acc = 0;
  for (let b = 0; b < bins; b++) { acc += hist[b]; if (acc >= target) return b / (bins - 1); }
  return 1;
}

function boxBlurWrap(src, w, h, r) {
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { // horizontal, wrapping around in longitude
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += a[y * w + ((k % w) + w) % w];
      for (let x = 0; x < w; x++) {
        b[y * w + x] = acc / (2 * r + 1);
        acc += a[y * w + (x + r + 1) % w] - a[y * w + ((x - r) % w + w) % w];
      }
    }
    for (let x = 0; x < w; x++) { // vertical, clamped at the poles
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += b[Math.max(0, Math.min(h - 1, k)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * r + 1);
        acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}

/**
 * Prepares the two maps once: brightness stretched to 0..1, and crater detail (height minus
 * its blurred self, scaled to about -1..1) resampled onto the brightness grid.
 * albedo, height: { w, h, data: Float32Array 0..1 }
 */
export function prepareMoon(albedo, height) {
  const lo = percentile(albedo.data, 0.01), hi = percentile(albedo.data, 0.995);
  const span = Math.max(0.02, hi - lo);
  const base = new Float32Array(albedo.data.length);
  for (let i = 0; i < base.length; i++) base[i] = Math.min(1, Math.max(0, (albedo.data[i] - lo) / span));

  const r = Math.max(2, Math.round(height.w / 170)); // about 2° of the Moon
  const soft = boxBlurWrap(height.data, height.w, height.h, r);
  const hp = new Float32Array(height.data.length);
  let sum2 = 0;
  for (let i = 0; i < hp.length; i++) { hp[i] = height.data[i] - soft[i]; sum2 += hp[i] * hp[i]; }
  const scale = 1 / (3 * Math.sqrt(sum2 / hp.length) || 1);

  const W = albedo.w, H = albedo.h, detail = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const fy = ((y + 0.5) / H) * height.h - 0.5;
    const y0 = Math.max(0, Math.min(height.h - 1, Math.floor(fy))), y1 = Math.min(height.h - 1, y0 + 1), wy = Math.min(1, Math.max(0, fy - y0));
    for (let x = 0; x < W; x++) {
      const fx = ((x + 0.5) / W) * height.w - 0.5;
      const x0 = ((Math.floor(fx) % height.w) + height.w) % height.w, x1 = (x0 + 1) % height.w, wx = fx - Math.floor(fx);
      const v = (hp[y0 * height.w + x0] * (1 - wx) + hp[y0 * height.w + x1] * wx) * (1 - wy)
              + (hp[y1 * height.w + x0] * (1 - wx) + hp[y1 * height.w + x1] * wx) * wy;
      detail[y * W + x] = Math.max(-1, Math.min(1, v * scale));
    }
  }
  return { w: W, h: H, base, detail };
}

/** Combines the prepared maps for a crater depth (0..1). Returns { w, h, data } brightness 0..1. */
export function moonMap(prepared, craters) {
  const { w, h, base, detail } = prepared;
  const k = 0.35 * Math.max(0, Math.min(1, craters));
  const data = new Float32Array(base.length);
  for (let i = 0; i < data.length; i++) data[i] = Math.min(1, Math.max(0, base[i] + k * detail[i]));
  return { w, h, data };
}
