// ---------- Text lab engine (quanteda-style) ----------
// Pure functions: no DOM, so every one can also run in the background worker.
// Pipeline (as quanteda): corpus → tokens → (compound phrases) → tokens_remove
// (stopwords, classes) → tokens_wordstem / lemma lookup → dfm → textstat_*,
// textmodel_*, and dictionary lookups on the uncompounded tokens.

// ---- accents: fold acute, grave, circumflex, diaeresis, ring, macron, breve,
// caron, dot and double-acute marks, but keep ñ (tilde) and ç (cedilla).
const TL_FOLD_KEEP = new Set([0x0303, 0x0327]);
export function tlFold(s) {
  s = String(s);
  if (!/[^\u0000-\u007f]/.test(s)) return s;
  const d = s.normalize('NFD'); let o = '';
  for (const ch of d) { const c = ch.codePointAt(0); if (c >= 0x0300 && c <= 0x036f && !TL_FOLD_KEEP.has(c)) continue; o += ch; }
  return o.normalize('NFC');
}

// ---- tokenizer
// kinds: 1 word, 2 #hashtag, 3 @mention, 4 link, 5 number, 6 emoji
export const TL_KIND = { word: 1, tag: 2, mention: 3, url: 4, num: 5, emoji: 6 };
const TL_TOKEN_RE = /(https?:\/\/[^\s<>"“”'‘’]+|www\.[^\s<>"“”'‘’]+)|((?<![\p{L}\p{M}\p{N}_@#])[#@](?=[\p{L}\p{M}\p{N}_]*[\p{L}\p{M}\p{N}])[\p{L}\p{M}\p{N}_]+)|([\p{L}\p{M}\p{N}]+(?:(?:[-'’@]|[.,:](?=\p{N}))[\p{L}\p{M}\p{N}]+)*)|(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|[\u{1F1E6}-\u{1F1FF}]{2})/gu;
const TL_BREAK_RE = /[.!?;:…\n\r]|\s[-–—]\s/;

export function tlTokenize(texts) {
  const n = texts.length, types = [], kind = [], map = new Map();
  let cap = 1 << 16, tok = new Int32Array(cap), st = new Int32Array(cap), en = new Int32Array(cap), brk = new Uint8Array(cap);
  const off = new Int32Array(n + 1), blank = new Uint8Array(n);
  let p = 0, docs = 0;
  const grow = () => { cap *= 2; const a = new Int32Array(cap); a.set(tok); tok = a; const b = new Int32Array(cap); b.set(st); st = b; const c = new Int32Array(cap); c.set(en); en = c; const d = new Uint8Array(cap); d.set(brk); brk = d; };
  for (let i = 0; i < n; i++) {
    off[i] = p;
    const t = texts[i];
    if (t == null || (typeof t === 'number' && !isFinite(t)) || String(t).trim() === '') { blank[i] = 1; continue; }
    const s = String(t).normalize('NFC'); docs++;
    TL_TOKEN_RE.lastIndex = 0;
    let m, last = 0, first = true;
    while ((m = TL_TOKEN_RE.exec(s))) {
      let w = m[0], k;
      if (m[1]) { k = 4; w = w.replace(/[.,;:!?)\]}>»”’'"]+$/, ''); }
      else if (m[2]) k = w[0] === '#' ? 2 : 3;
      else if (m[3]) k = /\p{L}/u.test(w) ? 1 : 5;
      else k = 6;
      const key = w.toLowerCase();
      let id = map.get(key);
      if (id === undefined) { id = types.length; types.push(key); kind.push(k); map.set(key, id); }
      if (p >= cap) grow();
      tok[p] = id; st[p] = m.index; en[p] = m.index + w.length;
      brk[p] = first || TL_BREAK_RE.test(s.slice(last, m.index)) ? 1 : 0;
      first = false; last = m.index + w.length; p++;
    }
  }
  off[n] = p;
  return { n, docs, types, kind: Uint8Array.from(kind), tok: tok.slice(0, p), start: st.slice(0, p), end: en.slice(0, p), brk: brk.slice(0, p), off, blank };
}

// ---- glob patterns (quanteda valuetype = "glob"): * any run, ? one character
function tlGlobRe(p) { return new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'u'); }
export function tlParsePatterns(str) {
  // "a, b c, "c d", -x"  → items; spaces inside an item make a phrase
  const out = []; const s = String(str || '').normalize('NFC');
  const re = /\s*(?:"([^"]*)"|([^,;\n]+))/g; let m;
  while ((m = re.exec(s))) {
    let raw = (m[1] != null ? m[1] : m[2]).trim(); if (!raw) continue;
    let neg = false; if (raw[0] === '-' && raw.length > 1 && m[1] == null) { neg = true; raw = raw.slice(1).trim(); }
    const parts = raw.toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.length) out.push({ src: (neg ? '-' : '') + parts.join(' '), neg, parts });
  }
  return out;
}

// stopword sets: folded so "mas"/"más" both match when accents are ignored
export function tlStopSet(langs, source, extra, fold) {
  const set = new Set(), globs = [];
  const tables = source === 'iso' ? TL_STOP_ISO : TL_STOP_SNOWBALL;
  for (const l of langs || []) for (const w of String((tables[l] || TL_STOP_SNOWBALL[l]) || '').split(' ')) if (w) set.add(fold ? tlFold(w) : w);
  for (const w0 of extra || []) { const w = String(w0).trim().toLowerCase(); if (!w) continue; if (/[*?]/.test(w)) globs.push(tlGlobRe(fold ? tlFold(w) : w)); else set.add(fold ? tlFold(w) : w); }
  return { has: w => set.has(w) || globs.some(g => g.test(w)), size: set.size + globs.length };
}

