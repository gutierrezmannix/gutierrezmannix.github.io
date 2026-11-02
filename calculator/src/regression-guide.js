  // GM26 regression guide begin
  // Tests ▾ → Regression as eight steps, like Networks and Text analysis: 1 outcome → 2 model → 3 predictors →
  // 4 weights and standard errors → 5 results → 6 checks → 7 predictions (margins / marginsplot) → 8 export.
  // Linear, logit, ordinal logit and Poisson are fitted by the Regression page itself (engine regress / glm / ologit,
  // checked against R and NIST); the nine other models run in the Tests engine (validated against R) and show their
  // tables here. The page's own panels (predictors, coefficients, VIF, residuals, publication table) appear in the step
  // they belong to; this module adds the rest.
  rgDefs() {
    return {
      types: [
        { k: 'num', g: 'Linear models', gx: 'a continuous outcome', icon: '123', t: 'A number', ex: 'income, age, a test score', models: ['ols', 'robustreg', 'quantile', 'spline', 'gam'] },
        { k: 'bin', g: 'Binary outcomes', gx: 'yes / no, 0 / 1', icon: '✓✕', t: 'Yes / No', ex: 'poor or not, voted, has insurance', models: ['logistic', 'probit'] },
        { k: 'ord', g: 'Ordinal outcomes', gx: 'ordered levels: 1 < 2 < 3', icon: '1‹2‹3', t: 'Ordered levels', ex: 'satisfaction 1–5, education level', models: ['ologit'] },
        { k: 'cat', g: 'Categorical outcomes', gx: 'categories without order', icon: 'A·B·C', t: 'Categories without order', ex: 'party, religion, type of job', models: ['multinomial'] },
        { k: 'count', g: 'Count outcomes', gx: '0, 1, 2 …', icon: '#', t: 'A count', ex: 'children, doctor visits, arrests', models: ['poisson', 'negbin', 'zeroinfl', 'hurdle'] }],
      models: {
        ols: { cmd: 'regress', t: 'Linear regression (OLS)', sub: 'The usual choice for a number: how much the outcome changes per unit of each predictor.', st: 'regress', r: 'lm()', core: true },
        robustreg: { cmd: 'rreg', t: 'Robust regression', sub: 'Like OLS, but a few extreme values pull the line much less.', st: 'rreg', r: 'MASS::rlm()' },
        quantile: { cmd: 'qreg', t: 'Quantile regression', sub: 'The median (or another percentile) instead of the mean; good for skewed outcomes such as income.', st: 'qreg', r: 'quantreg::rq()' },
        spline: { cmd: 'mkspline + regress', t: 'Linear regression with splines', sub: 'Lets numeric predictors bend, for relationships that are not a straight line.', st: 'mkspline, then regress', r: 'lm(y ~ splines::ns(x, df))' },
        gam: { cmd: 'R: mgcv::gam', t: 'Generalized additive model (GAM)', sub: 'Smooth curves for the numeric predictors, their shape chosen from the data.', st: 'no built-in command', r: 'mgcv::gam()' },
        logistic: { cmd: 'logit', t: 'Logistic regression (logit)', sub: 'The usual choice for yes / no: odds ratios, and changes in the chance in percentage points.', st: 'logit', r: 'glm(family = binomial)', core: true },
        probit: { cmd: 'probit', t: 'Probit regression', sub: 'Same conclusions as logit, coefficients on another scale; common in economics.', st: 'probit', r: 'glm(binomial(link = "probit"))' },
        ologit: { cmd: 'ologit', t: 'Ordered logistic regression', sub: 'For ordered levels (1 < 2 < 3 …): the odds of being in a higher level.', st: 'ologit', r: 'MASS::polr()', core: true },
        multinomial: { cmd: 'mlogit', t: 'Multinomial logistic regression', sub: 'For categories without order: each one compared with a base category.', st: 'mlogit', r: 'nnet::multinom()' },
        poisson: { cmd: 'poisson', t: 'Poisson regression', sub: 'The usual start for counts (0, 1, 2 …): rate ratios.', st: 'poisson', r: 'glm(family = poisson)', core: true },
        negbin: { cmd: 'nbreg', t: 'Negative binomial regression', sub: 'Counts that vary more than Poisson allows (overdispersion).', st: 'nbreg', r: 'MASS::glm.nb()' },
        zeroinfl: { cmd: 'zip / zinb', t: 'Zero-inflated Poisson / negative binomial', sub: 'Extra zeros from a group that is always zero (people who never visit a doctor).', st: 'zinb / zip', r: 'pscl::zeroinfl()' },
        hurdle: { cmd: 'logit + tnbreg', t: 'Hurdle model', sub: 'Zero or not, then how many: two separate parts.', st: 'two parts: logit and tnbreg', r: 'pscl::hurdle()' }
      },
      steps: ['Model & outcome', 'Options', 'Predictors', 'Weights · SEs', 'Results', 'Checks', 'Predictions', 'Export']
    };
  }
  // What kind of outcome a variable is, from its values (the user can override it in step 1).
  rgDetect(v) {
    const E = this._E; if (!v || !this.effMeta(v)) return null;
    const col = this._raw.cols[this._raw.names.indexOf(v)], numeric = !!(col && col.k === 'n'), cv = this.vals(v);
    const fr = E.freqOf(cv.kind === 'cat' ? cv.a : Array.from(cv.a, x => isFinite(x) ? E.numLab(x) : null), null), k = fr.rows.length;
    const lab = l => { const s = String(this.vlabel(v, l)); return s !== String(l) ? l + ' = ' + s : String(l); };
    if (k < 2) return { type: 'num', why: v + ' has a single value — it cannot be explained', k };
    if (k === 2) { const b = this.regBin(v); return { type: 'bin', why: v + ' has 2 values: ' + [b.zero, b.one].map(lab).join(', '), k }; }
    if (!numeric) return { type: 'cat', why: v + ' is text with ' + k + ' categories (' + fr.rows.slice(0, 4).map(r => r.label).join(', ') + (k > 4 ? ', …' : '') + ')', k };
    const a = this.numVals(v).a; let mn = Infinity, mx = -Infinity, s = 0, n = 0, allInt = true;
    for (const x of a) if (Number.isFinite(x)) { if (x < mn) mn = x; if (x > mx) mx = x; s += x; n++; if (!Number.isInteger(x)) allInt = false; }
    const hasVL = !!(this._raw.vlabs && this._raw.vlabs[v]), f = x => this.cmFmt(x);
    if (allInt && hasVL && k <= 10) return { type: 'ord', why: v + ' has ' + k + ' labelled codes (' + fr.rows.slice(0, 3).map(r => lab(r.label)).join(', ') + (k > 3 ? ', …' : '') + ')', k };
    if (allInt && mn === 0 && k >= 3) return { type: 'count', why: v + ' holds whole numbers from 0 to ' + f(mx) + ' (mean ' + f(s / n) + ')', k };
    if (allInt && k <= 7) return { type: 'ord', why: v + ' has ' + k + ' whole-number levels, ' + f(mn) + ' to ' + f(mx), k };
    return { type: 'num', why: v + ' is a number from ' + f(mn) + ' to ' + f(mx) + ' (mean ' + f(s / n) + ')', k };
  }
  rgModelPatch(m) { return this.rgDefs().models[m]?.core ? { regModel: m, rgModel: '' } : { rgModel: m }; }
  rgNow() {
    const S = this.state, D = this.rgDefs(), det = this.rgDetect(S.depVar), type = S.rgType || (det && det.type) || 'num', T = D.types.find(t => t.k === type);
    const extra = S.rgModel && D.models[S.rgModel] && !D.models[S.rgModel].core ? S.rgModel : '', model = extra || S.regModel || 'ols';
    return { S, D, det, type, T, extra, model, info: D.models[model], step: Math.min(8, Math.max(1, S.rgStep | 0 || 1)) };
  }
  rgGo(step) { this.setState({ rgStep: step }); try { requestAnimationFrame(() => { const el = document.querySelector('.rg-bar'); if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); } catch (e) { } }
  rgPickOutcome(v) {
    const det = this.rgDetect(v), D = this.rgDefs(), T = D.types.find(t => t.k === (det ? det.type : 'num')), cur = this.rgNow().model;
    // GM26 .70: a model chosen first (step 1 or the Tests menu) stays; otherwise the one that fits the outcome
    if (this.state.rgModelPicked) { const TM = D.types.find(t => t.models.includes(cur)); this.clearMemo(); this.setState({ depVar: v, rgType: TM ? TM.k : '', predictors: (this.state.predictors || []).filter(p => p !== v) }); return; }
    this.clearMemo(); this.setState(Object.assign({ depVar: v, rgType: '', predictors: (this.state.predictors || []).filter(p => p !== v) }, this.rgModelPatch(T.models.includes(cur) ? cur : T.models[0])));
  }
  rgPickType(k) { const T = this.rgDefs().types.find(t => t.k === k), cur = this.rgNow().model; this.clearMemo(); this.setState(Object.assign({ rgType: k }, this.rgModelPatch(T.models.includes(cur) ? cur : T.models[0]))); }
  rgPickModel(m) { const D = this.rgDefs(), T = D.types.find(t => t.models.includes(m)), now = this.rgNow(); this.clearMemo(); this.setState(Object.assign({ rgModelPicked: true }, this.rgModelPatch(m), T && T.k !== now.type ? { rgType: T.k } : {})); }
  // Fit the current specification: the Regression page's own run, or the Tests engine for the other models.
  rgRun(out) {
    const now = this.rgNow(), S = this.state;
    if (!S.depVar || !(S.predictors || []).length) { this.flash('Choose the outcome (step 1) and at least one predictor (step 3) first'); return; }
    if (now.extra) {
      const id = now.extra, pages = Object.assign({}, S.analysisPages || {}), old = pages[id] || {};
      pages[id] = Object.assign({}, old, { fields: Object.assign({}, old.fields || {}, { y: [S.depVar], predictors: [...S.predictors] }) });
      this.setState({ analysisPages: pages, analysisId: id, rgStep: 5 }, () => this.asRun());
      return;
    }
    if (out && out.regRun) out.regRun(); this.setState({ rgStep: 5 });
  }
  rgExtraResult() { const now = this.rgNow(); if (!now.extra || this.state.analysisId !== now.extra) return null; const snap = this._asResult; return snap && snap.signature === this.asSignature() ? snap.result : null; }
  // ---------- the page ----------
  rgVals(out) {
    const h = React.createElement, now = this.rgNow(), { S, D, step, extra } = now;
    // the Regression page's own panels, each in its step
    const ran = !!out.regRan, coreModel = !extra;
    out.rgSetup = step === 3; out.rgClassic = false; out.rgFit = step === 5 && coreModel; out.rgPub = step === 8 && coreModel;
    // the page's own panels, each in its step (separate flags, so the page's own values stay as they are)
    out.rgVifShow = !!out.vifShow && step === 6 && coreModel; out.rgHasDiag = !!out.hasDiag && step === 6 && coreModel; out.rgMgShow = false; out.rgMgBusy = false;
    out.rgHasCoefPlot = !!out.hasCoefPlot && step === 5 && coreModel;
    out.rgHasModel = !!out.hasModel && coreModel && (step === 5 || step === 6 || step === 8);
    out.rgInterpOn = false; out.rgHasKeyLine = !!out.hasKeyLine && step === 5 && coreModel;
    out.rgRegEmpty = !!out.regEmpty && coreModel && step >= 5; out.rgHasRegError = !!out.hasRegError && coreModel && step >= 3; out.rgRegBusy = !!out.regBusy && step >= 3;
    const bar = this.rgBar(now, out);
    this._rgAfter = null; this._rgNotes = null;
    const body2 = [this.rgStep1, this.rgStep2, this.rgStep3, this.rgStep4, this.rgStep5, this.rgStep6, this.rgStep7, this.rgStep8][step - 1].call(this, now, out);
    out.rgEl = h('div', { className: 'tl rg' }, bar, ...[].concat(body2).filter(Boolean));
    out.rgEl2 = this._rgAfter ? h('div', { className: 'tl rg' }, this._rgAfter) : null;
    out.rgEl3 = this._rgNotes ? h('div', { className: 'tl rg' }, this._rgNotes) : null;
  }
  rgBar(now, out) {
    const h = React.createElement, { S, D, step, extra, info, det } = now, ran = extra ? !!this.rgExtraResult() : !!out.regRan, preds = S.predictors || [];
    const done = [!!S.depVar, !!info, preds.length > 0, true, ran, ran, ran, ran];
    const steps = h('nav', { className: 'tl-steps rg-bar', 'aria-label': 'Regression steps' }, ...D.steps.map((t, i) => h('button', { type: 'button', key: t, className: 'tl-step' + (step === i + 1 ? ' on' : done[i] && i + 1 < step ? ' done' : ''), 'aria-current': step === i + 1 ? 'step' : undefined, onClick: () => this.rgGo(i + 1) }, h('b', null, done[i] && i + 1 !== step && (i < 4 || ran) ? '✓' : String(i + 1)), t)));
    const vce = { robust: 'robust SEs', cluster: 'clustered by ' + (S.regCl || '…'), svy: 'survey design' }[S.regVce] || '';
    const bits = [S.depVar ? h('b', { key: 'y' }, S.depVar) : h('span', { key: 'y', className: 'rg-mut' }, 'no outcome yet'), S.depVar ? ' · ' + (now.T ? now.T.t.toLowerCase() : '') : '', ' → ', h('b', { key: 'm' }, info ? info.t : '—'), ' · ' + (preds.length ? preds.length + ' predictor' + (preds.length > 1 ? 's' : '') : 'no predictors yet'), S.weightVar && !extra ? ' · weighted by ' + S.weightVar : '', vce && !extra ? ' · ' + vce : ''];
    const canRun = !!(S.depVar && preds.length), busy = extra ? !!S.analysisBusy : !!out.regBusy;
    const run = this.tlBtn(busy ? 'Running…' : ran ? '✓ Run again' : '▶ Run the model', () => this.rgRun(out), canRun && !ran ? 'primary' : '', { disabled: !canRun || busy, 'aria-label': 'Run the model' });
    return h('section', { className: 'tl-panel rg-head' }, h('div', { className: 'tl-ptitle' }, h('h3', null, 'Regression'), h('span', null, 'explain or predict one variable from others · every model on one page')),
      steps, h('div', { className: 'rg-sum' }, h('span', { className: 'rg-sumtxt' }, ...bits), h('span', { className: 'rg-nav' }, step > 1 ? this.tlBtn('← Back', () => this.rgGo(step - 1)) : null, step < 8 ? this.tlBtn('Next: ' + D.steps[step] + ' →', () => this.rgGo(step + 1)) : null, step >= 3 ? run : null)));
  }
  rgPanel(n, title, sub, ...kids) { const h = React.createElement; return h('section', { className: 'tl-panel rg-step', key: 'p' + n + title }, h('div', { className: 'tl-ptitle' }, h('h3', null, n ? n + ' · ' + title : title), sub ? h('span', null, sub) : null), h('div', { className: 'rg-body' }, ...kids)); }
  // ---------- 1 · model & outcome (GM26 .70: as in Stata — the model by name, grouped by kind of outcome; the dependent
  // variable from a searchable box with labels; what the data look like, and the model that fits, as a hint) ----------
  rgStep1(now) {
    const h = React.createElement, { S, D, det, model } = now, cols = S.cols || [];
    const TM = D.types.find(t => t.models.includes(model)), fitsT = det && S.depVar ? D.types.find(t => t.k === det.type) : null;
    const pick = this.tlSelect(S.depVar || '', [['', 'type or choose the dependent variable…']].concat(cols.map(c => [c.name, c.name])), v => v ? this.rgPickOutcome(v) : this.setState({ depVar: '' }), 'Outcome', { className: 'rg-big', combo: true, comboId: 'rg|outcome' });
    const groups = D.types.map(T => h('div', { key: T.k, className: 'rg-mgroup' + (fitsT && fitsT.k === T.k ? ' fits' : ''), role: 'group', 'aria-label': T.g },
      h('div', { className: 'rg-mg' }, h('b', null, T.g), h('span', { className: 'rg-mut' }, T.gx), fitsT && fitsT.k === T.k ? h('span', { className: 'rg-tag' }, 'FITS ' + S.depVar) : null),
      ...T.models.map(m => { const M = D.models[m], on = model === m; return h('button', { type: 'button', key: m, className: 'rg-mbtn' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', title: M.sub, onClick: () => this.rgPickModel(m) }, h('span', null, M.t), h('code', null, M.cmd || M.st)); })));
    let note = null;
    if (S.depVar && det && fitsT && TM && fitsT.k !== TM.k) note = this.tlBanner('warn', det.why + '. ', h('b', null, D.models[model].t), ' is for ' + TM.gx + '; ', h('b', null, D.models[fitsT.models[0]].t), ' fits ' + S.depVar + '. ', this.tlBtn('Use ' + D.models[fitsT.models[0]].t, () => this.rgPickModel(fitsT.models[0])));
    else if (S.depVar && now.type === 'bin') {
      const b = this.regBin(S.depVar), cv = this.vals(S.depVar), fr = this._E.freqOf(cv.kind === 'cat' ? cv.a : Array.from(cv.a, x => isFinite(x) ? this._E.numLab(x) : null), null), tot = fr.rows.reduce((s2, r) => s2 + r.c, 0), share = l => { const r = fr.rows.find(q => String(q.label) === String(l)); return r ? r.c / tot : 0; };
      if (b.one != null) note = this.tlBanner('info', S.depVar + ': ', h('b', null, this.fmt(100 * share(b.one), 1) + '% are ' + this.vlabel(S.depVar, b.one)), ' (' + this.fmtN(Math.round(share(b.one) * tot)) + ' rows), ' + this.fmt(100 * share(b.zero), 1) + '% are ' + this.vlabel(S.depVar, b.zero) + '. The model predicts ', h('b', null, this.vlabel(S.depVar, b.one)), '. ', this.tlBtn('Model ' + this.vlabel(S.depVar, b.zero) + ' instead', () => this.setState({ binOne: { y: S.depVar, v: String(b.zero) } })));
    } else if (S.depVar && det) note = this.tlBanner('info', det.why + '.');
    const other = h('p', { className: 'rg-mut rg-other' }, 'Other models: ', h('button', { type: 'button', className: 'tl-link', onClick: () => this.asOpen('cox') }, 'survival (Cox, stcox)'), ' · ', h('button', { type: 'button', className: 'tl-link', onClick: () => this.asRoute ? this.setState({ mfNav: 'tests' }) : null }, 'multilevel & panel (mixed, xtreg) in Tests ▾'));
    return this.rgPanel(1, 'Model & outcome', 'choose the model, then the dependent variable — as in Stata',
      h('div', { className: 'rg-q' }, h('span', { className: 'tl-lbl' }, 'Dependent variable'), pick),
      h('div', { className: 'rg-models' }, ...groups), note, other);
  }
  // ---------- 2 · model ----------
  rgStep2(now) {
    const h = React.createElement, { S, D, T, model, type } = now, rec = T.models[0], alts = T.models.slice(1);
    const card = (m, isRec) => { const M = D.models[m], on = model === m; return h('button', { type: 'button', key: m, className: 'rg-mcard' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onClick: () => this.rgPickModel(m) }, isRec ? h('span', { className: 'rg-tag' }, 'RECOMMENDED') : null, h('span', { className: 'rg-ct' }, h('span', { className: 'rg-radio' + (on ? ' on' : '') }), M.t), h('span', { className: 'rg-ex' }, M.sub), h('span', { className: 'rg-why mono' }, 'Stata: ' + M.st + ' · R: ' + M.r)); };
    const opts = this.rgModelOptions(model);
    // three plain questions that change the choice
    const yn = (on, set, aria) => this.tlSeg([['no', 'No'], ['yes', 'Yes']], on ? 'yes' : 'no', v => set(v === 'yes'), { 'aria-label': aria });
    const cl = S.regVce === 'cluster', idCands = (S.cols || []).filter(c => c.name !== S.depVar && c.distinct > 1 && c.distinct < (S.nRows || 0) && /^(folio|id|hog|house|viv|clave|cve|school|escuela|ent|estado|state|country|pais|municip|person|persona|upm|psu|cluster)/i.test(c.name)).map(c => c.name);
    const q1 = h('div', { className: 'rg-qrow' + (cl ? ' on' : '') }, h('span', { className: 'rg-qt' }, 'Do the same people or places appear more than once? ', h('span', { className: 'rg-mut' }, '(several people per household, the same state every year)')),
      yn(cl, v => this.setState(v ? { regVce: 'cluster', regCl: S.regCl || idCands[0] || '' } : { regVce: 'classical' }), 'Rows repeat'),
      h('span', { className: 'rg-qa' }, cl ? ['standard errors clustered by ', this.tlSelect(S.regCl || '', [['', 'choose the group…']].concat((S.cols || []).filter(c => c.name !== S.depVar).map(c => [c.name, c.name])), v => this.setState({ regCl: v }), 'Cluster by'), now.extra ? ' (for this model use ' : ' · or a ', h('button', { type: 'button', className: 'tl-link', key: 'mx', onClick: () => this.asOpen('mixed') }, 'multilevel model'), now.extra ? ')' : ''] : 'Yes → clustered standard errors or a multilevel model'));
    const q2 = h('div', { className: 'rg-qrow' }, h('span', { className: 'rg-qt' }, 'Is the goal to ', h('b', null, 'predict'), ' rather than to explain? ', h('span', { className: 'rg-mut' }, '(many predictors, accuracy matters most)')), h('span', { className: 'rg-qa' }, 'Prediction models: ', ...[['lasso', 'Lasso'], ['ridge', 'Ridge'], ['tree', 'Decision tree']].map(([id, l], i) => h('button', { type: 'button', key: id, className: 'tl-link', onClick: () => this.asOpen(id) }, (i ? ' · ' : '') + l))));
    let q3 = null; const st = S.depVar ? this.rgOutcomeStats(S.depVar, type) : null;
    if (st && type === 'bin') q3 = h('div', { className: 'rg-qrow' }, h('span', { className: 'rg-qt' }, 'Is “' + st.oneLab + '” rare, under 5% of rows? ', h('span', { className: 'rg-mut' }, '(checked: ' + this.fmt(100 * st.share, 1) + '%)')), h('span', { className: 'rg-qa' }, st.share < 0.05 ? 'Rare: few events per predictor — keep the model small, and read p-values with care.' : 'No: logit works well here.'));
    if (st && type === 'count') q3 = h('div', { className: 'rg-qrow' }, h('span', { className: 'rg-qt' }, 'Many zeros, or more spread than the mean? ', h('span', { className: 'rg-mut' }, '(checked: ' + this.fmt(100 * st.zeros, 0) + '% zeros, variance ' + this.fmt(st.ratio, 1) + '× the mean)')), h('span', { className: 'rg-qa' }, st.ratio > 1.5 ? ['More spread than Poisson allows → ', h('button', { type: 'button', className: 'tl-link', key: 'nb', onClick: () => this.rgPickModel('negbin') }, 'negative binomial')] : 'Poisson fits the spread.', st.zeros > 0.3 ? [' · many zeros → ', h('button', { type: 'button', className: 'tl-link', key: 'zi', onClick: () => this.rgPickModel('zeroinfl') }, 'zero-inflated'), ' or ', h('button', { type: 'button', className: 'tl-link', key: 'hu', onClick: () => this.rgPickModel('hurdle') }, 'hurdle')] : ''));
    if (st && type === 'num') q3 = h('div', { className: 'rg-qrow' }, h('span', { className: 'rg-qt' }, 'Very skewed, or a few extreme values? ', h('span', { className: 'rg-mut' }, '(checked: skew ' + this.fmt(st.skew, 1) + ')')), h('span', { className: 'rg-qa' }, Math.abs(st.skew) > 1 ? ['Skewed → ', h('button', { type: 'button', className: 'tl-link', key: 'q', onClick: () => this.rgPickModel('quantile') }, 'quantile (median) regression'), ' or ', h('button', { type: 'button', className: 'tl-link', key: 'r', onClick: () => this.rgPickModel('robustreg') }, 'robust regression'), '; or log the outcome (Data → Make a new variable)'] : 'No: OLS is fine.'));
    const all = h('details', { className: 'rg-all', open: !T.models.includes(model) || undefined }, h('summary', { className: 'tl-lbl' }, 'All 13 models, by kind of outcome · the ones for other kinds are faded'),
      h('div', { className: 'rg-grid' }, ...D.types.map(t2 => h('div', { key: t2.k, className: 'rg-col' + (t2.k === type ? '' : ' faded') }, h('span', { className: 'tl-lbl' }, t2.t), ...t2.models.map(m => this.tlChip((model === m ? '✓ ' : '') + D.models[m].t, model === m, () => this.rgPickModel(m), { key: m }))))));
    const mismatch = !T.models.includes(model) ? this.tlBanner('warn', D.models[model].t + ' is meant for ' + (D.types.find(t2 => t2.models.includes(model)) || T).t.toLowerCase() + ' outcomes, and ' + (S.depVar || 'the outcome') + ' looks like ' + T.t.toLowerCase() + '. ', this.tlBtn('Use ' + D.models[rec].t, () => this.rgPickModel(rec))) : null;
    return this.rgPanel(2, 'Options', D.models[model].t + ' · ' + D.models[model].st + (S.depVar ? ' · ' + S.depVar : ''), mismatch, h('p', { className: 'rg-mut' }, D.models[model].sub, ' ', h('button', { type: 'button', className: 'tl-link', onClick: () => this.rgGo(1) }, 'Change the model →')), opts, // GM26 .70: the model is chosen in step 1
      h('div', { className: 'rg-qs' }, h('span', { className: 'tl-lbl' }, 'Quick questions about your data'), q1, q2, q3));
  }
  rgOutcomeStats(v, type) {
    return this.memo('rgst|' + v + '|' + type, () => {
      if (type === 'bin') { const b = this.regBin(v), cv = this.vals(v), fr = this._E.freqOf(cv.kind === 'cat' ? cv.a : Array.from(cv.a, x => isFinite(x) ? this._E.numLab(x) : null), null), tot = fr.rows.reduce((s, r) => s + r.c, 0), r1 = fr.rows.find(r => String(r.label) === String(b.one)); return { share: r1 ? r1.c / tot : 0, oneLab: String(this.vlabel(v, b.one)) }; }
      const a = (this.numVals(v) || { a: [] }).a; let n = 0, s = 0, s2 = 0, s3 = 0, z = 0; for (const x of a) if (Number.isFinite(x)) { n++; s += x; if (x === 0) z++; } const m = s / n; for (const x of a) if (Number.isFinite(x)) { const d = x - m; s2 += d * d; s3 += d * d * d; }
      const vr = s2 / Math.max(1, n - 1), sd = Math.sqrt(s2 / n); return { zeros: z / n, ratio: m > 0 ? vr / m : NaN, skew: sd > 0 ? (s3 / n) / (sd * sd * sd) : 0 };
    });
  }
  // the few options the other models have (quantile, spline degrees of freedom, GAM family, count part)
  rgModelOptions(m) {
    const h = React.createElement, S = this.state, page = (S.analysisPages || {})[m] || {}, o = page.options || {}, info = this.asCatalog().find(q => q.id === m); if (!info) return null;
    const set = (k, v) => { const pages = Object.assign({}, S.analysisPages || {}); pages[m] = Object.assign({}, page, { options: Object.assign({}, o, { [k]: v }) }); this.setState({ analysisPages: pages }); };
    const v = k => o[k] ?? info.options[k], rows = [];
    if ('tau' in info.options) rows.push(h('label', { key: 'tau', className: 'rg-opt' }, 'Percentile ', this.tlSeg([[0.1, '10th'], [0.25, '25th'], [0.5, 'median'], [0.75, '75th'], [0.9, '90th']], Number(v('tau')), x => set('tau', x), { 'aria-label': 'Percentile' })));
    if ('df' in info.options) rows.push(h('label', { key: 'df', className: 'rg-opt' }, 'Flexibility (degrees of freedom) ', this.tlNum(Number(v('df')), x => set('df', x), { min: 2, max: 10, aria: 'Degrees of freedom', width: 60 })));
    if ('family' in info.options) rows.push(h('label', { key: 'fam', className: 'rg-opt' }, 'Outcome family ', this.tlSeg([['gaussian', 'number'], ['binomial', 'yes / no'], ['poisson', 'count (Poisson)'], ['negbin', 'count (neg. binomial)']], v('family'), x => set('family', x), { 'aria-label': 'Family' })));
    if ('countFamily' in info.options) rows.push(h('label', { key: 'cf', className: 'rg-opt' }, 'Count part ', this.tlSeg([['negbin', 'negative binomial'], ['poisson', 'Poisson']], v('countFamily'), x => set('countFamily', x), { 'aria-label': 'Count part' })));
    return rows.length ? h('div', { className: 'rg-opts' }, ...rows) : null;
  }
  // ---------- 3 · predictors (the page's own picker, plus what to show as predictions) ----------
  // GM26 .70: rows with data on the outcome, every predictor, the weight and the cluster / PSU variable. When they are
  // few, say which variables do not overlap — by survey wave when the file has a year or wave variable (LAPOP, ENIGH).
  rgCoverage() {
    const S = this.state, y = S.depVar, preds = (S.predictors || []).filter(Boolean); if (!this._raw || !y || !preds.length) return null;
    const vce = S.regVce || 'classical', cl = vce === 'cluster' ? S.regCl : vce === 'svy' ? S.svyPsu : '';
    const vars = [...new Set([y, ...preds, ...(S.weightVar ? [S.weightVar] : []), ...(cl ? [cl] : [])])];
    return this.memo('rgcov|' + vars.join(',') + '|' + (S.autoScreen ? 1 : 0) + '|' + (S.missingCodes || ''), () => {
      const n = this._raw.n, fmt = x => this.fmtN(x);
      const has = vars.map(v => { const c = this.effMeta(v) ? (this.numVals(v) || this.vals(v)) : null; if (!c) return () => false; const a = c.a; return c.kind === 'num' ? i => a[i] === a[i] && isFinite(a[i]) : i => a[i] != null && a[i] !== ''; });
      const cnt = vars.map(() => 0); let all = 0;
      for (let i = 0; i < n; i++) { let ok = true; for (let k = 0; k < vars.length; k++) { if (has[k](i)) cnt[k]++; else ok = false; } if (ok) all++; }
      const yN = cnt[0]; if (!yN) return { n: 0, yN: 0, msg: y + ' has no values here.' };
      const okW = c => c && c.type === 'numeric' && c.distinct >= 2 && c.distinct <= 60 && !vars.includes(c.name), cs = S.cols || [];
      const wc = ['year', 'anio', 'año', 'ano', 'yr', 'survey_year', 'surveyyear', 'wave', 'ronda', 'round', 'ola', 'periodo'].map(nm => cs.find(c => c.name.toLowerCase() === nm)).find(okW);
      const t = wc && this.numVals(wc.name), tv = t ? t.a : null;
      let allW = null, wOf = null;
      if (tv) { const sets = vars.map(() => new Set()); for (let i = 0; i < n; i++) { const w = tv[i]; if (!isFinite(w)) continue; for (let k = 0; k < vars.length; k++) if (has[k](i)) sets[k].add(w); } allW = [...new Set(sets.flatMap(x => [...x]))].sort((a, b) => a - b); wOf = sets; }
      const runs = set => { const out = []; let a = null, b = null; for (const w of allW) { if (set.has(w)) { if (a == null) a = w; b = w; } else if (a != null) { out.push(a === b ? String(a) : a + '–' + b); a = null; } } if (a != null) out.push(a === b ? String(a) : a + '–' + b); return out.join(', ') || 'none'; };
      const sameW = k => !wOf || (wOf[k].size === wOf[0].size && [...wOf[0]].every(w => wOf[k].has(w)));
      const lim = vars.map((v, k) => k).filter(k => k > 0 && (cnt[k] < 0.9 * yN || !sameW(k))).sort((a, b) => cnt[a] - cnt[b]).slice(0, 4);
      if (!lim.length || all >= yN || (all >= 0.5 * yN && all >= 30)) return { n: all, yN, msg: '' };
      const where = k => wOf ? (wOf[k].size === 1 ? ' is only in ' : ' is in ') + wc.name + ' ' + runs(wOf[k]) + ' (' + fmt(cnt[k]) + ' rows)' : ' has data in ' + fmt(cnt[k]) + ' rows';
      const lead = all ? 'Only ' + fmt(all) + ' of the ' + fmt(yN) + ' rows with ' + y + ' have data on every variable of the model.' : 'No row has data on all of ' + vars.slice(0, -1).join(', ') + ' and ' + vars[vars.length - 1] + '.';
      const notes = lim.map(k => vars[k] + where(k)).concat(lim.length && wOf && !sameW(0) && lim.length < 2 ? [y + where(0)] : []);
      return { n: all, yN, msg: lead + (notes.length ? ' ' + notes.join('; ') + '.' : '') + (all < 30 && lim.length ? ' Remove ' + (lim.length > 1 ? 'one of them' : vars[lim[0]]) + ', or use a variable asked in the same ' + (wOf ? (wc.name === 'year' || /^(anio|año|ano|yr)$/i.test(wc.name) ? 'years' : 'waves') : 'rows') + '.' : '') };
    });
  }
  rgStep3(now) {
    const h = React.createElement, { S } = now, preds = S.predictors || [], g = this.rgMg(), opt = [['', 'none']].concat(preds.map(p => [p, p]));
    const cov = this.rgCoverage();
    this._rgAfter = [cov && cov.msg ? this.tlBanner(cov.n < 30 ? 'warn' : 'info', cov.msg) : null, this.rgPanel(0, 'Predictions to show (margins)', 'optional · the values and the plot are set in step 7',
      h('div', { className: 'rg-row' }, h('span', { className: 'tl-lbl' }, 'X axis'), this.tlSelect(g.x || '', opt, v => this.rgMgSet({ x: v, by: g.by === v ? '' : g.by }), 'Margins X axis'), h('span', null, '· one line for each'), this.tlSelect(g.by || '', opt.filter(([p]) => p === '' || p !== g.x), v => this.rgMgSet({ by: v }), 'Margins lines by')))];
    return null;
  }
  // ---------- 4 · weights and standard errors ----------
  rgStep4(now) {
    const h = React.createElement, { S, extra } = now, cols = (S.cols || []).filter(c => c.name !== S.depVar), num = cols.filter(c => c.type === 'numeric');
    if (extra) return this.rgPanel(4, 'Weights and standard errors', '', this.tlBanner(S.weightVar ? 'warn' : 'info', this.rgDefs().models[extra].t + ' runs in the Tests engine without weights, with its usual standard errors' + (S.weightVar ? ', so the weight ' + S.weightVar + ' has to be cleared first. ' : '. ') + 'Weights, robust, clustered and survey standard errors are available for linear, logit, ordinal and Poisson regression.', S.weightVar ? [' ', this.tlBtn('Clear the weight', () => { this.clearMemo(); this.setState({ weightVar: '', weightAuto: false }); }, 'primary', { key: 'cw' })] : null));
    const vce = S.regVce || 'classical';
    const seg = this.tlSeg([['classical', 'Classical', 'Assumes every row is independent with the same spread'], ['robust', 'Robust (HC1)', 'Safe when the spread of the errors differs across cases'], ['cluster', 'Clustered', 'Rows in the same group (household, school, country) are not independent'], ['svy', 'Survey design', 'Weights, strata and PSUs from the survey codebook']], vce, v => this.setState({ regVce: v }), { 'aria-label': 'Standard errors' });
    const pickV = (val, aria, set, list) => this.tlSelect(val || '', [['', 'none']].concat(list.map(c => [c.name, c.name])), set, aria);
    const svySug = this.rgSurveyGuess();
    return this.rgPanel(4, 'Weights and standard errors', 'leave as they are for an ordinary sample',
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Weight'), pickV(S.weightVar, 'Weight', v => { this.clearMemo(); this.setState({ weightVar: v, weightAuto: false }); }, num), h('span', { className: 'rg-mut' }, S.weightVar ? (vce === 'classical' ? 'with ordinary standard errors (Stata [' + (S.regModel === 'ols' ? 'aw' : 'iw') + '=]); for sampling weights choose Robust or Survey design (Stata [pw=])' : 'sampling weights (Stata [pw=])') : 'e.g. an expansion factor (factor, fac_exp, ponderador)')),
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Standard errors'), seg),
      vce === 'cluster' ? h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Cluster by'), pickV(S.regCl, 'Cluster by', v => this.setState({ regCl: v }), cols), h('span', { className: 'rg-mut' }, 'needs roughly 30 or more groups')) : null,
      vce === 'svy' ? h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Design'), 'strata ', pickV(S.svyStrata, 'Strata', v => this.setState({ svyStrata: v }), cols), ' PSU ', pickV(S.svyPsu, 'PSU', v => this.setState({ svyPsu: v }), cols), h('span', { className: 'rg-mut' }, 'Taylor linearization, as Stata svy: and R survey')) : null,
      svySug && !(vce === 'svy' && S.weightVar) ? this.tlBanner('info', 'This looks like survey data: ', h('b', null, [svySug.w && 'weight ' + svySug.w, svySug.st && 'strata ' + svySug.st, svySug.psu && 'PSU ' + svySug.psu].filter(Boolean).join(' · ')), '. ', this.tlBtn('Use the survey design', () => this.rgUseSurvey(svySug))) : null);
  }
  rgSurveyGuess() {
    const cols = (this.state.cols || []).map(c => c.name), find = re => cols.find(n => re.test(n)) || '';
    const w = find(/^(factor|fac_?exp|factor_?exp|fexp|pondera(dor)?|peso|weight|wt|pw|anweight)$/i), st = find(/^(est_?dis|estrato|strata|stratum|estrato_?dis)$/i), psu = find(/^(upm|psu|conglomerado|cluster_?id)$/i);
    return w ? { w, st, psu } : null;
  }
  rgUseSurvey(g) { this.clearMemo(); this.setState({ weightVar: g.w, weightAuto: false, svyStrata: g.st || '', svyPsu: g.psu || '', regVce: 'svy' }); }
  // GM26 .74: the other nine models print like the four core ones, as Stata does — a summary as "Number of obs = …" and
  // coefficients as Coef. / Std. err. / z / P>|z| / [95% conf. interval], _cons last; other tables keep their own form
  rgStataTab(t, i, lab) {
    const h = React.createElement, cols = (Array.isArray(t.columns) ? t.columns : []).map(c => String(c)), rows = Array.isArray(t.rows) ? t.rows : [];
    const num = v => typeof v === 'number' ? v : Number(v), fi = re => cols.findIndex(c => re.test(c.trim()));
    if (cols.length === 2 && /^statistic$/i.test(cols[0]) && /^value$/i.test(cols[1])) {
      const NM = { 'number of observations': 'Number of obs', 'log likelihood': 'Log likelihood', 'pseudo r-squared': 'Pseudo R2', 'r-squared': 'R-squared', 'adjusted r-squared': 'Adj R-squared' };
      const fv = v => { const x = num(v); return typeof v === 'number' || (v !== '' && v != null && isFinite(x)) ? (Number.isInteger(x) && Math.abs(x) >= 1000 ? this.fmtN(x) : Number.isInteger(x) ? String(x) : this.fmt(x, Math.abs(x) >= 100 ? 2 : 4)) : String(lab(v)); };
      return h('div', { key: 'tb' + i, className: 'rg-box' }, h('span', { className: 'tl-lbl' }, t.title), h('div', { className: 'stata-fit-cells', role: 'list', 'aria-label': t.title }, rows.map((r, k) => h('div', { key: k, className: 'stata-fit-row', role: 'listitem' }, h('span', { className: 'k' }, NM[String(r[0]).toLowerCase()] || lab(r[0])), h('span', { className: 'eq' }, '='), h('span', { className: 'v' }, fv(r[1]))))));
    }
    const iB = fi(/^(estimate|value|coef\.?|coefficient)$/i), iS = fi(/^std\.? ?err(or|\.)?$/i), iZ = fi(/^(t|z)( value)?$/i), iP = fi(/^(pr\(>\|(t|z)\|\)|p|p-value|p>\|(t|z)\|)$/i), iL = fi(/^lower( ci)?$/i), iU = fi(/^upper( ci)?$/i);
    if (iB < 1 || iS < 1 || iB === iS) return null;
    const st = iZ >= 0 && /^t/i.test(cols[iZ]) ? 't' : 'z', lead = cols.slice(0, iB).length > 1 ? cols.slice(0, iB - 1) : [];
    const body = rows.map(r => ({ r, cons: /^\(intercept\)$|^_cons$/i.test(String(r[iB - 1])) })), ordered = body.filter(x => !x.cons).concat(body.filter(x => x.cons));
    const cell = (v, f) => { const x = num(v); return v == null || v === '' || !isFinite(x) ? '.' : f(x); };
    const head = [...lead, 'Term', 'Coef.', 'Std. err.', st, 'P>|' + st + '|', iL >= 0 && iU >= 0 ? '[95% conf. interval]' : null].filter(x => x != null);
    return h('div', { key: 'tb' + i, className: 'rg-box' }, h('span', { className: 'tl-lbl' }, t.title),
      h('div', { className: 'stata-result-scroll', tabIndex: 0, role: 'region', 'aria-label': t.title }, h('table', { className: 'stata-result-table' },
        h('thead', null, h('tr', null, head.map((c, j) => h('th', { key: j, scope: 'col' }, c)))),
        h('tbody', null, ordered.slice(0, 300).map(({ r, cons }, k) => h('tr', { key: k }, ...lead.map((_, j) => h('td', { key: 'l' + j }, String(lab(r[j])))),
          h('th', { key: 't', scope: 'row' }, cons ? '_cons' : String(lab(r[iB - 1]))), h('td', { key: 'b' }, cell(r[iB], x => this.fmtCoef(x))), h('td', { key: 's' }, cell(r[iS], x => this.fmtCoef(x))),
          h('td', { key: 'z' }, iZ >= 0 ? cell(r[iZ], x => this.fmt(x, 2)) : '.'), h('td', { key: 'p' }, iP >= 0 ? cell(r[iP], x => this.fmtP(x)) : '.'),
          iL >= 0 && iU >= 0 ? h('td', { key: 'ci' }, '[' + cell(r[iL], x => this.fmtCoef(x)) + ', ' + cell(r[iU], x => this.fmtCoef(x)) + ']') : null))))));
  }
  rgAsCats(p) { this.clearMemo(); this.setState(s => ({ treat: Object.assign({}, s.treat, { [p]: 'categorical' }) }), () => { this._regRan = this.regSpec(); this.forceUpdate(); }); }
  // GM26 .71: the rows the model could use — the subgroup's rows when a subgroup is on, not the whole file
  rgPoolN(M) { const tot = M.n + (M.dropped || 0); if (!this.conds().length) return tot; const mk = this.mask(); if (!mk) return tot; let k = 0; for (let i = 0; i < mk.length; i++) k += mk[i]; return Math.min(tot, k); }
  // ---------- 5 · results ----------
  rgStep5(now, out) {
    const h = React.createElement, { S, extra, model } = now;
    if (extra) return this.rgExtraView(now, 'results');
    if (!out.regRan) return this.rgPanel(5, 'Results', '', this.tlBanner('info', S.depVar && (S.predictors || []).length ? 'Run the model to see the results.' : 'Choose the outcome (step 1) and at least one predictor (step 3), then run the model.', ' ', S.depVar && (S.predictors || []).length ? this.tlBtn('▶ Run the model', () => this.rgRun(out), 'primary') : null));
    const ctx = this._rgCtx, M = ctx && ctx.M; if (!M || M.error) return null;
    const sig = model === 'ols' ? M.pModel < this.alpha() : (M.wald ? M.wald.p : this._E.pChi2(2 * (M.ll - M.llNull), Math.max(1, M.coefs.length - (model === 'ologit' ? 0 : 1)))) < this.alpha(); // GM26 .74: Wald test with robust / clustered / survey SEs, as Stata
    const vce = M.vce ? { robust: 'robust (HC1) SEs', cluster: 'SEs clustered by ' + S.regCl + ' (' + M.vce.G + ' groups)', svy: 'survey-design SEs' }[M.vce.type] : 'classical SEs';
    const head = h('div', { className: 'rg-row' }, h('span', { className: 'cm-pill ' + (sig ? 'sig' : 'ns') }, sig ? 'THE MODEL EXPLAINS SOMETHING' : 'NO CLEAR RELATIONSHIP'), h('span', { className: 'rg-mut mono' }, this.rgDefs().models[model].t + ' · ' + this.fmtN(M.n) + ' rows used' + (M.dropped ? ' of ' + this.fmtN(this.rgPoolN(M)) + (this.conds().length ? ' in the subgroup' : '') : '') + ' · ' + vce + (S.weightVar ? ' · weighted by ' + S.weightVar : '')));
    const parts = String(out.regInterp || '').split(/(?<=\.) (?=Each b|For a numeric|An odds ratio|For a category|With an interaction)/);
    const apa = out.apaReg ? h('div', { className: 'tl-row' }, h('span', { className: 'cm-apa' }, h('span', { className: 'cm-k' }, 'APA'), h('span', null, out.apaReg)), out.copyApaReg ? this.tlBtn(out.copyApaRegLabel || 'Copy APA', out.copyApaReg) : null) : null;
    const kids = [head, parts[0] ? h('p', { className: 'rg-lead' }, parts[0]) : null, parts.length > 1 ? h('p', { className: 'rg-mut' }, parts.slice(1).join(' ')) : null, out.iReg && out.iReg.tip ? h('p', { className: 'rg-mut' }, h('b', null, 'Keep in mind: '), out.iReg.tip) : null, apa];
    // GM26 .75: predictors with a label on every code enter as numbers, as in Stata; say so, with one click to use them as
    // categories (i.var) when their codes are not an ordered scale (estado, etid …)
    const asNum = (S.predictors || []).filter(p => { const m = this.effMeta(p); return m && m.rgNum && (m.distinct || 0) >= 3; });
    if (asNum.length) kids.splice(1, 0, this.tlBanner('info', h('b', null, asNum.join(', ') + (asNum.length > 1 ? ' have' : ' has') + ' a label on every code'), ' and ' + (asNum.length > 1 ? 'are' : 'is') + ' entered as a number, as Stata does (regress ' + S.depVar + ' ' + asNum[0] + ' …): one slope per one-unit step. If the codes are categories without an order, use ' + (asNum.length > 1 ? 'them' : 'it') + ' as categories (Stata: i.' + asNum[0] + '): ', ...asNum.map(p => this.tlBtn('Use ' + p + ' as categories', () => this.rgAsCats(p))), h('span', { className: 'rg-mut' }, ' The N / C badge in step 3 switches it back.')));
    // GM26 .75: predictors used as categories (i.var): a margins plot of each, one click away; and back to a number
    const asCat = (S.predictors || []).filter(p => { const m = this.effMeta(p); return m && m.treatAs === 'categorical' && M.coefs.some(c => c.term.startsWith(p + ' = ')); });
    if (asCat.length) kids.splice(1, 0, h('div', { className: 'tl-row rg-cats' }, h('span', null, h('b', null, 'As categories: '), asCat.map(p => 'i.' + p).join(' ') + ' — one row per level, compared with ' + asCat.map(p => { const r = (M.refs || []).find(x => x.startsWith(p + ' = ')); return r ? r.slice(p.length + 3) : '?'; }).join(' / ') + '. '),
      ...asCat.map(p => this.tlBtn('marginsplot of ' + p, () => { this.rgMgSet({ x: p, by: '' }); this.setState({ rgStep: 7 }); }, 'primary', { title: 'Predicted ' + S.depVar + ' for each level of ' + p + ' (Stata: margins ' + p + ' · marginsplot)' })),
      ...asCat.filter(p => { const m = this.effMeta(p); return m.type === 'numeric'; }).map(p => this.tlBtn('Use ' + p + ' as a number', () => { this.clearMemo(); this.setState(s2 => ({ treat: Object.assign({}, s2.treat, { [p]: 'numeric' }) }), () => { this._regRan = this.regSpec(); this.forceUpdate(); }); }))));
    // GM26 .74: the output first, compact as in Stata (fit, coefficients, plot); what it means goes below it (rgEl3)
    const line = kids.shift(), ame = model === 'logistic' || model === 'poisson' ? this.rgAmeView(now, ctx) : null;
    this._rgNotes = [ame, this.rgPanel(0, 'What the results say', 'the output above in words', line, ...kids)];
    return this.rgPanel(5, 'Results', 'the output first, as in Stata; what it means is below', h('div', { className: 'rg-row' }, h('span', { className: 'rg-mut mono' }, this.rgDefs().models[model].t + ' · ' + this.rgDefs().models[model].st + ' ' + S.depVar + ' ' + (S.predictors || []).map(p => { const m = this.effMeta(p); return m && m.treatAs === 'categorical' ? 'i.' + p : p; }).join(' ') + this.ixValid().map(([a, b]) => { const ic = v => { const m = this.effMeta(v); return (m && m.treatAs === 'categorical' ? 'i.' : 'c.') + v; }; return ' ' + ic(a) + '#' + ic(b); }).join(''))));
  }
  // Average marginal effects: percentage points (logit) or expected counts (Poisson), with the model's variance.
  rgAme(now, ctx) {
    const S = this.state, key = 'rgame|' + this.regSpec() + '|' + this.alpha();
    return this.rgJob(key, { family: ctx.mdl, y: ctx.yM, w: ctx.w, vars: ctx.bp, ix: ctx.ixIdx, alpha: ctx.a, vce: this._vceObj, ame: true, df: ctx.M.vce && ctx.M.vce.type === 'svy' ? ctx.M.dfT : 0 }, 'Computing average marginal effects');
  }
  rgJob(key, args, label) { const r = this.jobMemo(key, () => ({ __work: 'marginsGen', args: [args] }), label); if (r && typeof r.next === 'function') { let x; do { x = r.next(); } while (!x.done); return x.value; } return r; }
  rgAmeView(now, ctx) {
    const h = React.createElement, logit = ctx.mdl === 'logistic', r = this.rgAme(now, ctx);
    if (!r || r.pending) return this.tlBanner('info', 'Computing the effects…'); if (r.error) return this.tlBanner('warn', r.error);
    const k = logit ? 100 : 1, unit = logit ? ' pts' : '', f = v => (v > 0 ? '+' : v < 0 ? '−' : '') + this.cmFmt(Math.abs(v * k)) + unit;
    const rows = r.ame.map(e => ({ lab: e.level != null ? this.termLab(e.name) + ' = ' + this.vlabel(e.name, e.level) + ' vs ' + this.vlabel(e.name, e.ref) : 'each +1 of ' + this.termLab(e.name), e }));
    const W = 640, X0 = 230, X1 = W - 70, lo = Math.min(0, ...r.ame.map(e => e.lo * k)), hi = Math.max(0, ...r.ame.map(e => e.hi * k)), pad = (hi - lo) * 0.06 || 1, x = v => X0 + (v - lo + pad) / (hi - lo + 2 * pad) * (X1 - X0), H = 24 + rows.length * 30;
    const kids = [h('line', { key: 'z', x1: x(0), x2: x(0), y1: 6, y2: H - 6, stroke: '#8C8372', strokeDasharray: '4 3' })];
    rows.forEach((q, i) => { const y = 20 + i * 30, e = q.e, s = e.p < this.alpha(), col = s ? '#A8521A' : '#8C8372'; kids.push(h('text', { key: 't' + i, x: X0 - 10, y: y + 4, textAnchor: 'end', fontSize: 12.5, fill: '#2B271E' }, String(q.lab).slice(0, 40)), h('line', { key: 'l' + i, x1: x(e.lo * k), x2: x(e.hi * k), y1: y, y2: y, stroke: col, strokeWidth: 3 }), h('circle', { key: 'c' + i, cx: x(e.est * k), cy: y, r: 5.5, fill: col }), h('text', { key: 'v' + i, x: x(e.hi * k) + 7, y: y + 4, fontSize: 11.5, fontWeight: 700, fill: col, fontFamily: 'Space Mono, monospace' }, f(e.est))); });
    const tbl = h('table', { className: 'rg-tbl' }, h('thead', null, h('tr', null, ...['', logit ? 'change in the chance (points)' : 'change in the expected count', 'std. err.', 'p', Math.round(100 * (1 - this.alpha())) + '% CI'].map((c, i) => h('th', { key: i }, c)))), h('tbody', null, ...rows.map((q, i) => h('tr', { key: i }, h('td', null, q.lab), h('td', { className: 'mono' }, f(q.e.est)), h('td', { className: 'mono' }, this.cmFmt(q.e.se * k)), h('td', { className: 'mono' }, this.fmtP(q.e.p)), h('td', { className: 'mono' }, '[' + this.cmFmt(q.e.lo * k).replace(/^-/, '−') + ', ' + this.cmFmt(q.e.hi * k).replace(/^-/, '−') + ']')))));
    return h('div', { className: 'rg-ame' }, h('div', { className: 'tl-lbl' }, logit ? 'Effects in percentage points · average marginal effects (Stata: margins, dydx(*))' : 'Effects on the expected count · average marginal effects (Stata: margins, dydx(*))'), h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Average marginal effects', style: { maxWidth: W + 'px' }, ref: this.svgRef('rgame') }, kids), tbl);
  }
  // ---------- 6 · checks ----------
  rgStep6(now, out) {
    const h = React.createElement, { S, extra, model } = now;
    if (extra) return this.rgExtraView(now, 'checks');
    const ctx = this._rgCtx, M = ctx && ctx.M; if (!out.regRan || !M || M.error) return this.rgPanel(6, 'Checks', '', this.tlBanner('info', 'Run the model first (step 5).'));
    const items = [], add = (kind, title, body, btn) => items.push(h('div', { key: items.length, className: 'cm-check rg-chk ' + kind }, h('b', { 'aria-hidden': 'true' }, kind === 'ok' ? '✓' : kind === 'warn' ? '!' : '?'), h('span', null, h('strong', null, title), ' ', body), btn || null));
    const p = M.coefs.length - (model === 'ologit' ? 0 : 1);
    if (model === 'logistic') { const st = this.rgOutcomeStats(S.depVar, 'bin'), ev = Math.round(Math.min(st.share, 1 - st.share) * M.n); add(ev >= 10 * p ? 'ok' : 'warn', 'Enough cases', ev + ' rows in the smaller outcome group for ' + p + ' terms' + (ev >= 10 * p ? ' — comfortably more than the ~10 per term needed.' : ' — fewer than ~10 per term: estimates can be unstable; use fewer predictors.')); }
    else add(M.n >= 10 * (p + 1) ? 'ok' : 'warn', 'Enough cases', this.fmtN(M.n) + ' rows for ' + p + ' terms' + (M.n >= 10 * (p + 1) ? '.' : ' — few rows per term; keep the model small.'));
    const V = this.memo('rgvif|' + this.regSpec(), () => { try { return this._E.vifOf(ctx.yM, ctx.bp, ctx.w); } catch (e) { return { error: 'x' }; } });
    if (V && !V.error && V.terms) { const mx = V.terms.length ? V.terms[0] : null; if (mx) add(mx.vif < 5 ? 'ok' : 'warn', mx.vif < 5 ? 'Predictors are not redundant' : 'Some predictors overlap', 'largest variance inflation factor ' + this.fmt(mx.vif, 1) + ' (' + this.termLab(mx.term) + ')' + (mx.vif < 5 ? '; trouble starts near 10.' : ' — their separate effects are hard to tell apart.')); }
    const sg = this.rgSurveyGuess(); if (sg && S.regVce !== 'svy') add('warn', 'This looks like survey data', h('span', null, h('b', null, sg.w), ' looks like an expansion weight' + (sg.psu || sg.st ? ' and ' + [sg.psu, sg.st].filter(Boolean).join(' / ') + ' like the sampling design' : '') + '. Unweighted results describe the sample, not the population.'), this.tlBtn('Use the survey design', () => { this.rgUseSurvey(sg); this.rgRun(out); }, 'primary'));
    if (S.regVce === 'classical' && !sg) { const rep = (S.cols || []).find(c => c.name !== S.depVar && /^(folio|foliohog|folioviv|id_?hog|hogar|household|id)$/i.test(c.name) && c.distinct < M.n * 0.9); if (rep) add('ask', 'Rows may repeat', rep.name + ' has ' + this.fmtN(rep.distinct) + ' values for ' + this.fmtN(M.n) + ' rows: people in the same ' + rep.name + ' are not independent.', this.tlBtn('Cluster by ' + rep.name, () => { this.setState({ regVce: 'cluster', regCl: rep.name }); this.rgRun(out); })); }
    if (model === 'ols' && M.diag) {
      if (Math.abs(M.diag.het) > 0.18 && S.regVce === 'classical') add('warn', 'The spread of the errors changes', 'the residuals ' + (M.diag.het > 0 ? 'fan out' : 'shrink') + ' as the fitted values grow, so classical standard errors are off.', this.tlBtn('Use robust standard errors', () => { this.setState({ regVce: 'robust' }); this.rgRun(out); }, 'primary'));
      if (Math.abs(M.diag.skew) > 1) add('warn', 'Skewed residuals', 'skew ' + this.fmt(M.diag.skew, 2) + ': the mean is pulled by extreme values.', this.tlBtn('Try quantile (median) regression', () => { this.rgPickModel('quantile'); this.rgGo(5); }));
    }
    if (model === 'poisson') { const od = this.rgOverdisp(ctx); if (od) { if (od.ratio > 1.5) add('warn', 'More spread than Poisson allows', 'Pearson χ² / df = ' + this.fmt(od.ratio, 2) + ': Poisson standard errors are too small.', this.tlBtn('Switch to negative binomial', () => { this.rgPickModel('negbin'); this.rgRun(out); }, 'primary')); else add('ok', 'Spread fits Poisson', 'Pearson χ² / df = ' + this.fmt(od.ratio, 2) + '.'); if (od.zObs - od.zExp > 0.05) add('warn', 'More zeros than expected', this.fmt(100 * od.zObs, 0) + '% zeros; the model expects ' + this.fmt(100 * od.zExp, 0) + '%.', this.tlBtn('Try a zero-inflated model', () => { this.rgPickModel('zeroinfl'); this.rgRun(out); })); } }
    const curve = this.rgCurvature(ctx); curve.forEach(c => add('warn', c.name + ' may not be a straight line', 'adding ' + c.name + '² improves the fit (p ' + this.fmtP(c.p).replace(/^p ?/, '') + ').', model === 'ols' ? this.tlBtn('Try a curve (spline)', () => { this.rgPickModel('spline'); this.rgRun(out); }) : this.tlBtn('Try smooth curves (GAM)', () => { const pages = Object.assign({}, S.analysisPages || {}); pages.gam = Object.assign({}, pages.gam || {}, { options: Object.assign({}, (pages.gam || {}).options || {}, { family: model === 'logistic' ? 'binomial' : model === 'poisson' ? 'poisson' : 'gaussian' }) }); this.setState({ analysisPages: pages }); this.rgPickModel('gam'); this.rgRun(out); })));
    if (!curve.length && ctx.bp.some(v => v.kind === 'num')) add('ok', 'Straight-line effects look fine', 'no numeric predictor gains clearly from a squared term.');
    return this.rgPanel(6, 'Checks', 'what a careful analyst looks at, each with the fix one click away; the variance inflation factors and residual plots follow', h('div', { className: 'cm-checks rg-checks' }, ...items));
  }
  rgOverdisp(ctx) {
    return this.memo('rgod|' + this.regSpec(), () => { const M = ctx.M, X = this.rgDesign(ctx); if (!X) return null; let chi = 0, zO = 0, zE = 0, n = 0; X.rows.forEach((x, k) => { let eta = 0; x.forEach((v, j) => { eta += v * X.b[j]; }); const mu = Math.exp(eta), y = X.y[k]; chi += (y - mu) * (y - mu) / mu; if (y === 0) zO++; zE += Math.exp(-mu); n++; }); return { ratio: chi / Math.max(1, n - X.b.length), zObs: zO / n, zExp: zE / n }; });
  }
  // the design rows of the fitted core model (constant first), for checks that need fitted values
  rgDesign(ctx) {
    const M = ctx.M, b = M.coefs.map(c => c.b), names = M.coefs.map(c => c.term), V = ctx.bp, y = ctx.yM, w = ctx.w, rows = [], ys = [];
    const N = y.length, col = names.map(t => { if (t === '(constant)') return () => 1; const ix = t.split(' × '); const one = s => { const k = s.indexOf(' = '), nm = k < 0 ? s : s.slice(0, k), lv = k < 0 ? null : s.slice(k + 3), v = V.find(q => q.name === nm); if (!v) return null; return v.kind === 'num' ? i => v.a[i] : i => (v.a[i] == null ? NaN : String(v.a[i]) === lv ? 1 : 0); }; const fs = ix.map(one); return fs.some(f => !f) ? null : i => fs.reduce((p, f) => p * f(i), 1); });
    if (col.some(f => !f)) return null;
    for (let i = 0; i < N; i++) { if (!Number.isFinite(y[i]) || (w && !(w[i] > 0))) continue; const x = col.map(f => f(i)); if (x.some(v => !Number.isFinite(v))) continue; rows.push(x); ys.push(y[i]); }
    return { rows, y: ys, b };
  }
  // numeric predictors whose squared term clearly improves the fit (p < .01), linear / logit / Poisson
  rgCurvature(ctx) {
    return this.memo('rgcurve|' + this.regSpec(), () => {
      const E = this._E, out = [], fam = ctx.mdl; if (!['ols', 'logistic', 'poisson'].includes(fam)) return out;
      ctx.bp.filter(v => v.kind === 'num').slice(0, 6).forEach(v => {
        let s = 0, n = 0; for (const x of v.a) if (Number.isFinite(x)) { s += x; n++; } const m = s / n, sq = Float64Array.from(v.a, x => (x - m) * (x - m));
        if (new Set(Array.from(v.a).filter(Number.isFinite)).size < 4) return;
        const P = [...ctx.bp, { name: v.name + '²', kind: 'num', a: sq }];
        const r = fam === 'ols' ? E.regress(ctx.yM, P, ctx.w, null) : E.glm(ctx.yM, P, ctx.w, fam, null);
        if (r && !r.error) { const c = r.coefs[r.coefs.length - 1]; if (c.p < 0.01) out.push({ name: v.name, p: c.p }); }
      });
      return out;
    });
  }
  // ---------- 7 · predictions (margins and marginsplot) ----------
  rgMg() { return Object.assign({ x: '', by: '', from: '', to: '', every: '', list: '', mode: 'step', levels: null, byMode: 'auto', byList: '', byLevels: null, at: 'avg', cat: -1 }, this.state.rgMg || {}); }
  rgMgSet(p) { this.setState({ rgMg: Object.assign({}, this.rgMg(), p) }); }
  rgPl() { return Object.assign({ ci: 'band', draw: 'lp', ymin: '', ymax: '', ystep: '', xstep: '', title: '', xtitle: '', ytitle: '', legend: 'tr', pal: 'sendero', w: 720, h: 420 }, this.state.rgPlot || {}); }
  rgPlSet(p) { this.setState({ rgPlot: Object.assign({}, this.rgPl(), p) }); }
  // the values to predict at, from the boxes: from / to / every (Stata's 20(5)80), a typed list, or percentiles
  rgGrid(v, g, a) {
    const xs = []; for (const x of a) if (Number.isFinite(x)) xs.push(x); xs.sort((p, q) => p - q); if (!xs.length) return { vals: [], txt: '' };
    const mn = xs[0], mx = xs[xs.length - 1], nice = x => Number(x.toPrecision(12));
    if (g.mode === 'list') { const vals = String(g.list || '').split(/[\s,;]+/).map(Number).filter(Number.isFinite); return { vals: [...new Set(vals)].sort((p, q) => p - q), txt: vals.join(' '), how: 'list' }; }
    if (g.mode === 'pct') { const qs = [0.1, 0.25, 0.5, 0.75, 0.9], q = p => xs[Math.min(xs.length - 1, Math.round(p * (xs.length - 1)))]; const vals = [...new Set(qs.map(q))]; return { vals, txt: vals.map(nice).join(' '), how: 'pct' }; }
    const st0 = this._E.ticks ? this._E.ticks(mn, mx, 6) : [];
    const from = g.from !== '' && Number.isFinite(Number(g.from)) ? Number(g.from) : (st0.length ? st0[0] < mn ? st0[1] ?? mn : st0[0] : mn);
    const to = g.to !== '' && Number.isFinite(Number(g.to)) ? Number(g.to) : (st0.length ? st0[st0.length - 1] > mx ? st0[st0.length - 2] ?? mx : st0[st0.length - 1] : mx);
    const every = g.every !== '' && Number(g.every) > 0 ? Number(g.every) : (st0.length > 1 ? st0[1] - st0[0] : (to - from) / 5 || 1);
    const vals = []; for (let k = 0; k <= 400; k++) { const x = nice(from + k * every); if (x > to + 1e-9 * Math.abs(every)) break; vals.push(x); }
    return { vals, txt: nice(from) + '(' + nice(every) + ')' + nice(to), how: 'step', from: nice(from), to: nice(to), every: nice(every), mn, mx };
  }
  rgStep7(now, out) {
    const h = React.createElement, { S, extra, model } = now;
    if (extra) return this.rgExtraView(now, 'predictions');
    const ctx = this._rgCtx; if (!out.regRan || !ctx || !ctx.M || ctx.M.error) return this.rgPanel(7, 'Predictions', '', this.tlBanner('info', 'Run the model first (step 5).'));
    const g = this.rgMg(), pl = this.rgPl(), preds = ctx.preds, V = ctx.bp;
    const xName = preds.includes(g.x) ? g.x : preds[0], fi = preds.indexOf(xName), fv = V[fi], byName = g.by && preds.includes(g.by) && g.by !== xName ? g.by : '', bi = byName ? preds.indexOf(byName) : -1, bv = bi >= 0 ? V[bi] : null;
    const opt = [['', 'none']].concat(preds.map(p => [p, p]));
    // the X values
    let grid = null, gridTxt = '', gx = null;
    if (fv.kind === 'num') { gx = this.rgGrid(xName, g, fv.a); grid = gx.vals; gridTxt = gx.txt; }
    else { const lv = g.levels && g.levels.length ? fv.levels.filter(l => g.levels.includes(l)) : fv.levels.slice(0, 20); grid = lv; }
    // the lines
    let byVals = null, byTxt = '';
    if (bv) { if (bv.kind === 'num') { const by = this.rgGrid(byName, { mode: g.byMode === 'list' ? 'list' : 'pct', list: g.byList }, bv.a); byVals = g.byMode === 'list' ? by.vals : (() => { const xs = Array.from(bv.a).filter(Number.isFinite).sort((p, q) => p - q), q = p2 => xs[Math.min(xs.length - 1, Math.round(p2 * (xs.length - 1)))]; return [...new Set([q(0.1), q(0.5), q(0.9)])]; })(); byTxt = byVals.map(x => Number(x.toPrecision(10))).join(' '); } else { byVals = g.byLevels && g.byLevels.length ? bv.levels.filter(l => g.byLevels.includes(l)) : bv.levels.slice(0, 8); } }
    const olLv = ctx.olLv || [], cat = olLv.length ? (g.cat >= 0 && g.cat < olLv.length ? g.cat : olLv.length - 1) : 0;
    const df = model === 'ols' ? ctx.M.dfT : ctx.M.vce && ctx.M.vce.type === 'svy' ? ctx.M.dfT : 0;
    const key = 'rgmg|' + this.regSpec() + '|' + [fi, bi, JSON.stringify(grid), JSON.stringify(byVals), g.at, cat, this.alpha(), this._vceSig].join('|');
    let mg = grid && grid.length ? this.rgJob(key, { family: ctx.mdl, y: ctx.yM, w: ctx.w, vars: V, ix: ctx.ixIdx, focus: fi, by: bi, at: g.at === 'means' ? 'means' : 'avg', cat, alpha: ctx.a, vce: this._vceObj, grid, byVals, df }, 'Computing the margins') : { error: 'Choose the values of ' + xName + ' to predict at.' };
    // 1 · what to predict
    const what = model === 'ols' ? 'the expected value of ' + S.depVar : model === 'poisson' ? 'the expected count of ' + S.depVar : model === 'logistic' ? 'the chance that ' + S.depVar + ' = ' + this.vlabel(S.depVar, ctx.oneLabel.replace(/ \(.*\)$/, '')) : 'the chance that ' + S.depVar + ' = ' + (olLv.length ? this.vlabel(S.depVar, this._E.numLab(olLv[cat])) : '');
    const xBox = fv.kind === 'num' ? [
      h('div', { key: 'r', className: 'rg-row' }, 'from ', this.tlText(String(gx.from ?? ''), v => this.rgMgSet({ from: v, mode: 'step' }), { aria: 'From', width: 80, mono: true, k: 'from' + xName }), ' to ', this.tlText(String(gx.to ?? ''), v => this.rgMgSet({ to: v, mode: 'step' }), { aria: 'To', width: 80, mono: true, k: 'to' + xName }), ' every ', this.tlText(String(gx.every ?? ''), v => this.rgMgSet({ every: v, mode: 'step' }), { aria: 'Every', width: 60, mono: true, k: 'ev' + xName }), h('span', { className: 'rg-mut' }, '→ ' + grid.length + ' values' + (gx.mn != null ? ' · data from ' + this.cmFmt(gx.mn) + ' to ' + this.cmFmt(gx.mx) : ''))),
      h('div', { key: 'q', className: 'rg-row' }, h('span', { className: 'tl-lbl' }, 'quick'), ...[1, 2, 5, 10].map(st => this.tlChip('every ' + st, g.mode === 'step' && Number(gx.every) === st, () => this.rgMgSet({ every: String(st), mode: 'step' }), { key: 'e' + st })), this.tlChip('min to max', false, () => this.rgMgSet({ from: String(gx.mn), to: String(gx.mx), every: String(Number(((gx.mx - gx.mn) / 10).toPrecision(2))), mode: 'step' }), { key: 'mm' }), this.tlChip('percentiles 10/25/50/75/90', g.mode === 'pct', () => this.rgMgSet({ mode: 'pct' }), { key: 'pct' }), this.tlChip('type values…', g.mode === 'list', () => this.rgMgSet({ mode: 'list', list: g.list || grid.join(' ') }), { key: 'ls' })),
      g.mode === 'list' ? h('div', { key: 'l', className: 'rg-row' }, 'values ', this.tlText(g.list || '', v => this.rgMgSet({ list: v }), { aria: 'Values', width: 260, mono: true, k: 'list', placeholder: 'e.g. 20 30 45 60' })) : null]
      : [h('div', { key: 'lv', className: 'rg-row' }, ...fv.levels.slice(0, 20).map(l => this.tlChip((grid.includes(l) ? '✓ ' : '') + this.vlabel(xName, l), grid.includes(l), () => { const cur = g.levels && g.levels.length ? g.levels : fv.levels.slice(0, 20); const nx = cur.includes(l) ? cur.filter(q => q !== l) : [...cur, l]; this.rgMgSet({ levels: nx.length ? nx : null }); }, { key: l })))];
    const byBox = !bv ? null : bv.kind === 'num' ? h('div', { className: 'rg-row' }, 'at ', this.tlSeg([['auto', '10th, 50th, 90th percentiles'], ['list', 'values I type']], g.byMode === 'list' ? 'list' : 'auto', v => this.rgMgSet({ byMode: v, byList: g.byList || byTxt }), { 'aria-label': 'Lines at' }), g.byMode === 'list' ? this.tlText(g.byList || byTxt, v => this.rgMgSet({ byList: v }), { aria: 'Line values', width: 180, mono: true, k: 'bylist' }) : h('span', { className: 'rg-mut mono' }, byTxt))
      : h('div', { className: 'rg-row' }, ...bv.levels.slice(0, 12).map(l => this.tlChip((byVals.includes(l) ? '✓ ' : '') + this.vlabel(byName, l), byVals.includes(l), () => { const cur = g.byLevels && g.byLevels.length ? g.byLevels : bv.levels.slice(0, 8); const nx = cur.includes(l) ? cur.filter(q => q !== l) : [...cur, l]; this.rgMgSet({ byLevels: nx.length ? nx : null }); }, { key: l })));
    const left = h('div', { className: 'rg-box' }, h('span', { className: 'tl-lbl' }, '1 · What to predict'), h('div', null, 'Predict ', h('b', null, what)),
      olLv.length ? h('div', { className: 'rg-row' }, 'category ', this.tlSeg(olLv.map((lv, k) => [k, String(this.vlabel(S.depVar, this._E.numLab(lv)))]), cat, v => this.rgMgSet({ cat: Number(v) }), { 'aria-label': 'Outcome category' })) : null,
      h('div', { className: 'rg-row' }, 'Across ', this.tlSelect(xName, preds.map(p => [p, p]), v => this.rgMgSet({ x: v, by: g.by === v ? '' : g.by, from: '', to: '', every: '', mode: 'step', levels: null }), 'Margins X axis')), ...xBox,
      h('div', { className: 'rg-row' }, 'One line for each ', this.tlSelect(byName, opt.filter(([p]) => p !== xName), v => this.rgMgSet({ by: v, byLevels: null, byMode: 'auto', byList: '' }), 'Margins lines by')), byBox,
      h('div', { className: 'rg-row' }, 'Other predictors ', this.tlSeg([['avg', 'as observed (Stata default)'], ['means', 'at their means (atmeans)']], g.at === 'means' ? 'means' : 'avg', v => this.rgMgSet({ at: v }), { 'aria-label': 'Other predictors' })));
    // 2 · how the plot looks
    const txt = (k, aria, w2, ph) => this.tlText(String(pl[k] ?? ''), v => this.rgPlSet({ [k]: v }), { aria, width: w2, k: 'pl' + k, placeholder: ph });
    const right = h('div', { className: 'rg-box' }, h('span', { className: 'tl-lbl' }, '2 · How the plot looks · marginsplot options'),
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Confidence'), this.tlSeg([['band', 'Shaded band'], ['bars', 'Error bars'], ['none', 'None']], pl.ci, v => this.rgPlSet({ ci: v }), { 'aria-label': 'Confidence intervals' })),
      fv.kind === 'num' ? h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Draw'), this.tlSeg([['lp', 'Lines and points'], ['l', 'Lines'], ['p', 'Points']], pl.draw, v => this.rgPlSet({ draw: v }), { 'aria-label': 'Draw' })) : null,
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Y axis'), 'from ', txt('ymin', 'Y from', 70, 'auto'), ' to ', txt('ymax', 'Y to', 70, 'auto'), ' ticks every ', txt('ystep', 'Y ticks every', 60, 'auto')),
      fv.kind === 'num' ? h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'X axis labels'), 'every ', txt('xstep', 'X labels every', 60, 'auto')) : null,
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Title'), txt('title', 'Title', 300, 'Predicted ' + (model === 'logistic' || model === 'ologit' ? 'chance' : 'value') + ' by ' + xName)),
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Axis titles'), txt('xtitle', 'X title', 140, xName), txt('ytitle', 'Y title', 190, model === 'logistic' || model === 'ologit' ? 'Pr(' + S.depVar + ')' : S.depVar)),
      byName ? h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Legend'), this.tlSeg([['tr', 'Top right'], ['bottom', 'Bottom'], ['right', 'Right'], ['none', 'None']], pl.legend, v => this.rgPlSet({ legend: v }), { 'aria-label': 'Legend' })) : null,
      h('div', { className: 'rg-row' }, h('span', { className: 'rg-lab' }, 'Colours · size'), this.tlSeg([['sendero', 'Sendero'], ['grey', 'Grey'], ['cb', 'Colour-blind safe']], pl.pal, v => this.rgPlSet({ pal: v }), { 'aria-label': 'Colours' }), this.tlNum(Number(pl.w), v => this.rgPlSet({ w: v }), { min: 360, max: 1600, step: 10, aria: 'Width', width: 70 }), ' × ', this.tlNum(Number(pl.h), v => this.rgPlSet({ h: v }), { min: 240, max: 1200, step: 10, aria: 'Height', width: 70 }), ' px'));
    const kids = [h('div', { className: 'rg-two', key: 'set' }, left, right)];
    if (mg && mg.pending) kids.push(this.tlBanner('info', 'Computing the margins…'));
    else if (!mg || mg.error) kids.push(this.tlBanner('warn', (mg && mg.error) || 'Margins are not available for this model.'));
    else {
      const cmd = this.rgMgCmd(now, ctx, { xName, byName, fv, bv, grid, gx, byVals, at: g.at, cat, olLv, pl });
      this._rgMgCmd = cmd;
      const svg = this.rgMgSvg(mg, { xName, byName, fv, bv, model, pl, xs: fv.kind === 'num' ? gx : null, ylab: pl.ytitle || (model === 'logistic' || model === 'ologit' ? 'Pr(' + S.depVar + ')' : (model === 'poisson' ? 'expected ' : 'predicted ') + S.depVar) });
      const plotName = 'Margins of ' + S.depVar + ' across ' + xName + (byName ? ', lines by ' + byName : '');
      const dl = this.dl('rgmg', plotName);
      const plotBox = h('div', { className: 'rg-box' }, svg, h('div', { className: 'tl-row' }, this.tlBtn('Download PNG / SVG', () => dl(), 'primary'), this.tlBtn('Pin to report', () => this.pinTab()), this.tlBtn('Add to console', () => { this.pushLog({ t: 'stata', stata: cmd.stata, r: cmd.r, res: 'margins of ' + S.depVar + ' across ' + xName + (byName ? ' by ' + byName : ''), tbl: this.rgMgText(mg, { xName, byName, model }) }); this.flash('Added to the console'); })));
      const say = h('div', { className: 'rg-box' }, h('p', { className: 'rg-lead small' }, this.rgMgSay(mg, { xName, byName, model, S })), mg.sampled ? h('p', { className: 'rg-mut' }, 'Averaged over a sample of ' + this.fmtN(mg.sampN) + ' rows for speed.') : null);
      const code = h('div', { className: 'rg-box' }, h('span', { className: 'tl-lbl' }, 'Stata'), h('pre', { className: 'rg-code' }, cmd.stata), h('span', { className: 'tl-lbl' }, 'R'), h('pre', { className: 'rg-code' }, cmd.r));
      kids.push(h('div', { className: 'rg-plotwrap', key: 'plot' }, plotBox, h('div', { className: 'rg-two' }, say, code)));
      kids.push(this.rgMgTable(mg, { xName, byName, model, df }));
    }
    return this.rgPanel(7, 'Predictions', 'Stata’s margins and marginsplot, at the values you choose', ...kids);
  }
  // the Stata and R commands for these margins and this plot
  rgMgCmd(now, ctx, o) {
    const { S, model } = now, d = this.descFor(), fit = d ? this.cmdText(this.tagSg(d), 'stata') : '', fitR = d ? this.cmdText(this.tagSg(d), 'r') : '';
    const sv = (v, l) => { const m = this.effMeta(v); return m && m.type !== 'numeric' ? '"' + l + '"' : l; }, isCatV = v => !!(this.effMeta(v) && this.effMeta(v).treatAs === 'categorical');
    const stName = v => isCatV(v) && (this.effMeta(v) || {}).type !== 'numeric' ? v + '_c' : v;
    const ats = [], over = [];
    if (o.fv.kind === 'num') ats.push(o.xName + '=(' + (o.gx.how === 'step' ? o.gx.txt : o.grid.join(' ')) + ')'); else over.push(stName(o.xName));
    if (o.bv) { if (o.bv.kind === 'num') ats.push(o.byName + '=(' + o.byVals.map(x => Number(x.toPrecision(10))).join(' ') + ')'); else over.push(stName(o.byName)); }
    const pr = model === 'ologit' ? 'predict(outcome(' + this._E.numLab(o.olLv[o.cat]) + '))' : '';
    const pl = o.pl, num = v => v !== '' && Number.isFinite(Number(v));
    const mo = [ats.length ? 'at(' + ats.join(' ') + ')' : '', o.at === 'means' ? 'atmeans' : '', pr].filter(Boolean);
    const mpo = [pl.ci === 'band' ? 'recastci(rarea) ciopts(fcolor(%25))' : pl.ci === 'none' ? 'noci' : '', pl.draw === 'p' ? 'recast(scatter)' : pl.draw === 'l' ? 'plotopts(msymbol(none))' : '', num(pl.ymin) && num(pl.ymax) ? 'ylabel(' + pl.ymin + (num(pl.ystep) ? '(' + pl.ystep + ')' : ' ') + pl.ymax + ')' : '', o.fv.kind === 'num' && num(pl.xstep) && o.gx.how === 'step' ? 'xlabel(' + o.gx.from + '(' + pl.xstep + ')' + o.gx.to + ')' : '', pl.title ? 'title("' + pl.title + '")' : '', pl.xtitle ? 'xtitle("' + pl.xtitle + '")' : '', pl.ytitle ? 'ytitle("' + pl.ytitle + '")' : '', o.byName ? ({ tr: 'legend(position(1) ring(0))', bottom: 'legend(position(6))', right: 'legend(position(3))', none: 'legend(off)' })[pl.legend] : ''].filter(Boolean);
    const stata = (fit ? fit + '\n' : '') + 'margins' + (over.length ? ' ' + over.join('#') : '') + (mo.length ? ', ' + mo.join(' ') : '') + '\nmarginsplot' + (mpo.length ? ', ' + mpo.join(' ') : '');
    const rv = (v, vals, kind) => kind === 'num' ? (o.fv.kind === 'num' && v === o.xName && o.gx.how === 'step' ? 'seq(' + o.gx.from + ', ' + o.gx.to + ', by = ' + o.gx.every + ')' : 'c(' + vals.map(x => Number(x.toPrecision(10))).join(', ') + ')') : 'c(' + vals.map(l => JSON.stringify(String(l))).join(', ') + ')';
    const vars = [o.xName + ' = ' + rv(o.xName, o.grid, o.fv.kind)].concat(o.bv ? [o.byName + ' = ' + rv(o.byName, o.byVals, o.bv.kind)] : []);
    const vc = S.regVce === 'robust' ? (model === 'ols' ? ', vcov = "HC1"' : ', vcov = sandwich::vcovCL(m, type = "HC0")') : S.regVce === 'cluster' ? ', vcov = ~' + S.regCl : '';
    const call = o.at === 'means' ? 'predictions(m, newdata = datagrid(' + vars.join(', ') + ')' + vc + ')' : 'avg_predictions(m, variables = list(' + vars.join(', ') + ')' + vc + ')';
    const r = (/m <- /.test(fitR) ? fitR.split('\n').filter(l => !/^coeftest|^summary/.test(l)).join('\n') : 'm <- ' + fitR.replace(/^summary\(([\s\S]*)\)$/, '$1')) + '\nlibrary(marginaleffects); library(ggplot2)\np <- ' + call + '\nggplot(p, aes(' + o.xName + ', estimate' + (o.byName ? ', colour = factor(' + o.byName + '), fill = factor(' + o.byName + ')' : '') + (o.fv.kind !== 'num' ? ', group = ' + (o.byName ? 'factor(' + o.byName + ')' : '1') : '') + ')) +\n  ' + (pl.ci === 'none' ? '' : pl.ci === 'bars' ? 'geom_errorbar(aes(ymin = conf.low, ymax = conf.high), width = .2) + ' : 'geom_ribbon(aes(ymin = conf.low, ymax = conf.high), alpha = .2, colour = NA) + ') + (pl.draw === 'p' ? 'geom_point()' : pl.draw === 'l' ? 'geom_line()' : 'geom_line() + geom_point()') + ' +\n  labs(title = ' + JSON.stringify(pl.title || '') + ', x = ' + JSON.stringify(pl.xtitle || o.xName) + ', y = ' + JSON.stringify(pl.ytitle || 'prediction') + (o.byName ? ', colour = "' + o.byName + '", fill = "' + o.byName + '"' : '') + ')';
    return { stata, r };
  }
  rgPal(k) { return k === 'grey' ? ['#222222', '#777777', '#AAAAAA', '#444444', '#999999', '#555555'] : k === 'cb' ? ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'] : ['#1A5061', '#C4681E', '#1F6447', '#7A4E9C', '#B23A48', '#8C7A2E', '#2E7DA0', '#5D5648']; }
  // marginsplot: lines (or points) with bands or bars, axes, titles and legend as chosen
  rgMgSvg(mg, o) {
    const h = React.createElement, pl = o.pl, W = Math.max(360, Number(pl.w) || 720), H = Math.max(240, Number(pl.h) || 420), cols = this.rgPal(pl.pal), xCat = mg.xCat;
    const legendRight = o.byName && pl.legend === 'right', legendBottom = o.byName && pl.legend === 'bottom';
    const X0 = 64, X1 = W - (legendRight ? 150 : 22), Y0 = pl.title ? 44 : 18, Y1 = H - (legendBottom ? 82 : 52);
    const num = v => v !== '' && v != null && Number.isFinite(Number(v));
    let lo = Infinity, hi = -Infinity; mg.series.forEach(s => s.pts.forEach(p => { const a = pl.ci === 'none' ? p.y : p.plo, b = pl.ci === 'none' ? p.y : p.phi; if (a < lo) lo = a; if (b > hi) hi = b; }));
    if (!(hi > lo)) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
    if (num(pl.ymin)) lo = Number(pl.ymin); if (num(pl.ymax)) hi = Number(pl.ymax);
    const yt = num(pl.ystep) && Number(pl.ystep) > 0 ? (() => { const st = Number(pl.ystep), out = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9 && out.length < 60; v += st) out.push(Number(v.toPrecision(10))); return out; })() : this._E.ticks(lo, hi, 6);
    const y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0), kids = [], fmt = v => this._E.fmtTick ? this._E.fmtTick(v) : String(v);
    yt.forEach((t, i) => kids.push(h('line', { key: 'gy' + i, x1: X0, x2: X1, y1: y(t), y2: y(t), stroke: '#EEE8DC' }), h('text', { key: 'ty' + i, x: X0 - 8, y: y(t) + 4, textAnchor: 'end', fontSize: 12, fill: '#6B6455', fontFamily: 'Space Mono, monospace' }, fmt(t))));
    let x, xt;
    if (xCat) { const n = mg.grid.length, band = (X1 - X0) / n; x = (k, si) => X0 + band * (k + 0.5) + (mg.series.length > 1 ? (si - (mg.series.length - 1) / 2) * Math.min(18, band / (mg.series.length + 1)) : 0); xt = mg.grid.map((g2, k) => [X0 + band * (k + 0.5), String(this.vlabel(o.xName, g2))]); }
    else { const g0 = mg.grid[0], g1 = mg.grid[mg.grid.length - 1], span = g1 - g0 || 1; x = v => X0 + (v - g0) / span * (X1 - X0); const st = num(pl.xstep) && Number(pl.xstep) > 0 ? Number(pl.xstep) : 0; const vals = st ? (() => { const out = []; for (let v = g0; v <= g1 + 1e-9 && out.length < 80; v += st) out.push(Number(v.toPrecision(10))); return out; })() : (mg.grid.length <= 13 ? mg.grid : this._E.ticks(g0, g1, 7)); xt = vals.map(v => [x(v), fmt(v)]); }
    xt.forEach(([xx, l], i) => kids.push(h('text', { key: 'tx' + i, x: xx, y: Y1 + 18, textAnchor: 'middle', fontSize: 12, fill: '#6B6455', fontFamily: 'Space Mono, monospace' }, String(l).slice(0, 18))));
    kids.push(h('line', { key: 'ax', x1: X0, x2: X1, y1: Y1, y2: Y1, stroke: '#B9AE99' }));
    mg.series.forEach((s, si) => {
      const c = cols[si % cols.length], pts = s.pts.map((p, k) => ({ p, xx: xCat ? x(k, si) : x(p.x) }));
      if (pl.ci === 'band' && !xCat) kids.push(h('polygon', { key: 'b' + si, points: pts.map(q => q.xx.toFixed(1) + ',' + y(q.p.phi).toFixed(1)).concat(pts.slice().reverse().map(q => q.xx.toFixed(1) + ',' + y(q.p.plo).toFixed(1))).join(' '), fill: c, opacity: 0.16 }));
      if (pl.ci === 'bars' || (pl.ci === 'band' && xCat)) pts.forEach((q, k) => kids.push(h('line', { key: 'e' + si + '_' + k, x1: q.xx, x2: q.xx, y1: y(q.p.plo), y2: y(q.p.phi), stroke: c, strokeWidth: 1.8 }), h('line', { key: 'ea' + si + '_' + k, x1: q.xx - 4, x2: q.xx + 4, y1: y(q.p.plo), y2: y(q.p.plo), stroke: c, strokeWidth: 1.8 }), h('line', { key: 'eb' + si + '_' + k, x1: q.xx - 4, x2: q.xx + 4, y1: y(q.p.phi), y2: y(q.p.phi), stroke: c, strokeWidth: 1.8 })));
      if (pl.draw !== 'p' && pts.length > 1) kids.push(h('polyline', { key: 'l' + si, points: pts.map(q => q.xx.toFixed(1) + ',' + y(q.p.y).toFixed(1)).join(' '), fill: 'none', stroke: c, strokeWidth: 2.6 }));
      if (pl.draw !== 'l' || xCat) pts.forEach((q, k) => kids.push(h('circle', { key: 'p' + si + '_' + k, cx: q.xx, cy: y(q.p.y), r: 4.2, fill: c })));
    });
    if (pl.title) kids.push(h('text', { key: 'tt', x: X0, y: 24, fontSize: 16, fontWeight: 700, fill: '#1A1711' }, pl.title));
    kids.push(h('text', { key: 'xt', x: (X0 + X1) / 2, y: Y1 + 40, textAnchor: 'middle', fontSize: 13, fill: '#3D3629' }, pl.xtitle || o.xName), h('text', { key: 'yt', x: 16, y: (Y0 + Y1) / 2, textAnchor: 'middle', fontSize: 13, fill: '#3D3629', transform: 'rotate(-90 16 ' + (Y0 + Y1) / 2 + ')' }, o.ylab));
    if (o.byName && pl.legend !== 'none') {
      const items = mg.series.map((s, si) => [cols[si % cols.length], String(o.bv && o.bv.kind === 'num' ? o.byName + ' = ' + fmt(s.value) : this.vlabel(o.byName, s.label))]);
      items.forEach(([c, l], i) => { let lx, ly; if (pl.legend === 'right') { lx = X1 + 16; ly = Y0 + 8 + i * 20; } else if (pl.legend === 'bottom') { lx = X0 + i * Math.max(110, (X1 - X0) / items.length); ly = H - 22; } else { lx = X1 - 150; ly = Y0 + 8 + i * 20; } kids.push(h('rect', { key: 'lg' + i, x: lx, y: ly - 10, width: 12, height: 12, fill: c }), h('text', { key: 'lt' + i, x: lx + 18, y: ly, fontSize: 12.5, fill: '#2B271E' }, l.slice(0, 22))); });
    }
    return h('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': (pl.title || 'Margins plot') + ': ' + o.ylab + ' by ' + o.xName, style: { maxWidth: W + 'px', background: '#fff' }, ref: this.svgRef('rgmg') }, kids);
  }
  rgMgSay(mg, o) {
    const s0 = mg.series[0], f = v => o.model === 'logistic' || o.model === 'ologit' ? this.fmt(100 * v, 0) + '%' : this.cmFmt(v);
    if (!s0 || !s0.pts.length) return '';
    const a = s0.pts[0], b = s0.pts[s0.pts.length - 1], name = l => this.vlabel(o.xName, l);
    let t = 'The prediction ' + (b.y > a.y ? 'rises' : b.y < a.y ? 'falls' : 'stays') + ' from ' + f(a.y) + ' at ' + o.xName + ' = ' + (mg.xCat ? name(a.x) : this.cmFmt(a.x)) + ' to ' + f(b.y) + ' at ' + (mg.xCat ? name(b.x) : this.cmFmt(b.x)) + (mg.series.length > 1 ? ' for ' + o.byName + ' = ' + this.vlabel(o.byName, s0.label) : '') + '.';
    if (mg.series.length > 1) { const s1 = mg.series[1], d = s1.pts.map((p, k) => p.y - s0.pts[k].y), avg = d.reduce((x, y2) => x + y2, 0) / d.length; t += ' ' + o.byName + ' = ' + this.vlabel(o.byName, s1.label) + ' is on average ' + (o.model === 'logistic' || o.model === 'ologit' ? this.fmt(100 * Math.abs(avg), 1) + ' points' : this.cmFmt(Math.abs(avg))) + (avg >= 0 ? ' higher' : ' lower') + '.'; }
    return t + ' Where the bands overlap, the difference may be chance.';
  }
  rgMgRows(mg, o) { return mg.series.flatMap(s => s.pts.map(p => ({ x: mg.xCat ? String(this.vlabel(o.xName, p.x)) : Number(p.x.toPrecision(10)), by: o.byName ? (typeof s.value === 'number' ? Number(s.value.toPrecision(10)) : String(this.vlabel(o.byName, s.label))) : null, p }))); }
  rgMgText(mg, o) { const rows = this.rgMgRows(mg, o); return [[o.xName, o.byName, 'margin', 'std. err.', mg.df > 0 ? 't' : 'z', 'P', 'lower', 'upper'].filter((c, i) => i !== 1 || o.byName).join('\t'), ...rows.map(r => [r.x, r.by, r.p.y, r.p.se, r.p.t, r.p.p, r.p.lo, r.p.hi].filter((c, i) => i !== 1 || o.byName).map(v => typeof v === 'number' ? Number(v.toPrecision(7)) : v).join('\t'))].join('\n'); }
  rgMgTable(mg, o) {
    const h = React.createElement, rows = this.rgMgRows(mg, o), pct = Math.round(100 * (1 - this.alpha())), f = v => this.fmt(v, 3);
    const head = [o.xName, o.byName, 'margin', 'std. err.', mg.df > 0 ? 't' : 'z', mg.df > 0 ? 'P>|t|' : 'P>|z|', '[' + pct + '% conf. interval]'].filter((c, i) => i !== 1 || o.byName);
    const csv = () => { const t = this.rgMgText(mg, o).split('\n').map(l => l.split('\t').map(v => /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(',')).join('\n'); this.dlBlob(new Blob(['﻿' + t + '\n'], { type: 'text/csv;charset=utf-8' }), 'margins.csv'); };
    return h('details', { className: 'rg-mgt', open: true, key: 'tbl' }, h('summary', { className: 'tl-lbl' }, 'The margins table · ' + rows.length + ' rows · delta-method standard errors, as Stata'),
      h('div', { className: 'rg-scroll', tabIndex: 0, role: 'region', 'aria-label': 'Margins table' }, h('table', { className: 'rg-tbl' }, h('thead', null, h('tr', null, ...head.map((c, i) => h('th', { key: i }, c)))), h('tbody', null, ...rows.slice(0, 400).map((r, i) => h('tr', { key: i }, h('td', { className: 'mono' }, String(r.x)), o.byName ? h('td', null, String(r.by)) : null, h('td', { className: 'mono' }, f(r.p.y)), h('td', { className: 'mono' }, f(r.p.se)), h('td', { className: 'mono' }, this.fmt(r.p.t, 2)), h('td', { className: 'mono' }, this.fmtP(r.p.p).replace(/^p ?/, '')), h('td', { className: 'mono' }, '[' + f(r.p.lo) + ', ' + f(r.p.hi) + ']')))))),
      h('div', { className: 'tl-row' }, this.tlBtn('Copy table', () => this.copyTSV('rgmgt', this.rgMgText(mg, o))), this.tlBtn('CSV', csv)));
  }
  // ---------- 8 · export ----------
  rgStep8(now, out) {
    const h = React.createElement, { S, extra } = now;
    if (extra) return this.rgExtraView(now, 'export');
    if (!out.regRan) return this.rgPanel(8, 'Export', '', this.tlBanner('info', 'Run the model first (step 5).'));
    const d = this.descFor(), st = d ? this.cmdText(this.tagSg(d), 'stata') : '', r = d ? this.cmdText(this.tagSg(d), 'r') : '';
    return this.rgPanel(8, 'Export', 'the publication table (add models to compare them side by side), the APA line and the commands',
      h('div', { className: 'tl-row' }, out.apaReg ? h('span', { className: 'cm-apa' }, h('span', { className: 'cm-k' }, 'APA'), h('span', null, out.apaReg)) : null, out.copyApaReg ? this.tlBtn('Copy APA', out.copyApaReg) : null, this.tlBtn('Pin to report', () => this.pinTab()), this.tlBtn('Copy Stata command', () => this.copyTSV('rgst', st)), this.tlBtn('Copy R command', () => this.copyTSV('rgr', r))),
      h('pre', { className: 'rg-code' }, st + '\n\n' + r));
  }
  // ---------- the nine other models: their own tables, diagnostics and predictions ----------
  rgExtraView(now, part) {
    const h = React.createElement, { S, extra } = now, M = this.rgDefs().models[extra], r = this.rgExtraResult(), n = { results: 5, checks: 6, predictions: 7, export: 8 }[part];
    const status = S.analysisBusy ? this.tlBanner('info', S.analysisStatus || 'Computing…') : S.analysisError && S.analysisId === extra ? this.tlBanner('warn', S.analysisError, S.weightVar ? [' ', this.tlBtn('Clear the weight and run', () => { this.clearMemo(); this.setState({ weightVar: '', weightAuto: false }, () => this.rgRun(null)); }, 'primary', { key: 'cw' })] : null) : null;
    if (!r) return this.rgPanel(n, { results: 'Results', checks: 'Checks', predictions: 'Predictions', export: 'Export' }[part], M.t, status || this.tlBanner('info', 'Run the model to see the results. ', this.tlBtn('▶ Run ' + M.t, () => this.rgRun(null), 'primary')));
    const arr = v => v == null ? [] : Array.isArray(v) ? v : [v], lab = v => typeof v === 'string' ? this.asRelabel(v, r.labels || {}) : v, fmt = v => v == null ? '—' : typeof v === 'number' ? Number.isInteger(v) ? String(v) : Math.abs(v) > 0 && Math.abs(v) < 1e-4 ? v.toExponential(3) : Number(v.toPrecision(6)).toString() : String(lab(v));
    const table = (t, i) => this.rgStataTab(t, i, lab) || plainTable(t, i);
    const plainTable = (t, i) => {
      const head = h('thead', null, h('tr', null, ...arr(t.columns).map((c, j) => h('th', { key: j }, lab(c)))));
      const body = h('tbody', null, ...arr(t.rows).slice(0, 300).map((row, k) => h('tr', { key: k }, ...arr(row).map((v, j) => h('td', { key: j, className: typeof v === 'number' ? 'mono' : '' }, fmt(v))))));
      return h('div', { key: 'tb' + i, className: 'rg-box' }, h('span', { className: 'tl-lbl' }, t.title), h('div', { className: 'rg-scroll', tabIndex: 0, role: 'region', 'aria-label': t.title }, h('table', { className: 'rg-tbl' }, head, body)));
    };
    const plots = re => arr(r.plots).filter(p => re.test(p.title)).map((p, i) => h('div', { key: 'pl' + i, className: 'rg-box' }, h('span', { className: 'tl-lbl' }, p.title), h('div', { className: 'as-plot', dangerouslySetInnerHTML: { __html: p.svg } })));
    const tabs = arr(r.tables), isPred = t => /^Predictions|^Predicted/.test(t.title);
    if (part === 'results') return this.rgPanel(5, 'Results', M.t + ' · Analysis N = ' + r.analysisN + ' · input rows ' + r.inputN + ' · ' + (r.runtime || ''), status, ...tabs.filter(t => !isPred(t)).map(table), ...plots(/coef|effect|partial|smooth|spline/i), arr(r.notes).length ? h('div', { key: 'notes', className: 'rg-box' }, h('span', { className: 'tl-lbl' }, 'What the results say'), ...arr(r.notes).map((t, i) => h('p', { key: 'n' + i, className: 'rg-lead small' }, lab(t)))) : null); // GM26 .74: output first, notes below
    if (part === 'checks') return this.rgPanel(6, 'Checks', M.t, h('pre', { className: 'rg-code' }, arr(r.diagnostics).map(lab).join('\n') || 'This model has no additional diagnostic output.'), ...plots(/resid|fit|diagn|qq|root/i));
    if (part === 'predictions') { const pt = tabs.filter(isPred); return this.rgPanel(7, 'Predictions', M.t, pt.length ? null : this.tlBanner('info', 'Margins plots with chosen values are available for linear, logit, ordinal and Poisson regression; this model reports its own predictions where it has them.'), ...pt.map(table)); }
    let cm = null; try { const info = this.asCatalog().find(q => q.id === extra), c = (S.analysisPages || {})[extra] || {}; const x = this.asCommands(info, this.asPacket(info, c)); cm = { st: x.stata ?? x[0], r: x.r ?? x[1] }; } catch (e) { }
    return this.rgPanel(8, 'Export', M.t, h('div', { className: 'tl-row' }, this.tlBtn('Pin to report', () => this.pinTab()), cm ? this.tlBtn('Copy Stata command', () => this.copyTSV('rgst', cm.st || '')) : null, cm ? this.tlBtn('Copy R command', () => this.copyTSV('rgr', cm.r || '')) : null), cm ? h('pre', { className: 'rg-code' }, (cm.st || '') + '\n\n' + (cm.r || '')) : null);
  }
  // GM26 regression guide end
