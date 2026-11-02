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
  await p.getByRole('button', { name: /Predictions/ }).first().click(); await p.waitForTimeout(1500);
  await p.locator('input[aria-label="From"]').fill('-2'); await p.locator('input[aria-label="From"]').press('Enter');
  await p.locator('input[aria-label="To"]').fill('2'); await p.locator('input[aria-label="To"]').press('Enter');
  await p.locator('input[aria-label="Every"]').fill('0.5'); await p.locator('input[aria-label="Every"]').press('Enter'); await p.waitForTimeout(800);
  await p.locator('select[aria-label="Margins lines by"]').selectOption('grupo'); await p.waitForTimeout(1500);
  t = await main();
  check(/margins grupo_c, at\(x2=\(-2\(0\.5\)2\)\)/.test(t) && /The margins table · 27 rows/i.test(t) && /P>\|t\|/i.test(t), 'step 7: margins at x2 = -2(0.5)2 by grupo, 27 rows, t statistics after regress');
  check(await p.locator('svg[aria-label*="by x2"] polyline').count() === 3, 'the marginsplot draws one line per group');
  await p.getByRole('button', { name: 'Error bars' }).click(); await p.waitForTimeout(500);
  t = await main(); check(!/recastci\(rarea\)/.test(t.match(/marginsplot[^\n]*/)[0]) && await p.locator('svg[aria-label*="by x2"] polygon').count() === 0, 'error bars instead of bands (marginsplot without recastci)');
  if (shots) await p.screenshot({ path: path.join(shots, 'reg-step7.png'), fullPage: true });
  // Settings → Stars
  await p.locator('button', { hasText: /^Settings$/ }).first().click(); await p.waitForTimeout(500);
  check(await p.getByRole('button', { name: '.10 .05 .01' }).count() === 1, 'Settings shows the star convention');
  await p.getByRole('button', { name: '.10 .05 .01' }).click(); await p.waitForTimeout(500);
  await p.locator('.rg-bar button').filter({ hasText: 'Results' }).click(); await p.waitForTimeout(800);
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
  // from the Tests menu: Yes / No → the steps → run → results → checks
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(400);
  await p.evaluate(() => { const d = [...document.querySelectorAll('.cs-menu details')].find(x => /Regression/.test(x.querySelector('summary').textContent)); if (d) d.open = true; }); await p.waitForTimeout(300);
  check(await p.locator('.cs-rg-chip').count() === 5, 'the menu has one Regression entry with five outcome chips');
  await p.evaluate(() => [...document.querySelectorAll('.cs-rg-chip')].find(x => /count/.test(x.textContent)).click()); await p.waitForTimeout(800);
  await p.locator('select[aria-label="Outcome"]').selectOption('cnt'); await p.waitForTimeout(500);
  t = await main(); check(/DETECTED FROM YOUR DATA/.test(t) && /cnt holds whole numbers from 0/.test(t), 'step 1 detects a count');
  await p.getByRole('button', { name: /Next: Model/ }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Negative binomial/ }).first().click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Next: Predictors/ }).click(); await p.waitForTimeout(400);
  t = await main(); check(/Negative binomial/.test(t), 'step 2 chose the negative binomial');
  await p.locator('.rg-bar button').filter({ hasText: 'Weights' }).click(); await p.waitForTimeout(400);
  if (await p.getByRole('button', { name: 'Clear the weight' }).count()) { await p.getByRole('button', { name: 'Clear the weight' }).click(); await p.waitForTimeout(500); }
  check(!/the weight w has to be cleared/.test(await main()), 'step 4 clears the weight the engine model cannot use');
  await p.getByRole('button', { name: 'Run the model' }).click(); await p.waitForFunction(() => /Analysis N =/.test(document.querySelector('.mf-main').innerText), null, { timeout: 90000 }).catch(() => {});
  t = await main(); if (!/Analysis N = \d+/i.test(t)) console.log('      negbin page: ' + t.replace(/\s+/g, ' ').slice(0, 700)); check(/Analysis N = \d+/i.test(t) && /Negative binomial/.test(t), 'an engine model (negative binomial) runs inside the Regression steps');
  if (shots) await p.screenshot({ path: path.join(shots, 'reg-negbin.png'), fullPage: true });
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