// ---- recipe → features
// recipe: { url:'remove', num:'remove', emoji:'remove', tag:'keep'|'word'|'remove', mention:'keep'|'remove',
//           hyphen:'keep'|'split', fold:bool, langs:[], stopSource:'snowball'|'iso', extra:[], minLen:2,
//           forms:'none'|'stem'|'lemma', stemLang:'es', lemma: Map|null, phrases:[[w,...],...],
//           minDoc: 0, maxDocPct: 100 }
export function tlFeatures(C, R, stemFn) {
  const fold = !!R.fold, F = s => fold ? tlFold(s) : s;
  const stop = tlStopSet(R.langs, R.stopSource, R.extra, fold);
  let types = C.types, kind = C.kind, tok = C.tok, off = C.off, brk = C.brk, start = C.start, end = C.end;
  // 1. split hyphens (types only; a split token becomes several tokens)
  if (R.hyphen === 'split' && types.some(t => t.indexOf('-') > 0)) {
    const map = new Map(types.map((t, i) => [t, i])), nt = types.slice(), nk = Array.from(kind), parts = types.map((t, i) => kind[i] === 1 && t.indexOf('-') > 0 ? t.split('-').filter(Boolean).map(x => { let id = map.get(x); if (id === undefined) { id = nt.length; nt.push(x); nk.push(/\p{L}/u.test(x) ? 1 : 5); map.set(x, id); } return id; }) : null);
    const T = [], B = [], S0 = [], E0 = [], O = new Int32Array(off.length);
    for (let d = 0; d < off.length - 1; d++) { O[d] = T.length; for (let i = off[d]; i < off[d + 1]; i++) { const ps = parts[tok[i]]; if (!ps) { T.push(tok[i]); B.push(brk[i]); S0.push(start[i]); E0.push(end[i]); } else ps.forEach((id, j) => { T.push(id); B.push(j ? 0 : brk[i]); S0.push(start[i]); E0.push(end[i]); }); } }
    O[off.length - 1] = T.length;
    types = nt; kind = Uint8Array.from(nk); tok = Int32Array.from(T); brk = Uint8Array.from(B); start = Int32Array.from(S0); end = Int32Array.from(E0); off = O;
  }
  // 2. compound phrases (before stopwords, as tokens_compound then tokens_remove)
  const phr = (R.phrases || []).filter(p => p.length > 1).map(p => p.map(x => F(x.toLowerCase())));
  let ctypes = types, ckind = kind, ctok = tok, coff = off, cbrk = brk;
  if (phr.length) {
    const ftypes = types.map(F), trie = new Map();
    phr.forEach((p, pi) => { let node = trie; for (const w of p) { if (!node.has(w)) node.set(w, new Map()); node = node.get(w); } node.set('$', pi); });
    const nt = types.slice(), nk = Array.from(kind), cid = new Map(), T = [], B = [], O = new Int32Array(off.length);
    for (let d = 0; d < off.length - 1; d++) {
      O[d] = T.length;
      for (let i = off[d]; i < off[d + 1];) {
        let node = trie, j = i, best = -1, bestPi = -1;
        while (j < off[d + 1] && (j === i || !brk[j]) && node.has(ftypes[tok[j]])) { node = node.get(ftypes[tok[j]]); j++; if (node.has('$')) { best = j; bestPi = node.get('$'); } }
        if (best > i + 1) {
          const label = Array.from(tok.subarray(i, best), t => types[t]).join(' ');
          let id = cid.get(label); if (id === undefined) { id = nt.length; nt.push(label); nk.push(7); cid.set(label, id); }
          T.push(id); B.push(brk[i]); i = best;
        } else { T.push(tok[i]); B.push(brk[i]); i++; }
      }
    }
    O[off.length - 1] = T.length;
    ctypes = nt; ckind = Uint8Array.from(nk); ctok = Int32Array.from(T); cbrk = Uint8Array.from(B); coff = O;
  }
  // 3. type → feature key (or removed)
  const nT = ctypes.length, fkey = new Array(nT), fdisp = new Array(nT), lemma = R.lemma || null;
  const minLen = R.minLen || 1;
  // spelling variants that differ only in accents share the most common written form,
  // so stems and lemmas are taken from the correctly accented word (economia → economía → econom)
  let canon = null;
  if (fold && R.forms && R.forms !== 'none') {
    const tc = new Float64Array(ctypes.length); for (let i = 0; i < ctok.length; i++) tc[ctok[i]]++;
    const best = new Map();
    for (let t = 0; t < ctypes.length; t++) { if (ckind[t] !== 1 && ckind[t] !== 2) continue; const w = ckind[t] === 2 ? ctypes[t].slice(1) : ctypes[t], f = tlFold(w), b0 = best.get(f); if (!b0 || tc[t] > b0[1] || (tc[t] === b0[1] && w.length && /[^\u0000-\u007f]/.test(w) && !/[^\u0000-\u007f]/.test(b0[0]))) best.set(f, [w, tc[t]]); }
    canon = w => { const b0 = best.get(tlFold(w)); return b0 ? b0[0] : w; };
  }
  const formOf = (w, t) => {
    const cw = canon ? canon(w) : w;
    if (R.forms === 'stem' && stemFn) { const st = stemFn(cw); fdisp[t] = F(st); return F(st); }
    if (R.forms === 'lemma' && lemma) { const l = lemma.get(cw) || lemma.get(w) || cw; fdisp[t] = l; return F(l); }
    return F(w);
  };
  for (let t = 0; t < nT; t++) {
    const k = ckind[t], w = ctypes[t];
    let key = null;
    if (k === 1) { const f = F(w); if ([...w].length >= minLen && !stop.has(f)) key = formOf(w, t); }
    else if (k === 2) { if (R.tag === 'keep') key = F(w); else if (R.tag === 'word') { const b = w.slice(1); if (!stop.has(F(b)) && [...b].length >= minLen) key = formOf(b, t); } }
    else if (k === 3) { if (R.mention === 'keep') key = F(w); }
    else if (k === 4) { if (R.url === 'keep') key = w; }
    else if (k === 5) { if (R.num === 'keep') key = w; }
    else if (k === 6) { if (R.emoji === 'keep') key = w; }
    else if (k === 7) key = w.split(' ').map(x => F(x)).join(' ');
    fkey[t] = key;
  }
  const fmap = new Map(), fid = new Int32Array(nT).fill(-1), fk = [], fkindArr = [], disp = [];
  for (let t = 0; t < nT; t++) { const key = fkey[t]; if (key == null) continue; let f = fmap.get(key); if (f === undefined) { f = fk.length; fmap.set(key, f); fk.push(key); disp.push(fdisp[t] || null); fkindArr.push(ckind[t] === 2 && R.tag === 'word' ? 1 : ckind[t]); } else if (fdisp[t] && !disp[f]) disp[f] = fdisp[t]; fid[t] = f; }
  // 4. cleaned token stream, counts, document frequencies, display labels
  const nF = fk.length, count = new Float64Array(nF), docf = new Int32Array(nF), seen = new Int32Array(nF).fill(-1), formCount = new Float64Array(nT);
  const nd = coff.length - 1, foff = new Int32Array(nd + 1), ftmp = new Int32Array(ctok.length), fbrk = new Uint8Array(ctok.length);
  let q = 0;
  for (let d = 0; d < nd; d++) {
    foff[d] = q; let gap = 1;
    for (let i = coff[d]; i < coff[d + 1]; i++) {
      const t = ctok[i], f = fid[t];
      if (cbrk[i]) gap = 1;
      if (f < 0) { gap = 1; continue; }
      ftmp[q] = f; fbrk[q] = gap; gap = 0; q++;
      count[f]++; if (seen[f] !== d) { seen[f] = d; docf[f]++; }
      formCount[t]++;
    }
  }
  foff[nd] = q;
  // trim rare / very common features (dfm_trim)
  let keep = null;
  const minDoc = Math.max(0, +R.minDoc || 0), maxPct = R.maxDocPct > 0 && R.maxDocPct < 100 ? R.maxDocPct : 100, nDocs = C.docs || 1;
  if (minDoc > 1 || maxPct < 100) {
    keep = new Uint8Array(nF); for (let f = 0; f < nF; f++) keep[f] = docf[f] >= minDoc && 100 * docf[f] / nDocs <= maxPct ? 1 : 0;
    let r = 0; const nfo = new Int32Array(nd + 1), nb = new Uint8Array(q), nt = new Int32Array(q);
    for (let d = 0; d < nd; d++) { nfo[d] = r; let gap = 1; for (let i = foff[d]; i < foff[d + 1]; i++) { if (fbrk[i]) gap = 1; const f = ftmp[i]; if (!keep[f]) { gap = 1; count[f]--; continue; } nt[r] = f; nb[r] = gap; gap = 0; r++; } }
    nfo[nd] = r;
    for (let f = 0; f < nF; f++) if (!keep[f]) { count[f] = 0; docf[f] = 0; }
    return tlFinishFeatures({ ctypes, ckind, fid, fk, fkindArr, disp, count, docf, formCount, ftok: nt.slice(0, r), fbrk: nb.slice(0, r), foff: nfo, keep, nDocs });
  }
  return tlFinishFeatures({ ctypes, ckind, fid, fk, fkindArr, disp, count, docf, formCount, ftok: ftmp.slice(0, q), fbrk: fbrk.slice(0, q), foff, keep, nDocs });
}
function tlFinishFeatures(o) {
  const nF = o.fk.length, best = new Float64Array(nF).fill(-1), label = o.fk.slice(), nforms = new Int32Array(nF);
  const acc = w => /[^\u0000-\u007f]/.test(w);
  for (let t = 0; t < o.fid.length; t++) { const c = o.formCount[t], f = o.fid[t]; if (!c || f < 0) continue; const w = o.ctypes[t]; nforms[f]++; if (c > best[f] || (c === best[f] && acc(w) && !acc(label[f]))) { best[f] = c; label[f] = w; } }
  const common = label.slice(); for (let f = 0; f < nF; f++) if (o.disp && o.disp[f]) label[f] = o.disp[f];
  const order = Array.from({ length: nF }, (_, i) => i).filter(f => o.count[f] > 0).sort((a, b) => o.count[b] - o.count[a] || (label[a] < label[b] ? -1 : 1));
  return { nF, key: o.fk, label, common, kind: Uint8Array.from(o.fkindArr), count: o.count, docf: o.docf, nforms, order, ftok: o.ftok, fbrk: o.fbrk, foff: o.foff, nDocs: o.nDocs, total: o.ftok.length, ctypes: o.ctypes, fid: o.fid, formCount: o.formCount };
}
// all written forms that make up one feature (for “+3 forms” tooltips)
export function tlFeatureForms(FT, f, max) {
  const out = []; for (let t = 0; t < FT.fid.length; t++) if (FT.fid[t] === f && FT.formCount[t] > 0) out.push([FT.ctypes[t], FT.formCount[t]]);
  return out.sort((a, b) => b[1] - a[1]).slice(0, max || 12);
}

