// Charts → Map, on the shipped bundle: node --test calculator/tests/map-lab.test.mjs
// The built-in maps (every country's first level, Mexico's states and municipalities), finding the column that names
// the place, matching names and codes, the matching table for a survey's own codes, and the values on the map.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const R = new URL('../', import.meta.url);
const page = fs.readFileSync(new URL('index.html', R), 'utf8');
const manifest = JSON.parse(page.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
const ext = JSON.parse(page.match(/<script type="__bundler\/ext_resources">([\s\S]*?)<\/script>/)[1]);
const mod = id => import('data:text/javascript;base64,' + zlib.gunzipSync(Buffer.from(manifest[ext.find(x => x.id === id).uuid].data, 'base64')).toString('base64'));
const E = await mod('engine'), W = await mod('geo'), A1 = (await mod('maps1')).default, MX = (await mod('mapsmx')).default;
const template = JSON.parse(page.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const code = template.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
class Base { props = {}; setState(p, cb) { this.state = { ...this.state, ...(typeof p === 'function' ? p(this.state) : p) }; cb?.(); } forceUpdate() {} }
globalThis.React = { createElement: (tag, props, ...children) => ({ tag, props: props || {}, children }), Fragment: 'fragment' };
globalThis.window = { innerWidth: 1440 };
globalThis.document = { documentElement: { style: { zoom: '' } } };
const Component = new Function('DCLogic', code + ';return Component')(Base);
const timers = []; const realTimeout = globalThis.setTimeout; globalThis.setTimeout = (f, ms) => { if (!ms) { timers.push(f); return 0; } return realTimeout(f, ms); };
const flat = n => !n ? [] : Array.isArray(n) ? n.flatMap(flat) : typeof n === 'object' ? [n, ...flat(n.children)] : [];
const text = n => n == null ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children);

async function make(csv, extra) {
  const b = Buffer.from(csv), raw = await E.parseCSV(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), () => {});
  return makeRaw(raw, extra);
}
function makeRaw(raw, extra) {
  const c = new Component(); c._E = E; c._raw = raw; c._svgs = {}; c._mlD = { a1: A1, mx: MX, world: W };
  c.state = { ...c.state, screen: 'work', tab: 'plots', fileName: 'data.csv', nRows: raw.n, cols: raw.names.map((_, i) => Object.assign(E.profileCol(raw, i), { idx: i })), autoScreen: false, genTags: {}, treat: {}, plotKind: 'map', csPages: { map: {} }, ...(extra || {}) };
  c.pushLog = d => c.setState(s => ({ conLog: [...(s.conLog || []), d] })); c.flash = t => { c.message = t; };
  return c;
}
function render(c) { const out = c.renderVals(); let k = 0; while (timers.length && k++ < 20) timers.shift()(); const out2 = k ? c.renderVals() : out; const nodes = flat(out2.chartSuiteEl); const svg = nodes.find(n => n.tag === 'svg' && n.props.dangerouslySetInnerHTML); return { out: out2, nodes, text: text(out2.chartSuiteEl), markup: svg ? svg.props.dangerouslySetInnerHTML.__html : '', alerts: nodes.filter(n => n.props && n.props.role === 'alert').map(text) }; }

test('built-in maps: every country\'s first level and Mexico (INEGI 2023), with names in other languages', () => {
  assert.ok(Object.keys(A1.c).length >= 190, 'about two hundred countries');
  const areas = Object.values(A1.c).reduce((t, c) => t + c.t.objects.a.geometries.length, 0); assert.ok(areas > 3000);
  assert.equal(MX.objects.states.geometries.length, 32); assert.equal(MX.objects.mun.geometries.length, 2475);
  const codes = MX.objects.mun.geometries.map(g => g.p.c); assert.equal(new Set(codes).size, 2475); assert.ok(codes.every(c => /^\d{5}$/.test(c)));
  const by = A1.c.DEU.t.objects.a.geometries.find(g => g.p.n === 'Bayern'); assert.ok(by.p.a.includes('Bavaria') && by.p.a.includes('Baviera'));
  const ca = A1.c.USA.t.objects.a.geometries.find(g => g.p.n === 'California'); assert.equal(ca.p.c, '06', 'US FIPS state code');
  assert.equal(A1.c.MNG.t.objects.a.geometries.length, 22);
});

