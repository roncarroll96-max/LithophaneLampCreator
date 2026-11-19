// Builds the printable, watertight shell mesh: outer surface, inner (photo relief) surface,
// and the collar around the bottom opening, all stitched into one closed solid.
//
// Cross-section of the closed surface, followed as one loop:
//   top pole (outside) -> outer rings down to the opening edge -> collar outer wall ->
//   flat collar bottom (sits on the print bed) -> collar inner wall -> small ledge ->
//   inner rings up to -> top pole (inside).
// Every ring is a loop of points around the vertical axis; neighbouring rings are joined by
// a "zipper" of triangles, so rings can have different point counts (even density everywhere).

import { TWO_PI } from './shapes.js';

/** Plans ring levels and point counts for a surface sampled every `step` mm. */
export function planRings(shape, step) {
  const K = Math.max(12, Math.ceil(shape.merLenMax / step));
  const counts = new Array(K);
  for (let k = 0; k < K; k++) {
    counts[k] = Math.max(6, Math.ceil(shape.ringPerimeter(k / K) / step));
  }
  return { K, counts };
}

/** Quick triangle-count estimate for file-size display (no heavy work). */
export function estimateTriangles(shape, stepInner, stepOuter) {
  const sum = (plan) => plan.counts.reduce((a, b) => a + b, 0);
  const pi = planRings(shape, stepInner), po = planRings(shape, stepOuter);
  // each ring vertex contributes ~2 triangles; collar adds a few rings
  return 2 * (sum(pi) + sum(po)) + 4 * (pi.counts[0] + po.counts[0]);
}

export const stlBytes = (tris) => 84 + tris * 50;

/** Joins ring A to ring B with triangles. Both rings start at theta=0 and run the same way. */
export function stitch(A, B, out) {
  const na = A.length, nb = B.length;
  let i = 0, j = 0;
  while (i < na || j < nb) {
    const ta = (i + 1) / na, tb = (j + 1) / nb;
    let a, b, c;
    if (j >= nb || (i < na && ta <= tb)) { a = A[i % na]; b = A[(i + 1) % na]; c = B[j % nb]; i++; }
    else { a = A[i % na]; b = B[(j + 1) % nb]; c = B[j % nb]; j++; }
    if (a !== b && b !== c && a !== c) out.push(a, b, c);
  }
}

/**
 * Builds the mesh.
 * opts: { shape, field, stepInner, stepOuter, collar: { ri, ro, height }, onProgress }
 * Returns { positions: Float32Array, indices: Uint32Array, bbox, triangles, volume }
 * The result is moved so the collar bottom sits at z = 0, centred on x/y = 0.
 */
