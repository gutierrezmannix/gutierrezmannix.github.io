// Calendar preparation for GM26.1. Bundled into the existing engine; no network dependencies.
export function tsPeriod(value, frequency) {
  if (value == null || String(value).trim() === '') return NaN;
  const s = String(value).trim();
  if (frequency === 'monthly') { const m = s.match(/^(\d{4})-(\d{1,2})$/); return m && +m[2] >= 1 && +m[2] <= 12 ? (+m[1] - 1960) * 12 + +m[2] - 1 : NaN; }
  if (frequency === 'quarterly') { const m = s.match(/^(\d{4})-[Qq]([1-4])$/); return m ? (+m[1] - 1960) * 4 + +m[2] - 1 : NaN; }
  if (frequency === 'daily') { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return NaN; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? (d.getTime() - Date.UTC(1960, 0, 1)) / 86400000 : NaN; }
  return /^-?\d+$/.test(s) ? Number(s) : NaN;
}
export function tsDateLabel(t, frequency) {
  if (!Number.isFinite(t)) return '—'; t = Math.round(t);
  if (frequency === 'monthly' || frequency === 'quarterly') { const n = frequency === 'monthly' ? 12 : 4, y = 1960 + Math.floor(t / n), p = ((t % n) + n) % n + 1; return y + '-' + (n === 4 ? 'Q' + p : String(p).padStart(2, '0')); }
  if (frequency === 'daily') return new Date(Date.UTC(1960, 0, 1) + t * 86400000).toISOString().slice(0, 10);
  return String(t);
}
export function tsCoarsen(t, from, to) {
  if (to === 'same' || from === to) return t;
  if (from === 'monthly') return to === 'yearly' ? 1960 + Math.floor(t / 12) : to === 'quarterly' ? Math.floor(t / 3) : NaN;
  if (from === 'quarterly' && to === 'yearly') return 1960 + Math.floor(t / 4);
  if (from === 'daily') { const d = new Date(Date.UTC(1960, 0, 1) + t * 86400000), y = d.getUTCFullYear(), m = d.getUTCMonth(); return to === 'yearly' ? y : to === 'monthly' ? (y - 1960) * 12 + m : to === 'quarterly' ? (y - 1960) * 4 + Math.floor(m / 3) : NaN; }
  return NaN;
}
function tsExpected(t, from, to) {
  if (from === to) return 1;
  if (from === 'monthly') return to === 'yearly' ? 12 : 3;
  if (from === 'quarterly') return 4;
  if (from === 'daily') {
    let y, m, span;
    if (to === 'yearly') { y = t; m = 0; span = 12; }
    else { span = to === 'monthly' ? 1 : 3; const n = to === 'monthly' ? 12 : 4; y = 1960 + Math.floor(t / n); m = (((t % n) + n) % n) * span; }
    return (Date.UTC(y, m + span, 1) - Date.UTC(y, m, 1)) / 86400000;
  }
  return NaN;
}
export function tsPrepare(o) {
  const from = o.frequency || 'yearly', to = o.target && o.target !== 'same' ? o.target : from;
  const agg = o.aggregate || 'none', groups = new Map(), sourceKeys = new Set(), examples = [], out = { frequency: to, inputRows: 0, duplicates: 0, invalidTime: 0, invalidUnit: 0, missingOutcome: 0, incomplete: 0, gaps: 0, rows: [], t: [], y: [], unit: [] };
  if (!o.y) return { ...out, error: 'Pick an outcome before preparing the series.' };
  if (o.source && (o.sourceValue == null || o.sourceValue === '')) return { ...out, error: 'Choose one value of the measurement/source variable, or clear that filter.' };
  if (to !== from && agg === 'none') return { ...out, error: 'Choose an aggregation rule explicitly before changing the analysis frequency.' };
  if (to === from && !['none', 'rate'].includes(agg)) return { ...out, error: 'Keep-original frequency preserves each observation. Choose a coarser frequency to sum or average periods.' };
  if (agg === 'rate' && (!o.numerator || !o.population)) return { ...out, error: 'Recomputing a rate requires a count numerator and a population denominator.' };
  if (agg === 'rate' && (!Number.isFinite(Number(o.scale)) || Number(o.scale) <= 0)) return { ...out, error: 'The rate multiplier must be a positive number.' };
  for (let i = 0; i < o.y.length; i++) {
    if (o.mask && !o.mask[i]) continue;
    if (o.source && String(o.source[i]) !== String(o.sourceValue)) continue;
    const u0 = o.unit ? o.unit[i] : 'all';
    if (u0 == null || u0 === '' || (typeof u0 === 'number' && !Number.isFinite(u0))) { out.invalidUnit++; continue; }
    const u = String(u0); if (o.selected && !o.selected.has(u)) continue;
    let t;
    if (o.mode === 'parts') {
      const y = o.time && o.time[i], p = o.part && o.part[i], n = from === 'quarterly' ? 4 : 12;
      t = Number.isInteger(y) && y >= 100 && y <= 9999 && Number.isInteger(p) && p >= 1 && p <= n ? (y - 1960) * n + p - 1 : NaN;
    } else t = o.time && o.time[i];
    if (!Number.isInteger(t)) { out.invalidTime++; continue; }
    const tt = tsCoarsen(t, from, to);
    if (!Number.isFinite(tt)) return { ...out, error: 'That frequency conversion is unsupported. Keep the original frequency or select a supported calendar aggregation.' };
    if (Number.isFinite(o.start) && tt < o.start || Number.isFinite(o.end) && tt > o.end) continue;
    out.inputRows++;
    const key = JSON.stringify([u, t]);
    if (sourceKeys.has(key)) { out.duplicates++; if (examples.length < 4) examples.push((o.unit ? u + ' / ' : '') + tsDateLabel(t, from)); } sourceKeys.add(key);
    const k = JSON.stringify([u, tt]); let g = groups.get(k);
    if (!g) { g = { u, t: tt, n: 0, sum: 0, valid: 0, pop: null, popVaries: false }; groups.set(k, g); }
    g.n++; const v = agg === 'rate' ? o.numerator[i] : o.y[i];
    if (typeof v === 'number' && Number.isFinite(v)) { g.sum += v; g.valid++; if (agg === 'rate' && v < 0) return { ...out, error: 'A count numerator cannot be negative.' }; }
    else out.missingOutcome++;
    if (agg === 'rate') { const p = o.population[i]; if (!Number.isFinite(p) || p <= 0) return { ...out, error: 'Population must be observed and positive for every contributing row.' }; if (g.pop != null && Math.abs(g.pop - p) > 1e-8 * Math.max(1, p)) g.popVaries = true; g.pop = p; }
  }
  if (out.invalidTime || out.invalidUnit) return { ...out, error: out.invalidTime + ' invalid/missing time values and ' + out.invalidUnit + ' missing unit identifiers. Correct or explicitly filter these records.' };
  if (out.duplicates) return { ...out, error: o.unit ? out.duplicates + ' extra observations share a unit and original period (' + examples.join('; ') + '). Resolve the source/methodology or refine the unit identifier before analysis. Records are never automatically averaged or deleted.' : out.duplicates + ' extra row(s) repeat a period (' + examples.join('; ') + '). If each row is a different unit (state, country…), choose it as the UNIT (PANEL) VARIABLE; if they are different measurements, use the source filter under More data preparation. Records are never automatically averaged or deleted.' };
  for (const g of groups.values()) {
    if (g.popVaries) return { ...out, error: 'The population denominator varies within an aggregate period. Supply an appropriate period-level denominator; populations are never summed across months.' };
    const complete = g.n === tsExpected(g.t, from, to) && g.valid === g.n;
    if (!complete) out.incomplete++;
    const y = !complete ? NaN : agg === 'mean' ? g.sum / g.valid : agg === 'rate' ? g.sum / g.pop * (Number(o.scale) || 100000) : g.sum;
    out.rows.push({ u: g.u, t: g.t, y });
  }
  out.rows.sort((a, b) => a.u.localeCompare(b.u) || a.t - b.t);
  const perUnit = new Map();
  for (const r of out.rows) { out.t.push(r.t); out.y.push(r.y); out.unit.push(r.u); if (Number.isFinite(r.y)) { const a = perUnit.get(r.u) || []; a.push(r.t); perUnit.set(r.u, a); } }
  for (const times of perUnit.values()) for (let j = 1; j < times.length; j++) out.gaps += Math.max(0, times[j] - times[j - 1] - 1);
  out.nUnits = perUnit.size; out.valid = out.y.filter(Number.isFinite).length;
  if (!out.valid) out.error = 'No complete periods with an observed outcome remain.';
  else if (out.gaps) out.error = out.gaps + ' missing period(s) inside the analysis range. Gaps remain missing, never zero. This estimator requires a contiguous range: choose one using the period limits or use a method that explicitly supports gaps.';
  if (o.average && perUnit.size > 1) { const spans = [...perUnit.values()].map(a => a.join(',')); if (spans.some(a => a !== spans[0])) out.error = 'Averaging units requires matching observed periods. Choose a common complete date range first.'; }
  return out;
}