// ---- groups (docvars): optional merge of values that differ only in capitals/spaces
export function tlGroups(vals, mergeCase) {
  const n = vals.length, g = new Int32Array(n).fill(-1), labels = [], idx = new Map(), cnt = [], variants = new Map();
  for (let i = 0; i < n; i++) {
    const v = vals[i]; if (v == null || (typeof v === 'number' && !isFinite(v)) || String(v).trim() === '') continue;
    const s = String(v).trim(), key = mergeCase ? s.toLocaleLowerCase().replace(/\s+/g, ' ') : s;
    let k = idx.get(key);
    if (k === undefined) { k = labels.length; idx.set(key, k); labels.push(s); cnt.push(0); variants.set(k, new Map()); }
    g[i] = k; cnt[k]++; const vm = variants.get(k); vm.set(s, (vm.get(s) || 0) + 1);
  }
  const merged = [];
  for (const [k, vm] of variants) { if (vm.size > 1) { const sorted = [...vm.entries()].sort((a, b) => b[1] - a[1]); labels[k] = sorted[0][0]; merged.push(sorted.map(([s, c]) => s + ' (' + c + ')')); } }
  return { g, labels, count: Int32Array.from(cnt), merged };
}

// per-group feature counts (dfm_group)
export function tlGroupCounts(FT, g, G, mask) {
  const out = Array.from({ length: G }, () => new Float64Array(FT.nF)), tot = new Float64Array(G), docs = new Int32Array(G);
  const nd = FT.foff.length - 1;
  for (let d = 0; d < nd; d++) { const k = g[d]; if (k < 0 || (mask && !mask[d])) continue; docs[k]++; const a = out[k]; for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { a[FT.ftok[i]]++; } tot[k] += FT.foff[d + 1] - FT.foff[d]; }
  return { counts: out, tot, docs };
}

// ---- keyness (textstat_keyness): target vs reference counts
function tlLgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (const v of c) s += v / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
function tlChisqP1(x) { if (!(x > 0)) return 1; return tlErfc(Math.sqrt(x / 2)); }
function tlErfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
function tlFisherP(a, b, c, d) {
  const n = a + b + c + d, r1 = a + b, c1 = a + c, lf = k => tlLgamma(k + 1);
  const lp = x => lf(r1) + lf(n - r1) + lf(c1) + lf(n - c1) - lf(n) - lf(x) - lf(r1 - x) - lf(c1 - x) - lf(n - r1 - c1 + x);
  const lo = Math.max(0, r1 + c1 - n), hi = Math.min(r1, c1), p0 = lp(a); let p = 0;
  for (let x = lo; x <= hi; x++) { const v = lp(x); if (v <= p0 + 1e-7) p += Math.exp(v); }
  return Math.min(1, p);
}
export function tlKeyness(tc, rc, opts) {
  opts = opts || {};
  const measure = opts.measure || 'chi2', minCount = opts.minCount ?? 10, nF = tc.length;
  let Tt = 0, Tr = 0; for (let f = 0; f < nF; f++) { Tt += tc[f]; Tr += rc[f]; }
  const N = Tt + Tr, rows = [];
  for (let f = 0; f < nF; f++) {
    const a = tc[f], b = rc[f]; if (a + b < minCount || a + b === 0) continue;
    const c = Tt - a, d = Tr - b, E11 = (a + b) * (a + c) / N;
    let stat, p;
    if (measure === 'lr') {
      const E = [E11, (a + b) * (b + d) / N, (c + d) * (a + c) / N, (c + d) * (b + d) / N], O = [a, b, c, d];
      let g2 = 0; for (let i = 0; i < 4; i++) if (O[i] > 0) g2 += O[i] * Math.log(O[i] / E[i]); g2 *= 2;
      const q = 1 + (N / (a + b) + N / (c + d) - 1) * (N / (a + c) + N / (b + d) - 1) / (6 * N);
      stat = g2 / q; p = tlChisqP1(stat); if (a < E11) stat = -stat;
    } else if (measure === 'pmi') {
      stat = Math.log(a * N / ((a + b) * (a + c))); p = NaN; if (!isFinite(stat)) continue;
    } else if (measure === 'exact') {
      stat = (a * d) / (b * c); p = tlFisherP(a, b, c, d); if (!isFinite(stat)) stat = a * d > 0 ? 1e9 : 0;
    } else {
      const num = Math.pow(Math.max(0, Math.abs(a * d - b * c) - N / 2), 2) * N, den = (a + b) * (c + d) * (a + c) * (b + d);
      stat = den ? num / den : 0; p = tlChisqP1(stat); if (a < E11) stat = -stat;
    }
    rows.push({ f, stat, p, a, b });
  }
  rows.sort((x, y) => y.stat - x.stat);
  return { rows, Tt, Tr };
}

// ---- collocations (textstat_collocations, method = "lambda"), n = 2 or 3
export function tlCollocations(C, opts) {
  opts = opts || {};
  const size = opts.size || 2, minCount = opts.minCount || 5, fold = !!opts.fold, stop = tlStopSet(opts.langs, opts.stopSource, opts.extra, fold), smooth = 0.5;
  const nT = C.types.length, isW = new Uint8Array(nT), isStop = new Uint8Array(nT);
  for (let t = 0; t < nT; t++) { isW[t] = C.kind[t] === 1 ? 1 : 0; isStop[t] = isW[t] && stop.has(fold ? tlFold(C.types[t]) : C.types[t]) ? 1 : 0; }
  const nd = C.off.length - 1, K = 4294967296;
  const key = arr => arr.reduce((s, x) => s * nT + x, 0);
  const full = new Map(), marg = Array.from({ length: (1 << size) }, () => new Map());
  let total = 0;
  for (let d = 0; d < nd; d++) {
    for (let i = C.off[d]; i + size <= C.off[d + 1]; i++) {
      let ok = true; for (let j = 0; j < size; j++) { if (!isW[C.tok[i + j]] || (j > 0 && C.brk[i + j])) { ok = false; break; } }
      if (!ok) continue;
      total++;
      const w = Array.from(C.tok.subarray(i, i + size));
      for (let mask = 1; mask < (1 << size); mask++) { let k = 0; for (let j = 0; j < size; j++) k = k * (nT + 1) + ((mask >> j) & 1 ? w[j] + 1 : 0); const m = marg[mask]; m.set(k, (m.get(k) || 0) + 1); }
      const k = key(w); full.set(k, (full.get(k) || 0) + 1);
    }
  }
  const out = [], full_mask = (1 << size) - 1;
  for (const [k, n] of full) {
    if (n < minCount) continue;
    const w = []; let r = k; for (let j = size - 1; j >= 0; j--) { w[j] = r % nT; r = Math.floor(r / nT); }
    if (isStop[w[0]] || isStop[w[size - 1]]) continue;
    const M = mask => { if (mask === 0) return total; let kk = 0; for (let j = 0; j < size; j++) kk = kk * (nT + 1) + ((mask >> j) & 1 ? w[j] + 1 : 0); return marg[mask].get(kk) || 0; };
    // exact cell counts by inclusion–exclusion, then λ = Σ (−1)^(size−|c|) log(n_c + ½)
    let lam = 0, inv = 0;
    for (let c = 0; c <= full_mask; c++) {
      let nc = 0;
      for (let T = c; T <= full_mask; T = (T + 1) | c) { const extra = popc(T) - popc(c); nc += (extra % 2 ? -1 : 1) * M(T); if (T === full_mask) break; }
      nc = Math.max(0, nc) + smooth;
      lam += ((size - popc(c)) % 2 ? -1 : 1) * Math.log(nc); inv += 1 / nc;
    }
    out.push({ words: w.map(t => C.types[t]), count: n, lambda: lam, z: lam / Math.sqrt(inv) });
  }
  out.sort((a, b) => b.z - a.z);
  return out;
  function popc(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }
}

