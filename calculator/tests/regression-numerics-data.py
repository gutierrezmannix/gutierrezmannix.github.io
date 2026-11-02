"""Writes tests/data/regression-numerics.csv: one seeded dataset for tests/regression-numerics.test.mjs.

The same income enters in several units (pesos, thousands, monthly, rounded thousands, x3, x10) and as a timestamp, with
a rate of about 0.001 and a variable of about 1e-6, so the fits can be checked for unit invariance, collinearity and
convergence. Outcomes: y (linear), e / e12 / esi (the same yes-no outcome coded 0/1, 1/2 and "no"/"sí"), o (ordered,
four levels), cnt (counts). grupo, sexo: categories; w: a weight; cl: clusters. Reference values come from
tests/regression-numerics-reference.R (R 4.3.3).

    python3 calculator/tests/regression-numerics-data.py
"""
import math, random
from pathlib import Path

random.seed(20261102)
rows = ['y,e,e12,esi,o,cnt,inc,inc_k,inc_m,inc_r,inc3,inc10,stamp,rate,tiny,x2,grupo,sexo,w,cl']
for i in range(400):
    inc = random.lognormvariate(math.log(80000), 0.6)
    x2 = random.gauss(0, 1); rate = random.uniform(0, 0.002); tiny = random.uniform(0, 1e-6)
    g = random.choice('ABC'); s = random.choice(['Hombre', 'Mujer']); m = s == 'Mujer'
    y = 10 + 0.00004 * inc + 1.5 * x2 + 2.5 * x2 * m + 3 * (g == 'B') + 6 * (g == 'C') + 800 * rate + random.gauss(0, 2.5)
    lp = -1.2 + 0.00001 * inc + 0.6 * x2 + 0.9 * (g == 'C') + 4e5 * tiny
    e = 1 if random.random() < 1 / (1 + math.exp(-lp)) else 0
    lat = 0.00001 * inc + 0.6 * x2 - 300 * rate + 0.5 * (g == 'B') + math.log(1 / random.random() - 1)
    o = 1 if lat < 0.3 else 2 if lat < 1.2 else 3 if lat < 2.2 else 4
    lam = math.exp(0.2 + 0.000004 * inc + 0.25 * x2 + 0.5 * (g == 'C') + 2e5 * tiny); k = 0; L = math.exp(-lam); p = 1.0
    while True:
        p *= random.random()
        if p < L: break
        k += 1
    rows.append(','.join([
        '%.3f' % y, str(e), str(e + 1), 'sí' if e else 'no', str(o), str(k),
        '%.2f' % inc, '%.5f' % (inc / 1000), '%.6f' % (inc / 12), '%.3f' % (inc / 1000), '%.2f' % (inc * 3), '%.1f' % (inc * 10),
        '%.0f' % (1.6e9 + inc * 100), '%.7f' % rate, '%.13f' % tiny, '%.5f' % x2, g, s, '%.4f' % random.uniform(0.4, 2.6), str(i % 25)]))
Path(__file__).with_name('data').joinpath('regression-numerics.csv').write_text('\n'.join(rows) + '\n')
print('wrote', len(rows) - 1, 'rows')