test('matching: INEGI codes in any form, names with or without accents, other names, close spellings', () => {
  const G = E.mlFromTopo(MX, 'mun'), areas = G.feats.map(f => ({ id: f.props.c, name: f.props.n, code: f.props.c }));
  const r = E.mlMatch([{ key: '14039' }, { key: '090070000' }, { key: '9007' }, { key: '1001' }], areas, { codeWidth: 5 });
  assert.equal(areas[r.pick.get('14039')[0]].name, 'Guadalajara'); assert.equal(areas[r.pick.get('090070000')[0]].name, 'Iztapalapa'); assert.equal(areas[r.pick.get('9007')[0]].name, 'Iztapalapa'); assert.equal(areas[r.pick.get('1001')[0]].name, 'Aguascalientes');
  const S = E.mlFromTopo(MX, 'states'), sa = S.feats.map(f => ({ id: f.props.c, name: f.props.n, code: f.props.c, iso: f.props.i, alt: (f.props.a || []).concat(E.ML_ALIAS[f.props.i] || []) }));
  const names = ['CDMX', 'Distrito Federal', 'Estado de México', 'Michoacán', 'Veracruz', 'NUEVO LEON', 'San Luis Potosi', 'Tamaulipas', 'Queretaro', 'Yucatán', 'Coahuila de Zaragoza', 'Chihuahau'];
  const m = E.mlMatch(names.map(k => ({ key: k })), sa, { codeWidth: 2 });
  assert.deepEqual(m.unmatched, [], 'every spelling recognised');
  const nm = k => sa[m.pick.get(k)[0]].code;
  assert.equal(nm('CDMX'), '09'); assert.equal(nm('Distrito Federal'), '09'); assert.equal(nm('Estado de México'), '15'); assert.equal(nm('Chihuahau'), '08'); assert.equal(m.how.get('Chihuahau'), 'close');
  const n2 = E.mlMatch(['1', '24', '28', '32'].map(k => ({ key: k })), sa, { codeWidth: 2 });
  assert.equal(sa[n2.pick.get('28')[0]].name, 'Tamaulipas'); assert.equal(sa[n2.pick.get('24')[0]].name, 'San Luis Potosí');
});

test('a survey\'s own numbers are not taken for official codes (Mongolia 1–10), and the matching table fixes them once', async () => {
  let s = 5; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
  const lines = ['region,income,poor']; for (let i = 0; i < 500; i++) lines.push([1 + (i % 10), Math.round(100 + rnd() * 900), rnd() < 0.3 ? 1 : 0].join(','));
  const c = await make(lines.join('\n'));
  c.state.csPages.map = { scope: 'country', country: 'MNG', id: 'region', stat: 'mean', y: 'income' };
  let r = render(c);
  assert.match(r.text, /0 of 10/, 'none of the ten numbers is taken as a province');
  assert.match(r.text, /seem to be the data.s own codes/, 'it says why');
  const sel = c.mlSel(c.cbC());
  const pickFor = key => r.nodes.find(n => (n.tag === 'select' || n.props?.role === 'combobox') && n.props['aria-label'] === 'Place for ' + key); // build .70: a searchable box
  assert.ok(pickFor('1'), 'a place list for each number');
  const uvs = sel.areas.find(a => a.name === 'Uvs').id;
  pickFor('1').props.onFocus(); r = render(c); r.nodes.find(n => n.props?.role === 'option' && n.props['data-value'] === String(uvs)).props.onMouseDown({ preventDefault() {} });
  assert.equal(c._raw.vlabs.region.get(1), 'Uvs', 'saved as a value label');
  assert.ok((c.state.conLog || []).some(d => d.stata === 'label define region_lb 1 "Uvs", modify'));
  // the other nine from a pasted list (a codebook)
  r = render(c);
  c._mlPasteEl = { value: '2\tKhovd\n3\tZavkhan\n4, Bulgan\n5; Dornogovi\n6,Ulaanbaatar\n7,Selenge\n8,Khentii\n9,Dornod\n10,Ömnögovi' };
  r.nodes.find(n => n.tag === 'button' && text(n) === 'Use this list').props.onClick();
  r = render(c);
  assert.match(r.text, /10 of 10/, 'all ten placed'); assert.ok(r.markup.length > 1000, 'the map is drawn');
  assert.equal(c._raw.vlabs.region.get(6), 'Ulaanbaatar');
  const M = c.mlMatchSel(c.mlSel(c.cbC()), c.cbC()), A = c.mlAgg(c.mlSel(c.cbC()), c.cbC(), M);
  const fi = sel.areas.findIndex(a => a.name === 'Khovd'), want = lines.slice(1).map(l => l.split(',').map(Number)).filter(x => x[0] === 2);
  assert.ok(Math.abs(A.values[fi] - want.reduce((t, x) => t + x[1], 0) / want.length) < 1e-9, 'mean income in Khovd');
  assert.equal(A.n[fi], want.length);
});

