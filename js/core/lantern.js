// The lantern (feature 12c, version 1.4; 3 to 6 sides in 1.6): flat lithophane panels, one on each
// side, held in a printed frame: corner pillars with slots, a base that holds a puck light, and a
// top in one of three styles. No DOM here: runs in the browser, the export worker and Node tests.
//
// Lantern coordinates: mm, z up, standing on the table at z = 0, centred on x = y = 0. The front
// faces -y (toward the viewer). With n sides, side k is the front turned k x (360/n) degrees
// anticlockwise seen from above (for 4 sides: front, right, back, left). Each side has its own
// frame: d = distance out from the middle (along the side's outward normal), s = along the side
// (toward the next side). Corner k is between side k and side k+1.
//
// The panels are handled as one long strip (side 0, side 1, ... side by side), so the flat panel's
// photo, text, preview and thickness tools work on it unchanged: strip u runs from -nW/2 to nW/2
// (W = one panel's width), v is up from the middle of the panels. In 3D the strip folds round the
// sides. Each panel is exported on its own, as a normal flat panel.
//
// How a corner holds two panels (seen from above): the pillar's outer faces continue the frame's
// outer faces (so it is square for 4 sides and a rhombus otherwise). A slot comes in from the
// pillar's inner face for each panel, LIP mm in from its outer face, and stops BRIDGE mm short of
// the other slot, so the pillar stays one piece. One pillar file fits every corner (it is the same
// part turned).
//
// Joints: pegs stand up from the base's corners into a hole in each pillar's foot, and a peg on
// each pillar's head goes into a hole under the top. So every pillar stands on a flat end to
// print, and the top lifts off. The pegs have the pillar's shape (square for 4 sides), so a pillar
// can't turn on its peg.
//
// Parts that touch are made to overlap a little (0.5 mm): two solids meeting exactly on a grid
// plane would otherwise leave a paper-thin gap in the mesh.

import { buildPanel, RECT_SIZES, SIDE_SIZES, IN } from './panel.js';
import { createPanelField } from './panelField.js';
import { preparePhotoLayer, LINE_EXTRA } from './field.js';
import { defaultPhotoSettings, defaultLanternSettings } from './settings.js';
import { cylinder, union, subtract } from './sdf.js';
import { trayDims } from './base.js';

export const LANTERN_TOPS = { classic: 'Standard roof', pagoda: 'Pagoda roof', lid: 'Simple lid' };
export const LANTERN_SIDE_COUNTS = [3, 4, 5, 6];

/** The names of the sides, front first, going round anticlockwise seen from above. */
export function lanternSideNames(n = 4) {
  return n === 4 ? ['Front', 'Right', 'Back', 'Left'] : Array.from({ length: n }, (_, k) => (k === 0 ? 'Front' : `Side ${k + 1}`));
}
export const LANTERN_SIDES = lanternSideNames(4);

const GROOVE = 5;      // mm the panels sit down in the base and up in the top
const LIP = 3;         // pillar wall in front of a panel
const BRIDGE = 2.5;    // pillar plastic left between the ends of its two slots
const SLOT_END = 0.5;  // room past a panel's edge at the bottom of its slot
const PEG_LEN = 6, PEG_MARGIN = 2;
const FEET = 3;        // the base's corner blocks stand out this far past the pillars
const FRAME_H = { classic: 10, pagoda: 20, lid: 10, low: 8, tiered: 8 }; // height of the top's frame round the panels
// (for the Christmas roofs: how high the inside wall goes before the inside slopes in at 45 degrees)
const ROOF_T = 2.5;    // pagoda roof thickness
const SQ2 = Math.SQRT2;
const TAU = 2 * Math.PI;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

/** The lantern settings with defaults filled in. */
export function lanternOptions(settings) {
  const L = { ...defaultLanternSettings(), ...(settings.lantern || {}) };
  L.sides = LANTERN_SIDE_COUNTS.includes(+L.sides) ? +L.sides : 4;
  return L;
}

/** One panel's width and height (mm) for the lantern's size settings. */
export function lanternPanelSize(L) {
  if (L.outline === 'square') {
    const a = SIDE_SIZES[L.size] ? SIDE_SIZES[L.size] * IN : clamp(L.side, 60, 250);
    return { W: a, H: a };
  }
  let w, h;
  if (RECT_SIZES[L.size]) {
    [w, h] = RECT_SIZES[L.size].map((v) => v * IN);
    if (L.orient === 'landscape') [w, h] = [h, w];
  } else { w = clamp(L.width, 50, 250); h = clamp(L.height, 50, 250); }
  return { W: w, H: h };
}

/** Rounds away floating-point dust (so 4 sides give exactly 0 and 1). */
const snap = (v) => Math.round(v * 1e12) / 1e12;

/** Each side's outward normal (nx, ny) and its direction along the side (tx, ty). */
function sideFrames(n) {
  return Array.from({ length: n }, (_, k) => {
    const c = snap(Math.cos((k * TAU) / n)), s = snap(Math.sin((k * TAU) / n));
    return { nx: s, ny: -c, tx: c, ty: s };
  });
}

