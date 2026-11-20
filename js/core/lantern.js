// The lantern (feature 12c, version 1.4): four flat lithophane panels, one on each side, held in a
// printed frame: four corner pillars with slots, a base that holds a puck light, and a top in one
// of three styles. No DOM here: runs in the browser, the export worker and Node tests.
//
// Lantern coordinates: mm, z up, standing on the table at z = 0, centred on x = y = 0. The front
// faces -y (toward the viewer); going round anticlockwise seen from above come the right (+x),
// the back (+y) and the left (-x). Side k is the front turned k x 90 degrees anticlockwise.
//
// The four panels are handled as one long strip (front, right, back, left side by side), so the
// flat panel's photo, text, preview and thickness tools work on it unchanged: strip u runs from
// -2W to 2W (W = one panel's width), v is up from the middle of the panels. In 3D the strip folds
// round the four sides. Each panel is exported on its own, as a normal flat panel.
//
// How a corner holds two panels (seen from above, the front-right pillar, centred on its middle):
// a slot comes in from the pillar's inner face for each panel, LIP mm in from its outer face, and
// stops BRIDGE mm short of the other slot, so the pillar stays one piece. One pillar file fits
// every corner (it is the same part turned).
//
// Joints: square pegs stand up from the base's corners into a hole in each pillar's foot, and a
// peg on each pillar's head goes into a hole under the top. So every pillar stands on a flat end
// to print, and the top lifts off.
//
// Parts that touch are made to overlap a little (0.5 mm): two solids meeting exactly on a grid
// plane would otherwise leave a paper-thin gap in the mesh.

import { buildPanel, RECT_SIZES, SIDE_SIZES, IN } from './panel.js';
import { createPanelField } from './panelField.js';
import { preparePhotoLayer, LINE_EXTRA } from './field.js';
import { defaultPhotoSettings, defaultLanternSettings } from './settings.js';
import { box, cylinder, union, subtract } from './sdf.js';

export const LANTERN_SIDES = ['Front', 'Right', 'Back', 'Left'];
export const LANTERN_TOPS = { classic: 'Like the photo', pagoda: 'Pagoda roof', lid: 'Simple lid' };

const GROOVE = 5;      // mm the panels sit down in the base and up in the top
const LIP = 3;         // pillar wall in front of a panel
const BRIDGE = 2.5;    // pillar plastic left between the ends of its two slots
const SLOT_END = 0.5;  // room past a panel's edge at the bottom of its slot
const PEG_LEN = 6, PEG_MARGIN = 2;
const FEET = 3;        // the base's corner blocks stand out this far past the pillars
const FRAME_H = { classic: 10, pagoda: 16, lid: 10 }; // height of the top's frame round the panels
const ROOF_T = 2.5;    // pagoda roof thickness
const SQ2 = Math.SQRT2;
const ROT = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // cos, sin of k x 90 degrees

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

