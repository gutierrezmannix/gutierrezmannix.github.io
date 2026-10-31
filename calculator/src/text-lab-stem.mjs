// ---------- Snowball stemmers (Spanish, English/Porter2) ----------
// Written from the published Snowball algorithm descriptions
// (snowballstem.org/algorithms/spanish and /english), the same algorithms that
// quanteda's tokens_wordstem() calls through SnowballC.

const TLS_ES_V = 'aeiouáéíóúü';
function tlsEsRegions(w) {
  const v = c => TLS_ES_V.indexOf(c) >= 0, n = w.length;
  let rv = n;
  if (n >= 2) {
    if (!v(w[1])) { for (let i = 2; i < n; i++) if (v(w[i])) { rv = i + 1; break; } }
    else if (v(w[0]) && v(w[1])) { for (let i = 2; i < n; i++) if (!v(w[i])) { rv = i + 1; break; } }
    else rv = 3;
  }
  const after = s => { for (let i = s + 1; i < n; i++) if (!v(w[i]) && v(w[i - 1])) return i + 1; return n; };
  const r1 = after(0), r2 = after(r1);
  return { rv: Math.min(rv, n), r1, r2 };
}
function tlsLongest(w, list, from) { let best = ''; for (const s of list) if (s.length > best.length && w.endsWith(s) && (from === undefined || w.length - s.length >= from)) best = s; return best; }
const TLS_ES_PRON = ['me', 'se', 'sela', 'selo', 'selas', 'selos', 'la', 'le', 'lo', 'las', 'les', 'los', 'nos'];
const TLS_ES_PRON_BEFORE = { 'iéndo': 'iendo', 'ándo': 'ando', 'ár': 'ar', 'ér': 'er', 'ír': 'ir', 'ando': 'ando', 'iendo': 'iendo', 'ar': 'ar', 'er': 'er', 'ir': 'ir', 'yendo': 'yendo' };
const TLS_ES_S1 = [
  [['anza', 'anzas', 'ico', 'ica', 'icos', 'icas', 'ismo', 'ismos', 'able', 'ables', 'ible', 'ibles', 'ista', 'istas', 'oso', 'osa', 'osos', 'osas', 'amiento', 'amientos', 'imiento', 'imientos'], 'del'],
  [['adora', 'ador', 'ación', 'acion', 'adoras', 'adores', 'aciones', 'ante', 'antes', 'ancia', 'ancias'], 'adora'],
  [['logía', 'logías'], 'log'], [['ución', 'ucion', 'uciones'], 'u'], [['encia', 'encias'], 'ente'],
  [['amente'], 'amente'], [['mente'], 'mente'], [['idad', 'idades'], 'idad'], [['iva', 'ivo', 'ivas', 'ivos'], 'iva']
];
const TLS_ES_S1_ALL = TLS_ES_S1.flatMap(([l, k]) => l.map(s => [s, k]));
const TLS_ES_2A = ['ya', 'ye', 'yan', 'yen', 'yeron', 'yendo', 'yo', 'yó', 'yas', 'yes', 'yais', 'yamos'];
const TLS_ES_2B_GU = ['en', 'es', 'éis', 'emos'];
const TLS_ES_2B = ['arían', 'arías', 'arán', 'arás', 'aríais', 'aría', 'aréis', 'aríamos', 'aremos', 'ará', 'aré', 'erían', 'erías', 'erán', 'erás', 'eríais', 'ería', 'eréis', 'eríamos', 'eremos', 'erá', 'eré', 'irían', 'irías', 'irán', 'irás', 'iríais', 'iría', 'iréis', 'iríamos', 'iremos', 'irá', 'iré', 'aba', 'ada', 'ida', 'ía', 'ara', 'iera', 'ad', 'ed', 'id', 'ase', 'iese', 'aste', 'iste', 'an', 'aban', 'ían', 'aran', 'ieran', 'asen', 'iesen', 'aron', 'ieron', 'ado', 'ido', 'ando', 'iendo', 'ió', 'ar', 'er', 'ir', 'as', 'abas', 'adas', 'idas', 'ías', 'aras', 'ieras', 'ases', 'ieses', 'ís', 'áis', 'abais', 'íais', 'arais', 'ierais', 'aseis', 'ieseis', 'asteis', 'isteis', 'ados', 'idos', 'amos', 'ábamos', 'íamos', 'imos', 'áramos', 'iéramos', 'iésemos', 'ásemos'];
const TLS_ES_ACC = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };

export function tlStemEs(word) {
  let w = word;
  let R = tlsEsRegions(w);
  // step 0: attached pronoun
  const pr = tlsLongest(w, TLS_ES_PRON);
  if (pr) {
    const base = w.slice(0, w.length - pr.length);
    const vb = tlsLongest(base, Object.keys(TLS_ES_PRON_BEFORE));
    if (vb && base.length - vb.length >= R.rv) {
      if (vb === 'yendo') { if (base.slice(0, base.length - 5).endsWith('u')) w = base; }
      else w = base.slice(0, base.length - vb.length) + TLS_ES_PRON_BEFORE[vb];
    }
  }
  R = tlsEsRegions(w);
  // step 1: standard suffixes (the longest match decides; if its condition fails nothing is removed)
  let s1 = '', s1k = '';
  for (const [s, k] of TLS_ES_S1_ALL) if (s.length > s1.length && w.endsWith(s)) { s1 = s; s1k = k; }
  let done1 = false;
  if (s1) {
    const at = w.length - s1.length, cut = (word0, n) => word0.slice(0, word0.length - n);
    const inR2 = p => p >= R.r2, inR1 = p => p >= R.r1;
    if (s1k === 'del') { if (inR2(at)) { w = cut(w, s1.length); done1 = true; } }
    else if (s1k === 'adora') { if (inR2(at)) { w = cut(w, s1.length); done1 = true; if (w.endsWith('ic') && inR2(w.length - 2)) w = cut(w, 2); } }
    else if (s1k === 'log') { if (inR2(at)) { w = cut(w, s1.length) + 'log'; done1 = true; } }
    else if (s1k === 'u') { if (inR2(at)) { w = cut(w, s1.length) + 'u'; done1 = true; } }
    else if (s1k === 'ente') { if (inR2(at)) { w = cut(w, s1.length) + 'ente'; done1 = true; } }
    else if (s1k === 'amente') {
      if (inR1(at)) {
        w = cut(w, s1.length); done1 = true;
        if (w.endsWith('iv') && inR2(w.length - 2)) { w = cut(w, 2); if (w.endsWith('at') && inR2(w.length - 2)) w = cut(w, 2); }
        else { const p = tlsLongest(w, ['os', 'ic', 'ad']); if (p && inR2(w.length - 2)) w = cut(w, 2); }
      }
    }
    else if (s1k === 'mente') { if (inR2(at)) { w = cut(w, s1.length); done1 = true; const p = tlsLongest(w, ['ante', 'able', 'ible']); if (p && inR2(w.length - 4)) w = cut(w, 4); } }
    else if (s1k === 'idad') { if (inR2(at)) { w = cut(w, s1.length); done1 = true; const p = tlsLongest(w, ['abil', 'ic', 'iv']); if (p && inR2(w.length - p.length)) w = cut(w, p.length); } }
    else if (s1k === 'iva') { if (inR2(at)) { w = cut(w, s1.length); done1 = true; if (w.endsWith('at') && inR2(w.length - 2)) w = cut(w, 2); } }
  }
  if (!done1) {
    // step 2a: verb suffixes beginning with y, after u
    const y = tlsLongest(w, TLS_ES_2A, R.rv);
    let done2 = false;
    if (y && w[w.length - y.length - 1] === 'u') { w = w.slice(0, w.length - y.length); done2 = true; }
    if (!done2) {
      const all = tlsLongest(w, TLS_ES_2B.concat(TLS_ES_2B_GU), R.rv);
      if (all) {
        w = w.slice(0, w.length - all.length);
        if (TLS_ES_2B_GU.includes(all) && w.endsWith('gu')) w = w.slice(0, -1);
      }
    }
  }
  // step 3: residual suffix
  R = tlsEsRegions(w);
  const r3 = tlsLongest(w, ['os', 'a', 'o', 'á', 'í', 'ó', 'e', 'é']);
  if (r3 && w.length - r3.length >= R.rv) {
    w = w.slice(0, w.length - r3.length);
    if ((r3 === 'e' || r3 === 'é') && w.endsWith('gu') && w.length - 1 >= R.rv) w = w.slice(0, -1);
  }
  return w.replace(/[áéíóú]/g, c => TLS_ES_ACC[c]);
}

