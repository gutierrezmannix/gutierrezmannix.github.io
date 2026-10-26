// Packet decoding and R-like data frames for the built-in engine. Mirrors the helpers at the top of
// src/analysis-methods.R (opt, num, need, fields, value, clean, group, numbers, countTable, formula) so the
// methods read like their R counterparts and give the same messages.

export class GMError extends Error {}
export const need = (ok, message) => { if (!ok) throw new GMError(message); };
const isNA = v => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v));
export { isNA };

// R factor: levels sorted in C collation (code-point order), codes 0-based, NA kept as null
export class Factor {
  constructor(values, levels = null) {
    // numeric input sorts numerically (as factor() on a numeric vector); text sorts in C collation
    const numeric = !levels && values.every(v => isNA(v) || typeof v === 'number');
    const vals = values.map(v => isNA(v) ? null : typeof v === 'number' ? fmtR(v) : String(v));
    this.levels = levels ? levels.slice() : numeric ? [...new Set(values.filter(v => !isNA(v)))].sort((a, b) => a - b).map(fmtR) : [...new Set(vals.filter(v => v !== null))].sort(cmpC);
    const pos = new Map(this.levels.map((l, i) => [l, i]));
    this.codes = vals.map(v => v === null || !pos.has(v) ? null : pos.get(v));
  }
  get length() { return this.codes.length; }
  value(i) { const c = this.codes[i]; return c === null ? null : this.levels[c]; }
  values() { return this.codes.map(c => c === null ? null : this.levels[c]); }
  subset(idx) { const f = Object.create(Factor.prototype); f.levels = this.levels.slice(); f.codes = idx.map(i => this.codes[i]); return f; }
  droplevels() { const used = new Set(this.codes.filter(c => c !== null)), keep = this.levels.filter((_, i) => used.has(i)); return new Factor(this.values(), keep); }
  relevel(ref) { const lv = [ref, ...this.levels.filter(l => l !== ref)]; return new Factor(this.values(), lv); }
  counts() { const n = new Array(this.levels.length).fill(0); for (const c of this.codes) if (c !== null) n[c]++; return n; }
  get nlevels() { return this.levels.length; }
}
export const isFactor = v => v instanceof Factor;
export function cmpC(a, b) { a = String(a); b = String(b); return a < b ? -1 : a > b ? 1 : 0; }

// Data frame: { names: [aliases], cols: {alias: Float64Array-like array | Factor}, n }
export class Frame {
  constructor(cols = {}, n = 0) { this.cols = cols; this.names = Object.keys(cols); this.n = n; }
  get(k) { return this.cols[k]; }
  has(k) { return Object.prototype.hasOwnProperty.call(this.cols, k); }
  set(k, v) { if (!this.has(k)) this.names.push(k); this.cols[k] = v; }
  rows(idx) { const c = {}; for (const k of this.names) { const v = this.cols[k]; c[k] = isFactor(v) ? v.subset(idx) : idx.map(i => v[i]); } return new Frame(c, idx.length); }
  isNumeric(k) { return !isFactor(this.cols[k]); }
  complete(vars) { const idx = []; for (let i = 0; i < this.n; i++) { let ok = true; for (const k of vars) { const v = this.cols[k]; const x = isFactor(v) ? v.codes[i] : v[i]; if (isNA(x)) { ok = false; break; } } if (ok) idx.push(i); } return idx; }
  droplevels() { for (const k of this.names) if (isFactor(this.cols[k])) this.cols[k] = this.cols[k].droplevels(); return this; }
}

export function decode(cols) {
  if (!cols || !Object.keys(cols).length) return new Frame({}, 0);
  const out = {}; let n = 0;
  for (const [k, c] of Object.entries(cols)) {
    const vals = (c.values || []).map(v => isNA(v) ? null : v); n = vals.length;
    out[k] = c.type === 'numeric' ? vals.map(v => v === null ? NaN : Number(v)) : c.type === 'categorical' ? new Factor(vals) : vals.map(v => v === null ? null : String(v));
  }
  return new Frame(out, n);
}