/** The lantern settings with defaults filled in. */
export function lanternOptions(settings) {
  return { ...defaultLanternSettings(), ...(settings.lantern || {}) };
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

/**
 * Every size of the lantern, worked out from the panel size, the wall thickness and the frame
 * settings. All other parts of the lantern use these numbers.
 */
export function lanternGeometry(settings) {
  const L = lanternOptions(settings);
  const { W, H } = lanternPanelSize(L);
  const T = (settings.tMax ?? 3) + LINE_EXTRA;       // the panel's thickness (the thickest it gets)
  const slotFit = clamp(L.slotFit, 0, 1.5);
  const sw = T + slotFit;                              // slot and groove width
  // Pillar thickness: thick panels get thicker pillars, so each edge still goes 4 mm into its slot
  const P = Math.max(clamp(L.pillar, 14, 30), sw + LIP + BRIDGE + SLOT_END + 4);
  const o = Math.max(0, P / 2 - sw / 2 - LIP);         // a slot's middle, out from the pillar's middle
  const xe = o - sw / 2 - BRIDGE;                      // where a slot ends, from the pillar's middle
  const c = W / 2 + SLOT_END - xe;                     // the pillars' middles, out from the lantern's
  const Dm = c + o;                                    // the panels' middle planes, out from the middle
  const half = c + P / 2;                              // half the frame's width
  const inner = c - P / 2;                             // half the open middle
  const insert = W / 2 - inner;                        // how far a panel's edge goes into its slot
  const hB = clamp(L.baseH, 20, 60);
  const zG = hB - GROOVE;                              // the panels' bottom edges (groove floor)
  const zT = zG + H + 1 - GROOVE;                      // the top's underside
  const pillarL = zT - hB;
  const pw = Math.max(3, Math.min(0.35 * P, P / 2 - PEG_MARGIN - xe - 1));
  const peg = { x0: P / 2 - PEG_MARGIN - pw, x1: P / 2 - PEG_MARGIN, y0: -(P / 2 - PEG_MARGIN), y1: -(P / 2 - PEG_MARGIN - pw), len: PEG_LEN };
  const pegFit = clamp(L.pegFit, 0, 1);
  const puckD = settings.base?.puckD ?? 70, puckH = settings.base?.puckH ?? 20;
  const puckR = puckD / 2 + 1;
  const puckFits = puckR <= inner - 2;
  // Puck holder: a round hole in the floor (the puck stands on the table) or a tray (a closed floor
  // with a low rim round the puck and a gap in the rim for the cord)
  const tray = settings.base?.puckHold === 'tray';
  const trayFloor = 2, trayRim = Math.min(8, Math.max(3, Math.round(puckH * 0.4)));
  const puckZ = tray ? trayFloor : 0;                  // where the puck's bottom sits
  const top = LANTERN_TOPS[L.top] ? L.top : 'classic';
  const hF = FRAME_H[top];
  const ov = clamp(L.overhang, 0, 30);

  // The top's own sizes and its height
  const t = { style: top, hF, ov };
  if (top === 'classic') {
    t.bh = Math.max(8, ov + 1);                        // beam height (its ends are cut back at 45 degrees)
    t.capOv = Math.min(4, Math.max(2, ov / 2));        // how far a cap sticks out past its post
    t.capH = t.capOv + 3;
    t.height = Math.max(clamp(L.topH, 15, 80), hF + t.bh + t.capH + 4);
  } else if (top === 'pagoda') {
    t.ov = Math.min(ov, hF - 3);                       // the eaves can't reach below the top's underside
    t.zA = hF - 2 + ROOF_T * SQ2 + half;               // the roof's peak (45 degree sides)
    t.height = Math.min(Math.max(clamp(L.topH, 15, 200), hF + 14), t.zA);
  } else {
    t.plate = 3;
    t.height = Math.max(clamp(L.topH, 15, 80), hF + t.plate);
    t.hRing = t.height - t.plate;
  }
  const reach = half + Math.max(FEET, t.ov) + 2;
  return {
    W, H, T, sw, slotFit, P, o, xe, c, Dm, Dout: Dm + T / 2, half, inner, insert, hB, zG, zT, pillarL,
    peg, pegFit, puckD, puckH, puckR, puckFits, tray, trayFloor, trayRim, puckZ, top: t, reach,
    totalHeight: zT + t.height, width: 2 * reach - 4,
    cableW: settings.base?.cableW ?? 10, cableH: settings.base?.cableH ?? 8,
  };
}

/** Middle of side k (0 front, 1 right, 2 back, 3 left) along the strip. */
export const sideCenterU = (W, k) => (k - 1.5) * W;
/** Which side a strip position is on. */
export function sideOf(W, u) {
  const k = Math.floor((u + 2 * W) / W);
  return k < 0 ? 0 : k > 3 ? 3 : k;
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
 * The four panels as one strip that folds round the lantern (for the preview and the tools).
 * Has the flat panel's shape interface (pointAt, surfAt, ...), kind 'lantern', and geo.
 */
export function buildLanternStrip(settings, geo = lanternGeometry(settings)) {
  const { W, H } = geo;
  const strip = buildPanel({ panel: { outline: 'rect', size: 'custom', width: 4 * W, height: H, curve: 0, frame: false } });
  function surfAt(u, v, out) {
    const k = sideOf(W, u);
    const px = u - sideCenterU(W, k), py = -geo.Dout;
    const [cs, sn] = ROT[k];
    out.x = px * cs - py * sn; out.y = px * sn + py * cs; out.z = v;
    out.nx = sn; out.ny = -cs; out.nz = 0;
    return out;
  }
  return { ...strip, kind: 'lantern', surfAt, sideW: W, geo, distEdge: () => 1e9 };
}

/** Photo layers: each photo fills the panel on its side (photo setting `side`: 0..3). */
export function lanternLayers(settings, geo, photos) {
  return (settings.photos || [])
    .filter((c) => !c.hidden && photos && photos[c.id] && c.side >= 0 && c.side <= 3)
    .map((c) => {
      const p = { ...defaultPhotoSettings(), ...c, feather: 0.3, windowShape: 'rect' };
      const L = preparePhotoLayer(p, photos[c.id], geo.W, geo.H);
      L.cx = sideCenterU(geo.W, c.side); L.cy = 0;
      return L;
    });
}

/**
 * The lantern's thickness field on the strip (like a flat panel's field), with even glow from the
 * puck. sideField(k, sidePanel) gives side k's field on a flat panel of its own, for export.
 */
export function createLanternField(settings, strip, photos, textMasks = null) {
  const geo = strip.geo;
  const ls = lanternPanelSettings(settings, geo);
  const f = createPanelField(ls, strip, photos, textMasks, {
    layers: lanternLayers(settings, geo, photos),
    light: (u, v) => lanternLight(geo, u - sideCenterU(geo.W, sideOf(geo.W, u)), v),
  });
  function sideField(k, sidePanel) {
    const P = {}, S = {}, uk = sideCenterU(geo.W, k);
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
const rotK = (f, k) => { const [cs, sn] = ROT[k]; return (x, y, z) => f(x * cs + y * sn, -x * sn + y * cs, z); };
const move = (f, dx, dy, dz) => (x, y, z) => f(x - dx, y - dy, z - dz);
/** Where corner k's pillar stands (its middle). */
function cornerXY(geo, k) {
  const [cs, sn] = ROT[k];
  return [geo.c * (cs + sn), geo.c * (sn - cs)];
}
/** Something made for the front-right corner (in pillar coordinates), at every corner. */
function atCorners(geo, f, dz = 0) {
  return [0, 1, 2, 3].map((k) => { const [X, Y] = cornerXY(geo, k); return move(rotK(f, k), X, Y, dz); });
}
/** Something made for the front side, on all four sides. */
const allSides = (f) => [0, 1, 2, 3].map((k) => rotK(f, k));

/** The groove a panel's edge sits in, in the base or the top (front side; z0..z1). */
const groove = (geo, z0, z1) => box(-(geo.c + geo.xe), geo.c + geo.xe, -geo.Dm - geo.sw / 2, -geo.Dm + geo.sw / 2, z0, z1);
/** A peg hole (pillar coordinates), from z0 to z1. */
function pegHole(geo, z0, z1) {
  const { peg, pegFit: f } = geo;
  return box(peg.x0 - f, peg.x1 + f, peg.y0 - f, peg.y1 + f, z0, z1);
}

/** A peg (pillar coordinates), from z0 to z1, its tip edges cut back 0.5 mm so it starts easily. */
function pegSolid(geo, z0, z1, tipUp) {
  const { peg } = geo, cx = (peg.x0 + peg.x1) / 2, cy = (peg.y0 + peg.y1) / 2, hw = (peg.x1 - peg.x0) / 2;
  return (x, y, z) => {
    const r = Math.max(Math.abs(x - cx), Math.abs(y - cy));
    const tip = tipUp ? z1 : z0, dz = tipUp ? tip - z : z - tip;
    return Math.max(r - hw, z0 - z, z - z1, (r - (hw - 0.5) - dz) / SQ2);
  };
}

/**
 * One pillar, standing up, in its own coordinates: its middle at x = y = 0, from z = 0 to
 * pillarL, with a peg hole in its foot and a peg on its head. Made for the front-right corner
 * (slots on its -x and +y faces).
 */
export function pillarSdf(geo) {
  const { P, o, sw, xe, pillarL: Lp, peg } = geo;
  const body = box(-P / 2, P / 2, -P / 2, P / 2, 0, Lp);
  const slotA = box(-P / 2 - 1, xe, -o - sw / 2, -o + sw / 2, -1, Lp + 1);
  const slotB = box(o - sw / 2, o + sw / 2, -xe, P / 2 + 1, -1, Lp + 1);
  return union(subtract(body, slotA, slotB, pegHole(geo, -1, peg.len + 0.8)), pegSolid(geo, Lp - 0.5, Lp + peg.len, true));
}

/** The base, in lantern coordinates (standing on the table). */
export function baseSdf(geo) {
  const { half, inner, P, hB, zG } = geo;
  const ring = subtract(box(-half, half, -half, half, 0, hB), box(-inner, inner, -inner, inner, -1, hB + 1));
  const feet = atCorners(geo, box(-P / 2 - FEET, P / 2 + FEET, -P / 2 - FEET, P / 2 + FEET, 0, hB - 3));
  const floorSlab = box(-inner - 0.5, inner + 0.5, -inner - 0.5, inner + 0.5, 0, 2);
  let floor;
  if (geo.tray) {
    // A closed floor with a rim round the puck; the rim has a gap at the back for the cord
    const r = Math.min(geo.puckR, inner - 2.5), zr = geo.trayFloor + geo.trayRim;
    const rim = subtract(cylinder(r + 2, 1.5, zr), cylinder(r, 1, zr + 1),
      box(-geo.cableW / 2, geo.cableW / 2, 0, r + 3, 1, zr + 1));
    floor = union(floorSlab, rim);
  } else {
    floor = subtract(floorSlab, cylinder(Math.min(geo.puckR, inner - 3), -1, 3));
  }
  const notch = box(-geo.cableW / 2, geo.cableW / 2, inner - 1, half + FEET + 2, -1, geo.cableH);
  const body = subtract(union(ring, floor, ...feet), notch, ...allSides(groove(geo, zG, hB + 1)));
  return union(body, ...atCorners(geo, pegSolid(geo, -0.5, geo.peg.len, true), hB));
}

/** The frame round the top of the panels, with grooves and peg holes underneath (top coordinates). */
function topFrame(geo, h) {
  const { half, inner } = geo;
  return {
    solid: subtract(box(-half, half, -half, half, 0, h), box(-inner, inner, -inner, inner, -1, h + 1)),
    cuts: [...allSides(groove(geo, -1, GROOVE)), ...atCorners(geo, pegHole(geo, -1, geo.peg.len + 0.8))],
  };
}

/**
 * The top, in its own coordinates: z = 0 is its underside, which rests on the pillars. Styles:
 * classic (frame, open lattice, crossed beams with 45 degree ends, posts and capped corners),
 * pagoda (a 45 degree roof with eaves, vents in the frame, open at the top when cut short) and lid
 * (a flat cap with vent holes; prints upside down).
 */
export function topSdf(geo) {
  const { half, inner, c, P } = geo;
  const t = geo.top;
  if (t.style === 'classic') {
    const fr = topFrame(geo, t.hF);
    const n = Math.max(3, Math.round((2 * inner) / 12)), sp = (2 * inner) / n, bw = 2.4;
    const dGrid = (v) => { const q = (v + inner) / sp; return Math.abs(q - Math.round(q)) * sp; };
    const lattice = (x, y, z) => Math.max(Math.min(dGrid(x), dGrid(y)) - bw / 2, Math.abs(x) - inner - 0.5, Math.abs(y) - inner - 0.5, -z, z - 2.4);
    const bwB = P - 4, z0 = t.hF, z1 = t.hF + t.bh, reachB = half + t.ov;
    const beamX = (yc) => (x, y, z) => Math.max(Math.abs(x) - reachB, Math.abs(y - yc) - bwB / 2, z0 - 0.5 - z, z - z1, (z0 + Math.abs(x) - half - z) / SQ2);
    const beamY = (xc) => (x, y, z) => beamX(xc)(y, x, z);
    const ph = P / 2 - 2, zc0 = t.height - t.capH;
    const post = box(-ph, ph, -ph, ph, z1 - 0.5, zc0 + 0.5);
    const cap = (x, y, z) => {
      const r = Math.max(Math.abs(x), Math.abs(y));
      return Math.max(r - (ph + t.capOv), z - t.height, zc0 - z, (zc0 + (r - ph) - z) / SQ2);
    };
    return subtract(union(fr.solid, lattice, beamX(-c), beamX(c), beamY(-c), beamY(c),
      ...atCorners(geo, post), ...atCorners(geo, cap)), ...fr.cuts);
  }
  if (t.style === 'pagoda') {
    const fr = topFrame(geo, t.hF);
    const vw = 12, vz0 = GROOVE + 2, vz1 = t.hF - 3, vs = inner / 2;
    const vents = allSides(union(...[-vs, 0, vs].map((x) => box(x - vw / 2, x + vw / 2, -half - 1, -inner + 1, vz0, vz1))));
    const tq = ROOF_T * SQ2, zA = t.zA, edge = half + t.ov;
    const roof = (x, y, z) => {
      const r = Math.max(Math.abs(x), Math.abs(y));
      return Math.max((z - zA + r) / SQ2, -((z - (zA - tq) + r) / SQ2), r - edge, z - t.height);
    };
    return subtract(union(fr.solid, roof), ...fr.cuts, ...vents);
  }
  // lid
  const fr = topFrame(geo, t.hRing);
  const reachL = half + t.ov, sp = 10, rh = 3;
  const dg = (v) => Math.abs(v - Math.round(v / sp) * sp);
  const plate = box(-reachL, reachL, -reachL, reachL, t.hRing - 0.5, t.height);
  const holes = (x, y, z) => Math.max(Math.hypot(dg(x), dg(y)) - rh, Math.max(Math.abs(x), Math.abs(y)) - (inner - 3), t.hRing - 1 - z, z - t.height - 1);
  return subtract(union(fr.solid, plate), holes, ...fr.cuts);
}

/** The whole frame put together (for the preview), in lantern coordinates. */
export function lanternAssembly(settings, geo = lanternGeometry(settings)) {
  const pillars = atCorners(geo, pillarSdf(geo), geo.hB);
  const top = move(topSdf(geo), 0, 0, geo.zT);
  const sdf = union(baseSdf(geo), ...pillars, top);
  return {
    sdf,
    bounds: { min: [-geo.reach, -geo.reach, 0], max: [geo.reach, geo.reach, geo.totalHeight] },
    info: { lantern: true, seatFloor: geo.zG, width: geo.width, depth: geo.width, height: geo.totalHeight, totalHeight: geo.totalHeight, flip: false },
  };
}

/**
 * One frame part laid out the way it prints, with no supports: { sdf, bounds, size, how }.
 * part: 'pillar' (stands up when it fits the printer, else lies on an outer face), 'base' (as it
 * sits on the table) or 'top' (the lid prints upside down; the others as they sit).
 */
export function lanternPart(settings, part, geo = lanternGeometry(settings)) {
  const bedZ = settings.bed?.z ?? 256;
  if (part === 'pillar') {
    const f = pillarSdf(geo), { P, pillarL: Lp, peg } = geo;
    const tall = Lp + peg.len;
    if (tall <= bedZ) {
      return {
        sdf: f, bounds: { min: [-P / 2, -P / 2, 0], max: [P / 2, P / 2, tall] },
        size: [P, P, tall], how: 'Print 4. Each stands up on its foot (the end with the hole). No supports needed.',
      };
    }
    // Lying on its outer (-y) face: (x, y, z) -> (x, -z, y + P/2)
    return {
      sdf: (x, y, z) => f(x, z - P / 2, -y), bounds: { min: [-P / 2, -tall, 0], max: [P / 2, 0, P] },
      size: [P, tall, P], how: 'Print 4. Too tall to stand on your printer, so each lies on an outer face (slots facing up and sideways). No supports needed.',
    };
  }
  if (part === 'base') {
    const r = geo.half + 3;
    return {
      sdf: baseSdf(geo), bounds: { min: [-r, -r, 0], max: [r, r, geo.hB + geo.peg.len] },
      size: [2 * r, 2 * r, geo.hB + geo.peg.len], how: 'Prints as it sits on the table, pegs up. No supports needed.',
    };
  }
  const f = topSdf(geo), H = geo.top.height, r = geo.half + Math.max(geo.top.ov, 0) + 1;
  if (geo.top.style === 'lid') {
    return {
      sdf: (x, y, z) => f(x, -y, H - z), bounds: { min: [-r, -r, 0], max: [r, r, H] },
      size: [2 * r - 2, 2 * r - 2, H], how: 'Prints upside down (the flat cap on the bed): the STL is already turned. No supports needed.',
    };
  }
  return {
    sdf: f, bounds: { min: [-r, -r, 0], max: [r, r, H] },
    size: [2 * r - 2, 2 * r - 2, H], how: 'Prints as it sits on the lantern. Its overhangs are cut at 45 degrees, so no supports are needed.',
  };
}

/**
 * The frame put together as one mesh, for the preview: each part is meshed on its own (quick) and
 * the pillar is copied to the four corners. Returns { positions, indices, info } in lantern
 * coordinates.
 */
export function lanternFrameMesh(settings, meshSdf, step = 1.2, geo = lanternGeometry(settings)) {
  const P = geo.P, r = geo.half + 3;
  const pillar = meshSdf(pillarSdf(geo), { min: [-P / 2, -P / 2, 0], max: [P / 2, P / 2, geo.pillarL + geo.peg.len] }, Math.min(step, 1));
  const base = meshSdf(baseSdf(geo), { min: [-r, -r, 0], max: [r, r, geo.hB + geo.peg.len] }, step);
  const rt = geo.half + geo.top.ov + 1;
  const top = meshSdf(topSdf(geo), { min: [-rt, -rt, 0], max: [rt, rt, geo.top.height] }, step);
  const pieces = [{ m: base, k: 0, dx: 0, dy: 0, dz: 0 }, { m: top, k: 0, dx: 0, dy: 0, dz: geo.zT }];
  for (let k = 0; k < 4; k++) { const [X, Y] = cornerXY(geo, k); pieces.push({ m: pillar, k, dx: X, dy: Y, dz: geo.hB }); }
  let nv = 0, ni = 0;
  for (const p of pieces) { nv += p.m.positions.length; ni += p.m.indices.length; }
  const positions = new Float32Array(nv), indices = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const { m, k, dx, dy, dz } of pieces) {
    const [cs, sn] = ROT[k], src = m.positions, base0 = vo / 3;
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i], y = src[i + 1];
      positions[vo++] = x * cs - y * sn + dx; positions[vo++] = x * sn + y * cs + dy; positions[vo++] = src[i + 2] + dz;
    }
    for (let i = 0; i < m.indices.length; i++) indices[io++] = m.indices[i] + base0;
  }
  return {
    positions, indices,
    info: { lantern: true, seatFloor: geo.zG, width: geo.width, depth: geo.width, height: geo.totalHeight, totalHeight: geo.totalHeight, flip: false },
  };
}
