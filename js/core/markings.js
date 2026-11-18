// Ball markings (basketball lines, later soccer panels, seams, laces...).
// Each marking function takes a unit direction (dx, dy, dz) in the ball's own frame
// and returns 0..1 = how much of a line/panel is at that point (with soft edges).

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Converts a distance (mm) from a line centre into 0..1 line coverage with soft edges. */
export function lineProfile(distMm, widthMm) {
  const hw = widthMm / 2;
  const soft = Math.min(0.35, hw * 0.35);
  return 1 - smooth(hw - soft, hw + soft, distMm);
}

// Basketball: two perpendicular great circles (planes y=0 and z=0) plus two
// "ear" circles in planes y=±EAR, which cross the z=0 circle. That gives the 8 panels.
const BASKETBALL_EAR = 0.62;

function basketball(dx, dy, dz, radius, width) {
  const d1 = Math.abs(Math.asin(Math.max(-1, Math.min(1, dy))));            // great circle y=0
  const d2 = Math.abs(Math.asin(Math.max(-1, Math.min(1, dz))));            // great circle z=0
  const ay = Math.asin(Math.max(-1, Math.min(1, dy)));
  const ae = Math.asin(BASKETBALL_EAR);
  const d3 = Math.min(Math.abs(ay - ae), Math.abs(ay + ae));                // ears y=±EAR
  const d = Math.min(d1, d2, d3) * radius;
  return lineProfile(d, width);
}

const clamp1 = (x) => Math.max(-1, Math.min(1, x));

// ---------------------------------------------------------------- Soccer ball
// A truncated icosahedron (12 pentagons + 20 hexagons) blown up onto the sphere. Each panel is
// a flat face of the solid at a known distance from the centre; a direction belongs to the face
// its ray meets first, i.e. the one with the largest (u·n)/d. Seams lie where two faces tie.
// With edge length 1: pentagon faces sit 2.32744 from the centre, hexagon faces 2.26728.
const SOCCER = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [];
  for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
    verts.push([0, s1, s2 * phi], [s1, s2 * phi, 0], [s2 * phi, 0, s1]);
  }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const faces = verts.map((v) => ({ n: norm(v), invD: 1 / 2.32744, pent: true }));
  // Icosahedron faces = triples of mutually adjacent vertices (edge length 2)
  const near = (a, b) => Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 1e-6;
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (near(verts[i], verts[j]) && near(verts[j], verts[k]) && near(verts[i], verts[k])) {
      const c = [0, 1, 2].map((a) => verts[i][a] + verts[j][a] + verts[k][a]);
      faces.push({ n: norm(c), invD: 1 / 2.26728, pent: false });
    }
  }
  return faces; // 32
})();

function soccer(dx, dy, dz, radius, width, out) {
  let b1 = -Infinity, b2 = -Infinity, f1 = null, f2 = null;
  for (const f of SOCCER) {
    const v = (dx * f.n[0] + dy * f.n[1] + dz * f.n[2]) * f.invD;
    if (v > b1) { b2 = b1; f2 = f1; b1 = v; f1 = f; } else if (v > b2) { b2 = v; f2 = f; }
  }
  // Distance to the seam between the two closest faces: value gap / tangential gradient
  const gx = f1.n[0] * f1.invD - f2.n[0] * f2.invD, gy = f1.n[1] * f1.invD - f2.n[1] * f2.invD, gz = f1.n[2] * f1.invD - f2.n[2] * f2.invD;
  const gu = gx * dx + gy * dy + gz * dz;
  const tg = Math.hypot(gx - gu * dx, gy - gu * dy, gz - gu * dz) || 1e-9;
  const d = ((b1 - b2) / tg) * radius;
  if (out) out.fill = f1.pent ? 1 : 0;
  return lineProfile(d, width);
}

