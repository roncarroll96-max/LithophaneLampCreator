// Christmas lantern trim (feature 12d, version 1.7): flat decorations printed separately in a
// second colour and glued onto the lantern. Every piece is open filigree (the lantern's colour
// shows through), all one connected part, sized to the lantern. No DOM.
//
// Pieces are drawn in 2D (u across, v up, in mm; negative inside) and given a thickness: TH for
// trim, TT for the topper. To print they lie flat (x = u, y = v, z = thickness). On the lantern
// they sit on a face: the side frames on the pillars' outer faces, the base strips on the base's
// walls, the lattice strips on the two-tier roof's band, the snowflakes or holly on the roof
// faces, and the topper stands in the socket at the roof's peak.
//
// Shapes are joined with a smooth union, so where two strokes meet (or a stroke meets a rim) the
// narrow wedge between them is filled: such wedges would be thinner than the mesh can show.

import { lanternGeometry, polyBox } from './lantern.js';

export const TH = 1.6;      // trim thickness, mm
export const TT = 3;        // topper thickness, mm
const RIM = 2;              // the frames' edge rims, mm
const ST = 1.3;             // stroke width of the scrolls and lattice, mm
const KS = 0.7;             // smooth-union size, mm
const FEET = 3;             // the base's corner blocks stand out this far (lantern.js)
const TAB = { w: 6, len: 6.5, collarW: 10, collarH: 3 }; // the topper's tab, into the roof socket

export const DECOR_LABELS = { snow: 'Snowflakes and trees', holly: 'Holly and berries' };
export const ROOF_LABELS = { low: 'Low roof', tiered: 'Two-tier roof' };
export const TOPPER_LABELS = { ring: 'Ring', star: 'Star' };
export const BODY_COLORS = { green: 0x2f6b3f, red: 0x9c2a35, white: 0xe8e4dc, black: 0x1b1a1d };
export const TRIM_COLORS = { gold: 0xd4a73c, cream: 0xefe3c4, white: 0xf6f4ef, silver: 0xc4c8cc };
export const DECOR_COLORS = { snow: ['green', 'gold'], holly: ['red', 'cream'] };

// ---------------------------------------------------------------- 2D building blocks
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rect = (u, v, u0, u1, v0, v1) => {
  const dx = Math.max(u0 - u, u - u1), dy = Math.max(v0 - v, v - v1);
  return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
};
/** Smooth union of two distances (fills the narrow wedge where shapes meet). */
function smin(a, b, k = KS) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
const sminAll = (ds, k = KS) => ds.reduce((m, d) => smin(m, d, k), Infinity);
/** Smooth intersection (rounds the corner where two cuts meet). */
const smax = (a, b, k = KS) => -smin(-a, -b, k);
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
  const t = L2 ? clamp(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1) : 0;
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}
/** Distance to an arc of a circle (centre cx, cy; radius R; from angle a0 anticlockwise by span). */
function arcDist(px, py, cx, cy, R, a0, span) {
  const dx = px - cx, dy = py - cy;
  let a = Math.atan2(dy, dx) - a0;
  a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (a <= span) return Math.abs(Math.hypot(dx, dy) - R);
  const e0x = cx + R * Math.cos(a0), e0y = cy + R * Math.sin(a0);
  const e1x = cx + R * Math.cos(a0 + span), e1y = cy + R * Math.sin(a0 + span);
  return Math.min(Math.hypot(px - e0x, py - e0y), Math.hypot(px - e1x, py - e1y));
}
const rot = (u, v, a) => [u * Math.cos(a) + v * Math.sin(a), -u * Math.sin(a) + v * Math.cos(a)];

/**
 * A scroll band along u (from -L/2 to L/2, v from -H/2 to H/2): a wave touching both edges, with a
 * curl in each hollow that grows from the edge.
 */
