// Charts → Map in a real browser, fully offline:
//   NODE_PATH=$(npm root -g) node calculator/tests/map-lab-e2e.cjs            (a generated CONEVAL-like file)
//   GM26_MAP_DTA=/path/coneval.dta NODE_PATH=$(npm root -g) node calculator/tests/map-lab-e2e.cjs   (a real file)
//   GM26_SHOTS=dir saves screenshots.
// Opens the Map page from the chart gallery, checks the column and map it finds, uses the survey weight in one click,
// draws states and municipalities, one state only, customizes and downloads; then a second file whose region numbers
// 1–10 are the survey's own codes for Mongolia is matched through the table and a pasted list. Fails on console errors.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-map-'));
  let file = process.env.GM26_MAP_DTA;
  if (!file) { // states coded 1–32, municipalities as INEGI keys (5 or 9 digits), years, a 0/1 outcome and an expansion factor
    let s = 9; const rnd = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
    const mun = ['01001', '02002', '03003', '04002', '05030', '06002', '07101', '08019', '090070000', '10005', '11020', '12001', '13048', '140390000', '15106', '16053', '17007', '18017', '19039', '20067', '21114', '22014', '23005', '24028', '25006', '26030', '27004', '28032', '29033', '30193', '31050', '32056'];
    const L = ['folioviv,ent,ubica_geo,year,pobreza,factor,edad']; for (let i = 0; i < 6000; i++) { const u = mun[i % 32], e = +u.slice(0, 2); L.push([100000 + i, e, u, 2016 + 2 * (i % 4), rnd() < 0.15 + e / 70 ? 1 : 0, 100 + Math.floor(rnd() * 900), 18 + (i % 60)].join(',')); }
    file = path.join(tmp, 'coneval.csv'); fs.writeFileSync(file, L.join('\n'));
  }
  const mongolia = path.join(tmp, 'mongolia.csv'); { const L = ['region,income']; for (let i = 0; i < 300; i++) L.push([1 + (i % 10), 200 + (i % 10) * 50 + (i % 7)].join(',')); fs.writeFileSync(mongolia, L.join('\n')); }
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [], external = [];
  async function open(f) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
    await p.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
    await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
    await p.locator('input[type=file]').first().setInputFiles(f);
    await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 90000 }); await p.waitForTimeout(1500);
    await p.locator('button.mf-nav[data-nav="plots"]').click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: 'What do you want to show? — all charts' }).click(); await p.waitForTimeout(400);
    await p.locator('.tl.cb').getByRole('button', { name: /^Map/ }).first().click();
    return p;
  }
  const shot = async (p, n) => { if (shots) await p.screenshot({ path: path.join(shots, 'map-' + n + '.png'), fullPage: true }); };
  const svgOf = p => p.locator('.cb.ml figure svg').first().evaluate(s => s.innerHTML);
  const found = async p => (await p.locator('.ml-found').allTextContents()).join(' ');

  // 1 · the survey file: states found by themselves
  let p = await open(file);
  await p.waitForSelector('.cb.ml figure svg', { timeout: 30000 }).catch(() => {});
  check(/32 of 32 values of ent recognised as Mexico.s states/.test(await found(p)), 'ent recognised as Mexico’s 32 states (' + await found(p) + ')');
  let m = await svgOf(p).catch(() => '');
  check(/% where pobreza = 1 by state, Mexico/.test(m), 'the map shows the % in poverty by state');
  const useW = p.getByRole('button', { name: /^Use factor as the weight$/ });
  if (await useW.count()) { await useW.click(); await p.waitForTimeout(600); }
  m = await svgOf(p); check(/weighted by factor/.test(m), 'weighted by factor (one click when the weight was not set)');
  await shot(p, '1-states');
  // 2 · municipalities, then one state
  await p.locator('.cb.ml').getByRole('button', { name: /^Municipalities/ }).click(); await p.waitForTimeout(500);
  await p.getByLabel('Which column says the place?').selectOption('ubica_geo'); await p.waitForTimeout(1500);
  check(/values of ubica_geo recognised as Mexico.s municipalities/.test(await found(p)), 'ubica_geo recognised as municipalities (' + await found(p) + ')');
  m = await svgOf(p); check(/stroke="#3D3629"/.test(m), 'state borders over the municipalities');
  await shot(p, '2-municipalities');
  await p.getByLabel('Only in').selectOption({ label: 'Jalisco' }); await p.waitForTimeout(800);
  m = await svgOf(p); check(/Guadalajara/.test(m) && !/Iztapalapa/.test(m), 'only Jalisco’s municipalities');
  // 3 · customize and download
  await p.locator('.cb.ml').getByRole('tab', { name: 'Labels' }).click(); await p.locator('.cb.ml').getByRole('button', { name: 'Area names' }).click(); await p.waitForTimeout(600);
  m = await svgOf(p); check(['Zapopan', 'Tequila', 'Puerto Vallarta', 'Lagos de Moreno', 'Mascota', 'Tuxpan'].filter(n => m.includes('>' + n + '<')).length >= 3, 'area names on the map');
  await p.locator('.cb.ml').getByRole('tab', { name: 'Colors' }).click(); await p.locator('.cb.ml').getByRole('button', { name: 'Natural groups' }).click(); await p.locator('.cb.ml').getByRole('button', { name: 'Blues' }).click(); await p.waitForTimeout(600);
  m = await svgOf(p); check(!/NaN|undefined/.test(m), 'no NaN after changing classes and colors');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }).catch(() => null), p.locator('.cb.ml').getByRole('button', { name: 'PNG 300 dpi' }).click()]);
  check(!!dl && /300dpi\.png$/.test(dl.suggestedFilename()), 'PNG 300 dpi (' + (dl ? dl.suggestedFilename() : 'none') + ')');
  await shot(p, '3-jalisco');
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(500);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ov <= 1, 'no sideways scrolling at 390 px (' + ov + ')');
  await shot(p, '4-phone');
  await p.context().close();
  // 4 · Mongolia: the survey's own region numbers 1–10
  p = await open(mongolia); await p.waitForTimeout(800);
  await p.getByLabel('Country', { exact: true }).selectOption({ label: 'Mongolia' }); await p.waitForTimeout(600);
  await p.getByLabel('Which column says the place?').selectOption('region'); await p.waitForTimeout(600);
  const show = p.getByLabel('Show', { exact: true }); await show.selectOption('mean'); await p.getByLabel('Variable', { exact: true }).selectOption('income'); await p.waitForTimeout(600);
  check(/0 of 10/.test(await found(p)), 'the numbers 1–10 are not taken for official codes (' + await found(p) + ')');
  await p.getByLabel('Place for 1', { exact: true }).selectOption({ label: 'Uvs' }); await p.waitForTimeout(600);
  check(/1 of 10/.test(await found(p)), 'one number placed by hand');
  await p.locator('.ml-paste summary').click();
  await p.locator('.ml-paste textarea').fill('2, Khovd\n3, Zavkhan\n4, Bulgan\n5, Dornogovi\n6, Ulaanbaatar\n7, Selenge\n8, Khentii\n9, Dornod\n10, Ömnögovi');
  await p.getByRole('button', { name: 'Use this list' }).click(); await p.waitForTimeout(800);
  check(/10 of 10/.test(await found(p)), 'the rest from a pasted list');
  m = await svgOf(p).catch(() => ''); check(/Mean of income by/.test(m), 'the Mongolia map is drawn');
  await shot(p, '5-mongolia');
  await p.context().close();
  console.log('EXTERNAL REQUESTS', external.length, external.slice(0, 3).join(' '));
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
