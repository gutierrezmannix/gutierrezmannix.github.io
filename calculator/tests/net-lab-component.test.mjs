// Networks tab (Design A) on the shipped bundle: node --test calculator/tests/net-lab-component.test.mjs
// Renders all eight steps with a stubbed React, fits the MCMC model from the Ties step, adds measures to the dataset.
// Optional: GM26_NET_FILES="edges.csv,nodes.csv" also walks a real NodeXL export.
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
globalThis.document = { documentElement: { style: { zoom: '' } } };
const Component = new Function('DCLogic', code + ';return Component')(Base);
const buf = s => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);
const find = (n, pred, out = []) => { if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { n.forEach(x => find(x, pred, out)); return out; } if (pred(n)) out.push(n); find(n.children, pred, out); return out; };
const tick = () => new Promise(r => setTimeout(r, 0));
async function settle(c, f, rounds = 400) { let t = f(); for (let i = 0; i < rounds && find(t, n => n.props && n.props.className === 'tl-pending').length; i++) { await tick(); t = f(); } return t; }

// a NodeXL-like export: 30 legislators, two parties, mentions/retweets, weights, dates, one self-tie each
let seed = 5; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const ppl = Array.from({ length: 30 }, (_, i) => ({ id: 'rep' + i, name: (i % 7 === 0 ? 'Senator ' : 'Rep. ') + 'Member ' + i, party: i < 20 ? 1 : 0, senator: i % 7 === 0 ? 1 : 0, ideo: (i < 20 ? -0.4 : 0.4) + (i % 5) / 20 }));
const erows = ['Vertex 1,Vertex 2,Relationship,Edge Weight,Relationship Date (UTC),Color'];
for (const a of ppl) { erows.push(a.id + ',' + a.id + ',Tweet,1,01/02/2020 10:00,'); for (const b of ppl) { if (a === b) continue; const p = a.party === b.party ? 0.22 : 0.05; if (rnd() < p) erows.push(a.id + ',' + b.id + ',' + (rnd() < 0.7 ? 'Mentions' : 'Retweet') + ',' + (1 + Math.floor(rnd() * 6)) + ',' + String(1 + Math.floor(rnd() * 27)).padStart(2, '0') + '/0' + (1 + Math.floor(rnd() * 9)) + '/20' + (19 + Math.floor(rnd() * 3)) + ' 12:00,'); } }
const nrows = ['Vertex,Name,democrat,senator,ideology,X,Y,In-Degree'].concat(ppl.map(p => [p.id, p.name, p.party, p.senator, p.ideo.toFixed(3), '', '', ''].join(',')));

async function make() {
  const c = new Component(); c._E = E; c._engineP = Promise.resolve(E); c._svgs = {};
  const raw = await E.parseCSV(buf(nrows.join('\n')), () => {});
  c._raw = raw; c.state = { ...c.state, screen: 'work', tab: 'ergm', fileName: 'nodes.csv', cols: raw.names.map((_, i) => E.profileCol(raw, i)), nRows: raw.n, autoScreen: false, genTags: {}, treat: {} };
  c.pushLog = d => c.setState(s => ({ conLog: [...(s.conLog || []), d] })); c.flash = t => { c.message = t; };
  return c;
}

test('all eight steps render; MCMC model from the Ties step; measures added to the dataset', async () => {
  const c = await make();
  assert.match(text(c.nlRender()), /Load ties file/);
  c.nlTake('e', await E.parseCSV(buf(erows.join('\n')), () => {}), 'edges.csv');
  c.nlUseCurrent('n');
  const o = c.nlS();
  assert.equal(o.from, 'Vertex 1'); assert.equal(o.weight, 'Edge Weight'); assert.equal(o.id, 'Vertex'); assert.equal(o.label, 'Name');
  let t = text(c.nlRender());
  assert.match(t, /NodeXL export recognised/); assert.match(t, /Member 0/); assert.ok(!/Senator Member 0|Rep\. Member 1 /.test(t), 'labels shortened (Senator/Rep. dropped)'); assert.match(t, /30 removed|self-ties/);
  assert.ok(!/✓ X ·|✓ Y ·|✓ In-Degree/.test(t) && /other columns hidden/.test(t), 'NodeXL display columns are hidden, not offered');
  for (const step of ['overview', 'map', 'people', 'groups', 'ties', 'time', 'save']) {
    c.nlSet({ step }); const tree = await settle(c, () => c.nlRender()); const s = text(tree);
    assert.ok(s.length > 200, step);
    if (step === 'overview') { assert.match(s, /density/); assert.match(s, /Triads vs chance/); }
    if (step === 'map') { const circles = find(tree, n => n.tag === 'circle'); assert.ok(circles.length >= 30, 'a dot per person'); const labels = find(tree, n => n.tag === 'text' && /Member/.test(text(n))); assert.ok(labels.length >= 6, 'labels drawn'); }
    if (step === 'people') { assert.match(s, /Who are the bridges/); assert.match(s, /Do the measures agree/); }
    if (step === 'groups') assert.match(s, /modularity Q/);
    if (step === 'ties') { assert.match(s, /Birds of a feather/); assert.match(s, /ties within/); assert.match(s, /Why do ties form/); }
    if (step === 'time') assert.match(s, /Ties per year/);
    if (step === 'save') { assert.match(s, /library\(ergm\)/); assert.match(s, /Add \d+ columns to nodes\.csv/); }
  }
  // model: returned ties + friends of friends + same party, run by MCMC
  c.nlSet({ step: 'ties' }); c.nlSetIn('ties', { model: [{ t: 'mutual' }, { t: 'gwesp' }, { t: 'nodematch', a: 'democrat' }] });
  let tree = c.nlRender(); find(tree, n => n.tag === 'button' && /Run/.test(text(n)))[0].props.onClick();
  tree = await settle(c, () => c.nlRender(), 4000); t = text(tree);
  assert.match(t, /Converged|Not converged/, t.slice(t.indexOf('Why do ties form'), t.indexOf('Why do ties form') + 900)); assert.match(t, /Same democrat/); assert.match(t, /Ties received\s+— (fits well|\d+ of)/); assert.match(t, /plot\(gof\(fit\)\)/);
  // a reason with missing values gives a fix button
  c.nlSetIn('ties', { model: [{ t: 'absdiff', a: 'ideology' }] }); c.state.nl.attrs = null;
  // save: add the measures to the current dataset (matched by Vertex)
  c.nlSet({ step: 'save' }); tree = await settle(c, () => c.nlRender());
  find(tree, n => n.tag === 'button' && /^\+ Add \d+ columns/.test(text(n)))[0].props.onClick();
  assert.ok(c._raw.names.includes('sna_betweenness') && c._raw.names.includes('sna_group'));
  const bi = c._raw.names.indexOf('sna_indegree'); assert.ok(Array.from(c._raw.cols[bi].a).every(Number.isFinite));
});

test('real NodeXL files walk through every step (optional)', { skip: !process.env.GM26_NET_FILES }, async () => {
  const [ef, nf] = process.env.GM26_NET_FILES.split(',');
  const c = await make(); const rd = f => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
  c.nlTake('e', await E.parseCSV(rd(ef), () => {}), ef.split('/').pop()); c.nlTake('n', await E.parseCSV(rd(nf), () => {}), nf.split('/').pop());
  for (const step of ['overview', 'map', 'people', 'groups', 'ties', 'time', 'save']) { c.nlSet({ step }); const s = text(await settle(c, () => c.nlRender(), 2000)); assert.ok(s.length > 200, step); }
});
