// R's default random-number generator, reproduced exactly: Mersenne-Twister with R's set.seed() scrambling,
// "Rejection" sampling (R >= 3.6), and "Inversion" normals. set.seed(1729); sample.int(10) gives the same
// draws here as in R, so resampling, train/holdout splits and cross-validation folds match R.
import { qnorm } from './dist.mjs';

const MAG01 = new Uint32Array([0, 0x9908b0df]);
const N = 624, M = 397, UPPER = 0x80000000, LOWER = 0x7fffffff, MATRIX_A = 0x9908b0df, I2_32M1 = 2.328306437080797e-10;

export class RRNG {
  constructor(seed = 1729) { this.mt = new Uint32Array(N); this.mti = N + 1; this.setSeed(seed); }
  setSeed(seed) {
    let s = seed >>> 0;
    for (let j = 0; j < 50; j++) s = (Math.imul(69069, s) + 1) >>> 0;
    // i_seed[0] is mti (dummy[0]); i_seed[1..624] the state
    s = (Math.imul(69069, s) + 1) >>> 0; // dummy[0], overwritten by FixupSeeds
    for (let j = 0; j < N; j++) { s = (Math.imul(69069, s) + 1) >>> 0; this.mt[j] = s; }
    this.mti = N; return this;
  }
  genrand() {
    const mt = this.mt, mag01 = MAG01; let y;
    if (this.mti >= N) {
      let kk;
      for (kk = 0; kk < N - M; kk++) { y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER); mt[kk] = mt[kk + M] ^ (y >>> 1) ^ mag01[y & 1]; }
      for (; kk < N - 1; kk++) { y = (mt[kk] & UPPER) | (mt[kk + 1] & LOWER); mt[kk] = mt[kk + (M - N)] ^ (y >>> 1) ^ mag01[y & 1]; }
      y = (mt[N - 1] & UPPER) | (mt[0] & LOWER); mt[N - 1] = mt[M - 1] ^ (y >>> 1) ^ mag01[y & 1];
      this.mti = 0;
    }
    y = mt[this.mti++];
    y ^= (y >>> 11); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= (y >>> 18);
    return (y >>> 0) * 2.3283064365386963e-10;
  }
  unif() { const x = this.genrand(); if (x <= 0) return 0.5 * I2_32M1; if (1 - x <= 0) return 1 - 0.5 * I2_32M1; return x; }
  rbits(bits) { let v = 0; for (let n = 0; n <= bits; n += 16) { const v1 = Math.floor(this.unif() * 65536); v = 65536 * v + v1; } return v % Math.pow(2, bits); }
  unifIndex(dn) { if (dn <= 0) return 0; const bits = Math.ceil(Math.log2(dn)); let dv; do { dv = this.rbits(bits); } while (dn <= dv); return dv; }
  // sample.int(n, size, replace) → 1-based integers, as in R
  sampleInt(n, size = n, replace = false) {
    const y = new Array(size);
    if (replace || size < 2) { for (let i = 0; i < size; i++) y[i] = this.unifIndex(n) + 1; return y; }
    const x = new Array(n); for (let i = 0; i < n; i++) x[i] = i; let nn = n;
    for (let i = 0; i < size; i++) { const j = this.unifIndex(nn); y[i] = x[j] + 1; x[j] = x[--nn]; }
    return y;
  }
  // sample(v): a permutation of the vector (or size draws)
  sample(v, size = v.length, replace = false) { return this.sampleInt(v.length, size, replace).map(i => v[i - 1]); }
  // weighted sampling with replacement (R's walker/ProbSampleReplace for n < 200)
  sampleProb(n, size, prob, replace = true) {
    const p = prob.map(Number), tot = p.reduce((a, b) => a + b, 0); for (let i = 0; i < n; i++) p[i] /= tot;
    const perm = Array.from({ length: n }, (_, i) => i + 1);
    // revsort: sort p decreasing with perm
    const idx = perm.map((v, i) => i).sort((a, b) => p[b] - p[a]); const ps = idx.map(i => p[i]), pr = idx.map(i => perm[i]);
    const out = [];
    if (replace) { for (let i = 1; i < n; i++) ps[i] += ps[i - 1]; for (let i = 0; i < size; i++) { const rU = this.unif(); let j; for (j = 0; j < n - 1; j++) if (rU <= ps[j]) break; out.push(pr[j]); } return out; }
    let total = 1, n1 = n - 1;
    for (let i = 0; i < size; i++, n1--) { const rT = total * this.unif(); let mass = 0, j; for (j = 0; j < n1; j++) { mass += ps[j]; if (rT <= mass) break; } out.push(pr[j]); total -= ps[j]; ps.splice(j, 1); pr.splice(j, 1); }
    return out;
  }
  norm() { const BIG = 134217728; let u = this.unif(); u = Math.trunc(BIG * u) + this.unif(); return qnorm(u / BIG); }
  rnorm(n, mu = 0, sd = 1) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = mu + sd * this.norm(); return a; }
  runif(n, a = 0, b = 1) { const o = new Array(n); for (let i = 0; i < n; i++) o[i] = a + (b - a) * this.unif(); return o; }
  exp() {
    const q = [0.6931471805599453, 0.9333736875190459, 0.9888777961838675, 0.9984959252914960040, 0.9998292811061389, 0.9999833164100727, 0.9999985508245729, 0.9999998906925558, 0.9999999924734159, 0.9999999995283275, 0.9999999999728814, 0.9999999999985598, 0.9999999999999289, 0.9999999999999968, 0.9999999999999999, 1.0];
    let a = 0, u = this.unif(); while (u <= 0 || u >= 1) u = this.unif();
    for (;;) { u += u; if (u > 1) break; a += q[0]; }
    u -= 1; if (u <= q[0]) return a + u;
    let i = 0, ustar = this.unif(), umin = ustar;
    do { ustar = this.unif(); if (umin > ustar) umin = ustar; i++; } while (u > q[i]);
    return a + umin * q[0];
  }
  // R's rgamma (Ahrens & Dieter GD for a >= 1, GS for a < 1)
  gamma(a, scale = 1) {
    const sqrt32 = 5.656854, exp_m1 = 0.36787944117144233, q1 = 0.04166669, q2 = 0.02083148, q3 = 0.00801191, q4 = 0.00144121, q5 = -7.388e-5, q6 = 2.4511e-4, q7 = 2.424e-4, a1 = 0.3333333, a2 = -0.250003, a3 = 0.2000062, a4 = -0.1662921, a5 = 0.1423657, a6 = -0.1367177, a7 = 0.1233795;
    const st = this._g || (this._g = { aa: 0, aaa: 0, s: 0, s2: 0, d: 0, q0: 0, b: 0, si: 0, c: 0 });
    let e, p, q, r, t, u, v, w, x, ret;
    if (a < 1) {
      if (a === 0) return 0; e = 1 + exp_m1 * a;
      for (;;) { p = e * this.unif(); if (p >= 1) { x = -Math.log((e - p) / a); if (this.exp() >= (1 - a) * Math.log(x)) break; } else { x = Math.exp(Math.log(p) / a); if (this.exp() >= x) break; } }
      return scale * x;
    }
    if (a !== st.aa) { st.aa = a; st.s2 = a - 0.5; st.s = Math.sqrt(st.s2); st.d = sqrt32 - st.s * 12; }
    t = this.norm(); x = st.s + 0.5 * t; ret = x * x; if (t >= 0) return scale * ret;
    u = this.unif(); if (st.d * u <= t * t * t) return scale * ret;
    if (a !== st.aaa) {
      st.aaa = a; r = 1 / a; st.q0 = ((((((q7 * r + q6) * r + q5) * r + q4) * r + q3) * r + q2) * r + q1) * r;
      if (a <= 3.686) { st.b = 0.463 + st.s + 0.178 * st.s2; st.si = 1.235; st.c = 0.195 / st.s - 0.079 + 0.16 * st.s; }
      else if (a <= 13.022) { st.b = 1.654 + 0.0076 * st.s2; st.si = 1.68 / st.s + 0.275; st.c = 0.062 / st.s + 0.024; }
      else { st.b = 1.77; st.si = 0.75; st.c = 0.1515 / st.s; }
    }
    if (x > 0) { v = t / (st.s + st.s); if (Math.abs(v) <= 0.25) q = st.q0 + 0.5 * t * t * ((((((a7 * v + a6) * v + a5) * v + a4) * v + a3) * v + a2) * v + a1) * v; else q = st.q0 - st.s * t + 0.25 * t * t + (st.s2 + st.s2) * Math.log(1 + v); if (Math.log(1 - u) <= q) return scale * ret; }
    for (;;) {
      e = this.exp(); u = this.unif(); u = u + u - 1; if (u < 0) t = st.b - st.si * e; else t = st.b + st.si * e;
      if (t >= -0.71874483771719) {
        v = t / (st.s + st.s); if (Math.abs(v) <= 0.25) q = st.q0 + 0.5 * t * t * ((((((a7 * v + a6) * v + a5) * v + a4) * v + a3) * v + a2) * v + a1) * v; else q = st.q0 - st.s * t + 0.25 * t * t + (st.s2 + st.s2) * Math.log(1 + v);
        if (q > 0) { w = Math.expm1(q); if (st.c * Math.abs(u) <= w * Math.exp(e - 0.5 * t * t)) break; }
      }
    }
    x = st.s + 0.5 * t; return scale * x * x;
  }
  chisq(df) { return this.gamma(df / 2, 2); }
}
