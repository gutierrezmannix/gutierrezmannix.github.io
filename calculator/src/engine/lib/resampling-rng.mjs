// Fast copy of R's Mersenne-Twister stream for the resampling loops (bootstrap, permutation). It continues the
// exact state of a lib/rng.mjs RRNG (same unif_rand, R_unif_index with "Rejection" sampling), avoids per-call
// allocations, and can snapshot/restore its state so long streams can be replayed without being stored.
const N = 624, M = 397, MATRIX_A = 0x9908b0df | 0, UP = 0x80000000 | 0, T2 = 0xefc60000 | 0, I2_32M1 = 2.328306437080797e-10;

export class FastMT {
  constructor(rrng) { this.mt = new Int32Array(N); this.mt.set(rrng.mt); this.mti = rrng.mti; }
  writeBack(rrng) { rrng.mt.set(this.mt); rrng.mti = this.mti; }
  save() { const s = new Int32Array(N + 1); s.set(this.mt); s[N] = this.mti; return s; }
  restore(s) { this.mt.set(s.subarray(0, N)); this.mti = s[N]; }
  static fromState(s) { const f = Object.create(FastMT.prototype); f.mt = new Int32Array(N); f.restore(s); return f; }
  genrand() {
    const mt = this.mt; let y;
    if (this.mti >= N) { this.twist(); this.mti = 0; }
    y = mt[this.mti++];
    y ^= ((y >> 11) & 0x1fffff); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & T2; y ^= ((y >> 18) & 0x3fff);
    return (y >>> 0) * 2.3283064365386963e-10;
  }
  twist() {
    const mt = this.mt; let kk, y;
    for (kk = 0; kk < N - M; kk++) { y = (mt[kk] & UP) | (mt[kk + 1] & 0x7fffffff); mt[kk] = mt[kk + M] ^ ((y >> 1) & 0x7fffffff) ^ ((y & 1) ? MATRIX_A : 0); }
    for (; kk < N - 1; kk++) { y = (mt[kk] & UP) | (mt[kk + 1] & 0x7fffffff); mt[kk] = mt[kk + (M - N)] ^ ((y >> 1) & 0x7fffffff) ^ ((y & 1) ? MATRIX_A : 0); }
    y = (mt[N - 1] & UP) | (mt[0] & 0x7fffffff); mt[N - 1] = mt[M - 1] ^ ((y >> 1) & 0x7fffffff) ^ ((y & 1) ? MATRIX_A : 0);
  }
  // count successive unif_rand() values into out (inlined for speed)
  fillUnif(out, count) {
    const mt = this.mt; let mti = this.mti;
    for (let k = 0; k < count; k++) {
      if (mti >= N) { this.twist(); mti = 0; }
      let y = mt[mti++]; y ^= ((y >> 11) & 0x1fffff); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & T2; y ^= ((y >> 18) & 0x3fff);
      const x = (y >>> 0) * 2.3283064365386963e-10; out[k] = x <= 0 ? 0.5 * I2_32M1 : 1 - x <= 0 ? 1 - 0.5 * I2_32M1 : x;
    }
    this.mti = mti;
  }
  // count successive R_unif_index(dn) values (0-based) into out
  fillIndex(dn, out, count) {
    const bits = dn <= 0 ? -1 : Math.ceil(Math.log2(dn));
    if (bits < 0 || bits > 15) { const f = this.indexer(dn); for (let k = 0; k < count; k++) out[k] = f(); return; }
    const mt = this.mt, mask = (1 << bits) - 1; let mti = this.mti;
    for (let k = 0; k < count; k++) {
      let v;
      do {
        if (mti >= N) { this.twist(); mti = 0; }
        let y = mt[mti++]; y ^= ((y >> 11) & 0x1fffff); y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & T2; y ^= ((y >> 18) & 0x3fff);
        v = (y >> 16) & 0xffff & mask; // = floor(unif_rand() * 65536) & mask (the fixup of 0 and 1 cannot change it)
      } while (dn <= v);
      out[k] = v;
    }
    this.mti = mti;
  }
  unif() { const x = this.genrand(); if (x <= 0) return 0.5 * I2_32M1; if (1 - x <= 0) return 1 - 0.5 * I2_32M1; return x; }
  // R_unif_index(dn) for a fixed dn: returns a function giving 0-based draws (rbits with rejection)
  indexer(dn) {
    if (dn <= 0) return () => 0;
    const bits = Math.ceil(Math.log2(dn));
    if (bits <= 15) { const mask = (1 << bits) - 1; return () => { let v; do { v = Math.floor(this.unif() * 65536) & mask; } while (dn <= v); return v; }; }
    const mod = Math.pow(2, bits);
    return () => { let v; do { v = 0; for (let n = 0; n <= bits; n += 16) v = 65536 * v + Math.floor(this.unif() * 65536); v %= mod; } while (dn <= v); return v; };
  }
}
