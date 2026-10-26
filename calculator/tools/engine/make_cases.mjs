// Write every case packet to tests/engine/cases/<name>.packet.json. Then run:
//   LC_ALL=C.UTF-8 Rscript tools/engine/ref.R tests/engine/cases [names…]   (R reference outputs)
//   node tools/engine/compare.mjs [filter…]                            (built-in engine vs R)
// Usage: node tools/engine/make_cases.mjs [family …]   (families = files in tools/engine/cases)
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
const dir = new URL('./cases/', import.meta.url), out = new URL('../../tests/engine/cases/', import.meta.url);
mkdirSync(out, { recursive: true });
const want = process.argv.slice(2);
for (const f of readdirSync(dir).filter(f => f.endsWith('.mjs')).sort()) {
  const fam = f.replace('.mjs', ''); if (want.length && !want.includes(fam)) continue;
  const mod = await import(new URL(f, dir)); const list = mod.cases();
  for (const c of list) { const p = { ...c.packet }; if (c.compare) p.__compare = c.compare; writeFileSync(new URL(fam + '-' + c.name + '.packet.json', out), JSON.stringify(p)); }
  console.log(fam + ': ' + list.length + ' cases');
}