/** The box round a regular n-sided outline whose sides are R out from the middle: [x0, x1, y0, y1]. */
export function polyBox(n, R) {
  const a = TAU / n, rv = R / Math.cos(a / 2);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < n; j++) {
    const th = -Math.PI / 2 + a / 2 + j * a, x = rv * Math.cos(th), y = rv * Math.sin(th);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return [r(x0), r(x1), r(y0), r(y1)];
}
const boxSize = (b) => [b[1] - b[0], b[3] - b[2]];

/**
 * Every size of the lantern, worked out from the number of sides, the panel size, the wall
 * thickness and the frame settings. All other parts of the lantern use these numbers.
 */
export function lanternGeometry(settings) {
  const L = lanternOptions(settings);
  const n = L.sides, a = TAU / n, ca = snap(Math.cos(a)), sa = snap(Math.sin(a)), aca = Math.abs(ca);
  const { W, H } = lanternPanelSize(L);
  const T = (settings.tMax ?? 3) + LINE_EXTRA;       // the panel's thickness (the thickest it gets)
  const slotFit = clamp(L.slotFit, 0, 1.5);
  const sw = T + slotFit;                              // slot and groove width
  const sEnd = W / 2 + SLOT_END;                       // where a slot ends, along its side
  // The panels' middle planes, out from the middle: far enough that one panel's slot stops
  // BRIDGE mm short of the next panel's slot
  const Dm = (sEnd * sa + (sw / 2) * (1 + aca) + BRIDGE) / (1 - ca);
  // Pillar thickness: thick panels get thicker pillars, so each edge still goes 4 mm into its slot
  const Pmin = (SLOT_END + 4) * sa + (sw / 2) * (1 + aca) + sw / 2 + LIP + BRIDGE;
  const P = Math.max(clamp(L.pillar, 14, 30), Pmin, sw + LIP + 2);
  const half = Dm + sw / 2 + LIP;                      // the frame's outer faces, out from the middle
  const inner = half - P;                              // the open middle's sides, out from the middle
  const cP = half - P / 2;                             // the pillars' middles (along each side's normal)
  const insert = W / 2 - (inner - Dm * ca) / sa;       // how far a panel's edge goes into its slot
  const Q = [cP * Math.tan(a / 2), -cP];               // corner 0's pillar middle (between sides 0 and 1)
  const hB = clamp(L.baseH, 20, 60);
  const zG = hB - GROOVE;                              // the panels' bottom edges (groove floor)
  const zT = zG + H + 1 - GROOVE;                      // the top's underside
  const pillarL = zT - hB;
  // The peg: the pillar's shape, h out each way from dp (along both sides' normals), in the
  // pillar's outer corner, clear of both slots' ends
  const E = half - PEG_MARGIN;
  const hFit = ca >= 0 ? (E * (1 - ca) - (sEnd + 1) * sa) / 2 : (E - ((sEnd + 1) * sa) / (1 - ca)) / 2;
  const ph = Math.max(1.5, Math.min(0.175 * P, hFit));
  const peg = { h: ph, dp: E - ph, len: PEG_LEN };
  const pegFit = clamp(L.pegFit, 0, 1);
  const puckD = settings.base?.puckD ?? 59.5, puckH = settings.base?.puckH ?? 8;
  const puckR = puckD / 2 + 1;
  const puckFits = puckR <= inner - 2;
  // Puck holder: a round hole in the floor (the puck stands on the table) or a tray (version 1.9:
  // a closed floor with a wall round the puck, a hole the cable's plug goes down through and a
  // channel under the floor to a small hole in the back wall)
  const tray = settings.base?.puckHold === 'tray';
  const td = trayDims(settings.base || {}, Math.min(puckR, inner - 2.5));
  // Near the frame's inside, the wall and the plug hole run into it (no thin slivers left between)
  td.rimToWall = td.pr + td.rimT > inner - 2.5;
  if (td.y1 > inner - 2.5) { td.y1 = inner + 1; td.y0 = td.y1 - td.hl; }
  const trayFloor = tray ? td.F : 2, trayRim = td.rimH;
  const puckZ = tray ? trayFloor : 0;                  // where the puck's bottom sits
  // Christmas theme (version 1.7): its own roofs, a topper and trim pieces (core/christmas.js)
  const christmas = L.theme === 'christmas';
  const xmas = christmas ? {
    roof: L.xRoof === 'tiered' ? 'tiered' : 'low',
    topper: L.topper === 'star' ? 'star' : 'ring',
    decor: L.decor === 'holly' ? 'holly' : 'snow',
    cover: clamp(L.trimCover, 6, 25),
  } : null;
  const top = christmas ? xmas.roof : LANTERN_TOPS[L.top] ? L.top : 'classic';
  const hF = FRAME_H[top];
  const ov = clamp(L.overhang, 0, 30);

  // The top's own sizes and its height; R: how far out it reaches (along the sides' normals)
  const t = { style: top, hF, ov, R: half + ov };
  if (christmas) {
    Object.assign(t, christmasRoofSizes({ n, a, half, inner, ov }, top));
  } else if (top === 'classic') {
    t.bh = Math.max(8, ov + 1);                        // beam height (its ends are cut back at 45 degrees)
    t.capOv = Math.min(4, Math.max(2, ov / 2));        // how far a cap sticks out past its post
    t.capH = t.capOv + 3;
    t.height = Math.max(clamp(L.topH, 15, 80), hF + t.bh + t.capH + 4);
    t.bw = P - 4;                                      // beam width
    t.sB = cP * Math.tan(a / 2) + P / 2 + ov;          // a beam's ends, along its side
    t.sCut = Math.min(...[-1, 1].map((e) => (half - (cP + (e * t.bw) / 2) * ca) / sa)); // where it leaves the frame
    t.R = Math.max(half + ov, cP + (P / 2 + ov) * sa + (t.bw / 2) * aca, cP + P / 2 - 2 + t.capOv);
  } else if (top === 'pagoda') {
    // the eaves can't reach below the top's underside; very short ones are left off (too small to print well)
    t.ov = ov < 3 ? 0 : Math.min(ov, hF - 3);
    t.R = half + t.ov;
    t.zA = hF - 2 + ROOF_T * SQ2 + half;               // the roof's peak (45 degree sides)
    t.height = Math.min(Math.max(clamp(L.topH, 15, 200), hF + 14), t.zA);
  } else {
    t.plate = 3;
    t.height = Math.max(clamp(L.topH, 15, 80), hF + t.plate);
    t.hRing = t.height - t.plate;
  }
  const footBox = polyBox(n, Math.max(half + FEET, t.R));
  const [fw, fd] = boxSize(footBox);
  return {
    n, a, ca, sa, frames: sideFrames(n),
    W, H, T, sw, slotFit, sEnd, P, Dm, Dout: Dm + T / 2, half, inner, cP, Q, insert, hB, zG, zT, pillarL,
    peg, pegFit, puckD, puckH, puckR, puckFits, tray, td, trayFloor, trayRim, puckZ, top: t, theme: christmas ? 'christmas' : 'plain', xmas,
    notchSide: Math.floor(n / 2),                      // the cable leaves through this side's wall (the back)
    baseSize: boxSize(polyBox(n, half + FEET)),
    footBox, footprint: [fw, fd], width: Math.max(fw, fd), totalHeight: zT + t.height,
    cableW: settings.base?.cableW ?? 10, cableH: settings.base?.cableH ?? 8,
  };
}

