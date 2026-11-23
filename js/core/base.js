// The lamp base: a printable stand that holds the light and the lamp's collar.
// Three kinds: an LED puck inside the base, an LED strip wrapped round a hollow riser post that
// rises into the lamp, or a lamp socket (E12 / E26) on a threaded nipple.
// Every base has a seat on top that the collar drops into, and a notch for the cable.
// A puck can stand on the table in the open bottom, or (version 1.9) sit in a tray that lifts
// with the lamp: one piece when the opening is wide enough to drop it in from above (a cylinder),
// else a bottom cover that presses into the base.
//
// Coordinates: millimetres, Z up, the base standing on the table at z = 0, centred on x/y = 0.
// The notch faces the back (+Y). No DOM here.

import { cylinder, box, roundedSquare, cone, union, subtract } from './sdf.js';
import { collarDims, SHAPES } from './settings.js';
import { panelEdgeThickness } from './panel.js';

export const NIPPLE_HOLE_R = 5.4; // 1/8" IPS threaded lamp nipple (about 10.3 mm) plus clearance
export const SOCKETS = {
  E12: { label: 'E12 (candelabra)', bodyDia: 22 },
  E26: { label: 'E26 (standard)', bodyDia: 40 },
};

/** Default base settings. */
export function defaultBaseSettings() {
  return {
    light: 'puck',     // 'puck' | 'strip' | 'bulb'
    puckD: 59.5, puckH: 8, // LED puck size, mm (70 x 20 before version 1.9)
    puckHold: 'tray',  // 'hole' (open bottom: the puck stays on the table) | 'tray' (the puck lifts with the lamp)
    socket: 'E12',     // bulb socket type
    riserD: 30,        // strip riser outside diameter, mm
    riserH: 0,         // strip riser height above the base top, mm; 0 = up to the middle of the lamp
    clearance: 0.4,    // extra room around the collar in the seat, mm (on the diameter)
    shape: 'auto',     // 'auto' (round under balls, square under the cube) | 'round' | 'square'
    extra: 0,          // extra width all round, mm
    cableW: 10, cableH: 8, // cable notch (open bottom), mm
    // Puck tray (version 1.9): a wall round the puck, a hole in the floor the cable's plug goes
    // through, and a channel under the floor to a small hole in the side
    rimH: 5,           // height of the wall round the puck, mm
    cableD: 3,         // cable thickness, mm
    cableHoleH: 4,     // height of the cable's hole in the side, mm
    plugW: 15.5, plugH: 15, // the biggest part on the cable (the plug), mm
    coverFit: 0.15,    // balls and cube: extra room round the bottom cover's wall, mm (each side)
    // Flat panel's enclosed box (version 1.11): the frame over the picture's edge, and how far the
    // puck's face is from the panel (0 = worked out from the panel's size)
    boxCover: 6, boxDepth: 0,
  };
}

const clampN = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : d));

/**
 * Sizes of the puck tray for a puck whose room has radius pr (the wall stands just outside it).
 * The tray is a floor F thick with a channel under it (open to the table) from the plug hole out
 * to the side, so only a small hole shows. The plug hole is at the back (+y), from y0 to y1: it
 * cuts through the wall, so the cable can drop from the puck's side straight down into it.
 */
export function trayDims(b, pr) {
  const cableD = clampN(b.cableD, 1.5, 10, 3);
  const ch = clampN(b.cableHoleH, cableD + 0.5, 20, cableD + 1);
  const rimH = clampN(b.rimH, 2, 15, 5), rimT = 2;
  const hw = (clampN(b.plugW, 4, 40, 15.5) + 1) / 2, hl = clampN(b.plugH, 4, 40, 15) + 1;
  const y1 = pr + rimT + cableD + 0.5;
  return { cableD, cw: cableD + 1, ch, F: ch + 1.6, rimH, rimT, hw, hl, y0: y1 - hl, y1, pr };
}

