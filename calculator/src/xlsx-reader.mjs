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


// ---------- old Excel: .xls (BIFF8 = Excel 97–2003, BIFF5/7 = Excel 5.0 of 1993 and Excel 95) ----------
// The file is a compound document (OLE2): a small FAT file system holding the "Workbook" (BIFF8) or "Book" (BIFF5)
// stream. That stream is a list of records: the workbook part (sheets, shared strings, number formats, cell styles)
// and one part per sheet with its cells. Only values are read: numbers, text, booleans, formula results, dates.
function xlsCfbStream(u8) {
  const ss = 1 << xlU16(u8, 0x1E), mss = 1 << xlU16(u8, 0x20), cutoff = xlU32(u8, 0x38), END = 0xFFFFFFFE;
  // a file cut short (a broken download) must not send the reader round in circles: sectors past the end of the file
  // and chains that loop back on themselves stop with a plain reason
  const CUT = 'this .xls file is damaged or incomplete (it ends before its data does). Save it again from Excel, or download it again, and open the new copy.';
  if (u8.length < 512 || ss < 64 || ss > 65536) throw new Error(CUT);
  const sec = id => { const o = (id + 1) * ss; if (o >= u8.length) throw new Error(CUT); return o; };
  const fatSecs = []; for (let i = 0; i < 109; i++) { const v = xlU32(u8, 0x4C + 4 * i); if (v < 0xFFFFFFFA) fatSecs.push(v); }
  let dif = xlU32(u8, 0x44), guard = 0;
  while (dif < 0xFFFFFFFA && guard++ < 10000) { const o = sec(dif); for (let i = 0; i < ss / 4 - 1; i++) { const v = xlU32(u8, o + 4 * i); if (v < 0xFFFFFFFA) fatSecs.push(v); } dif = xlU32(u8, o + ss - 4); }
  const fat = []; for (const fs of fatSecs) { const o = sec(fs); for (let i = 0; i < ss / 4; i++) fat.push(xlU32(u8, o + 4 * i)); }
  const chain = (start, tbl) => { const out = [], seen = new Set(); let c = start; while (c < 0xFFFFFFFA) { if (seen.has(c) || c >= tbl.length) throw new Error(CUT); seen.add(c); out.push(c); c = tbl[c]; } return out; };
  const readBig = (start, size) => { const out = new Uint8Array(size); let k = 0; for (const c of chain(start, fat)) { const o = sec(c), n = Math.min(ss, size - k); if (n <= 0) break; if (o + n > u8.length) throw new Error(CUT); out.set(u8.subarray(o, o + n), k); k += n; } if (k < size) throw new Error(CUT); return out; };
  const dirBytes = readBig(xlU32(u8, 0x30), chain(xlU32(u8, 0x30), fat).length * ss), ents = [];
  for (let o = 0; o + 128 <= dirBytes.length; o += 128) { const nl = xlU16(dirBytes, o + 0x40); let name = ''; for (let i = 0; i + 1 < Math.max(0, nl - 2); i += 2) name += String.fromCharCode(xlU16(dirBytes, o + i)); ents.push({ name, type: dirBytes[o + 0x42], start: xlU32(dirBytes, o + 0x74), size: xlU32(dirBytes, o + 0x78) }); }
  const root = ents.find(e => e.type === 5), ent = ents.find(e => e.type === 2 && /^workbook$/i.test(e.name)) || ents.find(e => e.type === 2 && /^book$/i.test(e.name));
  if (!ent) throw new Error('this .xls file has no Excel workbook inside (it may be a different Office document).');
  if (ent.size >= cutoff || !root) return readBig(ent.start, ent.size);
  // small streams live in the mini stream (64-byte sectors)
  const mini = readBig(root.start, root.size), mfat = []; for (const c of chain(xlU32(u8, 0x3C), fat)) { const o = sec(c); for (let i = 0; i < ss / 4; i++) mfat.push(xlU32(u8, o + 4 * i)); }
  const out = new Uint8Array(ent.size); let k = 0; for (const c of chain(ent.start, mfat)) { const n = Math.min(mss, ent.size - k); if (n <= 0) break; if (c * mss + n > mini.length) throw new Error(CUT); out.set(mini.subarray(c * mss, c * mss + n), k); k += n; }
  if (k < ent.size) throw new Error(CUT);
  return out;
}
function xlsDecoder(cp) {
  const name = cp === 1200 ? 'utf-16le' : cp >= 1250 && cp <= 1258 ? 'windows-' + cp : cp === 10000 || cp === 32768 ? 'macintosh' : cp === 874 ? 'windows-874' : cp === 932 ? 'shift_jis' : cp === 936 ? 'gbk' : cp === 949 ? 'euc-kr' : cp === 950 ? 'big5' : cp === 866 ? 'ibm866' : 'windows-1252';
  try { return new TextDecoder(name); } catch (e) { return new TextDecoder('windows-1252'); }
}
function xlsRK(rk) {
  let v; if (rk & 2) v = (rk >> 2); else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, rk & 0xFFFFFFFC, true); b.setUint32(0, 0, true); v = b.getFloat64(0, true); }
  return rk & 1 ? v / 100 : v;
}
function xlsBook(u8file) {
  const st = xlsCfbStream(u8file), dv = new DataView(st.buffer, st.byteOffset, st.byteLength);
  const recs = []; for (let o = 0; o + 4 <= st.length;) { const t = dv.getUint16(o, true), n = dv.getUint16(o + 2, true); recs.push({ t, o: o + 4, n }); o += 4 + n; }
  let biff = 8, dec = new TextDecoder('windows-1252'), d1904 = false; const fmts = {}, xfFmt = [], sheets = [], sst = [];
  const u16 = o => dv.getUint16(o, true), u32 = o => dv.getUint32(o, true);
  // BIFF8 strings: 16-bit length (or 8-bit for short ones), a flags byte (0x01 = two bytes per character)
  const str8 = (o, lenBytes) => { const cch = lenBytes === 1 ? st[o] : u16(o); let p = o + lenBytes; const fl = st[p++]; let rt = 0, ext = 0; if (fl & 8) { rt = u16(p); p += 2; } if (fl & 4) { ext = u32(p); p += 4; }
    const wide = fl & 1, s = wide ? new TextDecoder('utf-16le').decode(st.subarray(p, p + 2 * cch)) : new TextDecoder('windows-1252').decode(st.subarray(p, p + cch)); return { s, end: p + (wide ? 2 : 1) * cch + 4 * rt + ext }; };
  const strOld = (o, lenBytes) => { const cch = lenBytes === 1 ? st[o] : u16(o); return dec.decode(st.subarray(o + lenBytes, o + lenBytes + cch)); };
  const text = (o, lenBytes) => biff === 8 ? str8(o, lenBytes).s : strOld(o, lenBytes);
  let i = 0;
  // workbook part
  for (; i < recs.length; i++) { const { t, o, n } = recs[i];
    if (t === 0x0809 || t === 0x0209 || t === 0x0409) { const v = u16(o); biff = v === 0x0600 ? 8 : 5; }
    else if (t === 0x0042) { const cp = u16(o); if (biff !== 8) dec = xlsDecoder(cp); }
    else if (t === 0x0022) d1904 = u16(o) === 1;
    else if (t === 0x041E || t === 0x001E) { const id = u16(o); fmts[id] = biff === 8 ? str8(o + 2, 2).s : strOld(o + 2, 1); }
    else if (t === 0x00E0) xfFmt.push(u16(o + 2));
    else if (t === 0x0085) { const pos = u32(o), hid = st[o + 4] !== 0, kind = st[o + 5]; const name = biff === 8 ? str8(o + 6, 1).s : strOld(o + 6, 1); if (kind === 0) sheets.push({ name, hidden: hid, pos }); }
    else if (t === 0x00FC) {
      // shared strings: the SST record and the CONTINUE records after it form one list; a string's characters can run on
      // into the next CONTINUE, which starts with a new flags byte (the characters may switch between 1 and 2 bytes)
      const parts = [{ o, n }]; while (i + 1 < recs.length && recs[i + 1].t === 0x003C) { i++; parts.push({ o: recs[i].o, n: recs[i].n }); }
      let pi = 0, p = parts[0].o + 8, pe = parts[0].o + parts[0].n; const total = u32(parts[0].o + 4);
      const need = () => { while (p >= pe && pi + 1 < parts.length) { pi++; p = parts[pi].o; pe = p + parts[pi].n; } };
      const skip = k => { while (k > 0) { need(); const m = Math.min(k, pe - p); p += m; k -= m; if (m === 0) break; } };
      for (let s = 0; s < total; s++) { need(); if (p >= pe) break;
        const cch = u16(p); p += 2; need(); let fl = st[p++]; let rt = 0, ext = 0; if (fl & 8) { need(); rt = u16(p); p += 2; } if (fl & 4) { need(); ext = u32(p); p += 4; }
        let out = '', left = cch;
        while (left > 0) { need(); if (p >= pe) break; const wide = fl & 1, avail = Math.floor((pe - p) / (wide ? 2 : 1)), k = Math.min(left, avail);
          out += wide ? new TextDecoder('utf-16le').decode(st.subarray(p, p + 2 * k)) : new TextDecoder('windows-1252').decode(st.subarray(p, p + k)); p += k * (wide ? 2 : 1); left -= k;
          if (left > 0) { pi++; if (pi >= parts.length) break; p = parts[pi].o; pe = p + parts[pi].n; fl = st[p++]; } }
        skip(4 * rt + ext); sst.push(out); }
    }
    else if (t === 0x000A) { i++; break; }
  }
  // number formats → which cell styles are dates
  const builtinDate = id => XL_DATE_IDS.has(id) ? (id >= 18 && id <= 21 || id >= 45 && id <= 47 ? (id === 22 ? 'datetime' : 'time') : id === 22 ? 'datetime' : 'date') : null;
  const xfKind = xfFmt.map(id => fmts[id] != null ? xlFmtKind(fmts[id]) : builtinDate(id));
  const byPos = new Map(recs.map((r, k) => [r.o - 4, k]));
  for (const sh of sheets) {
    const g = []; let merged = 0, k = byPos.get(sh.pos); if (k == null) { sh.grid = g; sh.merged = 0; continue; }
    const put = (r, c, v) => { if (v === '' || v == null) return; (g[r] || (g[r] = []))[c] = v; };
    const num = (r, c, x, xf) => { const kd = xfKind[xf]; put(r, c, kd && isFinite(x) ? { d: x, k: kd } : x); };
    let pendingStr = null;
    for (k = k + 1; k < recs.length; k++) { const { t, o, n } = recs[k];
      if (t === 0x000A) break;
      if (t === 0x00FD) put(u16(o), u16(o + 2), sst[u32(o + 6)] ?? '');
      else if (t === 0x0204 || t === 0x00D6) put(u16(o), u16(o + 2), text(o + 6, 2));
      else if (t === 0x0203) num(u16(o), u16(o + 2), dv.getFloat64(o + 6, true), u16(o + 4));
      else if (t === 0x027E || t === 0x007E) num(u16(o), u16(o + 2), xlsRK(u32(o + 6)), u16(o + 4));
      else if (t === 0x00BD) { const r = u16(o), c0 = u16(o + 2), c1 = u16(o + n - 2); for (let c = c0, q = o + 4; c <= c1; c++, q += 6) num(r, c, xlsRK(u32(q + 2)), u16(q)); }
      else if (t === 0x0205 || t === 0x0005) { if (st[o + 7] === 0) put(u16(o), u16(o + 2), st[o + 6] ? 1 : 0); }
      else if (t === 0x0006 || t === 0x0406 || t === 0x0206) { const r = u16(o), c = u16(o + 2), xf = u16(o + 4);
        if (u16(o + 12) === 0xFFFF) { const kind = st[o + 6]; if (kind === 0) pendingStr = [r, c]; else if (kind === 1) put(r, c, st[o + 8] ? 1 : 0); }
        else num(r, c, dv.getFloat64(o + 6, true), xf); }
      else if (t === 0x0207 && pendingStr) { put(pendingStr[0], pendingStr[1], text(o, 2)); pendingStr = null; }
      else if (t === 0x00E5) merged += u16(o);
    }
    sh.grid = g; sh.merged = merged;
  }
  if (!sheets.length) throw new Error('this .xls workbook has no worksheets.');
  return { sheets, d1904 };
}

async function xlWorkbook(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8[0] === 0xD0 && u8[1] === 0xCF && u8[2] === 0x11 && u8[3] === 0xE0) { const B = xlsBook(u8); return { u8, entries: null, sheets: B.sheets.map(s => ({ name: s.name, hidden: s.hidden, grid: s.grid, merged: s.merged })), d1904: B.d1904, xls: true }; }
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
  const sst = [], sstXml = W.xls ? null : await xlRead(W.u8, W.entries, 'xl/sharedStrings.xml');
  if (sstXml) { const re = /<(?:\w+:)?si\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?si>)/g; let m; while ((m = re.exec(sstXml))) sst.push(m[1] ? xlRichText(m[1]) : ''); }
  prog(15);
  const fmtKind = [];
  const stXml = W.xls ? null : await xlRead(W.u8, W.entries, 'xl/styles.xml');
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
    if (W.xls) { const g = W.sheets[si].grid; merged += W.sheets[si].merged; if (g.some(r => r && r.length) || idx >= 0) { grid = g; used = si; break; } continue; }   // .xls: cells already read
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