/** Middle of side k along the strip (n sides). */
export const sideCenterU = (W, k, n = 4) => (k - (n - 1) / 2) * W;
/** Which side a strip position is on (n sides). */
export function sideOf(W, u, n = 4) {
  const k = Math.floor((u + (n * W) / 2) / W);
  return k < 0 ? 0 : k > n - 1 ? n - 1 : k;
}

/** How much light reaches a spot on a panel, compared with the middle of a panel (even glow). */
export function lanternLight(geo, ul, v) {
  // The puck's top shines up from the middle of the lantern; a panel catches light best head-on
  const irr = (x, vv) => {
    const dz = geo.zG + geo.H / 2 + vv - geo.puckH - (geo.puckZ ?? 0);
    const d2 = geo.Dm * geo.Dm + x * x + dz * dz, d = Math.sqrt(d2);
    const emit = 0.35 + 0.65 * Math.max(0, dz / d); // a puck's diffuser also lights sideways
    return (emit * (geo.Dm / d)) / d2;
  };
  return irr(ul, v) / irr(0, 0);
}

/** Panel settings for one lantern panel: flat, no frame or feet, picture detail facing out. */
export function lanternPanelSettings(settings, geo = lanternGeometry(settings)) {
  return {
    ...settings,
    reliefSide: 'outside',
    panel: { outline: 'rect', size: 'custom', width: geo.W, height: geo.H, curve: 0, frame: false, frameWidth: 6, frameExtra: 2, feet: false },
    base: { ...(settings.base || {}), panelKind: 'none' },
  };
}

/** One lantern panel on its own (for export): a flat W x H panel. */
export function lanternSidePanel(settings, geo = lanternGeometry(settings)) {
  return buildPanel(lanternPanelSettings(settings, geo));
}

/**
 * All the panels as one strip that folds round the lantern (for the preview and the tools).
 * Has the flat panel's shape interface (pointAt, surfAt, ...), kind 'lantern', sides and geo.
 */
export function buildLanternStrip(settings, geo = lanternGeometry(settings)) {
  const { W, H, n, frames } = geo;
  const strip = buildPanel({ panel: { outline: 'rect', size: 'custom', width: n * W, height: H, curve: 0, frame: false } });
  function surfAt(u, v, out) {
    const k = sideOf(W, u, n), F = frames[k];
    const px = u - sideCenterU(W, k, n), d = geo.Dout;
    out.x = px * F.tx + d * F.nx; out.y = px * F.ty + d * F.ny; out.z = v;
    out.nx = F.nx; out.ny = F.ny; out.nz = 0;
    return out;
  }
  return { ...strip, kind: 'lantern', surfAt, sideW: W, sides: n, geo, distEdge: () => 1e9 };
}

/** Photo layers: each photo fills the panel on its side (photo setting `side`: 0..n-1). */
export function lanternLayers(settings, geo, photos) {
  return (settings.photos || [])
    .filter((c) => !c.hidden && photos && photos[c.id] && c.side >= 0 && c.side < geo.n)
    .map((c) => {
      const p = { ...defaultPhotoSettings(), ...c, feather: 0.3, windowShape: 'rect' };
      const L = preparePhotoLayer(p, photos[c.id], geo.W, geo.H);
      L.cx = sideCenterU(geo.W, c.side, geo.n); L.cy = 0;
      return L;
    });
}