// ---- dictionary lookup on uncompounded tokens (tokens_lookup, nested_scope = "key")
// cats: [{ name, keys: "…", off: Set(folded forms switched off) }]
export function tlCompileDict(C, cats, fold) {
  const F = s => fold ? tlFold(s) : s, nT = C.types.length, ftypes = C.types.map(F), body = ftypes.map((t, i) => C.kind[i] === 2 ? t.slice(1) : t);
  return cats.map(cat => {
    const pats = tlParsePatterns(cat.keys), inc = pats.filter(p => !p.neg), exc = pats.filter(p => p.neg);
    const offForms = new Set([...(cat.off || [])].map(F));
    const partMask = new Map();
    const maskOf = part => {
      if (partMask.has(part)) return partMask.get(part);
      const pp = F(part), m = new Uint8Array(nT), re = tlGlobRe(pp);
      for (let t = 0; t < nT; t++) {
        const k = C.kind[t]; if (k === 4 || k === 6) continue;
        if (pp[0] === '#') m[t] = k === 2 && re.test(ftypes[t]) ? 1 : 0;
        else if (pp[0] === '@') m[t] = k === 3 && re.test(ftypes[t]) ? 1 : 0;
        else m[t] = k !== 3 && re.test(body[t]) ? 1 : 0;
      }
      partMask.set(part, m); return m;
    };
    const excl = new Uint8Array(nT);
    for (const p of exc) if (p.parts.length === 1) { const m = maskOf(p.parts[0]); for (let t = 0; t < nT; t++) if (m[t]) excl[t] = 1; }
    for (let t = 0; t < nT; t++) if (offForms.has(body[t]) || offForms.has(ftypes[t])) excl[t] = 1;
    const singles = new Uint8Array(nT), phrases = [];
    for (const p of inc) {
      if (p.parts.length === 1) { const m = maskOf(p.parts[0]); for (let t = 0; t < nT; t++) if (m[t] && !excl[t]) singles[t] = 1; }
      else phrases.push({ src: p.src, masks: p.parts.map(maskOf), off: offForms.has(p.parts.map(F).join(' ')) });
    }
    const exPhrases = exc.filter(p => p.parts.length > 1).map(p => p.parts.map(maskOf));
    return { name: cat.name, pats, singles, phrases: phrases.filter(p => !p.off), exPhrases, excl, empty: !inc.length };
  });
}
export function tlLookup(C, compiled, opts) {
  opts = opts || {};
  const nd = C.off.length - 1, res = compiled.map(() => ({ counts: new Float64Array(nd), forms: new Map(), mentions: 0, docs: 0 }));
  for (let d = 0; d < nd; d++) {
    if (C.blank[d]) { for (const r of res) r.counts[d] = NaN; continue; }
    const a = C.off[d], b = C.off[d + 1];
    compiled.forEach((K, ci) => {
      if (K.empty) return;
      const r = res[ci]; let c = 0;
      for (let i = a; i < b;) {
        let L = 0;
        for (const ph of K.phrases) { const n = ph.masks.length; if (i + n > b) continue; let ok = true; for (let j = 0; j < n; j++) { if (!ph.masks[j][C.tok[i + j]]) { ok = false; break; } } if (ok && n > L) L = n; }
        if (L) { for (const ex of K.exPhrases) { const n = ex.length; if (n !== L) continue; let ok = true; for (let j = 0; j < n; j++) if (!ex[j][C.tok[i + j]]) { ok = false; break; } if (ok) { L = 0; break; } } }
        if (!L && K.singles[C.tok[i]]) L = 1;
        if (L) { c++; const form = L === 1 ? C.types[C.tok[i]] : Array.from(C.tok.subarray(i, i + L), t => C.types[t]).join(' '); r.forms.set(form, (r.forms.get(form) || 0) + 1); i += L; }
        else i++;
      }
      r.counts[d] = c; r.mentions += c; if (c > 0) r.docs++;
    });
  }
  return res;
}
// keyword-in-context (kwic) with the original text as context
export function tlKwic(C, texts, compiled, opts) {
  opts = opts || {};
  const win = opts.window || 6, limit = opts.limit || 200, out = [], nd = C.off.length - 1, K = compiled[0];
  let total = 0, docs = 0;
  if (!K || K.empty) return { rows: out, total, docs };
  const clean = s => s.replace(/\s+/g, ' ').trim();
  for (let d = 0; d < nd; d++) {
    if (C.blank[d] || (opts.mask && !opts.mask[d])) continue;
    const a = C.off[d], b = C.off[d + 1], s = String(texts[d]); let hit = false;
    for (let i = a; i < b;) {
      let L = 0;
      for (const ph of K.phrases) { const n = ph.masks.length; if (i + n > b) continue; let ok = true; for (let j = 0; j < n; j++) if (!ph.masks[j][C.tok[i + j]]) { ok = false; break; } if (ok && n > L) L = n; }
      if (!L && K.singles[C.tok[i]]) L = 1;
      if (!L) { i++; continue; }
      total++; hit = true;
      if (out.length < limit) {
        const lo = Math.max(a, i - win), hi = Math.min(b - 1, i + L - 1 + win);
        out.push({ doc: d, pre: clean(s.slice(C.start[lo], C.start[i])), kw: clean(s.slice(C.start[i], C.end[i + L - 1])), post: clean(s.slice(C.end[i + L - 1], C.end[hi])), pos: i - a });
      }
      i += L;
    }
    if (hit) docs++;
  }
  return { rows: out, total, docs };
}

