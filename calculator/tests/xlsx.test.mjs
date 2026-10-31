// Excel reader tests: node --test calculator/tests/xlsx.test.mjs
// Optional real workbook: GM26_TEST_XLSX=/path/file.xlsx node --test calculator/tests/xlsx.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '../src/xlsx-reader.mjs'), 'utf8');
const mod = await import('data:text/javascript;base64,' + Buffer.from(src + '\nexport { xlInflateJS as __inflateJS };').toString('base64'));
const { parseXLSX, xlsxSheets, __inflateJS } = mod;

const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = d => { let c = 0xFFFFFFFF; for (const b of d) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
// minimal ZIP writer; deflate=true compresses entries like Excel does
function zip(files, deflate) {
  const parts = [], cd = []; let off = 0;
  const u16 = v => Buffer.from([v & 255, (v >> 8) & 255]), u32 = v => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8'), body = deflate ? zlib.deflateRawSync(data) : data, nm = Buffer.from(name), c = crc(data), m = deflate ? 8 : 0;
    const lh = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(m), u16(0), u16(0), u32(c), u32(body.length), u32(data.length), u16(nm.length), u16(0), nm]);
    cd.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(m), u16(0), u16(0), u32(c), u32(body.length), u32(data.length), u16(nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), nm]));
    parts.push(lh, body); off += lh.length + body.length;
  }
  const cdb = Buffer.concat(cd);
  const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(cd.length), u16(cd.length), u32(cdb.length), u32(off), u16(0)]);
  const b = Buffer.concat([...parts, cdb, end]);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
}
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
function book({ sheets, sst = [], styles = '', d1904 = false, prefix = '' }) {
  const p = prefix ? prefix + ':' : '';
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><${p}workbook ${prefix ? NS.replace('xmlns=', 'xmlns:' + prefix + '=') : NS}><${p}workbookPr${d1904 ? ' date1904="1"' : ''}/><${p}sheets>` + sheets.map((s, i) => `<${p}sheet name="${s.name}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('') + `</${p}sheets></${p}workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + '</Relationships>',
    'xl/styles.xml': `<?xml version="1.0"?><styleSheet ${NS}>${styles}</styleSheet>`
  };
  if (sst.length) files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst ${NS} count="${sst.length}" uniqueCount="${sst.length}">` + sst.map(s => `<si>${s}</si>`).join('') + '</sst>';
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><${p}worksheet ${prefix ? NS.replace('xmlns=', 'xmlns:' + prefix + '=') : NS}><${p}sheetData>${s.xml}</${p}sheetData></${p}worksheet>`; });
  return files;
}
const STY = '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="165" formatCode="&quot;Total &quot;0.00"/></numFmts><cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="21"/></cellXfs>';

test('reads a typical workbook: shared strings, dates, numbers, booleans, errors', async () => {
  const files = book({
    sheets: [{ name: 'Notes', xml: '' }, { name: 'Data', xml:
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="inlineStr"><is><t>Flag</t></is></c><c r="E1" t="str"><f>"Score"</f><v>Score</v></c><c r="F1" t="s"><v>5</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" s="1"><v>45700</v></c><c r="C2" s="2"><v>45700.5</v></c><c r="D2" t="b"><v>1</v></c><c r="E2"><v>3.5</v></c><c r="F2" s="4"><v>0.75</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3" s="1"><v>60</v></c><c r="C3" s="2"><v>1</v></c><c r="D3" t="b"><v>0</v></c><c r="E3" t="e"><v>#DIV/0!</v></c></row>' +
      '<row r="4"><c r="B4" s="3"><v>2</v></c></row>' +
      '<row r="5"/>' +
      '<row r="7"><c r="A7" t="inlineStr"><is><r><t>rich </t></r><r><t xml:space="preserve">text &amp; more</t></r></is></c><c r="E7"><v>-1E-3</v></c></row>' }],
    sst: ['<t>Name</t>', '<t>Day</t>', '<t>Stamp</t>', '<t>Línea 1_x000D_\nlínea 2 &lt;ok&gt;</t>', '<r><t>Jos</t></r><r><t>é</t></r><rPh sb="0" eb="1"><t>ホセ</t></rPh>', '<t>Clock</t>'],
    styles: STY
  });
  for (const deflate of [false, true]) {
    const d = await parseXLSX(zip(files, deflate));
    assert.equal(d.xlsx.sheet, 'Data', 'skips the empty first sheet');
    assert.deepEqual(d.names, ['Name', 'Day', 'Stamp', 'Flag', 'Score', 'Clock']);
    assert.equal(d.n, 4, 'empty rows are dropped, gaps between rows are not data');
    assert.deepEqual(d.cols[0].a, ['Línea 1\r\nlínea 2 <ok>', 'José', '', 'rich text & more']);
    assert.deepEqual(d.cols[1].a, ['2025-02-12', '1900-02-28', '2', '']);
    assert.deepEqual(d.cols[2].a, ['2025-02-12 12:00:00', '1900-01-01 00:00:00', '', '']);
    assert.equal(d.cols[3].k, 'n'); assert.deepEqual(Array.from(d.cols[3].a).map(v => isNaN(v) ? null : v), [1, 0, null, null]);
    assert.equal(d.cols[4].k, 'n'); assert.deepEqual(Array.from(d.cols[4].a).map(v => isNaN(v) ? null : v), [3.5, null, null, -0.001]);
    assert.deepEqual(d.cols[5].a, ['18:00:00', '', '', '']);
  }
});

