"""Regenerate tests/data/compare-means-reference.json: the Compare means and Correlation pages, computed with SciPy.

    python3 calculator/tests/compare-means-reference.py

Correlation: 2 to 6 variables, n from 6 to 150, missing values, Pearson and Spearman, pairwise and complete rows,
confidence levels 90/95/99%: r, p, n and the Fisher-z interval of every pair (Bonett–Wright for Spearman).
T-tests: two-sided and one-sided p and limits for groups (Welch, Student), paired and one sample, from the data and
from summary numbers (scipy.stats.ttest_ind_from_stats).
"""
import json
from pathlib import Path
import numpy as np
from scipy import stats

rng = np.random.default_rng(6211)


def num(v):
    return None if v is None or not np.isfinite(v) else float(v)


def csv(cols, names):
    lines = [','.join(names)]
    for i in range(len(cols[0])):
        lines.append(','.join('' if not np.isfinite(c[i]) else f'{c[i]:.10g}' for c in cols))
    return '\n'.join(lines)


cor = []
for k in range(60):
    nv = 2 + k % 5
    n = int([6, 9, 14, 30, 75, 150][k % 6])
    base = rng.normal(size=n)
    cols = []
    for j in range(nv):
        x = base * rng.uniform(-1, 1) + rng.normal(size=n) * rng.uniform(.3, 2)
        if k % 4 == 1:
            x = np.round(x * 2) / 2  # ties for Spearman
        if k % 3 == 2:
            x = np.exp(x)
        x = np.array([float(f'{v:.10g}') for v in x])
        miss = rng.random(n) < [0, .05, .15][k % 3]
        x[miss] = np.nan
        cols.append(x)
    names = [f'v{j + 1}' for j in range(nv)]
    method = ['pearson', 'spearman'][k % 2]
    rows = ['pairwise', 'listwise'][(k // 2) % 2]
    level = [95, 90, 99][(k // 4) % 3]
    z = stats.norm.ppf(1 - (1 - level / 100) / 2)
    M = np.array(cols)
    if rows == 'listwise':
        keep = np.all(np.isfinite(M), axis=0)
        M = M[:, keep]
    pairs = []
    for i in range(nv):
        for j in range(i):
            ok = np.isfinite(M[i]) & np.isfinite(M[j])
            a, b = M[i][ok], M[j][ok]
            m = len(a)
            if m < 4 or np.std(a) == 0 or np.std(b) == 0:
                pairs.append({'i': i, 'j': j, 'n': m, 'r': None})
                continue
            if method == 'pearson':
                res = stats.pearsonr(a, b)
                r, p = res.statistic, res.pvalue
                ci = res.confidence_interval(level / 100)  # Fisher z
                lo, hi = ci.low, ci.high
            else:
                res = stats.spearmanr(a, b)
                r, p = res.statistic, res.pvalue
                se = np.sqrt((1 + r * r / 2) / (m - 3))
                lo, hi = np.tanh(np.arctanh(r) - z * se), np.tanh(np.arctanh(r) + z * se)
            pairs.append({'i': i, 'j': j, 'n': m, 'r': num(r), 'p': num(p), 'lo': num(lo), 'hi': num(hi)})
    cor.append({'csv': csv(cols, names), 'vars': names, 'method': method, 'rows': rows, 'level': level, 'pairs': pairs})

tt = []
for k in range(90):
    mode = ['groups', 'paired', 'value'][k % 3]
    alt = ['two', 'gt', 'lt'][(k // 3) % 3]
    equal = (k // 9) % 2 == 1
    level = [95, 90, 99][(k // 18) % 3]
    n = int([5, 12, 40, 100][k % 4])
    x = np.array([float(f'{v:.10g}') for v in rng.normal(10, 2, n)])
    if mode == 'groups':
        y = np.array([float(f'{v:.10g}') for v in rng.normal(10 + rng.uniform(-1.5, 1.5), rng.uniform(.5, 4), n + int(rng.integers(0, 8)))])
    else:
        y = np.array([float(f'{v:.10g}') for v in x + rng.normal(rng.uniform(-1, 1), 1, n)])
    mu = float(round(rng.uniform(8, 12), 2))
    salt = {'two': 'two-sided', 'gt': 'greater', 'lt': 'less'}[alt]
    if mode == 'groups':
        res = stats.ttest_ind(x, y, equal_var=equal, alternative=salt)
        data = csv([np.concatenate([x, y]), np.array([1.0] * len(x) + [2.0] * len(y))], ['y', 'g'])
        summ = stats.ttest_ind_from_stats(x.mean(), x.std(ddof=1), len(x), y.mean(), y.std(ddof=1), len(y), equal_var=equal, alternative=salt)
        sm = {'m1': x.mean(), 's1': x.std(ddof=1), 'n1': len(x), 'm2': y.mean(), 's2': y.std(ddof=1), 'n2': len(y)}
    elif mode == 'paired':
        res = stats.ttest_rel(x, y, alternative=salt)
        data = csv([x, y], ['y', 'y2'])
        d = x - y
        summ = stats.ttest_1samp(d, 0, alternative=salt)
        sm = {'m1': d.mean(), 's1': d.std(ddof=1), 'n1': len(d)}
    else:
        res = stats.ttest_1samp(x, mu, alternative=salt)
        data = csv([x], ['y'])
        summ = res
        sm = {'m1': x.mean(), 's1': x.std(ddof=1), 'n1': len(x)}
    ci = res.confidence_interval(level / 100)
    est = ci.low if alt == 'gt' else ci.high if alt == 'lt' else (ci.low + ci.high) / 2
    sm = {k2: float(f'{v:.15g}') for k2, v in sm.items()}
    tt.append({'mode': mode, 'alt': alt, 'equal': equal, 'level': level, 'mu': mu, 'csv': data, 'summary': sm,
               't': num(res.statistic), 'df': num(res.df), 'p': num(res.pvalue), 'lo': num(ci.low), 'hi': num(ci.high),
               'pSummary': num(summ.pvalue), 'tSummary': num(summ.statistic)})

Path(__file__).with_name('data').joinpath('compare-means-reference.json').write_text(json.dumps({'cor': cor, 'tt': tt}, separators=(',', ':')) + '\n')
print(len(cor), 'correlation cases,', len(tt), 't-test cases')