// ---- dates for “over time”: ISO, d.m.y / m/d/y (order detected), month names (es/en), Twitter dates, years
const TL_MON = { jan: 1, ene: 1, enero: 1, january: 1, feb: 2, february: 2, febrero: 2, mar: 3, march: 3, marzo: 3, apr: 4, abr: 4, april: 4, abril: 4, may: 5, mayo: 5, jun: 6, june: 6, junio: 6, jul: 7, july: 7, julio: 7, aug: 8, ago: 8, august: 8, agosto: 8, sep: 9, sept: 9, set: 9, september: 9, septiembre: 9, setiembre: 9, oct: 10, october: 10, octubre: 10, nov: 11, november: 11, noviembre: 11, dec: 12, dic: 12, december: 12, diciembre: 12 };
export function tlParseDates(vals, order) {
  const n = vals.length, day = new Float64Array(n).fill(NaN), raw = [];
  const y2 = y => y < 100 ? (y <= 68 ? 2000 + y : 1900 + y) : y;
  const mk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31) ? Date.UTC(y, m - 1, d) / 86400000 : NaN;
  let aBig = 0, bBig = 0, numYears = 0, nonblank = 0, gran = 'day';
  for (let i = 0; i < n; i++) {
    const v = vals[i]; if (v == null || v === '' || (typeof v === 'number' && !isFinite(v))) { raw.push(null); continue; }
    nonblank++;
    if (typeof v === 'number') { if (Number.isInteger(v) && v >= 1000 && v <= 2200) { numYears++; raw.push({ y: v, m: 1, d: 1, g: 'year' }); } else raw.push(null); continue; }
    const s = String(v).trim(); let m;
    if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s))) raw.push({ y: +m[1], m: +m[2], d: +m[3] });
    else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:[ T,]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)?$/i.exec(s))) { const a = +m[1], b = +m[2]; if (a > 12) aBig++; if (b > 12) bBig++; raw.push({ a, b, y: y2(+m[3]), amb: true }); }
    else if ((m = /^(\d{4})[-/](\d{1,2})$/.exec(s)) || (m = /^(\d{4})m(\d{1,2})$/i.exec(s))) raw.push({ y: +m[1], m: +m[2], d: 1, g: 'month' });
    else if ((m = /^(\d{4})q([1-4])$/i.exec(s))) raw.push({ y: +m[1], m: 3 * (+m[2]) - 2, d: 1, g: 'quarter' });
    else if ((m = /^(\d{4})$/.exec(s))) raw.push({ y: +m[1], m: 1, d: 1, g: 'year' });
    else if ((m = /^(?:[a-z]{3},?\s+)?([a-záéíóú]+)\.?\s+(\d{1,2})(?:,)?\s+(?:\d{1,2}:\d{2}(?::\d{2})?\s+(?:[+-]\d{4}\s+)?)?(\d{4})/i.exec(s)) && TL_MON[tlFold(m[1]).toLowerCase()]) raw.push({ y: +m[3], m: TL_MON[tlFold(m[1]).toLowerCase()], d: +m[2] });
    else if ((m = /^(\d{1,2})(?:\s+de)?\s+([a-záéíóú]+)\.?,?(?:\s+de(?:l)?)?\s+(\d{2,4})/i.exec(s)) && TL_MON[tlFold(m[2]).toLowerCase()]) raw.push({ y: y2(+m[3]), m: TL_MON[tlFold(m[2]).toLowerCase()], d: +m[1] });
    else if ((m = /^([a-záéíóú]+)\.?(?:\s+de)?\s+(\d{4})$/i.exec(s)) && TL_MON[tlFold(m[1]).toLowerCase()]) raw.push({ y: +m[2], m: TL_MON[tlFold(m[1]).toLowerCase()], d: 1, g: 'month' });
    else if ((m = /^[a-z]{3}\s+([a-z]{3})\s+(\d{1,2})\s+\d{2}:\d{2}:\d{2}\s+[+-]\d{4}\s+(\d{4})$/i.exec(s)) && TL_MON[m[1].toLowerCase()]) raw.push({ y: +m[3], m: TL_MON[m[1].toLowerCase()], d: +m[2] });
    else { const t = Date.parse(s); raw.push(isFinite(t) ? { t } : null); }
  }
  const auto = aBig > 0 && !bBig ? 'dmy' : bBig > 0 && !aBig ? 'mdy' : null;
  const ord = order === 'dmy' || order === 'mdy' ? order : (auto || 'dmy');
  let ok = 0, ambiguous = false, yearOnly = 0, minD = Infinity, maxD = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = raw[i]; if (!r) continue;
    let v;
    if (r.t !== undefined) v = Math.floor(r.t / 86400000);
    else if (r.amb) { if (!auto) ambiguous = true; v = ord === 'dmy' ? mk(r.y, r.b, r.a) : mk(r.y, r.a, r.b); }
    else { v = mk(r.y, r.m, r.d); if (r.g === 'year') yearOnly++; }
    if (isFinite(v)) { day[i] = v; ok++; if (v < minD) minD = v; if (v > maxD) maxD = v; }
  }
  if (yearOnly === ok && ok) gran = 'year';
  return { day, ok, nonblank, order: ord, ambiguous: ambiguous && !order, autoOrder: auto, yearOnly: yearOnly === ok, min: minD, max: maxD, gran };
}
export function tlPeriod(dayNum, unit) {
  if (!isFinite(dayNum)) return null;
  const dt = new Date(dayNum * 86400000), y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1;
  if (unit === 'year') return { k: y, label: String(y) };
  if (unit === 'quarter') { const q = Math.ceil(m / 3); return { k: y * 4 + q - 1, label: y + ' Q' + q }; }
  if (unit === 'month') return { k: y * 12 + m - 1, label: y + '-' + String(m).padStart(2, '0') };
  if (unit === 'week') { const w = Math.floor((dayNum + 3) / 7); const s = new Date((w * 7 - 3) * 86400000); return { k: w, label: s.toISOString().slice(0, 10) }; }
  return { k: dayNum, label: dt.toISOString().slice(0, 10) };
}

// ---- text statistics per document (textstat_summary, textstat_lexdiv, textstat_readability)
function tlSyllEs(w) { const m = tlFold(w).match(/[aeiouy]+/gi); if (!m) return 1; let c = 0; for (const g of m) { let s = 1; const gg = g.toLowerCase(); for (let i = 1; i < gg.length; i++) if ('aeo'.includes(gg[i]) && 'aeo'.includes(gg[i - 1])) s++; c += s; } return Math.max(1, c); }
function tlSyllEn(w) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 1; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return Math.max(1, m ? m.length : 1); }
export function tlTextStats(C, texts, opts) {
  opts = opts || {};
  const nd = C.off.length - 1, W = opts.window || 50, lang = opts.lang || 'es';
  const out = { tokens: new Float64Array(nd), types: new Float64Array(nd), sents: new Float64Array(nd), ttr: new Float64Array(nd), mattr: new Float64Array(nd), wlen: new Float64Array(nd), read: new Float64Array(nd) };
  const seen = new Int32Array(C.types.length).fill(-1), win = new Int32Array(C.types.length);
  for (let d = 0; d < nd; d++) {
    if (C.blank[d]) { for (const k in out) out[k][d] = NaN; continue; }
    let nTok = 0, nTyp = 0, letters = 0, syl = 0; const ids = [];
    for (let i = C.off[d]; i < C.off[d + 1]; i++) { const t = C.tok[i]; if (C.kind[t] !== 1) continue; ids.push(t); nTok++; letters += C.types[t].length; if (seen[t] !== d) { seen[t] = d; nTyp++; } syl += lang === 'en' ? tlSyllEn(C.types[t]) : tlSyllEs(C.types[t]); }
    const s = String(texts[d]); const sents = Math.max(1, (s.match(/[.!?…]+(?=\s|$)|\n\s*\n/g) || []).length + (/[.!?…]\s*$/.test(s.trim()) ? 0 : 1));
    out.tokens[d] = nTok; out.types[d] = nTyp; out.sents[d] = sents; out.ttr[d] = nTok ? nTyp / nTok : NaN; out.wlen[d] = nTok ? letters / nTok : NaN;
    if (nTok >= W) { let u = 0, sum = 0, k = 0; for (let i = 0; i < nTok; i++) { const t = ids[i]; if (win[t]++ === 0) u++; if (i >= W) { const o = ids[i - W]; if (--win[o] === 0) u--; } if (i >= W - 1) { sum += u / W; k++; } } for (const t of ids) win[t] = 0; out.mattr[d] = sum / k; }
    else out.mattr[d] = nTok ? nTyp / nTok : NaN;
    const wps = nTok / sents, spw = nTok ? syl / nTok : NaN;
    out.read[d] = !nTok ? NaN : lang === 'en' ? 206.835 - 1.015 * wps - 84.6 * spw : 206.84 - 60 * spw - 1.02 * wps;
  }
  return out;
}

