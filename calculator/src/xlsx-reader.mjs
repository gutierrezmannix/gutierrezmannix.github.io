// ---------- Excel workbook reader (.xlsx / .xlsm) ----------
// Reads Office Open XML spreadsheets with no network and no third-party code:
// ZIP container (incl. ZIP64), DEFLATE (native DecompressionStream, with a
// pure-JS fallback), shared strings (rich text, phonetic runs skipped),
// inline strings, booleans, errors, formulas' cached values, the 1900 and 1904
// date systems and date/time number formats. Returns the same column structure
// as parseCSV, so every tab treats an Excel sheet exactly like a CSV file.

const XL_ZIP_SIG = 0x04034b50;

function xlU16(u8, i) { return u8[i] | (u8[i + 1] << 8); }
function xlU32(u8, i) { return (u8[i] | (u8[i + 1] << 8) | (u8[i + 2] << 16) | (u8[i + 3] << 24)) >>> 0; }
function xlU64(u8, i) { return xlU32(u8, i) + xlU32(u8, i + 4) * 4294967296; }

// ---- pure-JS inflate (RFC 1951), used only when DecompressionStream is missing
function xlInflateJS(src) {
  let pos = 0, bit = 0, out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0;
  const need = n => { if (op + n <= out.length) return; let L = out.length * 2; while (L < op + n) L *= 2; const o = new Uint8Array(L); o.set(out.subarray(0, op)); out = o; };
  const bits = n => { let v = 0; for (let i = 0; i < n; i++) { if (pos >= src.length) throw new Error('corrupt deflate stream'); v |= ((src[pos] >> bit) & 1) << i; if (++bit === 8) { bit = 0; pos++; } } return v; };
  const build = lens => {
    const maxL = Math.max(0, ...lens), cnt = new Uint16Array(maxL + 1), offs = new Uint16Array(maxL + 2), sym = new Uint16Array(lens.length);
    for (const l of lens) if (l) cnt[l]++;
    for (let l = 1; l <= maxL; l++) offs[l + 1] = offs[l] + cnt[l];
    for (let s = 0; s < lens.length; s++) if (lens[s]) sym[offs[lens[s]]++] = s;
    return { cnt, sym, maxL };
  };
  const decode = t => {
    let code = 0, first = 0, index = 0;
    for (let l = 1; l <= t.maxL; l++) {
      code |= bits(1); const c = t.cnt[l];
      if (code - first < c) return t.sym[index + code - first];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('bad huffman code');
  };
  const LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  let fixedL = null, fixedD = null;
  for (;;) {
    const last = bits(1), type = bits(2);
    if (type === 0) {
      if (bit) { bit = 0; pos++; }
      const len = src[pos] | (src[pos + 1] << 8); pos += 4;
      need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
    } else {
      let lt, dt;
      if (type === 1) {
        if (!fixedL) { const l = new Array(288); for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8; fixedL = build(l); fixedD = build(new Array(30).fill(5)); }
        lt = fixedL; dt = fixedD;
      } else if (type === 2) {
        const hl = bits(5) + 257, hd = bits(5) + 1, hc = bits(4) + 4, ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        const cl = new Array(19).fill(0); for (let i = 0; i < hc; i++) cl[ord[i]] = bits(3);
        const ct = build(cl), lens = [];
        while (lens.length < hl + hd) {
          const s = decode(ct);
          if (s < 16) lens.push(s);
          else if (s === 16) { const p = lens[lens.length - 1]; for (let r = bits(2) + 3; r > 0; r--) lens.push(p); }
          else if (s === 17) { for (let r = bits(3) + 3; r > 0; r--) lens.push(0); }
          else { for (let r = bits(7) + 11; r > 0; r--) lens.push(0); }
        }
        lt = build(lens.slice(0, hl)); dt = build(lens.slice(hl));
      } else throw new Error('bad deflate block');
      for (;;) {
        const s = decode(lt);
        if (s < 256) { need(1); out[op++] = s; }
        else if (s === 256) break;
        else {
          const li = s - 257, len = LB[li] + bits(LE[li]), di = decode(dt), dist = DB[di] + bits(DE[di]);
          need(len); for (let i = 0; i < len; i++) { out[op] = out[op - dist]; op++; }
        }
      }
    }
    if (last) break;
  }
  return out.subarray(0, op);
}

async function xlInflate(bytes) {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { /* fall through to the JS decoder */ }
  }
  return xlInflateJS(bytes);
}

