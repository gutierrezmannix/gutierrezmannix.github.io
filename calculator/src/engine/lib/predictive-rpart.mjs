// rpart 4.1.23 port: method "anova" (anovass/anova) and "class" (gini with default priors and losses),
// partition/bsplit/insert_split, surrogate/choose_surg, nodesplit, make_cp_list/make_cp_table, internal
// cross-validation (xval/rundown/branch/fix_cp, groups supplied from R's RNG), the cptable, and
// predict.rpart (pred_rpart: surrogates, then majority child by n). mysort and graycode are ported exactly
// so ties and category orderings follow R.
const LEFT = -1, RIGHT = 1;

function mysort(start, stop, x, cvec) {
  while (start < stop) {
    if (stop - start < 11) {
      for (let i = start + 1; i <= stop; i++) { const temp = x[i], tempd = cvec[i]; let j = i - 1; while (j >= start && x[j] > temp) { x[j + 1] = x[j]; cvec[j + 1] = cvec[j]; j--; } x[j + 1] = temp; cvec[j + 1] = tempd; }
      return;
    }
    let i = start, j = stop; const k = (start + stop) >> 1; let median = x[k];
    if (x[i] >= x[k]) { if (x[j] > x[k]) median = x[i] > x[j] ? x[j] : x[i]; } else if (x[j] < x[k]) median = x[i] > x[j] ? x[i] : x[j];
    while (i < j) {
      while (x[i] < median) i++;
      while (x[j] > median) j--;
      if (i < j) { if (x[i] > x[j]) { let t = x[i]; x[i] = x[j]; x[j] = t; t = cvec[i]; cvec[i] = cvec[j]; cvec[j] = t; } i++; j--; }
    }
    while (x[i] >= median && i > start) i--;
    while (x[j] <= median && j < stop) j++;
    if (i - start < stop - j) { if (i - start > 0) mysort(start, i, x, cvec); start = j; }
    else { if (stop - j > 0) mysort(j, stop, x, cvec); stop = i; }
  }
}
// graycode state
function grayInit1(G, numcat, count) { G.maxc = numcat; for (let i = 0; i < numcat; i++) G.gray[i] = count[i] ? 1 : 0; G.gsave = -2; }
function grayInit2(G, numcat, count, val) {
  G.maxc = numcat; const gray = G.gray; gray[0] = 0; let k = count[0] === 0 ? 1 : 0;
  for (let i = 1; i < numcat; i++) {
    if (count[i] === 0) { for (let j = i - 1; j >= k; j--) { gray[j + 1] = gray[j]; val[j + 1] = val[j]; } gray[k++] = i; }
    else { const temp = val[i]; let j; for (j = i - 1; j >= k && val[j] > temp; j--) { gray[j + 1] = gray[j]; val[j + 1] = val[j]; } val[j + 1] = temp; gray[j + 1] = i; }
  }
  G.gsave = k - 1;
}
function graycode(G) {
  if (G.gsave > -2) { G.gsave++; return G.gsave < G.maxc ? G.gray[G.gsave] : G.maxc; }
  for (let i = 0; i < G.maxc - 1; i++) { if (G.gray[i] === 1) { G.gray[i] = 2; return i; } else if (G.gray[i] === 2) G.gray[i] = 1; }
  return G.maxc;
}

