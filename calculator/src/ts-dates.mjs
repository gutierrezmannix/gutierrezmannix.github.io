// Reading time variables for GM26.1 (Stata tsset-style). Bundled into the engine; no network dependencies.
// Period codes follow the calculator's existing calendar: annual = year, quarterly = quarters since 1960q1,
// monthly = months since 1960m1, daily = days since 1960-01-01. Text dates are converted, never guessed
// silently: ambiguous day/month order is reported and can be set explicitly.

const MONTHS = { jan: 1, ene: 1, january: 1, enero: 1, feb: 2, february: 2, febrero: 2, mar: 3, march: 3, marzo: 3,
  apr: 4, abr: 4, april: 4, abril: 4, may: 5, mayo: 5, jun: 6, june: 6, junio: 6, jul: 7, july: 7, julio: 7,
  aug: 8, ago: 8, august: 8, agosto: 8, sep: 9, sept: 9, set: 9, september: 9, septiembre: 9, setiembre: 9,
  oct: 10, october: 10, octubre: 10, nov: 11, november: 11, noviembre: 11, dec: 12, dic: 12, december: 12, diciembre: 12 };
const DAY0 = Date.UTC(1960, 0, 1);

export const TSD_FREQ = {
  yearly: { label: 'Annual', unit: 'year', units: 'years', cycle: 1 },
  quarterly: { label: 'Quarterly', unit: 'quarter', units: 'quarters', cycle: 4 },
  monthly: { label: 'Monthly', unit: 'month', units: 'months', cycle: 12 },
  weekly: { label: 'Weekly', unit: 'week', units: 'weeks', cycle: 52 },
  daily: { label: 'Daily', unit: 'day', units: 'days', cycle: 7 },
  trading: { label: 'Trading days', unit: 'trading day', units: 'trading days', cycle: 5 },
  generic: { label: 'Integer periods', unit: 'period', units: 'periods', cycle: 1 },
};

function dayCode(y, m, d) {
  if (!(y >= 1000 && y <= 2999 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return NaN;
  const t = Date.UTC(y, m - 1, d), x = new Date(t);
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? Math.round((t - DAY0) / 86400000) : NaN;
}
const monthCode = (y, m) => (y >= 1000 && y <= 2999 && m >= 1 && m <= 12 ? (y - 1960) * 12 + m - 1 : NaN);
const quarterCode = (y, q) => (y >= 1000 && y <= 2999 && q >= 1 && q <= 4 ? (y - 1960) * 4 + q - 1 : NaN);
const monthName = s => MONTHS[String(s).toLowerCase().replace(/\.$/, '')] || 0;

// One text value → [frequency, code, slash-order info]; slash dates return both readings.
function readOne(raw) {
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/))) return ['daily', dayCode(+m[1], +m[2], +m[3])];
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) return ['monthly', monthCode(+m[1], +m[2])];
  if ((m = s.match(/^(\d{4}) ?[mM](\d{1,2})$/))) return ['monthly', monthCode(+m[1], +m[2])];
  if ((m = s.match(/^(\d{4}) ?[-/ ]? ?[qQ]([1-4])$/))) return ['quarterly', quarterCode(+m[1], +m[2])];
  if ((m = s.match(/^[qQ]([1-4]) ?[-/ ]? ?(\d{4})$/))) return ['quarterly', quarterCode(+m[2], +m[1])];
  if ((m = s.match(/^(\d{4})$/))) return ['yearly', +m[1]];
  if ((m = s.match(/^([A-Za-zÀ-ÿ]{3,10})\.? (\d{1,2}),? (\d{4})$/)) && monthName(m[1])) return ['daily', dayCode(+m[3], monthName(m[1]), +m[2])];
  if ((m = s.match(/^(\d{1,2})[ -]?(?:de )?([A-Za-zÀ-ÿ]{3,10})\.?,?[ -]?(?:de )?(\d{4})$/)) && monthName(m[2])) return ['daily', dayCode(+m[3], monthName(m[2]), +m[1])];
  if ((m = s.match(/^([A-Za-zÀ-ÿ]{3,10})\.?[ -](?:de )?(\d{4})$/)) && monthName(m[1])) return ['monthly', monthCode(+m[2], monthName(m[1]))];
  if ((m = s.match(/^(\d{4})[ -]([A-Za-zÀ-ÿ]{3,10})$/)) && monthName(m[2])) return ['monthly', monthCode(+m[1], monthName(m[2]))];
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return ['slash', null, +m[1], +m[2], +m[3]];
  return ['bad', NaN];
}