// ---- similarity, distance, hierarchical clustering (textstat_simil/dist + hclust)
export function tlMatrixDist(rows, method) {
  const n = rows.length, D = new Float64Array(n * n), V = n ? rows[0].length : 0;
  const norm = rows.map(r => Math.sqrt(r.reduce((s, x) => s + x * x, 0)));
  const mean = rows.map(r => r.reduce((s, x) => s + x, 0) / (V || 1));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = rows[i], b = rows[j]; let v = 0;
    if (method === 'cosine') { let dot = 0; for (let k = 0; k < V; k++) dot += a[k] * b[k]; v = 1 - (norm[i] && norm[j] ? dot / (norm[i] * norm[j]) : 0); }
    else if (method === 'correlation') { let sab = 0, saa = 0, sbb = 0; for (let k = 0; k < V; k++) { const x = a[k] - mean[i], y = b[k] - mean[j]; sab += x * y; saa += x * x; sbb += y * y; } v = 1 - (saa && sbb ? sab / Math.sqrt(saa * sbb) : 0); }
    else if (method === 'manhattan') { for (let k = 0; k < V; k++) v += Math.abs(a[k] - b[k]); }
    else if (method === 'jaccard') { let inter = 0, uni = 0; for (let k = 0; k < V; k++) { const x = a[k] > 0, y = b[k] > 0; if (x || y) uni++; if (x && y) inter++; } v = 1 - (uni ? inter / uni : 0); }
    else { for (let k = 0; k < V; k++) { const d = a[k] - b[k]; v += d * d; } v = Math.sqrt(v); }
    D[i * n + j] = D[j * n + i] = Math.max(0, v);
  }
  return D;
}
// agglomerative clustering with Lance–Williams updates; method as stats::hclust
export function tlHclust(D, n, method) {
  const d = Float64Array.from(D), size = new Int32Array(n).fill(1), active = new Uint8Array(n).fill(1), id = Array.from({ length: n }, (_, i) => -(i + 1));
  const ward = method === 'ward.D2';
  if (ward) for (let i = 0; i < d.length; i++) d[i] = d[i] * d[i];
  const merge = [], height = [];
  for (let step = 0; step < n - 1; step++) {
    let bi = -1, bj = -1, bv = Infinity;
    for (let i = 0; i < n; i++) if (active[i]) for (let j = i + 1; j < n; j++) if (active[j]) { const v = d[i * n + j]; if (v < bv - 1e-12) { bv = v; bi = i; bj = j; } }
    const ni = size[bi], nj = size[bj];
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === bi || k === bj) continue;
      const dik = d[bi * n + k], djk = d[bj * n + k], nk = size[k];
      let v;
      if (method === 'single') v = Math.min(dik, djk);
      else if (method === 'complete') v = Math.max(dik, djk);
      else if (ward) v = ((ni + nk) * dik + (nj + nk) * djk - nk * bv) / (ni + nj + nk);
      else v = (ni * dik + nj * djk) / (ni + nj);
      d[bi * n + k] = d[k * n + bi] = v;
    }
    merge.push([id[bi], id[bj]]); height.push(ward ? Math.sqrt(Math.max(0, bv)) : bv);
    id[bi] = step + 1; size[bi] = ni + nj; active[bj] = 0;
  }
  // leaf order as R: left subtree then right
  const order = []; const walk = x => { if (x < 0) order.push(-x - 1); else { walk(merge[x - 1][0]); walk(merge[x - 1][1]); } };
  if (n > 1) walk(n - 1); else order.push(0);
  // cophenetic correlation
  const coph = new Float64Array(n * n), members = [];
  merge.forEach(([a, b], s) => { const A = a < 0 ? [-a - 1] : members[a - 1], B = b < 0 ? [-b - 1] : members[b - 1]; for (const x of A) for (const y of B) coph[x * n + y] = coph[y * n + x] = height[s]; members.push(A.concat(B)); });
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const x = D[i * n + j], y = coph[i * n + j]; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++; }
  const cc = m > 1 ? (sxy - sx * sy / m) / Math.sqrt((sxx - sx * sx / m) * (syy - sy * sy / m)) : NaN;
  return { merge, height, order, coph: cc };
}
export function tlCutree(H, n, k) {
  const cl = new Int32Array(n), parent = Array.from({ length: n }, (_, i) => i);
  const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const rep = []; H.merge.forEach(([a, b], s) => { rep.push(a < 0 ? -a - 1 : rep[a - 1]); });
  for (let s = 0; s < n - k; s++) { const [a, b] = H.merge[s]; const ra = find(a < 0 ? -a - 1 : rep[a - 1]), rb = find(b < 0 ? -b - 1 : rep[b - 1]); parent[rb] = ra; }
  const lab = new Map(); for (let i = 0; i < n; i++) { const r = find(i); if (!lab.has(r)) lab.set(r, lab.size + 1); }
  for (let i = 0; i < n; i++) cl[i] = lab.get(find(i));
  return cl;
}