export function buildShellMesh({ shape, field, stepInner, stepOuter, collar, onProgress }) {
  const planO = planRings(shape, stepOuter);
  const planI = planRings(shape, stepInner);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const nO0 = planO.counts[0], nI0 = planI.counts[0];
  const totalVerts = sum(planO.counts) + 1 + sum(planI.counts) + 1 + nO0 + 2 * nI0;
  const pos = new Float64Array(totalVerts * 3);
  let vCount = 0;
  const addV = (x, y, z) => { const o = vCount * 3; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; return vCount++; };

  const ev = {};
  const totalRings = planO.K + planI.K;
  let ringsDone = 0;
  const progress = () => { ringsDone++; if (onProgress && ringsDone % 16 === 0) onProgress(0.85 * ringsDone / totalRings); };

  // ---- Outer surface rings (k = 0 is the opening edge, on the collar cylinder)
  const outer = [];
  for (let k = 0; k < planO.K; k++) {
    const n = planO.counts[k], s = k / planO.K, ring = new Uint32Array(n);
    for (let j = 0; j < n; j++) {
      field.eval((j / n) * TWO_PI, s, ev);
      ring[j] = addV(ev.x, ev.y, ev.z);
    }
    outer.push(ring); progress();
  }
  field.eval(0, 1, ev);
  const poleOut = addV(ev.x, ev.y, ev.z);

  // ---- Inner surface rings (photo relief)
  const inner = [];
  for (let k = 0; k < planI.K; k++) {
    const n = planI.counts[k], s = k / planI.K, ring = new Uint32Array(n);
    for (let j = 0; j < n; j++) {
      field.eval((j / n) * TWO_PI, s, ev);
      ring[j] = addV(ev.ix, ev.iy, ev.iz);
    }
    inner.push(ring); progress();
  }
  field.eval(0, 1, ev);
  const poleIn = addV(ev.ix, ev.iy, ev.iz);

  // ---- Collar
  let zEdgeMin = Infinity;
  for (const v of outer[0]) zEdgeMin = Math.min(zEdgeMin, pos[v * 3 + 2]);
  const zBot = zEdgeMin - collar.height;

  const collarOB = new Uint32Array(nO0);
  for (let j = 0; j < nO0; j++) {
    const v = outer[0][j];
    collarOB[j] = addV(pos[v * 3], pos[v * 3 + 1], zBot);
  }
  const collarIT = new Uint32Array(nI0), collarIB = new Uint32Array(nI0);
  const minLedge = collar.ri + 0.3;
  for (let j = 0; j < nI0; j++) {
    const v = inner[0][j];
    let x = pos[v * 3], y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    let rho = Math.hypot(x, y);
    if (rho < minLedge) { // keep the inner edge outside the opening so the ledge never folds back
      const f = minLedge / rho; x *= f; y *= f; pos[v * 3] = x; pos[v * 3 + 1] = y; rho = minLedge;
    }
    const cx = (x / rho) * collar.ri, cy = (y / rho) * collar.ri;
    collarIT[j] = addV(cx, cy, z);
    collarIB[j] = addV(cx, cy, zBot);
  }

  // ---- Stitch the loop of rings
  const tris = [];
  const seq = [Uint32Array.of(poleOut)];
  for (let k = outer.length - 1; k >= 0; k--) seq.push(outer[k]);
  seq.push(collarOB, collarIB, collarIT);
  for (let k = 0; k < inner.length; k++) seq.push(inner[k]);
  seq.push(Uint32Array.of(poleIn));
  for (let r = 0; r + 1 < seq.length; r++) stitch(seq[r], seq[r + 1], tris);
  if (onProgress) onProgress(0.9);

  // ---- Move onto the bed, compute volume (sign tells us which way the faces point)
  const positions = new Float32Array(vCount * 3);
  for (let v = 0; v < vCount; v++) {
    positions[v * 3] = pos[v * 3];
    positions[v * 3 + 1] = pos[v * 3 + 1];
    positions[v * 3 + 2] = pos[v * 3 + 2] - zBot;
  }
  const indices = Uint32Array.from(tris);
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    vol += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
         - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
         + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  vol /= 6;
  if (vol < 0) { // flip so normals point outward
    for (let t = 0; t < indices.length; t += 3) { const x = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = x; }
    vol = -vol;
  }

  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let v = 0; v < vCount; v++) for (let a = 0; a < 3; a++) {
    const x = positions[v * 3 + a];
    if (x < bbox.min[a]) bbox.min[a] = x;
    if (x > bbox.max[a]) bbox.max[a] = x;
  }
  if (onProgress) onProgress(1);
  return { positions, indices, bbox, triangles: indices.length / 3, volume: vol };
}

/**
 * Turns a finished mesh upside down for printing (the cube prints with its top face on the bed):
 * a half turn about the X axis, (x, y, z) -> (x, -y, height - z). A rotation keeps the triangles
 * facing outward. Updates positions and bbox in place.
 */
export function flipUpsideDown(mesh) {
  const p = mesh.positions, H = mesh.bbox.max[2];
  for (let i = 0; i < p.length; i += 3) { p[i + 1] = -p[i + 1]; p[i + 2] = H - p[i + 2]; }
  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let i = 0; i < p.length; i += 3) for (let a = 0; a < 3; a++) {
    if (p[i + a] < bbox.min[a]) bbox.min[a] = p[i + a];
    if (p[i + a] > bbox.max[a]) bbox.max[a] = p[i + a];
  }
  mesh.bbox = bbox;
  return mesh;
}

/** Checks that every edge is shared by exactly two triangles facing opposite ways. */
export function checkWatertight(indices, vertexCount) {
  const edges = new Map();
  const key = (a, b) => a * vertexCount + b;
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
      const k = key(a, b);
      edges.set(k, (edges.get(k) || 0) + 1);
    }
  }
  let bad = 0;
  for (const [k, n] of edges) {
    const a = Math.floor(k / vertexCount), b = k % vertexCount;
    if (n !== 1 || edges.get(key(b, a)) !== 1) bad++;
  }
  return { ok: bad === 0, badEdges: bad, edges: edges.size / 2 };
}

/** Bounding-box footprint after rotating 45° about Z (for "fits diagonally" checks). */
export function diagonalFootprint(positions) {
  const c = Math.SQRT1_2;
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1];
    const u = (x - y) * c, v = (x + y) * c;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  }
  return [maxU - minU, maxV - minV];
}
