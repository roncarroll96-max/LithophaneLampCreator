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
 * For a football, tipN < 2 makes the ends taper like a real ball: the body becomes
 *   |x/a|^tipN + (y² + z²)/b² = 1
 * (tipN = 2 is the plain oval). The tip stays rounded with radius b²·tipN/(2a), so the wall
 * can be offset inwards without folding over itself.
 * collarOuterR is the radius where the shell meets the collar (the opening edge).
 */
export function buildEllipsoidShape({ a, b, c, kind = 'sphere', tipN = 2, round = 5 }, collarOuterR) {
  const ia2 = 1 / (a * a), ib2 = 1 / (b * b), ic2 = 1 / (c * c);
  const tapered = kind === 'football' && Math.abs(tipN - 2) > 1e-6;
  // Tapered football: radius along a direction depends only on |dx|; tabulate it once
  const RT = 4096;
  let rTab = null;
  if (tapered) {
    rTab = new Float64Array(RT + 1);
    for (let i = 0; i <= RT; i++) {
      const cx = i / RT, s2 = 1 - cx * cx;
      let lo = 0, hi = Math.max(a, b) * 1.01;
      for (let it = 0; it < 60; it++) {
        const r = (lo + hi) / 2;
        if (Math.pow((r * cx) / a, tipN) + (r * r * s2) * ib2 < 1) lo = r; else hi = r;
      }
      rTab[i] = (lo + hi) / 2;
    }
  }
  const aN = Math.pow(a, tipN);

  // ---- Cube (half size a, edges rounded by `round`). It prints upside down, so its underside
  // can't be flat: a 45° funnel hangs below the bottom face, down to the opening. Each horizontal
  // slice of the funnel is a rounded square (corner radius cRho) whose half size shrinks by 1 mm
  // per mm down. Where it starts (z = cTop) the slice matches the cube's own slice exactly, so
  // the funnel covers the whole bottom and meets the rounded edges at the same 45° slope.
  const isCube = kind === 'cube';
  const cE = a - round;                                // half size of the box before rounding
  const cC = 2 * cE + round * Math.SQRT2;               // slice half size = cC + z
  const cTop = -(cE + round / Math.SQRT2);              // where the funnel meets the rounded edge
  const cRho = round / Math.SQRT2;                      // corner radius of every funnel slice
  const cK = cC - cRho;                                 // inner square half size = cK + z
  const cBot = collarOuterR - cC;                       // funnel bottom: slice half size = collarOuterR
  const cn = { r: 0, nx: 0, ny: 0, nz: 0 };
  /** Distance from the centre to the cube's surface along unit direction d, and the normal there. */
  function cubeRay(dx, dy, dz) {
    const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
    // Rounded box: |max(r·|d| - e, 0)| = round. Try 1, 2, then 3 active axes (largest first).
    const v = [ax, ay, az].sort((p, q) => q - p);
    let rb = (cE + round) / v[0];
    if (rb * v[1] > cE) {
      let A = v[0] * v[0] + v[1] * v[1], B = v[0] + v[1];
      rb = (cE * B + Math.sqrt(Math.max(0, cE * cE * B * B - A * (2 * cE * cE - round * round)))) / A;
      if (rb * v[2] > cE) {
        A += v[2] * v[2]; B += v[2];
        rb = (cE * B + Math.sqrt(Math.max(0, cE * cE * B * B - A * (3 * cE * cE - round * round)))) / A;
      }
    }
    cn.r = rb;
    cn.nx = Math.sign(dx) * Math.max(rb * ax - cE, 0);
    cn.ny = Math.sign(dy) * Math.max(rb * ay - cE, 0);
    cn.nz = Math.sign(dz) * Math.max(rb * az - cE, 0);
    // Funnel below (only for downward directions that pass through it)
    if (dz < 0) {
      const hi = Math.max(ax, ay), lo = Math.min(ax, ay);
      // flat side of the slice: r·hi = cC + r·dz, valid while the other coordinate is inside the inner square
      let rSide = cC / (hi - dz), corner = false;
      if (rSide * lo > cK + rSide * dz) {
        // rounded corner of the slice: (r(ax-dz) - cK)² + (r(ay-dz) - cK)² = cRho²
        const A1 = ax - dz, A2 = ay - dz, A = A1 * A1 + A2 * A2, B = A1 + A2;
        rSide = (cK * B + Math.sqrt(Math.max(0, cK * cK * B * B - A * (2 * cK * cK - cRho * cRho)))) / A;
        corner = true;
      }
      const rBot = cBot / dz, rIn = cTop / dz;
      const rOut = Math.min(rSide, rBot);
      if (rIn <= rOut && rOut > rb) {
        cn.r = rOut;
        if (rBot <= rSide) { cn.nx = 0; cn.ny = 0; cn.nz = -1; }
        else if (corner) {
          const k = cK + rOut * dz;
          let qx = rOut * ax - k, qy = rOut * ay - k;
          const ql = Math.hypot(qx, qy) || 1; qx /= ql; qy /= ql;
          cn.nx = Math.sign(dx) * qx; cn.ny = Math.sign(dy) * qy; cn.nz = -(qx + qy);
        } else {
          cn.nx = ax >= ay ? Math.sign(dx) : 0; cn.ny = ax >= ay ? 0 : Math.sign(dy); cn.nz = -1;
        }
      }
    }
    return cn;
  }
  const minHoriz = Math.min(a, b);
  if (collarOuterR >= minHoriz * 0.9) {
    throw new Error(`The opening (${(collarOuterR * 2).toFixed(0)} mm with collar) is too big for this ball size.`);
  }

  /** Surface point and outward unit normal at (theta, phi). Writes into out. */
  function surf(theta, phi, out) {
    const sp = Math.sin(phi);
    const dx = sp * Math.cos(theta), dy = sp * Math.sin(theta), dz = -Math.cos(phi);
    let r, nx, ny, nz;
    if (isCube) {
      const q = cubeRay(dx, dy, dz);
      r = q.r; nx = q.nx; ny = q.ny; nz = q.nz;
    } else if (tapered) {
      const f = Math.min(1, Math.abs(dx)) * RT, i = Math.min(RT - 1, Math.floor(f));
      r = rTab[i] + (rTab[i + 1] - rTab[i]) * (f - i);
      const ax = Math.abs(r * dx);
      nx = (tipN * Math.pow(ax, tipN - 1) * Math.sign(dx)) / aN;
      ny = 2 * r * dy * ib2; nz = 2 * r * dz * ib2;
    } else {
      r = 1 / Math.sqrt(dx * dx * ia2 + dy * dy * ib2 + dz * dz * ic2);
      nx = r * dx * ia2; ny = r * dy * ib2; nz = r * dz * ic2;
    }
    const x = r * dx, y = r * dy, z = r * dz;
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
  /** Signed arc length (mm) along the ring at height s from theta0 to theta (+ = towards +theta). */
  function ringArcFrom(theta0, theta, s) {
    let t0 = theta0 % TWO_PI; if (t0 < 0) t0 += TWO_PI;
    let target = t0 + wrapAngle(theta - t0), offset = 0;
    if (target >= TWO_PI) { target -= TWO_PI; offset = ringPerimeter(s); }
    else if (target < 0) { target += TWO_PI; offset = -ringPerimeter(s); }
    return ringCum(target, s) + offset - ringCum(t0, s);
  }
  /** Signed arc length (mm) along the ring from the front meridian to theta (+ = towards +theta). */
  const ringArc = (theta, s) => ringArcFrom(THETA_FRONT, theta, s);

  const peFront = phiEdge(THETA_FRONT);
  const sEquator = (Math.PI / 2 - peFront) / (Math.PI - peFront);
  const eqArcFront = merArc(THETA_FRONT, sEquator);
  /** Height (mm, measured along the front meridian) of level s above the equator. */
  const elev = (s) => merArc(THETA_FRONT, s) - eqArcFront;

  let merLenMax = 0;
  for (let i = 0; i <= T; i++) merLenMax = Math.max(merLenMax, merTab[i * (S + 1) + S]);
  const eqPerimeter = ringPerimeter(sEquator);

  return {
    kind, a, b, c, collarOuterR, tipN: tapered ? tipN : 2,
    round: isCube ? round : 0, funnelBottom: isCube ? cBot : null,
    surf, phiEdge, phiAt, merArc, ringArc, ringArcFrom, ringPerimeter, elev,
    sEquator, merLenMax, eqPerimeter,
    eqRho: eqPerimeter / TWO_PI,
    /** Radius used to convert angles on the marking sphere into mm. */
    markRadius: Math.cbrt(a * b * c),
  };
}
