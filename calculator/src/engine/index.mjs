// Built-in statistical engine: runs every Tests-menu analysis in the browser with no internet and no R.
// gmRun(packet) returns the same result object the R engine (src/analysis-methods.R → gm_run) returned, so the
// page renders it unchanged. Each method family lives in methods/*.mjs and registers its ids here.
import { context, GMError, need } from './lib/frame.mjs';
import { RRNG } from './lib/rng.mjs';
import { rnum } from './lib/frame.mjs';
import { REGISTRY } from './registry.mjs';
import './methods/basic.mjs';
import './methods/anova.mjs';
import './methods/regression.mjs';
import './methods/multilevel.mjs';
import './methods/survival.mjs';
import './methods/scales.mjs';
import './methods/resampling.mjs';
import './methods/predictive.mjs';
import './methods/survey.mjs';
import './methods/data.mjs';

export const ENGINE_VERSION = 'GM26 built-in engine 1.0 (JavaScript; validated against R 4.3.3)';

const toCell = v => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v;
  return String(v);
};

export function gmRun(packet) {
  const ctx = context(packet);
  ctx.GMError = GMError;
  ctx.table = (title, columns, rows, totalRows = null) => {
    const cols = [].concat(columns).map(String);
    ctx.tables.push({ title, columns: cols, rows: rows.slice(0, 5000).map(r => [].concat(r).map(toCell)), totalRows: totalRows ?? rows.length });
  };
  ctx.plot = (title, svg) => { ctx.plots.push({ title, svg }); };
  let error = null;
  try {
    ctx.rng = new RRNG(ctx.num('seed', 1729, { min: 0, integer: true }));
    const handler = REGISTRY.get(ctx.id);
    need(!!handler, 'Unsupported analysis: ' + ctx.id);
    handler(ctx);
  } catch (e) {
    error = e instanceof GMError ? e.message : (e && e.message) ? e.message : String(e);
    if (!(e instanceof GMError) && typeof console !== 'undefined' && globalThis.GM_ENGINE_DEBUG) console.error(e);
  }
  let tables = ctx.tables, plots = ctx.plots, outputData = ctx.outputData;
  if (error !== null) { tables = []; plots = []; outputData = null; }
  const prio = t => t.title === 'Model summary' ? 0 : /Coefficients|coefficients/.test(t.title) ? 2 : 1;
  tables = tables.map((t, i) => [t, i]).sort((a, b) => prio(a[0]) - prio(b[0]) || a[1] - b[1]).map(x => x[0]);
  const labels = {}; for (const [k, c] of Object.entries(packet.data || {})) labels[k] = c.name; for (const [k, c] of Object.entries(packet.other || {})) if (!(k in labels)) labels[k] = c.name;
  const uniq = a => [...new Set(a.filter(v => v !== null && v !== undefined).map(String))];
  return {
    id: ctx.id, error, inputN: ctx.originalN, analysisN: ctx.used,
    excludedN: ctx.id === 'repeated' ? ctx.originalN - (ctx.repeatedRows ?? ctx.d.n) : Math.max(0, ctx.originalN - ctx.used),
    tables, plots, diagnostics: ctx.diagnostics.map(String), notes: uniq(ctx.notes), warnings: uniq(ctx.warnings), labels,
    outputData: outputData ? { names: outputData.names, rows: outputData.rows.map(r => r.map(toCell)) } : null,
    runtime: ENGINE_VERSION, packages: { engine: '1.0' },
  };
}
export { rnum };
