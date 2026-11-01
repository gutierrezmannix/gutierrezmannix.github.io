// The intro page (Design B) in a real browser, fully offline: NODE_PATH=$(npm root -g) node calculator/tests/intro-e2e.cjs
// Each task card opens the file picker and lands on its tool once the file has loaded; the drop zone and "Create a
// dataset" work; unsaved work comes back as a "Continue where you left off" card; no sideways scrolling on a phone.
// GM26_SHOTS=dir saves screenshots. Fails on any console error.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-intro-'));
  const csv = path.join(tmp, 'encuesta.csv'); { const L = ['ent,sexo,ingreso,texto']; for (let i = 0; i < 200; i++) L.push([1 + (i % 32), 1 + (i % 2), 1000 + i * 7, '"la salud y la economía ' + (i % 5) + '"'].join(',')); fs.writeFileSync(csv, L.join('\n')); }
  const edges = path.join(tmp, 'edges.csv'); { const L = ['from,to']; for (let i = 0; i < 60; i++) L.push(['P' + (i % 12), 'P' + ((i * 5 + 3) % 12)].join(',')); fs.writeFileSync(edges, L.join('\n')); }
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [], external = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  async function page() {
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
    await p.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
    await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2200);
    return p;
  }
  const loaded = p => p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 90000 }).then(() => p.waitForTimeout(1500));
  async function viaCard(label, file) {
    const p = await page();
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 10000 }), p.locator('.gi-card', { hasText: label }).getByRole('button', { name: /Open a file/ }).click()]);
    await fc.setFiles(file); await loaded(p); return p;
  }
  // the page itself
  let p = await page();
  check(await p.getByRole('heading', { name: 'What would you like to do today?' }).count() === 1, 'the heading');
  check(await p.locator('.gi-card').count() === 6, 'six task cards');
  check(await p.getByText('Use summary statistics or plan a study').count() === 0, 'the removed button stays removed');
  if (shots) await p.screenshot({ path: path.join(shots, 'intro-desktop.png'), fullPage: true });
  // the drop zone opens the picker; a file loads into the usual first tab
  const [fc0] = await Promise.all([p.waitForEvent('filechooser', { timeout: 10000 }), p.locator('.gi-drop').click()]);
  await fc0.setFiles(csv); await loaded(p);
  check(await p.locator('.mf-main').count() === 1, 'Browse files loads the file');
  // unsaved work (a result in the log) comes back on the intro page after a reload
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^Output/.test(e.textContent.trim())).click()); await p.waitForTimeout(600);
  const cmd = p.locator('input[placeholder*="Stata command"]').first(); await cmd.fill('summarize ingreso'); await cmd.press('Enter'); await p.waitForTimeout(1500);
  await p.waitForFunction(() => (localStorage.getItem('gm26-autosave-index') || '').includes('encuesta'), null, { timeout: 20000 }).catch(() => {});
  await p.reload(); await p.waitForTimeout(2500);
  const rc = await p.locator('.gi-rcard').count();
  check(rc >= 1 && /encuesta\.csv/.test(await p.locator('.gi-recent').innerText()), 'unsaved work listed under Continue where you left off (' + rc + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'intro-continue.png'), fullPage: true });
  if (rc) { await p.locator('.gi-rcard').first().getByRole('button', { name: 'Continue' }).click(); await loaded(p).catch(() => {}); check(await p.locator('.mf-main').count() === 1, 'Continue restores the work'); }
  await p.close();
  // task cards land on their tool
  p = await viaCard('Make a map', csv); await p.waitForSelector('.cb.ml', { timeout: 20000 }).catch(() => {});
  check(await p.locator('.cb.ml').count() === 1 && /ent/.test(await p.locator('.cb.ml').innerText()), 'Make a map → the Map page with the file (ent found)'); await p.close();
  p = await viaCard('Make charts', csv); check(await p.locator('.cb-gallery, .cb-fam').count() > 0, 'Make charts → the chart gallery'); await p.close();
  p = await viaCard('Analyze texts', csv); check(await p.locator('[data-screen-label="Text analysis"], .tl-text, .tl').first().count() === 1 && /Text analysis|texts|TEXT/i.test(await p.locator('.mf-main').innerText()), 'Analyze texts → Text analysis'); await p.close();
  p = await viaCard('Analyze a network', edges); await p.waitForTimeout(1500); { const t = await p.locator('.mf-main').innerText(); check(/TIES \(EDGES FILE\)/i.test(t) && /60 rows/.test(t), 'Analyze a network → Networks, with the file as the ties (60 rows)'); } await p.close();
  p = await viaCard('Explore and test', csv); check(/ingreso/.test(await p.locator('body').innerText()) && await p.locator('.mf-main').count() === 1, 'Explore and test → the dataset'); await p.close();
  // create a dataset by hand
  p = await page(); await p.locator('.gi-card', { hasText: 'Type in your own data' }).getByRole('button', { name: /Create a dataset/ }).click(); await loaded(p).catch(() => {});
  check(await p.locator('.mf-main').count() === 1, 'Create a dataset → an empty table'); await p.close();
  // phone
  const ph = await b.newContext({ viewport: { width: 390, height: 860 } }); p = await ph.newPage(); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 300)));
  await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2200);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ov <= 1, 'no sideways scrolling at 390 px (' + ov + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'intro-phone.png'), fullPage: true });
  await ph.close();
  console.log('EXTERNAL REQUESTS', external.length, external.slice(0, 3).join(' '));
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
