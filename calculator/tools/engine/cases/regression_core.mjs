import { rng, packet, num, cat, normals, pick, withMissing, bern, round } from '../casekit.mjs';
export function cases() {
  const r = rng(21), n = 120, x = normals(r, n), z = normals(r, n), g = pick(r, n, ['low', 'mid', 'high']);
  const y = x.map((v, i) => (0.3 + 0.8 * v - 0.5 * z[i] + (g[i] === 'high' ? 0.6 : 0) + r.norm()) > 0 ? 1 : 0);
  return [
    { name: 'probit', packet: packet('probit', [num('y', withMissing(r, y)), num('x', x), num('z', z), cat('g', g)], { y: 'y', predictors: ['x', 'z', 'g'] }) },
    { name: 'probit_alpha10', packet: packet('probit', [num('y', y), num('x', x)], { y: 'y', predictors: ['x'] }, {}, { alpha: 0.1 }) },
    { name: 'probit_sep', packet: packet('probit', [num('y', x.map(v => v > 0 ? 1 : 0)), num('x', x)], { y: 'y', predictors: ['x'] }) },
  ];
}