/**
 * The lantern's thickness field on the strip (like a flat panel's field), with even glow from the
 * puck. sideField(k, sidePanel) gives side k's field on a flat panel of its own, for export.
 */
export function createLanternField(settings, strip, photos, textMasks = null) {
  const geo = strip.geo, { W, n } = geo;
  const ls = lanternPanelSettings(settings, geo);
  const f = createPanelField(ls, strip, photos, textMasks, {
    layers: lanternLayers(settings, geo, photos),
    light: (u, v) => lanternLight(geo, u - sideCenterU(W, sideOf(W, u, n), n), v),
  });
  function sideField(k, sidePanel) {
    const P = {}, S = {}, uk = sideCenterU(W, k, n);
    return {
      eval(theta, s, out) {
        sidePanel.pointAt(theta, s, P);
        sidePanel.surfAt(P.u, P.v, S);
        return f.evalUV(P.u + uk, P.v, out, S);
      },
      reliefOutside: true, hasRaised: false,
    };
  }
  return { ...f, kind: 'lantern', geo, reliefOutside: true, sideField };
}

// ---------------------------------------------------------------- frame parts
// Shapes are distance functions f(x, y, z) (negative inside). Corner pieces are made for corner 0
// (between side 0, the front, and side 1) and turned to the others.

/** f turned by angle th anticlockwise (seen from above) round the lantern's middle. */
const rotA = (f, th) => { const c = snap(Math.cos(th)), s = snap(Math.sin(th)); return (x, y, z) => f(x * c + y * s, -x * s + y * c, z); };
const move = (f, dx, dy, dz) => (x, y, z) => f(x - dx, y - dy, z - dz);
const zBand = (z, z0, z1) => Math.max(z0 - z, z - z1);
/** Something made for corner 0 (or side 0), at every corner (or on every side). */
const atCorners = (geo, f) => Array.from({ length: geo.n }, (_, k) => rotA(f, k * geo.a));
const allSides = atCorners;
/** Corner 0's two side frames: d0, s0 (the front) and d1, s1 (side 1) at a point. */
function cornerD(geo) {
  const { ca, sa } = geo;
  return (x, y) => ({ d0: -y, s0: x, d1: x * sa - y * ca, s1: x * ca + y * sa });
}
/** How far out the frame's outline is at a point (the largest of the sides' d). */
function polyD(geo) {
  const F = geo.frames;
  return (x, y) => { let m = -Infinity; for (const f of F) { const d = x * f.nx + y * f.ny; if (d > m) m = d; } return m; };
}
/** The pillar's shape at corner 0: grown by g mm, a rhombus (a square for 4 sides) round cP. */
function cornerShape(geo, cd, x, y, cen, h) {
  const { d0, d1 } = cd(x, y);
  return Math.max(Math.abs(d0 - cen), Math.abs(d1 - cen)) - h;
}

/** The groove a panel's edge sits in, in the base or the top (front side; z0..z1). */
const groove = (geo, z0, z1) => (x, y, z) => Math.max(Math.abs(x) - geo.sEnd, Math.abs(-y - geo.Dm) - geo.sw / 2, zBand(z, z0, z1));
/** A peg hole at corner 0, from z0 to z1. */
function pegHole(geo, z0, z1) {
  const cd = cornerD(geo), { peg, pegFit: f } = geo;
  return (x, y, z) => Math.max(cornerShape(geo, cd, x, y, peg.dp, peg.h + f), zBand(z, z0, z1));
}
/** A peg at corner 0, from z0 to z1, its tip edges cut back 0.5 mm so it starts easily. */
function pegSolid(geo, z0, z1, tipUp) {
  const cd = cornerD(geo), { peg } = geo;
  return (x, y, z) => {
    const r = cornerShape(geo, cd, x, y, peg.dp, 0);
    const tip = tipUp ? z1 : z0, dz = tipUp ? tip - z : z - tip;
    return Math.max(r - peg.h, zBand(z, z0, z1), (r - (peg.h - 0.5) - dz) / SQ2);
  };
}

/**
 * Corner 0's pillar, standing up, in lantern x/y (z = 0 at its foot, up to pillarL), with a peg
 * hole in its foot and a peg on its head. Its two slots hold side 0's and side 1's panels.
 */
function pillarAtCorner(geo) {
  const { P, sw, sEnd, Dm, cP, pillarL: Lp, peg } = geo, cd = cornerD(geo);
  const body = (x, y, z) => Math.max(cornerShape(geo, cd, x, y, cP, P / 2), zBand(z, 0, Lp));
  const slotA = (x, y, z) => { const { d0, s0 } = cd(x, y); return Math.max(Math.abs(d0 - Dm) - sw / 2, s0 - sEnd, zBand(z, -1, Lp + 1)); };
  const slotB = (x, y, z) => { const { d1, s1 } = cd(x, y); return Math.max(Math.abs(d1 - Dm) - sw / 2, -s1 - sEnd, zBand(z, -1, Lp + 1)); };
  return union(subtract(body, slotA, slotB, pegHole(geo, -1, peg.len + 0.8)), pegSolid(geo, Lp - 0.5, Lp + peg.len, true));
}

