// Builds the printable, watertight mesh of a flat panel: the smooth front, the picture relief on
// the back, and the edge between them, as one closed solid, plus optional feet.
//
// Like the lamps, both faces are rings round the middle of the panel (s = 0 on the outline,
// s = 1 in the middle), so the same ring planner and stitcher are used. Followed as one loop:
//   middle (front) -> front rings out to the edge -> back rings in to -> middle (back).
// The panel stands on its bottom edge for printing (z = 0), centred on x = 0.

import { TWO_PI } from './shapes.js';
import { planRings, stitch, TriList, stitchCapacity } from './mesh.js';

/** Signed volume of a triangle list (positive when the triangles face outward). */
function signedVolume(p, idx, from = 0) {
  let vol = 0;
  for (let t = from; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    vol += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
         - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
         + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return vol / 6;
}

/**
 * opts: { panel, field, stepInner, stepOuter, feet: [{ u, width, front, back, height }], onProgress }
 * Returns { positions: Float32Array, indices: Uint32Array, bbox, triangles, volume }.
 */
export function buildPanelMesh({ panel, field, stepInner, stepOuter, feet = [], onProgress }) {
  const planO = planRings(panel, stepOuter);
  const planI = planRings(panel, stepInner);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const totalVerts = sum(planO.counts) + sum(planI.counts) + 2 + 8 * feet.length;
  const pos = new Float32Array(totalVerts * 3);
  let vCount = 0;
  const addV = (x, y, z) => { const o = vCount * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; return vCount++; };

  const ev = {};
  const totalRings = planO.K + planI.K;
  let ringsDone = 0;
  const progress = () => { ringsDone++; if (onProgress && ringsDone % 16 === 0) onProgress(0.85 * ringsDone / totalRings); };

  const ringsOf = (plan, inner) => {
    const rings = [];
    for (let k = 0; k < plan.K; k++) {
      const n = plan.counts[k], s = k / plan.K, ring = new Uint32Array(n);
      for (let j = 0; j < n; j++) {
        field.eval((j / n) * TWO_PI, s, ev);
        ring[j] = inner ? addV(ev.ix, ev.iy, ev.iz) : addV(ev.x, ev.y, ev.z);
      }
      rings.push(ring); progress();
    }
    field.eval(0, 1, ev);
    return { rings, pole: inner ? addV(ev.ix, ev.iy, ev.iz) : addV(ev.x, ev.y, ev.z) };
  };
  const front = ringsOf(planO, false);
  const back = ringsOf(planI, true);

  const seq = [Uint32Array.of(front.pole)];
  for (let k = front.rings.length - 1; k >= 0; k--) seq.push(front.rings[k]);
  for (let k = 0; k < back.rings.length; k++) seq.push(back.rings[k]);
  seq.push(Uint32Array.of(back.pole));
  const tris = new TriList(stitchCapacity(seq) + 12 * feet.length);
  for (let r = 0; r + 1 < seq.length; r++) stitch(seq[r], seq[r + 1], tris);
  if (onProgress) onProgress(0.9);

  const body = tris.done();
  if (signedVolume(pos, body) < 0) {
    for (let t = 0; t < body.length; t += 3) { const x = body[t + 1]; body[t + 1] = body[t + 2]; body[t + 2] = x; }
  }

  // ---- Feet: separate closed blocks overlapping the bottom edge (slicers merge them)
  const S = {};
  for (const f of feet) {
    panel.surfAt(f.u, panel.bottom, S);
    const tx = -S.ny, ty = S.nx; // along the panel, to the right (front normal turned 90°)
    const bx = -S.nx, by = -S.ny; // toward the back
    const v0 = vCount;
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const side = k & 1 ? f.width / 2 : -f.width / 2;
      const depth = k & 2 ? f.back : -f.front;
      const z = k & 4 ? panel.bottom + f.height : panel.bottom;
      addV(S.x + tx * side + bx * depth, S.y + ty * side + by * depth, z);
    }
    // Box faces as quads of corner numbers (bit 0 = right, bit 1 = back, bit 2 = top)
    const quads = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
    const start = tris.length;
    for (const [a, b, c, d] of quads) { tris.push(v0 + a, v0 + b, v0 + c); tris.push(v0 + a, v0 + c, v0 + d); }
    const part = tris.a.subarray(start, tris.length);
    if (signedVolume(pos, part) < 0) {
      for (let t = 0; t < part.length; t += 3) { const x = part[t + 1]; part[t + 1] = part[t + 2]; part[t + 2] = x; }
    }
  }
  const indices = tris.done();

  // ---- Stand it on the bed: bottom edge at z = 0, centred left to right
  let x0 = Infinity, x1 = -Infinity, zMin = Infinity;
  for (let v = 0; v < vCount; v++) {
    x0 = Math.min(x0, pos[v * 3]); x1 = Math.max(x1, pos[v * 3]); zMin = Math.min(zMin, pos[v * 3 + 2]);
  }
  const cx = (x0 + x1) / 2;
  const positions = pos.subarray(0, vCount * 3); // moved in place (no second copy)
  for (let v = 0; v < vCount; v++) { positions[v * 3] -= cx; positions[v * 3 + 2] -= zMin; }
  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let v = 0; v < vCount; v++) for (let a = 0; a < 3; a++) {
    const x = positions[v * 3 + a];
    if (x < bbox.min[a]) bbox.min[a] = x;
    if (x > bbox.max[a]) bbox.max[a] = x;
  }
  if (onProgress) onProgress(1);
  return { positions, indices, bbox, triangles: indices.length / 3, volume: Math.abs(signedVolume(positions, indices)) };
}
