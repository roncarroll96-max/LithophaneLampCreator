// Binary STL writer (millimetres). One 50-byte record per triangle.

function writeHeader(dv, header, triCount) {
  for (let i = 0; i < 80; i++) dv.setUint8(i, i < header.length ? header.charCodeAt(i) & 0x7f : 0x20);
  dv.setUint32(80, triCount, true);
}

/** Writes triangles t0..t1 (not including t1) as records starting at byte o of dv. */
function writeTriangles(dv, o, positions, indices, t0, t1) {
  for (let t = t0 * 3; t < t1 * 3; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    dv.setFloat32(o + 12, ax, true); dv.setFloat32(o + 16, ay, true); dv.setFloat32(o + 20, az, true);
    dv.setFloat32(o + 24, bx, true); dv.setFloat32(o + 28, by, true); dv.setFloat32(o + 32, bz, true);
    dv.setFloat32(o + 36, cx, true); dv.setFloat32(o + 40, cy, true); dv.setFloat32(o + 44, cz, true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
}

/** The whole STL in one buffer. */
export function writeBinarySTL(positions, indices, header = 'Lithophane Lamp Creator') {
  const triCount = indices.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  writeHeader(dv, header, triCount);
  writeTriangles(dv, 84, positions, indices, 0, triCount);
  return buf;
}

/**
 * The same file as a list of smaller buffers (header, then up to `chunk` triangles each), to be
 * joined by a Blob. A very big file (hundreds of MB) then needs no single huge block of memory,
 * which phones and tablets often can't provide.
 */
export function writeBinarySTLParts(positions, indices, header = 'Lithophane Lamp Creator', chunk = 1 << 20) {
  const triCount = indices.length / 3;
  const head = new ArrayBuffer(84);
  writeHeader(new DataView(head), header, triCount);
  const parts = [head];
  for (let t0 = 0; t0 < triCount; t0 += chunk) {
    const t1 = Math.min(triCount, t0 + chunk);
    const buf = new ArrayBuffer((t1 - t0) * 50);
    writeTriangles(new DataView(buf), 0, positions, indices, t0, t1);
    parts.push(buf);
  }
  return parts;
}
