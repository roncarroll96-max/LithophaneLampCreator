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
 * Grid spacing for meshing `bounds`: `minStep`, or coarser when that grid would have more than
 * `maxCells` points (keeps very big bases from taking minutes).
 */
export function gridStep(bounds, minStep, maxCells) {
  const vol = [0, 1, 2].reduce((v, a) => v * (bounds.max[a] - bounds.min[a] + 4 * minStep), 1);
  return Math.max(minStep, Math.cbrt(vol / maxCells));
}

/**
 * Surface nets: samples f on a grid with spacing `step` over bounds { min:[x,y,z], max:[x,y,z] }
 * (padded so the outside is all outside), puts one vertex in every grid cell the surface passes
 * through (the average of where it crosses the cell's edges) and one quad across every grid edge
 * where the inside/outside changes. The result is a closed mesh with outward-facing triangles:
 * { positions: Float32Array, indices: Uint32Array, bbox, triangles, volume }.
 */
export function meshSdf(f, bounds, step, { skip = true } = {}) {
  const pad = 2 * step;
  const x0 = bounds.min[0] - pad, y0 = bounds.min[1] - pad, z0 = bounds.min[2] - pad;
  const nx = Math.ceil((bounds.max[0] + pad - x0) / step) + 1;
  const ny = Math.ceil((bounds.max[1] + pad - y0) / step) + 1;
  const nz = Math.ceil((bounds.max[2] + pad - z0) / step) + 1;
  const NXY = nx * ny, CX = nx - 1, NC = CX * (ny - 1);

  // Speed-up: f is checked once in the middle of each block of B x B x B grid points. Far from
  // the surface (with a 2x safety margin over the block's reach and a cell's diagonal) the whole
  // block is inside or outside, and no cell next to it can be crossed by the surface, so it is
  // filled without evaluating f point by point. The mesh comes out exactly the same.
  const B = 4, bnx = Math.ceil(nx / B), bny = Math.ceil(ny / B);
  const reach = 2 * Math.sqrt(3) * step * (B / 2 + 1);
  const blockVal = new Float64Array(bnx * bny);
  function layer(k, out) {
    const z = z0 + k * step;
    if (skip && k % B === 0) {
      const zc = z0 + (k + (B - 1) / 2) * step;
      for (let bj = 0; bj < bny; bj++) for (let bi = 0; bi < bnx; bi++) {
        blockVal[bj * bnx + bi] = f(x0 + (bi * B + (B - 1) / 2) * step, y0 + (bj * B + (B - 1) / 2) * step, zc);
      }
    }
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * step, row = ((j / B) | 0) * bnx;
      for (let i = 0; i < nx; i++) {
        if (skip) {
          const bv = blockVal[row + ((i / B) | 0)];
          if (bv > reach || bv < -reach) { out[j * nx + i] = bv; continue; }
        }
        let v = f(x0 + i * step, y, z);
        if (v === 0) v = 1e-9; // keep the sign well defined
        out[j * nx + i] = v;
      }
    }
  }

  // Growable typed buffers (plain arrays of millions of numbers use several times the memory)
  let pos = new Float32Array(1 << 16), nPos = 0;
  let tris = new Uint32Array(1 << 17), nTris = 0;
  const addPos = (x, y, z) => {
    if (nPos + 3 > pos.length) { const g = new Float32Array(pos.length * 2); g.set(pos); pos = g; }
    pos[nPos++] = x; pos[nPos++] = y; pos[nPos++] = z;
  };
  const quad = (a, b, c, d, flip) => {
    if (nTris + 6 > tris.length) { const g = new Uint32Array(tris.length * 2); g.set(tris); tris = g; }
    if (flip) { tris[nTris++] = a; tris[nTris++] = c; tris[nTris++] = b; tris[nTris++] = a; tris[nTris++] = d; tris[nTris++] = c; }
    else { tris[nTris++] = a; tris[nTris++] = b; tris[nTris++] = c; tris[nTris++] = a; tris[nTris++] = c; tris[nTris++] = d; }
  };

  // Works through the grid one layer at a time, keeping only two layers of values and two layers
  // of cells in memory (the whole grid of a big base would need well over a gigabyte).
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  /** One vertex per cell (between value layers A = k and Bv = k + 1) that the surface crosses. */
  function cells(A, Bv, k, out) {
    out.fill(-1);
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      let neg = 0;
      for (let c = 0; c < 8; c++) {
        const cc = corner[c];
        cv[c] = (cc[2] ? Bv : A)[(j + cc[1]) * nx + i + cc[0]];
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
      out[j * CX + i] = nPos / 3;
      addPos(x0 + (i + sx / n) * step, y0 + (j + sy / n) * step, z0 + (k + sz / n) * step);
    }
  }
  // One quad per grid edge with a sign change, joining the four cells around that edge.
  // Seen from the outside end of the edge, the four cells are listed counter-clockwise.
  // V: values at this point layer, Vn: the layer above; Cb, Ct: cells below and above it.
  function quads(V, Vn, Cb, Ct) {
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const in0 = V[j * nx + i] < 0;
      if (in0 !== (V[j * nx + i + 1] < 0)) { // edge along +X
        quad(Cb[(j - 1) * CX + i], Cb[j * CX + i], Ct[j * CX + i], Ct[(j - 1) * CX + i], !in0);
      }
      if (in0 !== (V[(j + 1) * nx + i] < 0)) { // edge along +Y
        quad(Cb[j * CX + i - 1], Ct[j * CX + i - 1], Ct[j * CX + i], Cb[j * CX + i], !in0);
      }
      if (in0 !== (Vn[j * nx + i] < 0)) { // edge along +Z
        quad(Ct[(j - 1) * CX + i - 1], Ct[(j - 1) * CX + i], Ct[j * CX + i], Ct[j * CX + i - 1], !in0);
      }
    }
  }
  let Vprev = new Float32Array(NXY), Vcur = new Float32Array(NXY);
  let Cprev = new Int32Array(NC), Ccur = new Int32Array(NC);
  layer(0, Vprev);
  for (let k = 1; k < nz; k++) {
    layer(k, Vcur);
    cells(Vprev, Vcur, k - 1, Ccur);
    if (k >= 2) quads(Vprev, Vcur, Cprev, Ccur);
    [Vprev, Vcur] = [Vcur, Vprev];
    [Cprev, Ccur] = [Ccur, Cprev];
  }

  const positions = pos.slice(0, nPos);
  const indices = tris.slice(0, nTris);
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