export function tsSetupControls(C, out, picker, chip) {
  const S = C.state, E = C._E;
  const find = names => S.cols.find(c => names.includes(c.name.toLowerCase()))?.name || '';
  const textDates = () => C.memo('tsTxtGuess|' + (S.dver || 0), () => { for (const c of S.cols) { if (c.type === 'numeric') continue; const col = C._raw.cols[C._raw.names.indexOf(c.name)]; if (!col) continue; const r = E.tsdReadText(col.a.slice(0, 2000)); const n = col.a.slice(0, 2000).filter(v => v != null && v !== '').length; if (r.freq && n && r.invalid <= n * 0.1) return c.name; } return ''; });
  const tv = S.tsT != null ? S.tsT : (find(['year', 'yr', 'time', 'date', 'fecha', 'period', 'periodo']) || textDates());
  // Text dates (2015-01-01, 2015m1, "Nov 1, 2011"…) are read into the same Stata period codes as numeric dates.
  const tmeta = tv ? C.effMeta(tv) : null;
  const tread = tmeta && tmeta.type !== 'numeric' ? C.memo('tsTxt|' + tv + '|' + (S.dver || 0), () => {
    const raw = C._raw, col = raw.cols[raw.names.indexOf(tv)], r = E.tsdReadText(col ? col.a : []);
    let freq = r.freq === 'yearly' ? 'yearly' : r.freq, codes = r.codes;
    if (freq === 'daily') { const k = E.tsdDailyKind(codes, null, null); if (['monthly', 'quarterly', 'yearly'].includes(k)) { codes = E.tsdFromDays(codes, k); freq = k; } }
    return { freq, codes, raw: r.codes, rawFreq: r.freq, invalid: r.invalid, bad: r.bad, example: col ? col.a.find(v => v != null && v !== '') : '' };
  }) : null;
  const guessUnit = () => {
    const named = find(['cve_ent', 'ent', 'entidad', 'estado', 'state', 'state_id', 'country_name', 'country', 'pais', 'municipio', 'cve_mun', 'unit', 'id']);
    if (named || !tv) return named;
    const t = tread ? tread.codes : C.numCore(tv)?.a; if (!t) return '';
    return C.memo('tsUnitGuess|' + tv + '|' + (S.dver || 0), () => { const seen = new Set(); let dup = false; for (const v of t) { if (!Number.isFinite(v)) continue; if (seen.has(v)) { dup = true; break; } seen.add(v); } if (!dup) return ''; const names = S.cols.map(c => c.name).filter(n => n !== tv).slice(0, 60); const cand = E.tsdPanelCandidates(t, names.map(n => [n, C.effMeta(n)?.type === 'numeric' ? Array.from(C.numCore(n)?.a || [], v => Number.isFinite(v) ? String(v) : null) : (C.valsCore(n)?.a || [])])); return cand.length ? cand[0].name : ''; });
  };
  const uv = S.tsU != null ? S.tsU : guessUnit();
  const yv = S.tsY || '', part = S.tsPart || find(['month', 'mes']), source = S.tsSource || '';
  const mode = S.tsInputMode || (part && /^(year|yr|año|ano)$/i.test(tv) ? 'parts' : 'existing');
  const frequency = S.tsFreq || (mode === 'parts' ? 'monthly' : tread && tread.freq ? ({ yearly: 'yearly', quarterly: 'quarterly', monthly: 'monthly', daily: 'daily' }[tread.freq] || 'generic') : /^(year|yr)$/i.test(tv) ? 'yearly' : 'generic');
  const target = S.tsTarget || 'same', effective = target === 'same' ? frequency : target;
  const opts = (key, current, items, extra) => items.map(([value, label]) => ({ label, style: chip(value === current), click: () => C.setState({ [key]: value, ...(extra ? extra(value) : {}) }) }));
  const optional = key => [{ name: 'NONE', sub: 'no filter', pick: () => C.setState({ [key]: '', tsSourceValue: '', pk: null, pq: '' }) }];
  out.tsInputBtns = opts('tsInputMode', mode, [['existing', 'Existing time variable'], ['parts', 'Year + month / quarter']], v => ({ tsFreq: v === 'parts' ? 'monthly' : frequency, tsTarget: 'same', tsAggregate: 'none', tsEv: '', tsEvU: {}, tsT0: '', tsT1: '' }));
  out.tsFreqBtns = opts('tsFreq', frequency, (mode === 'parts' ? [['monthly','Monthly'],['quarterly','Quarterly']] : [['yearly','Annual'],['quarterly','Quarterly'],['monthly','Monthly'],['weekly','Weekly'],['daily','Daily'],['generic','Integer periods']]), () => ({ tsTarget: 'same', tsAggregate: 'none', tsEv: '', tsEvU: {}, tsT0: '', tsT1: '' }));
  out.tsParts = mode === 'parts'; out.tsTimeLabel = mode === 'parts' ? 'YEAR COLUMN' : 'TIME VARIABLE';
  out.tsPartLabel = frequency === 'quarterly' ? 'QUARTER COLUMN (1–4)' : 'MONTH COLUMN (1–12)';
  out.tsTimeHint = mode === 'parts' ? 'Calendar dates are built from the year and period columns. Original observations are kept.' : 'Calendar variables use Stata numeric dates (monthly: months since 1960-01; daily: days since 1960-01-01). Choose Year + month / quarter for separate columns. Integer periods advance by 1.';
  out.tsTPk = picker('tst', tv, n => C.setState({ tsT: n, tsFreq: '', tsU: null, tsSel: [] }), () => true);
  out.tsPartPk = picker('tspart', part, n => C.setState({ tsPart: n }), c => c.type === 'numeric' && c.name !== tv);
  out.tsUPk = picker('tsu', uv, n => C.setState({ tsU: n, tsSel: [] }), c => c.name !== tv, [{ name: 'NONE', sub: 'one series; one observation per period required', pick: () => C.setState({ tsU: '', tsSel: [], pk: null, pq: '' }) }]);
  out.tsYPk = picker('tsy', yv, n => C.setState({ tsY: n }), c => c.type === 'numeric' && c.name !== tv);
  out.tsSourcePk = picker('tssource', source, n => C.setState({ tsSource: n, tsSourceValue: '' }), null, optional('tsSource'));
  out.tsHasSource = !!source;
  // Match on stored numeric codes, not their display/value labels.
  const nums = n => C.numCore(n)?.a || null, vals = n => C.effMeta(n)?.type === 'numeric' ? nums(n) : C.valsCore(n)?.a || null;
  const sv = vals(source), choices = sv ? [...new Set(Array.from(sv).filter(v => v != null && v !== '' && (typeof v !== 'number' || Number.isFinite(v))).map(String))].sort() : [];
  out.tsSourceChoices = choices.slice(0, 100).map(v => ({ label: C.vlabel(source, v), style: chip(String(S.tsSourceValue) === v), click: () => C.setState({ tsSourceValue: v }) }));
  out.tsSourceHint = choices.length > 100 ? 'More than 100 source values: use the IF subgroup bar to select the relevant records.' : 'Select one measurement system/source. Alternatives for the same unit and period are not averaged together.';
  const targets = [['same','Keep original frequency']];
  if (frequency === 'daily') targets.push(['monthly','Monthly']);
  if (frequency === 'monthly' || frequency === 'daily') targets.push(['quarterly','Quarterly']);
  if (['monthly','quarterly','daily'].includes(frequency)) targets.push(['yearly','Annual']);
  out.tsTargetBtns = opts('tsTarget', target, targets, () => ({ tsAggregate: 'none', tsEv: '', tsEvU: {}, tsT0: '', tsT1: '' }));
  out.tsCoarser = target !== 'same' && target !== frequency;
  const aggregate = S.tsAggregate || 'none';
  out.tsAggregateBtns = opts('tsAggregate', aggregate, out.tsCoarser ? [['none','Choose a rule…'],['sum','Sum counts'],['mean','Mean of original values'],['rate','Recompute a population rate']] : [['none','Use outcome as recorded'],['rate','Compute a population rate']]);
  out.tsRate = aggregate === 'rate';
  out.tsCountPk = picker('tscount', S.tsCount || '', n => C.setState({ tsCount: n }), c => c.type === 'numeric');
  out.tsPopPk = picker('tspop', S.tsPop || '', n => C.setState({ tsPop: n }), c => c.type === 'numeric');
  out.tsScale = S.tsScale || '100000'; out.tsSetScale = e => C.setState({ tsScale: e.target.value });
  out.tsAggregationHint = 'Incomplete aggregate periods remain missing. Rates use summed counts and one period-level population, never a sum of repeated population values. A mean retains the original measure’s time unit.';
  out.tsPeriodFormat = effective === 'monthly' ? 'YYYY-MM, e.g. 2018-01' : effective === 'quarterly' ? 'YYYY-Q1, e.g. 2018-Q1' : effective === 'daily' ? 'YYYY-MM-DD' : 'integer period, e.g. 2018';
  out.tsValidation = ''; out.tsPrepared = ''; out.tsHasPreparation = false;
  const textTime = tread ? (frequency === tread.freq ? tread.codes : frequency === 'daily' && tread.rawFreq === 'daily' ? tread.raw : null) : null;
  if (tread) {
    const fq = { yearly: 'annual', quarterly: 'quarterly', monthly: 'monthly', daily: 'daily' }[tread.freq] || tread.freq;
    out.tsTimeHint = !tread.freq ? '"' + tv + '" does not look like dates. Use dates such as 2015-01-01, 2015-01, 2015m1, 2015q1, "Nov 1, 2011" or a year.'
      : !textTime ? '"' + tv + '" holds ' + fq + ' dates (e.g. "' + tread.example + '"). Choose ' + (fq[0].toUpperCase() + fq.slice(1)) + ' above.'
      : 'Text dates in "' + tv + '" are read as ' + fq + ' periods (e.g. "' + tread.example + '" → ' + tsDateLabel(textTime.find(Number.isFinite), frequency) + ')' + (tread.invalid ? '; ' + tread.invalid + ' value(s) could not be read (e.g. "' + tread.bad.join('", "') + '") and are left out' : '') + '.';
  }
  const moreUsed = [source ? 'source filter' : '', target !== 'same' ? 'frequency change' : '', (S.tsAggregate || 'none') === 'rate' ? 'population rate' : ''].filter(Boolean);
  out.tsMoreLabel = 'More data preparation — source filter, change frequency, population rates' + (moreUsed.length ? ' (in use: ' + moreUsed.join(', ') + ')' : '');
  const config = { mode, frequency, target, aggregate, time: tread ? textTime : nums(tv), part: nums(part), y: nums(yv), unit: vals(uv), source: sv, sourceValue: S.tsSourceValue, numerator: nums(S.tsCount), population: nums(S.tsPop), scale: Number(S.tsScale || 100000), mask: C.mask() };
  const fullTime = config.time ? Array.from(config.time, (t, i) => {
    if (config.mask && !config.mask[i] || source && String(sv?.[i]) !== String(S.tsSourceValue)) return NaN;
    if (mode === 'parts') { const p = config.part?.[i], n = frequency === 'quarterly' ? 4 : 12; return Number.isInteger(t) && Number.isInteger(p) && p >= 1 && p <= n ? (t - 1960) * n + p - 1 : NaN; } return t;
  }) : [];
  const fields = ['tsInputMode','tsFreq','tsPart','tsTarget','tsAggregate','tsSource','tsSourceValue','tsCount','tsPop','tsScale'];
  const levelCounts = new Map();
  if (config.unit) for (const v of config.unit) if (v != null && v !== '' && (typeof v !== 'number' || Number.isFinite(v))) levelCounts.set(String(v),(levelCounts.get(String(v)) || 0)+1);
  const levels = { rows: [...levelCounts].map(([label,c])=>({label,c})) };
  return { tv, uv, yv, part, source, mode, frequency, effective, config, fullTime, fields, levels, okT: !!(config.time && (mode !== 'parts' || config.part)), okU: !!(uv && C.effMeta(uv)), okY: !!config.y };
}

