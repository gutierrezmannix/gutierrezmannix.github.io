  // ---- step 6: ties & similarity — homophily and the network model (ERGM by MCMC, like R's ergm)
  nlDefaultModel(net) {
    const cat = this.nlBestAttr(net, true);
    return (net.directed ? [{ t: 'mutual' }] : [{ t: 'gwesp' }]).concat(cat ? [{ t: 'nodematch', a: cat }] : []);
  }
  nlBestAttr(net, noMissing) {
    return this.memo('nlbest|' + net.key + '|' + !!noMissing, () => { let best = null, bv = -Infinity;
      for (const [k, a] of Object.entries(net.attrs)) { if (a.kind !== 'cat' || a.levels.length < 2 || a.levels.length > 12 || (noMissing && a.missing)) continue;
        let w = 0, m = 0; for (const [i, j] of net.edges) { if (a.v[i] == null || a.v[j] == null) continue; m++; if (a.v[i] === a.v[j]) w++; }
        const cnt = new Map(); let no = 0; for (const v of a.v) if (v != null) { cnt.set(v, (cnt.get(v) || 0) + 1); no++; } let ex = 0; for (const c of cnt.values()) ex += c * (c - 1); ex = no > 1 ? ex / (no * (no - 1)) : 1;
        const sc = m ? w / m - ex : -1; if (sc > bv) { bv = sc; best = k; } }
      return best; });
  }
  nlEffectSentence(c, term) {
    // numbers in large units (e.g. followers, tweets): say the effect per 10, 100, 1,000 … units so it is readable
    const at = term.a && this._nlLastNet && this._nlLastNet.attrs[term.a];
    if (at && at.kind === 'num' && ['nodecov', 'nodeicov', 'nodeocov', 'absdiff'].includes(term.t)) { const xs = Array.from(at.x).filter(isFinite), m = xs.reduce((s2, v) => s2 + v, 0) / xs.length, sdv = Math.sqrt(xs.reduce((s2, v) => s2 + (v - m) ** 2, 0) / Math.max(1, xs.length - 1)); const k = sdv >= 10 ? Math.pow(10, Math.floor(Math.log10(sdv))) : 1;
      if (k > 1) { const o2 = Math.exp(c.b * k), x2 = o2 >= 10 ? this.fmt(o2, 0) : this.fmt(o2, 2), unit = this.fmtN(k), base = { nodecov: 'Each extra ' + unit + ' of ' + term.a + ' multiplies the odds of a tie by ×' + x2, nodeicov: 'Each extra ' + unit + ' of ' + term.a + ' multiplies the odds of receiving a tie by ×' + x2, nodeocov: 'Each extra ' + unit + ' of ' + term.a + ' multiplies the odds of sending a tie by ×' + x2, absdiff: 'Each ' + unit + ' of difference in ' + term.a + ' multiplies the odds of a tie by ×' + x2 }[term.t]; return base + (c.p < 0.05 ? '.' : ' — not clearly different from chance (p = ' + this.fmt(c.p, 2) + ').'); } }
    const or = c.or, x = isFinite(or) ? (or >= 10 ? this.fmt(or, 0) : this.fmt(or, 2)) : '—', sig = c.p < 0.05, tail = sig ? '' : ' — not clearly different from chance (p = ' + this.fmt(c.p, 2) + ').';
    const s = {
      edges: 'Baseline: the log-odds of a tie when every other effect is zero.',
      mutual: 'If someone sends you a tie, the odds that you send one back are ×' + x + '.',
      gwesp: 'Pairs who share contacts are more likely to be tied: ×' + x + ' for the first shared contact, a little less for each extra one.',
      gwideg: or < 1 ? 'Ties received concentrate on a few popular people (×' + x + ').' : 'Ties received are spread more evenly than chance (×' + x + ').',
      gwodeg: or < 1 ? 'Ties sent come from a few very active people (×' + x + ').' : 'Ties sent are spread more evenly than chance (×' + x + ').',
      gwdeg: or < 1 ? 'Ties concentrate on a few very connected people (×' + x + ').' : 'Ties are spread more evenly than chance (×' + x + ').',
      nodematch: 'Pairs with the same ' + term.a + ' are ×' + x + ' as likely to be tied.',
      nodecov: 'Each extra unit of ' + term.a + ' multiplies the odds of a tie by ×' + x + '.',
      nodeicov: 'Each extra unit of ' + term.a + ' multiplies the odds of receiving a tie by ×' + x + '.',
      nodeocov: 'Each extra unit of ' + term.a + ' multiplies the odds of sending a tie by ×' + x + '.',
      absdiff: 'Each unit of difference in ' + term.a + ' multiplies the odds of a tie by ×' + x + (or < 1 ? ' — similar people tie more.' : '.')
    }[term.t];
    return term.t === 'edges' ? s : s.replace(/\.$/, '') + (sig ? '.' : tail);
  }
  // a small alert that says why the model did not converge and offers the fix (remove the effect to blame, or run longer)
  nlWhy(res, model, to, runLonger, longer) {
    const h = React.createElement, E = this._E, W = res.why || [];
    if (!W.length && !res.warning) return null;
    const r = W[0] || { title: 'Not converged', text: res.warning, term: -1, fix: 'longer' }, t = r.term > 0 && res.terms ? res.terms[r.term] : null, btns = [];
    if (r.fix === 'remove' && t) btns.push(this.tlBtn('Remove “' + E.nlTermLabel(t) + '” and run', () => { const m = model.filter(x => !(x.t === t.t && (x.a || '') === (t.a || ''))); this.nlSetIn('ties', { model: m, run: (to.run || 0) + 1, ranSig: JSON.stringify(m) + '|' + (to.drop ? 'drop' : '') }); }, 'green'));
    btns.push(this.tlBtn(longer >= 2 ? 'Run even longer' : 'Run longer', runLonger, r.fix === 'longer' ? 'green' : '', { title: 'Doubles the time allowed (now up to ' + Math.round(Math.min(360, 90 * Math.pow(2, longer + 1)) / 60) + ' min) and starts a fresh simulation' }));
    return h('div', { className: 'nl-why', role: 'alert' },
      h('div', { className: 'nl-why-t' }, h('b', null, '⚠ Why it did not converge:'), ' ', r.title),
      h('p', null, r.text),
      W.length > 1 ? h('p', { className: 'nl-why-also' }, 'Also: ' + W.slice(1).map(x => x.title).join(' · ')) : null,
      h('div', { className: 'tl-row' }, ...btns));
  }
  nlStepTies(o, B) {
    const h = React.createElement, E = this._E, net = B.net, to = o.ties;
    const cats = Object.keys(net.attrs), attr = to.attr && net.attrs[to.attr] ? to.attr : (this.nlBestAttr(net) || cats[0]);
    // birds of a feather
    let left;
    if (!attr) left = this.tlPanel('Birds of a feather?', 'homophily', null, this.tlBanner('info', 'Load a people file with characteristics (step 1) to see whether similar people are tied more often.'));
    else {
      const J = this.nlJob(net, 'mix|' + attr, 'nlMixing', [net, attr, 1000, 26], 'Shuffling characteristics'), X = J.done ? J.value : null;
      let body;
      if (!X) body = this.tlPending(J.label || 'Shuffling characteristics', J.p);
      else if (X.error) body = this.tlBanner('warn', X.error);
      else if (X.kind === 'cat') {
        const lv = X.levels.slice(0, 10), pct = x => Math.round(100 * x) + '%';
        body = h(React.Fragment, null,
          h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl nl-mix' }, h('thead', null, h('tr', null, h('th', null, (net.directed ? 'from \\ to' : attr)), lv.map(l => h('th', { key: l, className: 'n' }, l)), h('th', { className: 'n' }, 'within'))),
            h('tbody', null, lv.map((l, i) => { const row = X.matrix[i], tot = row.reduce((a, b) => a + b, 0); return h('tr', { key: l }, h('td', { className: 'w' }, l), lv.map((m, j) => h('td', { key: m, className: 'n' + (i === j ? ' hl' : '') }, this.fmtN(row[j]))), h('td', { className: 'n' }, tot ? pct(row[i] / tot) : '—')); })))),
          h('div', { className: 'tl-stats' }, this.tlStat('ties within', pct(X.within), pct(X.expected) + ' expected by chance'), this.tlStat('E–I index', this.fmt(X.ei, 2), '−1 all inside · +1 all across'), this.tlStat('assortativity', this.fmt(X.assort, 2), X.pMore < 0.05 ? 'p ' + (X.pMore < 0.001 ? '< .001' : '= ' + this.fmt(X.pMore, 3)) + ' · ' + this.fmtN(X.perms) + ' shuffles' : 'not different from chance')),
          this.nlWhat(X.within > X.expected && X.pMore < 0.05 ? 'Ties stay within the same ' + attr + (X.within >= 2 * X.expected ? ' far more often' : ' more often') + ' than chance (' + pct(X.within) + ' vs ' + pct(X.expected) + '): “birds of a feather flock together” (homophily, Kadushin ch. 2). The p-value comes from shuffling ' + attr + ' among the people ' + this.fmtN(X.perms) + ' times.' : X.pLess < 0.05 ? 'Ties cross ' + attr + ' groups more than chance — heterophily.' : 'Ties are not more concentrated within ' + attr + ' groups than chance would produce.', X.missing ? ' ' + X.missing + ' people without a value are left out.' : ''));
      } else body = h(React.Fragment, null, h('div', { className: 'tl-stats' }, this.tlStat('difference, tied pairs', this.fmt(X.tiedDiff, 3)), this.tlStat('difference, untied pairs', this.fmt(X.untiedDiff, 3)), this.tlStat('assortativity', this.fmt(X.assort, 2), 'p (closer than chance) ' + (X.pCloser < 0.001 ? '< .001' : '= ' + this.fmt(X.pCloser, 3)))),
        this.nlWhat(X.pCloser < 0.05 ? 'Tied people have more similar ' + attr + ' than chance would produce (homophily).' : 'Tied people are not more similar in ' + attr + ' than chance.', X.missing ? ' ' + X.missing + ' people without a value are left out.' : ''));
      left = this.tlPanel('Birds of a feather?', 'who is tied to whom, by', this.tlSelect(attr, cats.map(a => [a, a]), v => this.nlSetIn('ties', { attr: v }), 'Characteristic'), body);
    }
    // the model
    const model = to.model || this.nlDefaultModel(net), setModel = m => this.nlSetIn('ties', { model: m }), has = t => model.some(x => x.t === t && !x.a);
    const toggle = t => setModel(has(t) ? model.filter(x => !(x.t === t && !x.a)) : model.concat([{ t }]));
    const struct = (net.directed ? [['mutual', 'they are returned'], ['gwesp', 'friends of friends'], ['gwideg', 'a few receive many'], ['gwodeg', 'a few send many']] : [['gwesp', 'friends of friends'], ['gwdeg', 'a few have many ties']]);
    const chips = model.filter(x => x.a).map((x, i) => this.tlChip(E.nlTermLabel(x) + '  ×', true, () => setModel(model.filter(y => y !== x)), { key: 'a' + i, title: 'Remove' }));
    const usable = cats.filter(a => (net.attrs[a].kind === 'num' || net.attrs[a].levels.length > 1));
    const addRows = usable.map(a => { const at = net.attrs[a], opts = at.kind === 'cat' ? [['nodematch', 'same value → more ties']] : [['absdiff', 'similar values → more ties'], ...(net.directed ? [['nodeicov', 'higher → receives more'], ['nodeocov', 'higher → sends more']] : [['nodecov', 'higher → more ties']]), ['nodematch', 'same value → more ties']];
      return h('tr', { key: a }, h('td', { className: 'w' }, a, h('em', { className: 'tl-hint' }, at.kind === 'num' ? ' number' : ' ' + at.levels.length + ' groups', at.missing ? ' · ' + at.missing + ' missing' : '')), h('td', null, h('div', { className: 'tl-row' }, opts.map(([t, l]) => { const on = model.some(x => x.t === t && x.a === a); return this.tlChip((on ? '✓ ' : '') + l, on, () => setModel(on ? model.filter(x => !(x.t === t && x.a === a)) : model.concat([{ t, a }])), { key: t }); })))); });
    const sig = JSON.stringify(model) + '|' + (to.drop ? 'drop' : '');
    let mnet = net, dropped = 0; this._nlLastNet = net;
    if (to.drop) { const used = model.filter(x => x.a).map(x => x.a), keep = Array.from({ length: net.n }, (_, i) => used.every(a => net.attrs[a].kind === 'cat' && model.every(x => x.a !== a || x.t === 'nodematch') ? net.attrs[a].v[i] != null : isFinite(net.attrs[a].x[i]))); dropped = keep.filter(k => !k).length; if (dropped) { mnet = E.nlSubnet(net, keep); mnet.key = net.key + '|drop' + used.join(','); } }
    const ran = to.ranSig === sig && to.run > 0;
    // Run longer: each press doubles the time allowed (up to 6 minutes), allows more rounds and starts a fresh chain
    const longer = to.longerSig === sig ? (to.longer || 0) : 0, budget = Math.min(360, 90 * Math.pow(2, longer));
    const runLonger = () => this.nlSetIn('ties', { longer: longer + 1, longerSig: sig, run: (to.run || 0) + 1, ranSig: sig });
    const jobKey = 'ergm|' + to.run + '|' + longer + '|' + sig;
    let res = null, status = null;
    if (ran) {
      const J = this.nlJob(mnet, jobKey, 'nlErgm', [mnet, model.map(x => Object.assign({}, x)), { seed: 26 + longer, gofSims: 100, seconds: budget, maxIter: 30 + 30 * longer }], 'Estimating the model');
      if (!J.done) { status = h('div', { className: 'nl-run' }, this.tlPending((J.label || 'Starting') + ' — MCMC, like R’s ergm()', J.p), this.tlBtn('Cancel', () => { this.tlCancel('nl|' + mnet.key + '|' + jobKey); this.nlSetIn('ties', { run: 0 }); })); }
      else res = J.value;
    }
    const runBtn = this.tlBtn(ran && res ? 'Run again' : '▶ Run', () => this.nlSetIn('ties', { run: (to.run || 0) + 1, ranSig: sig }), 'green');
    let results = null;
    if (res && res.error) {
      const fixes = [];
      if (res.kind === 'missing' && res.missing && res.missing.length) { fixes.push(this.tlBtn('Leave those ' + res.missing[0].count + ' out of the model', () => this.nlSetIn('ties', { drop: true, run: (to.run || 0) + 1, ranSig: JSON.stringify(model) + '|drop' }), 'green')); fixes.push(this.tlBtn('Remove “' + res.missing[0].a + '” reasons', () => setModel(model.filter(x => x.a !== res.missing[0].a)))); }
      else if (res.term != null && res.term > 0) { const t = (res.terms || E.nlErgmCheck(mnet, model).terms || [])[res.term]; if (t) fixes.push(this.tlBtn('Remove “' + E.nlTermLabel(t) + '”', () => setModel(model.filter(x => !(x.t === t.t && x.a === t.a))))); }
      results = this.tlBanner('warn', h('b', null, res.kind === 'degenerate' ? '✗ The model is degenerate. ' : res.kind === 'missing' ? '✗ Can’t run yet. ' : '✗ Could not estimate the model. '), res.error, fixes.length ? h('div', { className: 'tl-row' }, ...fixes) : null);
    } else if (res) {
      const ok = res.converged && !res.warning;
      const badge = h('div', { className: 'nl-badge ' + (ok ? 'ok' : 'warn') }, h('b', null, ok ? '✓ Converged' : '⚠ Not converged'), h('span', null, 'MCMC maximum likelihood · ' + res.iterations + ' rounds · ' + this.fmt(res.seconds, 1) + ' s · ' + this.fmtN(res.dyads) + ' pairs' + (longer ? ' · longer run (up to ' + Math.round(budget / 60) + ' min)' : '') + (dropped ? ' · ' + dropped + ' people left out (missing values)' : '')));
      const lx = v => 8 + 180 * (Math.log(Math.max(0.2, Math.min(20, v))) - Math.log(0.2)) / (Math.log(20) - Math.log(0.2));
      const forest = c => h('svg', { width: 196, height: 18, 'aria-hidden': 'true' }, h('line', { x1: lx(1), x2: lx(1), y1: 0, y2: 18, stroke: '#AB9F8A', strokeDasharray: '2 2' }), h('line', { x1: lx(c.lo), x2: lx(c.hi), y1: 9, y2: 9, stroke: c.p < 0.05 ? '#2E7D58' : '#AB9F8A', strokeWidth: 2 }), h('circle', { cx: lx(c.or), cy: 9, r: 4.5, fill: c.p < 0.05 ? '#2E7D58' : '#FFFFFF', stroke: c.p < 0.05 ? '#2E7D58' : '#AB9F8A', strokeWidth: 1.5 }));
      const rows = res.coefs.map((c, k) => k === 0 ? null : h('tr', { key: k }, h('td', null, h('b', null, c.term), h('br'), h('span', { className: 'tl-hint' }, this.nlEffectSentence(c, res.terms[k]))), h('td', { className: 'n' }, isFinite(c.or) ? this.fmt(c.or, 2) : '—'), h('td', null, forest(c)), h('td', { className: 'n' }, c.p < 0.001 ? '< .001' : this.fmt(c.p, 3)), to.est ? h('td', { className: 'n' }, this.fmt(c.b, 3) + ' (' + this.fmt(c.se, 3) + ')') : null, to.est ? h('td', { className: 'n' }, this.fmt(res.mple.coef[k], 3)) : null));
      const tbl = h('table', { className: 'tl-tbl nl-model' }, h('thead', null, h('tr', null, h('th', null, 'reason · in words'), h('th', { className: 'n' }, 'odds ×'), h('th', null, '0.2 · 1 · 20'), h('th', { className: 'n' }, 'p'), to.est ? h('th', { className: 'n' }, 'estimate (SE)') : null, to.est ? h('th', { className: 'n' }, 'MPLE') : null)), h('tbody', null, rows));
      results = h(React.Fragment, null, badge, this.nlWhy(res, model, to, runLonger, longer), h('div', { className: 'tl-tblwrap' }, tbl),   // scrolls sideways in a narrow window (estimates, SE and MPLE shown)
        h('div', { className: 'tl-row' }, this.tlChip('show estimates, SE and MPLE', !!to.est, () => this.nlSetIn('ties', { est: !to.est })), this.tlBtn(this.state.copied === 'nlergm' ? 'Copied ✓' : 'Copy table', () => this.copyTSV('nlergm', ['effect\tR term\testimate\tSE\tz\tp\todds ratio'].concat(res.coefs.map(c => [c.term, c.r, c.b, c.se, c.z, c.p, c.or].join('\t'))).join('\n')))),
        res.gof ? this.nlGofView(res.gof, net.directed) : null);
    }
    const builder = this.tlPanel('Why do ties form?', 'network model (ERGM) — pick what you think creates ties, then Run', runBtn,
      h('div', { className: 'tl-field' }, h('span', { className: 'tl-lbl' }, 'Ties form because…'), h('div', { className: 'tl-row' }, struct.map(([t, l]) => this.tlChip((has(t) ? '✓ ' : '+ ') + l, has(t), () => toggle(t), { key: t })), chips)),
      usable.length ? h('details', { className: 'tl-details nl-add', open: !model.some(x => x.a) }, h('summary', null, '+ add a reason from the people’s characteristics'), h('table', { className: 'tl-tbl' }, h('tbody', null, addRows)), h('span', { className: 'tl-hint' }, 'Only usable characteristics are listed (IDs, names, text and NodeXL display columns are left out).')) : null,
      ran && !res ? status : null, !ran && to.run ? this.tlBanner('info', 'The model changed — press Run.') : null, results,
      h('details', { className: 'tl-details code' }, h('summary', null, 'R code (statnet ergm)'), h('pre', { className: 'tl-code' }, 'library(ergm)\n' + E.nlErgmRCode(model, mnet))),
      h('span', { className: 'tl-hint' }, 'Estimated by Markov chain Monte Carlo maximum likelihood, as R’s ergm(): simulated networks are compared with yours until they match. Starting values come from pseudo-likelihood (MPLE). “Friends of friends” is gwesp(0.5, fixed); popularity terms are gwdegree(0.5, fixed).'));
    return h(React.Fragment, null, h('div', { className: 'nl-two wide' }, left, builder), this.nlNav(o, ['groups', 'Groups'], ['time', 'Over time']));
  }
  // goodness of fit like statnet's gof(): observed line inside the band of simulated networks
  nlGofView(G, directed) {
    const h = React.createElement, names = { idegree: 'Ties received', odegree: 'Ties sent', degree: 'Ties per node', espartners: 'Shared contacts per tie', distance: 'Steps between pairs' };
    const charts = Object.keys(names).filter(k => G[k]).map(k => {
      const rows = G[k], W = 300, H = 150, Bm = 22, n = rows.length, mx = Math.max(1, ...rows.map(r => Math.max(r.obs, r.hi, r.max))), mxL = mx >= 1e4 ? this.fmt(mx / 1000, 0) + 'k' : this.fmtN(Math.round(mx)), L = Math.max(34, 8 + mxL.length * 6), x = i => L + (W - L - 8) * (n > 1 ? i / (n - 1) : 0.5), y = v => H - Bm - (H - Bm - 10) * v / mx;
      const band = rows.map((r, i) => x(i) + ',' + y(r.hi)).join(' ') + ' ' + rows.slice().reverse().map((r, i) => x(n - 1 - i) + ',' + y(r.lo)).join(' ');
      const bad = rows.filter(r => r.p < 0.05).length;
      return h('div', { key: k, className: 'nl-gof' }, h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': names[k] + ': observed vs simulated' },
        h('rect', { width: W, height: H, fill: '#fff' }), h('polygon', { points: band, fill: '#D5E8DD' }), h('polyline', { points: rows.map((r, i) => x(i) + ',' + y(r.med)).join(' '), fill: 'none', stroke: '#8FBFA3', strokeWidth: 1, strokeDasharray: '3 2' }),
        h('polyline', { points: rows.map((r, i) => x(i) + ',' + y(r.obs)).join(' '), fill: 'none', stroke: '#1A1711', strokeWidth: 1.6 }), rows.map((r, i) => r.p < 0.05 ? h('circle', { key: i, cx: x(i), cy: y(r.obs), r: 2.6, fill: '#B0572F' }) : null),
        h('line', { x1: L, x2: W - 8, y1: H - Bm, y2: H - Bm, stroke: '#D2C5AF' }), rows.map((r, i) => (i % Math.ceil(n / 8) === 0 && (i === n - 1 || n - 1 - i >= Math.ceil(n / 8) / 2)) || i === n - 1 ? h('text', { key: 't' + i, x: x(i), y: H - 8, fontSize: 9, textAnchor: 'middle', fill: '#6B6455', fontFamily: "'Space Mono', monospace" }, r.label) : null),
        h('text', { x: L - 4, y: 14, fontSize: 9, textAnchor: 'end', fill: '#6B6455', fontFamily: "'Space Mono', monospace" }, mxL)),
        h('span', { className: 'tl-hint' }, h('b', null, names[k]), ' — ' + (bad <= Math.max(1, Math.round(0.1 * n)) ? 'fits well' : bad + ' of ' + n + ' values outside the simulated range')));
    });
    return h('div', null, h('span', { className: 'tl-lbl' }, 'Does the model reproduce your network? (goodness of fit, ' + G.nsim + ' simulated networks)'), h('div', { className: 'nl-gofs' }, charts), h('span', { className: 'tl-hint' }, 'Black line = your network; green band = 95% of networks simulated from the model; red dots = values the model does not reproduce. Like plot(gof(fit)) in R.'));
  }
  // ---- step 7: over time and sub-networks
  nlStepTime(o, B) {
    const h = React.createElement, E = this._E, net = B.net, years = Object.keys(B.info.years).map(Number).sort((a, b) => a - b);
    const cats = Object.keys(net.attrs).filter(a => net.attrs[a].kind === 'cat'), attr = o.time.attr && net.attrs[o.time.attr] ? o.time.attr : cats[0];
    let timeP;
    if (!o.date || !years.length) timeP = this.tlPanel('Over time', 'one network per year', null, this.tlBanner('info', 'Choose a date column in step 1 (Data) to see how the network changes year by year.'));
    else {
      // every year from the first to the last, so the time axis is even: a year without ties shows 0 ties
      const span = years.length && years[years.length - 1] - years[0] <= 200 ? Array.from({ length: years[years.length - 1] - years[0] + 1 }, (_, k) => years[0] + k) : years, has = new Set(years);
      const rows = this.memo('nltime|' + net.key + '|' + attr, () => span.map(y => !has.has(y) ? { year: y, ties: 0, active: 0, density: NaN, recip: NaN, cross: NaN } : (() => { const b = E.nlBuild(this._nlE, this._nlN, Object.assign(this.nlOpts(o), { y0: y, y1: y })); if (!b.net) return { year: y }; const s = E.nlSummary(b.net, { triads: false }), act = b.net.und.filter(x => x.size).length; let cross = 0; if (attr) for (const [i, j] of b.net.edges) { const a = b.net.attrs[attr]; if (a && a.v[i] != null && a.v[j] != null && a.v[i] !== a.v[j]) cross++; } return { year: y, ties: s.m, active: act, density: act > 1 ? s.m / (b.net.directed ? act * (act - 1) : act * (act - 1) / 2) : NaN, recip: s.reciprocity, cross: s.m ? cross / s.m : NaN }; })()));
      const nodexlMerged = B.info.wMax > 1 && E.nlGuess(this._nlE, null).nodexl;
      timeP = this.tlPanel('Over time', 'one network per year (ties dated in that year)', null,
        nodexlMerged ? this.tlBanner('warn', h('b', null, 'Heads-up about this file: '), 'NodeXL merged repeated ties into one row (Edge Weight), so each tie keeps only one date. For a true timeline, export from NodeXL with “merge duplicate edges” off.') : null,
        this.tlLinesSvg('nltime', rows.map(r => String(r.year)), [{ name: 'ties', color: '#2E7D58', pts: rows.map(r => r.ties) }], { ylab: 'ties', title: 'Ties per year' }),
        attr ? this.tlLinesSvg('nltime2', rows.map(r => String(r.year)), [{ name: '% across ' + attr, color: '#C4681E', pts: rows.map(r => 100 * r.cross) }], { ylab: '% of ties', pct: true, title: '% of ties across ' + attr + ' groups' }) : null,
        h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, ['year', 'ties', 'active people', 'density', 'reciprocity', attr ? '% across ' + attr : ''].filter(Boolean).map(l => h('th', { key: l, className: l === 'year' ? '' : 'n' }, l)))), h('tbody', null, rows.map(r => h('tr', { key: r.year }, h('td', { className: 'w' }, r.year), h('td', { className: 'n' }, this.fmtN(r.ties || 0)), h('td', { className: 'n' }, this.fmtN(r.active || 0)), h('td', { className: 'n' }, isFinite(r.density) ? this.fmt(r.density, 3) : '—'), h('td', { className: 'n' }, r.recip != null && isFinite(r.recip) ? this.fmt(r.recip, 2) : '—'), attr ? h('td', { className: 'n' }, isFinite(r.cross) ? Math.round(100 * r.cross) + '%' : '—') : null))))),
        this.tlExportRow('nltime', 'ties-per-year'));
    }
    // compare two sub-networks side by side
    let cmpP = null;
    if (cats.length) {
      const ca = o.time.cmp && net.attrs[o.time.cmp] ? o.time.cmp : attr || cats[0], A = net.attrs[ca];
      const res = this.memo('nlcmp|' + net.key + '|' + ca, () => A.levels.slice(0, 6).map(l => { const sub = E.nlSubnet(net, Array.from({ length: net.n }, (_, i) => A.v[i] === l)); const s = E.nlSummary(sub, { triads: false }); return { l, n: sub.n, m: s.m, density: s.density, recip: s.reciprocity, trans: s.transitivity, deg: s.meanDeg, comps: s.components, iso: s.isolates }; }));
      cmpP = this.tlPanel('Compare sub-networks', 'the network inside each group', this.tlSelect(ca, cats.map(a => [a, a]), v => this.nlSetIn('time', { cmp: v }), 'Compare by'),
        h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl tl-wraph' }, h('thead', null, h('tr', null, h('th', null, ca), ['people', 'ties', 'density', 'reciprocity', 'clustering', 'ties per person', 'without ties'].map(l => h('th', { key: l, className: 'n' }, l)))),
          h('tbody', null, res.map(r => h('tr', { key: r.l }, h('td', { className: 'w' }, r.l), h('td', { className: 'n' }, this.fmtN(r.n)), h('td', { className: 'n' }, this.fmtN(r.m)), h('td', { className: 'n' }, this.fmt(r.density, 3)), h('td', { className: 'n' }, r.recip == null ? '—' : this.fmt(r.recip, 2)), h('td', { className: 'n' }, this.fmt(r.trans, 2)), h('td', { className: 'n' }, this.fmt(r.deg, 1)), h('td', { className: 'n' }, this.fmtN(r.iso))))))),
        h('span', { className: 'tl-hint' }, 'Each row is the network among the members of one group only (e.g. House vs Senate, Democrats vs Republicans) — Fowler compares chambers this way.'));
    }
    return h(React.Fragment, null, h('div', { className: 'nl-two' }, timeP, cmpP), this.nlNav(o, ['ties', 'Ties & similarity'], ['save', 'Save']));
  }
  // ---- step 8: save — variables, exports, R code
  nlVarList(net, M) { return [['indegree', 'sna_indegree'], ['outdegree', 'sna_outdegree'], ['degree', 'sna_degree'], ['strengthIn', 'sna_strength'], ['betweenness', 'sna_betweenness'], ['closeness', 'sna_closeness'], ['harmonic', 'sna_harmonic'], ['eigenvector', 'sna_eigenvector'], ['pagerank', 'sna_pagerank'], ['constraint', 'sna_constraint'], ['effsize', 'sna_effsize'], ['connectedness', 'sna_connectedness'], ['core', 'sna_core'], ['clustering', 'sna_clustering']].filter(([k]) => M[k] && (net.directed || (k !== 'indegree' && k !== 'outdegree'))
    // classic closeness is 0 for everyone when some people cannot reach others (sna); harmonic closeness is kept instead
    && !(k === 'closeness' && Array.from(M.closeness).every(v => !(v > 0)))); }
  nlMatchCurrent(net) {
    const raw = this._raw; if (!raw) return null; let best = null;
    raw.names.forEach((nm, ci) => { const idx = new Map(net.ids.map((id, i) => [id, i])); let hit = 0; for (let r = 0; r < Math.min(raw.n, 5000); r++) if (idx.has(this._E.nlKey(raw.cols[ci].a[r]))) hit++; if (hit && (!best || hit > best.hit)) best = { ci, name: nm, hit }; });
    return best && best.hit >= Math.min(net.n, raw.n) * 0.5 ? best : null;
  }
  nlAddVars(net, M, picks, group) {
    const raw = this._raw, mt = this.nlMatchCurrent(net); if (!mt) return this.flash('The current dataset has no column with these IDs.');
    this._snapT = 0; this.snap('add network measures'); const pos = new Map(net.ids.map((id, i) => [id, i])), made = [], tags = Object.assign({}, this.state.genTags);
    const put = (name, label, arr) => { const a = Float64Array.from(raw.cols[mt.ci].a, id => { const i = pos.get(this._E.nlKey(id)); return i == null ? NaN : arr[i]; }); const at = raw.names.indexOf(name), col = { k: 'n', a }; if (at >= 0) raw.cols[at] = col; else { raw.names.push(name); raw.labels.push(label); raw.cols.push(col); } made.push(name); tags[name] = 'sna'; };
    for (const [k, name] of this.nlVarList(net, M)) if (picks.has(name)) put(name, 'network: ' + k, M[k]);
    if (group && picks.has('sna_group')) put('sna_group', 'network: ' + group.name, group.member);
    this.clearMemo(); const treat = Object.assign({}, this.state.treat); made.forEach(nm => { treat[nm] = nm === 'sna_group' ? 'categorical' : 'numeric'; });
    this.setState({ cols: raw.names.map((_, i) => this._E.profileCol(raw, i, this.state.autoScreen)), treat, genTags: tags });
    this.pushLog({ t: 'snacent', res: 'added ' + made.join(', ') }); this.flash('Added ' + made.length + ' columns to ' + (this.state.fileName || 'the dataset') + ' (matched by ' + mt.name + ') — use them in Regression or Plots.');
  }
  nlStepSave(o, B) {
    const h = React.createElement, E = this._E, net = B.net, MJ = this.nlMeasures(net); if (!MJ.done) return this.tlPending(MJ.label, MJ.p); const M = MJ.value;
    const lv = this.nlJob(net, 'louvain', 'nlLouvain', [net, {}], 'Finding groups');
    const group = o.save.group && o.save.group.member && o.save.group.member.length === net.n ? o.save.group : lv.done ? { name: 'communities (Louvain)', member: Array.from(lv.value.member, v => v + 1) } : null;
    const vars = this.nlVarList(net, M), all = vars.map(v => v[1]).concat(group ? ['sna_group'] : []), picks = new Set(o.save.vars || all);
    const anon = !!o.save.anon, lab = i => anon ? 'P' + (i + 1) : net.labels[i], idOf = i => anon ? 'P' + (i + 1) : net.ids[i];
    const mt = this.nlMatchCurrent(net);
    const csvEsc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const peopleCsv = () => [['id', 'label', ...Object.keys(net.attrs), ...vars.filter(v => picks.has(v[1])).map(v => v[1]), ...(group && picks.has('sna_group') ? ['sna_group'] : [])].join(',')].concat(Array.from({ length: net.n }, (_, i) => [idOf(i), lab(i), ...Object.keys(net.attrs).map(a => net.attrs[a].v[i]), ...vars.filter(v => picks.has(v[1])).map(([k]) => isFinite(M[k][i]) ? +M[k][i].toFixed(6) : ''), ...(group && picks.has('sna_group') ? [group.member[i]] : [])].map(csvEsc).join(','))).join('\n');
    const edgeCsv = () => ['from,to,weight,type'].concat(net.edges.map(([a, b, w, t]) => [idOf(a), idOf(b), w, t].map(csvEsc).join(','))).join('\n');
    const matrixCsv = () => { const n = net.n, rows = [[''].concat(Array.from({ length: n }, (_, j) => idOf(j))).map(csvEsc).join(',')]; for (let i = 0; i < n; i++) rows.push([csvEsc(idOf(i))].concat(Array.from({ length: n }, (_, j) => net.wout[i].get(j) || 0)).join(',')); return rows.join('\n'); };
    const xmlE = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const graphml = () => { const at = Object.keys(net.attrs); return '<?xml version="1.0" encoding="UTF-8"?>\n<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n<key id="label" for="node" attr.name="label" attr.type="string"/>\n' + at.map((a, k) => '<key id="a' + k + '" for="node" attr.name="' + xmlE(a) + '" attr.type="' + (net.attrs[a].kind === 'num' ? 'double' : 'string') + '"/>').join('\n') + '\n' + vars.map(([k, nm], t) => '<key id="m' + t + '" for="node" attr.name="' + nm + '" attr.type="double"/>').join('\n') + '\n<key id="weight" for="edge" attr.name="weight" attr.type="double"/>\n<key id="type" for="edge" attr.name="type" attr.type="string"/>\n<graph edgedefault="' + (net.directed ? 'directed' : 'undirected') + '">\n' +
      Array.from({ length: net.n }, (_, i) => '<node id="' + xmlE(idOf(i)) + '"><data key="label">' + xmlE(lab(i)) + '</data>' + at.map((a, k) => net.attrs[a].v[i] == null ? '' : '<data key="a' + k + '">' + xmlE(net.attrs[a].v[i]) + '</data>').join('') + vars.map(([k], t) => isFinite(M[k][i]) ? '<data key="m' + t + '">' + (+M[k][i].toFixed(6)) + '</data>' : '').join('') + '</node>').join('\n') + '\n' + net.edges.map(([a, b, w, t]) => '<edge source="' + xmlE(idOf(a)) + '" target="' + xmlE(idOf(b)) + '"><data key="weight">' + w + '</data>' + (t ? '<data key="type">' + xmlE(t) + '</data>' : '') + '</edge>').join('\n') + '\n</graph>\n</graphml>\n'; };
    const dl = (text, name, type) => this.dlBlob(new Blob([text], { type }), name);
    const model = o.ties.model || this.nlDefaultModel(net), q = s => JSON.stringify(String(s));
    const keepT = Object.entries(o.keep || {}).filter(([, v]) => v === false).map(([t]) => t), two = Object.entries(o.twoWay || {}).filter(([, v]) => v).map(([t]) => t);
    const R = ['# Networks — reproduces the calculator with statnet (sna + network + ergm) and igraph', 'library(network); library(sna); library(ergm); library(igraph); library(intergraph)',
      '# sna and igraph both have degree(), betweenness(), closeness(): each function below names its package',
      'e <- read.csv(' + q(this._nlEname || 'edges.csv') + ', check.names = FALSE)', this._nlN ? 'v <- read.csv(' + q(this._nlNname || 'nodes.csv') + ', check.names = FALSE)' : null,
      'e <- e[e[[' + q(o.from) + ']] != e[[' + q(o.to) + ']], ]                     # self-ties removed',
      keepT.length && o.type ? 'e <- e[!(e[[' + q(o.type) + ']] %in% c(' + keepT.map(q).join(', ') + ')), ]   # kinds of tie left out' : null,
      (+o.y0 || +o.y1) && o.date ? 'yr <- as.numeric(regmatches(e[[' + q(o.date) + ']], regexpr("(19|20)[0-9]{2}", e[[' + q(o.date) + ']])))\ne <- e[yr >= ' + (+o.y0 || 0) + ' & yr <= ' + (+o.y1 || 9999) + ', ]' : null,
      two.length && o.type && net.directed ? 'tw <- e[e[[' + q(o.type) + ']] %in% c(' + two.map(q).join(', ') + '), ]; tw[, c(' + q(o.from) + ', ' + q(o.to) + ')] <- tw[, c(' + q(o.to) + ', ' + q(o.from) + ')]\ntw <- tw[!paste(tw[[' + q(o.from) + ']], tw[[' + q(o.to) + ']]) %in% paste(e[[' + q(o.from) + ']], e[[' + q(o.to) + ']]), ]   # only the missing direction\ne <- rbind(e, tw)                                    # two-way kinds count in both directions' : null,
      !net.directed ? 'e[, c(' + q(o.from) + ', ' + q(o.to) + ')] <- t(apply(e[, c(' + q(o.from) + ', ' + q(o.to) + ')], 1, sort))   # undirected: a–b and b–a are the same tie' : null,
      'el <- aggregate(list(weight = ' + (o.weight ? 'e[[' + q(o.weight) + ']]' : 'rep(1, nrow(e))') + '), by = list(from = e[[' + q(o.from) + ']], to = e[[' + q(o.to) + ']]), FUN = sum)',
      +o.minW > 1 ? 'el <- el[el$weight >= ' + (+o.minW) + ', ]' : null,
      this._nlN ? 'names(v)[names(v) == ' + q(o.id) + '] <- "vertex.names"\nnet <- network(el[, 1:2], vertices = v, directed = ' + (net.directed ? 'TRUE' : 'FALSE') + ', matrix.type = "edgelist", ignore.eval = FALSE)' : 'net <- network(el[, 1:2], directed = ' + (net.directed ? 'TRUE' : 'FALSE') + ', matrix.type = "edgelist")',
      'net %e% "weight" <- el$weight', 'g <- intergraph::asIgraph(net)', '', '# whole network (step 2)', 'sna::gden(net)' + (net.directed ? '; sna::grecip(net, measure = "edgewise")' : '') + '; igraph::transitivity(igraph::as.undirected(g, mode = "collapse"))   # density' + (net.directed ? ', reciprocity' : '') + ', clustering', net.directed ? 'sna::triad.census(net)' : null,
      '', '# people (step 4)', 'gm <- "' + (net.directed ? 'digraph' : 'graph') + '"   # ' + (net.directed ? 'directed' : 'undirected: each pair counted once'), 'm <- data.frame(id = network.vertex.names(net),',
      net.directed ? '  indegree = sna::degree(net, gmode = gm, cmode = "indegree"), outdegree = sna::degree(net, gmode = gm, cmode = "outdegree"),' : '  degree = sna::degree(net, gmode = gm),',
      '  betweenness = sna::betweenness(net, gmode = gm), reach = sna::closeness(net, gmode = gm, cmode = "' + (net.directed ? 'suminvdir' : 'suminvundir') + '"),   # reach = harmonic closeness, works across separate pieces',
      '  eigenvector = sna::evcent(net, gmode = gm))', 'm$eigenvector <- m$eigenvector / max(m$eigenvector)   # the best connected = 1, as on the page',
      'm$constraint <- igraph::constraint(g); m$core <- igraph::coreness(igraph::as.undirected(g, mode = "collapse"))   # k-core of who is tied to whom, as on the page', '', '# groups (step 5)', 'cl <- igraph::cluster_louvain(igraph::as.undirected(g, mode = "collapse")); m$group <- igraph::membership(cl); igraph::modularity(cl)',
      '', '# model (step 6)', E.nlErgmRCode(model, net), '', 'write.csv(m, "network-measures.csv", row.names = FALSE)'].filter(x => x != null).join('\n');
    return h(React.Fragment, null, h('div', { className: 'nl-two' },
      this.tlPanel('Save as variables', 'one column per measure, matched by ID', null,
        h('div', { className: 'tl-row' }, vars.map(([k, nm]) => this.tlChip((picks.has(nm) ? '✓ ' : '') + nm, picks.has(nm), () => { const s2 = new Set(picks); if (s2.has(nm)) s2.delete(nm); else s2.add(nm); this.nlSetIn('save', { vars: [...s2] }); }, { key: nm })), group ? this.tlChip((picks.has('sna_group') ? '✓ ' : '') + 'sna_group · ' + group.name, picks.has('sna_group'), () => { const s2 = new Set(picks); if (s2.has('sna_group')) s2.delete('sna_group'); else s2.add('sna_group'); this.nlSetIn('save', { vars: [...s2] }); }) : null),
        mt ? h('div', { className: 'tl-row' }, this.tlBtn('+ Add ' + picks.size + ' columns to ' + (this.state.fileName || 'the current dataset'), () => this.nlAddVars(net, M, picks, group), 'primary'), h('span', { className: 'tl-hint' }, 'matched by “' + mt.name + '” · ' + mt.hit + ' rows found · can be undone')) : this.tlBanner('info', 'To add these as columns, open the people file as the current dataset (File → Open) — the IDs are matched automatically. Or download them below.'),
        h('div', { className: 'tl-row' }, this.tlBtn('Download people + measures (CSV)', () => dl(peopleCsv(), 'network-people.csv', 'text/csv'))),
        h('span', { className: 'tl-hint' }, 'Use them as outcomes or predictors in Regression — e.g. does connectedness predict amendments passed? (Fowler’s validation)')),
      this.tlPanel('Export the network', 'for Gephi, Excel, R or UCINET', null,
        h('div', { className: 'tl-row' }, this.tlBtn('Edge list (CSV)', () => dl(edgeCsv(), 'network-edges.csv', 'text/csv')), net.n <= 3000 ? this.tlBtn('Weighted matrix (CSV)', () => dl(matrixCsv(), 'network-matrix.csv', 'text/csv')) : null, this.tlBtn('GraphML (Gephi)', () => dl(graphml(), 'network.graphml', 'application/xml'))),
        h('div', { className: 'tl-row' }, this.tlChip('Hide names in exports (P1, P2, …)', anon, () => this.nlSetIn('save', { anon: !anon })), h('span', { className: 'tl-hint' }, 'for sharing sensitive networks (Kadushin ch. 11; NOAA guide on trust)')))),
      this.tlPanel('R code', 'statnet: recreates every step', this.tlBtn(this.state.copied === 'nlr' ? 'Copied ✓' : 'Copy', () => this.copyTSV('nlr', R)), h('pre', { className: 'tl-code' }, R)),
      this.nlNav(o, ['time', 'Over time'], null));
  }
  // GM26 net lab end
