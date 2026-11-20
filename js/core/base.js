// The lamp base: a printable stand that holds the light and the lamp's collar.
// Three kinds: an LED puck inside the base, an LED strip wrapped round a hollow riser post that
// rises into the lamp, or a lamp socket (E12 / E26) on a threaded nipple.
// Every base has a seat on top that the collar drops into, and a notch for the cable.
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
    puckD: 70, puckH: 20, // LED puck size, mm
    puckHold: 'hole',  // lantern only: 'hole' (the puck stands on the table) | 'tray' (closed floor with a rim)
    socket: 'E12',     // bulb socket type
    riserD: 30,        // strip riser outside diameter, mm
    riserH: 0,         // strip riser height above the base top, mm; 0 = up to the middle of the lamp
    clearance: 0.4,    // extra room around the collar in the seat, mm (on the diameter)
    shape: 'auto',     // 'auto' (round under balls, square under the cube) | 'round' | 'square'
    extra: 0,          // extra width all round, mm
    cableW: 10, cableH: 8, // cable notch, mm
  };
}

/** How wide the lamp is (for a base in proportion to it). */
function lampWidth(settings) {
  if (SHAPES[settings.shape]?.body === 'cube') return settings.cube?.size ?? 100;
  if (settings.shape === 'football') return settings.footballWidth;
  return settings.diameter;
}

/**
 * Builds the base for the current settings.
 * shape: the built lamp shape (used for the riser height: the middle of the lamp).
 * Returns { sdf, bounds, info } where info has the sizes and whether it prints upside down.
 */
export function buildBase(settings, shape) {
  if (shape && shape.kind === 'panel') return buildPanelBase(settings, shape);
  const b = { ...defaultBaseSettings(), ...(settings.base || {}) };
  const col = collarDims(settings);
  const rs = col.ro + b.clearance / 2;            // seat hole radius
  const seatD = col.height;                        // the collar rests on the seat floor
  const square = b.shape === 'square' || (b.shape === 'auto' && SHAPES[settings.shape]?.body === 'cube');
  const prop = 0.28 * lampWidth(settings);
  const notch = (R, h) => box(-b.cableW / 2, b.cableW / 2, 0, R + 10, -1, h);
  const outer = (R, H) => (square ? roundedSquare(R, Math.min(8, R * 0.2), 0, H) : cylinder(R, 0, H));
  let sdf, H, R, flip, riserTop = null, extraInfo = {};

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
    const rc = R - 3, hc0 = 8;
    // the 45° ceiling narrows to the riser's hollow, and must finish below the seat floor
    H = hc0 + (rc - riT) + 2.5 + seatD;
    const zSeat = H - seatD;
    // Up to the middle of the lamp: collar height plus the depth of the opening below the centre
    let zEdge = 0;
    if (shape) {
      const o = {};
      zEdge = Infinity;
      for (let i = 0; i < 64; i++) { const th = (i / 64) * 2 * Math.PI; shape.surf(th, shape.phiEdge(th), o); zEdge = Math.min(zEdge, o.z); }
    }
    const toMiddle = col.height + (shape ? -zEdge : 60);
    riserTop = H + (b.riserH > 0 ? b.riserH : Math.max(10, toMiddle - seatD - 5));
    // A tall riser must stay inside the lamp: at least 5 mm below its inside wall over the riser
    if (shape) {
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
    const rc = b.puckD / 2 + 0.6, hc = b.puckH + 1, floor = 2;
    const rh = Math.max(8, Math.min(col.ri - 1.5, rc - 3));
    H = hc + floor + seatD;
    R = Math.max(rc + 3, rs + 8, prop) + b.extra;
    sdf = subtract(outer(R, H),
      cylinder(rc, -1, hc),                            // the puck goes in from below
      cylinder(rh, hc - 1, H + 1),                     // light shines up through here
      cylinder(rs, H - seatD, H + 1),                  // collar seat
      notch(R, Math.min(b.cableH, hc)));
    flip = true;
  }

  const top = riserTop ?? H;
  return {
    sdf,
    bounds: { min: [-R, -R, 0], max: [R, R, top] },
    info: {
      light: b.light, square, width: 2 * R, height: H, totalHeight: top,
      seatR: rs, seatFloor: H - seatD, flip, ...extraInfo,
    },
  };
}

// ---------------------------------------------------------------- flat panel bases
// Both stand as they sit on the table (no supports) and hold the panel in a slot shaped like its
// bottom edge: straight for a flat panel, curved for a curved one. Coordinates match the panel's
// (x right, y away from the viewer, front of the panel at y = 0 in the middle).
//   Light box: a block as wide as the panel. Behind the slot, an open trough holds an LED strip on
//   a floor that leans 30° toward the panel, so the strip shines up the panel's back.
//   Slot stand: a shorter, deeper block with just the slot.
const TILT = Math.tan((30 * Math.PI) / 180);
const COS_TILT = Math.cos((30 * Math.PI) / 180);

export const PANEL_BASE_KINDS = {
  lightbox: 'Light box', stand: 'Slot stand', none: 'None',
};

/**
 * The panel's base, or null for 'none'. info: { light, width, depth, height, totalHeight,
 * seatFloor (height of the slot floor, where the panel's bottom edge sits), flip: false, slotDepth }.
 */
export function buildPanelBase(settings, panel) {
  const b = { ...defaultBaseSettings(), ...(settings.base || {}) };
  const kind = b.panelKind || 'lightbox';
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

  return {
    sdf,
    bounds: { min: [x0, y0, 0], max: [x1, y1, H] },
    info: {
      light: kind, panel: true, width: x1 - x0, depth: y1 - y0, height: H, totalHeight: H,
      seatFloor: zSlot, slotDepth, flip: false, stripW,
    },
  };
}
