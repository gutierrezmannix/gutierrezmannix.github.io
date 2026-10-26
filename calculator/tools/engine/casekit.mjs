// Helpers for writing engine test cases: deterministic synthetic data and packets shaped exactly like the
// page's asPacket() output (columns v1…vk with {name, type, values}; fields hold aliases).
import { RRNG } from '../../src/engine/lib/rng.mjs';

export function rng(seed = 1) { return new RRNG(seed); }
// cols: [{ name, type: 'numeric'|'categorical', values }]
export function packet(id, cols, fields, options = {}, extra = {}) {
  const data = {}, alias = {};
  cols.forEach((c, i) => { const k = 'v' + (i + 1); alias[c.name] = k; data[k] = { name: c.name, type: c.type || 'numeric', values: c.values.map(v => v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? null : v) }; });
  const f = {}; for (const [k, v] of Object.entries(fields)) f[k] = [].concat(v).map(n => alias[n]);
  const opts = { inputMode: 'raw', ...options };
  if (opts.randomSlope) opts.randomSlope = alias[opts.randomSlope];
  return { id, alpha: extra.alpha ?? 0.05, options: opts, fields: f, data, color: '#2E7D58', ...extra.more };
}
export const num = (name, values) => ({ name, type: 'numeric', values });
export const cat = (name, values) => ({ name, type: 'categorical', values: values.map(v => v === null || v === undefined ? null : String(v)) });
export const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
export function normals(r, n, mu = 0, sd = 1, d = 4) { return Array.from({ length: n }, () => round(mu + sd * r.norm(), d)); }
export function pick(r, n, levels, probs = null) { return Array.from({ length: n }, () => { if (!probs) return levels[Math.floor(r.unif() * levels.length)]; let u = r.unif(), k = 0; while (k < levels.length - 1 && u > probs[k]) { u -= probs[k]; k++; } return levels[k]; }); }
export function withMissing(r, values, rate = 0.05) { return values.map(v => r.unif() < rate ? null : v); }
export const bern = (r, p) => r.unif() < p ? 1 : 0;
export const poisson = (r, lambda) => { let L = Math.exp(-lambda), k = 0, p = 1; do { k++; p *= r.unif(); } while (p > L); return k - 1; };
