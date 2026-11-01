// Pack the built-in maps into src/maps/*.json.gz (embedded in the page by tools/build.py as lazily loaded modules).
//
//   node calculator/tools/maps/pack.mjs <work dir>
//
// <work dir> holds what tools/maps/fetch-adm1.mjs and the Mexico step produced (see tools/maps/README.md):
//   adm1/<ISO3>.topojson   first level of every country (geoBoundaries gbOpen, simplified for whole-country maps)
//   meta.csv               geoBoundaries metadata (level names, licenses)
//   ne1-props.json         Natural Earth admin-1 attributes (names in other languages, HASC, FIPS, ISO codes)
//   mx.topojson            Mexico: municipalities (CVEGEO, NOMGEO) and states (CVE_ENT, NOM_ENT), INEGI 2023
//
// Output: src/maps/adm1.json.gz  { v, c: { ISO3: { lv, cn, lic, t: TopoJSON } } }   area properties: n name, i ISO 3166-2,
//         a alternate names, c national code (USA: FIPS state code)
//         src/maps/mex.json.gz   TopoJSON with objects mun { c: CVEGEO, n } and states { c: CVE_ENT, n, i, a }
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const work = process.argv[2]; if (!work) { console.error('usage: node pack.mjs <work dir>'); process.exit(1); }
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../src/maps');
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const GEN = /\b(state|province|region|prefecture|oblast|krai|kray|okrug|republic|of|governorate|department|county|district|autonomous|city|municipality|the|de|del|la|el)\b/g;
const core = s => norm(s).replace(GEN, ' ').replace(/\s+/g, ' ').trim() || norm(s);
const sim = (a, b) => { if (a === b) return 1; const m = a.length, n = b.length; if (!m || !n) return 0; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return 1 - prev[n] / Math.max(m, n); };
const latin = s => s && /[a-zA-Z]/.test(s) && !/[Ѐ-ӿ؀-ۿ぀-ヿ一-鿿가-힯฀-๿ऀ-ॿ]/.test(s);
// CSV
const csv = fs.readFileSync(path.join(work, 'meta.csv'), 'utf8').split(/\r?\n/), head = csv[0].split(',');
const parse = line => { const r = []; let cur = '', q = false; for (const ch of line) { if (q) { if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; };
const meta = csv.slice(1).filter(Boolean).map(l => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const NE = JSON.parse(fs.readFileSync(path.join(work, 'ne1-props.json'), 'utf8'));
const neBy = new Map(); for (const p of NE) { const k = p.adm0_a3; if (!neBy.has(k)) neBy.set(k, []); neBy.get(k).push(p); }
const altOf = (p, own) => { const out = new Set(), ownN = norm(own); for (const k of ['name_en', 'name_es', 'name_fr', 'name_pt', 'name_de', 'name_it', 'name', 'gn_name', 'woe_name', 'name_local']) { const v = p[k]; if (latin(v)) out.add(v); } for (const v of String(p.name_alt || '').split('|')) if (latin(v)) out.add(v.trim()); const seen = new Set([ownN]); return [...out].filter(v => { const n = norm(v); if (!n || seen.has(n)) return false; seen.add(n); return true; }); };
function enrich(iso3, areas) { // areas: [{ n, i }] → adds a (alternate names), i (ISO when missing), c (USA FIPS)
  const ne = neBy.get(iso3) || []; let joined = 0;
  for (const a of areas) {
    let p = a.i && /-/.test(a.i) ? ne.find(x => String(x.iso_3166_2).toUpperCase() === String(a.i).toUpperCase()) : null;
    if (!p) { const c = core(a.n); let best = 0, bp = null; for (const x of ne) for (const nm of [x.name, x.name_en, x.name_es, x.gn_name, x.woe_name, ...String(x.name_alt || '').split('|')]) { if (!nm) continue; const s = sim(c, core(nm)); if (s > best) { best = s; bp = x; } } if (best >= 0.86) p = bp; }
    if (!p) continue; joined++;
    const alt = altOf(p, a.n); if (alt.length) a.a = alt.slice(0, 8);
    if ((!a.i || !/-/.test(a.i)) && p.iso_3166_2 && /-/.test(p.iso_3166_2)) a.i = p.iso_3166_2;
    if (iso3 === 'USA' && /^US\d\d$/.test(p.fips || '')) a.c = p.fips.slice(2);
  }
  return joined;
}
// first level, every country (Mexico comes from INEGI below)
const c = {}; let areasN = 0, joinedN = 0;
for (const f of fs.readdirSync(path.join(work, 'adm1')).filter(f => f.endsWith('.topojson')).sort()) {
  const iso3 = f.slice(0, 3); if (iso3 === 'MEX') continue;
  const t = JSON.parse(fs.readFileSync(path.join(work, 'adm1', f), 'utf8')), ob = Object.values(t.objects)[0];
  const areas = ob.geometries.map(g => ({ n: g.properties.shapeName || '', i: g.properties.shapeISO && g.properties.shapeISO !== iso3 ? g.properties.shapeISO : '' }));
  joinedN += enrich(iso3, areas); areasN += areas.length;
  ob.geometries.forEach((g, k) => { const a = areas[k]; g.p = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== '' && v != null)); delete g.properties; });
  const m = meta.find(r => r.boundaryISO === iso3 && r.boundaryType === 'ADM1') || {};
  delete t.bbox; delete t.type; t.objects = { a: { geometries: ob.geometries } };
  c[iso3] = { lv: m.boundaryCanonical || '', cn: m.boundaryName && !/^unknown$/i.test(m.boundaryName) ? m.boundaryName : '', lic: m.boundaryLicense || '', yr: m.boundaryYearRepresented || '', t };
}
fs.mkdirSync(OUT, { recursive: true });
const adm1 = JSON.stringify({ v: 1, src: 'geoBoundaries gbOpen ADM1 (wmgeolab.org), names in other languages from Natural Earth admin-1', c });
fs.writeFileSync(path.join(OUT, 'adm1.json.gz'), zlib.gzipSync(adm1, { level: 9 }));
console.log('adm1:', Object.keys(c).length, 'countries,', areasN, 'areas,', joinedN, 'with alternate names;', (fs.statSync(path.join(OUT, 'adm1.json.gz')).size / 1024).toFixed(0), 'KB');
// Mexico: INEGI 2023 states and municipalities
const mx = JSON.parse(fs.readFileSync(path.join(work, 'mx.topojson'), 'utf8'));
// ISO 3166-2 codes of Mexico's states by INEGI code (INEGI's long names, e.g. "Veracruz de Ignacio de la Llave", do not
// always match Natural Earth's short ones, so the ISO code is set here and the other names are joined by it)
const MXISO = ['AGU', 'BCN', 'BCS', 'CAM', 'COA', 'COL', 'CHP', 'CHH', 'CMX', 'DUR', 'GUA', 'GRO', 'HID', 'JAL', 'MEX', 'MIC', 'MOR', 'NAY', 'NLE', 'OAX', 'PUE', 'QUE', 'ROO', 'SLP', 'SIN', 'SON', 'TAB', 'TAM', 'TLA', 'VER', 'YUC', 'ZAC'];
const st = mx.objects.states.geometries.map(g => ({ n: g.properties.NOM_ENT, i: 'MX-' + MXISO[+g.properties.CVE_ENT - 1] }));
enrich('MEX', st);
mx.objects.states.geometries.forEach((g, k) => { g.p = Object.fromEntries(Object.entries({ c: g.properties.CVE_ENT, n: g.properties.NOM_ENT, i: st[k].i, a: st[k].a }).filter(([, v]) => v != null && v !== '')); delete g.properties; });
mx.objects.mun.geometries.forEach(g => { g.p = { c: g.properties.CVEGEO, n: g.properties.NOMGEO }; delete g.properties; });
delete mx.bbox; delete mx.type; mx.src = 'INEGI Marco Geoestadístico 2023 (via CONABIO / PhantomInsights mexico-geojson), simplified';
fs.writeFileSync(path.join(OUT, 'mex.json.gz'), zlib.gzipSync(JSON.stringify(mx), { level: 9 }));
console.log('mex:', mx.objects.states.geometries.length, 'states,', mx.objects.mun.geometries.length, 'municipalities;', (fs.statSync(path.join(OUT, 'mex.json.gz')).size / 1024).toFixed(0), 'KB');