// ---- English (Porter2)
const TLS_EN_EXC1 = { skis: 'ski', skies: 'sky', dying: 'die', lying: 'lie', tying: 'tie', idly: 'idl', gently: 'gentl', ugly: 'ugli', early: 'earli', only: 'onli', singly: 'singl', sky: 'sky', news: 'news', howe: 'howe', atlas: 'atlas', cosmos: 'cosmos', bias: 'bias', andes: 'andes' };
const TLS_EN_EXC2 = new Set(['inning', 'outing', 'canning', 'herring', 'earring', 'proceed', 'exceed', 'succeed']);
const tlsEnV = c => 'aeiouy'.indexOf(c) >= 0;
function tlsEnShortSyl(w, i) { // syllable ending at index i (inclusive)
  if (i === 1) return tlsEnV(w[0]) && !tlsEnV(w[1]);
  return i >= 2 && !tlsEnV(w[i - 2]) && tlsEnV(w[i - 1]) && !tlsEnV(w[i]) && 'wxY'.indexOf(w[i]) < 0;
}
export function tlStemEn(word) {
  let w = word.toLowerCase().replace(/’/g, "'");
  if (w.length <= 2) return w;
  if (TLS_EN_EXC1[w]) return TLS_EN_EXC1[w];
  if (w[0] === "'") w = w.slice(1);
  w = w.replace(/^y/, 'Y').replace(/([aeiouy])y/g, '$1Y');
  let r1 = w.length;
  const m = /^(gener|commun|arsen)/.exec(w);
  if (m) r1 = m[0].length; else for (let i = 1; i < w.length; i++) if (!tlsEnV(w[i]) && tlsEnV(w[i - 1])) { r1 = i + 1; break; }
  let r2 = w.length; for (let i = r1 + 1; i < w.length; i++) if (!tlsEnV(w[i]) && tlsEnV(w[i - 1])) { r2 = i + 1; break; }
  // step 0
  for (const s of ["'s'", "'s", "'"]) if (w.endsWith(s)) { w = w.slice(0, -s.length); break; }
  // step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ied') || w.endsWith('ies')) w = w.length > 4 ? w.slice(0, -2) : w.slice(0, -1);
  else if (w.endsWith('us') || w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s')) { const b = w.slice(0, -2); if (/[aeiouy]/.test(b)) w = w.slice(0, -1); }
  if (TLS_EN_EXC2.has(w)) return w;
  // step 1b
  const s1b = tlsLongest(w, ['eed', 'eedly', 'ed', 'edly', 'ing', 'ingly']);
  if (s1b === 'eed' || s1b === 'eedly') { if (w.length - s1b.length >= r1) w = w.slice(0, -s1b.length) + 'ee'; }
  else if (s1b) {
    const b = w.slice(0, -s1b.length);
    if (/[aeiouy]/.test(b)) {
      w = b;
      if (/(at|bl|iz)$/.test(w)) w += 'e';
      else if (/(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/.test(w)) w = w.slice(0, -1);
      else if (r1 >= w.length && tlsEnShortSyl(w, w.length - 1)) w += 'e';
    }
  }
  // step 1c
  if (w.length > 2 && /[yY]$/.test(w) && !tlsEnV(w[w.length - 2])) w = w.slice(0, -1) + 'i';
  // step 2
  const S2 = { tional: 'tion', enci: 'ence', anci: 'ance', abli: 'able', entli: 'ent', izer: 'ize', ization: 'ize', ational: 'ate', ation: 'ate', ator: 'ate', alism: 'al', aliti: 'al', alli: 'al', fulness: 'ful', ousli: 'ous', ousness: 'ous', iveness: 'ive', iviti: 'ive', biliti: 'ble', bli: 'ble', ogi: 'og', fulli: 'ful', lessli: 'less', li: '' };
  const s2 = tlsLongest(w, Object.keys(S2));
  if (s2 && w.length - s2.length >= r1) {
    const b = w.slice(0, -s2.length);
    if (s2 === 'ogi') { if (b.endsWith('l')) w = b + 'og'; }
    else if (s2 === 'li') { if (/[cdeghkmnrt]$/.test(b)) w = b; }
    else w = b + S2[s2];
  }
  // step 3
  const S3 = { tional: 'tion', ational: 'ate', alize: 'al', icate: 'ic', iciti: 'ic', ical: 'ic', ful: '', ness: '', ative: '' };
  const s3 = tlsLongest(w, Object.keys(S3));
  if (s3 && w.length - s3.length >= r1) { if (s3 === 'ative') { if (w.length - 5 >= r2) w = w.slice(0, -5); } else w = w.slice(0, -s3.length) + S3[s3]; }
  // step 4
  const s4 = tlsLongest(w, ['al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize', 'ion']);
  if (s4 && w.length - s4.length >= r2) { if (s4 === 'ion') { if (/[st]$/.test(w.slice(0, -3))) w = w.slice(0, -3); } else w = w.slice(0, -s4.length); }
  // step 5
  if (w.endsWith('e')) { const p = w.length - 1; if (p >= r2 || (p >= r1 && !tlsEnShortSyl(w, p - 1))) w = w.slice(0, -1); }
  else if (w.endsWith('ll') && w.length - 1 >= r2) w = w.slice(0, -1);
  return w.replace(/Y/g, 'y');
}