function scrollBand(L, H) {
  // the wave and the curls run well into the edges (just grazing an edge leaves slivers too thin to print)
  const A = H / 2 + 0.6, nHalf = Math.max(2, Math.round(L / Math.max(10, H * 1.4))), lam = (2 * L) / nHalf;
  const kk = (2 * Math.PI) / lam;
  const rho = clamp(H * 0.2, 1.4, 4);
  return (u, v) => {
    const x = u + L / 2, s = Math.sin(kk * x), c = Math.cos(kk * x);
    const wave = Math.abs(v - A * s) / Math.sqrt(1 + (A * kk * c) ** 2) - ST / 2;
    // which hollow: the wave is up in even half-waves, so the curl hangs from the top edge in odd ones
    const i = clamp(Math.floor(x / (lam / 2)), 0, nHalf - 1), uc = -L / 2 + (i + 0.5) * (lam / 2);
    const side = i % 2 === 0 ? -1 : 1; // the curl sits on the side away from the wave's hump
    const vc = side * (H / 2 - rho * 0.45);
    const curl = H >= 7 ? arcDist(u, v, uc, vc, rho, side > 0 ? -Math.PI / 2 - 0.2 : Math.PI / 2 - 0.2, 4.9) - ST / 2 : Infinity;
    return smin(wave, curl);
  };
}

/** Diagonal lattice (bars about sp apart, crossing at right angles). */
function lattice(sp) {
  const s = sp / Math.SQRT2;
  return (u, v) => {
    const q1 = (u + v) / Math.SQRT2, q2 = (u - v) / Math.SQRT2;
    return Math.min(Math.abs(q1 - Math.round(q1 / s) * s), Math.abs(q2 - Math.round(q2 / s) * s)) - ST / 2;
  };
}

/** A Christmas tree w wide and h tall, standing on v = 0 (three tiers, a trunk, ornament holes). */
function tree(w, h) {
  const tiers = [0, 1, 2].map((i) => {
    const yb = h * (0.12 + 0.25 * i), yt = i === 2 ? h * 0.93 : yb + h * 0.38, hw = (w / 2) * (1 - 0.24 * i);
    return { yb, yt, hw, cs: Math.cos(Math.atan2(hw, yt - yb)) };
  });
  const holes = [];
  for (const t of tiers) {
    const yh = t.yb + (t.yt - t.yb) * 0.28, xh = t.hw * 0.42;
    if (xh > 2.2) holes.push([-xh, yh], [xh, yh]);
  }
  const hr = clamp(w * 0.05, 0.9, 1.6);
  return (u, v) => {
    let d = Infinity;
    for (const t of tiers) d = Math.min(d, Math.max(t.yb - v, (Math.abs(u) - (t.hw * (t.yt - v)) / (t.yt - t.yb)) * t.cs));
    d = Math.min(d, rect(u, v, -w * 0.09, w * 0.09, -0.5, h * 0.15));
    for (const [hx, hy] of holes) d = Math.max(d, hr - Math.hypot(u - hx, v - hy));
    return d;
  };
}

/** A snowflake of radius R (six arms with side branches). */
export function snowflake(R) {
  const w = clamp(R * 0.11, 1.2, 2.2), b1 = 0.5 * R, b2 = 0.76 * R;
  // branches short enough that neighbouring arms' branches keep a clear gap (at least 1.2 mm)
  const l1 = Math.min(0.32 * R, b1 - w - 1.2), l2 = Math.min(0.2 * R, b2 - w - 1.2);
  const c60 = 0.5, s60 = Math.sqrt(3) / 2;
  return (u, v) => {
    const r = Math.hypot(u, v);
    let a = Math.atan2(v, u);
    a = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
    if (a > Math.PI / 6) a = Math.PI / 3 - a; // fold into one arm's half
    const x = r * Math.cos(a), y = r * Math.sin(a);
    const d = Math.min(
      segDist(x, y, 0, 0, R, 0),
      l1 > 0.8 ? segDist(x, y, b1, 0, b1 + l1 * c60, l1 * s60) : Infinity,
      l2 > 0.8 ? segDist(x, y, b2, 0, b2 + l2 * c60, l2 * s60) : Infinity,
    ) - w / 2;
    return Math.min(d, r - R * 0.17);
  };
}

