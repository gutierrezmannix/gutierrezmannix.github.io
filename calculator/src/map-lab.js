  // ---- GM26 Map page (Charts → Map): a country's states or municipalities, the world, or the user's own boundary file.
  // Plain words for people who have never made a map: the page finds the column that names the place, says how many
  // values it recognised, and asks once about anything it could not recognise (saved as value labels).
  mlHandles(id) { return id === 'map' || id === 'geomap'; }
  mlScope(c) { return c.scope || (this.state.plotKind === 'geomap' ? 'file' : 'country'); }
  mlId(c) { return c.id || (this.state.plotKind === 'geomap' ? c.x : '') || ''; }
  mlVals(out) {
    const S = this.state; if (!out.isPlots || !this.mlHandles(S.plotKind) || !this._E || !this._E.mlFromTopo) return;
    out.isChartSuite = true; out.isPlotsLegacy = false; out.plotEmpty = false; out.chartPageHeader = null;
    out.chartSuiteEl = this.mlRender();
  }
  // the built-in maps load the first time the page needs them (embedded in the page: no internet)
  mlLoad(which) {
    const D = this._mlD || (this._mlD = {}); if (which === 'world' && !D.world && this._geo) D.world = this._geo;
    if (D[which]) return D[which]; if (D[which + 'P'] || D[which + 'Err']) return null;
    const R = typeof window !== 'undefined' ? window.__resources || {} : {}, url = { world: R.geo, a1: R.maps1, mx: R.mapsmx }[which];
    if (!url) { D[which + 'Err'] = 'not in this page'; return null; }
    D[which + 'P'] = import(url).then(m => { D[which] = which === 'world' ? m : (m.default || m); if (which === 'world') this._geo = m; this.forceUpdate(); }).catch(e => { D[which + 'Err'] = String(e && e.message || e); this.forceUpdate(); });
    return null;
  }
  mlCountryNames() { const D = this._mlD || {}, out = {}; const W = D.world || this._geo; if (W && W.CODES) for (const [a2, a3, num, names] of W.CODES) out[a3] = names[0]; out.MEX = 'Mexico'; return out; }
  mlCountries() {
    const D = this._mlD || {}; if (!D.a1) return [];
    return this.memo('mlCountries|' + (D.world ? 1 : 0), () => {
      const E = this._E, nm = this.mlCountryNames();
      const list = Object.entries(D.a1.c).map(([iso, c]) => ({ iso, name: nm[iso] || c.cn || iso, levels: [{ level: 1, name: E.mlLevelName(iso, 1, c.lv), count: c.t.objects.a.geometries.length }] }));
      list.push({ iso: 'MEX', name: 'Mexico', levels: [{ level: 1, name: 'States', count: 32 }, { level: 2, name: 'Municipalities', count: 2475 }] });
      return list.sort((a, b) => a.name.localeCompare(b.name));
    });
  }
  // the map chosen on the page: geometry, its areas for matching, and how codes are written
  mlSel(c) {
    const E = this._E, D = this._mlD || {}, scope = this.mlScope(c);
    if (scope === 'world') {
      const W = this.mlLoad('world'); if (!W) return { wait: !D.worldErr, error: D.worldErr };
      const G = this.memo('mlG|world', () => E.mlFromTopo(W.TOPO, 'countries'));
      return { key: 'world|' + (c.region || ''), G, scope: 'world', title: 'the world', unit: 'countries', areas: G.feats.map(f => ({ id: String(f.props.name || ''), name: String(f.props.name || '') })), world: W };
    }
    if (scope === 'file') {
      // a file read on this page, or the boundaries saved with a session by the older page (geo + geoKey)
      const F = this._mlFile || (c.geo ? this.memo('mlOldGeo|' + (c.geoName || '') + '|' + (c.geo.features || []).length, () => { const G = E.mlFromGeoJSON(c.geo); return { name: c.geoName || 'Boundary file', G, props: [...new Set(G.feats.flatMap(f => Object.keys(f.props || {})))] }; }) : null); if (!F) return { needFile: true };
      const want = c.fileKey || c.geoKey, key = want && F.props.includes(want) ? want : F.props[0];
      return { key: 'file|' + F.name + '|' + key, G: F.G, scope: 'country', title: F.name, unit: 'areas', fileKey: key, areas: F.G.feats.map(f => ({ id: String(f.props[key] ?? ''), name: String(f.props[key] ?? '') })) };
    }
    const iso = c.country || 'MEX', level = +(c.level || 1);
    if (iso === 'MEX') {
      const MX = this.mlLoad('mx'); if (!MX) return { wait: !D.mxErr, error: D.mxErr };
      const st = this.memo('mlMXst', () => { const out = {}; for (const g of MX.objects.states.geometries) out[g.p.c] = g.p.n; return out; });
      if (level === 2) {
        const G = this.memo('mlG|MEX2', () => E.mlFromTopo(MX, 'mun'));
        return { key: 'MEX|2', G, scope: 'country', iso, level, title: 'Mexico', unit: 'municipalities', codeWidth: 5, parentNames: st, areas: G.feats.map(f => ({ id: f.props.c, name: f.props.n, code: f.props.c, parent: f.props.c.slice(0, 2), parentName: st[f.props.c.slice(0, 2)] })) };
      }
      const G = this.memo('mlG|MEX1', () => E.mlFromTopo(MX, 'states'));
      return { key: 'MEX|1', G, scope: 'country', iso, level: 1, title: 'Mexico', unit: 'states', codeWidth: 2, areas: G.feats.map(f => ({ id: f.props.c, name: f.props.n, code: f.props.c, iso: f.props.i, alt: (f.props.a || []).concat(E.ML_ALIAS[f.props.i] || []) })) };
    }
    const A1 = this.mlLoad('a1'); if (!A1) return { wait: !D.a1Err, error: D.a1Err };
    const C = A1.c[iso]; if (!C) return { error: 'There is no built-in map for this country yet.' };
    const G = this.memo('mlG|' + iso + '|1', () => E.mlFromTopo(C.t, 'a'));
    return { key: iso + '|1', G, scope: 'country', iso, level: 1, title: this.mlCountryNames()[iso] || C.cn || iso, unit: E.mlLevelName(iso, 1, C.lv).toLowerCase(), codeWidth: iso === 'USA' ? 2 : 0, lic: C.lic, areas: G.feats.map(f => ({ id: f.props.i || f.props.n, name: f.props.n, iso: f.props.i, code: f.props.c, alt: f.props.a || [] })) };
  }
  // distinct values of the place column (and of the larger-area column, when municipality names repeat across states)
  mlValues(col, col2) {
    return this.memo('mlV|' + col + '|' + (col2 || '') + '|' + (this.state.dver || 0), () => {
      const E = this._E, cv = this.vals(col); if (!cv) return [];
      const c2 = col2 ? this.vals(col2) : null, lab2 = col2 ? (this.groupLab(col2) || []) : null, cnt = new Map();
      for (let i = 0; i < cv.a.length; i++) {
        let x = cv.a[i]; if (cv.kind === 'num') { if (!isFinite(x)) continue; x = E.numLab(x); } else if (x == null || x === '') continue;
        let id = String(x), par = null; if (c2) { const y = lab2[i]; if (y == null || y === '') continue; par = String(y); id += '\u0001' + par; }
        const e = cnt.get(id); if (e) e.n++; else cnt.set(id, { id, key: String(x), parent: par, n: 1 });
      }
      return [...cnt.values()].map(v => Object.assign(v, { label: cv.kind === 'num' ? String(this.vlabel(col, v.key)) : null })).sort((a, b) => b.n - a.n);
    });
  }
  mlLapop() { return { 1: 'Mexico', 2: 'Guatemala', 3: 'El Salvador', 4: 'Honduras', 5: 'Nicaragua', 6: 'Costa Rica', 7: 'Panama', 8: 'Colombia', 9: 'Ecuador', 10: 'Bolivia', 11: 'Peru', 12: 'Paraguay', 13: 'Chile', 14: 'Uruguay', 15: 'Brazil', 16: 'Venezuela', 17: 'Argentina', 21: 'Dominican Republic', 22: 'Haiti', 23: 'Jamaica', 24: 'Guyana', 25: 'Trinidad and Tobago', 26: 'Belize', 27: 'Suriname', 28: 'Bahamas', 29: 'Barbados', 30: 'Grenada', 40: 'United States', 41: 'Canada' }; }
  // match the values to the areas: { pick: Map(value id → [feature index]), how, unmatched, codesRejected }
  mlMatchSel(sel, c) {
    const col = this.mlId(c); if (!col || !this.effMeta(col)) return null;
    const E = this._E, user = ((c.match || {})[col]) || {}, vals = this.mlValues(col, sel.unit === 'municipalities' ? c.id2 : '');
    return this.memo('mlM|' + sel.key + '|' + col + '|' + (c.id2 || '') + '|' + JSON.stringify(user) + '|' + (this.state.dver || 0), () => {
      if (sel.scope === 'world') { // country names and codes in any common form (ISO, numbers, Spanish names), LAPOP codes
        const pick = new Map(), how = new Map(), unmatched = [], L = this.mlLapop(), byName = new Map(sel.G.feats.map(f => [String(f.props.name), f.i]));
        const lapop = vals.filter(v => /^\d+$/.test(v.key) && L[+v.key]).length >= 0.8 * vals.length && vals.every(v => v.label === v.key);
        for (const v of vals) {
          const u = user[v.id]; if (u && u.length) { const ix = u.map(x => byName.get(x)).filter(x => x != null); if (ix.length) { pick.set(v.id, ix); how.set(v.id, 'user'); continue; } }
          let fi = -1; const W = sel.world; if (lapop) fi = E.mapMatch(W, L[+v.key]); if (fi < 0 && v.label && v.label !== v.key) fi = E.mapMatch(W, v.label); if (fi < 0) fi = E.mapMatch(W, v.key);
          if (fi >= 0) { pick.set(v.id, [fi]); how.set(v.id, lapop ? 'code' : 'name'); } else unmatched.push(v.id);
        }
        return { pick, how, unmatched, codesRejected: 0, values: vals };
      }
      const uIds = {}; for (const [k, list] of Object.entries(user)) uIds[k] = list;
      const r = E.mlMatch(vals, sel.areas.map(a => Object.assign({}, a)), { codeWidth: sel.codeWidth || 0, user: uIds });
      return Object.assign(r, { values: vals });
    });
  }
  // which column names the place, and which map fits it: tried on every column with a manageable number of values
  mlDetect() {
    const D = this._mlD || {}; if (!D.a1 || !D.mx || !D.world) return null;
    return this.memo('mlDetect|' + (this.state.dver || 0) + '|' + (this.state.cols || []).length, () => {
      // only columns that can name a place: text, whole numbers with few values, or a place-like name (ent, ubica_geo, country…)
      const PL = /ent|edo|estado|state|prov|region|depart|aimag|oblast|prefect|county|mun|ubica|geo|pais|país|country|nation|iso|cname|idenpa|distr|canton|comuna|parish/i;
      const E = this._E, cols = (this.state.cols || []).filter(v => { const m = this.effMeta(v.name); if (!m || (m.distinct || 0) < 2 || (m.distinct || 0) > 3000) return false; const cv = this.vals(v.name); if (!cv) return false; if (cv.kind !== 'num') return true; if (PL.test(v.name)) return true; if ((m.distinct || 0) > 300) return false; for (let i = 0; i < cv.a.length; i += Math.max(1, Math.floor(cv.a.length / 400))) { const x = cv.a[i]; if (isFinite(x) && !Number.isInteger(x)) return false; } return true; });
      const nameIdx = this.memo('mlNameIdx', () => { const ix = new Map(); for (const [iso, C] of Object.entries(D.a1.c)) for (const g of C.t.objects.a.geometries) for (const n of [g.p.n, ...(g.p.a || [])]) { const k = E.mlNorm(n); if (!k) continue; if (!ix.has(k)) ix.set(k, new Set()); ix.get(k).add(iso); } for (const g of D.mx.objects.states.geometries) for (const n of [g.p.n, ...(g.p.a || []), ...(E.ML_ALIAS[g.p.i] || [])]) { const k = E.mlNorm(n); if (!ix.has(k)) ix.set(k, new Set()); ix.get(k).add('MEX'); } return ix; });
      const ST = /^(cve_?)?(ent|entidad|edo|estado)(_|$)|^state|^provinc|^region|^depart|^aimag|^oblast|^prefect|^county/i, MU = /^(cve_?)?(mun|municipio|ubica_geo|cvegeo|cve_mun)/i, CO = /^(country|pais|país|cname|iso|nation|cntry|countryname|idenpa|pais_nombre)/i;
      let best = null; const consider = r => { if (!best || r.score > best.score) best = r; };
      for (const v of cols) {
        const vals = this.mlValues(v.name, ''); if (!vals.length) continue; const tot = vals.reduce((t, x) => t + x.n, 0);
        const share = r => { let m = 0; for (const x of vals) if (r.pick.has(x.id)) m += x.n; return m / tot; };
        const nm = v.name, bonusS = ST.test(nm) ? 0.15 : 0, bonusM = MU.test(nm) ? 0.15 : 0, bonusC = CO.test(nm) ? 0.15 : 0;
        // Mexico states and municipalities (INEGI codes or names)
        const s1 = this.mlSel({ scope: 'country', country: 'MEX', level: 1 }), r1 = vals.length <= 40 ? E.mlMatch(vals, s1.areas, { codeWidth: 2, fuzzy: false }) : { pick: new Map(), how: new Map() }, f1 = share(r1);
        const onlyCodes = [...r1.how.values()].every(x => x === 'code'); if (f1 >= 0.6 && vals.length <= 40 && (bonusS || !onlyCodes || vals.length >= 20)) consider({ score: f1 + bonusS, scope: 'country', country: 'MEX', level: 1, id: nm, share: f1, n: vals.length });
        if (vals.length > 40 || bonusM) { const s2 = this.mlSel({ scope: 'country', country: 'MEX', level: 2 }), r2 = E.mlMatch(vals, s2.areas, { codeWidth: 5, fuzzy: false }), f2 = share(r2); if (f2 >= 0.6) consider({ score: f2 + bonusM - 0.1, scope: 'country', country: 'MEX', level: 2, id: nm, share: f2, n: vals.length }); }
        // countries of the world
        const W = D.world; let wm = 0; for (const x of vals) { const fi = E.mapMatch(W, x.label && x.label !== x.key ? x.label : x.key); if (fi >= 0) wm += x.n; } const fw = wm / tot;
        if (fw >= 0.6 && !/^\d+$/.test(vals[0].key)) consider({ score: fw + bonusC - 0.02, scope: 'world', id: nm, share: fw, n: vals.length });
        // states and provinces of any country, by name
        const votes = new Map(); for (const x of vals) { const t = x.label && x.label !== x.key ? x.label : x.key; if (/^\d+$/.test(t)) continue; const set = nameIdx.get(E.mlNorm(t)); if (set) for (const iso of set) votes.set(iso, (votes.get(iso) || 0) + x.n); }
        let bi = null, bv = 0; for (const [iso, n] of votes) if (n > bv) { bv = n; bi = iso; }
        if (bi && bv / tot >= 0.5) consider({ score: bv / tot + bonusS - 0.01, scope: 'country', country: bi, level: 1, id: nm, share: bv / tot, n: vals.length });
      }
      return best;
    });
  }
  // one value per area: mean, %, sum, count or median of a variable, with the weight, for one year, in the rows in use
  mlAgg(sel, c, M) {
    const E = this._E, col = this.mlId(c), st = c.stat || 'mean', S = this.state;
    return this.memo('mlA|' + sel.key + '|' + JSON.stringify([col, c.id2, st, c.y, c.level1, c.wt, c.yearVar, c.year, c.match && c.match[col]]) + '|' + this.filterSig() + '|' + (S.weightVar || '') + '|' + (S.dver || 0), () => {
      const nF = sel.G.feats.length, sw = new Float64Array(nF), swy = new Float64Array(nF), nn = new Float64Array(nF), med = st === 'median' ? Array.from({ length: nF }, () => []) : null;
      const cv = this.vals(col), y = st === 'count' ? null : this.nvA(c.y), w = c.wt !== false && S.weightVar ? this.wArr() : null, mask = this.mask();
      const yr = c.yearVar && c.year !== '' && c.year != null && c.year !== 'all' ? this.nvA(c.yearVar) : null, yv = yr ? +c.year : NaN, lev = c.level1 != null && c.level1 !== '' ? +c.level1 : 1;
      const two = sel.unit === 'municipalities' && c.id2 ? (this.groupLab(c.id2) || []) : null;
      const memoKey = new Map(); const areasOf = i => { let x = cv.a[i]; if (cv.kind === 'num') { if (!isFinite(x)) return null; } else if (x == null || x === '') return null; if (two) { const p = two[i]; if (p == null || p === '') return null; const id = (cv.kind === 'num' ? E.numLab(x) : String(x)) + '\u0001' + p; return M.pick.get(id) || null; } let r = memoKey.get(x); if (r === undefined) { r = M.pick.get(cv.kind === 'num' ? E.numLab(x) : String(x)) || null; memoKey.set(x, r); } return r; };
      let used = 0, rows = 0, noPlace = 0, noValue = 0;
      for (let i = 0; i < cv.a.length; i++) {
        if (mask && !mask[i]) continue; if (yr && yr[i] !== yv) continue; rows++;
        const wi = w ? w[i] : 1; if (!(wi > 0)) continue;
        const A = areasOf(i); if (!A) { noPlace++; continue; }
        let v = 1; if (y) { v = y[i]; if (!(typeof v === 'number' && isFinite(v))) { noValue++; continue; } if (st === 'pct') v = v === lev ? 1 : 0; }
        used++; for (const fi of A) { sw[fi] += wi; swy[fi] += wi * v; nn[fi]++; if (med) med[fi].push(v); }
      }
      const values = new Float64Array(nF).fill(NaN);
      for (let fi = 0; fi < nF; fi++) { if (!nn[fi]) continue; values[fi] = st === 'mean' ? swy[fi] / sw[fi] : st === 'pct' ? 100 * swy[fi] / sw[fi] : st === 'sum' ? swy[fi] : st === 'count' ? (w ? sw[fi] : nn[fi]) : (() => { const a = med[fi].sort((p, q) => p - q), m = a.length; return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2; })(); }
      return { values: Array.from(values), n: Array.from(nn), used, rows, noPlace, noValue, weighted: !!w, maxN: Math.max(0, ...nn) };
    });
  }
  // names picked by hand for numbers become value labels (as Stata's label define), so every table and chart uses them;
  // entries: [[value id, [area ids]]] — a pasted list is saved in one update
  mlRemember(col, entries, sel) {
    const raw = this._raw, idx = this.colIdx(col), isNum = idx >= 0 && raw.cols[idx].k === 'n';
    const user = Object.assign({}, (this.cbC().match || {})[col] || {}), labs = [];
    for (const [key, areas] of entries) { if (areas.length) user[key] = areas; else delete user[key]; const names = areas.map(id => (sel.areas.find(a => a.id === id) || {}).name).filter(Boolean); if (isNum && names.length === 1 && /^-?\d+(\.\d+)?$/.test(key)) labs.push([key, names[0]]); }
    this.csSet({ match: Object.assign({}, this.cbC().match, { [col]: user }) });
    if (labs.length) {
      this.snap('label ' + col); raw.vlabs = raw.vlabs || {}; const mp = new Map(raw.vlabs[col] instanceof Map ? raw.vlabs[col] : []); labs.forEach(([k, n]) => mp.set(+k, n)); raw.vlabs[col] = mp;
      this.rememberLabels([col]); this.clearMemo(); this.setState(s => ({ dver: (s.dver || 0) + 1 }));
      labs.forEach(([k, n]) => this.stataLog('label define ' + col + '_lb ' + k + ' "' + n.replace(/"/g, "'") + '", modify')); this.stataLog('label values ' + col + ' ' + col + '_lb');
    }
  }
  mlPaste(text, sel, c) { // lines "code, name" (tab, comma or semicolon) from a codebook
    const E = this._E, lines = String(text || '').split(/\r?\n/).map(l => l.split(/\t|;|,/).map(x => x.trim())).filter(p => p.length >= 2 && p[0] !== '' && p[1] !== '');
    const entries = [], bad = [];
    for (const p of lines) { const code = String(p[0]).replace(/\.0+$/, ''), name = p.slice(1).join(', '); const r = E.mlMatch([{ key: name }], sel.areas, { codesFirst: false }); const fi = r.pick.get(name); if (fi && fi.length) entries.push([code, [sel.areas[fi[0]].id]]); else bad.push(name); }
    if (entries.length) this.mlRemember(this.mlId(c), entries, sel);
    this.setState({ mlPasteMsg: entries.length + ' matched' + (bad.length ? ' · not recognised: ' + bad.slice(0, 6).join(', ') + (bad.length > 6 ? '…' : '') : '') });
  }
  mlFileRead(file) {
    if (!file) return; const r = new FileReader(), E = this._E;
    r.onload = () => { try { const j = JSON.parse(String(r.result)); const G = j.type === 'Topology' ? E.mlFromTopo(j) : E.mlFromGeoJSON(j); const props = [...new Set(G.feats.flatMap(f => Object.keys(f.props || {})))]; this._mlFile = { name: file.name.replace(/\.(geo|topo)?json$/i, ''), G, props }; this.cbSet({ fileName: file.name, fileKey: props[0] || '' }); this.clearMemo(); } catch (e) { this.flash('This file could not be read as GeoJSON or TopoJSON: ' + e.message); } };
    r.readAsText(file);
  }

  mlRender() {
    const h = React.createElement, S = this.state, E = this._E, c = this.cbC(), D = this._mlD || (this._mlD = {});
    ['world', 'a1', 'mx'].forEach(w => this.mlLoad(w));
    // first visit: pick the map and the column from the data
    if (!this.mlId(c) && !c._auto && this.mlScope(c) !== 'file') { const d = this.mlDetect(); if (d) setTimeout(() => this.cbSet(Object.assign({ _auto: 1, scope: d.scope, id: d.id }, d.scope === 'country' ? { country: d.country, level: d.level } : {}, c.y ? {} : this.mlDefaults(d))), 0); }
    const scope = this.mlScope(c), sel = this.mlSel(c);
    const top = h('div', { className: 'cb-top' }, h('button', { type: 'button', className: 'tl-link', onClick: () => this.csOpen('__gallery') }, '← All charts'), h('h2', null, 'Map'), h('span', { className: 'tl-hint' }, 'Built in, no internet needed: the world, every country’s states or provinces, and Mexico’s municipalities.'));
    const seg = (k, opts, def, aria) => this.tlSeg(opts, c[k] != null ? c[k] : def, v => this.cbSet({ [k]: v }), { 'aria-label': aria });
    const where = [this.tlField('Map of', this.tlSeg([['country', 'A country (its states, provinces…)'], ['world', 'The world'], ['file', 'My own boundary file']], scope, v => this.cbSet({ scope: v }), { 'aria-label': 'Map of' }))];
    if (scope === 'country') {
      const list = this.mlCountries(), cur = list.find(x => x.iso === (c.country || 'MEX'));
      where.push(this.tlField('Country', this.tlSelect(c.country || 'MEX', list.length ? list.map(x => [x.iso, x.name]) : [['MEX', 'Mexico']], v => this.cbSet({ country: v, level: 1, focus: '' }), 'Country', { className: 'tl-select ml-country' })));
      if (cur) where.push(this.tlField('Areas', this.tlSeg(cur.levels.map(l => [String(l.level), l.name + ' · ' + l.count.toLocaleString('en-US')]), String(c.level || 1), v => this.cbSet({ level: +v, focus: '' }), { 'aria-label': 'Areas' })));
      if ((c.country || 'MEX') === 'MEX' && +(c.level || 1) === 2 && sel.parentNames) where.push(this.tlField('Only in', this.tlSelect(c.focus || '', [['', 'All of Mexico']].concat(Object.entries(sel.parentNames).sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => [k, n])), v => this.cbSet({ focus: v }), 'Only in')));
    } else if (scope === 'world') where.push(this.tlField('Part of the world', seg('region', [['', 'Whole world'], ['africa', 'Africa'], ['europe', 'Europe'], ['asia', 'Asia'], ['namerica', 'USA & Canada'], ['latam', 'Latin America'], ['oceania', 'Oceania']], '', 'Part of the world')));
    else where.push(this.tlField('Boundary file (GeoJSON or TopoJSON)', h('input', { type: 'file', accept: '.json,.geojson,.topojson', onChange: e => this.mlFileRead(e.target.files && e.target.files[0]), 'aria-label': 'Boundary file' })), this._mlFile ? this.tlField('Which property names each area?', this.tlSelect(sel.fileKey || '', this._mlFile.props.map(p => [p, p + ' (e.g. ' + String((this._mlFile.G.feats[0].props || {})[p] ?? '').slice(0, 24) + ')']), v => this.cbSet({ fileKey: v }), 'Area name property')) : null);
    const panel = (title, ...kids) => h('section', { className: 'tl-panel ml-sec' }, h('h3', { className: 'ml-h' }, title), ...kids);
    const body = [top, panel('1 · Where', h('div', { className: 'cb-fields' }, ...where.filter(Boolean)))];
    if (sel.wait) { body.push(this.tlBanner('info', 'Loading the map…')); return h('div', { className: 'tl cb ml' }, ...body); }
    if (sel.error) { body.push(this.tlBanner('warn', 'The map could not be loaded: ' + sel.error)); return h('div', { className: 'tl cb ml' }, ...body); }
    if (sel.needFile) { body.push(this.tlBanner('info', 'Choose a boundary file (GeoJSON or TopoJSON, for example from your statistics office). Nothing is uploaded: the file is read on this computer.')); return h('div', { className: 'tl cb ml' }, ...body); }
    // 2 · the column that names the place
    const cols = (S.cols || []).filter(v => { const m = this.effMeta(v.name); return m && (m.distinct || 0) <= 5000; });
    const M = this.mlMatchSel(sel, c), vals = M ? M.values : [];
    const tot = vals.reduce((t, x) => t + x.n, 0), okRows = M ? vals.filter(x => M.pick.has(x.id)).reduce((t, x) => t + x.n, 0) : 0;
    const matchedAreas = M ? new Set([...M.pick.values()].flat()).size : 0;
    const how = M ? [...new Set([...M.how.values()])] : [];
    const howTxt = how.includes('code') ? (sel.iso === 'MEX' ? ' (INEGI codes)' : sel.iso === 'USA' ? ' (FIPS codes)' : ' (codes)') : how.includes('label') ? ' (value labels)' : how.includes('iso') ? ' (ISO codes)' : '';
    const placeF = [this.tlField('Which column says the place?', this.tlSelect(this.mlId(c) || '', [['', 'Pick a column…']].concat(cols.map(v => [v.name, v.name + (v.label ? ' — ' + String(v.label).slice(0, 40) : '')])), v => this.cbSet({ id: v }), 'Which column says the place?', { className: 'tl-select cb-vsel' }))];
    if (sel.unit === 'municipalities') placeF.push(this.tlField('State column (only if municipalities are written as names)', this.tlSelect(c.id2 || '', [['', 'Not needed']].concat(cols.map(v => [v.name, v.name])), v => this.cbSet({ id2: v }), 'State column')));
    const sec2 = [h('div', { className: 'cb-fields' }, ...placeF)];
    if (M) {
      const un = M.unmatched.length;
      sec2.push(h('p', { className: 'ml-found' + (un ? ' part' : ' ok') }, h('b', null, (vals.length - un).toLocaleString('en-US') + ' of ' + vals.length.toLocaleString('en-US')), ' values of ' + this.mlId(c) + ' recognised as ' + (sel.scope === 'world' ? 'countries' : sel.title + '’s ' + sel.unit) + howTxt + ' · ' + matchedAreas.toLocaleString('en-US') + ' of ' + sel.G.feats.length.toLocaleString('en-US') + ' areas have data' + (un ? ' · ' + Math.round(100 * (tot - okRows) / Math.max(1, tot)) + '% of rows not placed yet' : '')));
      if (M.codesRejected) sec2.push(this.tlBanner('info', 'Only ' + M.codesRejected + ' of these numbers look like official codes of this map, so none were used: the numbers seem to be the data’s own codes. Say once which place each number is, below.'));
      if (un || S.mlOpenMatch) sec2.push(this.mlMatchTable(sel, c, M));
      else sec2.push(h('button', { type: 'button', className: 'tl-link', onClick: () => this.setState({ mlOpenMatch: true }) }, 'Check or change the matching →'));
    }
    body.push(panel('2 · Your data', ...sec2));
    if (!M) { body.push(this.tlBanner('info', 'Pick the column that names or codes the place: a state, province, municipality or country (names, official codes like INEGI’s 01–32, or ISO codes).')); return h('div', { className: 'tl cb ml' }, ...body); }
    // 3 · what to show
    const st = c.stat || 'mean', numCols = this.cbNumeric(), yearC = (S.cols || []).filter(v => /^(year|anio|año|ano|periodo|period|wave|ronda|round)$/i.test(v.name));
    const show = [this.tlField('Show', this.tlSelect(st, [['pct', '% equal to 1 of'], ['mean', 'the mean of'], ['median', 'the median of'], ['sum', 'the total of'], ['count', 'the number of rows']], v => this.cbSet({ stat: v }), 'Show'))];
    if (st !== 'count') show.push(this.tlField('Variable', this.tlSelect(c.y || '', [['', 'Pick a variable…']].concat(numCols.map(v => [v.name, v.name + (v.label ? ' — ' + String(v.label).slice(0, 40) : '')])), v => this.cbSet({ y: v }), 'Variable', { className: 'tl-select cb-vsel' })));
    if (S.weightVar) show.push(h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: c.wt !== false, onChange: e => this.cbSet({ wt: e.target.checked }) }), 'Use the weight (' + S.weightVar + ')'));
    // surveys often call the weight factor, fac_hog, peso… (not picked automatically): offer it in one click
    const wGuess = !S.weightVar ? (S.cols || []).find(v => /^(factor|factor_?(exp|expansion|hog|per|viv)|fac_?(hog|viv|per|exp)?|peso|pesos|ponderador|pondera|expansion)$/i.test(v.name) && this.numVals(v.name)) : null;
    if (wGuess) show.push(h('div', { className: 'tl-row ml-wt' }, h('span', { className: 'tl-hint' }, wGuess.name + ' looks like the survey weight (expansion factor). Results are usually shown with it.'), this.tlBtn('Use ' + wGuess.name + ' as the weight', () => { this.clearMemo(); this.setState({ weightVar: wGuess.name, weightAuto: false }); this.cbSet({ wt: true }); })));
    const yv = c.yearVar != null ? c.yearVar : (yearC[0] ? yearC[0].name : '');
    show.push(this.tlField('Year', h('div', { className: 'tl-row' }, this.tlSelect(yv, [['', 'No year column']].concat((S.cols || []).filter(v => this.numVals(v.name)).map(v => [v.name, v.name])), v => this.cbSet({ yearVar: v, year: '' }), 'Year column'), yv ? this.tlSelect(String(c.year || ''), [['', 'Latest'], ['all', 'All years together']].concat(this.cbLevels(yv, 80).map(x => [x, x])), v => this.cbSet({ year: v }), 'Which year') : null)));
    body.push(panel('3 · What to show', h('div', { className: 'cb-fields' }, ...show)));
    if (st !== 'count' && !(c.y && this.numVals(c.y))) { body.push(this.tlBanner('info', 'Pick the variable to show on the map.')); return h('div', { className: 'tl cb ml' }, ...body); }
    // the map
    const years = yv ? this.cbLevels(yv, 400).map(Number).filter(isFinite) : [], year = !yv ? '' : c.year === 'all' ? 'all' : c.year ? c.year : String(years.length ? Math.max(...years) : '');
    const cc = Object.assign({}, c, { yearVar: yv, year });
    const A = this.mlAgg(sel, cc, M);
    const G = sel.G, fis = sel.unit === 'municipalities' && c.focus ? G.feats.filter(f => f.props.c.slice(0, 2) === c.focus).map(f => f.i) : null;
    const grp = (() => { const g = new Array(G.feats.length).fill(null); let any = false; for (const [k, list] of M.pick) if (list.length > 1) { any = true; list.forEach(fi => { g[fi] = k; }); } return any ? g : null; })();
    const valueTitle = st === 'count' ? (A.weighted ? 'Population (weighted)' : 'Number of rows') : ({ pct: '% where ' + c.y + ' = ' + (c.level1 || 1), mean: 'Mean of ' + c.y, median: 'Median of ' + c.y, sum: 'Total of ' + c.y }[st]);
    const microdata = A.maxN > 1, minN = c.minN != null && c.minN !== '' ? +c.minN : (microdata && st !== 'count' && st !== 'sum' ? 30 : 0);
    const model = { type: 'map', geo: G, scope: sel.scope, fis, values: A.values, n: A.n, names: G.feats.map(f => sel.scope === 'world' ? String(f.props.name || '') : (sel.areas[f.i] || {}).name || ''), codes: G.feats.map(f => (sel.areas[f.i] || {}).code || (sel.areas[f.i] || {}).iso || ''), parent: sel.unit === 'municipalities' ? G.feats.map(f => f.props.c.slice(0, 2)) : null, group: grp, valueTitle, pct: st === 'pct', region: sel.scope === 'world' && c.region ? E.MAP_REGIONS[c.region] : null };
    const one = u => /ies$/.test(u) ? u.replace(/ies$/, 'y') : /(ch|sh|x)es$/.test(u) ? u.replace(/es$/, '') : u.replace(/\s*\(.*\)$/, '').replace(/s$/, '');
    const auto = valueTitle + ' by ' + (sel.scope === 'world' ? 'country' : one(sel.unit)) + (sel.scope === 'country' && sel.title ? ', ' + sel.title : '') + (year && year !== 'all' ? ', ' + year : '');
    const src = [S.fileName ? String(S.fileName).replace(/\.[^.]+$/, '') : null, 'n = ' + A.used.toLocaleString('en-US'), A.weighted ? 'weighted by ' + S.weightVar : null, this.conds().length ? 'rows: ' + this.conds().map(q => this.condLabel(q)).join(' & ') : null, sel.scope === 'world' ? 'Boundaries: Natural Earth' : sel.iso === 'MEX' ? 'Boundaries: INEGI 2023' : sel.iso ? 'Boundaries: geoBoundaries' : null].filter(Boolean).join(' · ');
    const pal = E.CB_PALETTES[c.palette || 'sendero'] || E.CB_PALETTES.sendero, pal2 = c.palette ? pal : [S.chartColor || pal[0], ...pal.filter(x => x.toLowerCase() !== String(S.chartColor || pal[0]).toLowerCase())];
    const opt = { title: c.title || auto, subtitle: c.subtitle || undefined, source: c.source2 || src, palette: pal2, classes: c.classes || 'quantile', nClasses: +(c.nClasses || 5), breaks: c.breaks || '', scheme: c.scheme || 'chart', reverse: !!c.reverse, areaLabels: c.areaLabels || 'none', values: 'none', fmt: c.fmt || 'auto', decimals: c.decimals === '' || c.decimals == null ? null : +c.decimals, minN, legendTitle: c.legendTitle, parentBorders: c.parentBorders !== false, insets: c.insets !== false, size: c.size || 'auto', text: c.text || 'm', clipId: 'cbmap' };
    let sc; try { sc = E.cbScene(model, opt); } catch (e) { body.push(this.tlBanner('warn', 'The map could not be drawn: ' + e.message)); return h('div', { className: 'tl cb ml' }, ...body); }
    (this._plotName || (this._plotName = {}))['cb-map'] = opt.title;
    const notes = [A.noPlace ? A.noPlace.toLocaleString('en-US') + ' rows have a place that is not matched yet' : null, A.noValue ? A.noValue.toLocaleString('en-US') + ' rows have no value of ' + c.y : null, sc.notShown && sc.notShown.length ? 'Not shown (too far to draw): ' + sc.notShown.slice(0, 8).join(', ') : null, sc.hatched ? 'Hatched: fewer than ' + minN + ' observations' + (sel.unit === 'municipalities' ? ' — surveys are usually designed for state or national results, so municipal values are often unreliable' : '') : null].filter(Boolean);
    const fname = String(opt.title).replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'map';
    const shownF = (fis || G.feats.map(f => f.i)), rowsT = shownF.map(fi => [model.names[fi], model.codes[fi], A.values[fi], A.n[fi]]).sort((a, b) => (isFinite(b[2]) ? b[2] : -Infinity) - (isFinite(a[2]) ? a[2] : -Infinity));
    const tsv = ['Area\tCode\t' + valueTitle + '\tN'].concat(rowsT.map(r => [r[0], r[1], isFinite(r[2]) ? Math.round(r[2] * 1e4) / 1e4 : '', r[3] || 0].join('\t'))).join('\n');
    body.push(h('section', { className: 'tl-panel cb-figs' },
      h('figure', { className: 'cb-fig' }, h('svg', { viewBox: '0 0 ' + sc.width + ' ' + sc.height, role: 'img', 'aria-label': opt.title, ref: this.svgRef('cb-map'), dangerouslySetInnerHTML: { __html: sc.markup } }), this.tlExportRow('cb-map', fname)),
      notes.length ? h('p', { className: 'tl-hint cb-note' }, notes.join(' · ')) : null,
      h('details', { className: 'cb-table' }, h('summary', null, 'Data behind the map (' + rowsT.filter(r => isFinite(r[2])).length + ' areas with data)'), h('div', { className: 'tl-row' }, this.tlBtn(S.copied === 'mlt' ? 'Copied ✓' : 'Copy data (for Excel)', () => this.copyTSV('mlt', tsv))),
        h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-tbl' }, h('thead', null, h('tr', null, h('th', null, 'Area'), h('th', null, 'Code'), h('th', { className: 'n' }, valueTitle), h('th', { className: 'n' }, 'N'))), h('tbody', null, rowsT.slice(0, 600).map((r, i) => h('tr', { key: i }, h('td', { className: 'w' }, r[0]), h('td', null, r[1]), h('td', { className: 'n' }, isFinite(r[2]) ? this.fmt(r[2]) : '—'), h('td', { className: 'n' }, r[3] ? r[3].toLocaleString('en-US') : '—')))))))));
    body.push(this.mlCustomize(c, sel, minN, microdata));
    return h('div', { className: 'tl cb ml' }, ...body);
  }
  mlDefaults(d) { // what to show first: the % of a 0/1 variable when there is one (poverty), with the weight
    const S = this.state, num = this.cbNumeric().map(v => v.name), bin = num.filter(n => { const m = this.effMeta(n); return m && m.distinct === 2 && n !== d.id; });
    const pref = ['pobreza', 'pobreza_e', 'poverty', 'pobre'].find(n => bin.includes(n)) || bin[0];
    return pref ? { stat: 'pct', y: pref } : { stat: 'count' };
  }
  // the matching table: each value not recognised (or all, when asked) with a list of the areas
  mlMatchTable(sel, c, M) {
    const h = React.createElement, S = this.state, col = this.mlId(c), gm = !!((c.gmode || {})[col]);
    const opts = [['', '— not on the map —']].concat(sel.areas.map(a => [a.id, a.name + (a.parentName ? ' (' + a.parentName + ')' : '') + (a.code && sel.unit !== 'countries' ? ' · ' + a.code : '')]).sort((a, b) => a[1].localeCompare(b[1])));
    const user = ((c.match || {})[col]) || {}, showAll = !!S.mlOpenMatch;
    const rows = M.values.filter(v => showAll || !M.pick.has(v.id)).slice(0, 300);
    const cur = v => (user[v.id] && user[v.id].length ? user[v.id] : (M.pick.get(v.id) || []).map(fi => sel.areas[fi] && sel.areas[fi].id)).filter(Boolean);
    const lbl = v => v.label && v.label !== v.key ? v.key + ' = ' + v.label : String(v.key).replace('\u0001', ' · ');
    return h('div', { className: 'ml-match' },
      h('div', { className: 'tl-row' }, h('b', null, M.unmatched.length ? 'Which place is each of these? (once — it is saved)' : 'How each value was matched'), h('span', { className: 'tl-hint' }, 'Each value is:'), this.tlSeg([['one', 'one area'], ['group', 'a group of areas']], gm ? 'group' : 'one', v => this.cbSet(cc => ({ gmode: Object.assign({}, cc.gmode, { [col]: v === 'group' }) })), { 'aria-label': 'Each value is' }),
        showAll ? h('button', { type: 'button', className: 'tl-link', onClick: () => this.setState({ mlOpenMatch: false }) }, 'Close') : null),
      h('div', { className: 'tl-tblwrap tall' }, h('table', { className: 'tl-tbl ml-mtbl' }, h('thead', null, h('tr', null, h('th', null, col), h('th', { className: 'n' }, 'Rows'), h('th', null, 'Place on the map'))),
        h('tbody', null, rows.map(v => { const picked = cur(v); return h('tr', { key: v.id }, h('td', { className: 'w' }, lbl(v)), h('td', { className: 'n' }, v.n.toLocaleString('en-US')),
          h('td', null, gm ? h('div', { className: 'tl-row' }, picked.map(id => this.tlChip((sel.areas.find(a => a.id === id) || {}).name + ' ×', true, () => this.mlRemember(col, [[v.id, picked.filter(x => x !== id)]], sel), { key: id })), this.tlSelect('', [['', '+ add an area']].concat(opts.slice(1)), id => { if (id) this.mlRemember(col, [[v.id, [...picked, id]]], sel); }, 'Add an area for ' + lbl(v), { className: 'tl-select ml-pick' }))
            : this.tlSelect(picked[0] || '', opts, id => this.mlRemember(col, [[v.id, id ? [id] : []]], sel), 'Place for ' + lbl(v), { className: 'tl-select ml-pick' })),
          M.how.get(v.id) === 'close' ? h('td', null, h('span', { className: 'tl-hint' }, 'close spelling')) : null); })))),
      h('details', { className: 'ml-paste' }, h('summary', null, 'Paste a list instead (code and name on each line, e.g. from the survey’s codebook)'),
        h('textarea', { className: 'tl-input', rows: 5, placeholder: '1, Arkhangai\n2, Bayan-Ölgii\n3, Bayankhongor', defaultValue: '', 'aria-label': 'Codes and names', ref: el => { this._mlPasteEl = el; } }),
        h('div', { className: 'tl-row' }, this.tlBtn('Use this list', () => this.mlPaste(this._mlPasteEl && this._mlPasteEl.value, sel, c)), S.mlPasteMsg ? h('span', { className: 'tl-hint' }, S.mlPasteMsg) : null)),
      h('span', { className: 'tl-hint' }, 'For number codes, the names you pick are saved as value labels, so tables and charts show them too, and they are remembered the next time a file has a column called ' + col + '.'));
  }
  mlCustomize(c, sel, minN, microdata) {
    const h = React.createElement, E = this._E, tab = c.mlTab || 'colors', set = p => this.cbSet(p);
    const seg = (key, opts, def, aria) => this.tlSeg(opts, c[key] != null ? String(c[key]) : def, v => set({ [key]: v }), { 'aria-label': aria });
    const txt = (key, label, ph) => this.tlField(label, this.tlText(c[key] || '', v => set({ [key]: v }), { k: 'ml|' + key, placeholder: ph, aria: label, width: 320 }));
    const tabs = h('div', { className: 'tl-subtabs', role: 'tablist', 'aria-label': 'Customize the map' }, [['colors', 'Colors'], ['labels', 'Labels'], ['map', 'Map']].map(([k, t]) => h('button', { key: k, type: 'button', role: 'tab', 'aria-selected': tab === k ? 'true' : 'false', className: tab === k ? 'on' : '', onClick: () => set({ mlTab: k }) }, t)));
    let body;
    if (tab === 'colors') body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, this.tlField('Colors by', seg('classes', [['quantile', 'Same number of areas per color'], ['equal', 'Equal steps'], ['jenks', 'Natural groups'], ['continuous', 'Smooth scale'], ['custom', 'My own cut points']], 'quantile', 'Colors by')),
        (c.classes || 'quantile') === 'custom' ? txt('breaks', 'Cut points (e.g. 20, 40, 60)', '20, 40, 60') : (c.classes === 'continuous' ? null : this.tlField('Number of colors', seg('nClasses', [['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7', '7']], '5', 'Number of colors')))),
      h('div', { className: 'tl-col' }, this.tlField('Color scheme', h('div', { className: 'tl-row' }, Object.keys(E.ML_SCHEMES).map(k => h('button', { key: k, type: 'button', className: 'tl-chip' + ((c.scheme || 'chart') === k ? ' on' : ''), 'aria-pressed': (c.scheme || 'chart') === k ? 'true' : 'false', onClick: () => set({ scheme: k }) }, { chart: 'Chart color', blues: 'Blues', oranges: 'Oranges', purples: 'Purples', reds: 'Reds', grays: 'Grays (print)', diverging: 'Two-sided' }[k])))),
        h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: !!c.reverse, onChange: e => set({ reverse: e.target.checked }) }), 'Darkest for the lowest values')));
    else if (tab === 'labels') body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, txt('title', 'Title', 'automatic'), txt('subtitle', 'Subtitle', 'optional'), txt('source2', 'Source line', 'automatic'), txt('legendTitle', 'Legend title', 'automatic')),
      h('div', { className: 'tl-col' }, this.tlField('On the map', seg('areaLabels', [['none', 'Nothing'], ['names', 'Area names'], ['values', 'Values'], ['both', 'Names and values']], 'none', 'On the map')),
        this.tlField('Number format', seg('fmt', [['auto', 'Automatic'], ['full', '17,500'], ['k', '17.5k']], 'auto', 'Number format')), this.tlField('Decimals', seg('decimals', [['', 'Auto'], ['0', '0'], ['1', '1'], ['2', '2']], '', 'Decimals'))));
    else body = h('div', { className: 'cb-pane' },
      h('div', { className: 'tl-col' }, sel.unit === 'municipalities' ? h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: c.parentBorders !== false, onChange: e => set({ parentBorders: e.target.checked }) }), 'Draw state borders') : null,
        sel.scope === 'country' ? h('label', { className: 'cb-check' }, h('input', { type: 'checkbox', checked: c.insets !== false, onChange: e => set({ insets: e.target.checked }) }), 'Show far-away parts in boxes (e.g. Alaska, Canary Islands)') : null,
        microdata ? txt('minN', 'Hatch areas with fewer observations than', String(minN || 30)) : null),
      h('div', { className: 'tl-col' }, this.tlField('Size', seg('size', [['auto', 'Automatic'], ['report', 'Report'], ['slide', 'Slide'], ['square', 'Square']], 'auto', 'Size')), this.tlField('Text size', seg('text', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']], 'm', 'Text size'))));
    return h('section', { className: 'tl-panel cb-custom' }, h('div', { className: 'cb-ctitle' }, h('h3', null, 'Customize')), tabs, body);
  }