/** The pillar's own box (its middle at x = y = 0): [x0, x1, y0, y1]. */
function pillarBox(geo) {
  const { ca, sa, half, inner, Q } = geo;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const d0 of [inner, half]) for (const d1 of [inner, half]) {
    const x = (d1 - d0 * ca) / sa - Q[0], y = -d0 - Q[1];
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return [x0, x1, y0, y1];
}

/**
 * One pillar, standing up, in its own coordinates: its middle at x = y = 0, from z = 0 to
 * pillarL, with a peg hole in its foot and a peg on its head. Its outer face toward the front is
 * at y = -P/2 (it is corner 0's pillar, moved).
 */
export function pillarSdf(geo) {
  return move(pillarAtCorner(geo), -geo.Q[0], -geo.Q[1], 0);
}

/** The base, in lantern coordinates (standing on the table). */
export function baseSdf(geo) {
  const { half, inner, P, cP, hB, zG } = geo, cd = cornerD(geo), pd = polyD(geo);
  const ring = (x, y, z) => { const d = pd(x, y); return Math.max(d - half, inner - d, zBand(z, 0, hB)); };
  const foot = (x, y, z) => Math.max(cornerShape(geo, cd, x, y, cP, P / 2 + FEET), zBand(z, 0, hB - 3));
  const back = geo.notchSide * geo.a; // the cable notch (or the tray's cable hole) faces this way
  const out = half + FEET + 2;
  let floor, notch;
  if (geo.tray) {
    // A closed floor with a wall round the puck. In the turned frame the back is -y: the plug hole
    // cuts through the wall there, and the cable runs under the floor out through the back wall.
    const { F, rimT, rimH, cw, ch, hw, y0, y1 } = geo.td, r = geo.td.pr;
    const floorSlab = (x, y, z) => Math.max(pd(x, y) - (inner + 0.5), zBand(z, 0, F));
    const rimOut = geo.td.rimToWall ? (x, y, z) => Math.max(pd(x, y) - (inner + 0.5), zBand(z, F - 0.5, F + rimH))
      : cylinder(r + rimT, F - 0.5, F + rimH);
    const rim = subtract(rimOut, cylinder(r, F - 1, F + rimH + 1));
    const plugHole = rotA((x, y, z) => Math.max(Math.abs(x) - hw, y0 + y, -y - y1, zBand(z, -1, F + rimH + 1)), back);
    floor = subtract(union(floorSlab, rim), plugHole);
    notch = rotA((x, y, z) => Math.max(Math.abs(x) - cw / 2, (y0 + y1) / 2 + y, -y - out, zBand(z, -1, ch)), back);
  } else {
    const floorSlab = (x, y, z) => Math.max(pd(x, y) - (inner + 0.5), zBand(z, 0, 2));
    floor = subtract(floorSlab, cylinder(Math.min(geo.puckR, inner - 3), -1, 3));
    notch = rotA((x, y, z) => Math.max(Math.abs(x) - geo.cableW / 2, (inner - 1) + y, -y - out, zBand(z, -1, geo.cableH)), back);
  }
  const body = subtract(union(ring, floor, ...atCorners(geo, foot)), notch, ...allSides(geo, groove(geo, zG, hB + 1)));
  return union(body, ...atCorners(geo, move(pegSolid(geo, -0.5, geo.peg.len, true), 0, 0, hB)));
}

/** The frame round the top of the panels, with grooves and peg holes underneath (top coordinates). */
function topFrame(geo, h) {
  const { half, inner } = geo, pd = polyD(geo);
  return {
    solid: (x, y, z) => { const d = pd(x, y); return Math.max(d - half, inner - d, zBand(z, 0, h)); },
    cuts: [...allSides(geo, groove(geo, -1, GROOVE)), ...atCorners(geo, pegHole(geo, -1, geo.peg.len + 0.8))],
  };
}

/**
 * The top, in its own coordinates: z = 0 is its underside, which rests on the pillars. Styles:
 * classic (frame, open lattice, crossed beams with 45 degree ends, posts and capped corners),
 * pagoda (a 45 degree roof with eaves, vents in the frame, open at the top when cut short) and lid
 * (a flat cap with vent holes; prints upside down).
 */