/** The tray as one piece: floor (outer shape `plate`, F thick), wall round the puck, plug hole and channel. */
function traySdf(td, plate, reach) {
  const { F, pr, rimT, rimH, cw, ch, hw, y0, y1 } = td;
  const rim = subtract(cylinder(pr + rimT, F - 0.5, F + rimH), cylinder(pr, F - 1, F + rimH + 1));
  return subtract(union(plate, rim),
    box(-hw, hw, y0, y1, -1, F + rimH + 1),            // the plug goes down through here
    box(-cw / 2, cw / 2, (y0 + y1) / 2, reach, -1, ch)); // the cable runs under the floor to the side
}

/** Moves a solid up by dz. */
const raise = (f, dz) => (x, y, z) => f(x, y, z - dz);

/** How wide the lamp is (for a base in proportion to it). */
function lampWidth(settings, shape) {
  if (shape && shape.kind === 'cylinder') return shape.D;
  if (SHAPES[settings.shape]?.body === 'cube') return settings.cube?.size ?? 100;
  if (settings.shape === 'football') return settings.footballWidth;
  return settings.diameter;
}

/**
 * Builds the base for the current settings.
 * shape: the built lamp shape (used for the riser height: the middle of the lamp).
 * Returns { sdf, bounds, parts, info }: sdf and bounds are the whole base put together (for the
 * preview); parts.base (and parts.cover for a puck tray under a narrow opening) are the pieces as
 * they print, each { sdf, bounds, flip }. info has the sizes and whether the base prints upside down.
 */