test('one number for a group of areas: the group gets one value and no borders inside it', async () => {
  const lines = ['zone,y']; for (let i = 0; i < 40; i++) lines.push([1 + (i % 2), i % 2 ? 10 : 20].join(','));
  const c = await make(lines.join('\n'));
  c.state.csPages.map = { scope: 'country', country: 'MNG', id: 'zone', stat: 'mean', y: 'y', gmode: { zone: true } };
  const sel = c.mlSel(c.cbC()), id = n => sel.areas.find(a => a.name === n).id;
  c.mlRemember('zone', [['1', [id('Uvs'), id('Khovd'), id('Zavkhan')]], ['2', [id('Dornod'), id('Khentii')]]], sel);
  const r = render(c);
  assert.match(r.text, /2 of 2/); assert.match(r.text, /5 of 22 areas have data/);
  const M = c.mlMatchSel(sel, c.cbC()), A = c.mlAgg(sel, c.cbC(), M);
  for (const n of ['Uvs', 'Khovd', 'Zavkhan']) assert.equal(A.values[sel.areas.findIndex(a => a.name === n)], 20);
  assert.equal(A.values[sel.areas.findIndex(a => a.name === 'Dornod')], 10);
});

test('CONEVAL-like file: nothing is picked by itself (build .97); picking ent fits Mexico\'s states; % in poverty, weighted, latest year; municipalities from ubica_geo', async () => {
  let s = 9; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
  const munis = ['14039', '090070000', '12001', '28032', '24028', '20067', '07101', '19039'];
  const lines = ['folio,ent,ubica_geo,year,pobreza,factor,edad']; for (let i = 0; i < 4000; i++) { const u = munis[i % munis.length], e = +u.slice(0, 2); lines.push([i, e, u, 2016 + 2 * (i % 4), rnd() < 0.2 + e / 60 ? 1 : 0, 100 + Math.floor(rnd() * 900), 18 + (i % 60)].join(',')); }
  const c = await make(lines.join('\n'), { weightVar: 'factor' });
  const al = c.autoLabels(c._raw, 'coneval.csv'); assert.ok(al.some(x => x.name === 'ent'));
  let r = render(c); assert.equal(c.cbC().id || '', '', 'no place column picked by itself'); assert.equal(c.cbC().y, undefined, 'no variable picked by itself'); assert.match(r.text, /Pick the column that names or codes the place/);
  assert.ok(r.nodes.some(n => n.props && n.props['aria-label'] === 'Which column says the place?'), 'the place list');
  c.mlPickPlace('ent'); r = render(c); assert.match(r.text, /Pick the variable to show on the map/);
  c.cbSet({ stat: 'pct', y: 'pobreza' }); r = render(c); const cfg = c.cbC();
  assert.equal(cfg.id, 'ent'); assert.equal(cfg.country, 'MEX'); assert.equal(+cfg.level, 1);
  assert.match(r.text, /8 of 8/); assert.match(r.text, /INEGI codes/); assert.deepEqual(r.alerts, []);
  assert.match(r.markup, /% where pobreza = 1 by state, Mexico, 2022/); c.cbSet({ level: 2, id: 'ubica_geo' }); assert.match(render(c).markup, /by municipality, Mexico/); c.cbSet({ level: 1, id: 'ent' }); r = render(c); assert.match(r.markup, /weighted by factor/);
  // the value for Tamaulipas (28) in 2022, weighted, equals a direct count
  const rows = lines.slice(1).map(l => l.split(',')), sel = c.mlSel(c.cbC()), M = c.mlMatchSel(sel, c.cbC());
  const A = c.mlAgg(sel, Object.assign({}, c.cbC(), { yearVar: 'year', year: '2022' }), M), fi = sel.areas.findIndex(a => a.code === '28');
  let sw = 0, s1 = 0; for (const x of rows) if (+x[1] === 28 && x[3] === '2022') { sw += +x[5]; s1 += +x[5] * (+x[4] === 1 ? 1 : 0); }
  assert.ok(Math.abs(A.values[fi] - 100 * s1 / sw) < 1e-9);
  // all years together, unweighted
  const A2 = c.mlAgg(sel, Object.assign({}, c.cbC(), { yearVar: 'year', year: 'all', wt: false }), M); let n = 0, k = 0; for (const x of rows) if (+x[1] === 28) { n++; k += +x[4]; }
  assert.ok(Math.abs(A2.values[fi] - 100 * k / n) < 1e-9); assert.equal(A2.n[fi], n);
  // municipalities from ubica_geo (5 and 9 digits), state borders on top, only in one state
  c.cbSet({ level: 2, id: 'ubica_geo' }); r = render(c);
  assert.match(r.text, /8 of 8/); assert.match(r.markup, /stroke="#3D3629"/, 'state borders drawn over municipalities');
  const s2 = c.mlSel(c.cbC()), M2 = c.mlMatchSel(s2, c.cbC()), iz = s2.areas.findIndex(a => a.code === '09007');
  assert.equal(s2.areas[iz].name, 'Iztapalapa'); assert.ok([...M2.pick.values()].some(l => l.includes(iz)), '090070000 (read as the number 90070000) is Iztapalapa');
  c.cbSet({ focus: '14' }); r = render(c); assert.match(r.markup, /Guadalajara/); assert.doesNotMatch(r.markup, /Iztapalapa/);
});

