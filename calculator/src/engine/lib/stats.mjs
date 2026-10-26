// Small statistics helpers shared by method modules (R semantics).
import { rnum } from './frame.mjs';
import { htestText } from './print.mjs';

export const sum = a => { let s = 0; for (const v of a) s += v; return s; };
export const mean = a => sum(a) / a.length;
export function variance(a) { const m = mean(a); let s = 0; for (const v of a) s += (v - m) * (v - m); return s / (a.length - 1); }
export const sd = a => Math.sqrt(variance(a));
// rank(x, ties.method = "average")
export function rank(x) { const idx = x.map((v, i) => i).sort((a, b) => x[a] - x[b]), r = new Array(x.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }
// table() of values → counts of each distinct value (sorted)
export function tieCounts(x) { const m = new Map(); for (const v of x) m.set(v, (m.get(v) || 0) + 1); return [...m.values()]; }
// quantile(x, p, type = 7)
export function quantile7(x, p) { const v = x.slice().sort((a, b) => a - b), n = v.length; return [].concat(p).map(q => { const index = 1 + Math.max(n - 1, 0) * q, lo = Math.floor(index), hi = Math.ceil(index), xl = v[lo - 1], xh = v[hi - 1]; if (!(index > lo && xh !== xl)) return xl; const h = index - lo; return (1 - h) * xl + h * xh; }); }
export const median = x => quantile7(x, 0.5)[0];
// R's as.character for numbers in pasted strings
export const asChar = v => typeof v === 'number' ? rnum(v) : String(v);

// The R engine's test(h): Test / Estimates / Confidence interval tables + alternative note
// h: { statistic: number|null, parameter: [numbers]|null, p, method, estimate: [[name, value]]|null, conf: [lo, hi]|null, level, alternative: string|null, statName, paramNames, data }
export function test(ctx, h) {
  ctx.table('Test', ['Statistic', 'DF', 'P', 'Method'], [[h.statistic === null || h.statistic === undefined ? null : h.statistic, h.parameter && h.parameter.length ? h.parameter.map(asChar).join(', ') : '', h.p, h.method]]);
  if (h.estimate && h.estimate.length) ctx.table('Estimates', ['Estimate', 'Value'], h.estimate.map(([k, v]) => [k, v]));
  if (h.conf) ctx.table('Confidence interval', ['Lower', 'Upper', 'Confidence'], [[h.conf[0], h.conf[1], h.level]]);
  if (h.alternative) ctx.note(h.alternative);
}
export function htestPrint(h) {
  return htestText({ method: h.method, data: h.data || 'x', statistic: h.statistic === null || h.statistic === undefined ? null : [h.statName || 'statistic', h.statistic], parameter: h.parameter ? h.parameter.map((v, i) => [(h.paramNames || [])[i] || 'df', v]) : null, p: h.p, alternative: h.alternative ? (h.alternative === 'two.sided' ? 'true ' + (h.altText || 'difference') + ' is not equal to ' + (h.null ?? 0) : h.alternative) : null, estimate: h.estimate, conf: h.conf, level: h.level });
}