function xlZipEntries(u8) {
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (xlU32(u8, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('this file is not a valid Excel workbook (no ZIP directory found).');
  let n = xlU16(u8, eocd + 10), cd = xlU32(u8, eocd + 16);
  if (n === 0xFFFF || cd === 0xFFFFFFFF) {
    const loc = eocd - 20;
    if (loc >= 0 && xlU32(u8, loc) === 0x07064b50) { const z = xlU64(u8, loc + 8); if (xlU32(u8, z) === 0x06064b50) { n = xlU64(u8, z + 32); cd = xlU64(u8, z + 48); } }
  }
  const map = new Map(), dec = new TextDecoder('utf-8');
  for (let k = 0, p = cd; k < n; k++) {
    if (xlU32(u8, p) !== 0x02014b50) break;
    const method = xlU16(u8, p + 10), nl = xlU16(u8, p + 28), el = xlU16(u8, p + 30), cl = xlU16(u8, p + 32);
    let csize = xlU32(u8, p + 20), usize = xlU32(u8, p + 24), off = xlU32(u8, p + 42);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    for (let e = p + 46 + nl, end = e + el; e + 4 <= end;) {
      const id = xlU16(u8, e), sz = xlU16(u8, e + 2); let q = e + 4;
      if (id === 1) { if (usize === 0xFFFFFFFF) { usize = xlU64(u8, q); q += 8; } if (csize === 0xFFFFFFFF) { csize = xlU64(u8, q); q += 8; } if (off === 0xFFFFFFFF) { off = xlU64(u8, q); } }
      e += 4 + sz;
    }
    map.set(name.replace(/^\/+/, ''), { method, csize, usize, off });
    p += 46 + nl + el + cl;
  }
  return map;
}

async function xlRead(u8, entries, path) {
  const e = entries.get(path) || entries.get(path.replace(/^\/+/, '')) || [...entries.entries()].find(([k]) => k.toLowerCase() === path.toLowerCase())?.[1];
  if (!e) return null;
  if (xlU32(u8, e.off) !== XL_ZIP_SIG) throw new Error('damaged workbook entry: ' + path);
  const start = e.off + 30 + xlU16(u8, e.off + 26) + xlU16(u8, e.off + 28);
  const raw = u8.subarray(start, start + e.csize);
  const bytes = e.method === 0 ? raw : e.method === 8 ? await xlInflate(raw) : null;
  if (!bytes) throw new Error('unsupported compression in workbook entry ' + path);
  return new TextDecoder('utf-8').decode(bytes);
}

const XL_ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
function xlText(s) {
  if (s.indexOf('&') >= 0) s = s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : XL_ENT[e]);
  if (s.indexOf('_x') >= 0) s = s.replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  return s;
}
function xlAttr(attrs, name) { const m = new RegExp('(?:^|\\s)(?:\\w+:)?' + name + '\\s*=\\s*"([^"]*)"').exec(attrs) || new RegExp('(?:^|\\s)(?:\\w+:)?' + name + "\\s*=\\s*'([^']*)'").exec(attrs); return m ? xlText(m[1]) : null; }
function xlRichText(inner) {
  inner = inner.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
  let s = '', m; const re = /<(?:\w+:)?t\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?t>)/g;
  while ((m = re.exec(inner))) if (m[1]) s += m[1];
  return xlText(s);
}
function xlColIndex(ref) { let c = 0, i = 0; for (; i < ref.length; i++) { const k = ref.charCodeAt(i); if (k < 65 || k > 90) break; c = c * 26 + (k - 64); } return i ? c - 1 : -1; }

