// Descriptive statistics in a real browser, offline (build .66): NODE_PATH=$(npm root -g) node calculator/tests/descriptives-e2e.cjs
// Loads tests/data/descriptives.csv, opens Tests ▾ → Descriptive statistics and checks what the page shows: values
// near 1e9 with a CI that is not one number and tiles that are not cut off, a rate near 1e-6 not shown as 0.00,
// incomes with one format and the skew remark, categories in value order with the By frequency switch, and box-plot
// ticks that differ. GM26_SHOTS=dir saves screenshots.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const shots = process.env.GM26_SHOTS || '', csv = path.resolve(__dirname, 'data/descriptives.csv');
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [], ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
  await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.gi-drop').click()]); await fc.setFiles(csv);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('button,a')].find(e => e.offsetParent && /^Descriptive statistics/.test(e.textContent.trim())).click()); await p.waitForTimeout(800);
  const pick = async v => { await p.locator('input[placeholder*="search"]').first().fill(v); await p.waitForTimeout(300); await p.evaluate(v => { const el = [...document.querySelectorAll('*')].find(e => e.offsetParent && !e.closest('.mf-main') && e.childNodes.length === 1 && e.textContent.trim() === v); el && el.click(); }, v); await p.waitForTimeout(1500); };
  const main = async () => (await p.locator('.mf-main').innerText()).replace(/\s+/g, ' ');
  const tileFits = () => p.evaluate(() => { const box = [...document.querySelectorAll('.mf-main div')].find(d => d.textContent.trim() === 'DESCRIPTIVES'); const card = box && box.closest('div[style*="padding: 10px 14px"]'); if (!card) return false; return [...card.querySelectorAll('div[title]')].every(t => { const v = t.lastElementChild; return v && v.scrollWidth <= v.clientWidth + 1; }); });

  await pick('big'); let t = await main();
  check(/95% CI LO 999,999,999\.95 95% CI HI 1,000,000,000\.19/.test(t), 'values near 1e9: the CI is 999,999,999.95 to 1,000,000,000.19, not one number');
  check(await tileFits(), 'no tile cuts its number off');
  const perSvg = await p.evaluate(() => [...document.querySelectorAll('.mf-main svg')].map(s => [...s.querySelectorAll('text')].map(x => x.textContent).filter(x => /^[\d,]+$/.test(x) && x.length > 8)).filter(a => a.length));
  check(perSvg.length >= 2 && perSvg.every(a => a.length >= 2 && new Set(a).size === a.length), 'chart ticks of values near 1e9 all differ: ' + perSvg.map(a => a.join(' | ')).join(' / '));
  if (shots) await p.screenshot({ path: path.join(shots, 'desc-big.png'), fullPage: true });
  await pick('tiny'); t = await main();
  check(/MEAN 9\.92e−7/.test(t) && !/MEAN 0\.00/.test(t), 'a rate near 1e-6 shows 9.92e−7, not 0.00');
  await pick('skew'); t = await main();
  check(/MEDIAN 83,180/.test(t) && /MIN 6,785/.test(t) && /SKEWNESS 7\.56/.test(t), 'incomes: one format (83,180 and 6,785) and a skewness tile');
  check(/strongly skewed \(skewness 7\.56\)/.test(t), 'the text flags the skew');
  await pick('grp'); t = await main();
  check(/LEVEL COUNT PCT CUM centro 100 [\d.]+% [\d.]+% norte 157 [\d.]+% [\d.]+% sur 43/.test(t), 'categories in value order (A–Z for text), as Stata tab');
  await p.getByRole('button', { name: /^By frequency$/i }).click(); await p.waitForTimeout(600); t = await main();
  check(/LEVEL COUNT PCT CUM norte 157 [\d.]+% [\d.]+% centro 100/.test(t), 'By frequency sorts by count');
  if (shots) await p.screenshot({ path: path.join(shots, 'desc-grp.png'), fullPage: true });
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  if (fails.length) { console.log(fails.length + ' failed'); process.exit(1); }
  console.log('Descriptive statistics passed in the browser.');
})().catch(e => { console.error(e); process.exit(1); });