// ---- splitting methods ----
function anovaMethod() {
  return {
    numResp: 1,
    eval(y, wt) { let temp = 0, twt = 0; for (let i = 0; i < y.length; i++) { temp += y[i] * wt[i]; twt += wt[i]; } const mean = temp / twt; let ss = 0; for (let i = 0; i < y.length; i++) { const t = y[i] - mean; ss += t * t * wt[i]; } return { value: [mean], risk: ss }; },
    error: (y, est) => { const t = y - est[0]; return t * t; },
    choose(n, y, x, nclass, edge, myrisk, wt, G) {
      let rightWt = 0, rightN = n, rightSum = 0;
      for (let i = 0; i < n; i++) { rightSum += y[i] * wt[i]; rightWt += wt[i]; }
      const grandmean = rightSum / rightWt; let best = 0, leftSum = 0, leftWt = 0, leftN = 0, temp;
      if (nclass === 0) {
        let direction = LEFT, where = 0; rightSum = 0;
        for (let i = 0; rightN > edge; i++) {
          leftWt += wt[i]; rightWt -= wt[i]; leftN++; rightN--; temp = (y[i] - grandmean) * wt[i]; leftSum += temp; rightSum -= temp;
          if (x[i + 1] !== x[i] && leftN >= edge) { temp = leftSum * leftSum / leftWt + rightSum * rightSum / rightWt; if (temp > best) { best = temp; where = i; direction = leftSum < rightSum ? LEFT : RIGHT; } }
        }
        return best > 0 ? { improve: best / myrisk, split: (x[where] + x[where + 1]) / 2, csplit: [direction] } : { improve: best / myrisk };
      }
      const sums = new Float64Array(nclass), wts = new Float64Array(nclass), countn = new Int32Array(nclass), tsplit = new Int32Array(nclass), mean = new Float64Array(nclass);
      for (let i = 0; i < n; i++) { const j = x[i] - 1; countn[j]++; wts[j] += wt[i]; sums[j] += (y[i] - grandmean) * wt[i]; }
      for (let i = 0; i < nclass; i++) { if (countn[i] > 0) { tsplit[i] = RIGHT; mean[i] = sums[i] / wts[i]; } else tsplit[i] = 0; }
      grayInit2(G, nclass, countn, mean);
      let csplit = null, j; rightSum = 0;
      while ((j = graycode(G)) < nclass) {
        tsplit[j] = LEFT; leftN += countn[j]; rightN -= countn[j]; leftWt += wts[j]; rightWt -= wts[j]; leftSum += sums[j]; rightSum -= sums[j];
        if (leftN >= edge && rightN >= edge) { temp = leftSum * leftSum / leftWt + rightSum * rightSum / rightWt; if (temp > best) { best = temp; csplit = leftSum / leftWt > rightSum / rightWt ? Array.from(tsplit, t => -t) : Array.from(tsplit); } }
      }
      return { improve: best / myrisk, csplit, split: 0 };
    },
  };
}
function giniMethod(y, wt, ncls) {
  const numclass = ncls, counts = new Float64Array(numclass); let tot = 0;
  for (let i = 0; i < y.length; i++) { counts[y[i] - 1] += wt[i]; tot += wt[i]; }
  const parmPrior = Array.from(counts, c => c / tot), loss = new Float64Array(numclass * numclass);
  const freq = new Float64Array(numclass), prior = new Float64Array(numclass), aprior = new Float64Array(numclass);
  let temp = 0; for (let i = 0; i < y.length; i++) freq[y[i] - 1] += wt[i]; for (let i = 0; i < numclass; i++) freq[i] /= tot;
  for (let i = 0; i < numclass; i++) { prior[i] = parmPrior[i]; aprior[i] = 0; for (let j = 0; j < numclass; j++) { const k = numclass * j + i; loss[k] = i === j ? 0 : 1; temp += loss[k] * prior[i]; aprior[i] += loss[k] * prior[i]; } }
  for (let i = 0; i < numclass; i++) if (freq[i] > 0) { prior[i] /= freq[i]; aprior[i] /= temp * freq[i]; }
  const impurity = p => p * (1 - p);
  return {
    numResp: numclass + 2, parmPrior, counts,
    eval(yy, w) {
      const f = new Float64Array(numclass); let t = 0;
      for (let i = 0; i < yy.length; i++) { const j = yy[i] - 1; f[j] += w[i]; t += w[i] * prior[j]; }
      let dev = 0, max = 0;
      for (let i = 0; i < numclass; i++) { let s = 0; for (let j = 0; j < numclass; j++) s += f[j] * loss[i * numclass + j] * prior[j]; if (i === 0 || s < dev) { max = i; dev = s; } }
      return { value: [max + 1, ...f, t], risk: dev };
    },
    error: (yv, est) => prior[yv - 1] * loss[(yv - 1) * numclass + (est[0] - 1)],
    choose(n, yy, x, numcat, edge, myrisk, w, G) {
      const left = new Float64Array(numclass), right = new Float64Array(numclass); let lwt = 0, rwt = 0, rtot = 0, ltot = 0;
      for (let i = 0; i < n; i++) { const j = yy[i] - 1; rwt += aprior[j] * w[i]; right[j] += w[i]; rtot++; }
      let totalSS = 0; for (let i = 0; i < numclass; i++) { const t = aprior[i] * right[i] / rwt; totalSS += rwt * impurity(t); }
      let best = totalSS;
      const evalLR = () => { let t = 0, lmean = 0, rmean = 0; for (let j = 0; j < numclass; j++) { let p = aprior[j] * left[j] / lwt; t += lwt * impurity(p); lmean += p * j; p = aprior[j] * right[j] / rwt; t += rwt * impurity(p); rmean += p * j; } return [t, lmean, rmean]; };
      if (numcat === 0) {
        let direction = LEFT, where = 0;
        for (let i = 0; rtot > edge; i++) {
          const j = yy[i] - 1; rwt -= aprior[j] * w[i]; lwt += aprior[j] * w[i]; rtot--; ltot++; right[j] -= w[i]; left[j] += w[i];
          if (ltot >= edge && x[i + 1] !== x[i]) { const [t, lm, rm] = evalLR(); if (t < best) { best = t; where = i; direction = lm < rm ? LEFT : RIGHT; } }
        }
        const improve = totalSS - best;
        return improve > 0 ? { improve, split: (x[where] + x[where + 1]) / 2, csplit: [direction] } : { improve };
      }
      const awt = new Float64Array(numcat), countn = new Int32Array(numcat), rate = new Float64Array(numcat), tsplit = new Int32Array(numcat), ccnt = Array.from({ length: numclass }, () => new Float64Array(numcat));
      for (let i = 0; i < n; i++) { const j = yy[i] - 1, k = x[i] - 1; awt[k] += aprior[j] * w[i]; countn[k]++; ccnt[j][k] += w[i]; }
      for (let i = 0; i < numcat; i++) { if (awt[i] === 0) tsplit[i] = 0; else { rate[i] = ccnt[0][i] / awt[i]; tsplit[i] = RIGHT; } }
      if (numclass === 2) grayInit2(G, numcat, countn, rate); else grayInit1(G, numcat, countn);
      let csplit = null, i;
      while ((i = graycode(G)) < numcat) {
        if (tsplit[i] === LEFT) { tsplit[i] = RIGHT; rwt += awt[i]; lwt -= awt[i]; rtot += countn[i]; ltot -= countn[i]; for (let j = 0; j < numclass; j++) { right[j] += ccnt[j][i]; left[j] -= ccnt[j][i]; } }
        else { tsplit[i] = LEFT; rwt -= awt[i]; lwt += awt[i]; rtot -= countn[i]; ltot += countn[i]; for (let j = 0; j < numclass; j++) { right[j] -= ccnt[j][i]; left[j] += ccnt[j][i]; } }
        if (ltot >= edge && rtot >= edge) { const [t, lm, rm] = evalLR(); if (t < best) { best = t; csplit = lm < rm ? Array.from(tsplit) : Array.from(tsplit, z => -z); } }
      }
      return { improve: totalSS - best, csplit, split: 0 };
    },
  };
}

