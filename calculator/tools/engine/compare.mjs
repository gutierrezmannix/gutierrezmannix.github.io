// Compare the built-in engine with the R engine's reference outputs.
// Usage: node tools/engine/compare.mjs [case-name-substring ...]   (cases in tests/engine/cases)
// Each case may carry "compare" options in its packet file under "__compare":
//   { tol: 1e-6, abs: 1e-9, skipTables: [titles], signFree: [titles], unordered: [titles], softNotes: true, skipRows: [titles] }
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gmRun } from '../../src/engine/index.mjs';

const dir = new URL('../../tests/engine/cases/', import.meta.url);
const filters = process.argv.slice(2).filter(a => !a.startsWith('--')), verbose = process.argv.includes('--verbose');
const arr = v => v === null || v === undefined ? [] : Array.isArray(v) ? v : [v];

export function compareOne(name, packetJson, expected) {
  const cmp = packetJson.__compare || {}, packet = { ...packetJson }; delete packet.__compare;
  const tol = cmp.tol ?? 1e-6, abs = cmp.abs ?? 1e-9, problems = [], soft = [];
  let got; try { got = gmRun(packet); } catch (e) { return { problems: ['engine threw: ' + e.stack], soft }; }
  if ((expected.error || null) !== (got.error || null)) {
    problems.push('error differs: R=' + JSON.stringify(expected.error) + ' JS=' + JSON.stringify(got.error));
    return { problems, soft, got };
  }
  if (expected.error) return { problems, soft, got };
  for (const k of ['inputN', 'analysisN', 'excludedN']) if (expected[k] !== got[k] && !(cmp.skipCounts)) problems.push(k + ': R=' + expected[k] + ' JS=' + got[k]);
  const et = arr(expected.tables).filter(t => !(cmp.skipTables || []).includes(t.title)), gt = arr(got.tables).filter(t => !(cmp.skipTables || []).includes(t.title));
  const etitles = et.map(t => t.title), gtitles = gt.map(t => t.title);
  if (JSON.stringify(etitles) !== JSON.stringify(gtitles)) problems.push('table titles: R=' + JSON.stringify(etitles) + ' JS=' + JSON.stringify(gtitles));
  for (const e of et) {
    const g = gt.find(t => t.title === e.title); if (!g) continue;
    const ec = arr(e.columns).map(String), gc = arr(g.columns).map(String);
    if (JSON.stringify(ec) !== JSON.stringify(gc)) { problems.push('[' + e.title + '] columns: R=' + JSON.stringify(ec) + ' JS=' + JSON.stringify(gc)); continue; }
    if ((cmp.skipRows || []).includes(e.title)) continue;
    let er = arr(e.rows).map(arr), gr = arr(g.rows).map(arr);
    if (er.length !== gr.length) { problems.push('[' + e.title + '] rows: R=' + er.length + ' JS=' + gr.length); continue; }
    if ((cmp.unordered || []).includes(e.title)) { const key = r => JSON.stringify(r.map(v => typeof v === 'number' ? Number(v.toPrecision(6)) : v)); er = er.slice().sort((a, b) => key(a) < key(b) ? -1 : 1); gr = gr.slice().sort((a, b) => key(a) < key(b) ? -1 : 1); }
    const signFree = (cmp.signFree || []).includes(e.title), flips = new Map();
    if (signFree) ec.forEach((_, j) => { let dotv = 0; er.forEach((r, i) => { if (typeof r[j] === 'number' && typeof gr[i][j] === 'number') dotv += r[j] * gr[i][j]; }); flips.set(j, dotv < 0 ? -1 : 1); });
    let shown = 0;
    er.forEach((r, i) => r.forEach((v, j) => {
      let w = gr[i][j]; if (signFree && typeof w === 'number') w *= flips.get(j);
      const bad = (v === null || v === undefined) ? !(w === null || w === undefined) : typeof v === 'number' ? !(typeof w === 'number' && Math.abs(v - w) <= abs + tol * Math.max(Math.abs(v), Math.abs(w))) : typeof v === 'boolean' ? v !== w : String(v) !== String(w);
      if (bad && shown++ < 4) problems.push('[' + e.title + '] row ' + (i + 1) + ' col ' + ec[j] + ': R=' + JSON.stringify(v) + ' JS=' + JSON.stringify(gr[i][j]));
    }));
    if (shown > 4) problems.push('[' + e.title + '] … ' + (shown - 4) + ' more cell differences');
  }
  const en = arr(expected.notes).map(String), gn = arr(got.notes).map(String);
  if (JSON.stringify(en) !== JSON.stringify(gn)) (cmp.softNotes ? soft : problems).push('notes: R=' + JSON.stringify(en) + ' JS=' + JSON.stringify(gn));
  const ew = arr(expected.warnings).map(String), gw = arr(got.warnings).map(String);
  if (JSON.stringify(ew.slice().sort()) !== JSON.stringify(gw.slice().sort())) soft.push('warnings: R=' + JSON.stringify(ew) + ' JS=' + JSON.stringify(gw));
  const ep = arr(expected.plots).map(p => p.title), gp = arr(got.plots).map(p => p.title);
  if (JSON.stringify(ep) !== JSON.stringify(gp)) problems.push('plots: R=' + JSON.stringify(ep) + ' JS=' + JSON.stringify(gp));
  if (arr(expected.diagnostics).length && !arr(got.diagnostics).length) soft.push('diagnostics: R has output, JS has none');
  if (expected.outputData || got.outputData) {
    const eo = expected.outputData, go = got.outputData;
    if (!eo || !go) problems.push('outputData presence differs');
    else {
      if (JSON.stringify(arr(eo.names)) !== JSON.stringify(arr(go.names))) problems.push('outputData names: R=' + JSON.stringify(eo.names) + ' JS=' + JSON.stringify(go.names));
      const er = arr(eo.rows).map(arr), gr = arr(go.rows).map(arr);
      if (er.length !== gr.length) problems.push('outputData rows: R=' + er.length + ' JS=' + gr.length);
      else { let shown = 0; er.forEach((r, i) => r.forEach((v, j) => { const w = gr[i][j]; const bad = v === null ? w !== null : typeof v === 'number' ? !(typeof w === 'number' && Math.abs(v - w) <= abs + tol * Math.abs(v)) : String(v) !== String(w); if (bad && shown++ < 4) problems.push('outputData row ' + (i + 1) + ' col ' + (j + 1) + ': R=' + JSON.stringify(v) + ' JS=' + JSON.stringify(w)); })); }
    }
  }
  return { problems, soft, got };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const files = readdirSync(dir).filter(f => f.endsWith('.packet.json')).filter(f => !filters.length || filters.some(s => f.includes(s))).sort();
  let pass = 0, fail = 0, missing = 0;
  for (const f of files) {
    const name = f.replace('.packet.json', ''), expFile = new URL(name + '.expected.json', dir);
    if (!existsSync(expFile)) { missing++; console.log('NOREF ' + name); continue; }
    const p = JSON.parse(readFileSync(new URL(f, dir))), e = JSON.parse(readFileSync(expFile));
    const { problems, soft } = compareOne(name, p, e);
    if (problems.length) { fail++; console.log('FAIL  ' + name); for (const m of problems) console.log('      ' + m); }
    else { pass++; if (verbose || soft.length) console.log('PASS  ' + name + (soft.length ? '  (soft: ' + soft.join(' | ') + ')' : '')); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (missing ? ', ' + missing + ' without R reference' : ''));
  process.exitCode = fail ? 1 : 0;
}
