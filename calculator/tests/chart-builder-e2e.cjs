// Charts tab and the Univariate breakdown chart in a real browser, fully offline:
//   NODE_PATH=$(npm root -g) node calculator/tests/chart-builder-e2e.cjs [GM26_SHOTS=dir]
// Builds charts through the page (gallery, data sentence, Customize), renames groups, sets values and colors,
// downloads a PNG, follows the links between tabs, checks phone width, and fails on any console error.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || ''; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-cb-'));
  let seed = 4; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const lines = ['year,sexo,ss_dir,ent,ingreso,edad'];
  for (let i = 0; i < 3000; i++) { const y = 2008 + 2 * ((i >> 1) % 8), s = 1 + (i % 2); lines.push([y, s, rnd() < 0.15 + 0.01 * (y - 2008) + 0.06 * (s === 1) ? 1 : 0, ['Jalisco', 'Chiapas', 'Nuevo León', 'Ciudad de México', 'Oaxaca'][i % 5], Math.round(5000 + rnd() * 9000), 18 + Math.floor(rnd() * 60)].join(',')); }
  const file = path.join(tmp, 'pobreza.csv'); fs.writeFileSync(file, lines.join('\n'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
  const external = []; await p.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
  await p.locator('input[type=file]').first().setInputFiles(file);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 90000 }); await p.waitForTimeout(1200);
  const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const shot = async name => { if (shots) await p.screenshot({ path: path.join(shots, 'cb-' + name + '.png'), fullPage: true }); };
  const svgHtml = loc => loc.locator('svg').first().evaluate(s => s.innerHTML);

  // 1 · Charts → gallery → Lines: % of ss_dir by year and sexo
  await p.locator('button.mf-nav[data-nav="plots"]').click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: 'What do you want to show? — all charts' }).click(); await p.waitForTimeout(400);
  const cb = p.locator('.tl.cb');
  check(await cb.locator('.cb-fam').count() >= 8, 'the gallery shows the chart questions');
  await shot('1-gallery');
  await cb.getByRole('button', { name: 'Lines', exact: true }).click(); await p.waitForTimeout(400);
  await cb.getByLabel('Show', { exact: true }).selectOption('pct'); await p.waitForTimeout(200);
  await cb.getByLabel('Outcome', { exact: true }).selectOption('ss_dir'); await cb.getByLabel('Over (time)').selectOption('year'); await cb.getByLabel('Split by', { exact: true }).selectOption('sexo'); await p.waitForTimeout(500);
  let m = await svgHtml(cb.locator('.cb-figs'));
  check((m.match(/fill="none" stroke="[^"]*" stroke-width="[^"]*" stroke-linejoin/g) || []).length === 2, 'two lines, one per sexo');
  // 2 · names → value labels, values at every point, a color
  await cb.getByLabel('Name for 1').fill('Hombres'); await cb.getByLabel('Name for 1').press('Enter'); await p.waitForTimeout(300);
  await cb.getByLabel('Name for 2').fill('Mujeres'); await cb.getByLabel('Name for 2').press('Enter'); await p.waitForTimeout(300);
  await cb.getByRole('tab', { name: 'Values' }).click(); await cb.getByRole('button', { name: 'Every point' }).click(); await p.waitForTimeout(400);
  m = await svgHtml(cb.locator('.cb-figs'));
  check(/>Hombres</.test(m) && />Mujeres</.test(m), 'the lines carry the new names');
  check((m.match(/%</g) || []).length >= 16, 'a value at every year on both lines');
  await cb.getByRole('tab', { name: 'Colors' }).click(); await p.waitForTimeout(300);
  await cb.getByLabel('Color for Hombres').evaluate(el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '#7a1f5c'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(400);
  check(/#7a1f5c/i.test(await svgHtml(cb.locator('.cb-figs'))), 'the chosen color is drawn');
  await shot('2-lines');
  // 3 · the same names in another chart (donut panels by sexo)
  await cb.getByRole('button', { name: '← All charts' }).click(); await p.waitForTimeout(300);
  await cb.getByRole('button', { name: 'Donut', exact: true }).click(); await p.waitForTimeout(300);
  await cb.getByLabel('Show the share of each').selectOption('ent'); await cb.getByLabel('One per').selectOption('sexo'); await p.waitForTimeout(500);
  m = await cb.locator('.cb-figs').evaluate(f => f.innerHTML);
  check(/Hombres/.test(m) && /Mujeres/.test(m), 'the donut panels use the value labels');
  await shot('3-donut');
  const [dl1] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), cb.getByRole('button', { name: 'PNG 300 dpi' }).first().click()]);
  check(!!dl1 && /300dpi\.png$/.test(dl1.suggestedFilename()), 'PNG 300 dpi download (' + (dl1 ? dl1.suggestedFilename() : 'none') + ')');

  // 3b · heat map of a variable with many values (edad: 60 ages) — grouped into ranges instead of refusing
  await cb.getByRole('button', { name: '← All charts' }).click(); await p.waitForTimeout(300);
  await cb.getByRole('button', { name: 'Heat map', exact: true }).click(); await p.waitForTimeout(300);
  await cb.getByLabel('Columns', { exact: true }).selectOption('edad'); await cb.getByLabel('Rows', { exact: true }).selectOption('sexo'); await cb.getByLabel('Mean of', { exact: true }).selectOption('ingreso'); await p.waitForTimeout(600);
  m = await svgHtml(cb.locator('.cb-figs'));
  check(await cb.getByRole('alert').count() === 0 && /15–19|20–24/.test(m), 'heat map of 60 ages draws in ranges of 5');
  check(/Mean of ingreso by edad and sexo/.test(m) && /Hombres/.test(m), 'heat map title and named rows');
  check(await cb.getByText('edad has 60 values').count() === 1, 'the grouping choice is in the data sentence');
  await cb.getByLabel('Group edad').selectOption('each'); await p.waitForTimeout(600);
  m = await svgHtml(cb.locator('.cb-figs'));
  check(await cb.getByRole('alert').count() === 0 && (m.match(/<rect [^>]*><title>/g) || []).length === 120, 'each age as its own column (60 × 2 cells)');
  await shot('3b-heatmap');

  // 4 · Univariate → ss_dir → Break down by year and sexo: the chart has the same options under it
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && e.textContent.trim() === 'Descriptive statistics').click()); await p.waitForTimeout(800);
  await p.locator('.mf-main, body').getByText('ss_dir', { exact: true }).first().click(); await p.waitForTimeout(900);
  await p.getByLabel('Break down by (rows)').selectOption('year'); await p.waitForTimeout(400);
  await p.getByLabel('Break down by (columns)').selectOption('sexo'); await p.waitForTimeout(700);
  const ob = p.locator('section.ob');
  m = await svgHtml(ob);
  check(/>Hombres</.test(m) && />Total</.test(m), 'breakdown chart: named lines and the total');
  check(/Hombres/.test(await ob.locator('table').first().textContent()), 'breakdown table uses the same names');
  check(await ob.getByRole('tab', { name: 'Labels' }).count() === 1, 'Customize this chart sits under the breakdown chart');
  await ob.getByRole('tab', { name: 'Values' }).click(); await ob.getByRole('button', { name: 'Every point' }).click(); await ob.getByRole('button', { name: 'Every year with data' }).click(); await p.waitForTimeout(400);
  m = await svgHtml(ob);
  check((m.match(/%</g) || []).length >= 24, 'values at each year on every line');
  for (let y = 2008; y <= 2022; y += 2) if (!new RegExp('>' + y + '<').test(m)) { check(false, 'year ' + y + ' on the axis'); break; }
  await ob.getByRole('tab', { name: 'Colors' }).click(); await p.waitForTimeout(300);
  await ob.getByLabel('Color for Total').evaluate(el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '#aa2244'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(400);
  check(/#aa2244/i.test(await svgHtml(ob)), 'the total line takes its color');
  if (shots) await ob.screenshot({ path: path.join(shots, 'cb-4-breakdown.png') });
  const [dl2] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }).catch(() => null), ob.getByRole('button', { name: 'SVG' }).click()]);
  check(!!dl2 && /breakdown-ss_dir-by-year-sexo\.svg$/.test(dl2.suggestedFilename()), 'breakdown SVG download');
  check((await p.locator('.cb-more').count()) >= 1, 'the other Univariate charts link to Charts');
  // 5 · More options in Charts → the same numbers on the Charts page
  const tableVal = (await ob.locator('table').first().locator('tbody tr').first().locator('td').nth(1).textContent()).match(/[\d.]+%/)[0];
  await ob.getByRole('button', { name: 'More options in Charts →' }).click(); await p.waitForTimeout(800);
  check(/Change over time/.test(await p.locator('.tl.cb h2').first().textContent()), 'opens the line chart in Charts');
  m = await svgHtml(p.locator('.tl.cb .cb-figs'));
  check(m.includes('>' + tableVal + '<'), 'the Charts page shows the same value as the table (' + tableVal + ')');
  await shot('5-from-breakdown');
  // 6 · phone width
  await p.setViewportSize({ width: 390, height: 900 }); await p.waitForTimeout(400);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ov <= 1, 'no sideways scrolling at 390 px (' + ov + ')');
  await shot('6-phone');
  console.log('EXTERNAL REQUESTS', external.length, external.slice(0, 3).join(' '));
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
