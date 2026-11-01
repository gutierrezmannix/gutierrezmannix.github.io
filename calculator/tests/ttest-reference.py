"""Regenerate tests/data/ttest-reference.json: t-tests computed independently with SciPy.

    python3 calculator/tests/ttest-reference.py

Cases: one sample, paired, Welch and Student two-sample tests, and Stata's welch option (Welch's 1947 degrees of
freedom); n from 2 to 400, values from 1e-6 to 1e8, missing values, confidence levels 90% to 99.99%.
"""
import json
from pathlib import Path
import numpy as np
from scipy import stats

rng = np.random.default_rng(2611)
out = []


def clean(a):
    return [None if not np.isfinite(v) else float(f'{v:.12g}') for v in a]


for k in range(150):
    mode = ['value', 'paired', 'groups'][k % 3]
    n = int([2, 3, 6, 15, 40, 120, 400][k % 7])
    alpha = float([.05, .1, .01, .001, .0001][k % 5])
    scale = float([1e-6, 1, 1e3, 1e8][k % 4])
    x = np.array(clean(rng.normal(5, 1 + k % 3, n) * scale), dtype=float)
    if mode == 'groups':
        y = np.array(clean(rng.normal(5 + (k % 4) / 3, [0.3, 1, 4][k % 3], max(2, n + int(rng.integers(-1, 6)))) * scale), dtype=float)
    else:
        y = np.array(clean(x + rng.normal((k % 5) / 10, .5, n) * scale), dtype=float)
    if n > 5:
        x[1] = np.nan
        y[2] = np.nan
    mu = float(f'{(5 + (k % 7) / 10) * scale:.12g}')
    case = {'mode': mode, 'alpha': alpha, 'mu': mu, 'x': clean(x), 'y': None if mode == 'value' else clean(y)}
    if mode == 'value':
        xx = x[np.isfinite(x)]
        r = stats.ttest_1samp(xx, mu)
        tests = {'value': (r, len(xx) - 1, xx.mean())}
    elif mode == 'paired':
        ok = np.isfinite(x) & np.isfinite(y)
        r = stats.ttest_rel(x[ok], y[ok])
        tests = {'paired': (r, int(ok.sum()) - 1, (x[ok] - y[ok]).mean())}
    else:
        xx, yy = x[np.isfinite(x)], y[np.isfinite(y)]
        rw = stats.ttest_ind(xx, yy, equal_var=False)
        rs = stats.ttest_ind(xx, yy, equal_var=True)
        va, vb = xx.var(ddof=1) / len(xx), yy.var(ddof=1) / len(yy)
        dfw = -2 + (va + vb) ** 2 / (va ** 2 / (len(xx) + 1) + vb ** 2 / (len(yy) + 1))
        tw = (xx.mean() - yy.mean()) / np.sqrt(va + vb)
        tests = {'welch': (rw, rw.df, xx.mean() - yy.mean()), 'student': (rs, len(xx) + len(yy) - 2, xx.mean() - yy.mean())}
        case['welch1947'] = {'t': float(tw), 'df': float(dfw), 'p': float(2 * stats.t.sf(abs(tw), dfw))}
    for name, (r, df, est) in tests.items():
        ci = r.confidence_interval(1 - alpha)
        case[name] = {'estimate': float(est), 't': float(r.statistic), 'df': float(df), 'p': float(r.pvalue), 'lo': float(ci.low), 'hi': float(ci.high)}
    out.append(case)

path = Path(__file__).with_name('data') / 'ttest-reference.json'
path.write_text(json.dumps(out, separators=(',', ':')) + '\n')
print(len(out), 'cases written to', path)
