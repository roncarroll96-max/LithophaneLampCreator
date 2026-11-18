// Preview data (no Three.js): a light grid mesh of the outer surface plus a "glow" texture
// in (theta, s) space that shows how bright each spot will be when lit from below.

import { TWO_PI } from './shapes.js';

export const MU = 1.1; // light absorption of white PLA per mm (approx.)

/** Grid over (theta, s). Column NT duplicates column 0 so the texture wraps cleanly. */
export function buildPreviewGrid(field, NT = 360, NS = 180) {
  const cols = NT + 1, rows = NS + 1;
  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const ev = {};
  for (let i = 0; i < rows; i++) {
    const s = i / NS;
    for (let j = 0; j < cols; j++) {
      field.eval((j / NT) * TWO_PI, s, ev);
      const v = i * cols + j;
      positions[v * 3] = ev.x; positions[v * 3 + 1] = ev.y; positions[v * 3 + 2] = ev.z;
      uvs[v * 2] = j / NT; uvs[v * 2 + 1] = s;
    }
  }
  const indices = new Uint32Array(NT * NS * 6);
  let o = 0;
  for (let i = 0; i < NS; i++) for (let j = 0; j < NT; j++) {
    const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
    // outward-facing when viewed from outside (theta increases counter-clockwise from above)
    indices[o++] = a; indices[o++] = b; indices[o++] = d;
    indices[o++] = a; indices[o++] = d; indices[o++] = c;
  }
  return { positions, uvs, indices };
}

/**
 * Glow texture, RGBA8, width TW over theta and height TH over s.
 * mode 'glow' = simulated backlight brightness; 'thickness' = grey map of wall thickness.
 */
export function buildGlowTexture(field, settings, TW, TH, mode = 'glow') {
  const data = new Uint8Array(TW * TH * 4);
  const ev = {};
  const { tMin, tMax } = settings;
  for (let y = 0; y < TH; y++) {
    const s = (y + 0.5) / TH;
    const falloff = 1.12 - 0.3 * s; // the light sits below the ball
    for (let x = 0; x < TW; x++) {
      field.eval(((x + 0.5) / TW) * TWO_PI, s, ev);
      const wall = ev.t + ev.raise; // raised markings add to the total wall the light passes through
      let v;
      if (mode === 'thickness') v = 1 - (wall - tMin) / (tMax - tMin + 0.4);
      else v = Math.exp(-MU * (wall - tMin)) * falloff;
      const g = Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2));
      const o = (y * TW + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = g; data[o + 3] = 255;
    }
  }
  return data;
}
