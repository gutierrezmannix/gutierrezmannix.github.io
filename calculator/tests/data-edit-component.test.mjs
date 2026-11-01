// Edit data (Design A) on the shipped bundle: node --test calculator/tests/data-edit-component.test.mjs
// Every task renders; each editing step changes exactly what it says, logs a command and can be undone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 };
let saved = null;
globalThis.document = { documentElement: { style: { zoom: '' } }, createElement: () => ({ click() {} }) };
URL.createObjectURL = b => { saved = b; return 'blob:x'; }; URL.revokeObjectURL = () => {};
const Component = new Function('DCLogic', code + ';return Component')(Base);
const buf = s => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
const tick = () => new Promise(r => setTimeout(r, 0));

// 60 people: party 0/1, senator 0/1, ideology, a name, an empty column and four 1–5 survey items (q3 worded the other way)
let seed = 11; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const rows = ['id,democrat,senator,ideology,name,blank,q1,q2,q3,q4'];
for (let i = 0; i < 60; i++) {
  const t = rnd() * 4, it = k => Math.max(1, Math.min(5, Math.round(1 + t + (rnd() - 0.5) * 1.6 + k * 0)));
  rows.push([i + 1, i % 3 ? 1 : 0, i % 7 === 0 ? 1 : 0, (rnd() * 2 - 1).toFixed(3), 'P' + i, '', it(0), it(1), 6 - it(2), i === 5 ? '' : it(3)].join(','));
}
async function make() {
  const c = new Component(); c._E = E; c._engineP = Promise.resolve(E); c._svgs = {};
  const raw = await E.parseCSV(buf(rows.join('\n')), () => {});
  c._raw = raw; c.state = { ...c.state, screen: 'work', tab: 'data', fileName: 'people.csv', cols: raw.names.map((_, i) => Object.assign(E.profileCol(raw, i), { idx: i })), nRows: raw.n, autoScreen: false, genTags: {}, treat: {} };
  c.pushLog = d => c.setState(s => ({ conLog: [...(s.conLog || []), d] })); c.flash = t => { c.message = t; };
  return c;
}
const col = (c, v) => c._raw.cols[c._raw.names.indexOf(v)];
const lastCmd = c => { const d = c.state.conLog[c.state.conLog.length - 1]; return c.cmdText(d, 'stata'); };

test('five tasks render; no overlapping panels', async () => {
  const c = await make();
  for (const task of ['var', 'new', 'scale', 'rows', 'cols']) { c.deSet({ task }); const s = text(c.deRender()); assert.ok(s.length > 100, task); assert.match(s, /Save data as CSV/); }
  c.deSet({ task: 'var' }); assert.match(text(c.deRender()), /pick the variable/);
  c.dePickVar('ideology'); const s = text(c.deRender());
  for (const t of ['Name, description and type', 'Stored as', 'Analysed as', 'Group into ranges', 'Only where', 'Delete variable']) assert.ok(s.includes(t), t);
  assert.ok(!/One value at a time/.test(s), 'one-at-a-time recoding is not offered for 60 different values');
  c.dePickVar('democrat'); const s2 = text(c.deRender()); assert.match(s2, /One value at a time/); assert.match(s2, /Value labels/);
  // the model guide opens the scale task once
  c.setState({ deTask: 'scale' }); assert.equal(c.deS().task, 'scale'); c.deSet({ task: 'rows' }); assert.equal(c.deS().task, 'rows'); assert.equal(c.state.deTask, '');
});

test('new variable, then replace … if with a live count; bad formulas leave no empty undo step', async () => {
  const c = await make();
  c.setState({ nvName: 'dem_sen', nvType: 'num', nvStart: '0' }); c.doNewVar();
  assert.equal(c.state.nvCur, 'dem_sen'); assert.ok(Array.from(col(c, 'dem_sen').a).every(x => x === 0));
  c.setState({ rpVal: '1', rpConds: [{ v: 'democrat', op: '==', val: '1' }, { v: 'senator', op: '==', val: '1' }] });
  c.deSet({ task: 'new' }); const want = rows.slice(1).map(r => r.split(',')).filter(r => r[1] === '1' && r[2] === '1').length;
  assert.match(text(c.deRender()), new RegExp(want + ' of 60 rows match'));
  c.doReplace(); assert.equal(Array.from(col(c, 'dem_sen').a).filter(x => x === 1).length, want);
  assert.match(lastCmd(c), /^replace dem_sen = 1 if democrat == 1 & senator == 1$/);
  const n0 = c._undo.length; c.setState({ rpVal: 'nonsense +' }); c.doReplace(); assert.ok(c.state.rpErr); assert.equal(c._undo.length, n0, 'no empty undo step');
  // no condition: the count says every row will change
  c.setState({ rpVal: '2', rpConds: [{ v: '', op: '==', val: '' }], rpErr: '' }); assert.match(text(c.deRender()), /all 60 rows will change/);
  // an unfinished condition blocks the replace
  c.setState({ rpConds: [{ v: 'democrat', op: '==', val: '' }] }); assert.match(text(c.deRender()), /Finish the condition on democrat/);
  // formula start
  c.setState({ nvName: 'ideo10', nvType: 'num', nvStart: 'other', nvOther: 'ideology * 10' }); c.doNewVar();
  assert.ok(Math.abs(col(c, 'ideo10').a[0] - 10 * col(c, 'ideology').a[0]) < 1e-9);
});

