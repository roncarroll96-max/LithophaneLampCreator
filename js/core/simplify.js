// Mesh simplification: merges triangles wherever that moves the surface by less than a set
// tolerance (quadric error edge collapse, Garland & Heckbert). Flat faces of a base, built on a
// fine grid, shrink from thousands of tiny triangles to a handful; curves keep enough to stay
// within the tolerance. The mesh stays closed: an edge is only collapsed when that cannot create a
// hole, a fold or a flipped triangle.
// No DOM: runs in the browser, the export worker and Node tests.

/**
 * Returns a simplified copy of mesh { positions, indices } as { positions, indices, bbox,
 * triangles, volume }. tol: largest allowed shift of the surface in mm. onProgress gets 0..1.
 */
export function simplifyMesh(mesh, tol = 0.02, onProgress = () => {}) {
  const P = Float64Array.from(mesh.positions);
  const T = Uint32Array.from(mesh.indices);
  const nV = P.length / 3, nT = T.length / 3;

  // Error quadric of every vertex: the sum of the planes of the triangles around it
  // (10 numbers: the upper half of a symmetric 4x4).
  const Q = new Float64Array(nV * 10);
  const tN = new Float32Array(nT * 3); // triangle normals (kept up to date)
  const dead = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) {
    normal(t, tN); // a flat (zero-area) triangle adds nothing
    const nx = tN[t * 3], ny = tN[t * 3 + 1], nz = tN[t * 3 + 2];
    const a = T[t * 3] * 3;
    const d = -(nx * P[a] + ny * P[a + 1] + nz * P[a + 2]);
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (let c = 0; c < 3; c++) { const o = T[t * 3 + c] * 10; for (let k = 0; k < 10; k++) Q[o + k] += q[k]; }
  }

  function normal(t, out) {
    const a = T[t * 3] * 3, b = T[t * 3 + 1] * 3, c = T[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l === 0) { out[t * 3] = out[t * 3 + 1] = out[t * 3 + 2] = 0; return false; }
    out[t * 3] = nx / l; out[t * 3 + 1] = ny / l; out[t * 3 + 2] = nz / l;
    return true;
  }

  // Best spot for the merged vertex of edge (a, b) and its error, into best[0..3]
  const best = new Float64Array(4);
  const qs = new Float64Array(10);
  const errAt = (x, y, z) =>
    qs[0] * x * x + 2 * qs[1] * x * y + 2 * qs[2] * x * z + 2 * qs[3] * x
    + qs[4] * y * y + 2 * qs[5] * y * z + 2 * qs[6] * y + qs[7] * z * z + 2 * qs[8] * z + qs[9];
  function edgeCost(a, b) {
    for (let k = 0; k < 10; k++) qs[k] = Q[a * 10 + k] + Q[b * 10 + k];
    const [q0, q1, q2, q3, q4, q5, q6, q7, q8] = qs;
    const det = q0 * (q4 * q7 - q5 * q5) - q1 * (q1 * q7 - q5 * q2) + q2 * (q1 * q5 - q4 * q2);
    // The minimum of the quadric, if it is well defined and close to the edge
    if (Math.abs(det) > 1e-10) {
      const x = -(q3 * (q4 * q7 - q5 * q5) - q1 * (q6 * q7 - q5 * q8) + q2 * (q6 * q5 - q4 * q8)) / det;
      const y = -(q0 * (q6 * q7 - q8 * q5) - q3 * (q1 * q7 - q5 * q2) + q2 * (q1 * q8 - q6 * q2)) / det;
      const z = -(q0 * (q4 * q8 - q5 * q6) - q1 * (q1 * q8 - q6 * q2) + q3 * (q1 * q5 - q4 * q2)) / det;
      const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      if (Math.hypot(x - mx, y - my, z - mz) <= len) {
        best[0] = x; best[1] = y; best[2] = z; best[3] = errAt(x, y, z);
        return best[3];
      }
    }
    // Otherwise the better of the two ends and the middle
    best[3] = Infinity;
    for (let s = 0; s <= 2; s++) {
      const w = s / 2;
      const x = P[a * 3] + (P[b * 3] - P[a * 3]) * w, y = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * w, z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * w;
      const e = errAt(x, y, z);
      if (e < best[3]) { best[0] = x; best[1] = y; best[2] = z; best[3] = e; }
    }
    return best[3];
  }

  // Which triangles touch each vertex: refs[start[v] .. start[v] + count[v]), as t * 3 + corner.
  // Rebuilt at the start of every pass; a merged vertex gets its new list appended at the end.
  const start = new Int32Array(nV), count = new Int32Array(nV);
  let refs = new Int32Array(nT * 3 * 2), nRefs = 0;
  function buildRefs() {
    count.fill(0);
    for (let t = 0; t < nT; t++) if (!dead[t]) for (let c = 0; c < 3; c++) count[T[t * 3 + c]]++;
    let s = 0;
    for (let v = 0; v < nV; v++) { start[v] = s; s += count[v]; }
    nRefs = s;
    count.fill(0);
    for (let t = 0; t < nT; t++) if (!dead[t]) for (let c = 0; c < 3; c++) { const v = T[t * 3 + c]; refs[start[v] + count[v]++] = t * 3 + c; }
  }

  const mark = new Int32Array(nV), mark2 = new Int32Array(nV);
  let stamp = 0;
  const dirty = new Uint8Array(nT);

  /** Can a and b merge at (x, y, z) without breaking the mesh? */
  function canCollapse(a, b, x, y, z) {
    // Link condition: a and b share exactly two neighbours (the far corners of their two
    // triangles), and neither of those is left with only two neighbours.
    stamp++;
    for (let r = start[a]; r < start[a] + count[a]; r++) {
      const t = (refs[r] / 3) | 0;
      if (dead[t]) continue;
      for (let c = 0; c < 3; c++) mark[T[t * 3 + c]] = stamp;
    }
    let common = 0;
    const opp = [-1, -1];
    for (let r = start[b]; r < start[b] + count[b]; r++) {
      const t = (refs[r] / 3) | 0;
      if (dead[t]) continue;
      for (let c = 0; c < 3; c++) {
        const v = T[t * 3 + c];
        if (v === a || v === b || mark[v] !== stamp || mark2[v] === stamp) continue;
        mark2[v] = stamp;
        if (common < 2) opp[common] = v;
        common++;
      }
    }
    if (common !== 2) return false;
    for (const o of opp) {
      let n = 0;
      for (let r = start[o]; r < start[o] + count[o]; r++) if (!dead[(refs[r] / 3) | 0]) n++;
      if (n <= 3) return false;
    }
    // No triangle may turn over or become a sliver
    return !flips(a, b, x, y, z) && !flips(b, a, x, y, z);
  }
  /** Would moving v to (x, y, z) turn over (or flatten) any of its triangles that do not contain other? */
  function flips(v, other, x, y, z) {
    for (let r = start[v]; r < start[v] + count[v]; r++) {
      const ref = refs[r], t = (ref / 3) | 0;
      if (dead[t]) continue;
      const c = ref % 3;
      const p1 = T[t * 3 + (c + 1) % 3], p2 = T[t * 3 + (c + 2) % 3];
      if (p1 === other || p2 === other) continue; // this triangle goes away
      const d1x = P[p1 * 3] - x, d1y = P[p1 * 3 + 1] - y, d1z = P[p1 * 3 + 2] - z;
      const d2x = P[p2 * 3] - x, d2y = P[p2 * 3 + 1] - y, d2z = P[p2 * 3 + 2] - z;
      const l1 = Math.hypot(d1x, d1y, d1z), l2 = Math.hypot(d2x, d2y, d2z);
      if (l1 === 0 || l2 === 0) return true;
      if (Math.abs((d1x * d2x + d1y * d2y + d1z * d2z) / (l1 * l2)) > 0.999) return true; // sliver
      const nx = d1y * d2z - d1z * d2y, ny = d1z * d2x - d1x * d2z, nz = d1x * d2y - d1y * d2x;
      const l = Math.hypot(nx, ny, nz);
      if (l === 0) return true;
      if ((nx * tN[t * 3] + ny * tN[t * 3 + 1] + nz * tN[t * 3 + 2]) / l < 0.2) return true; // turns too far
    }
    return false;
  }
  function pushRef(ref) {
    if (nRefs >= refs.length) { const g = new Int32Array(refs.length * 2); g.set(refs); refs = g; }
    refs[nRefs++] = ref;
  }

  // Passes over all triangles, with the allowed error rising to the full tolerance, so the
  // cheapest merges (flat areas) happen first. Stops when a pass at full tolerance merges nothing.
  const maxErr = tol * tol;
  const schedule = [1e-8, 1e-6, 1e-4, 1e-3, 0.01, 0.03, 0.1, 0.3, 0.6, 1];
  let live = nT;
  for (let pass = 0; pass < 40; pass++) {
    const limit = maxErr * schedule[Math.min(pass, schedule.length - 1)];
    buildRefs();
    dirty.fill(0);
    let merged = 0;
    for (let t = 0; t < nT; t++) {
      if (dead[t] || dirty[t]) continue;
      // the cheapest of this triangle's three edges
      let bestE = Infinity, ea = -1, eb = -1, bx = 0, by = 0, bz = 0;
      for (let e = 0; e < 3; e++) {
        const a = T[t * 3 + e], b = T[t * 3 + (e + 1) % 3];
        const c = edgeCost(a, b);
        if (c < bestE) { bestE = c; ea = a; eb = b; bx = best[0]; by = best[1]; bz = best[2]; }
      }
      if (bestE > limit) continue;
      if (!canCollapse(ea, eb, bx, by, bz)) continue;
      // Merge eb into ea
      P[ea * 3] = bx; P[ea * 3 + 1] = by; P[ea * 3 + 2] = bz;
      for (let k = 0; k < 10; k++) Q[ea * 10 + k] += Q[eb * 10 + k];
      const newStart = nRefs;
      for (const v of [ea, eb]) {
        for (let r = start[v]; r < start[v] + count[v]; r++) {
          const ref = refs[r], tt = (ref / 3) | 0;
          if (dead[tt]) continue;
          const c = ref % 3;
          if (v === eb) {
            if (T[tt * 3 + (c + 1) % 3] === ea || T[tt * 3 + (c + 2) % 3] === ea) { dead[tt] = 1; continue; }
            T[tt * 3 + c] = ea;
          } else if (T[tt * 3 + (c + 1) % 3] === eb || T[tt * 3 + (c + 2) % 3] === eb) {
            continue; // shared triangle: removed when eb's list is walked
          }
          normal(tt, tN);
          dirty[tt] = 1;
          pushRef(ref);
        }
      }
      start[ea] = newStart; count[ea] = nRefs - newStart;
      // the shared triangles were skipped in ea's walk and killed in eb's
      merged++;
    }
    live -= 2 * merged;
    onProgress(Math.min(1, (pass + 1) / (schedule.length + 4)));
    // At full tolerance, stop once a pass finds next to nothing (a long tail of a few merges
    // per pass would cost many passes for almost no gain)
    if (limit >= maxErr && merged <= Math.max(0, live * 2e-4)) break;
  }

  // Compact: keep live triangles and the vertices they use
  const remap = new Int32Array(nV).fill(-1);
  let nv = 0, nt = 0;
  for (let t = 0; t < nT; t++) if (!dead[t]) { nt++; for (let c = 0; c < 3; c++) { const v = T[t * 3 + c]; if (remap[v] < 0) remap[v] = nv++; } }
  const positions = new Float32Array(nv * 3), indices = new Uint32Array(nt * 3);
  for (let v = 0; v < nV; v++) if (remap[v] >= 0) { const o = remap[v] * 3; positions[o] = P[v * 3]; positions[o + 1] = P[v * 3 + 1]; positions[o + 2] = P[v * 3 + 2]; }
  let k = 0;
  for (let t = 0; t < nT; t++) if (!dead[t]) for (let c = 0; c < 3; c++) indices[k++] = remap[T[t * 3 + c]];
  return finish(positions, indices);
}

/** Bounding box, triangle count and volume of a mesh. */
function finish(positions, indices) {
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    vol += positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1])
         - positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c])
         + positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  const bbox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (let p = 0; p < positions.length; p += 3) for (let a = 0; a < 3; a++) {
    if (positions[p + a] < bbox.min[a]) bbox.min[a] = positions[p + a];
    if (positions[p + a] > bbox.max[a]) bbox.max[a] = positions[p + a];
  }
  return { positions, indices, bbox, triangles: indices.length / 3, volume: vol / 6 };
}