// The per-run context: the same names as the R engine's closures.
export function context(packet) {
  const o = packet.options || {}, f = packet.fields || {}, alpha = packet.alpha ?? 0.05;
  const ctx = {
    packet, id: packet.id, o, f, alpha, level: 1 - alpha,
    accent: /^#[0-9A-Fa-f]{6}$/.test(packet.color || '') ? packet.color : '#2E7D58',
    tables: [], plots: [], notes: [], diagnostics: [], warnings: [], outputData: null, model: null,
  };
  ctx.d = decode(packet.data); ctx.originalN = ctx.d.n; ctx.used = ctx.originalN;
  ctx.opt = (k, def = null) => { const x = o[k]; return x === null || x === undefined || x === '' ? def : x; };
  ctx.need = need;
  ctx.num = (k, def = 0, { min = -Infinity, max = Infinity, integer = false } = {}) => {
    const raw = ctx.opt(k, def); const x = typeof raw === 'boolean' ? Number(raw) : typeof raw === 'number' ? raw : rNumber(raw);
    need(Number.isFinite(x), 'Enter a number for "' + k + '".'); need(x >= min, '"' + k + '" must be at least ' + rnum(min) + '.'); need(x <= max, '"' + k + '" must be at most ' + rnum(max) + '.');
    if (integer) need(x === Math.floor(x), '"' + k + '" must be a whole number.'); return x;
  };
  ctx.fields = k => [].concat(f[k] || []).flat().filter(v => v !== null && v !== undefined);
  ctx.y = ctx.fields('y'); ctx.x = ctx.fields('predictors'); ctx.g = ctx.fields('group'); ctx.subject = ctx.fields('subject'); ctx.time = ctx.fields('time'); ctx.variables = ctx.fields('variables');
  ctx.value = k => { const v = ctx.fields(k); return v.length ? ctx.d.get(v[0]) : null; };
  ctx.allFields = () => [...new Set(Object.values(f).flat().filter(v => v !== null && v !== undefined))];
  ctx.clean = (v = ctx.allFields()) => { v = v.filter(k => ctx.d.has(k)); if (v.length) { ctx.d = ctx.d.rows(ctx.d.complete(v)).droplevels(); } ctx.used = ctx.d.n; need(ctx.used > 0, 'No complete observations for the selected variables.'); };
  ctx.group = (v, k = null) => { const fv = (isFactor(v) ? v : new Factor(v.map(x => isNA(x) ? null : x))).droplevels(); need(fv.nlevels >= 2, 'At least two observed groups are required.'); if (k !== null) need(fv.nlevels === k, 'Exactly ' + k + ' groups are required.'); return fv; };
  ctx.numbers = s => { const parts = String(s).split(/[,;\s]+/); if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop(); const v = parts.map(rNumber); need(v.length > 0 && v.every(Number.isFinite), 'Enter finite comma-separated numbers.'); return v; };
  ctx.countTable = s => { need(String(s).length > 0, 'Enter a count table, one comma-separated row per line.'); const a = String(s).split('\n').map(ctx.numbers); need(new Set(a.map(r => r.length)).size === 1, 'All table rows need the same number of cells.'); need(a.flat().every(z => z >= 0 && z === Math.floor(z)) && a.flat().reduce((p, q) => p + q, 0) > 0, 'Counts must be nonnegative integers with a positive total.'); return a; };
  ctx.rhs = (v = ctx.x) => { need(v.length > 0, 'Select predictors.'); return v; };
  ctx.note = s => { ctx.notes.push(s); };
  ctx.warn = s => { ctx.warnings.push(s); };
  ctx.diag = s => { if (Array.isArray(s)) ctx.diagnostics.push(...s); else if (s !== null && s !== undefined) ctx.diagnostics.push(...String(s).split('\n')); };
  return ctx;
}