// ---- topic models: collapsed Gibbs LDA as seededlda::textmodel_lda / textmodel_seededlda
function tlRng(seed) { let s = (seed >>> 0) || 1234567; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function* tlLDA(ftok, foff, V, K, opts) {
  opts = opts || {};
  const alpha = opts.alpha ?? 0.5, beta = opts.beta ?? 0.1, iter = opts.iter ?? 2000, rnd = tlRng(opts.seed ?? 1234);
  const M = foff.length - 1, nw = new Float64Array(V * K), nd = new Float64Array(M * K), nwsum = new Float64Array(K), z = new Int32Array(ftok.length);
  const Vbeta = V * beta, Kalpha = K * alpha;
  for (let i = 0; i < ftok.length; i++) { const k = Math.floor(rnd() * K); z[i] = k; }
  for (let m = 0; m < M; m++) for (let i = foff[m]; i < foff[m + 1]; i++) { const w = ftok[i], k = z[i]; nw[w * K + k]++; nd[m * K + k]++; nwsum[k]++; }
  const seeds = opts.seeds || null; // Float64Array(V*K) pseudo counts; added to nw only (as seededlda)
  if (seeds) for (let i = 0; i < V * K; i++) nw[i] += seeds[i];
  const p = new Float64Array(K);
  for (let it = 0; it < iter; it++) {
    for (let m = 0; m < M; m++) {
      const ndsum = foff[m + 1] - foff[m]; if (!ndsum) continue;
      for (let i = foff[m]; i < foff[m + 1]; i++) {
        const w = ftok[i]; let k = z[i];
        nw[w * K + k]--; nd[m * K + k]--; nwsum[k]--;
        let s = 0; for (let j = 0; j < K; j++) { s += (nw[w * K + j] + beta) / (nwsum[j] + Vbeta) * (nd[m * K + j] + alpha) / (ndsum - 1 + Kalpha); p[j] = s; }
        const u = rnd() * s; k = 0; while (k < K - 1 && p[k] < u) k++;
        z[i] = k; nw[w * K + k]++; nd[m * K + k]++; nwsum[k]++;
      }
    }
    if (it % 10 === 9) yield (it + 1) / iter;
  }
  if (seeds) for (let k = 0; k < K; k++) { let s = 0; for (let w = 0; w < V; w++) s += seeds[w * K + k]; nwsum[k] += s; }
  const phi = new Float64Array(K * V), theta = new Float64Array(M * K), size = new Float64Array(K);
  for (let k = 0; k < K; k++) for (let w = 0; w < V; w++) phi[k * V + w] = (nw[w * K + k] + beta) / (nwsum[k] + Vbeta);
  for (let m = 0; m < M; m++) { const ndsum = foff[m + 1] - foff[m]; for (let k = 0; k < K; k++) theta[m * K + k] = ndsum ? (nd[m * K + k] + alpha) / (ndsum + Kalpha) : NaN; }
  let tot = 0; for (let k = 0; k < K; k++) { let s = 0; for (let w = 0; w < V; w++) s += nw[w * K + k] - (seeds ? seeds[w * K + k] : 0); size[k] = s; tot += s; }
  for (let k = 0; k < K; k++) size[k] /= tot || 1;
  // regularised topic divergence (seededlda::divergence, min_size = 0.01)
  const minSize = 0.01; let div = 0;
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { if (i === j) continue; let js = 0; for (let w = 0; w < V; w++) { const a = phi[i * V + w], b = phi[j * V + w], m2 = (a + b) / 2; js += a * Math.log(a / m2) + b * Math.log(b / m2); } div += js / 2 * (size[i] * size[j] - minSize * minSize); }
  div += minSize * minSize;
  return { K, V, M, phi, theta, size, divergence: div, alpha, beta, iter };
}
// per-document topic shares for documents not used in fitting (fold-in Gibbs with fixed phi)
export function tlLDAPredict(model, ftok, foff, opts) {
  opts = opts || {};
  const { K, V, phi, alpha } = model, M = foff.length - 1, theta = new Float64Array(M * K), rnd = tlRng(opts.seed ?? 99), iter = opts.iter ?? 100, p = new Float64Array(K);
  for (let m = 0; m < M; m++) {
    const a = foff[m], b = foff[m + 1], n = b - a; if (!n) { for (let k = 0; k < K; k++) theta[m * K + k] = NaN; continue; }
    const z = new Int32Array(n), nd = new Float64Array(K);
    for (let i = 0; i < n; i++) { z[i] = Math.floor(rnd() * K); nd[z[i]]++; }
    for (let it = 0; it < iter; it++) for (let i = 0; i < n; i++) { const w = ftok[a + i]; nd[z[i]]--; let s = 0; for (let k = 0; k < K; k++) { s += phi[k * V + w] * (nd[k] + alpha); p[k] = s; } const u = rnd() * s; let k = 0; while (k < K - 1 && p[k] < u) k++; z[i] = k; nd[k]++; }
    for (let k = 0; k < K; k++) theta[m * K + k] = (nd[k] + alpha) / (n + K * alpha);
  }
  return theta;
}
// grid of k for “Help me choose”: divergence for each k (fewer iterations)
export function* tlLDAGrid(ftok, foff, V, ks, opts) {
  const out = [];
  for (let i = 0; i < ks.length; i++) {
    const g = tlLDA(ftok, foff, V, ks[i], Object.assign({}, opts, { iter: opts && opts.iter || 300 })); let r;
    while (!(r = g.next()).done) yield (i + r.value) / ks.length;
    out.push({ k: ks[i], divergence: r.value.divergence });
  }
  return out;
}

// ---- Naive Bayes text classifier (textmodel_nb: multinomial, smooth = 1, prior = "uniform")
export function tlNaiveBayes(FT, y, classes, trainMask, opts) {
  opts = opts || {};
  const smooth = opts.smooth ?? 1, prior = opts.prior || 'uniform', C = classes.length, V = FT.nF, nd = FT.foff.length - 1;
  const wc = Array.from({ length: C }, () => new Float64Array(V)), tot = new Float64Array(C), nDoc = new Float64Array(C);
  for (let d = 0; d < nd; d++) { if (!trainMask[d] || y[d] < 0) continue; const c = y[d]; nDoc[c]++; for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { wc[c][FT.ftok[i]]++; tot[c]++; } }
  const logPw = wc.map((a, c) => { const o = new Float64Array(V), den = tot[c] + smooth * V; for (let w = 0; w < V; w++) o[w] = Math.log((a[w] + smooth) / den); return o; });
  const nTrain = nDoc.reduce((s, x) => s + x, 0), logPrior = Array.from({ length: C }, (_, c) => Math.log(prior === 'docfreq' ? nDoc[c] / nTrain : 1 / C));
  const pred = new Int32Array(nd).fill(-1), prob = new Float64Array(nd).fill(NaN);
  for (let d = 0; d < nd; d++) {
    if (FT.foff[d + 1] === FT.foff[d]) continue;
    const s = logPrior.slice(); for (let i = FT.foff[d]; i < FT.foff[d + 1]; i++) { const w = FT.ftok[i]; for (let c = 0; c < C; c++) s[c] += logPw[c][w]; }
    let b = 0; for (let c = 1; c < C; c++) if (s[c] > s[b]) b = c;
    let z = 0; for (let c = 0; c < C; c++) z += Math.exp(s[c] - s[b]);
    pred[d] = b; prob[d] = 1 / z;
  }
  return { pred, prob, logPw, nDoc };
}

// ---- Wordscores (textmodel_wordscores, LBG rescaling off) and Wordfish (textmodel_wordfish)
export function tlWordscores(M, refScores) {
  const D = M.length, V = M[0].length, rel = M.map(r => { const s = r.reduce((a, b) => a + b, 0) || 1; return r.map(x => x / s); });
  const ws = new Float64Array(V).fill(NaN);
  for (let w = 0; w < V; w++) { let sp = 0, num = 0; for (let d = 0; d < D; d++) if (isFinite(refScores[d])) sp += rel[d][w]; if (!sp) continue; for (let d = 0; d < D; d++) if (isFinite(refScores[d])) num += rel[d][w] / sp * refScores[d]; ws[w] = num; }
  const score = rel.map(r => { let s = 0, t = 0; for (let w = 0; w < V; w++) if (isFinite(ws[w]) && r[w] > 0) { s += r[w] * ws[w]; t += r[w]; } return t ? s / t : NaN; });
  return { wordScores: ws, score };
}
export function* tlWordfish(M, opts) {
  // Slapin & Proksch (2008) Poisson scaling; priors as quanteda: theta~N(0,1), alpha~N(0,1), psi~N(0,3), beta~N(0,1)
  opts = opts || {};
  const D = M.length, V = M[0].length, iter = opts.iter || 200, tol = opts.tol || 1e-6;
  const rowSum = M.map(r => r.reduce((a, b) => a + b, 0)), colMean = new Float64Array(V);
  for (let w = 0; w < V; w++) { let s = 0; for (let d = 0; d < D; d++) s += M[d][w]; colMean[w] = s / D; }
  let alpha = rowSum.map(s => Math.log(s / rowSum[0] || 1)), psi = Array.from(colMean, m => Math.log(m + 1e-3)), beta = new Float64Array(V), theta = new Float64Array(D);
  // start values from SVD-like centring: theta from first principal axis of log counts
  const L = M.map((r, d) => r.map((x, w) => Math.log(x + 0.1) - psi[w] - alpha[d]));
  for (let d = 0; d < D; d++) { let s = 0; for (let w = 0; w < V; w++) s += L[d][w] * (L[0][w] - L[D - 1][w]); theta[d] = s; }
  const norm = () => { const m = theta.reduce((a, b) => a + b, 0) / D, sd = Math.sqrt(theta.reduce((a, b) => a + (b - m) ** 2, 0) / D) || 1; for (let d = 0; d < D; d++) theta[d] = (theta[d] - m) / sd; };
  norm();
  let prevLL = -Infinity, ll = 0;
  for (let it = 0; it < iter; it++) {
    // word parameters (psi, beta) by Newton steps with ridge priors
    for (let w = 0; w < V; w++) {
      for (let s = 0; s < 3; s++) {
        let g1 = -psi[w] / 9, g2 = -beta[w], h11 = -1 / 9, h22 = -1, h12 = 0;
        for (let d = 0; d < D; d++) { const mu = Math.exp(alpha[d] + psi[w] + beta[w] * theta[d]), y = M[d][w]; g1 += y - mu; g2 += (y - mu) * theta[d]; h11 -= mu; h22 -= mu * theta[d] * theta[d]; h12 -= mu * theta[d]; }
        const det = h11 * h22 - h12 * h12; if (!det) break;
        psi[w] -= (h22 * g1 - h12 * g2) / det; beta[w] -= (h11 * g2 - h12 * g1) / det;
      }
    }
    // document parameters (alpha, theta)
    for (let d = 0; d < D; d++) {
      for (let s = 0; s < 3; s++) {
        let g1 = 0, g2 = -theta[d], h11 = 0, h22 = -1, h12 = 0;
        for (let w = 0; w < V; w++) { const mu = Math.exp(alpha[d] + psi[w] + beta[w] * theta[d]), y = M[d][w]; g1 += y - mu; g2 += (y - mu) * beta[w]; h11 -= mu; h22 -= mu * beta[w] * beta[w]; h12 -= mu * beta[w]; }
        if (d === 0) { g1 = 0; h11 = -1; h12 = 0; }
        const det = h11 * h22 - h12 * h12; if (!det) break;
        alpha[d] -= (h22 * g1 - h12 * g2) / det; theta[d] -= (h11 * g2 - h12 * g1) / det;
      }
    }
    alpha = alpha.map(a => a - alpha[0]);
    const m = theta.reduce((a, b) => a + b, 0) / D, sd = Math.sqrt(theta.reduce((a, b) => a + (b - m) ** 2, 0) / D) || 1;
    for (let d = 0; d < D; d++) theta[d] = (theta[d] - m) / sd;
    for (let w = 0; w < V; w++) { psi[w] += beta[w] * m; beta[w] *= sd; }
    ll = 0; for (let d = 0; d < D; d++) for (let w = 0; w < V; w++) { const eta = alpha[d] + psi[w] + beta[w] * theta[d]; ll += M[d][w] * eta - Math.exp(eta); }
    if (Math.abs(ll - prevLL) < tol * Math.abs(ll)) break;
    prevLL = ll; if (it % 5 === 0) yield it / iter;
  }
  const dir = opts.dir;
  if (dir && theta[dir[0]] > theta[dir[1]]) { for (let d = 0; d < D; d++) theta[d] = -theta[d]; for (let w = 0; w < V; w++) beta[w] = -beta[w]; }
  // standard errors of theta from the observed information
  const se = Array.from({ length: D }, (_, d) => { let h = 1; for (let w = 0; w < V; w++) { const mu = Math.exp(alpha[d] + psi[w] + beta[w] * theta[d]); h += mu * beta[w] * beta[w]; } return 1 / Math.sqrt(h); });
  return { theta: Array.from(theta), se, beta: Array.from(beta), psi: Array.from(psi), alpha: Array.from(alpha), ll };
}
// correspondence analysis (textmodel_ca): SVD of standardised residuals via the small Gram matrix
export function tlCA(M, nd) {
  const D = M.length, V = M[0].length; let N = 0; for (const r of M) for (const x of r) N += x;
  const r = M.map(row => row.reduce((a, b) => a + b, 0) / N), c = new Float64Array(V); for (const row of M) row.forEach((x, w) => c[w] += x / N);
  const S = M.map((row, i) => row.map((x, w) => c[w] > 0 && r[i] > 0 ? (x / N - r[i] * c[w]) / Math.sqrt(r[i] * c[w]) : 0));
  const G = Array.from({ length: D }, (_, i) => Array.from({ length: D }, (_, j) => S[i].reduce((s, x, w) => s + x * S[j][w], 0)));
  const { vals, vecs } = tlJacobi(G);
  const ord = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, nd || 2);
  const sv = ord.map(([v]) => Math.sqrt(Math.max(0, v)));
  const rowCoord = Array.from({ length: D }, (_, i) => ord.map(([, k], a) => vecs[i][k] / Math.sqrt(r[i])));
  const inertia = vals.reduce((s, v) => s + Math.max(0, v), 0);
  return { sv, rowCoord, inertia: ord.map(([v]) => Math.max(0, v) / (inertia || 1)) };
}
function tlJacobi(A0) {
  const n = A0.length, A = A0.map(r => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = cs * akp - sn * akq; A[k][q] = sn * akp + cs * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = cs * apk - sn * aqk; A[q][k] = sn * apk + cs * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = cs * vkp - sn * vkq; V[k][q] = sn * vkp + cs * vkq; }
    }
  }
  return { vals: A.map((r, i) => r[i]), vecs: V };
}