// ---------------------------------------------------------------- Baseball / softball
// The classic seam curve, which lies exactly on the unit sphere when A + B = 1:
//   p(t) = (A cos t + B cos 3t,  A sin t - B sin 3t,  2 sqrt(AB) sin 2t)
const BB_B = 0.29, BB_A = 1 - BB_B, BB_C = 2 * Math.sqrt(BB_A * BB_B);
const bbP = (t) => [BB_A * Math.cos(t) + BB_B * Math.cos(3 * t), BB_A * Math.sin(t) - BB_B * Math.sin(3 * t), BB_C * Math.sin(2 * t)];
const bbD1 = (t) => [-BB_A * Math.sin(t) - 3 * BB_B * Math.sin(3 * t), BB_A * Math.cos(t) - 3 * BB_B * Math.cos(3 * t), 2 * BB_C * Math.cos(2 * t)];
const bbD2 = (t) => [-BB_A * Math.cos(t) - 9 * BB_B * Math.cos(3 * t), -BB_A * Math.sin(t) + 9 * BB_B * Math.sin(3 * t), -4 * BB_C * Math.sin(2 * t)];
const BB_STITCHES = 108;
let BB = null; // lazily built lookup tables
function baseballTables() {
  if (BB) return BB;
  // Arc length along the curve (unit sphere)
  const NA = 4096, cum = new Float64Array(NA + 1);
  let prev = bbP(0);
  for (let i = 1; i <= NA; i++) {
    const p = bbP((i / NA) * 2 * Math.PI);
    cum[i] = cum[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    prev = p;
  }
  // Nearest curve parameter for a coarse grid of directions (refined exactly at lookup time)
  const GW = 192, GH = 96, NS = 384, grid = new Float32Array(GW * GH);
  const samples = [];
  for (let i = 0; i < NS; i++) samples.push(bbP((i / NS) * 2 * Math.PI));
  for (let j = 0; j < GH; j++) {
    const lat = ((j + 0.5) / GH - 0.5) * Math.PI;
    for (let i = 0; i < GW; i++) {
      const lon = ((i + 0.5) / GW) * 2 * Math.PI;
      const u = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
      let best = -2, bi = 0;
      for (let k = 0; k < NS; k++) {
        const s = samples[k], v = s[0] * u[0] + s[1] * u[1] + s[2] * u[2];
        if (v > best) { best = v; bi = k; }
      }
      grid[j * GW + i] = (bi / NS) * 2 * Math.PI;
    }
  }
  BB = { cum, NA, L: cum[NA], grid, GW, GH };
  return BB;
}

function baseball(dx, dy, dz, radius, width) {
  const T = baseballTables();
  // Start from the grid guess, then a few Newton steps on f(t) = p(t)·u (maximise)
  const lat = Math.asin(clamp1(dz));
  let lon = Math.atan2(dy, dx); if (lon < 0) lon += 2 * Math.PI;
  const gi = Math.min(T.GW - 1, Math.floor((lon / (2 * Math.PI)) * T.GW));
  const gj = Math.min(T.GH - 1, Math.max(0, Math.floor((lat / Math.PI + 0.5) * T.GH)));
  let t = T.grid[gj * T.GW + gi];
  for (let it = 0; it < 4; it++) {
    const d1 = bbD1(t), d2 = bbD2(t);
    const g = d1[0] * dx + d1[1] * dy + d1[2] * dz;
    const h = d2[0] * dx + d2[1] * dy + d2[2] * dz;
    t -= h < -1e-9 ? g / h : Math.sign(g) * -0.01;
  }
  t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const p = bbP(t), tan = bbD1(t);
  const ang = Math.acos(clamp1(p[0] * dx + p[1] * dy + p[2] * dz));
  // Which side of the seam: sign of u · (p × tangent)
  const side = Math.sign(dx * (p[1] * tan[2] - p[2] * tan[1]) + dy * (p[2] * tan[0] - p[0] * tan[2]) + dz * (p[0] * tan[1] - p[1] * tan[0])) || 1;
  const off = ang * radius * side;                     // mm across the seam
  const f = (t / (2 * Math.PI)) * T.NA, i0 = Math.min(T.NA - 1, Math.floor(f));
  const along = (T.cum[i0] + (T.cum[i0 + 1] - T.cum[i0]) * (f - i0)) * radius; // mm along the seam

  let cover = lineProfile(Math.abs(off), width * 0.5); // the seam itself
  // V-shaped stitches: on each side a short slanted line from near the seam outward
  const spacing = (T.L * radius) / BB_STITCHES;
  const gap = 0.035 * radius, len = 0.11 * radius, slant = 0.05 * radius;
  const k = Math.round(along / spacing - 0.5);
  for (const kk of [k - 1, k, k + 1]) {
    const a0 = (kk + 0.5) * spacing;
    // segment from (a0, side*gap) to (a0 + slant, side*(gap+len)) in (along, |off|) space
    const px = along - a0, py = Math.abs(off) - gap;
    const vx = slant, vy = len;
    const tt = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy)));
    const dist = Math.hypot(px - tt * vx, py - tt * vy);
    cover = Math.max(cover, lineProfile(dist, width * 0.6));
  }
  return cover;
}

// ---------------------------------------------------------------- Volleyball (classic 18 panels)
// Six cube-face sections, each split into three strips. Opposite sections match; neighbours are
// turned 90°: ±X sections are split by planes y = ±|x|/3, ±Y by z = ±|y|/3, ±Z by x = ±|z|/3.
const VB_K = 1 / 3, VB_N = Math.sqrt(1 + VB_K * VB_K);
function volleyball(dx, dy, dz, radius, width) {
  const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);
  let main, a, b, split;
  if (ax >= ay && ax >= az) { main = ax; a = ay; b = az; split = dy; }
  else if (ay >= az) { main = ay; a = az; b = ax; split = dz; }
  else { main = az; a = ax; b = ay; split = dx; }
  const dEdge = Math.min(Math.asin(clamp1((main - a) / Math.SQRT2)), Math.asin(clamp1((main - b) / Math.SQRT2)));
  const dStrip = Math.asin(clamp1(Math.min(Math.abs(split - VB_K * main), Math.abs(split + VB_K * main)) / VB_N));
  return lineProfile(Math.min(dEdge, dStrip) * radius, width);
}

export const MARKING_TYPES = {
  none: null,
  moon: null,
  basketball,
  soccer,
  baseball,
  volleyball,
};

/** Rotation matrix (row-major 3x3) from yaw (about Z), pitch (about X), roll (about Y), degrees. */
export function rotationMatrix(yawDeg, pitchDeg, rollDeg) {
  const r = Math.PI / 180;
  const cy = Math.cos(yawDeg * r), sy = Math.sin(yawDeg * r);
  const cp = Math.cos(pitchDeg * r), sp = Math.sin(pitchDeg * r);
  const cr = Math.cos(rollDeg * r), sr = Math.sin(rollDeg * r);
  const Rz = [cy, -sy, 0, sy, cy, 0, 0, 0, 1];
  const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
  const Ry = [cr, 0, sr, 0, 1, 0, -sr, 0, cr];
  const mul = (A, B) => {
    const C = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      C[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
    return C;
  };
  return mul(Rz, mul(Rx, Ry));
}
