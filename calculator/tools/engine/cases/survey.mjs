import { rng, packet, num, cat, pick, withMissing, round } from '../casekit.mjs';
export function cases() {
  const r = rng(31), out = [], n = 240;
  const strata = Array.from({ length: n }, (_, i) => ['A', 'B', 'C', 'D'][i % 4]), psu = Array.from({ length: n }, (_, i) => 1 + Math.floor(i / 4) % 5);
  const wt = strata.map(s => round((s === 'A' ? 2 : s === 'B' ? 5 : s === 'C' ? 8 : 3) * (0.6 + r.unif()), 3));
  const sex = pick(r, n, ['female', 'male']), edu = pick(r, n, ['hs', 'college', 'grad'], [0.5, 0.3, 0.2]);
  const inc = sex.map((s, i) => round(30 + (s === 'male' ? 4 : 0) + (edu[i] === 'grad' ? 10 : 0) + psu[i] + 8 * r.norm(), 2));
  const smoke = edu.map(e => r.unif() < (e === 'hs' ? 0.35 : 0.15) ? 'yes' : 'no'), region = pick(r, n, ['n', 's']);
  const dom = region.map(v => v === 'n'), more = d => ({ more: { domain: d } });
  const base = [num('income', inc), cat('sex', sex), cat('edu', edu), cat('smoke', smoke), num('w', wt), num('psu', psu), cat('stratum', strata), cat('region', region)];
  const add = (name, id, fields, options = {}, extra = {}, cols = base) => out.push({ name, packet: packet(id, cols, fields, options, extra) });
  const des = { weight: 'w', psu: 'psu', strata: 'stratum' };
  add('desc_mean', 'survey_desc', { ...des, variables: ['income', 'edu'] });
  add('desc_total', 'survey_desc', { ...des, variables: ['income', 'smoke'] }, { surveyStat: 'total' });
  add('desc_domain', 'survey_desc', { ...des, variables: ['income', 'edu'] }, {}, more(dom));
  add('desc_domain_alpha', 'survey_desc', { ...des, variables: ['income'] }, { surveyStat: 'total' }, { alpha: 0.1, ...more(dom) });
  add('desc_nostrata', 'survey_desc', { weight: 'w', psu: 'psu', variables: ['income', 'sex'] });
  add('desc_srs', 'survey_desc', { weight: 'w', variables: ['income', 'edu'] }, {}, more(dom));
  add('desc_strata_only', 'survey_desc', { weight: 'w', strata: 'stratum', variables: ['income'] });
  { const incM = withMissing(r, inc, 0.08); add('desc_missing', 'survey_desc', { ...des, variables: ['income', 'edu'] }, {}, more(dom), [num('income', incM), ...base.slice(1)]); }
  // a domain that misses some PSUs entirely (zero-padded PSU totals)
  { const d2 = psu.map((p, i) => p <= 2 || (strata[i] === 'A' && p === 3)); add('desc_domain_psus', 'survey_desc', { ...des, variables: ['income', 'smoke'] }, {}, more(d2)); }
  add('test_means', 'survey_test', { ...des, y: 'income', group: 'sex' });
  add('test_means_domain', 'survey_test', { ...des, y: 'income', group: 'sex' }, {}, more(dom));
  add('test_means_srs', 'survey_test', { weight: 'w', y: 'income', group: 'sex' }, {}, { alpha: 0.01 });
  add('test_cat', 'survey_test', { ...des, y: 'smoke', group: 'edu' }, { surveyTest: 'categorical' });
  add('test_cat_domain', 'survey_test', { ...des, y: 'edu', group: 'sex' }, { surveyTest: 'categorical' }, more(dom));
  add('test_cat_srs', 'survey_test', { weight: 'w', strata: 'stratum', y: 'smoke', group: 'sex' }, { surveyTest: 'categorical' });
  add('test_3groups', 'survey_test', { ...des, y: 'income', group: 'edu' });
  add('test_1group', 'survey_test', { ...des, y: 'income', group: 'sex' }, {}, more(sex.map(s => s === 'male')));
  // errors
  add('no_weight', 'survey_desc', { psu: 'psu', variables: ['income'] });
  { const wm = wt.slice(); wm[5] = null; add('weight_missing', 'survey_desc', { ...des, variables: ['income'] }, {}, {}, [...base.slice(0, 4), num('w', wm), ...base.slice(5)]); }
  { const wz = wt.slice(); wz[7] = 0; add('weight_zero', 'survey_desc', { ...des, variables: ['income'] }, {}, {}, [...base.slice(0, 4), num('w', wz), ...base.slice(5)]); }
  add('empty_domain', 'survey_desc', { ...des, variables: ['income'] }, {}, more(new Array(n).fill(false)));
  { const lonely = strata.map((s, i) => i === 0 ? 'E' : s); add('lonely_psu', 'survey_desc', { ...des, variables: ['income'] }, {}, {}, [...base.slice(0, 6), cat('stratum', lonely), base[7]]);
    add('lonely_psu_outside_domain', 'survey_desc', { ...des, variables: ['income'] }, {}, more(dom.map((v, i) => i === 0 ? false : v)), [...base.slice(0, 6), cat('stratum', lonely), base[7]]); }
  { const d3 = strata.map((s, i) => s === 'A' && psu[i] <= 2); add('test_low_df', 'survey_test', { ...des, y: 'income', group: 'sex' }, {}, more(d3)); }
  add('no_variables', 'survey_desc', { ...des });
  return out;
}
