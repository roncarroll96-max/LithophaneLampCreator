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

export const MARKING_TYPES = {
  none: null,
  basketball,
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
