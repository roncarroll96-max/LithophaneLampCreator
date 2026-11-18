// The lamp base: a printable stand that holds the light and the lamp's collar.
// Three kinds: an LED puck inside the base, an LED strip wrapped round a hollow riser post that
// rises into the lamp, or a lamp socket (E12 / E26) on a threaded nipple.
// Every base has a seat on top that the collar drops into, and a notch for the cable.
//
// Coordinates: millimetres, Z up, the base standing on the table at z = 0, centred on x/y = 0.
// The notch faces the back (+Y). No DOM here.

import { cylinder, box, roundedSquare, cone, union, subtract } from './sdf.js';
import { collarDims, SHAPES } from './settings.js';

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
    extraInfo = { riserD: roT * 2, riserHeight: riserTop - H };
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