const XL_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81]);
function xlFmtKind(code) {
  if (!code) return null;
  const s = code.split(';')[0].replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/_./g, '').replace(/\*./g, '');
  const el = /\[(h+|m+|s+)\]/i.test(s);
  const t = s.replace(/\[[^\]]*\]/g, '');
  if (/^(general|@)$/i.test(t.trim())) return null;
  const hasD = /[dy]/i.test(t), hasT = /[hs]/i.test(t) || /AM\/PM|A\/P/i.test(t);
  const hasM = /m/i.test(t);
  if (el) return 'elapsed';
  if (hasD || (hasM && !hasT && /m{3,}/i.test(t))) return hasT ? 'datetime' : 'date';
  if (hasT) return 'time';
  return null;
}
function xlSerialToISO(v, kind, d1904) {
  if (!isFinite(v)) return '';
  if (kind === 'elapsed') { const sec = Math.round(v * 86400), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  let day = Math.floor(v), sec = Math.round((v - day) * 86400);
  if (sec >= 86400) { day++; sec -= 86400; }
  let ms;
  if (d1904) ms = Date.UTC(1904, 0, 1) + day * 86400000;
  else ms = day >= 60 ? Date.UTC(1899, 11, 30) + day * 86400000 : day === 0 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 31) + day * 86400000;
  const d = new Date(ms), p2 = x => String(x).padStart(2, '0');
  const date = d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  const time = p2(Math.floor(sec / 3600)) + ':' + p2(Math.floor(sec % 3600 / 60)) + ':' + p2(sec % 60);
  if (kind === 'time' && day === 0) return time;
  return kind === 'datetime' || sec ? date + ' ' + time : date;
}

function xlRelPath(base, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/'); parts.pop();
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); }
  return parts.join('/');
}

async function xlWorkbook(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) throw new Error('this is an old Excel 97–2003 (.xls) file. Open it in Excel and choose File → Save As → Excel Workbook (.xlsx) or CSV, then load that file.');
  if (xlU32(u8, 0) !== XL_ZIP_SIG) throw new Error('this file is not an Excel workbook.');
  const entries = xlZipEntries(u8);
  if (!entries.has('xl/workbook.xml')) {
    if (entries.has('content.xml')) throw new Error('OpenDocument spreadsheets (.ods) are not supported yet. Save the file as Excel (.xlsx) or CSV and load that.');
    if (entries.has('xl/workbook.bin')) throw new Error('Excel binary workbooks (.xlsb) are not supported. Save the file as Excel (.xlsx) or CSV and load that.');
    throw new Error('this ZIP file does not contain an Excel workbook.');
  }
  const wb = await xlRead(u8, entries, 'xl/workbook.xml');
  const rels = (await xlRead(u8, entries, 'xl/_rels/workbook.xml.rels')) || '';
  const relMap = {}; let m; const reR = /<(?:\w+:)?Relationship\b([^>]*)>/g;
  while ((m = reR.exec(rels))) { const id = xlAttr(m[1], 'Id'), tg = xlAttr(m[1], 'Target'), ty = xlAttr(m[1], 'Type') || ''; if (id && tg) relMap[id] = { path: xlRelPath('xl/workbook.xml', tg), type: ty }; }
  const prM = /<(?:\w+:)?workbookPr\b([^>]*)>/.exec(wb), d1904 = prM ? /^(1|true)$/i.test(xlAttr(prM[1], 'date1904') || '') : false;
  const sheets = []; const reS = /<(?:\w+:)?sheet\b([^>]*?)\/?>/g;
  while ((m = reS.exec(wb))) {
    const rid = xlAttr(m[1], 'id'), rel = rid && relMap[rid];
    if (!rel || (rel.type && !/worksheet$/i.test(rel.type))) continue;
    sheets.push({ name: xlAttr(m[1], 'name') || ('Sheet' + (sheets.length + 1)), hidden: /hidden/i.test(xlAttr(m[1], 'state') || ''), path: rel.path });
  }
  if (!sheets.length) throw new Error('this workbook has no worksheets.');
  return { u8, entries, sheets, d1904 };
}