export function buildBase(settings, shape) {
  if (shape && shape.kind === 'panel') return buildPanelBase(settings, shape);
  const b = { ...defaultBaseSettings(), ...(settings.base || {}) };
  // A cylinder's bottom band is its collar: it drops into the seat
  const cyl = !!shape && shape.kind === 'cylinder';
  const col = cyl ? shape.collar : collarDims(settings);
  const rs = col.ro + b.clearance / 2;            // seat hole radius
  const seatD = col.height;                        // the collar rests on the seat floor
  const square = b.shape === 'square' || (b.shape === 'auto' && SHAPES[settings.shape]?.body === 'cube');
  const prop = 0.28 * lampWidth(settings, shape);
  const notch = (R, h) => box(-b.cableW / 2, b.cableW / 2, 0, R + 10, -1, h);
  const outer = (R, H) => (square ? roundedSquare(R, Math.min(8, R * 0.2), 0, H) : cylinder(R, 0, H));
  let sdf, H, R, flip, riserTop = null, extraInfo = {}, parts = null;

  if (b.light === 'bulb') {
    const hb = 28, plate = 3;
    H = hb + plate + seatD;
    R = Math.max(rs + 10, 32, prop) + b.extra;
    sdf = subtract(outer(R, H),
      cylinder(R - 3, -1, hb),                        // room for the socket's nut and wiring
      cylinder(NIPPLE_HOLE_R, hb - 1, H + 1),          // threaded nipple through the top
      cylinder(rs, H - seatD, H + 1),                  // collar seat
      notch(R, Math.min(b.cableH, hb - 2)));
    flip = true;
    extraInfo = { socket: b.socket, socketFits: SOCKETS[b.socket].bodyDia < col.ri * 2 - 2 };
  } else if (b.light === 'strip') {
    const roT = Math.min(b.riserD / 2, col.ri - 1.5), riT = roT - 2;
    R = Math.max(rs + 8, prop) + b.extra;
    // (under a wide cylinder the hollow for the controller stays modest; the rest is solid)
    const rc = cyl ? Math.min(R - 3, riT + 24) : R - 3, hc0 = 8;
    // the 45° ceiling narrows to the riser's hollow, and must finish below the seat floor
    H = hc0 + (rc - riT) + 2.5 + seatD;
    const zSeat = H - seatD;
    // Up to the middle of the lamp: collar height plus the depth of the opening below the centre
    let zEdge = 0;
    if (shape && !cyl) {
      const o = {};
      zEdge = Infinity;
      for (let i = 0; i < 64; i++) { const th = (i / 64) * 2 * Math.PI; shape.surf(th, shape.phiEdge(th), o); zEdge = Math.min(zEdge, o.z); }
    }
    const toMiddle = cyl ? shape.H / 2 : col.height + (shape ? -zEdge : 60);
    riserTop = H + (b.riserH > 0 ? b.riserH : Math.max(10, toMiddle - seatD - 5));
    // A tall riser must stay inside the lamp: at least 5 mm below its inside wall over the riser
    // (a cylinder is open at the top: just keep the riser 10 mm below its rim)
    if (cyl) {
      const maxTop = H - seatD + shape.H - 10;
      if (riserTop > maxTop) { riserTop = Math.max(H + 10, maxTop); extraInfo.riserLimited = true; }
    } else if (shape) {
      const centre = zSeat + col.height - zEdge;        // the lamp's centre, in base coordinates
      const ci = shape.c - (settings.tMax ?? 3) - 0.4;  // inside top above the centre
      const over = shape.kind === 'cube' ? ci : Math.sqrt(Math.max(0, ci * ci - roT * roT));
      const maxTop = centre + over - 5;
      if (riserTop > maxTop) { riserTop = Math.max(H + 10, maxTop); extraInfo.riserLimited = true; }
    }
    const coneTop = hc0 + (rc - riT);
    sdf = subtract(
      union(outer(R, H), cylinder(roT, zSeat, riserTop)),
      cylinder(rc, -1, hc0),                           // space for the strip's controller
      cone(rc, -1, hc0, coneTop + 0.01),               // 45° ceiling: prints without supports
      cylinder(riT, hc0, riserTop + 1),                // hollow riser for the wires
      subtract(cylinder(rs, zSeat, H + 1), cylinder(roT, zSeat - 1, riserTop + 1)), // collar seat round the riser
      box(-3, 3, 0, roT + 1, riserTop - 9, riserTop - 3), // wire hole near the top of the riser
      notch(R, Math.min(b.cableH, hc0 - 1)));
    flip = false;
    extraInfo = { ...extraInfo, riserD: roT * 2, riserHeight: riserTop - H };
  } else { // LED puck
    const pr = b.puckD / 2 + 0.6;
    const tray = b.puckHold === 'tray';
    const td = tray ? trayDims(b, pr) : null;
    // Drop-in tray: the opening is wide enough for the puck and the plug to go in from above, so
    // the base is one piece with a closed floor. Otherwise a separate bottom cover holds the puck.
    const rIn = col.ri - 1.5;
    // (the plug hole comes in a little if need be, as long as it still cuts through the wall)
    const yIn = Math.sqrt(Math.max(0, rIn * rIn - (td ? td.hw * td.hw : 0)));
    if (tray && yIn >= td.pr + td.rimT + 1) {
      if (td.y1 > yIn) { td.y1 = yIn; td.y0 = yIn - td.hl; }
      const hc = Math.max(b.puckH + 1, td.rimH + 0.5);
      H = td.F + hc + seatD;
      R = Math.max(rIn + 3, rs + 8, prop) + b.extra;
      const shell = subtract(outer(R, H),
        cylinder(rIn, td.F, H + 1),                    // the puck drops in from above
        cylinder(rs, H - seatD, H + 1));               // collar seat
      sdf = traySdf(td, shell, R + 10);
      flip = false;
      extraInfo = { tray: 'dropin', td, floor: td.F, rimH: td.rimH, cableHole: [td.cw, td.ch] };
    } else if (tray) {
      // The base: open underneath, with room round the puck for the cover's wall, which presses in
      const cf = clampN(b.coverFit, 0, 1, 0.15);
      const rc = pr + td.rimT + cf, hc = Math.max(b.puckH + 1, td.rimH + 0.5), floor = 2;
      const rh = Math.max(8, Math.min(rIn, rc - 3));
      const Hb = hc + floor + seatD;
      R = Math.max(rc + 3, td.y1 + cf + 2.5, rs + 8, prop) + b.extra;
      const baseOnly = subtract(outer(R, Hb),
        cylinder(rc, -1, hc),                          // room for the puck and the cover's wall
        box(-td.hw, td.hw, 0, td.y1 + cf, -1, hc),     // room for the cable over the plug hole
        cylinder(rh, hc - 1, Hb + 1),                  // light shines up through here
        cylinder(rs, Hb - seatD, Hb + 1));             // collar seat
      const cover = traySdf(td, outer(R, td.F), R + 10);
      const coverTop = td.F + td.rimH;
      H = td.F + Hb;
      // The base alone prints upside down; the cover prints as it sits (wall up)
      parts = {
        base: { sdf: baseOnly, bounds: { min: [-R, -R, 0], max: [R, R, Hb] }, flip: true },
        cover: { sdf: cover, bounds: { min: [-R, -R, 0], max: [R, R, coverTop] }, flip: false },
      };
      // Put together, for the preview: overlapping a little, and the thin gap round the cover's
      // wall filled, so it meshes cleanly
      const gapFill = subtract(cylinder(rc + 0.5, td.F - 0.5, td.F + td.rimH), cylinder(pr, td.F - 1, td.F + td.rimH + 1), box(-td.hw, td.hw, 0, R, -1, H));
      sdf = union(cover, raise(baseOnly, td.F - 0.2), gapFill);
      flip = true;
      extraInfo = { tray: 'cover', td, floor: td.F, rimH: td.rimH, cableHole: [td.cw, td.ch], baseHeight: Hb, coverHeight: coverTop };
    } else {
      const rc = pr, hc = b.puckH + 1, floor = 2;
      const rh = Math.max(8, Math.min(rIn, rc - 3));
      H = hc + floor + seatD;
      R = Math.max(rc + 3, rs + 8, prop) + b.extra;
      sdf = subtract(outer(R, H),
        cylinder(rc, -1, hc),                          // the puck goes in from below
        cylinder(rh, hc - 1, H + 1),                   // light shines up through here
        cylinder(rs, H - seatD, H + 1),                // collar seat
        notch(R, Math.min(b.cableH, hc)));
      flip = true;
    }
  }

  const top = riserTop ?? H;
  const bounds = { min: [-R, -R, 0], max: [R, R, top] };
  return {
    sdf, bounds,
    // the parts as they print: the base (and a bottom cover with a tray); each sits at z = 0
    parts: parts || { base: { sdf, bounds, flip } },
    info: {
      light: b.light, square, width: 2 * R, height: H, totalHeight: top,
      seatR: rs, seatFloor: H - seatD, flip, ...extraInfo,
    },
  };
}