// Scripts reproduce the prepared analysis, leaving the original dataset intact.
export function tsScripts(c, prep, res) {
  const { setup, state: S } = c, q = v => JSON.stringify(String(v)), freq = prep.frequency;
  const sq = v => {
    const s = String(v), pieces = s.split(/(["`$\r\n\t\\])/).filter(Boolean).map(x => /^["`$\r\n\t\\]$/.test(x) ? 'char(' + x.charCodeAt(0) + ')' : '"' + x + '"');
    return pieces.length > 1 ? '(' + pieces.join(' + ') + ')' : pieces[0] || '""';
  };
  let p = 'gmts_'; while (c.names.some(n => n.startsWith(p))) p += 'x';
  const t = p + 'time', y = p + 'outcome', u = p + 'unit', trend = p + 'trend', ev = p + 'event', post = p + 'post', since = p + 'since', pulse = p + 'pulse', lag = p + 'lag', nn = p + 'n', valid = p + 'valid', pop = p + 'population';
  const numeric = n => c.numeric.includes(n), literal = (n,v,r=false) => {
    if (!numeric(n)) return r ? q(v) : sq(v);
    const label = (c.valueLabels?.[n] || []).find(x => String(x[1]) === String(v));
    const code = Number.isFinite(Number(v)) ? Number(v) : label ? Number(label[0]) : NaN;
    if (!Number.isFinite(code)) throw new Error('Cannot resolve the stored numeric code for ' + n + ': ' + v);
    return String(code);
  };
  const condition = (x, r) => {
    const v = r ? '`' + x.v + '`' : x.v, val = z => numeric(x.v) && z === '.' ? (r ? 'NA' : '.') : literal(x.v,z,r);
    if (x.t === 'in') return r ? v + ' %in% c(' + x.vals.map(val).join(',') + ')' : '(' + x.vals.map(z => v + ' == ' + val(z)).join(' | ') + ')';
    if (x.t === 'rng') return [x.lo !== '' ? v + ' >= ' + x.lo : '', x.hi !== '' ? v + ' <= ' + x.hi : ''].filter(Boolean).join(' & ');
    if (x.val === '.') return (x.op === '!=' ? '!' : '') + (r ? 'is.na(' : 'missing(') + v + ')';
    return v + ' ' + x.op + ' ' + val(x.val);
  };
  const name = (v,r) => r ? '`' + v + '`' : v;
  const filters = r => c.conditions.map(x => '(' + condition(x,r) + ')').concat(setup.source ? ['(' + name(setup.source,r) + ' == ' + literal(setup.source,S.tsSourceValue,r) + ')'] : []).concat(setup.uv && !S.tsAll ? ['(' + S.tsSel.map(v => name(setup.uv,r) + ' == ' + literal(setup.uv,v,r)).join(' | ') + ')'] : []).filter(Boolean);
  const st = ['preserve', '* ' + c.summary], rr = ['local({', '# ' + c.summary, 'd <- df'];
  for (const [name,codes] of Object.entries(c.missing || {})) if (codes.length) { st.push('replace ' + name + ' = . if ' + codes.map(v => name + ' == ' + v).join(' | ')); rr.push('d$' + name + '[d$' + name + ' %in% c(' + codes.join(',') + ')] <- NA_real_'); }
  const sf = filters(false).join(' & '), rf = filters(true).join(' & ');
  if (sf) st.push('keep if ' + sf); if (rf) rr.push('d <- subset(d, ' + rf + ')');
  const n = setup.frequency === 'quarterly' ? 4 : 12;
  const ti = setup.mode === 'parts' ? (setup.frequency === 'quarterly' ? 'yq' : 'ym') + '(' + setup.tv + ', ' + setup.part + ')' : setup.tv;
  st.push('gen double ' + t + ' = ' + ti);
  rr.push('d$' + t + ' <- ' + (setup.mode === 'parts' ? '(d$' + setup.tv + ' - 1960) * ' + n + ' + d$' + setup.part + ' - 1' : 'd$' + setup.tv));
  const unit = setup.uv || u;
  if (!setup.uv) { st.push('gen byte ' + u + ' = 1'); rr.push('d$' + u + ' <- 1L'); }
  st.push('assert !missing(' + t + ', ' + unit + ')', 'isid ' + unit + ' ' + t);
  rr.push('stopifnot(!anyNA(d[c(' + q(unit) + ',' + q(t) + ')]), !anyDuplicated(d[c(' + q(unit) + ',' + q(t) + ')]))');
  const ag = S.tsAggregate || 'none', coarser = freq !== setup.frequency;
  const ysrc = ag === 'rate' ? S.tsCount : setup.yv;
  st.push('gen double ' + y + ' = ' + ysrc); rr.push('d$' + y + ' <- d$' + ysrc);
  if (ag === 'rate') { st.push('gen double ' + pop + ' = ' + S.tsPop, 'assert ' + pop + ' > 0 & !missing(' + pop + ')'); rr.push('d$' + pop + ' <- d$' + S.tsPop, 'stopifnot(all(is.finite(d$' + pop + ') & d$' + pop + ' > 0))'); }
  if (coarser) {
    let stc, rc;
    if (setup.frequency === 'monthly') { stc = freq === 'yearly' ? '1960 + floor(' + t + '/12)' : 'floor(' + t + '/3)'; rc = freq === 'yearly' ? '1960 + floor(d$' + t + '/12)' : 'floor(d$' + t + '/3)'; }
    else if (setup.frequency === 'quarterly') { stc = '1960 + floor(' + t + '/4)'; rc = '1960 + floor(d$' + t + '/4)'; }
    else { stc = (freq === 'yearly' ? 'year(' + t + ')' : freq === 'monthly' ? 'mofd(' + t + ')' : 'qofd(' + t + ')'); rr.push('calendar <- as.Date(d$' + t + ', origin="1960-01-01")'); rc = freq === 'yearly' ? 'as.integer(format(calendar,"%Y"))' : '(as.integer(format(calendar,"%Y"))-1960)*' + (freq === 'monthly' ? '12 + as.integer(format(calendar,"%m"))-1' : '4 + (as.integer(format(calendar,"%m"))-1) %/% 3'); }
    st.push('replace ' + t + ' = ' + stc); rr.push('d$' + t + ' <- ' + rc);
  }
  for (const [k,op] of [['tsT0','>='],['tsT1','<=']]) { const v = tsPeriod(S[k],freq); if (Number.isFinite(v)) { st.push('keep if ' + t + ' ' + op + ' ' + v); rr.push('d <- d[d$' + t + ' ' + op + ' ' + v + ',,drop=FALSE]'); } }
  if (coarser) {
    let expectedSt, expectedR;
    if (setup.frequency === 'monthly' || setup.frequency === 'quarterly') expectedSt = expectedR = String(setup.frequency === 'quarterly' ? 4 : freq === 'yearly' ? 12 : 3);
    else { expectedSt = freq === 'yearly' ? 'mdy(1,1,' + t + '+1)-mdy(1,1,' + t + ')' : freq === 'monthly' ? 'dofm(' + t + '+1)-dofm(' + t + ')' : 'dofq(' + t + '+1)-dofq(' + t + ')'; expectedR = freq === 'yearly' ? 'as.numeric(as.Date(paste0(b$' + t + '+1,"-01-01"))-as.Date(paste0(b$' + t + ',"-01-01")))' : 'as.numeric(seq(as.Date("1960-01-01") + 0, length.out=1)[1])'; }
    st.push('gen byte ' + nn + ' = 1', 'gen byte ' + valid + ' = !missing(' + y + ')');
    if (ag === 'rate') st.push('bysort ' + unit + ' ' + t + ': assert ' + pop + ' == ' + pop + '[1]');
    st.push('collapse (sum) ' + y + ' ' + nn + ' ' + valid + (ag === 'rate' ? ' (firstnm) ' + pop : '') + ', by(' + unit + ' ' + t + ')', 'replace ' + y + ' = . if ' + nn + ' != ' + expectedSt + ' | ' + valid + ' != ' + nn);
    if (ag === 'mean') st.push('replace ' + y + ' = ' + y + '/' + nn);
    const expectedDaily = freq === 'yearly' ? expectedR : 'as.numeric(as.Date(sprintf("%04d-%02d-01",1960+(b$' + t + ' %/% ' + (freq === 'monthly' ? 12 : 4) + '), (b$' + t + ' %% ' + (freq === 'monthly' ? 12 : 4) + ')*' + (freq === 'monthly' ? 1 : 3) + '+1)) + 0)';
    rr.push('d <- do.call(rbind, lapply(split(d, interaction(d$' + unit + ',d$' + t + ',drop=TRUE)), function(g) {', '  b <- g[1,,drop=FALSE]');
    if (setup.frequency === 'daily' && freq !== 'yearly') rr.push('  begin <- as.Date(sprintf("%04d-%02d-01",1960+b$' + t + ' %/% ' + (freq === 'monthly' ? 12 : 4) + ', (b$' + t + ' %% ' + (freq === 'monthly' ? 12 : 4) + ')*' + (freq === 'monthly' ? 1 : 3) + '+1))', '  expected <- as.numeric(seq(begin,by="' + (freq === 'monthly' ? 'month' : '3 months') + '",length.out=2)[2]-begin)');
    else rr.push('  expected <- ' + expectedDaily);
    if (ag === 'rate') rr.push('  stopifnot(length(unique(g$' + pop + ')) == 1L)');
    rr.push('  b$' + y + ' <- if(nrow(g)!=expected || anyNA(g$' + y + ')) NA_real_ else ' + (ag === 'mean' ? 'mean' : 'sum') + '(g$' + y + ')', '  b', '}))');
  }
  if (ag === 'rate') { const scale = Number(S.tsScale || 100000); st.push('replace ' + y + ' = ' + y + '/' + pop + '*' + scale); rr.push('d$' + y + ' <- d$' + y + '/d$' + pop + '*' + scale); }
  if (S.tsAvg && prep.nUnits > 1) { st.push('collapse (mean) ' + y + ', by(' + t + ')', 'gen byte ' + u + ' = 1'); rr.push('d <- aggregate(d[' + q(y) + '], list(' + t + '=d$' + t + '), mean)', 'd$' + u + ' <- 1L'); }
  else if (setup.uv) { st.push('egen long ' + u + ' = group(' + setup.uv + ')'); rr.push('d$' + u + ' <- as.integer(factor(d$' + setup.uv + '))'); }
  const formats = {monthly:'tm',quarterly:'tq',daily:'td',weekly:'tw'};
  if (formats[freq]) st.push('format ' + t + ' %' + formats[freq]);
  st.push('drop if missing(' + y + ')', (res.pooled ? 'xtset ' + u + ' ' : 'tsset ') + t);
  rr.push('d <- d[is.finite(d$' + y + '),,drop=FALSE]', 'd <- d[order(d$' + u + ',d$' + t + '),,drop=FALSE]');
  const tr = S.tsTr || 'level', orig = p + 'original';
  if (tr !== 'level') { st.push('gen double ' + orig + ' = ' + y, 'replace ' + y + ' = ' + (tr === 'diff' ? orig + '-L.' + orig : '100*(' + orig + '/L.' + orig + '-1)') + (tr === 'pct' ? ' if L.' + orig + ' != 0' : ''), ...(tr === 'pct' ? ['replace ' + y + ' = . if L.' + orig + ' == 0'] : [])); rr.push('d$' + y + ' <- ave(d$' + y + ', d$' + u + ', FUN=function(x) c(NA_real_, ' + (tr === 'diff' ? 'diff(x)' : 'ifelse(head(x,-1)==0,NA_real_,100*(tail(x,-1)/head(x,-1)-1))') + '))'); }
  st.push('gen double ' + trend + ' = ' + t + ' - ' + res.tmin); rr.push('d$' + trend + ' <- d$' + t + ' - ' + res.tmin);
  const terms = [trend];
  if (res.hasEv) {
    const e0 = Number.isFinite(c.common) ? c.common : null; st.push('gen double ' + ev + ' = ' + (e0 ?? '.')); rr.push('d$' + ev + ' <- ' + (e0 ?? 'NA_real_'));
    for (const [raw,value] of Object.entries(c.events)) { st.push('replace ' + ev + ' = ' + value + ' if ' + setup.uv + ' == ' + literal(setup.uv,raw)); rr.push('d$' + ev + '[d$' + setup.uv + ' == ' + literal(setup.uv,raw,true) + '] <- ' + value); }
    st.push('gen byte ' + post + ' = ' + t + ' >= ' + ev + ' if !missing(' + ev + ')', 'gen double ' + since + ' = max(0,' + t + '-' + ev + ') if !missing(' + ev + ')', 'gen byte ' + pulse + ' = ' + t + ' == ' + ev + ' if !missing(' + ev + ')');
    rr.push('d$' + post + ' <- as.numeric(d$' + t + ' >= d$' + ev + ')', 'd$' + since + ' <- pmax(0,d$' + t + '-d$' + ev + ')', 'd$' + pulse + ' <- as.numeric(d$' + t + ' == d$' + ev + ')');
    if (['step','both'].includes(S.tsType || 'both')) terms.push(post); if (['trend','both'].includes(S.tsType || 'both')) terms.push(since); if (S.tsType === 'pulse') terms.push(pulse);
  }
  if (S.tsAr1) { st.push('gen double ' + lag + ' = L.' + y); rr.push('d$' + lag + ' <- ave(d$' + y + ',d$' + u + ',FUN=function(x)c(NA_real_,head(x,-1)))'); terms.push(lag); }
  const L = Number((res.seType.match(/lag (\d+)/) || [0,1])[1]);
  st.push((res.pooled ? 'regress ' : 'newey ') + y + ' ' + terms.map(x => 'c.' + x).join(' ') + (res.pooled ? ' i.' + u + ', vce(cluster ' + u + ')' : ', lag(' + L + ')'), 'restore');
  rr.push('library(sandwich); library(lmtest)', 'm <- lm(' + y + ' ~ ' + terms.join(' + ') + (res.pooled ? ' + factor(' + u + ')' : '') + ',data=d,na.action=na.omit)', 'coeftest(m, vcov. = ' + (res.pooled ? 'vcovCL(m,cluster=~' + u + ',type="HC1",cadjust=TRUE), df=' + (res.nUnits-1) : 'NeweyWest(m,lag=' + L + ',prewhite=FALSE,adjust=TRUE)') + ')', '})');
  return { stata: st.join('\n'), r: rr.join('\n').replace(/\b([dgb])\$([A-Za-z_][A-Za-z0-9_]*)/g,(_,obj,key)=>obj+'[['+q(key)+']]') };
}