// Reads a text column. order: 'auto' | 'mdy' | 'dmy' (only used for 11/01/2011-style dates).
export function tsdReadText(values, order = 'auto') {
  const kinds = new Map(), parsed = new Array(values.length);
  let firstBig = 0, secondBig = 0, slashN = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || String(v).trim() === '') { parsed[i] = null; continue; }
    const r = readOne(v); parsed[i] = r;
    if (r[0] === 'slash') { slashN++; if (r[2] > 12) firstBig++; if (r[3] > 12) secondBig++; }
    kinds.set(r[0], (kinds.get(r[0]) || 0) + 1);
  }
  let resolved = order;
  if (slashN && order === 'auto') resolved = firstBig && !secondBig ? 'dmy' : secondBig && !firstBig ? 'mdy' : firstBig && secondBig ? 'mixed' : 'ambiguous';
  const good = [...kinds].filter(([k]) => k !== 'bad').sort((a, b) => b[1] - a[1]);
  let freq = good.length ? good[0][0] : '';
  if (freq === 'slash') freq = 'daily';
  const codes = new Float64Array(values.length).fill(NaN), bad = [];
  let invalid = 0, blank = 0;
  for (let i = 0; i < values.length; i++) {
    const r = parsed[i];
    if (!r) { blank++; continue; }
    let f = r[0], c = r[1];
    if (f === 'slash') { f = 'daily'; const o = resolved === 'dmy' ? 'dmy' : 'mdy'; c = o === 'dmy' ? dayCode(r[4], r[3], r[2]) : dayCode(r[4], r[2], r[3]); }
    if (f !== freq || !Number.isFinite(c)) { invalid++; if (bad.length < 3) bad.push(String(values[i])); continue; }
    codes[i] = c;
  }
  return { freq, codes, invalid, blank, bad, slash: slashN > 0, order: resolved, ambiguous: slashN > 0 && (resolved === 'ambiguous' || resolved === 'mixed') && order === 'auto' };
}

// A numeric column: years (1000–2999 integers) or integer periods unless told otherwise.
export function tsdReadNumber(values, as = 'auto') {
  const codes = new Float64Array(values.length).fill(NaN); let invalid = 0, blank = 0, years = true, ints = true, any = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) { blank++; continue; }
    any = true; if (!Number.isInteger(v)) ints = false; if (!(Number.isInteger(v) && v >= 1000 && v <= 2999)) years = false;
  }
  let freq = as;
  if (as === 'auto') freq = !any ? '' : years ? 'yearly' : ints ? 'generic' : '';
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) continue;
    if (!Number.isInteger(v)) { invalid++; continue; }
    codes[i] = v;
  }
  return { freq, codes, invalid, blank, bad: [], numeric: true, nonInteger: any && !ints };
}

