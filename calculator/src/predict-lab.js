  // GM26 predict lab begin
  // ===== Predict (machine learning), build .99: 1 Setup → 2 Split → 3 Models → 4 Evaluate → 5 Interpret → 6 Use.
  // The engine is src/predict-engine.mjs (prRun in a worker); this file is the page. The test set stays locked until
  // the person opens it, once; the logit is always among the models; every metric is read against the null model.
  prDefaults() { return { step: 'setup', y: '', ans: [], drop: null, preds: [], leakKeep: [], split: 'random', share: 20, timeVar: '', cut: '', groupVar: '', hold: '', folds: 5, seed: 2611, useW: true, models: ['logit', 'lasso', 'tree', 'forest', 'knn'], trees: 200, metric: '', reveal: false, show: '', thr: null, pdpVar: '', pdpBy: '', groupBy: '', saveP: true, saveC: true, saveF: true, code: false }; }
  prS() { return Object.assign({}, this.prDefaults(), this.state.pr || {}); }
  prSet(patch) { this.setState(st => ({ pr: Object.assign({}, st.pr || {}, typeof patch === 'function' ? patch(Object.assign(this.prDefaults(), st.pr || {})) : patch) })); }
  // ---- the outcome: a coded answer (yes / no task) or a number (regression)
  prOutcome(P) {
    const v = P.y; if (!v || !this.effMeta(v)) return null;
    return this.memo('prY|' + v + '|' + JSON.stringify([P.ans, P.drop]) + '|' + this.filterSig() + '|' + (this.state.dver || 0), () => {
      const m = this.effMeta(v), cd = m.treatAs === 'numeric' ? null : this.cbCoded(v), mask = this.mask(), n = this._raw.n;
      if (cd && cd.codes.length >= 2 && cd.codes.length <= 30) {
        const drop = new Set(P.drop == null ? cd.codes.filter(k => k.miss).map(k => k.key) : P.drop.map(String)), kept = cd.codes.filter(k => !drop.has(k.key));
        let ans = (P.ans || []).map(String).filter(a => kept.some(k => k.key === a)); if (!ans.length) ans = kept.length === 2 && kept.some(k => k.key === '1') ? ['1'] : kept.length ? [kept[0].key] : [];   // a 0/1 variable: 1 is the yes
        const A = new Set(ans), y = new Float64Array(n).fill(NaN), K = cd.keyArr; for (let i = 0; i < n; i++) { if (mask && !mask[i]) continue; const k = K[i]; if (k == null || drop.has(k)) continue; y[i] = A.has(k) ? 1 : 0; }
        return { kind: 'binary', y, codes: cd.codes, kept, drop: [...drop], ans, ansLabel: kept.filter(k => A.has(k.key)).map(k => k.label).join(' + '), label: m.label || v };
      }
      const nv = this.numVals(v); if (!nv) return null; const y = Float64Array.from(nv.a, (x, i) => (mask && !mask[i]) || !isFinite(x) ? NaN : x);
      return { kind: 'num', y, label: m.label || v };
    });
  }
  prPredictorVars(P, out) { // [{ name, kind, a, labels }] for the chosen predictors
    const raw = this._raw; return (P.preds || []).filter(nm => nm !== P.y && this.effMeta(nm)).map(nm => { const m = this.effMeta(nm), coded = m.treatAs !== 'numeric' || !!(raw.vlabs && raw.vlabs[nm] && m.distinct <= 30); if (!coded) return { name: nm, kind: 'num', a: this.nvA(nm) }; const g = this.groupLab(nm) || []; return { name: nm, kind: 'cat', a: g }; });
  }
  prRows(P, out) { const w = P.useW && this.state.weightVar ? this.wArr() : null, rows = []; for (let i = 0; i < out.y.length; i++) if (isFinite(out.y[i]) && (!w || (isFinite(w[i]) && w[i] > 0))) rows.push(i); return { rows: Int32Array.from(rows), w }; }
  prSig(P, out) { return JSON.stringify([P.y, out && out.kind, out && out.ans, out && out.drop, P.preds, P.leakKeep, P.split, P.share, P.timeVar, P.cut, P.groupVar, P.hold, P.folds, P.seed, P.useW && this.state.weightVar, P.models, P.trees, P.metric, P.groupBy, this.filterSig(), this.state.dver || 0]); }
  prLeaks(P, out, rows) { if (!out) return []; const vars = this.prPredictorVars(P, out).filter(v => !(P.leakKeep || []).includes(v.name)); return this.memo('prLeak|' + this.prSig(P, out), () => this._E.prLeakage(vars, out.y, Array.from(rows), out.kind === 'binary', this.state.weightVar || '', P.y)); }
  // ---- running: the design on the main thread (rows of the outcome), the models in the worker
  async prStart() {
    const E = this._E, P = this.prS(), out = this.prOutcome(P); if (!out) return;
    const { rows, w } = this.prRows(P, out), leaks = new Set(this.prLeaks(P, out, rows).map(l => l.name)), vars = this.prPredictorVars(P, out).filter(v => !leaks.has(v.name) || (P.leakKeep || []).includes(v.name));
    if (!vars.length) { this.flash('Pick at least one predictor'); return; }
    const D = E.prDesign(vars, rows), yR = Float64Array.from(rows, i => out.y[i]), wR = w ? Float64Array.from(rows, i => w[i]) : null;
    const spec = { binary: out.kind === 'binary', folds: +P.folds || 5, seed: +P.seed || 2611, models: P.models, trees: +P.trees || 200, metric: P.metric || (out.kind === 'binary' ? 'auc' : 'rmse'), split: { kind: P.split, testShare: Math.min(0.5, Math.max(0.05, (+P.share || 20) / 100)) } };
    if (P.split === 'time' && P.timeVar) { const t = this.nvA(P.timeVar); spec.split.t = Float64Array.from(rows, i => t[i]); spec.split.cut = +P.cut; }
    if (P.split === 'group' && P.groupVar) { const g = this.groupLab(P.groupVar) || []; spec.split.g = Array.from(rows, i => g[i]); spec.split.hold = P.hold; }
    if (P.groupBy) { const g = this.groupLab(P.groupBy) || []; spec.groupBy = Array.from(rows, i => g[i]); }
    const sig = this.prSig(P, out), job = { sig, status: 'run', p: 0, label: 'Preparing', D, yR, wR, rows, vars, spec, out: null, err: '' }; this._pr = job; this.forceUpdate();
    const paint = () => { clearTimeout(this._prPT); this._prPT = setTimeout(() => this.forceUpdate(), 120); };
    try {
      const Dsend = Object.assign({}, D, { feats: D.feats.map(f => Object.assign({}, f, { a: undefined })) });
      let res = null; const wk = await this.wkStart('prRun', [Dsend, yR, wR, spec], q => { if (q && typeof q === 'object') { job.p = q.p; job.label = q.label; } paint(); });
      if (wk) { job.worker = wk.w; const r = await wk.done; if (r.ok) res = r.v; else job.err = r.e || 'The run failed'; }
      else { const g = E.prRun(D, yR, wR, spec); let r; while (!(r = g.next()).done) { job.p = r.value.p; job.label = r.value.label; } res = r.value; }
      if (res) { job.out = res; job.status = 'done'; this.prSet({ reveal: false, show: res.best || '', thr: null, step: 'evaluate' }); if (this.pushLog) { let code = null; try { code = this.prCodeLines(P, out); } catch (e) {} const summ = (res.binary ? 'Classification' : 'Regression') + ' of ' + P.y + ' with ' + vars.length + ' predictors · ' + res.results.filter(r => r.model).length + ' models · ' + res.nTrain + ' train / ' + res.nTest + ' test · best: ' + (res.best || '—'); this.pushLog(code ? { t: 'stata', stata: code.ST.join('\n'), r: code.R.join('\n'), res: summ } : { t: 'cmd', cmd: '* Predict: ' + summ }); } } else job.status = 'error';
    } catch (e) { job.err = String(e && e.message || e); job.status = 'error'; }
    if (job.worker) job.worker = null; this.forceUpdate();
  }
  prCancel() { const j = this._pr; if (j && j.worker) { try { j.worker.terminate(); } catch (e) {} } this._pr = null; this.forceUpdate(); }
  prFmt(v, d) { return isFinite(v) ? (+v).toFixed(d == null ? 3 : d) : '—'; }
  // ---- the page
  prRender() {
    const h = React.createElement, P = this.prS(), E = this._E, S = this.state, out = this.prOutcome(P), J = this._pr, fresh = J && J.status === 'done' && out && J.sig === this.prSig(P, out);
    const steps = [['setup', 'Setup'], ['split', 'Split'], ['models', 'Models'], ['evaluate', 'Evaluate'], ['interpret', 'Interpret'], ['use', 'Use']], cur = Math.max(0, steps.findIndex(s => s[0] === P.step));
    const bar = h('nav', { className: 'tl-steps', 'aria-label': 'Predict steps' }, steps.map(([k, l], i) => [i ? h('span', { key: 's' + i, className: 'tl-sep', 'aria-hidden': 'true' }) : null, h('button', { key: k, type: 'button', className: 'tl-step' + (i === cur ? ' on' : i < cur ? ' done' : ''), 'aria-current': i === cur ? 'step' : undefined, onClick: () => this.prSet({ step: k }) }, h('i', null, i < cur ? '✓' : String(i + 1)), l)]),
      h('span', { className: 'tl-steps-r' }, this.tlBtn(P.code ? 'Hide code' : 'R · Stata code', () => this.prSet({ code: !P.code }), '', { 'aria-expanded': P.code ? 'true' : 'false' })));
    let body;
    if (P.step === 'setup') body = this.prStepSetup(P, out);
    else if (P.step === 'split') body = this.prStepSplit(P, out);
    else if (P.step === 'models') body = this.prStepModels(P, out, J, fresh);
    else if (P.step === 'evaluate') body = this.prStepEvaluate(P, out, J, fresh);
    else if (P.step === 'interpret') body = this.prStepInterpret(P, out, J, fresh);
    else body = this.prStepUse(P, out, J, fresh);
    return h('div', { className: 'tl pr' }, bar, body, P.code ? this.prCodePanel(P, out, J) : null);
  }
  prNeed(out, text) { return this.tlBanner('info', text || 'Pick what to predict in step 1 first.'); }
  prStepSetup(P, out) {
    const h = React.createElement, S = this.state, cols = (S.cols || []).filter(c => c.name !== S.weightVar);
    const yOpts = [['', 'Pick the outcome…']].concat(cols.map(c => [c.name, c.name + (c.label ? ' — ' + String(c.label).slice(0, 48) : '')]));
    const head = h('div', { className: 'tl-row wide' }, this.tlField('Predict', this.tlSelect(P.y, yOpts, v => this.prSet({ y: v, ans: [], drop: null, preds: (P.preds || []).filter(x => x !== v), pdpVar: '' }), 'Predict', { className: 'tl-select cb-vsel' })),
      out && out.kind === 'binary' ? this.tlField('The answer (click several to add them up)', h('div', { className: 'tl-row' }, out.kept.map(k => this.tlChip(k.label + (k.code != null || k.ext ? ' (' + k.key + ')' : ''), out.ans.includes(k.key), () => { const cur = out.ans.includes(k.key) ? out.ans.filter(a => a !== k.key) : out.ans.concat([k.key]); if (cur.length) this.prSet({ ans: cur }); }, { key: k.key })))) : null,
      out && out.kind === 'binary' ? this.tlField('Leave out', h('div', { className: 'tl-row' }, out.codes.map(k => this.tlChip(k.label, out.drop.includes(k.key), () => { const d = out.drop.includes(k.key) ? out.drop.filter(x => x !== k.key) : out.drop.concat([k.key]); if (d.length < out.codes.length - 1) this.prSet({ drop: d }); }, { key: k.key, className: 'tl-chip' + (out.drop.includes(k.key) ? ' off' : '') })))) : null);
    if (!out) return this.tlPanel('1 · What to predict', 'a yes / no answer, or a number', null, head, this.tlBanner('info', 'Pick the outcome: a coded answer gives a yes / no task (which answer counts as yes, which answers are left out), a number gives a regression.'));
    const { rows } = this.prRows(P, out); let pos = 0; for (const i of rows) pos += out.y[i];
    const task = out.kind === 'binary' ? 'Yes / no · ' + this.tlPct(pos / Math.max(1, rows.length)) + ' ' + out.ansLabel + ' among ' + this.fmtN(rows.length) + ' rows' + (out.drop.length ? ' (' + out.codes.filter(k => out.drop.includes(k.key)).map(k => k.label).join(', ') + ' left out)' : '') : 'A number · ' + this.fmtN(rows.length) + ' rows with a value';
    const elig = cols.filter(c => c.name !== P.y && (c.distinct || 0) >= 2), preds = (P.preds || []).filter(p => elig.some(c => c.name === p));
    const predF = this.tlField('From (predictors)', this.tlMultiVar(preds, elig, v => this.prSet({ preds: v, pdpVar: '' }), 'Predictors', { id: 'pr|preds' }), h('div', { className: 'tl-row' }, this.tlBtn('All variables', () => this.prSet({ preds: elig.filter(c => (c.distinct || 0) <= 60 || (this.effMeta(c.name) || {}).treatAs === 'numeric').map(c => c.name) })), preds.length ? this.tlBtn('Clear', () => this.prSet({ preds: [] })) : null, h('span', { className: 'tl-hint' }, 'Codes become dummies against the most frequent answer, numbers stay numbers (missing ones get the training median), text with more than 60 values is better left out.')));
    const leaks = this.prLeaks(P, out, rows), keep = P.leakKeep || [];
    const leakEl = leaks.length ? h('div', { className: 'pr-card warn' }, h('b', null, 'Possible leakage · '), leaks.map((l, i) => h('span', { key: l.name }, i ? ' · ' : '', h('code', null, l.name), ' — ' + l.why + ' ', keep.includes(l.name) ? h('span', { className: 'tl-hint' }, '(kept) ') : this.tlBtn('Leave it out', () => this.prSet({ preds: preds.filter(p => p !== l.name) })), keep.includes(l.name) ? null : this.tlBtn('Keep it', () => this.prSet({ leakKeep: keep.concat([l.name]) }))))) : null;
    return h('div', { className: 'tl-col' }, this.tlPanel('1 · What to predict', 'a yes / no answer, or a number', null, head, h('p', { className: 'pr-task' }, task), predF, leakEl,
      h('div', { className: 'tl-row' }, this.tlBtn('Next: split →', () => this.prSet({ step: 'split' }), 'primary', { disabled: !preds.length }))));
  }
  prStepSplit(P, out) {
    const h = React.createElement, S = this.state, E = this._E; if (!out) return this.prNeed(out);
    const { rows, w } = this.prRows(P, out), numCols = (S.cols || []).filter(c => (this.effMeta(c.name) || {}).type === 'numeric' && c.name !== P.y), grpCols = this.tlGroupCols(P.y);
    const f = [this.tlField('Split', this.tlSeg([['random', 'Random ' + (100 - (+P.share || 20)) + ' / ' + (+P.share || 20)], ['time', 'By time'], ['group', 'Leave one group out']], P.split, v => this.prSet({ split: v })))];
    if (P.split === 'random') f.push(this.tlField('Test share (%)', this.tlNum(P.share, v => this.prSet({ share: v }), { min: 5, max: 50, aria: 'Test share' })), h('span', { className: 'tl-hint' }, 'Stratified: the same share of each outcome in both parts.'));
    if (P.split === 'time') { const tv = P.timeVar || (numCols.find(c => /year|anio|año|date|fecha|wave|ronda|period/i.test(c.name)) || {}).name || ''; const lv = tv ? this.cbLevels(tv, 100).map(Number).filter(isFinite).sort((a, b) => a - b) : []; f.push(this.tlField('Time variable', this.tlSelect(tv, [['', 'pick…']].concat(numCols.map(c => [c.name, c.name])), v => this.prSet({ timeVar: v, cut: '' }), 'Time variable')), tv ? this.tlField('Test = from', this.tlSelect(P.cut || String(lv[Math.max(0, lv.length - 2)] || ''), lv.map(v => [String(v), String(v) + ' onwards']), v => this.prSet({ cut: v }), 'Test from')) : null); if (tv && !P.timeVar) setTimeout(() => this.prSet({ timeVar: tv, cut: String(lv[Math.max(0, lv.length - 2)] || '') }), 0); }
    if (P.split === 'group') { const lv = P.groupVar ? this.cbLevels(P.groupVar, 60) : []; f.push(this.tlField('Group variable', this.tlSelect(P.groupVar, [['', 'pick…']].concat(grpCols.map(n => [n, n])), v => this.prSet({ groupVar: v, hold: '' }), 'Group variable')), P.groupVar ? this.tlField('Held out for the test', this.tlSelect(P.hold || lv[0] || '', lv.map(v => [v, v]), v => this.prSet({ hold: v }), 'Held-out group')) : null); if (P.groupVar && !P.hold && lv[0]) setTimeout(() => this.prSet({ hold: lv[0] }), 0); }
    const g = [this.tlField('Tuning', this.tlSeg([['5', '5-fold CV'], ['10', '10-fold CV']], String(P.folds), v => this.prSet({ folds: +v }))), this.tlField('Seed', this.tlNum(P.seed, v => this.prSet({ seed: v }), { min: 1, max: 1e9, aria: 'Seed' })),
      S.weightVar ? this.tlField('Weight', this.tlSeg([['1', 'Use ' + S.weightVar], ['0', 'Unweighted']], P.useW ? '1' : '0', v => this.prSet({ useW: v === '1' }))) : h('span', { className: 'tl-hint' }, 'No survey weight set (Settings → Weight): rows count equally.')];
    // what the split gives, before anything runs
    let sp = null, err = ''; try { const spec = { binary: out.kind === 'binary', kind: P.split, testShare: (+P.share || 20) / 100 }; if (P.split === 'time' && P.timeVar) { const t = this.nvA(P.timeVar); spec.t = Float64Array.from(rows, i => t[i]); spec.cut = +P.cut; } if (P.split === 'group' && P.groupVar) { const gl = this.groupLab(P.groupVar) || []; spec.g = Array.from(rows, i => gl[i]); spec.hold = P.hold; } sp = E.prSplit(Float64Array.from(rows, i => out.y[i]), null, spec, E.prRng(+P.seed || 2611)); } catch (e) { err = e.message; }
    const share = idx => { let s = 0; for (const r of idx) s += out.y[rows[r]]; return idx.length ? s / idx.length : NaN; };
    const cards = sp ? h('div', { className: 'pr-two' }, h('div', { className: 'pr-card' }, h('b', null, 'Training set · ' + this.fmtN(sp.train.length) + ' rows'), h('div', { className: 'tl-hint' }, (out.kind === 'binary' ? this.tlPct(share(sp.train)) + ' ' + out.ansLabel + ' · ' : '') + 'used to fit and to tune (' + P.folds + ' folds, so every row is validated once). Dummies, medians and scaling are computed inside each fold.')),
      h('div', { className: 'pr-card lock' }, h('b', null, '🔒 Test set · ' + this.fmtN(sp.test.length) + ' rows · locked'), h('div', { className: 'tl-hint' }, (out.kind === 'binary' ? this.tlPct(share(sp.test)) + ' ' + out.ansLabel + ' · ' : '') + 'no model sees it until step 4, where it is opened once. That is the result you report.'))) : this.tlBanner('warn', err || 'Choose the split.');
    const bad = sp && (sp.train.length < 30 || sp.test.length < 10);
    return h('div', { className: 'tl-col' }, this.tlPanel('2 · Split and tuning', 'the rows the models learn from, and the rows that judge them', null, h('div', { className: 'tl-row wide' }, ...f), h('div', { className: 'tl-row wide' }, ...g), cards, bad ? this.tlBanner('warn', 'Too few rows on one side of the split.') : null,
      h('div', { className: 'tl-row' }, this.tlBtn('Next: models →', () => this.prSet({ step: 'models' }), 'primary', { disabled: !!bad || !sp }))));
  }
  prStepModels(P, out, J, fresh) {
    const h = React.createElement, E = this._E; if (!out) return this.prNeed(out);
    const bin = out.kind === 'binary', names = bin ? E.PR_MODELS : E.PR_MODELS_REG, metrics = bin ? [['auc', 'AUC'], ['bal', 'Balanced accuracy'], ['brier', 'Brier'], ['logloss', 'Log loss']] : [['rmse', 'RMSE'], ['mae', 'MAE'], ['r2', 'R²']];
    const running = J && J.status === 'run', nPred = (P.preds || []).length;
    const ctl = h('div', { className: 'tl-col' },
      this.tlField('Models', h('div', { className: 'tl-row' }, Object.keys(names).map(k => this.tlChip(names[k], P.models.includes(k), () => this.prSet({ models: P.models.includes(k) ? (k === 'logit' ? P.models : P.models.filter(x => x !== k)) : P.models.concat([k]) }), { key: k, title: k === 'logit' ? 'The baseline: always run, so you see what the others add' : undefined })))),
      h('div', { className: 'tl-row wide' }, this.tlField('Rank by', this.tlSeg(metrics, P.metric || metrics[0][0], v => this.prSet({ metric: v }))), P.models.includes('forest') ? this.tlField('Trees in the forest', this.tlNum(P.trees, v => this.prSet({ trees: v }), { min: 50, max: 1000, aria: 'Trees' })) : null,
        this.tlField('Performance by group (step 5)', this.tlSelect(P.groupBy, [['', 'none']].concat(this.tlGroupCols(P.y).map(n => [n, n])), v => this.prSet({ groupBy: v }), 'Performance by group'))),
      h('div', { className: 'tl-row' }, running ? this.tlBtn('Cancel', () => this.prCancel()) : this.tlBtn(fresh ? 'Run again' : 'Run ' + P.models.length + ' model' + (P.models.length > 1 ? 's' : ''), () => this.prStart(), 'primary', { disabled: !nPred || !P.models.length, 'data-mf-run': '1' }), h('span', { className: 'tl-hint' }, nPred + ' predictor' + (nPred === 1 ? '' : 's') + ' · ' + P.folds + '-fold CV · seed ' + P.seed + ' · runs in the background, offline; the result is reproducible from the seed.')),
      running ? this.tlPending(J.label || 'Running', J.p) : null, J && J.status === 'error' ? this.tlBanner('warn', 'The run failed: ' + J.err) : null,
      fresh ? h('div', { className: 'tl-row' }, this.tlBtn('Next: evaluate →', () => this.prSet({ step: 'evaluate' }), 'primary')) : null);
    return this.tlPanel('3 · Models', 'the same folds for every model, the ' + (bin ? 'logit' : 'linear regression') + ' you already know among them', null, ctl);
  }
  prLeaderboard(P, out, R) {
    const h = React.createElement, bin = R.binary, metric = R.metric, M = bin ? [['auc', 'AUC'], ['bal', 'bal. acc.'], ['brier', 'Brier'], ['logloss', 'log loss']] : [['rmse', 'RMSE'], ['mae', 'MAE'], ['r2', 'R²']];
    const f = (v, k) => k === 'logloss' || k === 'brier' ? this.prFmt(v, 3) : k === 'rmse' || k === 'mae' ? this.prFmt(v, 2) : this.prFmt(v, 3);
    return h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl pr-lb' }, h('thead', null, h('tr', null, h('th', null, 'model'), h('th', { className: 'n' }, 'CV ' + M.find(m => m[0] === metric)[1] + ' ± sd'), ...M.filter(m => m[0] !== metric).map(m => h('th', { key: m[0], className: 'n' }, 'CV ' + m[1])), h('th', null, 'tuned'), h('th', null, ''))),
      h('tbody', null, R.results.map(r => h('tr', { key: r.kind, className: (r.kind === R.best ? 'best' : '') + (r.kind === 'null' ? ' null' : '') }, h('td', null, r.label), h('td', { className: 'n' }, r.cv ? f(r.cv.mean, metric) + ' ± ' + this.prFmt(r.cv.sd, 3) : f(r.test[metric], metric) + ' (by definition)'),
        ...M.filter(m => m[0] !== metric).map(m => h('td', { key: m[0], className: 'n' }, r.cv ? f(r.cv.all[m[0]], m[0]) : f(r.test[m[0]], m[0]))), h('td', null, r.tuned), h('td', null, r.kind === R.best ? h('span', { className: 'pr-pill g' }, 'best by ' + M.find(m => m[0] === metric)[1]) : r.withinSd ? h('span', { className: 'pr-pill o' }, 'within 1 sd of best') : r.kind === 'logit' ? h('span', { className: 'pr-pill b' }, 'interpretable') : null))))));
  }
  prStepEvaluate(P, out, J, fresh) {
    const h = React.createElement, E = this._E; if (!out) return this.prNeed(out); if (!fresh) return this.tlPanel('4 · Evaluate', null, null, this.tlBanner('info', J && J.status === 'run' ? 'The models are still running (step 3).' : J && J.out ? 'The settings changed since the last run: run the models again (step 3).' : 'Run the models in step 3 first.'));
    const R = J.out, bin = R.binary, best = R.results.find(r => r.kind === R.best), logit = R.results.find(r => r.kind === 'logit'), mName = R.metric.toUpperCase().replace('LOGLOSS', 'log loss').replace('BAL', 'balanced accuracy').replace('R2', 'R²');
    const reading = bin ? 'The ' + best.label.toLowerCase().replace(' (baseline)', '') + ' separates the two answers best (CV AUC ' + this.prFmt(best.cv.mean, 2) + ')' + (logit && logit !== best ? ', ' + Math.round(100 * (best.cv.mean - logit.cv.mean)) + ' points more than the logit you can read coefficient by coefficient' : '') + '. Accuracy is not the first column because ' + this.tlPct(1 - R.baseRate, 0) + ' give the other answer: a model that always says so is ' + this.tlPct(1 - R.baseRate, 0) + ' accurate and useless.'
      : 'The ' + best.label.toLowerCase().replace(' (baseline)', '') + ' predicts closest (CV RMSE ' + this.prFmt(best.cv.mean, 2) + ')' + (logit && logit !== best ? ' against ' + this.prFmt(logit.cv.mean, 2) + ' for linear regression' : '') + '. The null model (the mean) has RMSE ' + this.prFmt(R.results[0].test.rmse, 2) + ': every model is read against it.';
    const choose = this.tlField('Open the test set for', this.tlSelect(P.show || R.best, R.results.filter(r => r.model).map(r => [r.kind, r.label]), v => this.prSet({ show: v, thr: null }), 'Model to test', { native: true }));
    const reveal = h('div', { className: 'pr-card lock' }, h('div', { className: 'tl-row' }, choose, this.tlBtn(P.reveal ? '🔓 Test set open' : '🔒 Reveal the test set · once', () => this.prSet({ reveal: true }), P.reveal ? '' : 'primary', { disabled: P.reveal }), h('span', { className: 'tl-hint' }, this.fmtN(R.nTest) + ' rows no model has seen. Open it once, for the model you choose; a second look is a second test.')));
    let testEl = null;
    if (P.reveal) {
      const r = R.results.find(q => q.kind === (P.show || R.best)) || best, pred = r.pred, test = R.test, y = J.yR, w = J.wR, thr = P.thr == null ? R.thr : +P.thr;
      if (bin) {
        const m = E.prBinMetrics(y, pred, w, test, thr), ex = r.kind === R.best ? R.extras : E.prExtras(J.D, y, w, r, test, true, thr, J.spec, E.prRng(+P.seed || 2611)), lg = logit && logit !== r ? E.prBinMetrics(y, logit.pred, w, test, thr) : null;
        testEl = h('div', { className: 'tl-col' }, h('div', { className: 'pr-three' },
          h('div', { className: 'pr-card' }, h('b', null, 'ROC · test set'), this.prRocSvg('prroc', ex.roc, lg && logit ? E.prRoc(y, logit.pred, w, test) : null), h('div', { className: 'tl-hint' }, 'AUC ', h('b', null, this.prFmt(m.auc, 3)), ' [' + this.prFmt(ex.ci[0], 2) + ', ' + this.prFmt(ex.ci[1], 2) + '] bootstrap' + (lg ? ' · logit ' + this.prFmt(lg.auc, 3) : ''))),
          h('div', { className: 'pr-card' }, h('b', null, 'Calibration'), this.prCalibSvg('prcal', ex.calib), h('div', { className: 'tl-hint' }, (() => { const c = ex.calib.find(b => b.pred >= 0.35 && b.pred <= 0.6) || ex.calib[Math.floor(ex.calib.length / 2)]; return c ? 'Predicted ' + this.tlPct(c.pred, 0) + ' → observed ' + this.tlPct(c.obs, 0) + '. ' : ''; })() + 'Brier ' + this.prFmt(m.brier, 3) + ' · log loss ' + this.prFmt(m.logloss, 3))),
          h('div', { className: 'pr-card' }, h('b', null, 'Confusion at threshold ' + this.prFmt(thr, 2)), this.prConfSvg('prcm', m, out), h('div', { className: 'tl-row' }, h('input', { type: 'range', min: 0.05, max: 0.95, step: 0.01, value: thr, 'aria-label': 'Threshold', onChange: e => this.prSet({ thr: +e.target.value }) }), this.tlBtn('= base rate', () => this.prSet({ thr: null }))), h('div', { className: 'tl-hint' }, 'Sensitivity ' + this.prFmt(m.sens, 2) + ' · specificity ' + this.prFmt(m.spec, 2) + ' · precision ' + this.prFmt(m.prec, 2) + ' · balanced accuracy ' + this.prFmt(m.bal, 2)))),
          h('div', { className: 'tl-row' }, this.tlExportRow('prroc', 'predict-roc'), this.tlExportRow('prcal', 'predict-calibration')));
      } else {
        const m = E.prRegMetrics(y, pred, w, test), ex = r.kind === R.best ? R.extras : E.prExtras(J.D, y, w, r, test, false, null, J.spec, E.prRng(+P.seed || 2611));
        testEl = h('div', { className: 'tl-col' }, h('div', { className: 'pr-three' }, h('div', { className: 'pr-card' }, h('b', null, 'Test set'), h('div', { className: 'pr-big' }, 'RMSE ' + this.prFmt(m.rmse, 2)), h('div', { className: 'tl-hint' }, '[' + this.prFmt(ex.ci[0], 2) + ', ' + this.prFmt(ex.ci[1], 2) + '] bootstrap · MAE ' + this.prFmt(m.mae, 2) + ' · R² ' + this.prFmt(m.r2, 3))), h('div', { className: 'pr-card', style: { gridColumn: 'span 2' } }, h('b', null, 'Predicted against observed · test set, by decile of the prediction'), this.prPredObsSvg('prpo', y, pred, w, test))), this.tlExportRow('prpo', 'predict-observed'));
      }
    }
    return h('div', { className: 'tl-col' }, this.tlPanel('4 · Evaluate', 'cross-validation on the training set, then the test set once', null, this.prLeaderboard(P, out, R), h('div', { className: 'tl-banner ok' }, h('b', null, 'Reading: '), reading), reveal, testEl, P.reveal ? h('div', { className: 'tl-row' }, this.tlBtn('Next: interpret →', () => this.prSet({ step: 'interpret' }), 'primary')) : null));
  }
  prStepInterpret(P, out, J, fresh) {
    const h = React.createElement, E = this._E; if (!out) return this.prNeed(out); if (!fresh || !J.out.extras) return this.tlPanel('5 · Interpret', null, null, this.tlBanner('info', 'Run the models in step 3 first.'));
    const R = J.out, bin = R.binary, best = R.results.find(r => r.kind === R.best), ex = R.extras, D = J.D;
    const impRows = ex.importance.slice(0, 15).map((q, i) => ({ label: q.name, value: Math.max(0, q.drop), note: '± ' + this.prFmt(q.se, 3), color: i < 3 ? '#194F39' : '#2E7D58' }));
    const imp = this.tlBarsSvg('primp', impRows, { title: 'Permutation importance · ' + (bin ? 'drop in test AUC' : 'rise in test RMSE') + ' when the variable is shuffled (5 repeats)', xlab: bin ? 'drop in AUC' : 'rise in RMSE' });
    const vNames = D.names, pv = vNames.includes(P.pdpVar) ? P.pdpVar : (ex.importance[0] || {}).name, vi = vNames.indexOf(pv);
    const pdp = vi >= 0 ? this.memo('prPdp|' + J.sig + '|' + pv + '|' + P.pdpBy, () => E.prPdp(D, best.model, vi, Array.from(R.test), { by: P.pdpBy ? (() => { const g = this.groupLab(P.pdpBy) || []; return Array.from(J.rows, i => g[i]); })() : null })) : null;
    const pdpSeries = pdp ? pdp.curves.map((c, k) => ({ name: c.group == null ? 'all' : c.group, color: this.tlPal(k), pts: c.pts.map(v => bin ? 100 * v : v) })) : [];
    const pdpEl = pdp ? h('div', { className: 'tl-col' }, this.tlLinesSvg('prpdp', pdp.grid, pdpSeries, { ylab: bin ? 'predicted % ' + out.ansLabel : 'predicted ' + P.y, pct: bin, title: 'Partial dependence on ' + pv + (P.pdpBy ? ' by ' + P.pdpBy : '') + ' · other variables as they are' }), h('span', { className: 'tl-hint' }, (pdp.numeric ? 'The x axis runs over the values seen in the test set (20 quantiles). ' : 'One point per answer, the reference first. ') + 'Partial dependence says what the model predicts when only this variable changes, not what causes the outcome.')) : null;
    const grp = ex.groups && ex.groups.length ? h('div', { className: 'tl-tblwrap' }, h('table', { className: 'tl-tbl pr-lb' }, h('thead', null, h('tr', null, h('th', null, P.groupBy), h('th', { className: 'n' }, 'n'), ...(bin ? [['auc', 'AUC'], ['sens', 'sens.'], ['spec', 'spec.'], ['predMean', bin ? '% predicted' : '']] : [['rmse', 'RMSE'], ['mae', 'MAE'], ['r2', 'R²']]).map(c => h('th', { key: c[0], className: 'n' }, c[1])))), h('tbody', null, ex.groups.map(g => h('tr', { key: g.group }, h('td', null, g.group), h('td', { className: 'n' }, this.fmtN(g.n)), ...(bin ? [this.prFmt(g.auc, 2), this.prFmt(g.sens, 2), this.prFmt(g.spec, 2), this.tlPct(g.predMean, 0)] : [this.prFmt(g.rmse, 2), this.prFmt(g.mae, 2), this.prFmt(g.r2, 2)]).map((v, i) => h('td', { key: i, className: 'n' }, v))))))) : h('span', { className: 'tl-hint' }, 'Pick a group variable in step 3 (Performance by group) to see whether the model works equally for everyone.');
    const top = ex.importance[0];
    return h('div', { className: 'tl-col' }, this.tlPanel('5 · Interpret', 'what the ' + best.label.toLowerCase().replace(' (baseline)', '') + ' uses, for whom it works', null,
      h('div', { className: 'pr-two' }, h('div', null, imp, this.tlExportRow('primp', 'predict-importance')), h('div', null, h('div', { className: 'tl-row wide' }, this.tlField('Variable', this.tlSelect(pv, vNames.map(n => [n, n]), v => this.prSet({ pdpVar: v }), 'Partial dependence variable')), this.tlField('By', this.tlSelect(P.pdpBy, [['', 'none']].concat(this.tlGroupCols(P.y).filter(n => n !== pv).map(n => [n, n])), v => this.prSet({ pdpBy: v }), 'Partial dependence by'))), pdpEl, this.tlExportRow('prpdp', 'predict-partial-dependence'))),
      h('div', { className: 'tl-banner ok' }, h('b', null, 'Reading: '), top ? top.name + ' matters most to the model: shuffling it ' + (bin ? 'costs ' + Math.round(1000 * top.drop) / 10 + ' AUC points' : 'raises the RMSE by ' + this.prFmt(top.drop, 2)) + '. Importance says what the model uses, not what causes the outcome; the Regression tab is the place for causal claims.' : ''),
      h('div', null, h('p', { className: 'tl-lbl' }, 'Does it work equally for everyone? · test set by group'), grp),
      h('div', { className: 'tl-row' }, this.tlBtn('Next: use →', () => this.prSet({ step: 'use' }), 'primary'))));
  }
  prStepUse(P, out, J, fresh) {
    const h = React.createElement, E = this._E; if (!out) return this.prNeed(out); if (!fresh) return this.tlPanel('6 · Use', null, null, this.tlBanner('info', 'Run the models in step 3 first.'));
    const R = J.out, bin = R.binary, r = R.results.find(q => q.kind === (P.show || R.best)) || R.results.find(q => q.kind === R.best), base = E.tlVarName ? E.tlVarName(P.y) : P.y.replace(/\W+/g, '_');
    const names = { p: 'p_' + base + '_' + r.kind, c: base + '_' + r.kind + '_hat', f: base + '_fold' };
    const save = () => { const n = this._raw.n, taken = new Set(this._raw.names); const uniq = nm => { let k = nm, i = 2; while (taken.has(k)) k = nm + '_' + i++; taken.add(k); return k; }; const made = [];
      if (P.saveP) { const a = new Float64Array(n).fill(NaN); J.rows.forEach((i, k) => { a[i] = r.pred[k]; }); const nm = uniq(names.p); this.addDerivedCol(nm, { k: 'n', a }, (bin ? 'predicted probability of ' : 'predicted ') + P.y + (bin ? ' = ' + out.ansLabel : '') + ' (' + r.label + ')', 'pr'); made.push(nm); }
      if (P.saveC && bin) { const thr = P.thr == null ? R.thr : +P.thr, a = new Float64Array(n).fill(NaN); J.rows.forEach((i, k) => { a[i] = r.pred[k] >= thr ? 1 : 0; }); const nm = uniq(names.c); this.addDerivedCol(nm, { k: 'n', a }, 'predicted class at ' + this.prFmt(thr, 2) + ' (' + r.label + ')', 'pr'); made.push(nm); }
      if (P.saveF) { const a = new Float64Array(n).fill(NaN); J.rows.forEach((i, k) => { a[i] = R.fold[k] >= 0 ? R.fold[k] + 1 : 0; }); const nm = uniq(names.f); this.addDerivedCol(nm, { k: 'n', a }, 'validation fold (0 = test set)', 'pr'); made.push(nm); }
      this.flash('Added ' + made.join(', ')); this.stataLog && this.stataLog('* predict: ' + made.join(' ') + ' added by the Predict tab'); };
    const card = this.prModelCard(P, out, J, r);
    return h('div', { className: 'tl-col' }, this.tlPanel('6 · Use', 'predictions as variables, and a model card for the write-up', null,
      h('div', { className: 'pr-card' }, h('b', null, 'Save predictions to the data'), h('div', { className: 'tl-row' }, this.tlChip(names.p + ' (probability)', P.saveP, () => this.prSet({ saveP: !P.saveP })), bin ? this.tlChip(names.c + ' (class)', P.saveC, () => this.prSet({ saveC: !P.saveC })) : null, this.tlChip(names.f + ' (fold, 0 = test)', P.saveF, () => this.prSet({ saveF: !P.saveF })), this.tlBtn('Add the variables', save, 'primary')), h('span', { className: 'tl-hint' }, 'Rows outside the run (missing outcome, left-out answers, outside the subgroup) stay missing. The variables feed maps, timelines and regressions like any other.')),
      h('div', { className: 'pr-card' }, h('div', { className: 'tl-row' }, h('b', null, 'Model card'), this.tlBtn(this.state.copied === 'prcard' ? 'Copied ✓' : 'Copy for Word', () => this.copyTSV('prcard', card))), h('pre', { className: 'pr-pre' }, card))));
  }
  prModelCard(P, out, J, r) {
    const R = J.out, bin = R.binary, S = this.state, m = r.test, L = [];
    L.push('MODEL CARD · ' + (bin ? 'classification' : 'regression') + ' of ' + P.y + (bin ? ' = ' + out.ansLabel : '') + (out.label && out.label !== P.y ? ' (' + out.label + ')' : ''));
    L.push('Data: ' + (S.fileName || 'dataset') + ' · ' + this.fmtN(J.rows.length) + ' rows used' + (bin && out.drop.length ? ' · left out: ' + out.codes.filter(k => out.drop.includes(k.key)).map(k => k.label).join(', ') : '') + (this.conds().length ? ' · subgroup: ' + this.conds().map(c => this.condLabel(c)).join(' & ') : ''));
    L.push('Predictors (' + J.vars.length + '): ' + J.vars.map(v => v.name).join(', '));
    L.push('Split: ' + (P.split === 'random' ? 'random ' + (100 - P.share) + ' / ' + P.share + ', stratified' : P.split === 'time' ? 'by time, test = ' + P.timeVar + ' ≥ ' + P.cut : 'leave one group out, test = ' + P.groupVar + ' = ' + P.hold) + ' · ' + this.fmtN(R.nTrain) + ' train / ' + this.fmtN(R.nTest) + ' test · ' + P.folds + '-fold CV · seed ' + P.seed + (J.wR ? ' · weights: ' + S.weightVar + ' (in training and in every metric)' : ' · unweighted'));
    L.push('Models compared: ' + R.results.filter(q => q.model).map(q => q.label + ' (CV ' + R.metric + ' ' + this.prFmt(q.cv.mean, 3) + ' ± ' + this.prFmt(q.cv.sd, 3) + ')').join('; '));
    L.push('Chosen: ' + r.label + (r.tuned && r.tuned !== '—' ? ' · ' + r.tuned : ''));
    L.push('Test set, opened once: ' + (bin ? 'AUC ' + this.prFmt(m.auc, 3) + ' [' + this.prFmt(R.extras.ci[0], 2) + ', ' + this.prFmt(R.extras.ci[1], 2) + '] · balanced accuracy ' + this.prFmt(m.bal, 3) + ' · Brier ' + this.prFmt(m.brier, 3) + ' · threshold ' + this.prFmt(P.thr == null ? R.thr : +P.thr, 2) : 'RMSE ' + this.prFmt(m.rmse, 2) + ' [' + this.prFmt(R.extras.ci[0], 2) + ', ' + this.prFmt(R.extras.ci[1], 2) + '] · MAE ' + this.prFmt(m.mae, 2) + ' · R² ' + this.prFmt(m.r2, 3)) + ' · null model: ' + (bin ? 'AUC 0.5' : 'RMSE ' + this.prFmt(R.results[0].test.rmse, 2)));
    if (R.extras.importance) L.push('Most used variables (permutation importance): ' + R.extras.importance.slice(0, 5).map(q => q.name + ' (' + this.prFmt(q.drop, 3) + ')').join(', '));
    if (R.extras.groups) L.push('By ' + P.groupBy + ': ' + R.extras.groups.map(g => g.group + ' ' + (bin ? 'AUC ' + this.prFmt(g.auc, 2) : 'RMSE ' + this.prFmt(g.rmse, 2))).join(', '));
    L.push('Not for: causal claims (importance says what the model uses, not what causes the outcome); rows unlike the training data; a different population or period without re-testing.');
    L.push('Made with GM 26.11 build ' + (this._E.BUILD || '') + ' · ' + new Date().toISOString().slice(0, 10));
    return L.join('\n');
  }
  // ---- small charts
  prRocSvg(key, roc, roc2) {
    const h = React.createElement, W = 300, H = 230, L = 36, B = 26, T = 8, R = 8, X = v => L + (W - L - R) * v, Y = v => T + (H - T - B) * (1 - v), F = "'Space Mono', monospace";
    const grid = [0, 0.25, 0.5, 0.75, 1].map(v => h('g', { key: v }, h('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#EEE8DC' }), h('text', { x: L - 5, y: Y(v) + 3, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, v.toFixed(2)), h('text', { x: X(v), y: H - B + 12, fontSize: 9, textAnchor: 'middle', fill: '#7E7563', fontFamily: F }, v.toFixed(2))));
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'ROC curve', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#fff' }), grid, h('line', { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: '#A79E8C', strokeDasharray: '4 3' }),
      roc2 ? h('polyline', { points: roc2.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' '), fill: 'none', stroke: '#A79E8C', strokeWidth: 1.6 }) : null, h('polyline', { points: roc.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' '), fill: 'none', stroke: '#194F39', strokeWidth: 2.4 }),
      h('text', { x: W - R - 4, y: H - B - 6, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, 'false-positive rate'), h('text', { x: L + 4, y: T + 10, fontSize: 9, fill: '#7E7563', fontFamily: F }, 'sensitivity'));
  }
  prCalibSvg(key, cal) {
    const h = React.createElement, W = 300, H = 230, L = 36, B = 26, T = 8, R = 8, X = v => L + (W - L - R) * v, Y = v => T + (H - T - B) * (1 - v), F = "'Space Mono', monospace", mx = Math.max(...cal.map(c => c.n), 1);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Calibration', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#fff' }), [0, 0.25, 0.5, 0.75, 1].map(v => h('g', { key: v }, h('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: '#EEE8DC' }), h('text', { x: L - 5, y: Y(v) + 3, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, v.toFixed(2)), h('text', { x: X(v), y: H - B + 12, fontSize: 9, textAnchor: 'middle', fill: '#7E7563', fontFamily: F }, v.toFixed(2)))),
      h('line', { x1: X(0), y1: Y(0), x2: X(1), y2: Y(1), stroke: '#A79E8C', strokeDasharray: '4 3' }), h('polyline', { points: cal.map(c => X(c.pred).toFixed(1) + ',' + Y(c.obs).toFixed(1)).join(' '), fill: 'none', stroke: '#194F39', strokeWidth: 2.2 }), cal.map((c, i) => h('circle', { key: i, cx: X(c.pred), cy: Y(c.obs), r: 2 + 4 * Math.sqrt(c.n / mx), fill: '#194F39', fillOpacity: 0.75 })),
      h('text', { x: W - R - 4, y: H - B - 6, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, 'predicted'), h('text', { x: L + 4, y: T + 10, fontSize: 9, fill: '#7E7563', fontFamily: F }, 'observed'));
  }
  prConfSvg(key, m, out) {
    const h = React.createElement, F = "'Space Mono', monospace", yes = out.ansLabel.length > 10 ? 'yes' : out.ansLabel, no = 'not ' + yes, cells = [[m.tp, '#194F39', 'true positive', 0, 0], [m.fn, '#C4681E', 'missed', 1, 0], [m.fp, '#C4681E', 'false alarm', 0, 1], [m.tn, '#194F39', 'true negative', 1, 1]], tot = m.tp + m.fn + m.fp + m.tn;
    return h('svg', { viewBox: '0 0 300 230', width: '100%', role: 'img', 'aria-label': 'Confusion matrix', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: 300, height: 230, fill: '#fff' }), h('text', { x: 170, y: 14, fontSize: 9.5, textAnchor: 'middle', fill: '#7E7563', fontFamily: F }, 'PREDICTED'), h('text', { x: 14, y: 130, fontSize: 9.5, textAnchor: 'middle', fill: '#7E7563', fontFamily: F, transform: 'rotate(-90 14 130)' }, 'ACTUAL'),
      [yes, no].map((l, i) => h('text', { key: 'c' + i, x: 110 + i * 120, y: 32, fontSize: 11, textAnchor: 'middle', fill: '#3D3629', fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif" }, l)), [yes, no].map((l, i) => h('text', { key: 'r' + i, x: 42, y: 85 + i * 88, fontSize: 11, textAnchor: 'middle', fill: '#3D3629', fontWeight: 700, fontFamily: "'Hanken Grotesk', sans-serif" }, l)),
      cells.map((c, i) => { const x = 52 + c[3] * 120, y = 42 + c[4] * 88, ok = c[2].startsWith('true'); return h('g', { key: i }, h('rect', { x, y, width: 112, height: 80, rx: 6, fill: c[1], fillOpacity: ok ? 0.1 + 0.5 * c[0] / tot : 0.06 + 0.4 * c[0] / tot, stroke: c[1], strokeOpacity: 0.5 }), h('text', { x: x + 56, y: y + 42, fontSize: 18, textAnchor: 'middle', fontWeight: 700, fill: c[1], fontFamily: F }, this.fmtN(c[0])), h('text', { x: x + 56, y: y + 62, fontSize: 9.5, textAnchor: 'middle', fill: '#5D5648', fontFamily: "'Hanken Grotesk', sans-serif" }, c[2] + (m.tp + m.fn + m.fp + m.tn !== m.n ? ' (weighted)' : ''))); }));
  }
  prPredObsSvg(key, y, pred, w, test) {
    const h = React.createElement, E = this._E, rows = Array.from(test).sort((a, b) => pred[a] - pred[b]), B = 10, pts = []; for (let b = 0; b < B; b++) { const a = Math.floor(rows.length * b / B), e = Math.floor(rows.length * (b + 1) / B); let sp = 0, sy = 0, sw = 0; for (let k = a; k < e; k++) { const i = rows[k], wi = w ? w[i] : 1; sp += wi * pred[i]; sy += wi * y[i]; sw += wi; } if (sw) pts.push([sp / sw, sy / sw]); }
    const all = pts.flat(), lo = Math.min(...all), hi = Math.max(...all), W = 620, H = 230, L = 56, Bm = 28, T = 8, R = 12, X = v => L + (W - L - R) * (v - lo) / ((hi - lo) || 1), Y = v => T + (H - T - Bm) * (1 - (v - lo) / ((hi - lo) || 1)), F = "'Space Mono', monospace", ticks = this.tlTicks(lo, hi, 5);
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Predicted against observed', ref: this.svgRef(key), className: 'tl-svg' }, h('rect', { width: W, height: H, fill: '#fff' }), ticks.map(t => h('g', { key: t }, h('line', { x1: L, x2: W - R, y1: Y(t), y2: Y(t), stroke: '#EEE8DC' }), h('text', { x: L - 6, y: Y(t) + 3, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, this.fmt(t, 1)), h('text', { x: X(t), y: H - Bm + 12, fontSize: 9, textAnchor: 'middle', fill: '#7E7563', fontFamily: F }, this.fmt(t, 1)))),
      h('line', { x1: X(lo), y1: Y(lo), x2: X(hi), y2: Y(hi), stroke: '#A79E8C', strokeDasharray: '4 3' }), h('polyline', { points: pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' '), fill: 'none', stroke: '#194F39', strokeWidth: 2.2 }), pts.map((p, i) => h('circle', { key: i, cx: X(p[0]), cy: Y(p[1]), r: 3.5, fill: '#194F39' })),
      h('text', { x: W - R - 4, y: H - Bm - 6, fontSize: 9, textAnchor: 'end', fill: '#7E7563', fontFamily: F }, 'predicted (decile mean)'), h('text', { x: L + 4, y: T + 10, fontSize: 9, fill: '#7E7563', fontFamily: F }, 'observed'));
  }
  // ---- R and Stata code for what was run
  prCodeLines(P, out) {
    const S = this.state, bin = !out || out.kind === 'binary', y = P.y || 'y', preds = (P.preds || []).join(', '), wgt = P.useW && S.weightVar ? S.weightVar : '', rv = this.tlRvec ? this.tlRvec(P.preds || []) : 'c(' + (P.preds || []).map(p => '"' + p + '"').join(', ') + ')';
    const yx = bin && out ? 'df$y01 <- ifelse(df$' + y + ' %in% c(' + out.ans.join(', ') + '), 1, ifelse(df$' + y + ' %in% c(' + out.drop.join(', ') + '), NA, 0))' : 'df$y01 <- df$' + y;
    const R = ['library(rsample); library(glmnet); library(rpart); library(ranger); library(class); library(pROC)', 'set.seed(' + P.seed + ')', yx, 'd <- df[!is.na(df$y01), c("y01", ' + rv + (wgt ? ', "' + wgt + '"' : '') + ')]',
      'X <- model.matrix(~ ., d[, ' + rv + '])[, -1]           # dummies against the most frequent level; the page imputes medians inside each fold',
      P.split === 'random' ? 'sp <- initial_split(d, prop = ' + ((100 - P.share) / 100) + ', strata = y01); tr <- training(sp); te <- testing(sp)' : P.split === 'time' ? 'tr <- d[df$' + P.timeVar + '[!is.na(df$y01)] < ' + P.cut + ', ]; te <- d[df$' + P.timeVar + '[!is.na(df$y01)] >= ' + P.cut + ', ]' : 'te <- d[df$' + P.groupVar + '[!is.na(df$y01)] == "' + P.hold + '", ]; tr <- d[df$' + P.groupVar + '[!is.na(df$y01)] != "' + P.hold + '", ]',
      'folds <- vfold_cv(tr, v = ' + P.folds + ', strata = y01)',
      bin ? 'm_logit <- glm(y01 ~ ., data = tr' + (wgt ? ', weights = ' + wgt + ' / mean(' + wgt + ')' : '') + ', family = binomial)' : 'm_lm <- lm(y01 ~ ., data = tr' + (wgt ? ', weights = ' + wgt : '') + ')',
      P.models.includes('lasso') ? 'm_lasso <- cv.glmnet(X[rownames(tr), ], tr$y01, family = "' + (bin ? 'binomial' : 'gaussian') + '", alpha = 1, nfolds = ' + P.folds + (wgt ? ', weights = tr$' + wgt : '') + ')   # lambda.1se' : null,
      P.models.includes('tree') ? 'm_tree <- rpart(y01 ~ ., data = tr, method = "' + (bin ? 'class' : 'anova') + '"' + (wgt ? ', weights = ' + wgt : '') + ', control = rpart.control(cp = -1, maxdepth = 4))   # depth chosen by CV' : null,
      P.models.includes('forest') ? 'm_rf <- ranger(' + (bin ? 'factor(y01)' : 'y01') + ' ~ ., data = tr, num.trees = ' + P.trees + (wgt ? ', case.weights = tr$' + wgt : '') + (bin ? ', probability = TRUE' : '') + ', importance = "permutation")' : null,
      P.models.includes('knn') ? 'p_knn <- knn(scale(X[rownames(tr), ]), scale(X[rownames(te), ]), tr$y01, k = 15, prob = TRUE)' : null,
      bin ? 'roc(te$y01, predict(m_rf, te)$predictions[, 2])            # test set, once' : 'sqrt(mean((te$y01 - predict(m_rf, te)$predictions)^2))   # test RMSE'].filter(Boolean);
    const ST = ['* Stata 17+: splitsample and lasso are built in; rforest is from ssc (ssc install rforest)', 'set seed ' + P.seed, bin && out ? 'gen y01 = inlist(' + y + ', ' + out.ans.join(', ') + ') if !inlist(' + y + ', ' + out.drop.join(', ') + ')' : 'gen y01 = ' + y, 'splitsample, generate(sample) split(' + ((100 - P.share) / 100) + ' ' + (P.share / 100) + ') rround' + (bin ? ' cluster(y01)' : ''),
      bin ? 'logit y01 ' + (P.preds || []).map(p => ((this.effMeta(p) || {}).treatAs === 'numeric' ? 'c.' : 'i.') + p).join(' ') + ' if sample == 1' + (wgt ? ' [pw = ' + wgt + ']' : '') : 'regress y01 ' + (P.preds || []).map(p => ((this.effMeta(p) || {}).treatAs === 'numeric' ? 'c.' : 'i.') + p).join(' ') + ' if sample == 1' + (wgt ? ' [pw = ' + wgt + ']' : ''),
      bin ? 'lasso logit y01 ' + (P.preds || []).map(p => ((this.effMeta(p) || {}).treatAs === 'numeric' ? 'c.' : 'i.') + p).join(' ') + ' if sample == 1, selection(cv, folds(' + P.folds + ')) rseed(' + P.seed + ')' : 'lasso linear y01 ' + (P.preds || []).map(p => ((this.effMeta(p) || {}).treatAs === 'numeric' ? 'c.' : 'i.') + p).join(' ') + ' if sample == 1, selection(cv, folds(' + P.folds + ')) rseed(' + P.seed + ')',
      P.models.includes('forest') ? 'rforest y01 ' + preds.replace(/, /g, ' ') + ' if sample == 1, type(' + (bin ? 'class' : 'reg') + ') iterations(' + P.trees + ') seed(' + P.seed + ')' : null, 'predict p_hat if sample == 2' + (bin ? ', pr' : ''), bin ? 'roctab y01 p_hat if sample == 2' : 'gen sq = (y01 - p_hat)^2 if sample == 2; summarize sq; display sqrt(r(mean))'].filter(Boolean);
    return { R, ST };
  }
  prCodePanel(P, out, J) {
    const h = React.createElement, { R, ST } = this.prCodeLines(P, out);
    return h('section', { className: 'tl-panel' }, h('div', { className: 'tl-ptitle' }, h('h3', null, 'R and Stata code'), h('span', null, 'the same analysis outside the calculator (the page\'s own fits are in the engine, validated against these packages)')), h('div', { className: 'pr-two' }, h('div', null, h('p', { className: 'tl-lbl' }, 'R'), h('pre', { className: 'tl-code' }, R.join('\n'))), h('div', null, h('p', { className: 'tl-lbl' }, 'Stata'), h('pre', { className: 'tl-code' }, ST.join('\n')))));
  }
  // GM26 predict lab end
