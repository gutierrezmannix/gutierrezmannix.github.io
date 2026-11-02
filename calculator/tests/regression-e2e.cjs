// Regression in a real browser, offline (build .64): NODE_PATH=$(npm root -g) node calculator/tests/regression-e2e.cjs
// Runs models from the console on tests/data/regression-numerics.csv and checks what the page shows: small
// coefficients with their digits, the collinearity error naming the variable, a text yes/no outcome modeled as "sí"
// with Stata code that recodes it, [pw=] with robust SEs, the margins chart under robust SEs, the Settings → Stars
// choice, and the correlation matrix's plot card following the variables. GM26_SHOTS=dir saves screenshots.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', csv = path.resolve(__dirname, 'data/regression-numerics.csv');
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [], ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }), p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
  await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.gi-drop').click()]); await fc.setFiles(csv);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 120000 }); await p.waitForTimeout(1500);
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^Output/.test(e.textContent.trim())).click()); await p.waitForTimeout(500);
  const output = () => p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^(Output|Console)/.test(e.textContent.trim()))?.click());
  const cmd = async s => { let box = p.locator('input[placeholder*="Stata command"]').first(); if (!(await box.isVisible().catch(() => false))) { await output(); await p.waitForTimeout(500); } box = p.locator('input[placeholder*="Stata command"]').first(); await box.fill(s); await box.press('Enter'); await p.waitForTimeout(2500); };
  const main = () => p.locator('.mf-main').innerText();
  await cmd('regress y inc x2');
  let t = await main();
  check(/0\.0000396\*\*\*/.test(t) && /0\.00000291/.test(t), 'income in pesos shows 0.0000396*** (0.00000291), not 0.000');
  check(/0\.396 per \+10,000/.test(t), 'the text gives the effect per +10,000');
  if (shots) await p.screenshot({ path: path.join(shots, 'reg-ols.png'), fullPage: true });
  await cmd('regress y inc inc_k x2');
  t = await main(); check(/collinear: “inc_k” is a combination/.test(t) && !/R-SQUARED\s*-/.test(t), 'income in pesos and thousands: an error naming inc_k, no impossible R²');
  await cmd('logit esi x2 i.grupo');
  t = await main(); check(/P\(ESI = "sí"\)/.test(t) && /those of grupo = A/.test(t), 'text outcome: models "sí"; categories compared with grupo = A');
  await p.locator('summary', { hasText: /Stata output/ }).first().click().catch(() => {}); await p.waitForTimeout(300);
  const log = await p.evaluate(() => document.body.innerText);
  check(/generate byte esi_1 = \(esi == "sí"\) if !missing\(esi\)/.test(log) && /logit esi_1 x2 i\.grupo_c/.test(log), 'the Stata code recodes the outcome before logit');
  if (shots) await p.screenshot({ path: path.join(shots, 'reg-logit.png'), fullPage: true });
  await cmd('regress y x2 inc_k [pw=w]');
  t = await main(); check(/ROBUST \(HC1\) SEs/.test(t) && /0\.238/.test(t), '[pw=]: robust SEs (x2 0.238, as Stata)');
  await cmd('regress y x2 i.grupo, vce(robust)');
  await p.waitForTimeout(1500); t = await main();
  const mg = p.locator('[data-screen-label="Margins plot"]').first();
  if (await mg.count()) { await mg.scrollIntoViewIfNeeded(); await p.waitForTimeout(2500); }
  const mgInfo = await p.evaluate(() => { const m = document.querySelector('[data-screen-label="Margins plot"]'); return m ? { svg: m.querySelectorAll('svg path, svg polygon, svg rect').length, text: m.innerText.replace(/\s+/g, ' ').slice(0, 200) } : null; });
  console.log('      margins: ' + JSON.stringify(mgInfo));
  check(!!mgInfo && mgInfo.svg > 0, 'robust model: the margins chart is drawn');
  if (shots && mgInfo) await mg.screenshot({ path: path.join(shots, 'reg-margins.png') });
  // Settings → Stars
  await p.locator('button', { hasText: /^Settings$/ }).first().click(); await p.waitForTimeout(500);
  check(await p.getByRole('button', { name: '.10 .05 .01' }).count() === 1, 'Settings shows the star convention');
  await p.getByRole('button', { name: '.10 .05 .01' }).click(); await p.waitForTimeout(500);
  t = await main(); console.log('      notes: ' + (t.match(/[^\n]*p ?< ?\.[^\n]*/gi) || []).slice(0, 3).join(' | ').slice(0, 300)); check(/\* p < \.10\s+\*\* p < \.05\s+\*\*\* p < \.01/i.test(t), 'stars switch to .10 .05 .01');
  await p.getByRole('button', { name: '.05 .01 .001' }).click(); await p.waitForTimeout(500);
  if (shots) await p.screenshot({ path: path.join(shots, 'reg-settings.png') });
  await p.locator('button', { hasText: /^Settings$/ }).first().click().catch(() => {}); await p.waitForTimeout(300);
  // correlation matrix: the selected pair's plot card follows the variables
  const clickText = l => p.evaluate(x => { const e = [...document.querySelectorAll('button')].find(q => q.offsetParent && q.textContent.trim() === x); if (e) e.click(); return !!e; }, l);
  for (let k = 0; k < 3; k++) { if (await clickText('Correlation matrix (Pearson and Spearman)')) break; await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(700); }
  await p.waitForTimeout(800);
  if (await p.getByRole('button', { name: 'clear', exact: true }).count()) { await p.getByRole('button', { name: 'clear', exact: true }).click(); await p.waitForTimeout(300); }
  for (const v of ['y', 'x2', 'inc']) { await p.locator('select[aria-label="Add a variable"]').first().selectOption(v); await p.waitForTimeout(400); }
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^Plots/.test(e.textContent.trim()))?.click()); await p.waitForTimeout(1200);
  const card1 = await p.evaluate(() => document.body.innerText.match(/pwcorr [^\n]*sig obs/g) || []);
  await p.locator('select[aria-label="Add a variable"]').first().selectOption('cnt'); await p.waitForTimeout(1500);
  const card2 = await p.evaluate(() => document.body.innerText.match(/pwcorr [^\n]*sig obs/g) || []);
  check(card2.some(s => /pwcorr y x2 inc cnt/.test(s)), 'plot card command follows the variables (' + card1.slice(-1) + ' → ' + card2.slice(-1) + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'cor-plotcard.png'), fullPage: true });
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