// ---------------------------------------------------------------- flat panel bases
// All stand as they sit on the table (no supports) and hold the panel in a slot shaped like its
// bottom edge: straight for a flat panel, curved for a curved one. Coordinates match the panel's
// (x right, y away from the viewer, front of the panel at y = 0 in the middle).
//   Enclosed box (version 1.11, the default): a closed box the panel stands in. A frame across the
//   front covers the picture's edge; the panel slides down through a slot in the top into a groove
//   behind the frame; the puck sits in a holder on a back that presses on, facing the panel.
//   Light box: a block as wide as the panel. Behind the slot, an open trough holds an LED strip on
//   a floor that leans 30° toward the panel, so the strip shines up the panel's back.
//   Slot stand: a shorter, deeper block with just the slot.
const TILT = Math.tan((30 * Math.PI) / 180);
const COS_TILT = Math.cos((30 * Math.PI) / 180);

export const PANEL_BASE_KINDS = {
  enclosure: 'Enclosed box', lightbox: 'Light box (LED strip)', stand: 'Slot stand', none: 'None',
};

/** The flat panel base's kind ('enclosure' to start). */
export const panelBaseKind = (settings) => (PANEL_BASE_KINDS[settings.base?.panelKind] ? settings.base.panelKind : 'enclosure');

const BOX = { wall: 3, lip: 2, ledge: 2.5, back: 3, rim: 5, rimT: 1.6, cupT: 2 };

