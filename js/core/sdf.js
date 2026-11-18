// Solid shapes described by signed distance functions (negative inside, positive outside),
// combined with union / subtract, and turned into a closed triangle mesh with "surface nets".
// Used for the lamp base, which is a mix of cylinders, boxes, cones and cut-outs.
// No DOM here: runs in the browser, the export worker and Node tests.

// ---------------------------------------------------------------- primitives
// Each returns f(x, y, z). Distances are exact on flat sides and close elsewhere, which is all
// the mesher needs (it only uses where the sign changes).

/** Vertical cylinder of radius r around (cx, cy), from z0 to z1. */
export const cylinder = (r, z0, z1, cx = 0, cy = 0) => (x, y, z) =>
  Math.max(Math.hypot(x - cx, y - cy) - r, z0 - z, z - z1);

/** Box from (x0, y0, z0) to (x1, y1, z1). */
export const box = (x0, x1, y0, y1, z0, z1) => (x, y, z) =>
  Math.max(x0 - x, x - x1, y0 - y, y - y1, z0 - z, z - z1);

/** Vertical square prism of half size h with corners rounded by rc, from z0 to z1. */
export const roundedSquare = (h, rc, z0, z1) => (x, y, z) => {
  const qx = Math.abs(x) - (h - rc), qy = Math.abs(y) - (h - rc);
  const d2 = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc;
  return Math.max(d2, z0 - z, z - z1);
};

/**
 * Vertical cone: radius r0 at height z0, changing by `slope` mm of radius per mm of height
 * (negative = narrowing upward), cut at z0 and z1. With slope -1 the side is at 45°.
 */
export const cone = (r0, slope, z0, z1) => (x, y, z) =>
  Math.max((Math.hypot(x, y) - (r0 + slope * (z - z0))) / Math.sqrt(1 + slope * slope), z0 - z, z - z1);

export const union = (...fs) => (x, y, z) => { let d = Infinity; for (const f of fs) d = Math.min(d, f(x, y, z)); return d; };
export const subtract = (a, ...bs) => (x, y, z) => { let d = a(x, y, z); for (const b of bs) d = Math.max(d, -b(x, y, z)); return d; };

// ---------------------------------------------------------------- mesher
/**
 * Surface nets: samples f on a grid with spacing `step` over bounds { min:[x,y,z], max:[x,y,z] }
 * (padded so the outside is all outside), puts one vertex in every grid cell the surface passes
 * through (the average of where it crosses the cell's edges) and one quad across every grid edge
 * where the inside/outside changes. The result is a closed mesh with outward-facing triangles:
 * { positions: Float32Array, indices: Uint32Array, bbox, triangles, volume }.
 */
export function meshSdf(f, bounds, step) {
  const pad = 2 * step;
  const x0 = bounds.min[0] - pad, y0 = bounds.min[1] - pad, z0 = bounds.min[2] - pad;
  const nx = Math.ceil((bounds.max[0] + pad - x0) / step) + 1;
  const ny = Math.ceil((bounds.max[1] + pad - y0) / step) + 1;
  const nz = Math.ceil((bounds.max[2] + pad - z0) / step) + 1;
  const V = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) {
    const z = z0 + k * step;
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * step;
      for (let i = 0; i < nx; i++) {
        let v = f(x0 + i * step, y, z);
        if (v === 0) v = 1e-9; // keep the sign well defined
        V[at(i, j, k)] = v;
      }
    }
  }

  // One vertex per cell that the surface crosses
  const cellId = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cat = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) {
      cv[c] = V[at(i + corner[c][0], j + corner[c][1], k + corner[c][2])];
      if (cv[c] < 0) neg++;
    }
    if (neg === 0 || neg === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t;
      sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t;
      sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t;
      n++;
    }
    cellId[cat(i, j, k)] = pos.length / 3;
    pos.push(x0 + (i + sx / n) * step, y0 + (j + sy / n) * step, z0 + (k + sz / n) * step);
  }

  // One quad per grid edge with a sign change, joining the four cells around that edge.
  // Seen from the outside end of the edge, the four cells are listed counter-clockwise.
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (flip) tris.push(a, c, b, a, d, c);
    else tris.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const v0 = V[at(i, j, k)];
    const in0 = v0 < 0;
    if (i < nx - 1 && in0 !== (V[at(i + 1, j, k)] < 0)) { // edge along +X
      quad(cellId[cat(i, j - 1, k - 1)], cellId[cat(i, j, k - 1)], cellId[cat(i, j, k)], cellId[cat(i, j - 1, k)], !in0);
    }
    if (j < ny - 1 && in0 !== (V[at(i, j + 1, k)] < 0)) { // edge along +Y
      quad(cellId[cat(i - 1, j, k - 1)], cellId[cat(i - 1, j, k)], cellId[cat(i, j, k)], cellId[cat(i, j, k - 1)], !in0);
    }
    if (k < nz - 1 && in0 !== (V[at(i, j, k + 1)] < 0)) { // edge along +Z
      quad(cellId[cat(i - 1, j - 1, k)], cellId[cat(i, j - 1, k)], cellId[cat(i, j, k)], cellId[cat(i - 1, j, k)], !in0);
    }
  }

  const positions = Float32Array.from(pos);
  const indices = Uint32Array.from(tris);
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    vol += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
         - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
         + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  vol /= 6;
  if (vol < 0) { // should not happen; keep triangles facing outward regardless
    for (let t = 0; t < indices.length; t += 3) { const x = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = x; }
    vol = -vol;
  }
  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let p = 0; p < positions.length; p += 3) for (let a = 0; a < 3; a++) {
    if (positions[p + a] < bbox.min[a]) bbox.min[a] = positions[p + a];
    if (positions[p + a] > bbox.max[a]) bbox.max[a] = positions[p + a];
  }
  return { positions, indices, bbox, triangles: indices.length / 3, volume: vol };
}