test('1904 date system, hidden sheets, sheet choice and prefixed XML', async () => {
  const files = book({ d1904: true, prefix: 'x', styles: STY, sheets: [
    { name: 'Hidden', hidden: true, xml: '<x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>secret</x:t></x:is></x:c></x:row><x:row r="2"><x:c r="A2"><x:v>1</x:v></x:c></x:row>' },
    { name: 'Visible', xml: '<x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>When</x:t></x:is></x:c><x:c r="C1" t="inlineStr"><x:is><x:t>N</x:t></x:is></x:c></x:row><x:row r="2"><x:c r="A2" s="1"><x:v>0</x:v></x:c><x:c r="C2"><x:v>7</x:v></x:c></x:row>' }] });
  const buf = zip(files, true);
  const sheets = await xlsxSheets(buf);
  assert.deepEqual(sheets, [{ name: 'Hidden', hidden: true }, { name: 'Visible', hidden: false }]);
  const d = await parseXLSX(buf);
  assert.equal(d.xlsx.sheet, 'Visible', 'prefers visible sheets');
  assert.deepEqual(d.names, ['When', 'var2', 'N']);
  assert.deepEqual(d.cols[0].a, ['1904-01-01']);
  const h = await parseXLSX(buf, null, { sheet: 'Hidden' });
  assert.deepEqual(h.names, ['secret']); assert.equal(h.cols[0].a[0], 1);
});

test('clear messages for files that are not .xlsx workbooks', async () => {
  const xls = new Uint8Array(64); xls.set([0xD0, 0xCF, 0x11, 0xE0]);
  await assert.rejects(parseXLSX(xls.buffer), /97–2003/);
  await assert.rejects(parseXLSX(zip({ 'content.xml': '<x/>', 'mimetype': 'application/vnd.oasis.opendocument.spreadsheet' })), /OpenDocument/);
  await assert.rejects(parseXLSX(zip({ 'a.txt': 'hi' })), /does not contain an Excel workbook/);
});

test('the pure-JS inflate matches zlib (fallback for browsers without DecompressionStream)', () => {
  const text = 'Becaremos a tod@s l@s estudiantes — ñandú, “México”. '.repeat(400) + Array.from({ length: 3000 }, (_, i) => (i * 7919) % 1000).join(',');
  for (const level of [0, 1, 6, 9]) {
    const out = __inflateJS(new Uint8Array(zlib.deflateRawSync(Buffer.from(text), { level })));
    assert.equal(Buffer.from(out).toString('utf8'), text);
  }
});

const real = process.env.GM26_TEST_XLSX;
test('real workbook loads completely', { skip: !real && 'set GM26_TEST_XLSX to run' }, async () => {
  const b = fs.readFileSync(real), d = await parseXLSX(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  assert.ok(d.n > 0 && d.names.length > 0);
  console.log('  ', path.basename(real), '→', d.n, 'rows ×', d.names.length, 'columns:', d.names.join(', '), '| sheet', d.xlsx.sheet, '| cells at the 32,767 limit:', d.xlsx.longCells);
});
