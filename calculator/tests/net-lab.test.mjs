// Networks (Design A) engine on the shipped bundle: node --test calculator/tests/net-lab.test.mjs
// Validates the MCMC ERGM without R: statistics tracked by the sampler equal brute-force statistics; models without dyad
// dependence give the exact maximum likelihood (= MPLE); known parameters are recovered from simulated networks.
// Also: triad census against a direct classification, k-cores, Burt's constraint, Louvain, homophily, NodeXL import.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const run = g => { let r; while (!(r = g.next()).done); return r.value; };
const buf = s => { const b = Buffer.from(s); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

function randomNet(n, p, directed, seed, attrs = true) {
  const rnd = E.nlRng(seed), edges = [];
  for (let i = 0; i < n; i++) for (let j = directed ? 0 : i + 1; j < n; j++) if (i !== j && rnd() < p) edges.push([i, j, 1, '']);
  return mk(n, edges, directed, attrs ? { grp: Array.from({ length: n }, (_, i) => String(i % 3)), x: Array.from({ length: n }, (_, i) => (i * 37 % 11) / 4) } : {});
}
function mk(n, edges, directed, at = {}) {
  const out = Array.from({ length: n }, () => new Set()), inn = out.map(() => new Set()), und = out.map(() => new Set()), wout = out.map(() => new Map()), win = out.map(() => new Map());
  for (const [i, j, w] of edges) { out[i].add(j); inn[j].add(i); und[i].add(j); und[j].add(i); wout[i].set(j, w); win[j].set(i, w); if (!directed) { out[j].add(i); inn[i].add(j); wout[j].set(i, w); win[i].set(j, w); } }
  const attrs = {}; for (const [k, v] of Object.entries(at)) attrs[k] = typeof v[0] === 'number' ? { kind: 'num', v: v.map(String), x: Float64Array.from(v), levels: [] } : { kind: 'cat', v, x: Float64Array.from(v, Number), levels: [...new Set(v)].sort() };
  return { n, ids: Array.from({ length: n }, (_, i) => 'v' + i), labels: Array.from({ length: n }, (_, i) => 'v' + i), directed, out, inn, und, wout, win, edges, attrs, weighted: false, types: [] };
}
// brute-force statistics from an edge list
function stats(n, directed, edgeList, terms, attrs) {
  const A = new Set(edgeList.map(([i, j]) => directed ? i * n + j : Math.min(i, j) * n + Math.max(i, j))), has = (i, j) => A.has(directed ? i * n + j : Math.min(i, j) * n + Math.max(i, j));
  const arcs = [...A].map(k => [Math.floor(k / n), k % n]);
  return terms.map(t => {
    const a = t.a !== undefined ? attrs[t.a] : null, r = t.decay !== undefined ? 1 - Math.exp(-t.decay) : 0, ea = Math.exp(t.decay || 0);
    switch (t.t) {
      case 'edges': return arcs.length;
      case 'mutual': return arcs.filter(([i, j]) => i < j && has(j, i)).length;
      case 'gwesp': return arcs.reduce((s, [i, j]) => { let L = 0; for (let k = 0; k < n; k++) if (k !== i && k !== j && (directed ? has(i, k) && has(k, j) : has(i, k) && has(j, k))) L++; return s + ea * (1 - Math.pow(r, L)); }, 0);
      case 'gwideg': case 'gwodeg': case 'gwdeg': { let s = 0; for (let v = 0; v < n; v++) { let d = 0; for (let w = 0; w < n; w++) if (w !== v && (t.t === 'gwideg' ? has(w, v) : t.t === 'gwodeg' ? has(v, w) : has(v, w))) d++; s += ea * (1 - Math.pow(r, d)); } return s; }
      case 'nodematch': return arcs.filter(([i, j]) => a.v[i] === a.v[j]).length;
      case 'nodecov': return arcs.reduce((s, [i, j]) => s + a.x[i] + a.x[j], 0);
      case 'nodeicov': return arcs.reduce((s, [i, j]) => s + a.x[j], 0);
      case 'nodeocov': return arcs.reduce((s, [i, j]) => s + a.x[i], 0);
      case 'absdiff': return arcs.reduce((s, [i, j]) => s + Math.abs(a.x[i] - a.x[j]), 0);
    }
  });
}

test('sampler keeps every statistic equal to a brute-force recount (directed and undirected)', () => {
  for (const directed of [true, false]) {
    const net = randomNet(13, 0.25, directed, directed ? 3 : 4);
    const spec = directed ? [{ t: 'mutual' }, { t: 'gwesp' }, { t: 'gwideg' }, { t: 'gwodeg' }, { t: 'nodematch', a: 'grp' }, { t: 'nodeicov', a: 'x' }, { t: 'nodeocov', a: 'x' }, { t: 'absdiff', a: 'x' }]
      : [{ t: 'gwesp', decay: 0.7 }, { t: 'gwdeg' }, { t: 'nodematch', a: 'grp' }, { t: 'nodecov', a: 'x' }, { t: 'absdiff', a: 'x' }];
    const chk = E.nlErgmCheck(net, spec); assert.equal(chk.error, undefined);
    const theta = chk.terms.map((t, k) => k === 0 ? -1.2 : 0.3 * ((k % 3) - 1));
    const sim = run(E.nlSimulate(net, chk.terms, theta, { nsim: 60, interval: 37, burnin: 50, keep: true, fromObserved: true, seed: 5 }));
    sim.nets.forEach((edges, s) => { const bf = stats(net.n, directed, edges, chk.terms, net.attrs); bf.forEach((v, k) => assert.ok(Math.abs(v - sim.stats[s][k]) < 1e-8, (directed ? 'directed ' : 'undirected ') + chk.terms[k].t + ' sample ' + s + ': ' + v + ' vs ' + sim.stats[s][k])); });
  }
});

test('edges-only simulation matches the binomial expectation', () => {
  const net = randomNet(30, 0.1, true, 9), D = 30 * 29, th = -1.5, sim = run(E.nlSimulate(net, [{ t: 'edges' }], [th], { nsim: 400, interval: 600, seed: 11 }));
  const m = sim.stats.reduce((s, g) => s + g[0], 0) / sim.stats.length, expct = D / (1 + Math.exp(-th));
  assert.ok(Math.abs(m - expct) < 0.03 * expct, 'mean edges ' + m + ' vs ' + expct);
});

test('models without dyad dependence: MCMC estimate = exact MLE (MPLE)', () => {
  const net = randomNet(40, 0.12, false, 21);
  const r = run(E.nlErgm(net, [{ t: 'nodematch', a: 'grp' }, { t: 'absdiff', a: 'x' }], { gof: false, seed: 3 }));
  assert.equal(r.error, undefined, r.error); assert.ok(r.converged, r.warning);
  r.coefs.forEach((c, k) => { assert.ok(Math.abs(c.b - r.mple.coef[k]) < 0.06 + 0.25 * r.mple.se[k], c.term + ': MCMC ' + c.b + ' vs MLE ' + r.mple.coef[k]); assert.ok(Math.abs(c.se / r.mple.se[k] - 1) < 0.25, c.term + ' SE ' + c.se + ' vs ' + r.mple.se[k]); });
});

test('known parameters are recovered from simulated networks (reciprocity, shared partners, homophily)', () => {
  const base = randomNet(36, 0.05, true, 31), truth = [-3.0, 1.6, 0.35, 0.9];
  const chk = E.nlErgmCheck(base, [{ t: 'mutual' }, { t: 'gwesp' }, { t: 'nodematch', a: 'grp' }]);
  const sim = run(E.nlSimulate(base, chk.terms, truth, { nsim: 1, interval: 1, burnin: 60000, keep: true, seed: 77 }));
  const net = mk(36, sim.nets[0].map(([i, j]) => [i, j, 1, '']), true, { grp: base.attrs.grp.v, x: Array.from(base.attrs.x.x) });
  const r = run(E.nlErgm(net, [{ t: 'mutual' }, { t: 'gwesp' }, { t: 'nodematch', a: 'grp' }], { gof: false, seed: 4 }));
  assert.equal(r.error, undefined, r.error);
  r.coefs.forEach((c, k) => assert.ok(Math.abs(c.b - truth[k]) < 3 * c.se + 0.05, c.term + ': ' + c.b.toFixed(3) + ' ± ' + c.se.toFixed(3) + ' vs truth ' + truth[k]));
  assert.ok(r.gobs.length === 4 && r.tratio.every(t => Math.abs(t) < 0.3));
});

test('plain messages when a model cannot be estimated', () => {
  const net = randomNet(20, 0.15, true, 41);
  // every tie within the same group -> infinite estimate
  const same = mk(6, [[0, 1, 1], [1, 0, 1], [2, 3, 1], [4, 5, 1]], true, { g: ['a', 'a', 'b', 'b', 'c', 'c'] });
  assert.match(run(E.nlErgm(same, [{ t: 'nodematch', a: 'g' }], { gof: false })).error, /Every tie connects people with the same “g”/);
  const miss = mk(4, [[0, 1, 1], [2, 3, 1]], true, { g: ['a', null, 'b', 'b'] });
  const m = run(E.nlErgm(miss, [{ t: 'nodematch', a: 'g' }], { gof: false })); assert.equal(m.kind, 'missing'); assert.match(m.error, /1 person has no “g” value/);
  assert.match(run(E.nlErgm(mk(5, [[0, 1, 1], [2, 3, 1]], false), [{ t: 'mutual' }], { gof: false })).error, /needs ties with a direction/);
  const r = run(E.nlErgm(net, [{ t: 'mutual' }], { gof: true, gofSims: 20 }));
  assert.ok(r.gof && r.gof.idegree.length && r.gof.distance.length && r.gof.espartners.length, 'goodness of fit tables');
});

test('triad census matches a direct classification of every triad', () => {
  const name = (has, a, b, c) => {
    const m = (has(a, b) && has(b, a)) + (has(a, c) && has(c, a)) + (has(b, c) && has(c, b)), as = (has(a, b) !== has(b, a)) + (has(a, c) !== has(c, a)) + (has(b, c) !== has(c, b)), k = '' + m + as + (3 - m - as);
    const od = {}, id = {}; for (const x of [a, b, c]) { od[x] = 0; id[x] = 0; } for (const [x, y] of [[a, b], [b, a], [a, c], [c, a], [b, c], [c, b]]) if (has(x, y) && !has(y, x)) { od[x]++; id[y]++; }
    const mo = x => [a, b, c].filter(y => y !== x).filter(y => has(x, y) && has(y, x)).length;
    if (k === '021') return k + (Math.max(...Object.values(od)) === 2 ? 'D' : Math.max(...Object.values(id)) === 2 ? 'U' : 'C');
    if (k === '111') { const third = [a, b, c].find(x => mo(x) === 0); return k + (od[third] === 0 ? 'U' : 'D'); }
    if (k === '030') return k + (Math.max(...Object.values(od)) === 2 ? 'T' : 'C');
    if (k === '120') { const third = [a, b, c].find(x => mo(x) === 0); return k + (od[third] === 2 ? 'D' : id[third] === 2 ? 'U' : 'C'); }
    return k;
  };
  for (const seed of [1, 2, 3]) {
    const net = randomNet(14, 0.3, true, seed, false), c = E.nlTriadCensus(net), bf = Object.fromEntries(E.NL_TRIADS.map(t => [t, 0])), has = (x, y) => net.out[x].has(y);
    for (let a = 0; a < 14; a++) for (let b = a + 1; b < 14; b++) for (let d = b + 1; d < 14; d++) bf[name(has, a, b, d)]++;
    assert.deepEqual(c, E.NL_TRIADS.map(t => bf[t]), 'seed ' + seed);
  }
});

test('k-cores, Burt constraint, effective size, Louvain groups and homophily', () => {
  const star = mk(5, [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], false), M = E.nlNodeMeasures(star);
  assert.ok(Math.abs(M.constraint[0] - 0.25) < 1e-12 && Math.abs(M.constraint[1] - 1) < 1e-12, 'star: centre 1/k, leaves 1');
  assert.equal(M.effsize[0], 4); assert.deepEqual(Array.from(E.nlCoreness(star)), [1, 1, 1, 1, 1]);
  const two = []; for (const off of [0, 5]) for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) two.push([off + i, off + j, 1]); two.push([4, 5, 1]);
  const net = mk(10, two, false, { side: ['L', 'L', 'L', 'L', 'L', 'R', 'R', 'R', 'R', 'R'] });
  assert.deepEqual(Array.from(E.nlCoreness(net)), [4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  const L = E.nlLouvain(net); assert.deepEqual(L.sizes, [5, 5]); assert.ok(L.member[0] !== L.member[9]);
  assert.ok(Math.abs(L.Q - (20 / 21 - 0.5)) < 0.01, 'modularity ' + L.Q);
  const mix = run(E.nlMixing(net, 'side', 200)); assert.equal(mix.within, 20 / 21); assert.ok(mix.pMore < 0.05); assert.ok(Math.abs(mix.ei - (1 - 20) / 21) < 1e-12);
  const S = E.nlSummary(net); assert.equal(S.m, 21); assert.equal(S.components, 1); assert.equal(S.diameter, 3);
  const cl = E.nlCliques(net); assert.equal(cl.cliques[0].length, 5); assert.equal(cl.cliques.length, 2, "two 5-cliques (the bridge is only a pair)");
});

test('NodeXL import: columns guessed, self-ties removed, tie types and two-way ties, labels shortened', async () => {
  const edges = 'Vertex 1,Vertex 2,Relationship,Edge Weight,Relationship Date (UTC),Color\na,b,Alliance,1,2020-01-02,\nb,a,Alliance,1,2020-01-02,\na,c,Subgroup,3,2021-05-05,\nc,c,Tweet,1,2021-01-01,\nd,b,Alliance,2,2019-03-03,\n';
  const nodes = 'Vertex,Name,party,score,X,Image File\na,Rep. Ana López,1,0.5,,\nb,Senator Bob Díaz,0,.,,\nc,Office of Cy,1,0.2,,\nd,Dee,1,0.9,,\ne,Lonely,0,0.1,,\n';
  const er = await E.parseCSV(buf(edges), () => {}), nr = await E.parseCSV(buf(nodes), () => {});
  const g = E.nlGuess(er, nr);
  assert.equal(g.from, 'Vertex 1'); assert.equal(g.to, 'Vertex 2'); assert.equal(g.weight, 'Edge Weight'); assert.equal(g.type, 'Relationship'); assert.equal(g.id, 'Vertex'); assert.equal(g.label, 'Name');
  assert.deepEqual(g.attrs, ['party', 'score']);
  const b = E.nlBuild(er, nr, Object.assign({}, g, { directed: true, short: true, twoWay: { Alliance: true } }));
  assert.equal(b.info.self, 1); assert.equal(b.net.n, 5); assert.equal(b.info.isolates, 1);
  assert.deepEqual(b.net.labels, ['Ana López', 'Bob Díaz', 'Cy', 'Dee', 'Lonely']);
  assert.ok(b.net.out[3].has(1) && b.net.out[1].has(3), 'two-way alliance d<->b'); assert.equal(b.net.wout[0].get(2), 3);
  assert.ok(b.info.typeRecip.Alliance > 0.6); assert.equal(b.net.attrs.score.missing, 1);
  const y = E.nlBuild(er, nr, Object.assign({}, g, { directed: true, y0: 2021, y1: 2021 })); assert.equal(y.net.edges.length, 1);
  const k = E.nlBuild(er, nr, Object.assign({}, g, { directed: true, keep: { Subgroup: false } })); assert.ok(!k.net.out[0].has(2));
});

test('why a model did not converge: the effect or characteristic to blame, in plain words', () => {
  // a sparse network of 40 people: a chain plus one triangle, so few ties share a contact
  const edges = []; for (let i = 0; i < 39; i++) edges.push([i, i + 1, 1, '']); edges.push([0, 2, 1, '']);
  const grp = Array.from({ length: 40 }, (_, i) => i < 2 ? 'tiny' : i % 2 ? 'a' : 'b'), x = Array.from({ length: 40 }, (_, i) => i === 39 ? 1000 : i % 5);
  const net = mk(40, edges, false, { grp, x, side: Array.from({ length: 40 }, (_, i) => i % 2 ? 'left' : 'right') });
  const base = { samplesize: 512, mple: { converged: true, coef: [-3, 0.5, 0.2], se: [0.3, 0.2, 0.2] }, coefs: [{ b: -3, se: 0.3 }, { b: 0.5, se: 0.2 }, { b: 0.2, se: 0.2 }] };
  // friends of friends mixes slowly → it is named, with how many ties share a contact; the characteristic is cleared
  let W = E.nlErgmDiagnose(net, [{ t: 'edges' }, { t: 'gwesp', decay: 0.5 }, { t: 'nodematch', a: 'side' }], Object.assign({}, base, { tratio: [0.1, -0.6, 0.1], essK: [80, 5, 70] }));
  assert.equal(W[0].kind, 'mixing'); assert.equal(W[0].term, 1); assert.match(W[0].text, /Only 3 of 40 ties \(8%\) share a contact and the whole network has 1 triangle /); assert.match(W[0].text, /characteristics are not the problem/);
  // a tiny group in a characteristic is named first
  W = E.nlErgmDiagnose(net, [{ t: 'edges' }, { t: 'gwesp', decay: 0.5 }, { t: 'nodematch', a: 'grp' }], Object.assign({}, base, { tratio: [0.1, 0.1, -0.5], essK: [80, 70, 60] }));
  assert.equal(W[0].kind, 'rare'); assert.equal(W[0].term, 2); assert.match(W[0].text, /Only 2 people have grp = tiny/);
  // separation: the pseudo-likelihood estimate runs away
  W = E.nlErgmDiagnose(net, [{ t: 'edges' }, { t: 'nodematch', a: 'grp' }], Object.assign({}, base, { mple: { converged: true, coef: [-3, 11], se: [0.3, 9] }, coefs: [{ b: -3, se: 0.3 }, { b: 12, se: 3 }], tratio: [0.1, 0.9], essK: [80, 70] }));
  assert.equal(W[0].kind, 'separation'); assert.match(W[0].title, /almost perfectly predicts/);
  // extreme values in a number
  W = E.nlErgmDiagnose(net, [{ t: 'edges' }, { t: 'nodecov', a: 'x' }], Object.assign({}, base, { tratio: [0.1, 0.5], essK: [80, 70] }));
  assert.equal(W[0].kind, 'extreme');
  // nothing wrong: it needs more time
  W = E.nlErgmDiagnose(net, [{ t: 'edges' }, { t: 'gwesp', decay: 0.5 }], Object.assign({}, base, { tratio: [0.1, 0.3], essK: [80, 70], timedOut: true }));
  assert.equal(W[0].kind, 'time'); assert.equal(W[0].fix, 'longer'); assert.match(W[0].title, /ran out of time/);
});
