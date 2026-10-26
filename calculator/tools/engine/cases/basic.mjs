import { rng, packet, num, cat, normals, pick, withMissing, bern, round } from '../casekit.mjs';
export function cases() {
  const r = rng(11), n = 80, out = [];
  const y01 = Array.from({ length: n }, () => bern(r, 0.45)), y02 = y01.map(v => r.unif() < 0.3 ? 1 - v : v), g2 = pick(r, n, ['control', 'treated']), g3 = pick(r, n, ['a', 'b', 'c']), g4 = pick(r, n, ['north', 'south', 'east', 'west']);
  const yn = normals(r, n, 10, 3, 2), yn2 = yn.map(v => round(v + 0.8 + r.norm(), 1)), yties = yn.map(v => Math.round(v));
  const S = (id, options, name = id) => out.push({ name, packet: packet(id, [], {}, { inputMode: 'summary', ...options }) });
  S('summary_t1', { mean1: 5.2, sd1: 1.9, n1: 30, null: 4.5 });
  S('summary_t2', { mean1: 5.2, sd1: 1.9, n1: 30, mean2: 4.1, sd2: 2.6, n2: 41 });
  S('summary_tp', { meanDifference: 0.7, sdDifference: 1.3, pairs: 25, null: 0 });
  S('summary_t1', { mean1: 5.2, sd1: 0, n1: 30, null: 4.5 }, 'summary_t1_zero_sd');
  S('summary_t2', { mean1: 5.2, sd1: 1.9, n1: 1.5, mean2: 4.1, sd2: 2.6, n2: 41 }, 'summary_t2_bad_n');
  out.push({ name: 'prop1_raw', packet: packet('prop1', [num('voted', withMissing(r, y01))], { y: 'voted' }, { null: 0.5 }) });
  out.push({ name: 'prop1_sum', packet: packet('prop1', [], {}, { inputMode: 'summary', successes: 37, trials: 90, null: 0.5 }) });
  out.push({ name: 'prop1_small', packet: packet('prop1', [], {}, { inputMode: 'summary', successes: 2, trials: 9, null: 0.5 }) });
  out.push({ name: 'prop2_raw', packet: packet('prop2', [num('voted', y01), cat('arm', g2)], { y: 'voted', group: 'arm' }) });
  out.push({ name: 'prop2_sum', packet: packet('prop2', [], {}, { inputMode: 'summary', successes1: 37, trials1: 90, successes2: 50, trials2: 88 }) });
  out.push({ name: 'prop2_3groups', packet: packet('prop2', [num('voted', y01), cat('region', g3)], { y: 'voted', group: 'region' }) });
  out.push({ name: 'prop_not01', packet: packet('prop1', [num('score', yn)], { y: 'score' }) });
  out.push({ name: 'binomial_raw', packet: packet('binomial', [num('voted', y01)], { y: 'voted' }, { null: 0.4 }) });
  out.push({ name: 'binomial_sum', packet: packet('binomial', [], {}, { inputMode: 'summary', successes: 7, trials: 20, null: 0.5 }) });
  out.push({ name: 'binomial_zero', packet: packet('binomial', [], {}, { inputMode: 'summary', successes: 0, trials: 12, null: 0.3 }) });
  out.push({ name: 'binomial_toomany', packet: packet('binomial', [], {}, { inputMode: 'summary', successes: 14, trials: 12 }) });
  out.push({ name: 'gof_raw', packet: packet('gof', [cat('region', g4)], { group: 'region' }) });
  out.push({ name: 'gof_sum', packet: packet('gof', [], {}, { inputMode: 'summary', counts: '18, 25, 31, 6', expected: '0.25,0.25,0.3,0.2' }) });
  out.push({ name: 'gof_badp', packet: packet('gof', [], {}, { inputMode: 'summary', counts: '18, 25, 31', expected: '0.5,0.25' }) });
  out.push({ name: 'gof_leadingspace', packet: packet('gof', [], {}, { inputMode: 'summary', counts: ' 18, 25' }) });
  out.push({ name: 'fisher_raw', packet: packet('fisher', [cat('arm', g2), cat('voted', y01)], { group: 'arm', group2: 'voted' }) });
  out.push({ name: 'fisher_3x4', packet: packet('fisher', [cat('region', g3.slice(0, 40)), cat('zone', g4.slice(0, 40))], { group: 'region', group2: 'zone' }) });
  out.push({ name: 'fisher_sum', packet: packet('fisher', [], {}, { inputMode: 'summary', table: '3, 9\n12, 4' }) });
  out.push({ name: 'fisher_zero', packet: packet('fisher', [], {}, { inputMode: 'summary', table: '0, 9\n12, 4' }) });
  out.push({ name: 'mcnemar_raw', packet: packet('mcnemar', [num('before', y01), num('after', y02)], { y: 'before', y2: 'after' }) });
  out.push({ name: 'mcnemar_sum', packet: packet('mcnemar', [], {}, { inputMode: 'summary', table: '20, 9\n3, 30' }) });
  out.push({ name: 'mcnemar_exact', packet: packet('mcnemar_exact', [num('before', y01), num('after', y02)], { y: 'before', y2: 'after' }) });
  out.push({ name: 'mannwhitney', packet: packet('mannwhitney', [num('score', yn), cat('arm', g2)], { y: 'score', group: 'arm' }) });
  out.push({ name: 'mannwhitney_ties', packet: packet('mannwhitney', [num('score', withMissing(r, yties)), cat('arm', g2)], { y: 'score', group: 'arm' }) });
  out.push({ name: 'mannwhitney_3', packet: packet('mannwhitney', [num('score', yn), cat('arm', g3)], { y: 'score', group: 'arm' }) });
  out.push({ name: 'signedrank', packet: packet('signedrank', [num('pre', yn), num('post', yn2)], { y: 'pre', y2: 'post' }) });
  out.push({ name: 'signedrank_ties', packet: packet('signedrank', [num('pre', yties), num('post', yn2.map(Math.round))], { y: 'pre', y2: 'post' }) });
  out.push({ name: 'kruskal', packet: packet('kruskal', [num('score', yties), cat('region', g4)], { y: 'score', group: 'region' }) });
  { const subj = [], cond = [], val = []; for (let s = 0; s < 15; s++) for (const c of ['t1', 't2', 't3']) { subj.push('s' + s); cond.push(c); val.push(Math.round(5 + (c === 't3' ? 1.2 : 0) + 2 * r.norm())); }
    out.push({ name: 'friedman', packet: packet('friedman', [num('score', val), cat('time', cond), cat('id', subj)], { y: 'score', group: 'time', subject: 'id' }) });
    out.push({ name: 'friedman_unbalanced', packet: packet('friedman', [num('score', val.slice(1)), cat('time', cond.slice(1)), cat('id', subj.slice(1))], { y: 'score', group: 'time', subject: 'id' }) }); }
  for (const [id, o] of [['power_t', { effect: 0.5, design: 'two.sample' }], ['power_t', { effect: 0.4, design: 'paired', sample: 30 }], ['power_t', { effect: 0.3, design: 'one.sample', power: 0.9 }], ['power_prop', { p1: 0.4, p2: 0.55, design: 'two.sample' }], ['power_prop', { p1: 0.4, p2: 0.55, design: 'one.sample', sample: 120 }], ['power_corr', { effect: 0.25 }], ['power_corr', { effect: 0.25, sample: 60 }], ['power_anova', { groups: 4, effect: 0.25 }], ['power_anova', { groups: 3, effect: 0.2, sample: 40 }], ['power_t', { effect: 0.5, sample: 1 }]])
    out.push({ name: id + '_' + Object.values(o).join('_'), packet: packet(id, [], {}, o) });
  out.push({ name: 'precision_prop', packet: packet('precision', [], {}, { target: 'proportion', margin: 0.03, proportion: 0.5, population: 50000, designEffect: 1.5, responseRate: 0.6 }) });
  out.push({ name: 'precision_mean', packet: packet('precision', [], {}, { target: 'mean', margin: 0.5, sd: 4 }) });
  { const p = y01.map(v => round(Math.min(0.99, Math.max(0.01, 0.3 + 0.35 * v + 0.25 * (r.unif() - 0.5))), 3)); out.push({ name: 'classification', packet: packet('classification', [num('voted', y01), num('phat', p)], { y: 'voted', probability: 'phat' }, { threshold: 0.5 }) }); }
  out.push({ name: 'missing', packet: packet('missing', [num('a', withMissing(r, yn, 0.1)), num('b', withMissing(r, yn2, 0.2)), cat('c', withMissing(r, g3, 0.15))], { variables: ['a', 'b', 'c'] }) });
  out.push({ name: 'seed_bad', packet: packet('summary_t1', [], {}, { inputMode: 'summary', mean1: 5, sd1: 1, n1: 10, seed: -3 }) });
  return out;
}
