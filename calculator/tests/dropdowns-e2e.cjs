// Dropdowns in a real browser (build .93): NODE_PATH=$(npm root -g) node calculator/tests/dropdowns-e2e.cjs
// With 739 variables: every list scrolls with the wheel to its last entry and back, the page underneath does not move
// (variable pickers, searchable boxes, the Tests menu), arrow keys keep the highlighted entry in view, and a list opened
// near the bottom of the window opens upward and stays on screen (it used to run off the screen: "only 4 variables").
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-dd-')), csv = path.join(tmp, 'wide.csv');
  { const names = ['cand_favorability_trump', 'gender', 'weight'].concat(Array.from({ length: 736 }, (_, i) => 'q' + String(i).padStart(3, '0'))), L = [names.join(',')];
    for (let r = 0; r < 300; r++) L.push([['Very favorable', 'Somewhat favorable', 'Very unfavorable'][r % 3], ['Female', 'Male'][r % 2], (0.5 + (r % 7) / 4).toFixed(2)].concat(Array.from({ length: 736 }, (_, i) => 1 + (r * 7 + i) % 5)).join(','));
    fs.writeFileSync(csv, L.join('\n')); }
  const b = await chromium.launch(), fails = [], errs = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const p = await (await b.newContext({ viewport: { width: 1920, height: 803 } })).newPage(); p.setDefaultTimeout(20000); p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForSelector('.gi-drop'); await p.waitForTimeout(600);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.gi-browse').click()]); await fc.setFiles(csv); await p.waitForSelector('.mf-main'); await p.waitForTimeout(1500);
  const scrollAll = async (label, sel) => {
    const l = p.locator(sel).filter({ visible: true }).first(); const box = await l.boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const y0 = await p.evaluate(() => scrollY), sh = await l.evaluate(e => e.scrollHeight - e.clientHeight);
    for (let k = 0; k < 90; k++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(15); } const down = await l.evaluate(e => e.scrollTop), y1 = await p.evaluate(() => scrollY);
    for (let k = 0; k < 90; k++) { await p.mouse.wheel(0, -400); await p.waitForTimeout(15); } const up = await l.evaluate(e => e.scrollTop);
    check(Math.abs(down - sh) <= 2 && up === 0 && y1 === y0 && await l.isVisible(), label + ': scrolls to the end (' + Math.round(down) + ' of ' + sh + ' px) and back, the page stays still, the list stays open');
  };
  const inp = p.locator('.mf-main input').first(); await inp.click(); await inp.fill('cand_favorability_trump'); await p.keyboard.press('Enter'); await p.waitForTimeout(1000);
  const ct = p.locator('input[aria-label="Cross-tabulate by"]'), y = await ct.evaluate(e => e.getBoundingClientRect().top + scrollY);
  await p.evaluate(y => window.scrollTo(0, y - 633), y); await p.waitForTimeout(300); await ct.click(); await p.waitForTimeout(500);
  const fit = await p.evaluate(() => { const l = document.querySelector('[data-pk-list]'), i = document.querySelector('input[aria-label="Cross-tabulate by"]'), r = l.getBoundingClientRect(), q = i.getBoundingClientRect(); return { up: r.bottom <= q.top + 2, inside: r.top >= 0 && r.bottom <= innerHeight, h: Math.round(r.height) }; });
  check(fit.up && fit.inside && fit.h >= 200, 'near the bottom of the window the variable list opens upward and stays on screen (' + JSON.stringify(fit) + ')');
  await scrollAll('variable picker (crosstab, 739 variables)', '[data-pk-list]');
  await p.keyboard.press('Escape'); await p.mouse.click(5, 400); await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(500); await scrollAll('Tests ▾ menu', '.mf-menu'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(400);
  await p.evaluate(() => { const e = [...document.querySelectorAll('button')].find(x => x.offsetParent && x.textContent.trim() === 'One-sample, independent and paired t-tests'); if (e) e.click(); }); await p.waitForTimeout(800);
  await p.getByRole('combobox', { name: 'Outcome', exact: true }).first().click(); await p.waitForTimeout(400); await scrollAll('searchable box (t-test outcome)', '.tl-combo-list');
  for (let k = 0; k < 40; k++) await p.keyboard.press('ArrowDown');
  check(await p.evaluate(() => { const l = document.querySelector('.tl-combo-list'), a = l && l.querySelector('.hi'); if (!a) return false; const r = a.getBoundingClientRect(), q = l.getBoundingClientRect(); return r.top >= q.top - 1 && r.bottom <= q.bottom + 1; }), 'arrow keys keep the highlighted entry in view');
  check(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | '));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED'); await b.close(); process.exit(fails.length ? 1 : 0);
})();
