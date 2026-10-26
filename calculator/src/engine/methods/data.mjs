// Data management previews: merge, append, reshape long / wide, duplicate keys — R's merge(sort = FALSE),
// rbind, reshape and duplicated() semantics, including row and column order.
import { register } from '../registry.mjs';
import { decode, isFactor, isNA, need, fmtR } from '../lib/frame.mjs';

const cell = (c, i) => isFactor(c) ? c.value(i) : (isNA(c[i]) ? null : c[i]);
const keyOf = (fr, keys, i) => JSON.stringify(keys.map(k => { const v = cell(fr.get(k), i); return v === null ? null : typeof v === 'number' ? v : 's' + v; }));
function preview(ctx, d, names, rows) {
  ctx.outputData = { names, rows };
  ctx.table('Data preview: first 200 rows', names, rows.slice(0, 200));
  ctx.table('Data operation summary', ['Input.rows', 'Output.rows', 'Output.columns'], [[d.n, rows.length, names.length]]);
  ctx.note('Preview the output before replacing the active dataset.');
}
register(['merge', 'append', 'long', 'wide', 'duplicates'], ctx => {
  const { id, d } = ctx, keys = ctx.fields('keys');
  if (id === 'duplicates') {
    need(keys.length > 0, 'Choose key columns.');
    const counts = new Map(); for (let i = 0; i < d.n; i++) { const k = keyOf(d, keys, i); counts.set(k, (counts.get(k) || 0) + 1); }
    const rows = []; for (let i = 0; i < d.n; i++) if (counts.get(keyOf(d, keys, i)) > 1) rows.push([i + 1, ...d.names.map(k => cell(d.get(k), i))]);
    ctx.table('Duplicate keys', ['Source.row', ...d.names], rows); ctx.note(rows.length + ' rows belong to duplicated keys.'); return;
  }
  if (id === 'merge' || id === 'append') {
    const other = decode(ctx.packet.other); need(other.n > 0, 'Load a second dataset for preview.');
    if (id === 'append') {
      const a = new Set(d.names), b = new Set(other.names); need(a.size === b.size && [...a].every(k => b.has(k)), 'Append requires matching columns.');
      need(d.names.every(k => d.isNumeric(k) === other.isNumeric(k)), 'Append column types must match.');
      const rows = []; for (const fr of [d, other]) for (let i = 0; i < fr.n; i++) rows.push(d.names.map(k => cell(fr.get(k), i)));
      preview(ctx, d, d.names, rows); return;
    }
    need(keys.length > 0 && keys.every(k => other.has(k)), 'Both datasets must contain the selected keys.');
    const anyNA = fr => { for (let i = 0; i < fr.n; i++) for (const k of keys) if (cell(fr.get(k), i) === null) return true; return false; };
    need(!anyNA(d) && !anyNA(other), 'Merge keys must be nonmissing.');
    const dupl = fr => { const s = new Set(); for (let i = 0; i < fr.n; i++) { const k = keyOf(fr, keys, i); if (s.has(k)) return true; s.add(k); } return false; };
    need(ctx.opt('manyToMany', false) === true || !(dupl(d) && dupl(other)), 'Both inputs have duplicate keys. Explicitly enable many-to-many merging after inspecting duplicates.');
    const join = ctx.opt('join', 'left'); need(['left', 'right', 'inner', 'full'].includes(join), 'Unknown join.');
    const allX = join === 'left' || join === 'full', allY = join === 'right' || join === 'full';
    const xr = d.names.filter(k => !keys.includes(k)), yr = other.names.filter(k => !keys.includes(k)), both = new Set(xr.filter(k => yr.includes(k)));
    const names = [...keys, ...xr.map(k => both.has(k) ? k + '.x' : k), ...yr.map(k => both.has(k) ? k + '.y' : k)];
    const yIdx = new Map(); for (let j = 0; j < other.n; j++) { const k = keyOf(other, keys, j); if (!yIdx.has(k)) yIdx.set(k, []); yIdx.get(k).push(j); }
    const rows = [], usedY = new Set(), unX = [];
    for (let i = 0; i < d.n; i++) { const js = yIdx.get(keyOf(d, keys, i)); if (!js) { unX.push(i); continue; } for (const j of js) { usedY.add(j); rows.push([...keys.map(k => cell(d.get(k), i)), ...xr.map(k => cell(d.get(k), i)), ...yr.map(k => cell(other.get(k), j))]); } }
    if (allX) for (const i of unX) rows.push([...keys.map(k => cell(d.get(k), i)), ...xr.map(k => cell(d.get(k), i)), ...yr.map(() => null)]);
    if (allY) for (let j = 0; j < other.n; j++) if (!usedY.has(j)) rows.push([...keys.map(k => cell(other.get(k), j)), ...xr.map(() => null), ...yr.map(k => cell(other.get(k), j))]);
    preview(ctx, d, names, rows); return;
  }
  if (id === 'long') {
    const subj = ctx.subject[0], vars = ctx.variables, sv = d.get(subj), seen = new Set();
    for (let i = 0; i < d.n; i++) { const k = JSON.stringify(cell(sv, i)); need(!seen.has(k), 'Long reshape requires unique subject IDs in wide data.'); seen.add(k); }
    const keep = d.names.filter(k => !vars.includes(k)), times = vars.map(v => ctx.packet.data[v].name), rows = [];
    vars.forEach((v, t) => { for (let i = 0; i < d.n; i++) rows.push([...keep.map(k => cell(d.get(k), i)), times[t], cell(d.get(v), i)]); });
    preview(ctx, d, [...keep, 'measurement', 'value'], rows); return;
  }
  // wide
  const subj = ctx.subject[0], tv = ctx.time[0], yv = ctx.y[0], seen = new Set();
  for (let i = 0; i < d.n; i++) { const k = JSON.stringify([cell(d.get(subj), i), cell(d.get(tv), i)]); need(!seen.has(k), 'Wide reshape requires unique subject × time.'); seen.add(k); }
  const times = [], ids = [], idRow = new Map(), vals = new Map();
  for (let i = 0; i < d.n; i++) {
    const t = cell(d.get(tv), i), s = cell(d.get(subj), i), tk = t === null ? 'NA' : typeof t === 'number' ? fmtR(t) : String(t), sk = JSON.stringify(s);
    if (!times.includes(tk)) times.push(tk); if (!idRow.has(sk)) { idRow.set(sk, ids.length); ids.push(s); }
    vals.set(sk + '|' + tk, cell(d.get(yv), i));
  }
  const rows = ids.map(s => [s, ...times.map(tk => { const v = vals.get(JSON.stringify(s) + '|' + tk); return v === undefined ? null : v; })]);
  preview(ctx, d, [subj, ...times.map(tk => yv + '.' + tk)], rows);
});
