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
  check(/CSV · TSV · Excel \(\.xlsx, \.xls\) · Stata \(\.dta\) · SPSS \(\.sav\)/.test(t) && !/saved session/i.test(t), 'file types without "saved session"');
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
  p = await page(); await p.getByRole('button', { name: 'Create your own dataset' }).click(); await loaded(p).catch(() => {});
  check(await p.locator('.mf-main').count() === 1, 'Create your own dataset → an empty table');
  check(/1 · Create it/i.test(await p.locator('.mf-main').innerText()), 'it opens Make a new variable: create it, then set its values (build .68)'); await p.close();
  // build .67: Create is a button (Space works, no file dialog); files that are not data get a clear reason
  p = await page(); await p.locator('.gi-new').focus();
  const fcSpace = p.waitForEvent('filechooser', { timeout: 2000 }).then(() => true).catch(() => false); await p.keyboard.press('Space');
  check(!(await fcSpace) && await p.waitForSelector('.mf-main', { timeout: 20000 }).then(() => true).catch(() => false), 'Space on Create your own dataset opens the new dataset, not the file dialog'); await p.close();
  p = await page();
  for (const [f, body, re] of [['informe.pdf', '%PDF-1.4 x', /"informe\.pdf" is not a data file this calculator can read/], ['encuesta.por', 'SPSS PORT FILE', /"encuesta\.por" is an SPSS portable file/], ['bytes.dat', Buffer.from([0, 1, 2, 3, 0, 200, 4, 0]), /"bytes\.dat" is not a text data file/]]) {
    const fp = path.join(tmp, f); fs.writeFileSync(fp, body);
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 10000 }), p.locator('.gi-browse').click()]); await fc.setFiles(fp); await p.waitForTimeout(1200);
    check(re.test(await p.locator('.gi').innerText()), f + ': a clear reason instead of "found a header but no data rows"');
  }
  await p.close();
  // build .90: the keyboard lands on the name of the first variable; a file dropped anywhere opens (and never makes the
  // browser leave the calculator); several files: the first opens and a message says so
  p = await page(); await p.getByRole('button', { name: 'Create your own dataset' }).click(); await loaded(p).catch(() => {}); await p.waitForTimeout(800);
  check(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label')) === 'Name of the new variable', 'after Create your own dataset the cursor is in the name of the new variable'); await p.close();
  p = await page(); check(await p.locator('h1').filter({ hasText: 'Drag a data file here' }).count() === 1, 'the page has a heading (h1) for screen readers');
  const dropDT = names => p.evaluateHandle(ns => { const d = new DataTransfer(); for (const n of ns) d.items.add(new File(['a,b\n1,2\n3,4\n'], n, { type: 'text/csv' })); return d; }, names);
  let dtx = await dropDT(['fuera.csv']); await p.dispatchEvent('footer', 'dragover', { dataTransfer: dtx }); await p.waitForTimeout(250);
  check(await p.locator('.gi-release').count() === 1, 'a file dragged anywhere over the start page shows RELEASE TO LOAD');
  const caught = await p.evaluate(dt => { const ev = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }); document.querySelector('footer').dispatchEvent(ev); return ev.defaultPrevented; }, dtx);
  check(caught && await loaded(p).then(() => true).catch(() => false), 'a file dropped outside the box opens in the calculator, not in the browser'); await p.close();
  p = await page(); dtx = await dropDT(['uno.csv', 'dos.csv']); await p.dispatchEvent('.gi-drop', 'drop', { dataTransfer: dtx });
  check(await p.waitForFunction(() => /uno\.csv: 2 files were dropped/.test(document.body.innerText), null, { timeout: 6000 }).then(() => true).catch(() => false), 'two files dropped: the first opens and a message says so'); await p.close();
  // build .90: the page fits the window with the text size zoom (the footer is on screen, no scroll bar)
  for (const [w, h] of [[1920, 849], [1366, 768], [1280, 650]]) {
    const cz = await b.newContext({ viewport: { width: w, height: h } }); const pz = await cz.newPage(); await pz.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
    await pz.goto('file://' + path.resolve(__dirname, '../index.html')); await pz.waitForSelector('.gi-drop'); await pz.waitForTimeout(1200);
    const fit = await pz.evaluate(() => { const f = document.querySelector('footer').getBoundingClientRect(); return { extra: document.scrollingElement.scrollHeight - innerHeight, footer: Math.round(f.bottom), zoom: document.documentElement.style.zoom }; });
    check(fit.extra <= 1 && fit.footer <= h, w + '×' + h + ' at zoom ' + fit.zoom + ': no scroll bar, footer on screen (' + JSON.stringify(fit) + ')'); await cz.close();
  }
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