// as.numeric() on a string, as R does (accepts leading/trailing spaces, hex, Inf; '' → NA)
export function rNumber(s) {
  if (typeof s === 'number') return s; if (typeof s === 'boolean') return Number(s); if (s === null || s === undefined) return NaN;
  const t = String(s).trim(); if (!t) return NaN; if (/^[-+]?(inf|infinity)$/i.test(t)) return t.startsWith('-') ? -Infinity : Infinity; if (/^[-+]?0x[0-9a-f]+$/i.test(t)) return Number(t.replace(/^\+/, ''));
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN; return Number(t);
}
// as.character(number) as R prints it in messages (15 significant digits)
export function rnum(x) {
  if (x === Infinity) return 'Inf'; if (x === -Infinity) return '-Inf'; if (Number.isNaN(x)) return 'NaN'; if (x === 0) return '0';
  // as.character(): 15 significant digits, scientific notation when it is shorter than fixed notation
  const v = Number(x.toPrecision(15)), fixed = Math.abs(v) >= 1e21 ? null : (() => { let s = v.toFixed(Math.max(0, Math.min(100, 15 - 1 - Math.floor(Math.log10(Math.abs(v)))))); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s; })();
  let [m, e] = v.toExponential(14).split('e'); m = m.replace(/0+$/, '').replace(/\.$/, ''); const ei = Number(e), sci = m + 'e' + (ei < 0 ? '-' : '+') + String(Math.abs(ei)).padStart(2, '0');
  return fixed !== null && fixed.length <= sci.length ? fixed : sci;
}
export function fmtR(x) { return typeof x === 'number' ? rnum(x) : String(x); }

// ---------- model matrices ----------
// terms: [{ vars: ['v2'] }, { vars: ['v3','v4'] }]   (interaction when several)
// contrasts: { v3: 'treatment' | 'sum' }
export function expandTerms(vars, interactions = false) {
  if (!interactions) return vars.map(v => ({ vars: [v] }));
  // a*b*c: all subsets ordered by size, then by appearance (as R's terms())
  const out = []; const n = vars.length;
  for (let size = 1; size <= n; size++) { const rec = (start, acc) => { if (acc.length === size) { out.push({ vars: acc.slice() }); return; } for (let i = start; i < n; i++) { acc.push(vars[i]); rec(i + 1, acc); acc.pop(); } }; rec(0, []); }
  return out;
}
export function modelMatrix(d, terms, { intercept = true, contrasts = {} } = {}) {
  const n = d.n, colsOut = [], names = [], assign = [];
  if (intercept) { colsOut.push(new Array(n).fill(1)); names.push('(Intercept)'); assign.push(0); }
  terms.forEach((term, ti) => {
    // each variable contributes a list of [name, column]
    const pieces = term.vars.map(v => {
      const c = d.get(v);
      if (isFactor(c)) {
        const L = c.levels, k = L.length;
        if (contrasts[v] === 'sum') return Array.from({ length: k - 1 }, (_, j) => [v + (j + 1), c.codes.map(code => code === null ? NaN : code === j ? 1 : code === k - 1 ? -1 : 0)]);
        if (!intercept && term.vars.length === 1 && ti === firstFactorTerm(terms, d)) return L.map((l, j) => [v + l, c.codes.map(code => code === null ? NaN : code === j ? 1 : 0)]);
        return L.slice(1).map((l, j) => [v + l, c.codes.map(code => code === null ? NaN : code === j + 1 ? 1 : 0)]);
      }
      return [[v, Array.from(c)]];
    });
    // Cartesian product, first variable varying fastest (as R)
    let acc = [['', null]];
    for (const p of pieces) { const next = []; for (const [pn, pc] of p) for (const [an, ac] of acc) next.push([an ? an + ':' + pn : pn, ac ? ac.map((v, i) => v * pc[i]) : pc]); acc = next; }
    // R orders columns with the first factor's levels varying fastest
    acc = reorderInteraction(acc, pieces);
    for (const [nm, cl] of acc) { names.push(nm); colsOut.push(cl); assign.push(ti + 1); }
  });
  const X = Array.from({ length: n }, (_, i) => colsOut.map(c => c[i]));
  return { X, names, assign };
}
function firstFactorTerm(terms, d) { return terms.findIndex(t => t.vars.length === 1 && isFactor(d.get(t.vars[0]))); }
function reorderInteraction(acc, pieces) {
  if (pieces.length < 2) return acc;
  // acc was built with later variables varying slowest already (outer loop over the new piece) — matches R
  return acc;
}