test('recode: words on a number variable become value labels (or text); failed recodes leave no undo step', async () => {
  const c = await make(); c.dePickVar('democrat');
  const n0 = (c._undo || []).length; c.setState({ bcMap: { 0: 'Rep', 1: 'Dem' } }); c.recodeCol('democrat');
  assert.match(c.state.bcErr, /value label/); assert.equal((c._undo || []).length, n0, 'no empty undo step');
  assert.match(text(c.deRender()), /Keep the numbers and show the words as labels/);
  const before = Array.from(col(c, 'democrat').a);
  c.deWordsToLabels('democrat', [['0', 'Rep'], ['1', 'Dem']]);
  assert.deepEqual(Array.from(col(c, 'democrat').a), before, 'numbers unchanged');
  assert.equal(c.vlabel('democrat', '1'), 'Dem'); assert.equal(c.vlabel('democrat', '0'), 'Rep');
  assert.ok(c.state.conLog.some(d => /label define democrat_lb 0 "Rep" 1 "Dem"/.test(d.stata || '')));
  // renaming keeps the labels and the READ AS choice
  c.deSetTreat('democrat', 'numeric'); c._deRn = 'party'; c.deRename('democrat');
  assert.ok(c._raw.names.includes('party')); assert.equal(c.vlabel('party', '1'), 'Dem'); assert.equal(c.state.treat.party, 'numeric'); assert.equal(c.deS().v, 'party');
  // words → text
  c.dePickVar('senator'); c.setState({ bcMap: { 0: 'House', 1: 'Senate' } }); c.deWordsToText('senator');
  assert.equal(col(c, 'senator').k, 's'); assert.equal(col(c, 'senator').a[0], 'Senate'); assert.equal(col(c, 'senator').a[1], 'House');
  // undo brings the numbers back
  c.undo(); c.undo(); assert.equal(col(c, 'senator').k, 'n');
  // value labels task
  c.dePickVar('q1'); c.deSet({ vl: { __v: 'q1', 1: 'Strongly disagree', 5: 'Strongly agree' } }); c.deApplyLabels('q1');
  assert.equal(c.vlabel('q1', '5'), 'Strongly agree'); c.deApplyLabels('q1', true); assert.equal(c.vlabel('q1', '5'), '5');
});

test('group into ranges: quartiles stored as 1–4 with labels, as the Stata command says', async () => {
  const c = await make(); c.dePickVar('ideology');
  c.deGroupFill('ideology', 4); assert.equal(c.state.rcRows.length, 4); assert.equal(c.state.rcRows[3].l, 'Q4 (highest)');
  c.doRecode(); const nm = c._raw.names.find(n => /^ideology_/.test(n)); assert.ok(nm, 'new variable');
  const a = Array.from(col(c, nm).a); assert.equal(col(c, nm).k, 'n');
  const cnt = [1, 2, 3, 4].map(k => a.filter(x => x === k).length); assert.equal(cnt.reduce((p, q) => p + q), 60); assert.ok(cnt.every(k => k >= 13 && k <= 17), 'about 15 each: ' + cnt);
  assert.equal(c.vlabel(nm, '1'), 'Q1 (lowest)');
  assert.match(lastCmd(c), /^recode ideology \(-?[\d.]+\/-?[\d.]+=1 "Q1 \(lowest\)"\).* \(else=\.\), gen\(ideology_q4\)$/);
  // numbers as labels become the codes themselves
  c.setState({ rcVar: 'q1', rcName: 'q1_bin', rcRows: [{ f: '1', t: '3', l: '0' }, { f: '4', t: '5', l: '1' }] }); c.doRecode();
  assert.deepEqual([...new Set(Array.from(col(c, 'q1_bin').a))].sort(), [0, 1]); assert.ok(!(c._raw.vlabs && c._raw.vlabs.q1_bin));
});