/** A holly leaf L long and W wide along +u from the origin (three points each side). */
function hollyLeaf(L, W) {
  const Rc = (L * L / 4 + (W / 2) ** 2) / W, off = Rc - W / 2, rb = L / 7;
  const edgeY = (x) => Math.sqrt(Math.max(0, Rc * Rc - (x - L / 2) ** 2)) - off;
  const bites = [];
  for (const fx of [0.33, 0.66]) { const x = L * fx, y = edgeY(x) + rb * 0.45; bites.push([x, y], [x, -y]); }
  return (u, v) => {
    // smooth intersections round the tips and points a little (sharp points don't print or mesh well)
    let d = smax(Math.hypot(u - L / 2, v - off) - Rc, Math.hypot(u - L / 2, v + off) - Rc, 1);
    for (const [bx, by] of bites) d = smax(d, rb - Math.hypot(u - bx, v - by), 0.8);
    return d;
  };
}
/** Three berries round a point. */
function berries(r) {
  const pts = [0, 1, 2].map((i) => [r * 1.05 * Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3), r * 1.05 * Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3)]);
  return (u, v) => sminAll(pts.map(([x, y]) => Math.hypot(u - x, v - y) - r), 0.5);
}
/** A holly sprig about `size` across: two leaves and a cluster of berries. */
export function hollySprig(size) {
  const L = size * 0.46, W = L * 0.46, leaf = hollyLeaf(L, W), br = berries(clamp(size * 0.07, 1.4, 3.2));
  // three leaves in a fan, berries where they meet
  const angs = [Math.PI * 0.2, Math.PI * 0.8, -Math.PI * 0.5];
  return (u, v) => {
    const ds = angs.map((a) => { const [x, y] = rot(u, v + size * 0.04, a); return leaf(x - size * 0.03, y); });
    return sminAll([...ds, br(u, v + size * 0.04)], 0.6);
  };
}

/** A five-pointed star (outer radius R, inner r), one point up, its points rounded. */
function star(R0, r0) {
  const n = 5, an = Math.PI / n, R = R0 - 1.6, r = r0 - 0.6;
  const ax = R, ay = 0, bx = r * Math.cos(an), by = r * Math.sin(an);
  let nx = by - ay, ny = -(bx - ax); const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
  if (nx * (0 - ax) + ny * (0 - ay) > 0) { nx = -nx; ny = -ny; }
  return (u, v) => {
    const rr = Math.hypot(u, v);
    let a = Math.atan2(v, u) - Math.PI / 2;
    a = ((a % (2 * an)) + 2 * an) % (2 * an);
    if (a > an) a = 2 * an - a;
    const x = rr * Math.cos(a), y = rr * Math.sin(a);
    // the true distance to the outline (so growing it rounds the points)
    const side = (x - ax) * nx + (y - ay) * ny;
    return Math.sign(side || 1) * segDist(x, y, ax, ay, bx, by) - 0.9;
  };
}

/** Rims round a rectangle (and round an opening in it), with a pattern filling the space between. */
function framed(U0, U1, V0, V1, parts, opening = null) {
  return (u, v) => {
    const outer = rect(u, v, U0, U1, V0, V1);
    const inset = rect(u, v, U0 + RIM, U1 - RIM, V0 + RIM, V1 - RIM);
    const ds = [Math.max(outer, -inset)];
    if (opening) {
      const [o0, o1, p0, p1] = opening;
      ds.push(Math.max(rect(u, v, o0 - RIM, o1 + RIM, p0 - RIM, p1 + RIM), -rect(u, v, o0, o1, p0, p1)));
    }
    for (const { f, box } of parts) ds.push(Math.max(f(u, v), rect(u, v, box[0] - 0.6, box[1] + 0.6, box[2] - 0.6, box[3] + 0.6)));
    let d = Math.max(sminAll(ds), outer);
    if (opening) d = Math.max(d, -rect(u, v, ...opening));
    return d;
  };
}
/** A pattern f(u, v) drawn in a local box centred on (cu, cv), turned so its u runs along v when vertical. */
const placeIn = (f, cu, cv, vertical = false) => (vertical ? (u, v) => f(v - cv, -(u - cu)) : (u, v) => f(u - cu, v - cv));

