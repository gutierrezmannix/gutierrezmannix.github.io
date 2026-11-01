// The intro page in a real browser, fully offline: NODE_PATH=$(npm root -g) node calculator/tests/intro-e2e.cjs
// The page is the data box only (Browse files, drag and drop, Create your own dataset) plus unsaved work as
// "Continue where you left off"; the name is GM 26.11 and the footer carries the author. GM26_SHOTS=dir saves
// screenshots. Fails on any console error.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-intro-'));
  const csv = path.join(tmp, 'encuesta.csv'); { const L = ['ent,sexo,ingreso']; for (let i = 0; i < 200; i++) L.push([1 + (i % 32), 1 + (i % 2), 1000 + i * 7].join(',')); fs.writeFileSync(csv, L.join('\n')); }
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
  // the page itself
  let p = await page();
  const t = await p.locator('body').innerText();
  check(await p.locator('.gi-drop').count() === 1 && /Drag a data file here/.test(t), 'the data box');
  check(/CSV · TSV · Excel \(\.xlsx\) · Stata \(\.dta\)/.test(t) && !/saved session/i.test(t), 'file types without "saved session"');
  check(await p.locator('.gi-card').count() === 0 && !/What would you like to do today|Start from a task|Pick a task|Everything runs on this computer/.test(t), 'no task cards, heading or intro lines');
  check(/GM\s*26\.11/.test(t) && !/Mainframe/i.test(t) && /Carlos Daniel Gutierrez-Mannix, PhD/.test(t) && !/ALL COMPUTATION LOCAL/i.test(t), 'GM 26.11, no Mainframe, the author in the footer, no "all computation local"');
  check(await p.getByText('Use summary statistics or plan a study').count() === 0, 'the removed button stays removed');
  if (shots) await p.screenshot({ path: path.join(shots, 'intro-desktop.png'), fullPage: true });
  // the box opens the picker and the file loads
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
  // create a dataset by hand
  p = await page(); await p.getByRole('link', { name: 'Create your own dataset' }).click(); await loaded(p).catch(() => {});
  check(await p.locator('.mf-main').count() === 1, 'Create your own dataset → an empty table'); await p.close();
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