test('make a scale: alpha (with a reversed item) equals the textbook formula; the scale score is the item mean', async () => {
  const c = await make(); c.deSet({ task: 'scale' });
  c.deScaleSet(['q1', 'q2', 'q3', 'q4'], ['q3']); await tick();
  const R = c.state.crRes; assert.ok(R, c.state.crErr);
  const X = rows.slice(1).map(r => r.split(',')).filter(r => r[9] !== '').map(r => [+r[6], +r[7], 6 - +r[8], +r[9]]);
  const v = a => { const m = a.reduce((p, q) => p + q) / a.length; return a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1); };
  const k = 4, alpha = k / (k - 1) * (1 - [0, 1, 2, 3].map(j => v(X.map(r => r[j]))).reduce((p, q) => p + q) / v(X.map(r => r[0] + r[1] + r[2] + r[3])));
  assert.ok(Math.abs(R.alpha - alpha) < 1e-9, R.alpha + ' vs ' + alpha); assert.equal(R.n, 59);
  assert.ok(R.rest.every(r => r > 0.3), 'reversed item now agrees with the others');
  assert.match(c.cmdText(c.state.conLog[c.state.conLog.length - 1], 'stata'), /^alpha q1 q2 q3 q4, reverse\(q3\) item$/);
  const s = text(c.deRender()); assert.match(s, /Cronbach’s alpha/); assert.match(s, /hang together/);
  // without reversing, q3 goes against the others
  c.deScaleSet(['q1', 'q2', 'q3', 'q4'], []); await tick(); assert.match(text(c.deRender()), /q3 goes against the others/);
  c.deScaleSet(['q1', 'q2', 'q3', 'q4'], ['q3']); await tick();
  c.deSet({ scaleName: 'trust', scaleHow: 'mean' }); c.deMakeScale();
  const t = col(c, 'trust').a, r0 = rows[1].split(','); assert.ok(Math.abs(t[0] - (+r0[6] + +r0[7] + (6 - +r0[8]) + +r0[9]) / 4) < 1e-12); assert.ok(isNaN(t[5]), 'missing item → missing score');
  assert.match(lastCmd(c), /^generate trust = \(q1 \+ q2 \+ \(\d+ - q3\) \+ q4\) \/ 4$/);
});

test('rows: one subgroup for every tab; hidden variables are left out of the CSV only on purpose', async () => {
  const c = await make(); c.deSet({ task: 'rows' });
  c.deKeepRows('senator', { t: 'in', vals: ['1'] }); assert.equal(c.deKept(), rows.slice(1).filter(r => r.split(',')[2] === '1').length);
  assert.deepEqual(c.state.subg.all.map(x => x.v), ['senator']); assert.match(text(c.deRender()), /Analyses and charts use \d+ of 60 rows/);
  c.setState({ flt: { v: 'democrat', op: '==', val: '1', on: true, cat: true } }); assert.match(text(c.deRender()), /democrat == 1/);
  c.clearFilter(); c.setState(s => ({ subg: { ...s.subg, all: [] } })); assert.equal(c.deKept(), 60);
  c.deKeepRows('ideology', { t: 'rng', lo: '0', hi: '' }); assert.equal(c.deKept(), Array.from(col(c, 'ideology').a).filter(x => x >= 0).length);
  c.addRows(10); assert.equal(c._raw.n, 70);
  // show / hide
  c.deSet({ task: 'cols' }); assert.match(text(c.deRender()), /Hide the 1 empty variable/);
  c.deHide(['blank']); assert.deepEqual(c.state.hiddenVars, ['blank']);
  c.saveCsv(); let csv = await saved.text(); assert.ok(!csv.split('\n')[0].includes('blank')); assert.match(c.state.undoMsg, /1 hidden left out/);
  c.saveCsv(true); csv = await saved.text(); assert.ok(csv.split('\n')[0].split(',').includes('blank')); assert.equal(csv.split('\n').length, 71);
  c.deToggleHide('blank'); assert.deepEqual(c.state.hiddenVars, []);
});

test('change a variable: description, type, delete with confirmation', async () => {
  const c = await make(); c.dePickVar('ideology');
  c.deSetLabel('ideology', 'Left–right score'); assert.equal(c._raw.labels[c._raw.names.indexOf('ideology')], 'Left–right score'); assert.equal(c.state.cols.find(m => m.name === 'ideology').label, 'Left–right score');
  c.retypeCol('ideology', true); assert.equal(col(c, 'ideology').k, 's'); c.retypeCol('ideology', false); assert.equal(col(c, 'ideology').k, 'n');
  c.deDelete('ideology'); assert.ok(c._raw.names.includes('ideology'), 'first click only arms');
  assert.match(text(c.deRender()), /Click again to delete ideology/);
  c.deDelete('ideology'); assert.ok(!c._raw.names.includes('ideology')); assert.equal(c.deS().v, '');
  c.undo(); assert.ok(c._raw.names.includes('ideology'));
});