// ---------------------------------------------------------------- the pieces, for one lantern
/** Sizes and places of every trim piece: worked out from the lantern's geometry. */
export function trimLayout(geo) {
  const { n, a, ca, sa, half, inner, hB, zT, xmas } = geo, ta = Math.tan(a / 2), t = geo.top;
  const cover = xmas.cover;
  // Side frame: across the side's pillars, from the base's top to just under the roof
  const U = half * ta - 0.6, uLip = (inner - half * ca) / sa;
  const uO = Math.max(8, uLip - cover);
  const zF0 = hB + 0.3, zF1 = zT - 0.6, Hf = zF1 - zF0;
  const vO0 = Math.min(Hf / 2 - 8, cover - 0.3), vO1 = Math.max(Hf / 2 + 8, Hf - cover + 0.6);
  // Base strip: between the corner feet, above the cable notch
  const Ub = ((inner - FEET) - half * ca) / sa - 0.5;
  const zb0 = Math.min(geo.cableH + 1, hB - 8), Hb = Math.max(6, hB - 1.2 - zb0);
  const L = {
    frame: { U, uO, zF0, Hf, vO0, vO1 },
    base: { Ub, zb0, Hb },
    roof: t.style, decor: xmas.decor, topper: xmas.topper, n,
  };
  if (t.style === 'tiered') {
    const Ul = t.rb * ta - 0.6, zl0 = t.zLb + 0.8, Hl = t.zB - 0.8 - zl0;
    L.lattice = { Ul, zl0, Hl };
  }
  // Roof decorations on each face: one big and two small (the two-tier roof: one small up top too)
  const r0 = t.style === 'tiered' ? t.rb : t.rPeak, r1 = t.edge;
  const dBig = r0 + 0.5 * (r1 - r0), dSmall = r0 + 0.72 * (r1 - r0);
  const big = clamp(Math.min(0.62 * (r1 - r0), 0.9 * dBig * ta), 14, 46);
  const small = clamp(big * 0.55, 10, 28);
  const spots = [{ d: dBig, s: 0, size: big }];
  const sSmall = dSmall * ta * 0.62;
  if (sSmall > small * 0.6) spots.push({ d: dSmall, s: -sSmall, size: small }, { d: dSmall, s: sSmall, size: small });
  if (t.style === 'tiered') {
    const dU = t.rPeak + 0.55 * (t.rb + t.ov2 - t.rPeak);
    spots.push({ d: dU, s: 0, size: clamp(0.75 * (t.rb + t.ov2 - t.rPeak), 9, small), upper: true });
  }
  L.spots = spots;
  return L;
}

/** The roof's height (top coordinates) at distance r out on a face, for placing decorations. */
function roofZ(t, r, upper) {
  if (t.style === 'tiered') {
    return upper ? t.zB + t.ov2 + t.ef2 + (t.rb + t.ov2 - Math.max(r, t.rPeak)) * t.k : t.ov + t.ef + (t.edge - r) * t.k;
  }
  return t.height - Math.max(0, r - t.rPeak) * t.k;
}

/**
 * Every trim piece for the lantern: [{ key, name, copies, thick, d2, box: [u0, u1, v0, v1], how,
 * places: [{ origin, ex, ey, ez }] }]. places say where each copy goes on the lantern (lantern
 * coordinates): origin + u * ex + v * ey + w * ez, w = 0 on the face, growing outward.
 */
