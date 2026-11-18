// Ball shapes and the lookup tables used to map photos onto them.
//
// Conventions (used everywhere in the app):
//   - Units are millimetres. Z is up. The shape's centre is at the origin
//     until the mesh builder moves the collar bottom onto the print bed (z = 0).
//   - The front of the lamp (where the photo is centred) faces -Y.
//   - A surface point is addressed by (theta, s):
//       theta = angle around the vertical axis, 0..2π (0 = +X, π/2 = +Y)
//       s     = 0 at the top of the collar (the opening edge) .. 1 at the top pole
//     Internally s maps to phi, the angle from the bottom pole (0 = straight down).
//
// No DOM or Three.js here so this runs in the browser, in a Web Worker and in Node tests.

export const TWO_PI = Math.PI * 2;
export const THETA_FRONT = 1.5 * Math.PI; // -Y direction

/** Wraps an angle into (-π, π]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TWO_PI;
  if (a < 0) a += TWO_PI;
  return a - Math.PI;
}

/**
 * Builds a shape object for an ellipsoid with semi-axes a (X), b (Y), c (Z).
 * A sphere is a = b = c. A football lying on its side is a = length/2, b = c = width/2.
 * collarOuterR is the radius where the shell meets the collar (the opening edge).
 */
export function buildEllipsoidShape({ a, b, c, kind = 'sphere' }, collarOuterR) {
  const ia2 = 1 / (a * a), ib2 = 1 / (b * b), ic2 = 1 / (c * c);
  const minHoriz = Math.min(a, b);
  if (collarOuterR >= minHoriz * 0.9) {
    throw new Error(`The opening (${(collarOuterR * 2).toFixed(0)} mm with collar) is too big for this ball size.`);
  }

  /** Surface point and outward unit normal at (theta, phi). Writes into out. */
  function surf(theta, phi, out) {
    const sp = Math.sin(phi);
    const dx = sp * Math.cos(theta), dy = sp * Math.sin(theta), dz = -Math.cos(phi);
    const r = 1 / Math.sqrt(dx * dx * ia2 + dy * dy * ib2 + dz * dz * ic2);
    const x = r * dx, y = r * dy, z = r * dz;
    let nx = x * ia2, ny = y * ib2, nz = z * ic2;
    const nl = 1 / Math.hypot(nx, ny, nz);
    out.x = x; out.y = y; out.z = z;
    out.nx = nx * nl; out.ny = ny * nl; out.nz = nz * nl;
    out.dx = dx; out.dy = dy; out.dz = dz; // unit direction from centre
    return out;
  }

  // ---- Opening edge: for each theta, the phi where the surface is collarOuterR from the axis.
  const T = 720; // theta table resolution
  const phiEdgeTab = new Float64Array(T + 1);
  const tmp = {};
  for (let i = 0; i <= T; i++) {
    const theta = (i / T) * TWO_PI;
    let lo = 1e-6, hi = Math.PI / 2;
    for (let it = 0; it < 50; it++) {
      const mid = (lo + hi) / 2;
      surf(theta, mid, tmp);
      if (Math.hypot(tmp.x, tmp.y) < collarOuterR) lo = mid; else hi = mid;
    }
    phiEdgeTab[i] = (lo + hi) / 2;
  }
  function periodicLookup(tab, theta) {
    let u = (theta / TWO_PI) % 1; if (u < 0) u += 1;
    const f = u * T, i = Math.floor(f), w = f - i;
    return tab[i] * (1 - w) + tab[i + 1] * w;
  }
  const phiEdge = (theta) => periodicLookup(phiEdgeTab, theta);
  const phiAt = (theta, s) => { const pe = phiEdge(theta); return pe + s * (Math.PI - pe); };

  // ---- Arc-length tables.
  const S = 360; // s resolution
  // merTab[i*(S+1)+k]: arc length along the meridian at theta_i from the edge (s=0) to s_k.
  const merTab = new Float64Array((T + 1) * (S + 1));
  // ringTab[k*(T+1)+i]: arc length along the ring at s_k from theta=0 to theta_i.
  const ringTab = new Float64Array((S + 1) * (T + 1));
  const pts = new Float64Array((T + 1) * (S + 1) * 3);
  for (let i = 0; i <= T; i++) {
    const theta = (i / T) * TWO_PI;
    for (let k = 0; k <= S; k++) {
      surf(theta, phiAt(theta, k / S), tmp);
      const o = (i * (S + 1) + k) * 3;
      pts[o] = tmp.x; pts[o + 1] = tmp.y; pts[o + 2] = tmp.z;
    }
  }
  const P = (i, k) => (i * (S + 1) + k) * 3;
  for (let i = 0; i <= T; i++) {
    let acc = 0; merTab[i * (S + 1)] = 0;
    for (let k = 1; k <= S; k++) {
      const p = P(i, k), q = P(i, k - 1);
      acc += Math.hypot(pts[p] - pts[q], pts[p + 1] - pts[q + 1], pts[p + 2] - pts[q + 2]);
      merTab[i * (S + 1) + k] = acc;
    }
  }
  for (let k = 0; k <= S; k++) {
    let acc = 0; ringTab[k * (T + 1)] = 0;
    for (let i = 1; i <= T; i++) {
      const p = P(i, k), q = P(i - 1, k);
      acc += Math.hypot(pts[p] - pts[q], pts[p + 1] - pts[q + 1], pts[p + 2] - pts[q + 2]);
      ringTab[k * (T + 1) + i] = acc;
    }
  }

  function sIndex(s) {
    const f = Math.min(Math.max(s, 0), 1) * S;
    const k = Math.min(Math.floor(f), S - 1);
    return [k, f - k];
  }
  /** Arc length (mm) from the opening edge up the meridian to (theta, s). */
  function merArc(theta, s) {
    let u = (theta / TWO_PI) % 1; if (u < 0) u += 1;
    const f = u * T, i = Math.floor(f), w = f - i;
    const [k, v] = sIndex(s);
    const a0 = merTab[i * (S + 1) + k] * (1 - v) + merTab[i * (S + 1) + k + 1] * v;
    const a1 = merTab[(i + 1) * (S + 1) + k] * (1 - v) + merTab[(i + 1) * (S + 1) + k + 1] * v;
    return a0 * (1 - w) + a1 * w;
  }
  /** Ring circumference (mm) at height s. */
  function ringPerimeter(s) {
    const [k, v] = sIndex(s);
    return ringTab[k * (T + 1) + T] * (1 - v) + ringTab[(k + 1) * (T + 1) + T] * v;
  }
  function ringCum(theta, s) { // theta in [0, 2π]
    const f = (theta / TWO_PI) * T;
    const i = Math.min(Math.max(Math.floor(f), 0), T - 1), w = f - i;
    const [k, v] = sIndex(s);
    const r0 = ringTab[k * (T + 1) + i] * (1 - w) + ringTab[k * (T + 1) + i + 1] * w;
    const r1 = ringTab[(k + 1) * (T + 1) + i] * (1 - w) + ringTab[(k + 1) * (T + 1) + i + 1] * w;
    return r0 * (1 - v) + r1 * v;
  }
  /** Signed arc length (mm) along the ring from the front meridian to theta (+ = towards +theta). */
  function ringArc(theta, s) {
    const d = wrapAngle(theta - THETA_FRONT);
    let target = THETA_FRONT + d, offset = 0;
    if (target >= TWO_PI) { target -= TWO_PI; offset = ringPerimeter(s); }
    else if (target < 0) { target += TWO_PI; offset = -ringPerimeter(s); }
    return ringCum(target, s) + offset - ringCum(THETA_FRONT, s);
  }

  const peFront = phiEdge(THETA_FRONT);
  const sEquator = (Math.PI / 2 - peFront) / (Math.PI - peFront);
  const eqArcFront = merArc(THETA_FRONT, sEquator);
  /** Height (mm, measured along the front meridian) of level s above the equator. */
  const elev = (s) => merArc(THETA_FRONT, s) - eqArcFront;

  let merLenMax = 0;
  for (let i = 0; i <= T; i++) merLenMax = Math.max(merLenMax, merTab[i * (S + 1) + S]);
  const eqPerimeter = ringPerimeter(sEquator);

  return {
    kind, a, b, c, collarOuterR,
    surf, phiEdge, phiAt, merArc, ringArc, ringPerimeter, elev,
    sEquator, merLenMax, eqPerimeter,
    eqRho: eqPerimeter / TWO_PI,
    /** Radius used to convert angles on the marking sphere into mm. */
    markRadius: Math.cbrt(a * b * c),
  };
}