// ---- co-occurrence network (fcm, context = "document" or window) and a seeded force layout
export function tlFcm(FT, feats, opts) {
  opts = opts || {};
  const idx = new Map(feats.map((f, i) => [f, i])), n = feats.length, M = new Float64Array(n * n), nd = FT.foff.length - 1, win = opts.window || 0;
  for (let d = 0; d < nd; d++) {
    const a = FT.foff[d], b = FT.foff[d + 1];
    if (!win) { const s = new Set(); for (let i = a; i < b; i++) { const k = idx.get(FT.ftok[i]); if (k !== undefined) s.add(k); } const arr = [...s]; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { M[arr[i] * n + arr[j]]++; M[arr[j] * n + arr[i]]++; } }
    else for (let i = a; i < b; i++) { const x = idx.get(FT.ftok[i]); if (x === undefined) continue; for (let j = i + 1; j < Math.min(b, i + win + 1); j++) { const y = idx.get(FT.ftok[j]); if (y === undefined || y === x) continue; M[x * n + y]++; M[y * n + x]++; } }
  }
  return M;
}
export function tlForceLayout(n, edges, seed, W, H) {
  const rnd = tlRng(seed || 7), x = Float64Array.from({ length: n }, () => rnd() * W), y = Float64Array.from({ length: n }, () => rnd() * H), k = Math.sqrt(W * H / Math.max(1, n)) * 0.75;
  let t = W / 8;
  for (let it = 0; it < 400; it++) {
    const dx = new Float64Array(n), dy = new Float64Array(n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let ex = x[i] - x[j], ey = y[i] - y[j], d = Math.sqrt(ex * ex + ey * ey) || 0.01; const f = k * k / d; dx[i] += ex / d * f; dy[i] += ey / d * f; dx[j] -= ex / d * f; dy[j] -= ey / d * f; }
    for (const [i, j, w] of edges) { let ex = x[i] - x[j], ey = y[i] - y[j], d = Math.sqrt(ex * ex + ey * ey) || 0.01; const f = d * d / k * (0.4 + 0.6 * w); dx[i] -= ex / d * f; dy[i] -= ey / d * f; dx[j] += ex / d * f; dy[j] += ey / d * f; }
    for (let i = 0; i < n; i++) { const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]) || 1; x[i] += dx[i] / d * Math.min(d, t); y[i] += dy[i] / d * Math.min(d, t); x[i] = Math.min(W - 30, Math.max(30, x[i])); y[i] = Math.min(H - 20, Math.max(20, y[i])); }
    t *= 0.985;
  }
  return { x: Array.from(x), y: Array.from(y) };
}

// ---- safe variable names (ASCII, Stata ≤ 32 characters, unique)
export function tlVarName(name, taken, maxLen) {
  maxLen = maxLen || 32;
  let s = tlFold(String(name || '')).replace(/ñ/g, 'n').replace(/Ñ/g, 'N').replace(/ç/g, 'c').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = 'v'; if (/^[0-9]/.test(s)) s = 'v_' + s;
  s = s.slice(0, maxLen);
  if (taken) { let base = s, k = 2; while (taken.has(s)) { const suf = '_' + k++; s = base.slice(0, maxLen - suf.length) + suf; } }
  return s;
}

// phrase suggestions for "Join phrases": strong (z > 3.3) 2- and 3-word sequences, most frequent first
export function tlPhraseSugg(C, opts) {
  const a = tlCollocations(C, Object.assign({}, opts, { size: 2 })), b = tlCollocations(C, Object.assign({}, opts, { size: 3 }));
  return a.concat(b).filter(r => r.z > 3.3).sort((x, y) => y.count - x.count).slice(0, 40);
}
// stability of LDA topics across three random starts: share of top-10 words that matched topics have in common
export function* tlLDAStability(ftok, foff, V, K, opts) {
  const models = [];
  for (let s = 0; s < 3; s++) {
    const g = tlLDA(ftok, foff, V, K, Object.assign({}, opts, { seed: (opts.seed || 1234) + 101 * s })); let r;
    while (!(r = g.next()).done) yield (s + r.value) / 3;
    models.push(r.value);
  }
  const top = m => Array.from({ length: m.K }, (_, k) => new Set(Array.from({ length: V }, (_, w) => w).sort((a, b) => m.phi[k * V + b] - m.phi[k * V + a]).slice(0, 10)));
  const T0 = top(models[0]), per = new Float64Array(K);
  for (let j = 1; j < 3; j++) {
    const Tj = top(models[j]), used = new Set();
    const pairs = [];
    for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { let c = 0; for (const w of T0[a]) if (Tj[b].has(w)) c++; pairs.push([c / 10, a, b]); }
    pairs.sort((x, y) => y[0] - x[0]); const doneA = new Set();
    for (const [v, a, b] of pairs) { if (doneA.has(a) || used.has(b)) continue; doneA.add(a); used.add(b); per[a] += v / 2; }
  }
  let mean = 0, min = 1; for (let k = 0; k < K; k++) { mean += per[k] / K; if (per[k] < min) min = per[k]; }
  return { mean, min, per: Array.from(per) };
}