/**
 * The enclosed box's layout (shared by the box and the panel's even glow). Panel-base coordinates:
 * x right, y back (the panel's front at y = 0), z up (the box on the table at z = 0). Returns the
 * box's insides { wi (half width), z0, z1 (the panel's bottom and top edges' room), y0 (front),
 * slot [s0, s1] (the groove the panel stands in), yIn (behind the groove), yBack (where the back
 * fits), ledge }, its outside, and the puck { x, y (its face), z, r, h }.
 */
export function panelBoxLayout(settings, panel) {
  const b = { ...defaultBaseSettings(), ...(settings.base || {}) };
  const clr = b.clearance, Tp = panelEdgeThickness(settings), t = BOX.wall;
  const wi = panel.W / 2 + clr / 2, z0 = t, z1 = t + panel.H + clr;
  const s0 = -clr / 2, s1 = Tp + clr / 2, y0 = s0 - BOX.lip;
  const cover = clampN(b.boxCover, 2, 25, 6);
  const puckR = clampN(b.puckD, 30, 160, 59.5) / 2, puckH = clampN(b.puckH, 5, 60, 8);
  // how far the puck's face is from the panel: about a third of the panel's size (an even glow)
  const auto = Math.round(Math.min(90, Math.max(30, 0.3 * Math.max(panel.W, panel.H))));
  const dist = b.boxDepth > 0 ? clampN(b.boxDepth, 15, 150, auto) : auto;
  const yFace = s1 + dist, yBack = yFace + puckH;     // the back's inside face, where the puck rests
  return {
    clr, Tp, t, wi, z0, z1, s0, s1, y0, yIn: s1, yBack, cover, dist, distAuto: !(b.boxDepth > 0),
    ledge: BOX.ledge, outer: { x: wi + t, z: z1 + t, y0, y1: yBack + BOX.back },
    puck: { x: 0, y: yFace, z: z0 + clr / 2 + panel.H / 2, r: puckR, h: puckH },
    cableW: clampN(b.cableD, 1.5, 10, 3) + 1, fit: clampN(b.coverFit, 0, 1, 0.15),
  };
}

/**
 * The panel's base, or null for 'none'. info: { light, width, depth, height, totalHeight,
 * seatFloor (height of the slot floor, where the panel's bottom edge sits), flip: false, slotDepth }.
 */
