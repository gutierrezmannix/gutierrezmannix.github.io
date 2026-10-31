  // GM26 text lab begin
  // ===== Text analysis (Design A: Texts → Clean → Explore → Measure → Save), quanteda-style
  tlDefaults() {
    return {
      step: 'texts', sub: 'words', msub: 'dict', v: '', by: '', date: '', unit: 'row', mergeCase: true, code: false,
      rec: { url: 'remove', num: 'remove', emoji: 'remove', tag: 'keep', mention: 'keep', hyphen: 'keep', fold: true, langs: null, stopSource: 'snowball', extra: [], minLen: 2, forms: 'none', phrases: null, minDoc: 1, maxDocPct: 100 },
      wview: 'word', wn: 25, wchart: 'cloud', prev: 0,
      cloud: { split: '', view: 'each', gN: 4, gPick: [], same: true, colorBy: 'bands', basis: 'count', bands: null, one: '#2E7D58', max: 80, rotate: 0, shape: 'ellipse', font: 'Hanken Grotesk', seed: 1234 },
      key: { target: '', ref: '__rest', measure: 'chi2', min: 10, n: 12 },
      q: '', qOff: [], win: 6, sort: 'row',
      time: { what: 'search', unit: 'auto', measure: 'pct', order: 'auto', cat: '' },
      coll: { size: 2, min: 0 }, net: { n: 40, context: 'doc', minFreq: 0.5 },
      clu: { what: 'groups', byYear: true, weight: 'prop', dist: 'cosine', link: 'average', k: 4, orient: 'h', nWords: 60, nTexts: 200 },
      dict: [{ name: '', keys: '', off: [] }, { name: '', keys: '', off: [] }], dictOpen: {},
      sent: { pos: '', neg: '', valence: '' },
      top: { k: 10, method: 'lda', pool: 'none', iter: 2000, seed: 1234, labels: {}, min: null, maxPct: null, residual: 2 },
      nb: { y: '', prior: 'uniform', test: 20 }, scale: { method: 'wordfish', by: '', ref: {}, dir: '' },
      save: { count: true, any: true, p100: false, share: false, nwords: true, nkept: false, topic: false, shares: false, cluster: false, sent: false, nb: false, rows: 'all', prefix: 'd_' }
    };
  }
  tlS() {
    const d = this.tlDefaults(), s = this.state.tl || {}, o = Object.assign({}, d, s);
    for (const k of ['rec', 'cloud', 'key', 'time', 'coll', 'net', 'clu', 'sent', 'top', 'nb', 'scale', 'save']) o[k] = Object.assign({}, d[k], s[k] || {});
    return o;
  }
  tlSet(patch) { this.setState(st => { const cur = st.tl || {}; const p = typeof patch === 'function' ? patch(Object.assign(this.tlDefaults(), cur)) : patch; return { tl: Object.assign({}, cur, p) }; }); }
  tlSetIn(k, patch) { this.tlSet(cur => ({ [k]: Object.assign({}, this.tlDefaults()[k], cur[k] || {}, patch) })); }

  // ---- columns and sensible defaults
  tlTextCols() {
    const S = this.state, out = [];
    for (const m of S.cols || []) {
      if (m.type !== 'categorical') continue;
      const v = this.valsCore(m.name); if (!v || v.kind !== 'cat') continue;
      let n = 0, len = 0, words = 0; const step = Math.max(1, Math.floor(v.a.length / 400));
      for (let i = 0; i < v.a.length; i += step) { const s = v.a[i]; if (s == null) continue; n++; len += s.length; words += (s.match(/\S+/g) || []).length; }
      if (n) out.push({ name: m.name, avg: len / n, words: words / n, distinct: m.distinct || 0 });
    }
    return out.sort((a, b) => b.words - a.words);
  }
  tlGroupCols(exclude) {
    return (this.state.cols || []).filter(m => m.name !== exclude && (m.distinct || 0) >= 2 && (m.distinct || 0) <= 200).map(m => m.name);
  }
  tlAutoPick() {
    const T = this.tlS(), cols = this.state.cols || [], names = cols.map(c => c.name);
    const patch = {};
    if (!T.v || !names.includes(T.v)) {
      const tc = this.tlTextCols(); const byName = tc.find(c => /^(text|texto|tweet|content|contenido|body|speech|discurso|comment|comentario|mensaje|message|transcript|respuesta|answer)$/i.test(c.name));
      const pick = byName || tc.find(c => c.words >= 3) || tc[0]; if (pick) patch.v = pick.name;
    }
    if (T.by === '' && !this._tlByTouched) {
      const g = cols.find(c => c.name !== (patch.v || T.v) && (c.distinct || 0) >= 2 && (c.distinct || 0) <= 60 && /(author|autor|user|usuario|username|name|nombre|party|partido|speaker|orador|group|grupo|source|fuente)/i.test(c.name));
      if (g) patch.by = g.name;
    }
    if (T.date === '' && !this._tlDateTouched) {
      const d = cols.find(c => /(^|_)(date|fecha|created|created_at|time|timestamp|year|año|anio|day|dia)($|_)|created at/i.test(c.name));
      if (d) patch.date = d.name;
    }
    if (Object.keys(patch).length) { this._tlAuto = true; setTimeout(() => this.tlSet(patch), 0); }
  }

  // ---- corpus: tokenized once per text column (in the background worker)
  tlTexts(v) { const vv = this.valsCore(v); return vv ? vv.a : null; }
  // fingerprint of the text column: results survive unrelated data changes (e.g. adding variables)
  tlTextSig(v) {
    return this.memo('tlSig|' + v, () => { const a = this.tlTexts(v); if (!a) return '0'; let len = 0, hsh = 0; for (let i = 0; i < a.length; i++) { const s = a[i]; if (s == null) continue; len += s.length; if (i % 97 === 0) for (let j = 0; j < s.length; j += 7) hsh = (hsh * 31 + s.charCodeAt(j)) | 0; } return a.length + ':' + len + ':' + hsh; });
  }
  tlSentences(texts) {
    const out = [], row = [];
    texts.forEach((t, i) => { if (t == null || String(t).trim() === '') { out.push(null); row.push(i); return; } const parts = String(t).split(/(?<=[.!?…])\s+|\n\s*\n+/).filter(s => s.trim()); if (!parts.length) { out.push(null); row.push(i); } parts.forEach(p => { out.push(p); row.push(i); }); });
    return { texts: out, row: Int32Array.from(row) };
  }
  tlCorpus(T) {
    const E = this._E, v = T.v; if (!v || !this._raw) return null;
    const key = 'tlC|' + v + '|' + T.unit + '|' + this.tlTextSig(v);
    this._tlJobs = this._tlJobs || {};
    const J = this._tlJobs[key];
    if (J && J.status === 'done') return J.value;
    if (J && J.status === 'run') return { pending: true, p: J.p || 0, label: J.label };
    let texts = this.tlTexts(v); if (!texts) return null;
    let row = null;
    if (T.unit === 'sentence') { const sp = this.tlSentences(texts); texts = sp.texts; row = sp.row; }
    const finish = C => { C.row = row; C.texts = texts; C.key = key; this._tlJobs[key] = { status: 'done', value: C }; this.forceUpdate(); };
    if (texts.length < 3000) { finish(E.tlTokenize(texts)); return this._tlJobs[key].value; }
    this._tlJobs[key] = { status: 'run', p: 0, label: 'Reading ' + this.fmtN(texts.length) + (T.unit === 'sentence' ? ' sentences' : ' texts') };
    (async () => {
      let res = null;
      try { const job = await this.wkStart('tlTokenize', [texts], p => { this._tlJobs[key].p = p; }); if (job) { const r = await job.done; if (r.ok) res = r.v; } } catch (e) { res = null; }
      if (!res) res = E.tlTokenize(texts);
      finish(res);
    })();
    return { pending: true, p: 0, label: this._tlJobs[key].label };
  }
  tlRowOf(C, d) { return C.row ? C.row[d] : d; }
  tlLangs(T, C) {
    if (T.rec.langs && T.rec.langs.length) return T.rec.langs;
    const det = this.tlDetectLang(T, C); return det.langs;
  }
  tlDetectLang(T, C) {
    const key = 'tlLang|' + (C ? C.key : T.v);
    return this.memo(key, () => {
      const E = this._E, res = { langs: ['en'], from: '', share: 0, note: '' };
      const lc = (this.state.cols || []).find(c => /^(lang|language|idioma|lengua)$/i.test(c.name));
      if (lc) {
        const vv = this.valsCore(lc.name), cnt = new Map(); let n = 0;
        if (vv) for (const x of vv.a) { if (x == null) continue; const k = String(x).toLowerCase().slice(0, 2); if (E.TL_STOP_SNOWBALL[k]) { cnt.set(k, (cnt.get(k) || 0) + 1); } n++; }
        const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]);
        if (top.length && n) { res.langs = top.filter(([, c], i) => i === 0 || c / n >= 0.1).map(([k]) => k).slice(0, 2); res.from = lc.name; res.share = top[0][1] / n; res.n = n; res.top = top[0][1]; return res; }
      }
      if (!C || C.pending) return res;
      const sets = {}; for (const [k] of E.TL_LANGS) sets[k] = new Set(E.TL_STOP_SNOWBALL[k].split(' '));
      const hits = {}; let words = 0; const step = Math.max(1, Math.floor(C.tok.length / 40000));
      for (let i = 0; i < C.tok.length; i += step) { const t = C.tok[i]; if (C.kind[t] !== 1) continue; words++; const w = C.types[t]; for (const k in sets) if (sets[k].has(w)) hits[k] = (hits[k] || 0) + 1; }
      const top = Object.entries(hits).sort((a, b) => b[1] - a[1]);
      if (top.length) {
        // a second language counts only if words found in its list but not in the first language's list are common
        const L1 = top[0][0], uniq = {};
        for (let i = 0; i < C.tok.length; i += step) { const t = C.tok[i]; if (C.kind[t] !== 1) continue; const w = C.types[t]; if (sets[L1].has(w)) continue; for (const k in sets) if (k !== L1 && sets[k].has(w)) uniq[k] = (uniq[k] || 0) + 1; }
        const second = Object.entries(uniq).sort((a, b) => b[1] - a[1])[0];
        res.langs = [L1].concat(second && second[1] >= 0.15 * top[0][1] ? [second[0]] : []);
        res.from = 'text'; res.share = top[0][1] / Math.max(1, words);
      }
      return res;
    });
  }
  tlStemLang(T, C) { const ls = this.tlLangs(T, C); return ls.includes('es') ? 'es' : ls.includes('en') ? 'en' : ls[0]; }
  tlStemFn(lang) { const E = this._E; return lang === 'es' ? E.tlStemEs : lang === 'en' ? E.tlStemEn : null; }
  tlLemma(lang) {
    this._tlLem = this._tlLem || {};
    const L = this._tlLem[lang];
    if (L && L.status === 'done') return L.map;
    if (L) return null;
    const url = window.__resources && window.__resources['lemma_' + lang];
    if (!url) { this._tlLem[lang] = { status: 'done', map: null }; return null; }
    this._tlLem[lang] = { status: 'run' };
    (async () => {
      try {
        const blob = (window.__resourceBlobs && window.__resourceBlobs[url]) || await (await fetch(url)).blob();
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        const obj = JSON.parse(await new Response(stream).text()), map = new Map();
        for (const k in obj) { const v = obj[k]; map.set(k.toLowerCase(), Array.isArray(v) ? v[0] : v); }
        this._tlLem[lang] = { status: 'done', map };
      } catch (e) { this._tlLem[lang] = { status: 'done', map: null, err: String(e && e.message || e) }; }
      this._memo = {}; this.forceUpdate();
    })();
    return null;
  }
  tlRecipe(T, C) {
    const r = Object.assign({}, T.rec), langs = this.tlLangs(T, C);
    r.langs = langs; r.extra = r.extra || [];
    r.phrases = (r.phrases || []).map(p => typeof p === 'string' ? p.toLowerCase().split(/\s+/).filter(Boolean) : p);
    r.stemLang = this.tlStemLang(T, C);
    if (r.forms === 'lemma') r.lemma = this.tlLemma(r.stemLang);
    return r;
  }
  tlFT(T, C) {
    const R = this.tlRecipe(T, C);
    if (R.forms === 'lemma' && !R.lemma) { const L = this._tlLem && this._tlLem[R.stemLang]; if (!L || L.status !== 'done') return { pending: true, label: 'Loading the ' + R.stemLang + ' lemma table' }; }
    const sig = JSON.stringify(Object.assign({}, R, { lemma: R.lemma ? 1 : 0 }));
    return this.memo('tlF|' + C.key + '|' + sig + '|v', () => { const t0 = performance.now(); const FT = this._E.tlFeatures(C, R, this.tlStemFn(R.stemLang)); FT.ms = performance.now() - t0; FT.R = R; FT.sig = C.key + '|' + sig; return FT; });
  }
  // documents included by the IF subgroup bar
  tlMask(C) {
    const mk = this.mask(); if (!mk) return null;
    return this.memo('tlMask|' + C.key, () => { const n = C.off.length - 1, m = new Uint8Array(n); for (let d = 0; d < n; d++) m[d] = mk[this.tlRowOf(C, d)] ? 1 : 0; return m; });
  }
  tlCounts(FT, C, mask) {
    if (!mask) return { count: FT.count, docf: FT.docf, docs: C.docs, total: FT.total, order: FT.order };
    return this.memo('tlCnt|' + C.key + '|' + FT.sig, () => {
      const count = new Float64Array(FT.nF), docf = new Int32Array(FT.nF), seen = new Int32Array(FT.nF).fill(-1); let docs = 0, total = 0;
      for (let d = 0; d < FT.foff.length - 1; d++) { if (!mask[d] || C.blank[d]) continue; docs++; for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { const f = FT.ftok[i]; count[f]++; total++; if (seen[f] !== d) { seen[f] = d; docf[f]++; } } }
      const order = FT.order.filter(f => count[f] > 0).sort((a, b) => count[b] - count[a]);
      return { count, docf, docs, total, order };
    });
  }
  tlGroupsOf(T, C, varName) {
    if (!varName) return null;
    return this.memo('tlG|' + C.key + '|' + varName + '|' + T.mergeCase, () => {
      const vv = this.valsCore(varName); if (!vv) return null;
      const n = C.off.length - 1, vals = new Array(n);
      for (let d = 0; d < n; d++) { const r = this.tlRowOf(C, d); let x = vv.a[r]; if (vv.kind === 'num') x = isFinite(x) ? this.vlabel(varName, this._E.numLab(x)) : null; vals[d] = x; }
      return this._E.tlGroups(vals, T.mergeCase);
    });
  }