export function trimPieces(settings, geo = lanternGeometry(settings)) {
  if (geo.theme !== 'christmas') return [];
  const Lo = trimLayout(geo), F = geo.frames, t = geo.top, holly = Lo.decor === 'holly';
  const out = [];
  const sidePlaces = (dOut, z0) => F.map((f) => ({
    origin: [f.nx * dOut, f.ny * dOut, z0], ex: [f.tx, f.ty, 0], ey: [0, 0, 1], ez: [f.nx, f.ny, 0],
  }));

  // Side frame
  {
    const { U, uO, Hf, vO0, vO1 } = Lo.frame;
    const fw = U - RIM - (uO + RIM), fu = (uO + RIM + U - RIM) / 2, fv0 = RIM, fv1 = Hf - RIM;
    const parts = [];
    // top band, bottom band
    const bandW = 2 * (uO + RIM);
    const topH = fv1 - (vO1 + RIM), botH = vO0 - RIM - fv0;
    if (topH > 3) parts.push({ f: placeIn(holly ? lattice(Math.max(6, topH * 0.9)) : scrollBand(bandW, topH), 0, (vO1 + RIM + fv1) / 2), box: [-uO - RIM, uO + RIM, vO1 + RIM, fv1] });
    if (botH > 3) parts.push({ f: placeIn(scrollBand(bandW, botH), 0, (fv0 + vO0 - RIM) / 2), box: [-uO - RIM, uO + RIM, fv0, vO0 - RIM] });
    // separators continuing the inner rim up and down to the outer rim
    const sep = (u, v) => Math.max(Math.abs(u) - (uO + RIM), uO - Math.abs(u), v - Hf, -v);
    parts.push({ f: sep, box: [-U, U, 0, Hf] });
    // side bands
    const sideH = fv1 - fv0;
    for (const sgn of [-1, 1]) {
      const cu = sgn * fu, box = sgn > 0 ? [uO + RIM, U - RIM, fv0, fv1] : [-U + RIM, -uO - RIM, fv0, fv1];
      if (holly) {
        const leafL = fw * 0.62, pitch = Math.max(fw * 0.62, 9), leaf = hollyLeaf(leafL, leafL * 0.46), br = berries(clamp(fw * 0.08, 1.2, 2.2));
        const f = (u, v) => {
          const x = u - cu, y = v - fv0;
          const stem = Math.abs(x) - ST / 2;
          const j = Math.round(y / pitch), yj = j * pitch, s2 = j % 2 === 0 ? 1 : -1;
          // a leaf out to alternate sides at every step, its tip reaching the rim, and berries at each step
          const [lx, ly] = rot(x * s2, y - yj, -0.6);
          const lf = leaf(lx + 0.6, ly);
          return sminAll([stem, lf, br(x - s2 * 0.4, y - yj - pitch * 0.5)], 0.6);
        };
        parts.push({ f, box });
      } else {
        const th = Math.min(sideH * 0.46, fw * 2.6), tw = fw + 1.2, tv0 = fv0 + (sideH - th) / 2;
        const tr = tree(tw, th);
        const lowL = tv0 - fv0, upL = fv1 - (tv0 + th);
        const f = (u, v) => {
          const ds = [tr(u - cu, v - tv0)];
          // each scroll only in its own stretch (beyond it the wave would run on beside the tree)
          if (lowL > 6) ds.push(Math.max(placeIn(scrollBand(lowL + 1, fw), cu, fv0 + lowL / 2, true)(u, v), fv0 - 1 - v, v - (tv0 + 0.6)));
          if (upL > 6) ds.push(Math.max(placeIn(scrollBand(upL + 1, fw), cu, tv0 + th + upL / 2, true)(u, v), tv0 + th - 0.6 - v, v - (fv1 + 1)));
          return sminAll(ds);
        };
        parts.push({ f, box });
      }
    }
    out.push({
      key: 'xframe', name: 'Side frame', copies: geo.n, thick: TH, box: [-U, U, 0, Hf],
      d2: framed(-U, U, 0, Hf, parts, [-uO, uO, vO0, vO1]),
      how: `Print ${geo.n}, flat. Glue one over each side, onto the two pillars beside it (not onto the panel or the top).`,
      places: sidePlaces(geo.half, Lo.frame.zF0),
    });
  }
  // Base strip
  {
    const { Ub, Hb } = Lo.base;
    const sb = scrollBand(2 * (Ub - RIM), Hb - 2 * RIM);
    out.push({
      key: 'xbase', name: 'Base trim', copies: geo.n, thick: TH, box: [-Ub, Ub, 0, Hb],
      d2: framed(-Ub, Ub, 0, Hb, [{ f: placeIn(sb, 0, Hb / 2), box: [-Ub + RIM, Ub - RIM, RIM, Hb - RIM] }]),
      how: `Print ${geo.n}, flat. Glue one onto each side of the base, between the corner feet.`,
      places: sidePlaces(geo.half, Lo.base.zb0),
    });
  }
  // Lattice strips round the two-tier roof's band (holly design)
  if (Lo.lattice && holly) {
    const { Ul, Hl } = Lo.lattice;
    out.push({
      key: 'xlattice', name: 'Roof lattice', copies: geo.n, thick: TH, box: [-Ul, Ul, 0, Hl],
      d2: framed(-Ul, Ul, 0, Hl, [{ f: lattice(Math.max(5, (Hl - 2 * RIM) * 0.9)), box: [-Ul + RIM, Ul - RIM, RIM, Hl - RIM] }]),
      how: `Print ${geo.n}, flat. Glue one onto each side of the band between the two roofs.`,
      places: sidePlaces(t.rb, geo.zT + Lo.lattice.zl0),
    });
  }
  // Roof decorations: one piece per spot (all spots of one size share a piece)
  const sizes = [...new Set(Lo.spots.map((sp) => sp.size.toFixed(2)))].map(Number);
  for (const size of sizes) {
    const spots = Lo.spots.filter((sp) => Math.abs(sp.size - size) < 0.005);
    const f = holly ? hollySprig(size) : snowflake(size / 2);
    const places = [];
    for (const fr of F) for (const sp of spots) {
      const k = t.k, cph = 1 / Math.sqrt(1 + k * k), sph = k * cph;
      const z = geo.zT + roofZ(t, sp.d, sp.upper);
      places.push({
        origin: [fr.nx * sp.d + fr.tx * sp.s, fr.ny * sp.d + fr.ty * sp.s, z],
        ex: [fr.tx, fr.ty, 0], ey: [-fr.nx * cph, -fr.ny * cph, sph], ez: [fr.nx * sph, fr.ny * sph, cph],
      });
    }
    const half = holly ? size * 0.55 : size / 2 + 0.5;
    out.push({
      key: `xdecor${out.filter((p) => p.key.startsWith('xdecor')).length}`, name: holly ? 'Holly sprig' : 'Snowflake',
      copies: places.length, thick: TH, box: [-half, half, -half, half], d2: f, places, small: true, size,
    });
  }
  // Topper
  {
    const isStar = Lo.topper === 'star';
    const R = isStar ? 15 : 12.5, ri = isStar ? 6.5 : 8;
    // the star sits up on a short stem, its lower points clear of the tab
    const cy = isStar ? TAB.len + R * Math.sin((54 * Math.PI) / 180) + 1.5 : TAB.len + TAB.collarH + R - 1.2;
    const collarTop = isStar ? cy - ri + 1.5 : TAB.len + TAB.collarH;
    const shape = isStar ? star(R, ri) : (u, v) => Math.max(Math.hypot(u, v) - R, ri - Math.hypot(u, v));
    const d2 = (u, v) => sminAll([
      rect(u, v, -TAB.w / 2, TAB.w / 2, 0, TAB.len + 0.5),
      rect(u, v, -(isStar ? 3 : TAB.collarW / 2), isStar ? 3 : TAB.collarW / 2, TAB.len, collarTop),
      shape(u, v - cy),
    ], 0.8);
    out.push({
      key: 'xtopper', name: isStar ? 'Star' : 'Ring', copies: 1, thick: TT, box: [-R - 1, R + 1, 0, cy + R + 0.5], d2,
      how: 'Print 1, flat. Glue its tab into the socket at the top of the roof.',
      places: [{ origin: [0, TT / 2, geo.zT + t.height - t.socketD], ex: [1, 0, 0], ey: [0, 0, 1], ez: [0, -1, 0] }],
    });
  }
  return out;
}