export function topSdf(geo) {
  if (geo.top.style === 'low' || geo.top.style === 'tiered') return christmasRoofSdf(geo);
  const { half, inner, cP, P } = geo, t = geo.top, pd = polyD(geo), cd = cornerD(geo);
  if (t.style === 'classic') {
    const fr = topFrame(geo, t.hF);
    const nl = Math.max(3, Math.round((2 * inner) / 12)), sp = (2 * inner) / nl, bw = 2.4;
    const dGrid = (v) => { const q = (v + inner) / sp; return Math.abs(q - Math.round(q)) * sp; };
    const lattice = (x, y, z) => Math.max(Math.min(dGrid(x), dGrid(y)) - bw / 2, pd(x, y) - inner - 0.5, zBand(z, 0, 2.4));
    const z0 = t.hF, z1 = t.hF + t.bh;
    // One beam along each side, over the pillars, its ends sticking out past the corners
    const beam = (x, y, z) => {
      const s = Math.abs(x), d = -y;
      return Math.max(s - t.sB, Math.abs(d - cP) - t.bw / 2, z0 - 0.5 - z, z - z1, (z0 + s - t.sCut - z) / SQ2);
    };
    const ph = P / 2 - 2, zc0 = t.height - t.capH;
    const post = (x, y, z) => Math.max(cornerShape(geo, cd, x, y, cP, ph), zBand(z, z1 - 0.5, zc0 + 0.5));
    const cap = (x, y, z) => {
      const r = cornerShape(geo, cd, x, y, cP, 0);
      return Math.max(r - (ph + t.capOv), z - t.height, zc0 - z, (zc0 + (r - ph) - z) / SQ2);
    };
    return subtract(union(fr.solid, lattice, ...allSides(geo, beam), ...atCorners(geo, post), ...atCorners(geo, cap)), ...fr.cuts);
  }
  if (t.style === 'pagoda') {
    const fr = topFrame(geo, t.hF);
    const vw = 12, vz0 = GROOVE + 2, vz1 = t.hF - 6, vs = (inner * Math.tan(geo.a / 2)) / 2; // a quarter of the way along each side
    const vent = (x, y, z) => Math.max(Math.min(...[-vs, 0, vs].map((xv) => Math.abs(x - xv))) - vw / 2,
      (inner - 1) + y, -y - (half + 0.5), zBand(z, vz0, vz1)); // ends just past the wall, clear of the eaves
    const tq = ROOF_T * SQ2, zA = t.zA, edge = half + t.ov;
    const zFlat = zA - tq - edge + 1.5;
    const roof = (x, y, z) => {
      const r = pd(x, y);
      // the eaves end in a vertical edge with its bottom 1.5 mm flattened (a sharp knife edge
      // underneath would not mesh cleanly)
      return Math.max((z - zA + r) / SQ2, -((z - (zA - tq) + r) / SQ2), r - edge, zFlat - z, z - t.height);
    };
    // Under the eaves, a small 45 degree brace where they meet the frame (no thin wedge of air there)
    const zs = t.hF - 5;
    const brace = (x, y, z) => { const r = pd(x, y); return Math.max(half - 1 - r, r - (half + 1.5), zs + (r - half) - z, z - t.hF); };
    return subtract(union(fr.solid, roof, ...(t.ov > 0 ? [brace] : [])), ...fr.cuts, ...allSides(geo, vent));
  }
  // lid
  const fr = topFrame(geo, t.hRing);
  const reachL = half + t.ov, sp = 10, rh = 3;
  const plate = (x, y, z) => Math.max(pd(x, y) - reachL, zBand(z, t.hRing - 0.5, t.height));
  // Only whole holes, well inside the frame (a hole cut off by the edge would leave thin slivers)
  const holes = (x, y, z) => {
    const cx = Math.round(x / sp) * sp, cy = Math.round(y / sp) * sp;
    if (pd(cx, cy) > inner - 3 - rh) return sp / 2 - rh;
    return Math.max(Math.hypot(x - cx, y - cy) - rh, zBand(z, t.hRing - 1, t.height + 1));
  };
  return subtract(union(fr.solid, plate), holes, ...fr.cuts);
}

// ---------------------------------------------------------------- Christmas roofs (version 1.7)
// Both roofs print as they sit, with no supports: the eaves rest on a 45 degree flare that grows
// out of the frame, and the inside is hollowed at 45 degrees up to a small flat ceiling (a short
// bridge). The outside is a low roof (about 30 degrees; steeper only when a big lantern needs it to
// keep that ceiling short). A socket in the flat peak takes the topper's tab.
const XR = { rPeak: 7, socketD: 6.5, socketW: 6.4, socketT: 3.4, wall: 2.5, capMax: 15 };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A Christmas roof's sizes: style 'low' (photo 1) or 'tiered' (photo 2, upturned corners). */
function christmasRoofSizes({ half, inner, ov: ov0 }, style) {
  const ov = clamp(ov0, 3, 30), edge = half + ov, hcb = FRAME_H[style];
  const s = { ov, edge, R: edge, hcb, rPeak: XR.rPeak, socketD: XR.socketD, socketW: XR.socketW, socketT: XR.socketT };
  if (style === 'tiered') {
    Object.assign(s, {
      ef: 3.5, rb: Math.max(XR.rPeak + 12, half * 0.5), hb: 12, ov2: clamp(ov * 0.6, 4, 10), ef2: 3,
    });
    s.U1 = Math.min(6, ov * 0.5); s.W1 = ov + 10;     // upturned corners: how high, over how far in
    s.U2 = Math.min(4, s.ov2 * 0.5); s.W2 = s.ov2 + 5;
  } else s.ef = 4;
  // The pitch: 30 degrees, steeper only if the flat ceiling inside would get too wide
  for (let k = Math.tan(Math.PI / 6); ; k += 0.01) {
    let zTop, cav;
    if (style === 'tiered') {
      const zL = (r) => ov + s.ef + (edge - r) * k;
      const zB = zL(s.rb) + s.hb;
      const zU = (r) => zB + s.ov2 + s.ef2 + (s.rb + s.ov2 - Math.max(r, s.rPeak)) * k;
      zTop = zU(0);
      cav = (r) => (r <= s.rb ? zU(r) : zL(r)); // the lowest solid top above the hollow
      Object.assign(s, { zB, zLb: zL(s.rb) });
    } else {
      zTop = ov + s.ef + (edge - s.rPeak) * k;
      cav = (r) => zTop - Math.max(0, r - s.rPeak) * k;
    }
    const apex = hcb + inner;
    let zCap = apex;
    for (let i = 0; i <= 200; i++) {
      const r = (inner * i) / 200;
      let A = cav(r) - XR.wall;
      if (r <= 4.5) A = Math.min(A, zTop - XR.socketD - 2);
      if (apex - r > A) zCap = Math.min(zCap, A);
    }
    Object.assign(s, { k, height: zTop, zCap, rc: apex - zCap });
    if (apex - zCap <= XR.capMax || k >= 1) break;
  }
  return s;
}