export async function xlsxSheets(buf) {
  const W = await xlWorkbook(buf);
  return W.sheets.map(s => ({ name: s.name, hidden: s.hidden }));
}

export async function parseXLSX(buf, prog, opts) {
  opts = opts || {};
  prog = prog || (() => {});
  let _ty = performance.now();
  const yieldIf = async p => { if (performance.now() - _ty > 50) { prog(p); await new Promise(r => setTimeout(r, 0)); _ty = performance.now(); } };
  const W = await xlWorkbook(buf);
  prog(5);
  const sst = [], sstXml = await xlRead(W.u8, W.entries, 'xl/sharedStrings.xml');
  if (sstXml) { const re = /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g; let m; while ((m = re.exec(sstXml))) sst.push(m[1] ? xlRichText(m[1]) : ''); }
  prog(15);
  const fmtKind = [];
  const stXml = await xlRead(W.u8, W.entries, 'xl/styles.xml');
  if (stXml) {
    const custom = {}; let m; const reF = /<(?:\w+:)?numFmt\b([^>]*?)\/?>/g;
    while ((m = reF.exec(stXml))) custom[+xlAttr(m[1], 'numFmtId')] = xlAttr(m[1], 'formatCode');
    const xfs = /<(?:\w+:)?cellXfs\b[^>]*>([\s\S]*?)<\/(?:\w+:)?cellXfs>/.exec(stXml);
    if (xfs) { const reX = /<(?:\w+:)?xf\b([^>]*?)(?:\/>|>)/g; while ((m = reX.exec(xfs[1]))) { const id = +(xlAttr(m[1], 'numFmtId') || 0); fmtKind.push(custom[id] != null ? xlFmtKind(custom[id]) : XL_DATE_IDS.has(id) ? (id >= 18 && id <= 21 || id >= 45 && id <= 47 ? 'time' : id === 22 ? 'datetime' : 'date') : null); } }
  }
  // choose the sheet: requested one, else the first visible sheet with data
  let idx = -1;
  if (opts.sheet != null) idx = typeof opts.sheet === 'number' ? opts.sheet : W.sheets.findIndex(s => s.name === opts.sheet);
  const order = idx >= 0 ? [idx] : W.sheets.map((s, i) => i).sort((a, b) => (W.sheets[a].hidden - W.sheets[b].hidden) || a - b);
  let grid = null, used = -1, merged = 0;
  for (const si of order) {
    const xml = await xlRead(W.u8, W.entries, W.sheets[si].path);
    if (xml == null) continue;
    const g = [], reRow = /<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g, reC = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    let m, rAuto = 0;
    while ((m = reRow.exec(xml))) {
      const rAttr = xlAttr(m[1], 'r'), r = rAttr ? (+rAttr - 1) : rAuto; rAuto = r + 1;
      if (!m[2]) continue;
      let row = null, cAuto = 0, c; reC.lastIndex = 0;
      while ((c = reC.exec(m[2]))) {
        const at = c[1], ref = xlAttr(at, 'r'), ci = ref ? xlColIndex(ref) : cAuto; cAuto = ci + 1;
        const inner = c[2]; if (!inner) continue;
        const t = xlAttr(at, 't') || 'n', s = +(xlAttr(at, 's') || 0);
        let val;
        if (t === 'inlineStr') { const is = /<(?:\w+:)?is\b[^>]*>([\s\S]*?)<\/(?:\w+:)?is>/.exec(inner); val = is ? xlRichText(is[1]) : ''; }
        else {
          const vm = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner); if (!vm) continue;
          const v = vm[1];
          if (t === 's') val = sst[+v] ?? '';
          else if (t === 'str') val = xlText(v);
          else if (t === 'b') val = v === '1' || /^true$/i.test(v) ? 1 : 0;
          else if (t === 'e') val = '';
          else if (t === 'd') val = xlText(v).replace('T', ' ').replace(/(\.\d+)?Z?$/, '').replace(/ 00:00:00$/, '');
          else { const x = Number(v); const k = fmtKind[s]; val = k && isFinite(x) ? { d: x, k } : isFinite(x) ? x : xlText(v); }
        }
        if (val === '' || val == null) continue;
        if (!row) row = g[r] = [];
        row[ci] = val;
      }
    }
    merged += (xml.match(/<(?:\w+:)?mergeCell\b/g) || []).length;
    if (g.some(r => r && r.length)) { grid = g; used = si; break; }
    if (idx >= 0) { grid = g; used = si; break; }
    await yieldIf(30);
  }
  if (!grid || !grid.some(r => r && r.length)) throw new Error('the sheet “' + (W.sheets[used >= 0 ? used : 0].name) + '” is empty.');
  prog(45);
  // dates: one text format per column (with a time part only when some cell has one)
  const K0 = grid.reduce((k, r) => r ? Math.max(k, r.length) : k, 0), hasTime = new Array(K0).fill(false);
  for (const r of grid) if (r) for (let c = 0; c < r.length; c++) { const v = r[c]; if (v && typeof v === 'object' && (v.k === 'datetime' || (v.k === 'date' && Math.abs(v.d - Math.floor(v.d)) > 1e-7))) hasTime[c] = true; }
  const cell = (v, c) => v == null ? '' : typeof v === 'object' ? xlSerialToISO(v.d, v.k === 'date' && hasTime[c] ? 'datetime' : v.k, W.d1904) : typeof v === 'number' ? String(v) : String(v).trim();
  const first = grid.findIndex(r => r && r.some(v => v != null && v !== ''));
  const header = grid[first], body = [];
  for (let r = first + 1; r < grid.length; r++) { const row = grid[r]; if (row && row.some(v => v != null && v !== '')) body.push(row); }
  if (!body.length) throw new Error('the sheet “' + W.sheets[used].name + '” has a header row but no data rows.');
  const K = Math.max(header.length, K0), N = body.length, seen = Object.create(null);
  const names = []; for (let c = 0; c < K; c++) { let nm = cell(header[c], c).replace(/\s+/g, ' ').trim() || ('var' + (c + 1)); if (seen[nm]) { seen[nm]++; nm = nm + '_' + seen[nm]; } else seen[nm] = 1; names.push(nm); }
  const cols = names.map(() => ({ k: 's', a: new Array(N) }));
  let longCells = 0;
  for (let r = 0; r < N; r++) {
    const row = body[r];
    for (let c = 0; c < K; c++) { const v = row[c]; cols[c].a[r] = cell(v, c); if (typeof v === 'string' && v.length >= 32767) longCells++; }
    if ((r & 4095) === 4095) await yieldIf(45 + Math.round(35 * r / N));
  }
  const isMiss = v => v === '' || v === '.' || v === 'NA' || v === 'N/A' || v === 'na' || v === 'n/a' || v === 'NULL' || v === 'null';
  for (let c = 0; c < K; c++) {
    const a = cols[c].a; let num = 0, cnt = 0;
    for (let r = 0; r < N; r++) { const v = a[r]; if (isMiss(v)) continue; cnt++; if (isFinite(Number(v))) num++; }
    if (cnt > 0 && num / cnt >= 0.98) { const fa = new Float64Array(N); for (let r = 0; r < N; r++) { const v = a[r]; fa[r] = isMiss(v) ? NaN : Number(v); } cols[c] = { k: 'n', a: fa }; }
  }
  prog(93);
  return {
    names, labels: names.map(() => ''), cols, vlabs: Object.create(null), n: N,
    xlsx: { sheets: W.sheets.map(s => ({ name: s.name, hidden: s.hidden })), sheet: W.sheets[used].name, merged, longCells }
  };
}
