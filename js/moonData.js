// Loads the bundled NASA Moon maps (browser only) and prepares them with core/moon.js.

import { prepareMoon } from './core/moon.js';

async function loadGrey(file) {
  const url = new URL(`../vendor/moon/${file}`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Moon map missing (${file})`);
  const bmp = await createImageBitmap(await res.blob());
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, c.width, c.height).data;
  const data = new Float32Array(c.width * c.height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    data[i] = (0.2126 * px[j] + 0.7152 * px[j + 1] + 0.0722 * px[j + 2]) / 255;
  }
  bmp.close?.();
  return { w: c.width, h: c.height, data };
}

let pending = null;
/** Loads and prepares the Moon once; later calls return the same result. */
export function loadMoon() {
  if (!pending) {
    pending = Promise.all([loadGrey('lroc_color_2k.jpg'), loadGrey('ldem_3_8bit.jpg')])
      .then(([albedo, height]) => prepareMoon(albedo, height))
      .catch((err) => { pending = null; throw err; });
  }
  return pending;
}