/** A Christmas roof (top coordinates: z = 0 is its underside, resting on the pillars). */
function christmasRoofSdf(geo) {
  const t = geo.top, pd = polyD(geo), F = geo.frames, ta = Math.tan(geo.a / 2), norm = Math.sqrt(1 + t.k * t.k);
  const { half, inner } = geo;
  // how far out (r) and how near a corner (lat: 0 in a side's middle, 1 at a corner)
  const where = (x, y) => {
    // r is a smooth maximum of the sides' distances, so the hips and corners are rounded by about
    // a millimetre (an exact crease lined up with the mesh grid can leave a hole in the mesh)
    let m = -Infinity, kk = 0, sm = -Infinity;
    for (let k = 0; k < F.length; k++) {
      const d = x * F[k].nx + y * F[k].ny;
      if (d > m) { m = d; kk = k; }
      const h = Math.max(1.2 - Math.abs(sm - d), 0) / 1.2;
      sm = Math.max(sm, d) + h * h * 0.3;
    }
    const s = x * F[kk].tx + y * F[kk].ty;
    return { r: sm, lat: m > 1e-6 ? Math.min(1, Math.abs(s) / (m * ta)) : 0 };
  };
  let solid;
  if (t.style === 'tiered') {
    solid = (x, y, z) => {
      // the upturn rises toward each corner and levels off there (a peak right on the corner would
      // leave a thin crest)
      const { r, lat } = where(x, y), q = clamp01((lat - 0.35) / 0.65), l4 = q * q * (3 - 2 * q);
      const e1 = clamp01((r - (t.edge - t.W1)) / t.W1), e2 = clamp01((r - (t.rb + t.ov2 - t.W2)) / t.W2);
      const zL = Math.min(t.ov + t.ef + (t.edge - r) * t.k + t.U1 * l4 * e1 * e1, t.zB);
      const lower = Math.max(r - t.edge, (r - half - z) / SQ2, (z - zL) / norm, -z);
      const band = Math.max(r - t.rb, z - t.zB, -z);
      const zU = t.zB + t.ov2 + t.ef2 + (t.rb + t.ov2 - Math.max(r, t.rPeak)) * t.k + t.U2 * l4 * e2 * e2;
      const upper = Math.max(r - (t.rb + t.ov2), (t.zB + (r - t.rb) - z) / SQ2, (z - zU) / norm);
      return Math.min(lower, band, upper);
    };
  } else {
    solid = (x, y, z) => {
      const { r } = where(x, y), surf = t.height - Math.max(0, r - t.rPeak) * t.k;
      return Math.max(r - t.edge, (r - half - z) / SQ2, (z - surf) / norm, -z);
    };
  }
  const cavity = (x, y, z) => { const r = pd(x, y); return Math.max(r - inner, z - (t.hcb + inner - r), z - t.zCap, -1 - z); };
  const socket = (x, y, z) => Math.max(Math.abs(x) - t.socketW / 2, Math.abs(y) - t.socketT / 2, t.height - t.socketD - z);
  return subtract(solid, cavity, socket, ...topFrame(geo, 1).cuts);
}

/** The whole frame put together (for the preview), in lantern coordinates. */
export function lanternAssembly(settings, geo = lanternGeometry(settings)) {
  const pillars = atCorners(geo, move(pillarAtCorner(geo), 0, 0, geo.hB));
  const top = move(topSdf(geo), 0, 0, geo.zT);
  const sdf = union(baseSdf(geo), ...pillars, top);
  const b = geo.footBox;
  return {
    sdf,
    bounds: { min: [b[0] - 2, b[2] - 2, 0], max: [b[1] + 2, b[3] + 2, geo.totalHeight] },
    info: frameInfo(geo),
  };
}

const frameInfo = (geo) => ({
  lantern: true, seatFloor: geo.zG, width: geo.footprint[0], depth: geo.footprint[1],
  height: geo.totalHeight, totalHeight: geo.totalHeight, flip: false,
});

/**
 * One frame part laid out the way it prints, with no supports: { sdf, bounds, size, how }.
 * part: 'pillar' (stands up when it fits the printer, else lies on an outer face), 'base' (as it
 * sits on the table) or 'top' (the lid prints upside down; the others as they sit).
 */