export function tsdLabel(code, freq) {
  if (!Number.isFinite(code)) return '—';
  const t = Math.round(code);
  if (freq === 'monthly') return (1960 + Math.floor(t / 12)) + 'm' + ((((t % 12) + 12) % 12) + 1);
  if (freq === 'quarterly') return (1960 + Math.floor(t / 4)) + 'q' + ((((t % 4) + 4) % 4) + 1);
  if (freq === 'daily' || freq === 'trading') { const d = new Date(DAY0 + t * 86400000); return d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  return String(t);
}

// The value R receives as its time index: decimal years for months/quarters (so R plots read as years),
// the year for annual data, and the position 1..T otherwise.
export function tsdIndex(code, freq, pos) {
  if (freq === 'monthly') return 1960 + code / 12;
  if (freq === 'quarterly') return 1960 + code / 4;
  if (freq === 'yearly' || freq === 'generic') return code;
  return pos + 1;
}

// tsset + series preparation. o: { time: codes, freq, unit (values|null), unitPick (label|'' ), combine ('' | 'mean' | 'sum'),
//   repeats ('' | 'mean' | 'sum'), vars: { name: Float64Array }, mask, unitLabel(v) }.
// Returns the regular series (sorted, one row per period) or an error that says what to change.
export function tsdSeries(o) {
  const step = o.freq === 'weekly' ? 7 : 1, out = { rows: [], periods: [], errors: [], warnings: [], notes: [], dupPeriods: 0, dupRows: 0, dupExamples: [], gaps: [], units: [], unitsBalanced: true, inputRows: 0, droppedMissingTime: 0, missing: {} };
  const names = Object.keys(o.vars || {});
  const unitOf = i => { const v = o.unit ? o.unit[i] : null; return v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v)) ? null : String(v); };
  // panel overview
  const byUnit = new Map();
  for (let i = 0; i < o.time.length; i++) {
    if (o.mask && !o.mask[i]) continue;
    const t = o.time[i]; out.inputRows++;
    if (!Number.isFinite(t)) { out.droppedMissingTime++; continue; }
    const u = o.unit ? unitOf(i) : '';
    if (u == null) continue;
    let g = byUnit.get(u); if (!g) byUnit.set(u, g = new Map());
    let rows = g.get(t); if (!rows) g.set(t, rows = []); rows.push(i);
  }
  const spans = [];
  for (const [u, g] of byUnit) { const ts = [...g.keys()].sort((a, b) => a - b); spans.push(ts[0] + ':' + ts[ts.length - 1] + ':' + ts.length); out.units.push({ label: u, n: ts.length, first: ts[0], last: ts[ts.length - 1] }); }
  out.unitsBalanced = new Set(spans).size <= 1;
  out.units.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  if (!byUnit.size) { out.errors.push('No rows have a readable time value.'); return out; }
  // which rows form the series
  let groups;
  if (o.unit && o.unitPick) {
    const g = byUnit.get(o.unitPick);
    if (!g) { out.errors.push('Choose which unit to analyse.'); return out; }
    groups = g;
  } else if (o.unit && byUnit.size > 1) {
    if (!o.combine) { out.errors.push('This is panel data (' + byUnit.size + ' units). Choose one unit to analyse, or combine the units by period.'); return out; }
    groups = new Map();
    for (const g of byUnit.values()) for (const [t, rows] of g) { let a = groups.get(t); if (!a) groups.set(t, a = []); a.push(...rows); }
    if (!out.unitsBalanced) out.warnings.push('Units cover different periods, so each combined period averages or sums a different set of units.');
  } else groups = [...byUnit.values()][0];
  const combineRule = o.unit && !o.unitPick && byUnit.size > 1 ? o.combine : o.repeats;
  for (const [t, rows] of groups) if (rows.length > 1 && !(o.unit && !o.unitPick && byUnit.size > 1)) { out.dupPeriods++; out.dupRows += rows.length - 1; if (out.dupExamples.length < 3) out.dupExamples.push(tsdLabel(t, o.freq) + ' (' + rows.length + ' rows)'); }
  if (out.dupPeriods && !o.repeats) { out.errors.push(out.dupPeriods + ' time period' + (out.dupPeriods > 1 ? 's appear' : ' appears') + ' more than once (' + out.dupExamples.join(', ') + '). Choose a panel variable, or say how to combine the repeated rows.'); return out; }
  const ts = [...groups.keys()].sort((a, b) => a - b);
  for (let j = 1; j < ts.length; j++) {
    const d = ts[j] - ts[j - 1];
    if (o.freq !== 'trading' && d !== step) out.gaps.push([ts[j - 1], ts[j], Math.round(d / step) - 1]);
  }
  for (const t of ts) {
    const rows = groups.get(t), row = { t };
    for (const n of names) {
      const a = o.vars[n]; let s = 0, k = 0;
      for (const i of rows) { const v = a[i]; if (Number.isFinite(v)) { s += v; k++; } }
      const rule = rows.length > 1 ? combineRule : 'one';
      row[n] = k === 0 ? NaN : rule === 'sum' ? s : s / k; // like Stata collapse: missing values are skipped
      if (!Number.isFinite(row[n])) out.missing[n] = (out.missing[n] || 0) + 1;
    }
    out.rows.push(row);
  }
  out.periods = ts;
  if (out.gaps.length) {
    const g = out.gaps.slice(0, 3).map(([a, b, k]) => k + ' missing between ' + tsdLabel(a, o.freq) + ' and ' + tsdLabel(b, o.freq)).join('; ');
    out.errors.push('The series has gaps (' + g + (out.gaps.length > 3 ? '; …' : '') + '). These methods need every period in a row: limit the date range' + (o.freq === 'daily' ? ', or read the dates as trading days' : '') + '.');
  }
  for (const n of names) if (out.missing[n]) out.errors.push(n + ' is missing in ' + out.missing[n] + ' period' + (out.missing[n] > 1 ? 's' : '') + '. These methods need a value in every period: limit the date range or use a subgroup.');
  return out;
}

