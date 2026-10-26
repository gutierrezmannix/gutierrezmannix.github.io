import { rng, packet, num, cat, normals, pick, withMissing, bern, round } from '../casekit.mjs';
export function cases() {
  const r = rng(31), n = 90, out = [];
  const x1 = normals(r, n), x2 = normals(r, n, 0, 1, 2), g3 = pick(r, n, ['a', 'b', 'c']), g2 = pick(r, n, ['ctrl', 'trt']);
  const lin = x1.map((v, i) => 0.6 * v - 0.4 * x2[i] + (g3[i] === 'b' ? 0.5 : g3[i] === 'c' ? -0.3 : 0));
  const tt = lin.map(l => round(-Math.log(r.unif()) * 8 * Math.exp(-l), 1) + 0.1), cens = lin.map(() => round(-Math.log(r.unif()) * 14, 1) + 0.1);
  const time = tt.map((v, i) => round(Math.min(v, cens[i]), 1)), ev = tt.map((v, i) => v <= cens[i] ? 1 : 0);
  const itime = time.map(v => Math.ceil(v / 3)), gnum = g3.map(v => v === 'a' ? 1 : v === 'b' ? 2 : 3);
  const cols = (t = time, e = ev) => [num('time', t), num('event', e), num('x1', x1), num('x2', x2), cat('arm', g3), cat('trt', g2), num('gnum', gnum)];
  const P = (name, id, f, o = {}, extra = {}, c = cols(), compare) => out.push({ name, packet: packet(id, c, f, o, extra), ...(compare ? { compare } : {}) });
  // Kaplan–Meier
  P('km_all', 'km', { time: 'time', event: 'event' });
  P('km_group', 'km', { time: 'time', event: 'event', group: 'arm' });
  P('km_group2_alpha10', 'km', { time: 'time', event: 'event', group: 'trt' }, {}, { alpha: 0.1 });
  P('km_ties', 'km', { time: 'time', event: 'event', group: 'trt' }, {}, {}, cols(itime));
  P('km_numgroup', 'km', { time: 'time', event: 'event', group: 'gnum' });
  P('km_missing', 'km', { time: 'time', event: 'event', group: 'arm' }, {}, {}, cols(withMissing(r, time, 0.08), withMissing(r, ev, 0.05)));
  P('km_allevents', 'km', { time: 'time', event: 'event' }, {}, {}, cols(time.slice(0, 30), ev.slice(0, 30).map(() => 1)).map(c => ({ ...c, values: c.values.slice(0, 30) })));
  P('km_badevent', 'km', { time: 'time', event: 'event' }, {}, {}, cols(time, ev.map(v => v + 1)));
  P('km_negtime', 'km', { time: 'time', event: 'event' }, {}, {}, cols(time.map((v, i) => i === 3 ? -1 : v)));
  P('km_zerotime', 'km', { time: 'time', event: 'event', group: 'trt' }, {}, {}, cols(time.map((v, i) => i % 17 === 0 ? 0 : v)));
  // Cox
  P('cox_basic', 'cox', { time: 'time', event: 'event', predictors: ['x1', 'x2'] });
  P('cox_factor', 'cox', { time: 'time', event: 'event', predictors: ['x1', 'arm'] });
  P('cox_one_alpha10', 'cox', { time: 'time', event: 'event', predictors: ['x2'] }, {}, { alpha: 0.1 });
  P('cox_ties', 'cox', { time: 'time', event: 'event', predictors: ['x1', 'x2', 'trt'] }, {}, {}, cols(itime));
  P('cox_missing', 'cox', { time: 'time', event: 'event', predictors: ['x1', 'arm'] }, {}, {}, cols(withMissing(r, time, 0.06)));
  P('cox_noevents', 'cox', { time: 'time', event: 'event', predictors: ['x1'] }, {}, {}, cols(time, ev.map(() => 0)));
  P('cox_nopred', 'cox', { time: 'time', event: 'event' });
  P('cox_badevent', 'cox', { time: 'time', event: 'event', predictors: ['x1'] }, {}, {}, cols(time, ev.map(v => v * 2)));
  // parametric AFT
  for (const dist of ['weibull', 'exponential', 'lognormal', 'loglogistic', 'gaussian', 'logistic', 'extreme', 'rayleigh'])
    P('survreg_' + dist, 'survreg', { time: 'time', event: 'event', predictors: ['x1', 'arm'] }, { distribution: dist });
  P('survreg_default_alpha10', 'survreg', { time: 'time', event: 'event', predictors: ['x2', 'trt'] }, {}, { alpha: 0.1 });
  P('survreg_ties', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, { distribution: 'lognormal' }, {}, cols(itime));
  P('survreg_zerotime', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, {}, {}, cols(time.map((v, i) => i === 5 ? 0 : v)));
  P('survreg_gauss_zerotime', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, { distribution: 'gaussian' }, {}, cols(time.map((v, i) => i === 5 ? 0 : v)));
  P('survreg_baddist', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, { distribution: 'gamma' });
  P('survreg_partialdist', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, { distribution: 'logn' });
  P('survreg_nopred', 'survreg', { time: 'time', event: 'event' });
  P('survreg_negtime', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, {}, {}, cols(time.map((v, i) => i === 3 ? -2 : v)));
  P('km_onegroup', 'km', { time: 'time', event: 'event', group: 'trt' }, {}, {}, cols().map(c => c.name === 'trt' ? { ...c, values: c.values.map(() => 'ctrl') } : c));
  P('cox_collinear', 'cox', { time: 'time', event: 'event', predictors: ['x1', 'x1copy'] }, {}, {}, [...cols(), num('x1copy', x1.map(v => 2 * v + 1))]);
  P('cox_separation', 'cox', { time: 'time', event: 'event', predictors: ['x2', 'sep'] }, {}, {}, [...cols(), num('sep', time.map((t, i) => ev[i] === 1 && t < 2 ? 1 : 0))]);
  P('survreg_t', 'survreg', { time: 'time', event: 'event', predictors: ['x1', 'trt'] }, { distribution: 't' });
  P('survreg_loggaussian', 'survreg', { time: 'time', event: 'event', predictors: ['x2'] }, { distribution: 'loggaussian' });
  P('survreg_ambiguous', 'survreg', { time: 'time', event: 'event', predictors: ['x1'] }, { distribution: 'log' });
  { const r2 = rng(77), m = 260, a = normals(r2, m), g = pick(r2, m, ['p', 'q']), t = a.map((v, i) => round(-Math.log(r2.unif()) * 5 * Math.exp(0.5 * v + (g[i] === 'q' ? 0.4 : 0)), 2) + 0.01), c = a.map(() => round(-Math.log(r2.unif()) * 12, 2) + 0.01);
    const big = [num('time', t.map((v, i) => round(Math.min(v, c[i]), 2))), num('event', t.map((v, i) => v <= c[i] ? 1 : 0)), num('a', a), cat('g', g)];
    P('survreg_large', 'survreg', { time: 'time', event: 'event', predictors: ['a', 'g'] }, { distribution: 'loglogistic' }, {}, big);
    P('cox_large', 'cox', { time: 'time', event: 'event', predictors: ['a', 'g'] }, {}, {}, big);
    P('km_large', 'km', { time: 'time', event: 'event', group: 'g' }, {}, {}, big); }
  return out;
}
