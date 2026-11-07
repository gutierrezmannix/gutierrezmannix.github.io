// Every data format the calculator opens (build .88): node --test calculator/tests/file-formats.test.mjs
// The files in tests/data/formats were written by real software (R haven / foreign / writexl, LibreOffice, a BIFF5
// writer for Excel 5.0/95) from one 40-row dataset, kept in truth.json. Each one is read with the shipped readers
// and compared with the truth: Excel 5.0/95 (1993) and 97–2003 .xls, .xlsx, Stata 6 (108) to Stata 15+ (119),
// a Latin-1 Stata 12 file, SPSS .sav (uncompressed and compressed) and .zsav, CSV with old-Mac CR line endings,
// Windows-1252 and semicolon/decimal-comma CSV, and Excel's Unicode text (UTF-16, with no byte-order mark, and big-endian).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const E = await import('data:text/javascript;base64,' + gunzipSync(Buffer.from(manifest['7f0c6180-e6c1-4faf-bd4a-6b2fddc15715'].data, 'base64')).toString('base64'));
const dir = new URL('./data/formats/', import.meta.url);
const truth = JSON.parse(fs.readFileSync(new URL('truth.json', dir), 'utf8'));
const read = async f => {
  const b = fs.readFileSync(new URL(f, dir)), buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  if (/\.dta$/.test(f)) return E.parseDTA(buf, () => {});
  if (/\.xlsx?$/.test(f)) return E.parseXLSX(buf, () => {});
  if (/\.z?sav$/.test(f)) return E.parseSAV(buf, () => {});
  return E.parseCSV(buf, () => {});
};
// the value shown on the page: value labels replace codes
const shown = (raw, name, r) => {
  const i = raw.names.findIndex(n => n.toLowerCase() === name); if (i < 0) return undefined;
  const v = raw.cols[i].a[r], lab = raw.vlabs && raw.vlabs[raw.names[i]];
  const lv = lab ? (lab instanceof Map ? lab.get(v) : lab[v]) : null;
  return v != null && lv != null ? lv : v;
};
const same = (nm, got, want) => {
  if (want == null) return got == null || got === '' || got === 'NA' || (typeof got === 'number' && !Number.isFinite(got)); // text formats keep "NA" as written
  if (nm === 'flag') return [want, +want, String(want), String(want).toUpperCase(), String(+want)].some(w => String(w) === String(got));
  if (nm === 'date' && typeof got === 'number') return new Date(Date.UTC(1960, 0, 1) + got * 864e5).toISOString().slice(0, 10) === want; // foreign writes plain day numbers
  if (nm === 'zip' && typeof got === 'number') return got === +want; // an all-digit column is read as numbers, as read.csv and import delimited do ("04182" → 4182)
  if (typeof want === 'number') return Math.abs(+String(got).replace(',', '.') - want) < 1e-6;
  return String(got) === String(want);
};
const CASES = {
  'biff5-excel5-1993.xls': 'Excel 5.0/95 (BIFF5, 1993)',
  'biff8-excel97-2003.xls': 'Excel 97–2003 (BIFF8)',
  'xlsx-writexl.xlsx': 'Excel .xlsx',
  'dta-foreign-v6.dta': 'Stata 6 (release 108)',
  'dta-foreign-v7.dta': 'Stata 7 (release 110)',
  'dta-haven-v8.dta': 'Stata 8–9 (release 113)',
  'dta-haven-v12.dta': 'Stata 10–12 (release 115)',
  'dta-haven-v15.dta': 'Stata 15+ (release 119)',
  'sav-uncompressed.sav': 'SPSS .sav, uncompressed',
  'sav-bytecode.sav': 'SPSS .sav, compressed',
  'sav-zsav.zsav': 'SPSS .zsav',
  'csv-mac-cr.csv': 'CSV with old-Mac CR line endings',
  'csv-win1252.csv': 'CSV in Windows-1252',
  'csv-semicolon-decimal-comma.csv': 'CSV with ; and decimal commas',
  'txt-utf16-excel-unicode.txt': 'Excel Unicode text (UTF-16 LE, no byte-order mark)',
  'txt-utf16be.txt': 'UTF-16 big-endian text',
};
for (const [f, what] of Object.entries(CASES)) {
  test(what + ' — ' + f, async () => {
    const raw = await read(f);
    assert.equal(raw.n, truth.length, 'rows');
    for (const nm of ['id', 'name', 'party', 'income', 'share', 'votes', 'zip', 'date', 'flag'])
      for (let r = 0; r < truth.length; r++) {
        const got = shown(raw, nm, r);
        assert.notEqual(got, undefined, 'column ' + nm);
        assert.ok(same(nm, got, truth[r][nm]), nm + '[' + (r + 1) + '] ' + JSON.stringify(got) + ' ≠ ' + JSON.stringify(truth[r][nm]));
      }
    const lt = shown(raw, 'longtext', 0) ?? shown(raw, 'long', 0); // haven needs "longtext" ("long" is reserved in Stata); foreign's Stata 6–7 files have no long column
    if (/foreign/.test(f)) assert.equal(lt, undefined);
    else assert.equal(lt, truth[0].longtext.slice(0, /v(8|12)\.dta$/.test(f) ? 120 : /biff5/.test(f) ? 255 : 1e4).trimEnd(), 'long text kept'); // cut when written: Stata 8–12 copies to 120 characters (244-byte limit), Excel 5.0 cells hold 255 (readxl reads the same)
  });
}

test('a Latin-1 Stata 12 file keeps its accents', async () => {
  const raw = await read('dta-latin1-stata12.dta');
  assert.equal(raw.n, 40);
  assert.deepEqual(raw.cols[1].a.slice(0, 3), ['Peña Nieto', 'José Müller', 'Zoë']);
});

test('SPSS variable labels and value labels come through', async () => {
  for (const f of ['sav-uncompressed.sav', 'sav-bytecode.sav', 'sav-zsav.zsav']) {
    const raw = await read(f), i = raw.names.indexOf('party');
    assert.equal(raw.labels[i], 'Political party', f);
    assert.equal(raw.labels[raw.names.indexOf('income')], 'Household income', f);
    assert.deepEqual([...raw.vlabs.party].slice(0, 4), [[1, 'Morena'], [2, 'PAN'], [3, 'PRD'], [4, 'PRI']], f);
  }
});

test('a file cut short (a broken download) gets a plain reason, never made-up rows or a frozen page', async () => {
  for (const f of ['biff5-excel5-1993.xls', 'biff8-excel97-2003.xls', 'dta-foreign-v6.dta', 'dta-haven-v12.dta', 'dta-haven-v15.dta', 'sav-bytecode.sav', 'sav-zsav.zsav']) {
    const whole = fs.readFileSync(new URL(f, dir));
    for (const len of [100, Math.floor(whole.length / 2)]) {
      const b = whole.subarray(0, len), buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
      const fn = /\.dta$/.test(f) ? E.parseDTA : /\.xls$/.test(f) ? E.parseXLSX : E.parseSAV;
      await assert.rejects(fn(buf, () => {}), /damaged or incomplete/, f + ' cut to ' + len + ' bytes');
    }
  }
});