/** A piece as a solid lying flat on the bed: f(x, y, z), z from 0 to its thickness. */
export const flatSolid = (p) => (x, y, z) => Math.max(p.d2(x, y), -z, z - p.thick);

/**
 * The trim parts to export: 'xframe', 'xbase', 'xlattice', 'xtopper' (one piece each), and
 * 'xdecor' (every roof decoration laid out together). Returns { sdf, bounds, size, how, copies }
 * or null when the lantern has no such part.
 */
export function trimPart(settings, part, geo = lanternGeometry(settings)) {
  const pieces = trimPieces(settings, geo);
  if (part !== 'xdecor') {
    const p = pieces.find((q) => q.key === part);
    if (!p) return null;
    const [u0, u1, v0, v1] = p.box;
    return {
      sdf: flatSolid(p), bounds: { min: [u0 - 0.5, v0 - 0.5, 0], max: [u1 + 0.5, v1 + 0.5, p.thick] },
      size: [u1 - u0, v1 - v0, p.thick], how: p.how, copies: p.copies,
    };
  }
  // All the small decorations, side by side in rows across the bed
  const bedX = settings.bed?.x ?? 256, gap = 4, items = [];
  for (const p of pieces.filter((q) => q.small)) for (let i = 0; i < p.copies; i++) items.push(p);
  if (!items.length) return null;
  let x = 0, y = 0, rowH = 0, maxX = 0;
  const cells = items.map((p) => {
    const w = p.box[1] - p.box[0], h = p.box[3] - p.box[2];
    if (x > 0 && x + w > bedX) { x = 0; y += rowH + gap; rowH = 0; }
    const c = { p, x0: x, y0: y, x1: x + w, y1: y + h, dx: x - p.box[0], dy: y - p.box[2] };
    x += w + gap; rowH = Math.max(rowH, h); maxX = Math.max(maxX, c.x1);
    return c;
  });
  const maxY = y + rowH;
  const sdf = (px, py, pz) => {
    for (const c of cells) {
      if (px >= c.x0 - gap / 2 && px <= c.x1 + gap / 2 && py >= c.y0 - gap / 2 && py <= c.y1 + gap / 2) {
        return Math.max(c.p.d2(px - c.dx, py - c.dy), -pz, pz - TH);
      }
    }
    return gap / 2;
  };
  const counts = new Map();
  for (const p of items) counts.set(p.name, (counts.get(p.name) || 0) + 1);
  const what = [...counts].map(([k, v]) => `${v} × ${k.toLowerCase()}`).join(', ');
  return {
    sdf, bounds: { min: [-0.5, -0.5, 0], max: [maxX + 0.5, maxY + 0.5, TH] }, size: [maxX, maxY, TH], copies: 1,
    how: `Print 1 (${what}), flat. Glue them onto the roof's faces: the big one in the middle of each face, the small ones lower down.`,
  };
}

