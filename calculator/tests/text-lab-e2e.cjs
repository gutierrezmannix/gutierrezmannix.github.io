// Browser test of the Text analysis tab on real files (needs Playwright):
// GM26_TEXT_FILES="/path/tweets.csv,/path/speeches.xlsx" NODE_PATH=$(npm root -g) node calculator/tests/text-lab-e2e.cjs
// Walks every step and sub-tab, builds a dictionary, fits topics, saves variables (totals must match) and exports SVG/PNG.
const { chromium } = require('playwright'), path = require('path'), os = require('os'), fs = require('fs');
const open = async (pageUrl, file) => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|net::/.test(m.text())) errs.push(m.text().slice(0, 400)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 600)));
  await p.goto('file://' + pageUrl); await p.waitForTimeout(2500);
  await p.locator('input[type=file]').first().setInputFiles(file);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 90000 }); await p.waitForTimeout(2000);
  await p.getByRole('button', { name: /^Tests/ }).first().click(); await p.waitForTimeout(300);
  const vis = async () => { const all = p.getByText('Text analysis', { exact: true }); const n = await all.count(); const out = []; for (let i = 0; i < n; i++) if (await all.nth(i).isVisible()) out.push(all.nth(i)); return out; };
  let v = await vis(); if (v.length < 2) { await v[0].click(); await p.waitForTimeout(400); v = await vis(); }
  await v[v.length - 1].click();
  await p.waitForSelector('.tl', { timeout: 30000 });
  return { b, p, errs };
};
const shot = async (p, path) => { const el = p.locator('.tl'); await el.screenshot({ path }); };
const waitIdle = async (p, ms) => { await p.waitForFunction(() => !document.querySelector('.tl-pending'), null, { timeout: ms || 60000 }).catch(() => {}); await p.waitForTimeout(600); };
(async () => {
  for (const file of (process.env.GM26_TEXT_FILES || '').split(',').filter(Boolean)) {
  const url = path.join(__dirname, '..', 'index.html'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-')), tag = path.extname(file).slice(1);
  const { b, p, errs } = await open(url, file);
  const log = (...a) => console.log(tag, ...a);
  const snap = async n => { await waitIdle(p, 120000); await shot(p, out + '/' + tag + '-' + n + '.png'); log('shot', n, 'errors so far', errs.length); };
  const tab = async name => { await p.getByRole('tab', { name, exact: true }).click(); await p.waitForTimeout(300); };
  const step = async name => { await p.locator('.tl-step', { hasText: name }).click(); await p.waitForTimeout(300); };
  await snap('1-texts');
  await step('Clean'); await p.waitForTimeout(4000); await snap('2-clean');
  const sugg = p.locator('.tl-chip.add'); if (await sugg.count()) { const t = await sugg.first().innerText(); await sugg.first().click(); log('joined phrase', t.replace(/\s+/g, ' ')); }
  await step('Explore'); await snap('3-words');
  await p.getByLabel('Split word cloud by').selectOption({ index: 1 }); await snap('3b-split');
  await p.getByRole('button', { name: 'One comparison cloud' }).click(); await snap('3c-compare-cloud');
  await p.getByLabel('Split word cloud by').selectOption(''); await p.getByRole('button', { name: 'Bar chart' }).click(); await snap('3d-bars'); await p.getByRole('button', { name: 'Cloud', exact: true }).click();
  await tab('Phrases'); await snap('4-phrases');
  await tab('Compare groups'); await snap('5-keyness');
  await tab('In context'); const q = p.getByLabel('Search words'); await q.fill(tag === 'csv' ? 'corrup*' : 'seguridad, violen*'); await q.press('Enter'); await snap('6-kwic');
  await tab('Over time'); await snap('7-time');
  await tab('Connections'); await snap('8-network');
  await tab('Clusters'); await snap('9-dendro');
  await tab('Text stats'); await snap('10-stats');
  await step('Measure');
  const cats = [['economía', 'econom*, empleo*, salario*, inversion*'], ['salud', 'salud, covid*, vacuna*, hospital*, medic*'], ['seguridad', 'seguridad, violen*, delito*, homicidio*, "guardia nacional"'], ['corrupción', 'corrup*']];
  for (let i = 0; i < cats.length; i++) {
    if (i >= 2) { await p.getByRole('button', { name: '+ Add a category' }).click(); await p.waitForTimeout(200); }
    const n = p.getByLabel('Category name').nth(i); await n.fill(cats[i][0]); await n.press('Enter'); await p.waitForTimeout(200);
    const k = p.getByLabel('Keywords').nth(i); await k.fill(cats[i][1]); await k.press('Enter'); await p.waitForTimeout(400);
  }
  await snap('11-dictionary');
  log('dict table:', (await p.locator('.tl-tbl').first().innerText()).replace(/\n/g, ' | ').slice(0, 400));
  await tab('Topics'); await p.getByLabel('Number of topics').fill('8'); await p.getByLabel('Number of topics').press('Enter'); await p.getByLabel('Iterations').fill('300'); await p.getByLabel('Iterations').press('Enter'); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Run', exact: true }).click(); await p.waitForTimeout(1500); await snap('12-topics');
  await tab('Sentiment'); await snap('13-sentiment');
  await tab('Classify'); await snap('14-classify');
  await tab('Scale'); await p.getByLabel('Group column').selectOption({ index: 1 }).catch(() => {}); await snap('15-scale');
  await step('Save'); await p.getByRole('button', { name: 'Main topic', exact: true }).click(); await snap('16-save');
  const add = p.getByRole('button', { name: /^Add \d+ variable/ }); log('add button:', await add.innerText(), 'enabled', await add.isEnabled());
  await add.click(); await p.waitForTimeout(1500); await snap('17-saved');
  log('saved banner:', (await p.locator('.tl-banner.ok').last().innerText()).slice(0, 300));
  const vars = await p.locator('body').innerText(); log('variable list has d_economia:', vars.includes('d_economia'), 'd_economia_any:', vars.includes('d_economia_any'), 'd_topic:', vars.includes('d_topic'));
  // exports
  await step('Explore'); await tab('Words'); await waitIdle(p);
  const [dl1] = await Promise.all([p.waitForEvent('download'), p.locator('.tl-fig').first().getByRole('button', { name: 'SVG' }).click()]);
  const svgPath = out + '/' + tag + '-cloud.svg'; await dl1.saveAs(svgPath); const svg = fs.readFileSync(svgPath, 'utf8'); log('svg bytes', svg.length, 'font-face embedded:', /@font-face/.test(svg), 'words:', (svg.match(/<text/g) || []).length);
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.locator('.tl-fig').first().getByRole('button', { name: 'PNG 300 dpi' }).click()]);
  const pngPath = out + '/' + tag + '-cloud-300dpi.png'; await dl2.saveAs(pngPath); const png = fs.readFileSync(pngPath); log('png', png.readUInt32BE(16) + '×' + png.readUInt32BE(20), 'pHYs:', png.indexOf('pHYs') > 0, 'ppm', png.readUInt32BE(png.indexOf('pHYs') + 4));
  log('ERRORS', errs.length); errs.slice(0, 12).forEach(e => console.log('   ', e));
  await b.close();
  if (errs.length) process.exitCode = 1;
  }
})();
