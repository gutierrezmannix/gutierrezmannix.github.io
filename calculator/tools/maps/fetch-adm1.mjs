// Download geoBoundaries gbOpen ADM1 (simplified) for every country, simplify in proportion to the country's size,
// and write one TopoJSON per country (fields: shapeName, shapeISO).
// Usage: MAPSHAPER=<path> node calculator/tools/maps/fetch-adm1.mjs <meta.csv> <outdir> [ISO,ISO]   (see README.md)
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
const [meta, out, only] = process.argv.slice(2);
const MS = process.env.MAPSHAPER || 'mapshaper';   // MAPSHAPER=/path/to/node_modules/.bin/mapshaper
const csv = fs.readFileSync(meta, 'utf8').split(/\r?\n/), head = csv[0].split(',');
const parse = line => { const r = []; let cur = '', q = false; for (const ch of line) { if (q) { if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; };
const rows = csv.slice(1).filter(Boolean).map(l => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
const want = only ? new Set(only.split(',')) : null;
const list = rows.filter(r => r.boundaryType === 'ADM1' && (!want || want.has(r.boundaryISO)));
const tmp = path.join(out, '_tmp.geojson'); const log = [];
for (const r of list) {
  const iso = r.boundaryISO, dst = path.join(out, iso + '.topojson'); if (fs.existsSync(dst)) continue;
  const url = `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/${iso}/ADM1/geoBoundaries-${iso}-ADM1_simplified.geojson`;
  try {
    execFileSync('curl', ['-sS', '-m', '600', '--retry', '3', '-f', '-o', tmp, url]);
    const g = JSON.parse(fs.readFileSync(tmp, 'utf8'));
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90; const walk = c => { if (typeof c[0] === 'number') { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; } else c.forEach(walk); };
    g.features.forEach(f => f.geometry && walk(f.geometry.coordinates));
    const mid = (y0 + y1) / 2, wkm = (x1 - x0) * 111.32 * Math.cos(mid * Math.PI / 180), hkm = (y1 - y0) * 110.57, diag = Math.hypot(wkm, hkm);
    const iv = Math.round(Math.max(150, Math.min(8000, diag * 1000 / 1400)));
    const q = Math.round(Math.min(100000, Math.max(10000, diag * 1000 / (iv / 6))));
    execFileSync(MS, ['-i', tmp, '-clean', '-filter-fields', 'shapeName,shapeISO', '-simplify', 'interval=' + iv, 'keep-shapes', '-o', dst, 'format=topojson', 'quantization=' + q], { stdio: 'pipe' });
    const kb = fs.statSync(dst).size / 1024; log.push([iso, g.features.length, Math.round(diag), iv, q, kb.toFixed(1)].join('\t'));
    console.log(iso, g.features.length, 'areas', Math.round(diag), 'km', 'interval', iv, 'm', kb.toFixed(1), 'KB');
  } catch (e) { console.log(iso, 'FAILED', String(e.message).slice(0, 160)); log.push([iso, 'FAILED'].join('\t')); }
  try { fs.unlinkSync(tmp); } catch (e) {}
}
fs.appendFileSync(path.join(out, '_log.tsv'), log.join('\n') + '\n');