export function buildPanelBase(settings, panel) {
  const b = { ...defaultBaseSettings(), ...(settings.base || {}) };
  const kind = panelBaseKind(settings);
  if (kind === 'none') return null;
  const clr = b.clearance;
  const Tp = panelEdgeThickness(settings);
  const box = kind === 'lightbox';

  // Arc length along the front and depth behind it (exact for a flat panel; for a curved one,
  // measured round the bend's axis)
  const R = panel.R, flat = !Number.isFinite(R);
  const arcDep = flat
    ? (x, y, o) => { o[0] = x; o[1] = y; }
    : (x, y, o) => { o[0] = R * Math.atan2(x, y + R); o[1] = Math.hypot(x, y + R) - R; };
  const toXY = (arc, dep) => (flat ? [arc, dep] : [(R + dep) * Math.sin(arc / R), (R + dep) * Math.cos(arc / R) - R]);
  if (kind === 'enclosure') return buildPanelBox(settings, panel);

  const H = box ? 24 : 16;
  const slotDepth = box ? 10 : 8;
  const zSlot = H - slotDepth;
  const s0 = -clr / 2, s1 = Tp + clr / 2;              // the slot, in depth
  const stripW = Math.max(4, b.stripW ?? 10);
  const d0 = s1 + 2.5, d1 = d0 + stripW + 3;           // the trough (light box)
  const dFront = s0 - (box ? 4 : 14);
  const dBack = box ? d1 + 3 : s1 + 14;
  const halfW = box ? panel.W / 2 + 4 + b.extra / 2 : Math.min(panel.W / 2, Math.max(30, panel.W / 4)) + b.extra / 2;
  // The slot only needs to be as long as the panel is wide at the top of the slot
  const panelHalf = panel.outline === 'rect' || panel.outline === 'square' ? panel.W / 2 : panel.widthAt(panel.bottom + slotDepth) / 2;
  const slotHalf = Math.min(halfW - 1.5, panelHalf + 0.5);
  const troughHalf = Math.min(halfW - 3, panel.W / 2 - 3);
  const zT0 = zSlot - 3;                               // trough floor at its front edge
  // Level for the first 2 mm (a sharp wedge there is too thin to mesh cleanly), then leaning
  const zFloor = (dep) => zT0 + Math.max(0, dep - d0 - 2) * TILT;

  // Block: the rectangle round the band of the base, along the panel's bottom edge
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= 40; i++) for (const dep of [dFront, dBack]) {
    const [x, y] = toXY(-halfW + (2 * halfW * i) / 40, dep);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }

  const q = [0, 0];
  const cableW = Math.max(4, b.cableW);
  const sdf = (x, y, z) => {
    let d = Math.max(x0 - x, x - x1, y0 - y, y - y1, -z, z - H); // the block
    arcDep(x, y, q);
    const arc = q[0], dep = q[1], aa = Math.abs(arc);
    // the slot
    d = Math.max(d, -Math.max(aa - slotHalf, s0 - dep, dep - s1, zSlot - z));
    if (box) {
      // the trough with its leaning floor
      d = Math.max(d, -Math.max(aa - troughHalf, d0 - dep, dep - d1, (zFloor(dep) - z) * COS_TILT));
      // cable notch out through the back at the right-hand end, open at the top
      d = Math.max(d, -Math.max(troughHalf - cableW - arc, arc - troughHalf, d1 - 0.5 - dep, zFloor(d1) - 0.5 - z));
    }
    return d;
  };

  const bounds = { min: [x0, y0, 0], max: [x1, y1, H] };
  return {
    sdf, bounds, parts: { base: { sdf, bounds, flip: false } },
    info: {
      light: kind, panel: true, width: x1 - x0, depth: y1 - y0, height: H, totalHeight: H,
      seatFloor: zSlot, slotDepth, flip: false, stripW,
    },
  };
}

/**
 * A signed distance to the panel's outline (u, v: panel coordinates; positive inside). Rectangles
 * and circles have one already; the heart's is the same inside and out, so an inside/outside map
 * (0.5 mm squares, from the outline) gives it its sign.
 */
function outlineSigned(panel) {
  if (panel.outline !== 'heart') return panel.distEdge;
  const pts = panel.pts.filter((_, i) => i % Math.max(1, Math.floor(panel.pts.length / 600)) === 0), n = pts.length;
  const g = 0.5, x0 = -panel.W / 2 - 2, y0 = -panel.H / 2 - 2;
  const nx = Math.ceil((panel.W + 4) / g) + 1, ny = Math.ceil((panel.H + 4) / g) + 1, inside = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const v = y0 + j * g, xs = [];
    for (let k = 0; k < n; k++) {
      const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % n];
      if ((ay > v) !== (by > v)) xs.push(ax + ((v - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      for (let i = Math.max(0, Math.ceil((xs[q] - x0) / g)); i <= Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / g)); i++) inside[j * nx + i] = 1;
    }
  }
  return (u, v) => {
    const i = Math.round((u - x0) / g), j = Math.round((v - y0) / g);
    const ins = i >= 0 && j >= 0 && i < nx && j < ny && inside[j * nx + i];
    return ins ? panel.distEdge(u, v) : -Math.max(0.01, panel.distEdge(u, v));
  };
}

/**
 * The enclosed box (see panelBoxLayout): the box itself, open at the back, and the back with the
 * puck's holder. The box prints face down (the frame on the bed), the back flat, holder up.
 */