export function lanternPart(settings, part, geo = lanternGeometry(settings)) {
  const bedZ = settings.bed?.z ?? 256, n = geo.n;
  if (part === 'pillar') {
    const f = pillarSdf(geo), { P, pillarL: Lp, peg } = geo, [x0, x1, y0, y1] = pillarBox(geo);
    const tall = Lp + peg.len;
    const many = `Print ${n}.`;
    if (tall <= bedZ) {
      return {
        sdf: f, bounds: { min: [x0 - 0.5, y0 - 0.5, 0], max: [x1 + 0.5, y1 + 0.5, tall] },
        size: [x1 - x0, y1 - y0, tall], how: `${many} Each stands up on its foot (the end with the hole). No supports needed.`,
      };
    }
    // Lying on its outer face toward the front (y = -P/2): (x, y, z) -> (x, -z, y + P/2)
    return {
      sdf: (x, y, z) => f(x, z - P / 2, -y), bounds: { min: [x0 - 0.5, -tall, 0], max: [x1 + 0.5, 0, y1 + P / 2 + 0.5] },
      size: [x1 - x0, tall, y1 + P / 2], how: `${many} Too tall to stand on your printer, so each lies on an outer face (slots facing up and sideways). No supports needed.`,
    };
  }
  if (part === 'base') {
    const b = polyBox(n, geo.half + FEET + 1), h = geo.hB + geo.peg.len;
    return {
      sdf: baseSdf(geo), bounds: { min: [b[0], b[2], 0], max: [b[1], b[3], h] },
      size: [...geo.baseSize, h], how: 'Prints as it sits on the table, pegs up. No supports needed.',
    };
  }
  const f = topSdf(geo), H = geo.top.height, b = polyBox(n, geo.top.R + 1), size = [...boxSize(polyBox(n, geo.top.R)), H];
  if (geo.top.style === 'lid') {
    // Upside down: turned half a turn round the x axis
    return {
      sdf: (x, y, z) => f(x, -y, H - z), bounds: { min: [b[0], -b[3], 0], max: [b[1], -b[2], H] },
      size, how: 'Prints upside down (the flat cap on the bed): the STL is already turned. No supports needed.',
    };
  }
  return {
    sdf: f, bounds: { min: [b[0], b[2], 0], max: [b[1], b[3], H] },
    size, how: geo.theme === 'christmas'
      ? 'Prints as it sits on the lantern: the eaves rest on a 45 degree flare and the inside slopes at 45 degrees up to a short flat bridge, so no supports are needed.'
      : 'Prints as it sits on the lantern. Its overhangs are cut at 45 degrees, so no supports are needed.',
  };
}

/**
 * The frame put together as one mesh, for the preview: each part is meshed on its own (quick) and
 * the pillar is copied to every corner. Returns { positions, indices, info } in lantern
 * coordinates.
 */
export function lanternFrameMesh(settings, meshSdf, step = 1.2, geo = lanternGeometry(settings)) {
  const [x0, x1, y0, y1] = pillarBox(geo);
  const pillar = meshSdf(pillarSdf(geo), { min: [x0 - 0.5, y0 - 0.5, 0], max: [x1 + 0.5, y1 + 0.5, geo.pillarL + geo.peg.len] }, Math.min(step, 1));
  const bb = polyBox(geo.n, geo.half + FEET + 1);
  const base = meshSdf(baseSdf(geo), { min: [bb[0], bb[2], 0], max: [bb[1], bb[3], geo.hB + geo.peg.len] }, step);
  const tb = polyBox(geo.n, geo.top.R + 1);
  const top = meshSdf(topSdf(geo), { min: [tb[0], tb[2], 0], max: [tb[1], tb[3], geo.top.height] }, step);
  const pieces = [{ m: base, th: 0, dx: 0, dy: 0, dz: 0 }, { m: top, th: 0, dx: 0, dy: 0, dz: geo.zT }];
  // corner k's pillar: the pillar moved to corner 0, then turned k steps round the middle
  for (let k = 0; k < geo.n; k++) pieces.push({ m: pillar, th: k * geo.a, dx: geo.Q[0], dy: geo.Q[1], dz: geo.hB, pre: true });
  let nv = 0, ni = 0;
  for (const p of pieces) { nv += p.m.positions.length; ni += p.m.indices.length; }
  const positions = new Float32Array(nv), indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const { m, th, dx, dy, dz, pre } of pieces) {
    const cs = Math.cos(th), sn = Math.sin(th), src = m.positions, base0 = vo / 3;
    for (let i = 0; i < src.length; i += 3) {
      // pillars move first, then turn; the base and top only turn (by 0)
      const x = src[i] + (pre ? dx : 0), y = src[i + 1] + (pre ? dy : 0);
      positions[vo++] = x * cs - y * sn + (pre ? 0 : dx); positions[vo++] = x * sn + y * cs + (pre ? 0 : dy); positions[vo++] = src[i + 2] + dz;
    }
    for (let i = 0; i < m.indices.length; i++) indices[io++] = m.indices[i] + base0;
  }
  return { positions, indices, info: frameInfo(geo) };
}