/** Labels and print counts for the Export tab. */
export function trimPartList(settings, geo = lanternGeometry(settings)) {
  if (geo.theme !== 'christmas') return [];
  const pieces = trimPieces(settings, geo);
  const list = [
    ['xframe', `Side frame (print ${geo.n})`],
    ['xbase', `Base trim (print ${geo.n})`],
  ];
  if (pieces.some((p) => p.key === 'xlattice')) list.push(['xlattice', `Roof lattice (print ${geo.n})`]);
  list.push(['xdecor', geo.xmas.decor === 'holly' ? 'Holly sprigs (all in one file)' : 'Snowflakes (all in one file)']);
  list.push(['xtopper', geo.xmas.topper === 'star' ? 'Star' : 'Ring']);
  return list;
}

/**
 * The trim put together on the lantern, as one mesh for the preview (lantern coordinates). Each
 * kind of piece is meshed once (coarsely) and copied to its places.
 */
export function trimPreviewMesh(settings, meshSdf, geo = lanternGeometry(settings), step = 0.7) {
  const pieces = trimPieces(settings, geo);
  const meshes = [];
  let nv = 0, ni = 0;
  for (const p of pieces) {
    const [u0, u1, v0, v1] = p.box;
    const s = p.small ? Math.min(step, Math.max(0.35, p.size / 40)) : step;
    const m = meshSdf(flatSolid(p), { min: [u0 - 0.5, v0 - 0.5, 0], max: [u1 + 0.5, v1 + 0.5, p.thick] }, s);
    meshes.push({ m, p });
    nv += m.positions.length * p.places.length; ni += m.indices.length * p.places.length;
  }
  const positions = new Float32Array(nv), indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const { m, p } of meshes) {
    for (const pl of p.places) {
      const base0 = vo / 3, src = m.positions;
      for (let i = 0; i < src.length; i += 3) {
        const u = src[i], v = src[i + 1], w = src[i + 2];
        for (let c = 0; c < 3; c++) positions[vo++] = pl.origin[c] + u * pl.ex[c] + v * pl.ey[c] + w * pl.ez[c];
      }
      for (let i = 0; i < m.indices.length; i++) indices[io++] = m.indices[i] + base0;
    }
  }
  return { positions, indices };
}

export { polyBox };