// Candidate panel identifiers: columns that make (column, time) unique, best first.
export function tsdPanelCandidates(time, columns, mask) {
  const res = [];
  for (const [name, vals] of columns) {
    const seen = new Set(), units = new Set(); let ok = true, n = 0;
    for (let i = 0; i < time.length; i++) {
      if (mask && !mask[i]) continue; const t = time[i]; if (!Number.isFinite(t)) continue;
      const u = vals[i]; if (u == null || u === '' || (typeof u === 'number' && !Number.isFinite(u))) continue;
      const k = String(u) + '\u0001' + t; if (seen.has(k)) { ok = false; break; } seen.add(k); units.add(String(u)); n++;
    }
    if (ok && units.size > 1 && units.size * 2 <= n) res.push({ name, units: units.size }); // a unit spans two or more periods on average
  }
  return res.sort((a, b) => a.units - b.units);
}

// Daily codes: are they really weekly, or trading days (weekdays only)? Checked per unit when a unit is given.
export function tsdDailyKind(codes, unit, mask) {
  const by = new Map();
  for (let i = 0; i < codes.length; i++) { if (mask && !mask[i]) continue; const t = codes[i]; if (!Number.isFinite(t)) continue; const u = unit ? String(unit[i]) : ''; let s = by.get(u); if (!s) by.set(u, s = new Set()); s.add(t); }
  let d7 = 0, d1 = 0, other = 0, weekend = 0, n = 0;
  for (const s of by.values()) {
    const ts = [...s].sort((a, b) => a - b);
    for (const t of ts) { const w = new Date(DAY0 + t * 86400000).getUTCDay(); if (w === 0 || w === 6) weekend++; n++; }
    for (let j = 1; j < ts.length; j++) { const d = ts[j] - ts[j - 1]; if (d === 7) d7++; else if (d === 1) d1++; else other++; }
  }
  // first (or last) day of each month: really monthly, quarterly or annual data stored as dates
  let firsts = 0, lasts = 0, jan = 0, qtr = 0, total = 0;
  for (const s of by.values()) for (const t of s) { const d = new Date(DAY0 + t * 86400000), m = d.getUTCMonth(), dd = d.getUTCDate(), next = new Date(DAY0 + (t + 1) * 86400000).getUTCDate(); total++; if (dd === 1) firsts++; if (next === 1) lasts++; if (m === (dd === 1 ? 0 : 11)) jan++; if ((dd === 1 ? m : m + 1) % 3 === 0) qtr++; }
  if (total > 1 && (firsts === total || lasts === total) && !d1 && !d7) return jan === total ? 'yearly' : qtr === total ? 'quarterly' : 'monthly';
  if (d7 && !d1 && other <= Math.max(1, d7 * 0.02)) return 'weekly';
  if (!weekend && n > 5 && other) return 'trading';
  return 'daily';
}

// Day codes → month / quarter / year codes (used when every date is the first or last day of its period).
export function tsdFromDays(codes, to) {
  return Float64Array.from(codes, t => { if (!Number.isFinite(t)) return NaN; const d = new Date(DAY0 + t * 86400000), y = d.getUTCFullYear(), m = d.getUTCMonth(); return to === 'monthly' ? (y - 1960) * 12 + m : to === 'quarterly' ? (y - 1960) * 4 + Math.floor(m / 3) : to === 'yearly' ? y : t; });
}