// insert_split: keep a list sorted by improvement (new entries after ties), at most max long
function insertSplit(list, improve, max) {
  if (!list.length) { const s = {}; list.push(s); return s; }
  let pos = list.findIndex(s => improve > s.improve); if (pos < 0) pos = list.length;
  if (pos >= max || (pos === list.length && list.length >= max)) return null;
  const s = {}; list.splice(pos, 0, s); if (list.length > max) list.length = max; return s;
}

// X: array of columns (numbers; categorical as 1-based codes), ncat per column, y: numbers (class: 1-based codes)
export function rpart({ X, ncat, y, method, cp = 0.01, xval = 10, xgroups = null, minsplit = 20, minbucket = Math.round(minsplit / 3), maxcompete = 4, maxsur = 5, usesurrogate = 2, maxdepth = 30 }) {
  const n = y.length, nvar = X.length, wt = new Float64Array(n).fill(1), G = { gray: new Int32Array(Math.max(1, ...ncat)), maxc: 0, gsave: -2 };
  const nclass = method === 'class' ? Math.max(...y) : 0;
  const M = method === 'class' ? giniMethod(y, wt, nclass) : anovaMethod();
  const rp = { alpha: 0, iscale: 0, minNode: minbucket, minSplit: minsplit, maxpri: Math.max(1, maxcompete + 1), maxsur, usesurrogate, maxnode: Math.pow(2, maxdepth) - 1, which: new Int32Array(n).fill(1), tempvec: new Int32Array(n) };
  const sorts = [];
  for (let i = 0; i < nvar; i++) { const tv = new Int32Array(n), xt = new Float64Array(n); for (let k = 0; k < n; k++) { tv[k] = k; xt[k] = X[i][k]; } if (ncat[i] === 0) mysort(0, n - 1, xt, tv); sorts.push(tv); }
  const savesort = sorts.map(s => Int32Array.from(s));
  const evalNode = idx => M.eval(idx.map(j => y[j]), idx.map(j => wt[j]));
  const mkNode = () => ({ risk: 0, complexity: 0, sumWt: 0, numObs: 0, primary: [], surrogate: [], leftson: null, rightson: null, lastsurrogate: 0, est: null });

  function bsplit(me, n1, n2) {
    me.primary = [];
    for (let i = 0; i < nvar; i++) {
      const index = sorts[i], nc = ncat[i], xt = [], yt = [], wtt = [];
      for (let j = n1; j < n2; j++) { const kk = index[j]; if (kk >= 0 && wt[kk] > 0) { xt.push(X[i][kk]); yt.push(y[kk]); wtt.push(wt[kk]); } }
      const k = xt.length; if (k === 0 || (nc === 0 && xt[0] === xt[k - 1])) continue;
      xt.push(xt[k - 1]); // x[i+1] read at the last step is never used for a split
      const r = M.choose(k, yt, xt, nc, rp.minNode, me.risk, wtt, G);
      let improve = r.improve;
      if (improve > rp.iscale) rp.iscale = improve;
      if (improve > rp.iscale * 1e-10) {
        const ts = insertSplit(me.primary, improve, rp.maxpri);
        if (ts) { ts.improve = improve; ts.varNum = i; ts.spoint = r.split; ts.count = k; ts.csplit = nc === 0 ? [r.csplit ? r.csplit[0] : 0] : (r.csplit || new Array(nc).fill(0)).slice(); }
      }
    }
  }
  function chooseSurg(n1, n2, tempy, x, order, nc, tleft, tright) {
    let agree, majority, totalWt, success = false, split = 0, csplit;
    if (nc === 0) {
      let lastx = 0, ll = 0, rl = 0, llwt = 0, rlwt = 0;
      for (let i = n2 - 1; i >= n1; i--) { const j = order[i]; if (j >= 0) { lastx = x[j]; if (tempy[j] === LEFT) { if (wt[j] > 0) ll++; llwt += wt[j]; } else if (tempy[j] === RIGHT) { if (wt[j] > 0) rl++; rlwt += wt[j]; } } }
      agree = llwt > rlwt ? llwt : rlwt; majority = agree; totalWt = llwt + rlwt;
      let lr = 0, rr = 0, lrwt = 0, rrwt = 0; csplit = [LEFT]; split = lastx;
      for (let i = n1; ll + rl >= 2; i++) {
        const j = order[i];
        if (j >= 0) {
          if (lr + rr >= 2 && x[j] !== lastx) {
            if (llwt + rrwt > agree) { success = true; agree = llwt + rrwt; csplit = [RIGHT]; split = (x[j] + lastx) / 2; }
            else if (lrwt + rlwt > agree) { success = true; agree = lrwt + rlwt; csplit = [LEFT]; split = (x[j] + lastx) / 2; }
          }
          if (tempy[j] === LEFT) { if (wt[j] > 0) { ll--; lr++; } llwt -= wt[j]; lrwt += wt[j]; } else if (tempy[j] === RIGHT) { if (wt[j] > 0) { rl--; rr++; } rlwt -= wt[j]; rrwt += wt[j]; }
          lastx = x[j];
        }
      }
    } else {
      const left = new Int32Array(nc), right = new Int32Array(nc), lwt = new Float64Array(nc), rwt = new Float64Array(nc); let lcount = 0, rcount = 0;
      for (let i = n1; i < n2; i++) { const j = order[i]; if (j >= 0) { const k = x[j] - 1; if (tempy[j] === LEFT) { if (wt[j] > 0) left[k]++; lwt[k] += wt[j]; } else if (tempy[j] === RIGHT) { if (wt[j] > 0) right[k]++; rwt[k] += wt[j]; } } }
      let llwt = 0, rrwt = 0; for (let i = 0; i < nc; i++) { llwt += lwt[i]; rrwt += rwt[i]; }
      let defdir; if (llwt > rrwt) { defdir = LEFT; majority = llwt; } else { defdir = RIGHT; majority = rrwt; }
      totalWt = llwt + rrwt; agree = 0; csplit = new Array(nc).fill(0);
      for (let i = 0; i < nc; i++) {
        if (left[i] === 0 && right[i] === 0) csplit[i] = 0;
        else if (lwt[i] < rwt[i] || (lwt[i] === rwt[i] && defdir === RIGHT)) { agree += rwt[i]; csplit[i] = RIGHT; lcount += left[i]; rcount += right[i]; }
        else { agree += lwt[i]; csplit[i] = LEFT; lcount += right[i]; rcount += left[i]; }
      }
      success = lcount > 1 && rcount > 1;
    }
    if (!success) return { agreement: 0, adj: 0, split, csplit };
    totalWt = tleft + tright; majority = tleft > tright ? tleft : tright; // sur_agree = 0
    const agreement = agree / totalWt; majority /= totalWt;
    return { agreement, adj: (agreement - majority) / (1 - majority), split, csplit };
  }
  function surrogate(me, n1, n2) {
    const tempy = rp.tempvec, p = me.primary[0], v = p.varNum;
    for (let i = n1; i < n2; i++) { const j = sorts[v][i]; if (j < 0) tempy[-(j + 1)] = 0; else tempy[j] = ncat[v] === 0 ? (X[v][j] < p.spoint ? p.csplit[0] : -p.csplit[0]) : p.csplit[X[v][j] - 1]; }
    let lcount = 0, rcount = 0;
    for (let i = n1; i < n2; i++) { let j = sorts[v][i]; if (j < 0) j = -(1 + j); if (tempy[j] === LEFT) lcount += wt[j]; else if (tempy[j] === RIGHT) rcount += wt[j]; }
    me.lastsurrogate = lcount < rcount ? RIGHT : lcount > rcount ? LEFT : 0;
    me.surrogate = [];
    for (let i = 0; i < nvar; i++) {
      if (i === v) continue;
      const r = chooseSurg(n1, n2, tempy, X[i], sorts[i], ncat[i], lcount, rcount);
      if (r.adj <= 1e-10) continue;
      const ss = insertSplit(me.surrogate, r.agreement, rp.maxsur);
      if (ss) { ss.improve = r.agreement; ss.varNum = i; ss.count = 0; ss.adj = r.adj; ss.spoint = r.split; ss.csplit = r.csplit.slice(); }
    }
  }
  function nodesplit(me, nodenum, n1, n2) {
    const which = rp.which, leftson = 2 * nodenum, rightson = leftson + 1, p = me.primary[0], pv = p.varNum; let nleft = 0, nright = 0;
    for (let i = n1; i < n2; i++) {
      const j = sorts[pv][i]; if (j < 0) continue;
      const dir = ncat[pv] > 0 ? p.csplit[X[pv][j] - 1] : (X[pv][j] < p.spoint ? p.csplit[0] : -p.csplit[0]);
      if (dir === LEFT) { which[j] = leftson; nleft++; } else if (dir === RIGHT || ncat[pv] === 0) { which[j] = rightson; nright++; }
    }
    for (let k = 0; k < nvar; k++) {
      const sindex = sorts[k]; let i1 = n1, i2 = i1 + nleft, i3 = i2 + nright;
      for (let i = n1; i < n2; i++) { let j = sindex[i]; if (j < 0) j = -(j + 1); if (which[j] === leftson) sindex[i1++] = sindex[i]; else if (which[j] === rightson) rp.tempvec[i2++] = sindex[i]; else rp.tempvec[i3++] = sindex[i]; }
      for (let i = n1 + nleft; i < n2; i++) sindex[i] = rp.tempvec[i];
    }
    return [nleft, nright];
  }
  function partition(nodenum, me, n1, n2) {
    const nn = n2 - n1; let tempcp;
    if (nodenum > 1) {
      const idx = []; let twt = 0; for (let i = n1; i < n2; i++) { let j = sorts[0][i]; if (j < 0) j = -(1 + j); idx.push(j); twt += wt[j]; }
      const e = evalNode(idx); me.est = e.value; me.risk = e.risk; me.numObs = nn; me.sumWt = twt;
      tempcp = me.risk; if (tempcp > me.complexity) tempcp = me.complexity;
    } else tempcp = me.risk;
    const leaf = () => { me.leftson = me.rightson = null; me.primary = []; me.surrogate = []; return { nsplit: 0, risk: me.risk }; };
    if (me.numObs < rp.minSplit || tempcp <= rp.alpha || nodenum > rp.maxnode) { me.complexity = rp.alpha; return leaf(); }
    bsplit(me, n1, n2);
    if (!me.primary.length) { me.complexity = rp.alpha; return leaf(); }
    if (rp.maxsur > 0) surrogate(me, n1, n2); else me.surrogate = [];
    const [nleft, nright] = nodesplit(me, nodenum, n1, n2);
    me.leftson = mkNode(); me.leftson.complexity = tempcp - rp.alpha;
    let { nsplit: leftSplit, risk: leftRisk } = partition(2 * nodenum, me.leftson, n1, n1 + nleft);
    tempcp = (me.risk - leftRisk) / (leftSplit + 1); const tempcp2 = me.risk - me.leftson.risk;
    if (tempcp < tempcp2) tempcp = tempcp2; if (tempcp > me.complexity) tempcp = me.complexity;
    me.rightson = mkNode(); me.rightson.complexity = tempcp - rp.alpha;
    let { nsplit: rightSplit, risk: rightRisk } = partition(1 + 2 * nodenum, me.rightson, n1 + nleft, n1 + nleft + nright);
    tempcp = (me.risk - (leftRisk + rightRisk)) / (leftSplit + rightSplit + 1);
    if (me.rightson.complexity > me.leftson.complexity) {
      if (tempcp > me.leftson.complexity) { leftRisk = me.leftson.risk; leftSplit = 0; tempcp = (me.risk - (leftRisk + rightRisk)) / (leftSplit + rightSplit + 1); if (tempcp > me.rightson.complexity) { rightRisk = me.rightson.risk; rightSplit = 0; } }
    } else if (tempcp > me.rightson.complexity) {
      rightSplit = 0; rightRisk = me.rightson.risk; tempcp = (me.risk - (leftRisk + rightRisk)) / (leftSplit + rightSplit + 1);
      if (tempcp > me.leftson.complexity) { leftRisk = me.leftson.risk; leftSplit = 0; }
    }
    me.complexity = (me.risk - (leftRisk + rightRisk)) / (leftSplit + rightSplit + 1);
    if (me.complexity <= rp.alpha) {
      me.leftson = me.rightson = null; me.primary = []; me.surrogate = [];
      for (let i = n1; i < n2; i++) { let j = sorts[0][i]; if (j < 0) j = -(1 + j); rp.which[j] = nodenum; }
      return { nsplit: 0, risk: me.risk };
    }
    return { nsplit: leftSplit + rightSplit + 1, risk: leftRisk + rightRisk };
  }
  const grow = (idx) => {
    const t = mkNode(); t.numObs = idx.length; let s = 0; for (const j of idx) s += wt[j]; t.sumWt = s;
    const e = evalNode(idx); t.est = e.value; t.risk = e.risk; t.complexity = t.risk; return t;
  };
  // ---- main tree ----
  const all = Array.from({ length: n }, (_, i) => i), tree = grow(all);
  rp.alpha = cp * tree.risk;
  partition(1, tree, 0, n);
  const cpt = [{ cp: tree.complexity, risk: tree.risk, nsplit: 0, xrisk: 0, xstd: 0 }];
  const makeCpList = (me, parent) => {
    if (me.complexity > parent) me.complexity = parent;
    let meCp = me.complexity; if (meCp < rp.alpha) meCp = rp.alpha;
    if (me.leftson) { makeCpList(me.leftson, meCp); makeCpList(me.rightson, meCp); }
    if (meCp < parent) {
      let pos = 0; for (; pos < cpt.length; pos++) { if (meCp === cpt[pos].cp) return; if (meCp > cpt[pos].cp) break; }
      cpt.splice(pos, 0, { cp: meCp, risk: 0, nsplit: 0, xrisk: 0, xstd: 0 });
    }
  };
  const makeCpTable = (me, parent, nsplit) => {
    let i;
    if (me.leftson) { makeCpTable(me.leftson, me.complexity, 0); i = makeCpTable(me.rightson, me.complexity, nsplit + 1); } else i = cpt.length - 1;
    while (cpt[i].cp < parent) { cpt[i].risk += me.risk; cpt[i].nsplit += nsplit; i--; }
    return i;
  };
  const branch = (t, obs) => {
    if (!t.leftson) return null;
    const dirOf = s => { const j = s.varNum, xv = X[j][obs]; if (!Number.isFinite(xv)) return 0; return ncat[j] === 0 ? (xv < s.spoint ? s.csplit[0] : -s.csplit[0]) : s.csplit[xv - 1]; };
    let dir = dirOf(t.primary[0]);
    if (!dir) { if (rp.usesurrogate === 0) return null; for (const s of t.surrogate) { dir = dirOf(s); if (dir) break; } if (!dir) { if (rp.usesurrogate < 2) return null; dir = t.lastsurrogate; } }
    return dir === LEFT ? t.leftson : t.rightson;
  };
  if (tree.rightson) {
    makeCpList(tree, tree.complexity); makeCpTable(tree, tree.complexity, 0);
    if (xval > 1) {
      const alphasave = rp.alpha, ncp = cpt.length, cps = new Float64Array(ncp);
      cps[0] = 10 * cpt[0].cp; for (let i = 1; i < ncp; i++) cps[i] = Math.sqrt(cpt[i - 1].cp * cpt[i].cp);
      let totalWt = 0; for (let i = 0; i < n; i++) totalWt += wt[i]; let oldWt = totalWt;
      for (let g = 0; g < xval; g++) {
        for (let j = 0; j < nvar; j++) { let k = 0; for (let i = 0; i < n; i++) { let ii = savesort[j][i]; if (ii < 0) ii = -(1 + ii); if (xgroups[ii] !== g + 1) sorts[j][k++] = savesort[j][i]; } }
        const inn = [], out = []; let temp = 0;
        for (let i = 0; i < n; i++) { rp.which[i] = 1; if (xgroups[i] === g + 1) out.push(i); else { inn.push(i); temp += wt[i]; } }
        for (let j = 0; j < ncp; j++) cps[j] *= temp / oldWt;
        rp.alpha *= temp / oldWt; oldWt = temp;
        const xt = grow(inn); partition(1, xt, 0, inn.length);
        const fix = (me, pc) => { if (me.complexity > pc) me.complexity = pc; if (me.leftson) { fix(me.leftson, me.complexity); fix(me.rightson, me.complexity); } };
        fix(xt, xt.complexity);
        for (const obs of out) {
          let t = xt;
          for (let i = 0; i < ncp; i++) {
            while (cps[i] < t.complexity) { const nt = branch(t, obs); if (!nt) break; t = nt; }
            const e = M.error(y[obs], t.est); cpt[i].xrisk += e * wt[obs]; cpt[i].xstd += e * e * wt[obs];
          }
        }
      }
      for (const c of cpt) c.xstd = Math.sqrt(c.xstd - c.xrisk * c.xrisk / totalWt);
      rp.alpha = alphasave;
    }
  }
  const scale = 1 / tree.risk;
  const cptable = cpt.map(c => xval > 1 ? [c.cp * scale, c.nsplit, c.risk * scale, c.xrisk * scale, c.xstd * scale] : [c.cp * scale, c.nsplit, c.risk * scale]);
  const isLeaf = t => t.complexity <= rp.alpha || !t.leftson;
  // predict.rpart: returns the node reached by each row (rows: arrays of column values in X order)
  const predictNode = row => {
    let t = tree;
    for (;;) {
      if (isLeaf(t)) return t;
      const dirOf = s => { const j = s.varNum, xv = row[j]; if (!Number.isFinite(xv)) return 0; return ncat[j] > 0 ? s.csplit[xv - 1] : (xv < s.spoint ? s.csplit[0] : -s.csplit[0]); };
      let dir = dirOf(t.primary[0]);
      if (!dir && usesurrogate > 0) for (const s of t.surrogate) { dir = dirOf(s); if (dir) break; }
      if (!dir && usesurrogate > 1) { const l = t.leftson.numObs, r = t.rightson.numObs; if (l !== r) dir = l > r ? LEFT : RIGHT; }
      if (!dir) return t;
      t = dir === LEFT ? t.leftson : t.rightson;
    }
  };
  const yprob = t => { const p = t.est.slice(1, 1 + nclass).map((f, i) => f * (M.parmPrior[i] / Math.max(1, M.counts[i]))), s = p.reduce((a, b) => a + b, 0); return p.map(v => v / s); };
  return { tree, cptable, columns: xval > 1 ? ['CP', 'nsplit', 'rel error', 'xerror', 'xstd'] : ['CP', 'nsplit', 'rel error'], isLeaf, predictNode, yprob, nclass, alpha: rp.alpha, scale };
}
