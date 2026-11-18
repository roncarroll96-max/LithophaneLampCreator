// Separable box blur, 3 passes (close to a Gaussian). Edges are clamped. Pure math, no DOM.

export function boxBlur(src, w, h, r) {
  r = Math.round(r);
  if (r < 1) return Float32Array.from(src);
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const n = horizontal ? w : h, m = horizontal ? h : w;
    const step = horizontal ? 1 : w, lineStep = horizontal ? w : 1;
    const inv = 1 / (2 * r + 1);
    for (let l = 0; l < m; l++) {
      const o = l * lineStep;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += from[o + Math.min(n - 1, Math.max(0, k)) * step];
      for (let i = 0; i < n; i++) {
        to[o + i * step] = acc * inv;
        const add = Math.min(n - 1, i + r + 1), sub = Math.max(0, i - r);
        acc += from[o + add * step] - from[o + sub * step];
      }
    }
  };
  for (let it = 0; it < 3; it++) { pass(a, b, true); pass(b, a, false); }
  return a;
}