test('names of other countries\' provinces, US FIPS numbers, and the world map', async () => {
  const c = await make('land,v\nBavaria,1\nBerlin,2\nBaviera,3\nHamburg,4\nSaxony,5\nNordrhein-Westfalen,6\nBrandenburg,7\nBremen,8');
  let r = render(c); c.mlPickPlace('land'); r = render(c); assert.equal(c.cbC().country, 'DEU', 'Germany found from the names'); assert.equal(c.cbC().id, 'land');
  c.cbSet({ stat: 'mean', y: 'v' }); r = render(c); assert.match(r.text, /8 of 8/); assert.match(r.markup, /Mean of v by/);
  const u = await make('st,v\n6,1\n48,2\n36,3\n12,4\n17,5\n1,6');
  u.state.csPages.map = { scope: 'country', country: 'USA', id: 'st', stat: 'mean', y: 'v' }; r = render(u);
  assert.match(r.text, /6 of 6/); assert.match(r.text, /FIPS codes/);
  assert.match(r.markup, />Alaska</, 'Alaska in its own box');
  const w = await make('country,gdp\nMexico,1\nBrasil,2\nEstados Unidos,3\nDEU,4\nFrance,5\nJapan,6\nKenya,7');
  r = render(w); w.mlPickPlace('country'); r = render(w); assert.equal(w.cbC().scope, 'world');
  w.cbSet({ stat: 'mean', y: 'gdp' }); r = render(w); assert.match(r.text, /7 of 7/); assert.deepEqual(r.alerts, []); assert.ok(r.markup.length > 5000);
  w.cbSet({ region: 'latam' }); r = render(w); assert.ok(r.markup.length > 1000);
});

test('your own boundary file (GeoJSON), the older boundary page, colors and classes', async () => {
  const sq = (x, y) => [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]];
  const gj = { type: 'FeatureCollection', features: [['North', 0, 1], ['South', 0, 0], ['East', 1, 0], ['West', -1, 0]].map(([n, x, y]) => ({ type: 'Feature', properties: { zona: n, cod: n[0] }, geometry: { type: 'Polygon', coordinates: sq(x, y) } })) };
  const c = await make('zona,v\nNorth,1\nSouth,2\nEast,3\nWest,4');
  c.state.csPages.geomap = { x: 'zona', y: 'v', geo: gj, geoKey: 'zona' }; c.state.plotKind = 'geomap';
  let r = render(c); assert.match(r.text, /My own boundary file/); assert.match(r.text, /4 of 4/); assert.equal((r.markup.match(/<path d="M/g) || []).length >= 4, true);
  // classes: quantiles, equal steps, natural breaks, own cut points
  assert.deepEqual(E.mlBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'equal', 2), [5.5]);
  assert.deepEqual(E.mlBreaks([1, 1, 2, 2, 10, 11, 12, 30, 31, 33], 'jenks', 3), [2, 12]);
  assert.deepEqual(E.mlBreaks([1, 2, 3, 4, 5], 'custom', 0, '2.5, 4'), [2.5, 4]);
  c.cbSet({ classes: 'custom', breaks: '2.5', scheme: 'blues' }); r = render(c); assert.deepEqual(r.alerts, []);
  const sc = E.cbScene({ type: 'map', geo: E.mlFromGeoJSON(gj), scope: 'country', values: [1, 2, 3, 4], n: [5, 50, 50, 50], names: ['N', 'S', 'E', 'W'], valueTitle: 'v' }, { minN: 30 });
  assert.ok(sc.hatched, 'an area with too few observations is hatched'); assert.match(sc.markup, /Fewer than 30 observations/);
  assert.ok(!/NaN|undefined/.test(sc.markup));
});