function buildPanelBox(settings, panel) {
  const L = panelBoxLayout(settings, panel);
  const { t, wi, z0, z1, s0, s1, y0, yBack, cover, ledge, outer, puck, cableW, fit } = L;
  const zPanel = z0 + L.clr / 2;                       // where the panel's bottom edge sits
  // The window in the frame: inside the panel's outline by `cover` (so a heart gets a heart window)
  const edge = outlineSigned(panel);
  const inWindow = (x, z) => edge(x, z - zPanel + panel.bottom) - cover;
  // Behind the groove the inside is narrower by the ledge all round: the panel's back rests on it
  const xi = wi - ledge, zi0 = z0 + ledge, zi1 = z1 - ledge;
  const shell = (x, y, z) => Math.max(Math.abs(x) - outer.x, y0 - y, y - yBack, -z, z - outer.z);
  const body = (x, y, z) => {
    let d = shell(x, y, z);
    d = Math.max(d, -Math.max(Math.abs(x) - wi, s0 - y, y - s1, z0 - z, z - (outer.z + 1)));   // the groove, open at the top
    d = Math.max(d, -Math.max(Math.abs(x) - xi, s1 - 0.5 - y, y - (yBack + 1), zi0 - z, z - zi1)); // the inside, open at the back
    if (y < s0 + 1) d = Math.max(d, -Math.max(-inWindow(x, z), y0 - 1 - y, y - (s0 + 0.5)));    // the window
    return d;
  };
  // The back: a plate as big as the box, a rim that presses into the opening, and a cup for the puck
  const pr = puck.r + 0.4, cupDepth = Math.max(3, puck.h - 2);
  const back = (x, y, z) => {
    const plate = Math.max(Math.abs(x) - outer.x, yBack - y, y - outer.y1, -z, z - outer.z);
    const rimO = Math.max(Math.abs(x) - (xi - fit), zi0 + fit - z, z - (zi1 - fit));
    const rimI = Math.max(Math.abs(x) - (xi - fit - BOX.rimT), zi0 + fit + BOX.rimT - z, z - (zi1 - fit - BOX.rimT));
    const rim = Math.max(rimO, -rimI, yBack - BOX.rim - y, y - (yBack + 0.5));
    const rr = Math.hypot(x - puck.x, z - puck.z);
    const cup = Math.max(rr - (pr + BOX.cupT), pr - rr, yBack - cupDepth - y, y - (yBack + 0.5));
    let d = Math.min(plate, rim, cup);
    // the cable: a slot up from the bottom edge to the cup, through the plate and the rim
    d = Math.max(d, -Math.max(Math.abs(x - puck.x) - cableW / 2, z - (puck.z - pr + 1), -1 - z, yBack - BOX.rim - 1 - y, y - (outer.y1 + 1)));
    return d;
  };
  const W2 = outer.x, H = outer.z, Y0 = outer.y0, Y1 = outer.y1;
  // printing: the box face down (front on the bed: z' = y - y0, y' = z), the back flat on its outside
  return {
    sdf: (x, y, z) => Math.min(body(x, y, z), back(x, y, z)),
    bounds: { min: [-W2, Y0, 0], max: [W2, Y1, H] },
    parts: {
      // (each a turn, not a mirror image: x' = -x, y' = z, z' = y - y0 for the box)
      base: { sdf: (x, y, z) => body(-x, Y0 + z, y), bounds: { min: [-W2, 0, 0], max: [W2, H, yBack - Y0] }, flip: false },
      cover: { sdf: (x, y, z) => back(x, Y1 - z, y), bounds: { min: [-W2, 0, 0], max: [W2, H, BOX.back + Math.max(BOX.rim, cupDepth)] }, flip: false },
    },
    info: {
      light: 'enclosure', panel: true, width: 2 * W2, depth: Y1 - Y0, height: H, totalHeight: H,
      seatFloor: zPanel, slotDepth: 0, flip: false, box: true, cover, dist: L.dist, distAuto: L.distAuto,
      curved: Number.isFinite(panel.R), tray: 'cover',
      // the puck's holder has to fit inside, between the ledges
      puckFits: 2 * (pr + BOX.cupT) <= Math.min(zi1 - zi0, 2 * xi), inside: Math.min(zi1 - zi0, 2 * xi),
    },
  };
}
