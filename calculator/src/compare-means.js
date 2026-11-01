  // GM26 compare means begin
  // Tests ▾ → Compare means (build .62): one sentence sets up the t-test, the answer comes first. The statistics are
  // the t-test workspace's (ttDetails, ttRecord, ttGroups, ttCommands, the console printouts), which this page reuses.
  // Designs: two groups of a variable (Welch or Student), a second measurement on the same rows (paired), a fixed
  // value (one sample), or summary numbers typed in (no data file). Two-sided or one-sided.
  cmSet(patch) { this.clearMemo(); this.setState(patch); }
  cmFmt(v) { if (!Number.isFinite(v)) return '—'; const a = Math.abs(v); const s = a >= 1000 ? Math.round(v).toLocaleString('en-US') : a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : Number(v.toPrecision(3)).toString(); return s.replace(/^-/, '−'); }
  cmSigned(v) { return (v > 0 ? '+' : '') + this.cmFmt(v); }
  cmMag(d) { const a = Math.abs(d); return a < 0.2 ? 'negligible' : a < 0.5 ? 'small' : a < 0.8 ? 'medium' : 'large'; }
  cmSkew(a) { const xs = Array.from(a).filter(Number.isFinite), n = xs.length; if (n < 3) return NaN; const m = xs.reduce((s, v) => s + v, 0) / n; let m2 = 0, m3 = 0; for (const v of xs) { const d = v - m; m2 += d * d; m3 += d * d * d; } m2 /= n; m3 /= n; return m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0; }
  cmMedian(a) { const xs = Array.from(a).filter(Number.isFinite).sort((p, q) => p - q), n = xs.length; return !n ? NaN : n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2; }
  // The data behind the current setup, or an error to show.
  cmData() {
    const S = this.state, E = this._E, mode = S.ttMode || 'groups', xn = S.exploreVar, w = !!S.weightVar;
    if (mode === 'summary') {
      const T = Object.assign({ kind: 'two', m1: '', s1: '', n1: '', m2: '', s2: '', n2: '', mu: '0', l1: 'Group 1', l2: 'Group 2' }, S.ttSum || {}), num = k => Number(String(T[k]).replace(',', '.'));
      const g1 = { mean: num('m1'), sd: num('s1'), n: Math.round(num('n1')) }, g2 = { mean: num('m2'), sd: num('s2'), n: Math.round(num('n2')) };
      const bad = g => !(Number.isFinite(g.mean) && g.sd > 0 && g.n >= 2);
      if (bad(g1) || (T.kind === 'two' && bad(g2))) return { T, error: 'Type the mean, the standard deviation (above 0) and the number of cases (2 or more)' + (T.kind === 'two' ? ' for both groups.' : '.') };
      const mu = T.kind === 'two' ? 0 : num('mu'); if (!Number.isFinite(mu)) return { T, error: 'Type the value to compare with.' };
      return { T, summary: true, g1, g2: T.kind === 'two' ? g2 : null, mu, labels: T.kind === 'two' ? [T.l1 || 'Group 1', T.l2 || 'Group 2'] : [T.kind === 'paired' ? 'Differences' : (T.l1 || 'Group 1')] };
    }
    if (w) return { error: 'T-tests use unweighted rows. Clear the weight (Settings) to run one, or use Regression with the survey design.', weight: true };
    if (!xn || !this.effMeta(xn) || !this.numVals(xn)) return { error: 'Choose the outcome: the numeric variable whose means you want to compare.', need: 'outcome' };
    const X = this.numVals(xn).a;
    if (mode === 'value') {
      const mu = String(S.ttMu ?? '').trim() === '' ? NaN : Number(String(S.ttMu).replace(',', '.'));
      if (!Number.isFinite(mu)) return { error: 'Type the value to compare the mean with (e.g. the midpoint of a scale, or a target).', need: 'value' };
      return { mode, x: X, mu, labels: [xn] };
    }
    if (mode === 'paired') {
      const y2 = S.ttY2 && this.effMeta(S.ttY2) ? S.ttY2 : '';
      if (!y2) return { error: 'Choose the second measurement (the same cases measured again, in another column).', need: 'second' };
      if (!this.numVals(y2)) return { error: '“' + y2 + '” is not numeric — the paired test needs two numeric measurements.', need: 'second' };
      return { mode, x: X, y: this.numVals(y2).a, labels: [xn, y2] };
    }
    const gv = S.ttG && this.effMeta(S.ttG) ? S.ttG : '';
    if (!gv) return { error: 'Choose the variable that splits the data into two groups.', need: 'group' };
    const gg = this.ttGroups(), labs = gv ? this.descOrder(gv, this.nvLevels(gv).rows).map(r => String(r.label)) : [];
    if (labs.length < 2) return { error: gv + ' has only one value — it cannot form two groups.', need: 'group', labs };
    if (!gg.first || !gg.second) return { error: gv + ' has ' + labs.length + ' values — pick the two groups to compare.', need: 'levels', labs, gv };
    const g2 = this.vals(gv), lab = i => { const v = g2.a[i]; return g2.kind === 'num' ? (Number.isFinite(v) ? E.numLab(v) : null) : (v == null ? null : String(v)); };
    const xa = new Float64Array(X.length).fill(NaN), xb = new Float64Array(X.length).fill(NaN);
    for (let i = 0; i < X.length; i++) { const l = lab(i); if (l === gg.first) xa[i] = X[i]; else if (l === gg.second) xb[i] = X[i]; }
    return { mode: 'groups', x: xa, y: xb, gv, labs, labels: [String(this.vlabel(gv, gg.first)), String(this.vlabel(gv, gg.second))], gg };
  }
  // The test: estimate, CI, t, df, p (two- or one-sided), d; for summaries computed here from M, SD, n.
  cmResult(D) {
    const S = this.state, E = this._E, a = this.alpha(), alt = S.ttAlt || 'two', eq = !!S.ttEqual;
    let r;
    if (D.summary) {
      const { g1, g2, mu } = D;
      if (g2) {
        const va = g1.sd * g1.sd / g1.n, vb = g2.sd * g2.sd / g2.n, dfP = g1.n + g2.n - 2, sp = Math.sqrt(((g1.n - 1) * g1.sd * g1.sd + (g2.n - 1) * g2.sd * g2.sd) / dfP);
        const se = eq ? sp * Math.sqrt(1 / g1.n + 1 / g2.n) : Math.sqrt(va + vb), df = eq ? dfP : (va + vb) * (va + vb) / (va * va / (g1.n - 1) + vb * vb / (g2.n - 1)), est = g1.mean - g2.mean, t = est / se;
        r = { estimate: est, se, t, df, p: E.pT(t, df), d: est / sp, groups: [g1, g2] };
      } else {
        const se = g1.sd / Math.sqrt(g1.n), df = g1.n - 1, est = g1.mean - mu, t = est / se;
        r = { estimate: est, se, t, df, p: E.pT(t, df), d: est / g1.sd, groups: [g1], mu };
      }
    } else {
      const q = E.ttDetails({ mode: D.mode, x: D.x, y: D.y, mu: D.mu, alpha: a, equal: eq });
      if (q.error) return { error: q.error };
      const ds = arr => { const s = E.descNum(arr, null); return { mean: s.mean, sd: s.sd, n: s.n }; };
      if (D.mode === 'groups') r = { estimate: q.estimate, se: q.se, t: q.t, df: q.df, p: q.p, d: q.d, groups: [ds(D.x), ds(D.y)] };
      else if (D.mode === 'paired') { const xx = [], yy = [], dd = []; for (let i = 0; i < D.x.length; i++) if (Number.isFinite(D.x[i]) && Number.isFinite(D.y[i])) { xx.push(D.x[i]); yy.push(D.y[i]); dd.push(D.x[i] - D.y[i]); } r = { estimate: q.estimate, se: q.se, t: q.t, df: q.df, p: q.p, d: q.mean / q.sd, groups: [ds(xx), ds(yy)], diffs: dd, sdDiff: q.sd }; }
      else r = { estimate: q.estimate - D.mu, se: q.se, t: q.t, df: q.df, p: q.p, d: (q.mean - D.mu) / q.sd, groups: [ds(D.x)], mu: D.mu };
    }
    const two = r.p, one = t => alt === 'gt' ? (t > 0 ? two / 2 : 1 - two / 2) : (t < 0 ? two / 2 : 1 - two / 2);
    r.alt = alt; r.p = alt === 'two' ? two : one(r.t); r.pTwo = two; r.alpha = a;
    if (alt === 'two') { const c = E.ttCritical(a, r.df); r.lo = r.estimate - c * r.se; r.hi = r.estimate + c * r.se; }
    else { const c = E.ttCritical(2 * a, r.df); r.lo = alt === 'gt' ? r.estimate - c * r.se : -Infinity; r.hi = alt === 'lt' ? r.estimate + c * r.se : Infinity; }
    r.sig = r.p < a; r.equal = eq;
    return r;
  }
  cmName(D) {
    const S = this.state, mode = D.summary ? (D.g2 ? 'groups' : D.T.kind === 'paired' ? 'paired' : 'value') : D.mode;
    return { mode, test: mode === 'groups' ? (S.ttEqual ? 'Student’s two-sample t-test (equal variances)' : 'Welch’s two-sample t-test (unequal variances)') : mode === 'paired' ? 'Paired t-test' : 'One-sample t-test', dName: mode === 'paired' ? 'd_z' : 'd' };
  }
  cmApa(D, r) { const N = this.cmName(D); return 't(' + (Number.isInteger(r.df) ? r.df : this.fmt(r.df, 1)) + ') = ' + this.fmt(r.t, 2) + ', ' + this.apaP(r.p) + (r.alt === 'two' ? '' : ' (one-sided)') + ', ' + N.dName + ' = ' + this.fmt(r.d, 2); }
  cmHeadline(D, r) {
    const h = React.createElement, b = s => h('b', null, s), N = this.cmName(D), xn = this.state.exploreVar, pTxt = this.apaP(r.p) + (r.alt === 'two' ? '' : ', one-sided');
    const verdict = r.sig ? ' This difference is statistically significant (' + pTxt + ').' : ' A difference this size could easily be chance (' + pTxt + ').';
    if (N.mode === 'groups') { const [A, B] = D.labels, [gA, gB] = r.groups; return h('p', { className: 'cm-head' }, b(A), ' averages ', b(this.cmFmt(gA.mean)), D.summary ? '' : ' on ' + xn, ' and ', b(B), ' averages ', b(this.cmFmt(gB.mean)), ': ', h('em', null, A + ' is ' + this.cmFmt(Math.abs(r.estimate)) + (r.estimate >= 0 ? ' higher' : ' lower')), ' (' + N.dName + ' = ' + this.fmt(r.d, 2) + ', ' + this.cmMag(r.d) + ').', verdict); }
    if (N.mode === 'paired') { const [g1, g2] = r.groups; return D.summary ? h('p', { className: 'cm-head' }, 'The differences average ', h('em', null, this.cmSigned(r.estimate)), ' (' + N.dName + ' = ' + this.fmt(r.d, 2) + ', ' + this.cmMag(r.d) + ').', verdict) : h('p', { className: 'cm-head' }, 'On the same ', b(this.fmtN(g1.n)), ' rows, ', b(D.labels[0]), ' averages ', b(this.cmFmt(g1.mean)), ' and ', b(D.labels[1]), ' averages ', b(this.cmFmt(g2.mean)), ': a mean difference of ', h('em', null, this.cmSigned(r.estimate)), ' (' + N.dName + ' = ' + this.fmt(r.d, 2) + ', ' + this.cmMag(r.d) + ').', verdict); }
    return h('p', { className: 'cm-head' }, 'The mean' + (D.summary ? '' : ' of ' + xn) + ' is ', b(this.cmFmt(r.groups[0].mean)), ', ', h('em', null, this.cmFmt(Math.abs(r.estimate)) + (r.estimate >= 0 ? ' above ' : ' below ') + this.cmFmt(r.mu)), ' (' + N.dName + ' = ' + this.fmt(r.d, 2) + ', ' + this.cmMag(r.d) + ').', verdict);
  }
  // ---- charts: every case with the means and CIs; the difference against zero with the negligible band
  cmTicks(lo, hi) { const t = this._E.ticks(lo, hi, 5); return t.length ? t : [lo, hi]; }
  cmDots(D, r) {
    const h = React.createElement, E = this._E, a = r.alpha, W = 340, H = 236, X0 = 50, X1 = W - 10, Y0 = 12, Y1 = H - 34, cols = ['#1F6447', '#1A5061'];
    const series = [];
    if (D.summary) r.groups.forEach((g, i) => series.push({ label: D.labels[i] || '', xs: [], g }));
    else if (D.mode === 'paired') series.push({ label: 'each pair: ' + D.labels[0] + ' − ' + D.labels[1], xs: r.diffs, g: { mean: r.estimate, sd: r.sdDiff, n: r.diffs.length } });
    else if (D.mode === 'groups') { series.push({ label: D.labels[0], xs: Array.from(D.x).filter(Number.isFinite), g: r.groups[0] }, { label: D.labels[1], xs: Array.from(D.y).filter(Number.isFinite), g: r.groups[1] }); }
    else series.push({ label: D.labels[0], xs: Array.from(D.x).filter(Number.isFinite), g: r.groups[0] });
    const ci = g => { const c = E.ttCritical(a, g.n - 1) * g.sd / Math.sqrt(g.n); return [g.mean - c, g.mean + c]; };
    const ref = D.mode === 'paired' || (D.summary && D.T.kind === 'paired') ? 0 : (D.mode === 'value' || (D.summary && D.T.kind === 'one')) ? r.mu : null;
    let lo = Infinity, hi = -Infinity; series.forEach(s => { s.xs.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; }); const [l, u] = ci(s.g); lo = Math.min(lo, l); hi = Math.max(hi, u); });
    if (ref != null) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
    if (!(hi > lo)) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    const tk = this.cmTicks(lo, hi), y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0), kids = [];
    tk.forEach((t, i) => kids.push(h('line', { key: 'g' + i, x1: X0, x2: X1, y1: y(t), y2: y(t), stroke: '#EEE8DC' }), h('text', { key: 't' + i, x: X0 - 6, y: y(t) + 3, textAnchor: 'end', fontSize: 10, fill: '#7E7563', fontFamily: 'Space Mono, monospace' }, E.fmtTick ? E.fmtTick(t) : String(t))));
    if (ref != null) kids.push(h('line', { key: 'ref', x1: X0, x2: X1, y1: y(ref), y2: y(ref), stroke: '#8C8372', strokeDasharray: '4 3' }), h('text', { key: 'reft', x: X1, y: y(ref) - 4, textAnchor: 'end', fontSize: 10, fill: '#6B6455' }, ref === 0 && D.mode !== 'value' ? 'no difference' : 'test value ' + this.cmFmt(ref)));
    const band = (X1 - X0) / series.length; let seed = 7; const rnd = () => ((seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648);
    series.forEach((s, i) => {
      const cx = X0 + band * (i + 0.5), col = cols[i % 2], step = Math.max(1, Math.ceil(s.xs.length / 1500));
      for (let k = 0; k < s.xs.length; k += step) kids.push(h('circle', { key: 'p' + i + '_' + k, cx: (cx - 30 + rnd() * 34).toFixed(1), cy: y(s.xs[k]).toFixed(1), r: 2.2, fill: col, opacity: 0.22 }));
      const [l, u] = ci(s.g);
      kids.push(h('line', { key: 'ci' + i, x1: cx + 18, x2: cx + 18, y1: y(l), y2: y(u), stroke: col, strokeWidth: 2.5 }), h('circle', { key: 'm' + i, cx: cx + 18, cy: y(s.g.mean), r: 5.5, fill: col }),
        h('text', { key: 'mv' + i, x: cx + 29, y: y(s.g.mean) + 4, fontSize: 10.5, fontWeight: 700, fill: col, fontFamily: 'Space Mono, monospace' }, this.cmFmt(s.g.mean)),
        h('text', { key: 'l' + i, x: cx, y: H - 14, textAnchor: 'middle', fontSize: 11.5, fill: '#2B271E' }, String(s.label).slice(0, 34) + ' · n ' + this.fmtN(s.g.n)));
    });
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Each case, the means and ' + Math.round(100 * (1 - a)) + '% confidence intervals', ref: this.svgRef('tt'), style: { maxWidth: W + 'px' } }, kids);
  }
  cmDiff(D, r) {
    const h = React.createElement, E = this._E, W = 340, H = 236, X0 = 26, X1 = W - 26, mid = 108;
    const sd = r.groups.length === 2 && this.cmName(D).mode === 'groups' ? Math.sqrt(((r.groups[0].n - 1) * r.groups[0].sd ** 2 + (r.groups[1].n - 1) * r.groups[1].sd ** 2) / (r.groups[0].n + r.groups[1].n - 2)) : r.sdDiff || r.groups[0].sd, neg = 0.2 * sd;
    const lo0 = Number.isFinite(r.lo) ? r.lo : r.estimate - 3 * r.se, hi0 = Number.isFinite(r.hi) ? r.hi : r.estimate + 3 * r.se, m = Math.max(Math.abs(lo0), Math.abs(hi0), neg) * 1.15, lo = -m, hi = m, x = v => X0 + (v - lo) / (hi - lo) * (X1 - X0), tk = this.cmTicks(lo, hi), kids = [];
    kids.push(h('rect', { key: 'neg', x: x(-neg), y: 42, width: x(neg) - x(-neg), height: 104, fill: '#EEF5F0' }), h('text', { key: 'negt', x: x(0), y: 34, textAnchor: 'middle', fontSize: 9.5, fill: '#5D7A68' }, 'negligible (|' + this.cmName(D).dName + '| < 0.2)'), h('line', { key: 'z', x1: x(0), x2: x(0), y1: 42, y2: 146, stroke: '#8C8372', strokeDasharray: '4 3' }));
    const L = Math.max(X0, x(Math.max(lo, r.lo))), U = Math.min(X1, x(Math.min(hi, r.hi)));
    kids.push(h('line', { key: 'ci', x1: L, x2: U, y1: mid, y2: mid, stroke: '#A8521A', strokeWidth: 3 }), h('circle', { key: 'e', cx: x(r.estimate), cy: mid, r: 6.5, fill: '#A8521A' }), h('text', { key: 'et', x: x(r.estimate), y: mid - 14, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: '#A8521A', fontFamily: 'Space Mono, monospace' }, this.cmSigned(r.estimate)));
    if (!Number.isFinite(r.lo)) kids.push(h('text', { key: 'inf1', x: X0 + 2, y: mid + 4, fontSize: 12, fill: '#A8521A' }, '◀'));
    if (!Number.isFinite(r.hi)) kids.push(h('text', { key: 'inf2', x: X1 - 10, y: mid + 4, fontSize: 12, fill: '#A8521A' }, '▶'));
    tk.forEach((t, i) => kids.push(h('text', { key: 't' + i, x: x(t), y: 168, textAnchor: 'middle', fontSize: 10, fill: '#7E7563', fontFamily: 'Space Mono, monospace' }, (t > 0 ? '+' : '') + (E.fmtTick ? E.fmtTick(t) : t))));
    const N = this.cmName(D), left = N.mode === 'groups' ? '← ' + D.labels[1] + ' higher' : N.mode === 'paired' ? '← second higher' : '← below ' + this.cmFmt(r.mu), right = N.mode === 'groups' ? D.labels[0] + ' higher →' : N.mode === 'paired' ? 'first higher →' : 'above ' + this.cmFmt(r.mu) + ' →';
    kids.push(h('text', { key: 'lft', x: X0, y: 198, fontSize: 11, fill: '#6B6455' }, String(left).slice(0, 26)), h('text', { key: 'rgt', x: X1, y: 198, textAnchor: 'end', fontSize: 11, fill: '#6B6455' }, String(right).slice(0, 26)));
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'The difference and its confidence interval', style: { maxWidth: W + 'px' } }, kids);
  }
  // ---- checks students should make
  cmChecks(D, r) {
    const h = React.createElement, N = this.cmName(D), S = this.state, out = [], add = (kind, ...t) => out.push(h('div', { key: out.length, className: 'cm-check ' + kind }, h('b', { 'aria-hidden': 'true' }, kind === 'ok' ? '✓' : kind === 'warn' ? '!' : '?'), h('span', null, ...t)));
    const link = (label, fn) => h('button', { type: 'button', className: 'tl-link', onClick: fn }, label);
    const ns = r.groups.map(g => g.n), small = Math.min(...ns) < 30;
    add(small ? 'warn' : 'ok', small ? 'Small ' + (ns.length > 1 ? 'groups' : 'sample') + ' (' + ns.map(n => this.fmtN(n)).join(' and ') + '): the t-test then needs roughly bell-shaped data — look at the dots.' : 'Large enough: ' + ns.map(n => this.fmtN(n)).join(' and ') + (N.mode === 'paired' ? ' pairs' : ' cases') + (ns.length > 1 ? ' (30 or more each).' : ' (30 or more).'));
    if (N.mode === 'groups') {
      const ratio = Math.max(r.groups[0].sd, r.groups[1].sd) / Math.min(r.groups[0].sd, r.groups[1].sd);
      if (ratio > 2 && S.ttEqual) add('warn', 'The spreads differ (SD ratio ' + this.fmt(ratio, 2) + '): Student’s test assumes equal variances. ', link('Use Welch’s test', () => this.cmSet({ ttEqual: false })));
      else add('ok', 'Spread: SD ratio ' + this.fmt(ratio, 2) + (ratio > 2 ? ' — the groups differ, which Welch’s test allows for.' : ' — similar, so Welch and Student give nearly the same answer.'));
    }
    if (!D.summary) {
      const arrs = N.mode === 'groups' ? [D.x, D.y] : N.mode === 'paired' ? [r.diffs] : [D.x], sk = arrs.map(a => this.cmSkew(a));
      if (sk.some(s => Math.abs(s) > 1)) {
        const nm = N.mode === 'groups' ? D.labels : null, med = arrs.map(a => this.cmMedian(a)), other = N.mode === 'groups' && Math.sign(med[0] - med[1]) !== Math.sign(r.estimate) && med[0] !== med[1];
        add('warn', (N.mode === 'paired' ? 'The differences are' : (this.state.exploreVar || 'The outcome') + ' is') + ' skewed (skew ' + sk.map(s => this.fmt(s, 1)).join(' and ') + ')' + (nm ? '; medians ' + this.cmFmt(med[0]) + ' vs ' + this.cmFmt(med[1]) + (other ? ' — they point the other way' : '') : '') + '. ',
          link(N.mode === 'groups' ? 'Compare medians (Mann–Whitney) →' : 'Wilcoxon signed-rank test →', () => this.asOpen(N.mode === 'groups' ? 'mannwhitney' : 'signedrank')));
      } else add('ok', 'No strong skew (' + sk.map(s => this.fmt(s, 1)).join(' and ') + '), so the mean describes the ' + (N.mode === 'paired' ? 'differences' : 'data') + ' well.');
      add('ask', N.mode === 'paired' ? 'Each row is one case measured twice? Rows missing either value are left out together.' : 'One row per person (or case)? If cases repeat, use Regression with clustered standard errors.');
    } else add('ask', 'Summary numbers: the data themselves cannot be checked for skew or outliers.');
    return h('div', { className: 'cm-checks' }, out);
  }
  // ---- exports: a Word table (APA style) and the same table for the clipboard
  cmTable(D, r) {
    const N = this.cmName(D), f = v => this.cmFmt(v), pct = Math.round(100 * (1 - r.alpha)), ci = (lo, hi) => '[' + (Number.isFinite(lo) ? f(lo) : '−∞') + ', ' + (Number.isFinite(hi) ? f(hi) : '∞') + ']';
    const gci = g => { const c = this._E.ttCritical(r.alpha, g.n - 1) * g.sd / Math.sqrt(g.n); return ci(g.mean - c, g.mean + c); };
    const rows = r.groups.map((g, i) => [D.labels[i] || '', this.fmtN(g.n), f(g.mean), f(g.sd), gci(g)]);
    const diffLab = N.mode === 'groups' ? 'Difference (' + D.labels[0] + ' − ' + D.labels[1] + ')' : N.mode === 'paired' ? 'Mean difference' : 'Difference from ' + f(r.mu);
    rows.push({ c: [diffLab, '', this.cmSigned(r.estimate), '', ci(r.lo, r.hi)], rule: true });
    const xn = this.state.exploreVar, title = (D.summary ? 'Comparison of means from summary statistics' : N.mode === 'groups' ? 'Mean ' + xn + ' by ' + D.gv : N.mode === 'paired' ? xn + ' and ' + D.labels[1] + ' on the same cases' : 'Mean ' + xn + ' compared with ' + f(r.mu));
    const note = 'Note. ' + N.test + ', ' + (r.alt === 'two' ? 'two-sided' : 'one-sided') + ': ' + this.cmApa(D, r) + '. Brackets: ' + pct + '% confidence intervals.' + (D.summary ? '' : ' ' + (this.stampText() || '') + '.');
    return { title, head: [['', 'n', 'M', 'SD', pct + '% CI']], rows, note: note.replace(/\.\.$/, '.') };
  }
  async cmCopyWord(D, r) {
    const T = this.cmTable(D, r), B = [{ k: 'table', title: T.title, head: T.head, rows: T.rows, note: T.note }], html = '<div style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;">' + this.blocksHTML(B, null) + '</div>';
    const txt = [T.title, T.head[0].join('\t'), ...T.rows.map(x => (Array.isArray(x) ? x : x.c).join('\t')), T.note].join('\n');
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([txt], { type: 'text/plain' }) })]); this.flash('Table copied — paste it into Word'); }
    catch (e) { try { await navigator.clipboard.writeText(txt); this.flash('Table copied as text'); } catch (e2) { this.flash('Copy failed'); } }
  }
  cmDocx(D, r) { const T = this.cmTable(D, r); this.dlBlob(this.docxBlob([{ k: 'table', title: T.title, head: T.head, rows: T.rows, note: T.note }]), 'ttest-' + String(this.state.exploreVar || 'summary').replace(/[^A-Za-z0-9_-]+/g, '-') + '.docx'); this.flash('Downloaded a Word file (.docx)'); }
  // ---- summary statistics: a Stata-style printout for the console
  cmSummaryLog(D, r) {
    const T = D.T, n = v => String(Number(v)), N = this.cmName(D), lv = Math.round(100 * (1 - r.alpha)), lev = lv === 95 ? '' : ' level(' + lv + ')';
    const stata = N.mode === 'groups' ? 'ttesti ' + [D.g1.n, D.g1.mean, D.g1.sd, D.g2.n, D.g2.mean, D.g2.sd].map(n).join(' ') + (this.state.ttEqual ? '' : ', unequal') + (lev ? (this.state.ttEqual ? ',' : '') + lev : '') : 'ttesti ' + [D.g1.n, D.g1.mean, D.g1.sd, r.mu].map(n).join(' ') + (lev ? ',' + lev : '');
    const alt = r.alt === 'two' ? '' : ', alternative = "' + (r.alt === 'gt' ? 'greater' : 'less') + '"';
    const rc = N.mode === 'groups' ? 'BSDA::tsum.test(mean.x = ' + n(D.g1.mean) + ', s.x = ' + n(D.g1.sd) + ', n.x = ' + D.g1.n + ', mean.y = ' + n(D.g2.mean) + ', s.y = ' + n(D.g2.sd) + ', n.y = ' + D.g2.n + ', var.equal = ' + (this.state.ttEqual ? 'TRUE' : 'FALSE') + alt + ', conf.level = ' + (1 - r.alpha) + ')' : 'BSDA::tsum.test(mean.x = ' + n(D.g1.mean) + ', s.x = ' + n(D.g1.sd) + ', n.x = ' + D.g1.n + ', mu = ' + n(r.mu) + alt + ', conf.level = ' + (1 - r.alpha) + ')';
    const tbl = [N.test + ' from summary statistics', ...r.groups.map((g, i) => (D.labels[i] || '') + '\tn = ' + g.n + '\tmean = ' + g.mean + '\tsd = ' + g.sd), 'difference\t' + r.estimate + '\t[' + r.lo + ', ' + r.hi + ']', 't = ' + this.fmt(r.t, 4) + '\tdf = ' + this.fmt(r.df, 4) + '\tp = ' + (r.p < 1e-4 ? r.p.toExponential(2) : r.p.toFixed(4)) + (r.alt === 'two' ? '' : ' (one-sided)')].join('\n');
    return { t: 'ttestx', sg: [], stata, r: rc, tbl, tblStata: tbl, tblR: tbl, res: N.test + ' (summaries): ' + this.cmApa(D, r), setup: { tab: 'ttest', ttMode: 'summary', ttSum: T, ttEqual: this.state.ttEqual, ttAlt: r.alt } };
  }
  // ---- the page
  cmRender(out) {
    const h = React.createElement, S = this.state, mode = S.ttMode || 'groups', xn = S.exploreVar;
    const sel = (value, opts, on, aria, cls) => this.tlSelect(value, opts, on, aria, { className: 'tl-select cm-slot' + (cls ? ' ' + cls : '') });
    const numOpts = (ph, not) => [['', ph]].concat((S.cols || []).filter(c => c.type === 'numeric' && c.name !== not).map(c => [c.name, c.name]));
    const anyOpts = (ph, not) => [['', ph]].concat((S.cols || []).filter(c => c.name !== not).map(c => [c.name, c.name + ' · ' + (c.distinct > 1200 ? '1200+' : c.distinct) + ' values']));
    const design = sel(mode, [['groups', 'between two groups of'], ['paired', 'with a second measurement'], ['value', 'with a fixed value'], ['summary', 'using summary numbers (no data)']], v => this.cmSet({ ttMode: v }), 'What to compare with', 'design');
    const D = this.cmData();
    // the sentence
    const line1 = [];
    if (mode === 'summary') {
      const T = D.T, setT = patch => this.cmSet({ ttSum: Object.assign({}, T, patch) }), box = (k, ph, w, aria) => this.tlText(String(T[k] ?? ''), v => setT({ [k]: v }), { placeholder: ph, aria: aria || ph, width: w || 74, k, mono: true });
      line1.push('Compare ', design, ' ', this.tlSeg([['two', 'two groups'], ['one', 'one group vs a value'], ['paired', 'paired differences']], T.kind, v => setT({ kind: v }), { className: 'tl-row cm-inline' }));
      const grp = (i, lab, gl = T.kind === 'two' ? ' of group ' + i : '') => h('div', { key: 'g' + i, className: 'cm-sumrow' }, T.kind === 'two' ? this.tlText(T['l' + i], v => setT({ ['l' + i]: v }), { aria: 'Name of group ' + i, width: 110, k: 'l' + i }) : h('span', { className: 'cm-sumlab' }, lab), h('span', { className: 'tl-lbl' }, 'mean'), box('m' + i, 'mean', 0, 'Mean' + gl), h('span', { className: 'tl-lbl' }, 'SD'), box('s' + i, 'SD', 0, 'SD' + gl), h('span', { className: 'tl-lbl' }, 'n'), box('n' + i, 'n', 64, 'n' + gl));
      const sums = [grp(1, T.kind === 'paired' ? 'differences' : 'the group')];
      if (T.kind === 'two') sums.push(grp(2));
      else sums.push(h('div', { key: 'mu', className: 'cm-sumrow' }, h('span', { className: 'cm-sumlab' }, T.kind === 'paired' ? 'compared with' : 'test value'), box('mu', 'value', 90)));
      line1.push(h('div', { key: 'sums', className: 'cm-sums' }, sums));
    } else {
      line1.push('Compare the mean of ', sel(xn || '', numOpts('choose the outcome…'), v => this.cmSet({ exploreVar: v }), 'Outcome'), ' ', design, ' ');
      if (mode === 'groups') line1.push(sel(S.ttG || '', anyOpts('choose the groups…', xn), v => this.cmSet({ ttG: v, ttA: '', ttB: '', ttSwap: false }), 'Group variable'));
      else if (mode === 'paired') line1.push(sel(S.ttY2 || '', numOpts('choose the second measurement…', xn), v => this.cmSet({ ttY2: v }), 'Second measurement'));
      else line1.push(this.tlText(String(S.ttMu ?? ''), v => this.cmSet({ ttMu: v }), { placeholder: 'value', aria: 'Value to compare with', width: 110, k: 'mu', mono: true }));
    }
    const sentence = [h('div', { key: 's1', className: 'cm-sentence' }, ...line1)];
    if (mode === 'groups' && D.labs && D.labs.length > 2) {
      const lvOpts = ph => [['', ph]].concat(D.labs.slice(0, 400).map(l => [l, String(this.vlabel(S.ttG, l))]));
      sentence.push(h('div', { key: 's2', className: 'cm-sentence' }, sel(S.ttA || '', lvOpts('first group…'), v => this.cmSet({ ttA: v, ttB: S.ttB === v ? '' : S.ttB }), 'First group'), ' minus ', sel(S.ttB || '', lvOpts('second group…'), v => this.cmSet({ ttB: v }), 'Second group'),
        D.labels ? this.tlBtn('⇄ swap', () => this.cmSet({ ttA: S.ttB, ttB: S.ttA }), '', { 'aria-label': 'Swap the two groups' }) : null));
    } else if (mode === 'groups' && D.labels) {
      sentence.push(h('div', { key: 's2', className: 'cm-sentence' }, h('span', { className: 'cm-grp a' }, D.labels[0]), ' minus ', h('span', { className: 'cm-grp b' }, D.labels[1]), this.tlBtn('⇄ swap', () => this.cmSet({ ttSwap: !S.ttSwap }), '', { 'aria-label': 'Swap the two groups' })));
    }
    const twoSamples = mode === 'groups' || (mode === 'summary' && D.T && D.T.kind === 'two'), lvl = Math.round(100 * (1 - this.alpha()));
    const altLab = mode === 'groups' || (mode === 'summary' && D.T && D.T.kind === 'two') ? ['first > second', 'first < second'] : mode === 'paired' || (D.T && D.T.kind === 'paired') ? ['first > second', 'first < second'] : ['mean > value', 'mean < value'];
    const settings = h('div', { className: 'tl-row cm-settings' },
      twoSamples ? h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'Variances'), this.tlSeg([['w', 'Welch (unequal)', 'Does not assume equal variances. Stata: ttest …, by() unequal; R’s default.'], ['s', 'Student (equal)', 'Pools the two standard deviations. Stata’s default ttest …, by(); R: var.equal = TRUE.']], S.ttEqual ? 's' : 'w', v => this.cmSet({ ttEqual: v === 's' }), { 'aria-label': 'Variances' })) : null,
      h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'CI'), this.tlSeg([[90, '90%'], [95, '95%'], [99, '99%']], lvl, v => this.cmSet({ alphaSel: String(+(1 - v / 100).toFixed(2)) }), { 'aria-label': 'Confidence level' })),
      h('span', { className: 'cm-set' }, h('span', { className: 'tl-lbl' }, 'Test'), this.tlSeg([['two', 'two-sided'], ['gt', altLab[0]], ['lt', altLab[1]]], S.ttAlt || 'two', v => this.cmSet({ ttAlt: v }), { 'aria-label': 'Alternative hypothesis' })));
    const setup = h('section', { className: 'tl-panel cm-setup' }, h('div', { className: 'tl-ptitle' }, h('h3', null, 'Compare means'), h('span', null, 't-tests')), h('div', { className: 'cm-body' }, ...sentence, settings));
    // the answer
    let answer;
    if (D.error) {
      answer = h('div', { className: 'cm-body' }, this.tlBanner(D.weight ? 'warn' : 'info', D.error, D.weight ? [' ', this.tlBtn('Clear the weight', () => this.cmSet({ weightVar: '', weightAuto: false }))] : null),
        D.need === 'group' && mode === 'groups' ? h('p', { className: 'cm-hint' }, 'No 0/1 variable yet? ', h('button', { type: 'button', className: 'tl-link', onClick: () => this.setState({ tab: 'data', deTask: '' }) }, 'Data → Make a new variable → Yes / No (0/1)')) : null);
    } else {
      const r = this.cmResult(D);
      if (r.error) answer = h('div', { className: 'cm-body' }, this.tlBanner('warn', r.error));
      else {
        const N = this.cmName(D), pct = Math.round(100 * (1 - r.alpha)), ciTxt = (Number.isFinite(r.lo) ? this.cmSigned(r.lo) : '−∞') + ' to ' + (Number.isFinite(r.hi) ? this.cmSigned(r.hi) : '∞');
        if (D.summary) this._ttLast = this.cmSummaryLog(D, r);
        else if (this._ttLast && r.alt !== 'two') { const L = this._ttLast; this._ttLast = Object.assign({}, L, { r: String(L.r).replace(/\)$/, ', alternative = "' + (r.alt === 'gt' ? 'greater' : 'less') + '")'), res: L.res + ' (one-sided p ' + this.apaP(r.p).replace(/^p /, '') + ')' }); }
        const L = this._ttLast, used = N.mode === 'paired' ? r.groups[0].n : r.groups.reduce((t, g) => t + g.n, 0);
        const pill = h('span', { className: 'cm-pill ' + (r.sig ? 'sig' : 'ns') }, (r.sig ? 'SIGNIFICANT · ' : 'NOT SIGNIFICANT · ') + this.apaP(r.p) + (r.alt === 'two' ? '' : ' one-sided'));
        const meta = h('span', { className: 'cm-meta' }, N.test + (D.summary ? ' · from summary numbers' : ' · ' + this.fmtN(used) + (N.mode === 'paired' ? ' complete pairs' : ' cases used') + ' of ' + this.fmtN(this.keptN())));
        const stats = h('div', { className: 'cm-stats' }, this.tlStat('DIFFERENCE · ' + pct + '% CI', this.cmSigned(r.estimate), ciTxt), this.tlStat('T (DF)', this.fmt(r.t, 2), (Number.isInteger(r.df) ? r.df : this.fmt(r.df, 1)) + ' df'), this.tlStat('P (' + (r.alt === 'two' ? 'TWO-SIDED' : 'ONE-SIDED') + ')', this.fmtP(r.p), 'α = ' + this.alpha()), this.tlStat(N.mode === 'paired' ? "COHEN'S D_Z" : "COHEN'S D", this.fmt(r.d, 2), this.cmMag(r.d)));
        const charts = h('div', { className: 'cm-charts' }, h('figure', null, h('figcaption', { className: 'tl-lbl' }, D.summary ? 'Means and ' + pct + '% CIs' : N.mode === 'paired' ? 'Each pair’s difference, its mean and ' + pct + '% CI' : 'Every case, the mean and ' + pct + '% CI'), this.cmDots(D, r)), h('figure', null, h('figcaption', { className: 'tl-lbl' }, 'The difference and its ' + pct + '% CI'), this.cmDiff(D, r)));
        const apa = this.cmApa(D, r), cmdTxt = L ? this.cmdText(L, S.dialect) : '';
        const actions = h('div', { className: 'tl-row cm-actions' },
          h('span', { className: 'cm-apa' }, h('span', { className: 'cm-k' }, 'APA'), h('span', null, apa)),
          this.tlBtn('Copy APA', () => { try { navigator.clipboard.writeText(apa).then(() => this.flash('APA line copied')); } catch (e) {} }),
          this.tlBtn('Word table (.docx)', () => this.cmDocx(D, r), 'primary'), this.tlBtn('Copy table for Word', () => this.cmCopyWord(D, r)),
          this.tlBtn('Pin to report', () => this.pinTab()), this.tlBtn('Add to console', () => { if (this._ttLast) this.pushLog(Object.assign({}, this._ttLast)); this.flash('Added to the console'); }),
          mode === 'groups' && D.labs && D.labs.length > 2 ? this.tlBtn('All ' + D.labs.length + ' groups: ANOVA →', () => this.setState({ tab: 'two', twoMode: 'means', yVar: xn, xVar: S.ttG })) : null);
        const code = L ? h('details', { className: 'cm-code' }, h('summary', null, (S.dialect === 'r' ? 'R' : 'Stata') + ' output · ', h('code', null, cmdTxt.split('\n').pop())), h('pre', null, cmdTxt + '\n\n' + ((S.dialect === 'r' ? L.tblR : L.tblStata) || L.tbl || ''))) : null;
        answer = h('div', { className: 'cm-body' }, h('div', { className: 'tl-row cm-top' }, pill, meta), this.cmHeadline(D, r), stats, charts, this.cmChecks(D, r), actions, code);
      }
    }
    return h('div', { className: 'tl cm' }, setup, h('section', { className: 'tl-panel cm-answer', 'aria-live': 'polite' }, answer));
  }
  // GM26 compare means end
