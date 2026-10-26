// R-style text output for the Diagnostics tab (print.summary.lm, htest, format.pval).
export function fmtSig(x, digits = 4) {
  if (x === null || x === undefined || Number.isNaN(x)) return 'NA'; if (x === Infinity) return 'Inf'; if (x === -Infinity) return '-Inf';
  if (x === 0) return '0'; const a = Math.abs(x);
  if (a >= 1e15 || a < 1e-4) { const s = x.toExponential(digits - 1).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$10$2'); return s; }
  return String(Number(x.toPrecision(digits)));
}
export function fmtP(p, digits = 4) { if (p === null || p === undefined || Number.isNaN(p)) return 'NA'; if (p < 2.2e-16) return '< 2.2e-16'; return fmtSig(p, digits); }
export function stars(p) { return p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : p < 0.1 ? '.' : ' '; }
export function printCoefmat(rownames, columns, rows) {
  const w0 = Math.max(...rownames.map(r => r.length), 1), cells = rows.map(r => r.map((v, j) => /Pr\(/.test(columns[j]) ? fmtP(v) : fmtSig(v, 5)));
  const w = columns.map((c, j) => Math.max(c.length, ...cells.map(r => r[j].length)));
  const lines = [' '.repeat(w0) + columns.map((c, j) => ' ' + c.padStart(w[j])).join('')];
  rows.forEach((r, i) => { const pj = columns.findIndex(c => /Pr\(/.test(c)); lines.push(rownames[i].padEnd(w0) + cells[i].map((c, j) => ' ' + c.padStart(w[j])).join('') + (pj >= 0 ? ' ' + stars(r[pj]) : '')); });
  return lines;
}
// print.htest
export function htestText({ method, data = 'x', statistic = null, parameter = null, p = null, alternative = null, estimate = null, conf = null, level = 0.95 }) {
  const out = ['', '\t' + method, '', 'data:  ' + data];
  const parts = []; if (statistic) parts.push(statistic[0] + ' = ' + fmtSig(statistic[1], 5)); if (parameter) for (const [k, v] of parameter) parts.push(k + ' = ' + fmtSig(v, 5)); if (p !== null) parts.push('p-value ' + (p < 2.2e-16 ? '< 2.2e-16' : '= ' + fmtSig(p, 4)));
  out.push(parts.join(', ')); if (alternative) out.push('alternative hypothesis: ' + alternative);
  if (conf) out.push(Math.round(level * 100) + ' percent confidence interval:', ' ' + fmtSig(conf[0], 7) + ' ' + fmtSig(conf[1], 7));
  if (estimate) { out.push('sample estimates:'); out.push(estimate.map(e => e[0]).join('  ')); out.push(estimate.map(e => fmtSig(e[1], 7)).join('  ')); }
  out.push(''); return out;
}
// a data.frame / matrix printed with right-aligned columns
export function printTable(columns, rows, rownames = null) {
  const cells = rows.map(r => r.map(v => typeof v === 'number' ? fmtSig(v, 7) : v === null || v === undefined ? 'NA' : String(v)));
  const rn = rownames ? rownames.map(String) : rows.map((_, i) => String(i + 1)), w0 = Math.max(...rn.map(r => r.length), 0);
  const w = columns.map((c, j) => Math.max(String(c).length, ...cells.map(r => (r[j] || '').length)));
  return [' '.repeat(w0) + columns.map((c, j) => ' ' + String(c).padStart(w[j])).join(''), ...cells.map((r, i) => rn[i].padEnd(w0) + r.map((c, j) => ' ' + c.padStart(w[j])).join(''))];
}
