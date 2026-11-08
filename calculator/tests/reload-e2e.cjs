// Reload warning (build .96): NODE_PATH=$(npm root -g) node calculator/tests/reload-e2e.cjs
// With a dataset open, F5 and Ctrl+R open the calculator's own box: it says what is lost, saves the session file or
// the data as CSV, then reloads (or cancels). The browser's reload (here page.reload) gets the browser's own
// "Reload site?" box whenever a dataset is open, edited or not; with no dataset, nothing asks.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-rl-')), file = path.join(tmp, 'encuesta.csv');
  fs.writeFileSync(file, ['edad,sexo'].concat(Array.from({ length: 50 }, (_, i) => (18 + i) + ',' + (1 + i % 2))).join('\n'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const url = 'file://' + path.resolve(__dirname, '../index.html');
  await p.goto(url); await p.waitForTimeout(1500);
  // no dataset: the browser's reload goes through with no box
  let asked = 0; p.on('dialog', async d => { if (d.type() === 'beforeunload') { asked++; await d.dismiss(); } else await d.accept(); });
  await p.reload(); await p.waitForTimeout(1200); check(asked === 0, 'no dataset: no reload box');
  await p.locator('input[type=file]').first().setInputFiles(file);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 60000 }); await p.waitForTimeout(800);
  const box = p.locator('.mf-rl');
  // F5 opens the calculator's box
  await p.locator('body').click({ position: { x: 5, y: 300 } }); await p.keyboard.press('F5'); await p.waitForTimeout(400);
  check(await box.count() === 1, 'F5 opens the reload box');
  const t = await box.innerText();
  check(/Reload the calculator\?/.test(t) && /encuesta\.csv \(50 rows\)/.test(t) && /Save session file/.test(t) && /Save data as CSV/.test(t) && /Reload without saving/.test(t), 'it names the data and offers to save it');
  check(await p.evaluate(() => document.activeElement && document.activeElement.textContent) === 'Save session file', 'the focus is on Save session file');
  const [dl] = await Promise.all([p.waitForEvent('download'), box.getByRole('button', { name: 'Save session file' }).click()]);
  check(/encuesta\.gm26\.json$/.test(dl.suggestedFilename()), 'Save session file downloads ' + dl.suggestedFilename());
  await p.waitForTimeout(300);
  check(/✓ Saved encuesta\.gm26\.json/.test(await box.innerText()) && await box.getByRole('button', { name: 'Reload now' }).count() === 1, 'after saving: ✓ Saved … and Reload now');
  const [dl2] = await Promise.all([p.waitForEvent('download'), box.getByRole('button', { name: 'Save data as CSV' }).click()]);
  check(/encuesta\.csv$/.test(dl2.suggestedFilename()), 'Save data as CSV downloads ' + dl2.suggestedFilename());
  await box.getByRole('button', { name: 'Cancel' }).click(); await p.waitForTimeout(300);
  check(await box.count() === 0 && await p.locator('.mf-main').count() === 1, 'Cancel keeps the data open');
  // Ctrl+R: the box again; Escape closes it
  await p.keyboard.press('Control+r'); await p.waitForTimeout(300); check(await box.count() === 1, 'Ctrl+R opens the box');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); check(await box.count() === 0, 'Escape closes it');
  // the browser's own reload: its box appears even though nothing was edited; dismissing it keeps the page
  await p.reload({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(600);
  check(asked === 1 && await p.locator('.mf-main').count() === 1, 'the browser reload asks first (Reload site?) and Cancel keeps the data');
  check(/open encuesta\.csv again/.test(t), 'nothing done yet: it says the file would be opened again');
  // some work (a new variable), then Reload without saving: no browser box on top of ours, and the work is offered back
  await p.keyboard.press('Control+k'); await p.waitForTimeout(300); await p.locator('input.mf-cmdin').fill('gen edad2 = edad * 2'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  await p.keyboard.press('Control+Shift+R'); await p.waitForTimeout(300);
  check(/A copy is kept in this browser/.test(await box.innerText()), 'after some work: a copy is kept in the browser');
  await Promise.all([p.waitForEvent('load'), box.getByRole('button', { name: 'Reload without saving' }).click()]); await p.waitForTimeout(1500);
  check(asked === 1 && await p.locator('.mf-main').count() === 0, 'Reload without saving reloads, with no second box');
  await p.waitForTimeout(1500); const bt = await p.locator('body').innerText(); check(/encuesta\.csv/.test(bt), 'the autosaved work is offered back'); if (!/encuesta/.test(bt)) console.log(bt.slice(0, 800));
  console.log('ERRORS', errs.length); errs.forEach(e => console.log(e));
  await b.close(); if (fails.length || errs.length) { console.log('FAILED'); process.exit(1); } console.log('ALL PASSED');
})();
