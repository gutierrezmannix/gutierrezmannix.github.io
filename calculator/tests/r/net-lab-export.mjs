// Export what the calculator computes, for comparison in R.
// Usage: node calculator/tests/r/net-lab-export.mjs <edges> <nodes> <outdir> <tag> <directed 1|0> <attr> <models.json>  (then run net-lab-compare.R on <outdir>)
const [ef, nf, out, tag, dirS, attr, modelsJ] = process.argv.slice(2);
const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const man = JSON.parse(html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(man['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const ab = f => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const run = g => { let r; while (!(r = g.next()).done); return r.value; };
const er = await E.parseCSV(ab(ef), () => {}), nr = await E.parseCSV(ab(nf), () => {});
const g = E.nlGuess(er, nr);
const b0 = E.nlBuild(er, null, { from: g.from, to: g.to, type: g.type }); const tw = {}; for (const [t, r] of Object.entries(b0.info.typeRecip)) if (r >= 0.95) tw[t] = true;
const B = E.nlBuild(er, nr, Object.assign({}, g, { directed: dirS === '1', twoWay: tw, short: false }));
const net = B.net, n = net.n;
const csv = rows => rows.map(r => r.map(v => typeof v === 'string' && /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\n') + '\n';
fs.writeFileSync(`${out}/${tag}-edges.csv`, csv([['from', 'to', 'weight']].concat(net.edges.map(([a, b2, w]) => [net.ids[a], net.ids[b2], w]))));
const attrNames = Object.keys(net.attrs);
fs.writeFileSync(`${out}/${tag}-attrs.csv`, csv([['id', ...attrNames]].concat(net.ids.map((id, i) => [id, ...attrNames.map(a => net.attrs[a].v[i] == null ? 'NA' : net.attrs[a].v[i])]))));
const S = E.nlSummary(net), M = E.nlNodeMeasures(net), L = E.nlLouvain(net), BR = net.directed ? E.nlBrokerage(net, attr) : null, CL = E.nlCliques(net);
const mix = run(E.nlMixing(net, attr, 200));
const sum = [['metric', 'value'], ['n', S.n], ['ties', S.m], ['density', S.density], ['reciprocity', S.reciprocity ?? 'NA'], ['transitivity', S.transitivity], ['avgDist', S.avgDist], ['diameter', S.diameter], ['centralization', S.centralization], ['components', S.components], ['isolates', S.isolates], ['louvainQ', L.Q], ['louvainGroups', L.sizes.filter(s => s > 1).length], ['assort_' + attr, mix.assort], ['within_' + attr, mix.within], ['ei_' + attr, mix.ei], ['cliques3', CL.cliques.length], ['maxClique', CL.cliques[0] ? CL.cliques[0].length : 0]];
if (S.triads) E.NL_TRIADS.forEach((t, k) => sum.push(['triad_' + t, S.triads[k]]));
fs.writeFileSync(`${out}/${tag}-summary.csv`, csv(sum));
const keys = ['indegree', 'outdegree', 'degree', 'betweenness', 'closeness', 'harmonic', 'eigenvector', 'pagerank', 'constraint', 'effsize', 'core', 'clustering', 'strengthIn', 'connectedness'];
const roles = BR ? ['coordinator', 'consultant', 'representative', 'gatekeeper', 'liaison'] : [];
fs.writeFileSync(`${out}/${tag}-nodes.csv`, csv([['id', ...keys, ...roles.map(r => 'br_' + r), 'louvain']].concat(net.ids.map((id, i) => [id, ...keys.map(k => M[k] && isFinite(M[k][i]) ? M[k][i] : 'NA'), ...roles.map(r => BR[r][i]), L.member[i]]))));
// network models
const models = JSON.parse(modelsJ), rows = [['model', 'term', 'rterm', 'mple', 'mple_se', 'mcmc', 'mcmc_se', 'gobs', 'converged', 'seconds']];
for (const [name, spec] of Object.entries(models)) {
  const t0 = Date.now(); const r = run(E.nlErgm(net, spec, { gof: false, seed: 26 }));
  if (r.error) { rows.push([name, 'ERROR', r.error.replace(/,/g, ';'), 'NA', 'NA', 'NA', 'NA', 'NA', 'NA', 'NA']); console.log(tag, name, 'ERROR', r.error); continue; }
  r.coefs.forEach((c, k) => rows.push([name, c.term, r.terms[k].t + (r.terms[k].a ? ':' + r.terms[k].a : ''), r.mple.coef[k], r.mple.se[k], c.b, c.se, r.gobs[k], r.converged ? 1 : 0, r.seconds]));
  console.log(tag, name, 'converged', r.converged, r.seconds.toFixed(1) + 's', r.coefs.map(c => c.b.toFixed(3)).join(' '));
}
fs.writeFileSync(`${out}/${tag}-ergm.csv`, csv(rows));
console.log(tag, 'n', n, 'ties', S.m);
