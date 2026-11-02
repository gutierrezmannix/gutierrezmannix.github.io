// Settings in a real browser, offline (build .69): NODE_PATH=$(npm root -g) node calculator/tests/settings-e2e.cjs
// Every control of the Settings panel on tests/data/descriptives.csv: the chips take you to their control; the weight
// list has numeric variables only; names typed and left with Tab are taken (weight, strata, PSU) and the focus moves
// on; ↓ / Enter / Escape in the lists; missing codes change the variable list's counts, "clear" is a button; the α
// chip and the CI follow alpha; auto-screen On / Off; stars; font, size and palette survive a reload; Stata / R;
// Escape and Done close the panel; Close dataset asks when there are unsaved changes. GM26_SHOTS=dir saves screenshots.
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const shots = process.env.GM26_SHOTS || '', csv = path.resolve(__dirname, 'data/descriptives.csv');
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [], dialogs = [];
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } }), p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  p.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss(); });
  await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForSelector('.gi-drop'); await p.waitForTimeout(1500);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.gi-browse').click()]); await fc.setFiles(csv); await p.waitForSelector('.mf-main'); await p.waitForTimeout(1200);
  const body = async () => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  const act = () => p.evaluate(() => { const e = document.activeElement; return e.tagName + ' ' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 20)); });
  const pickVar = async v => { await p.locator('input[placeholder*="search"]').first().fill(v); await p.waitForTimeout(200); await p.evaluate(v => { const el = [...document.querySelectorAll('*')].find(e => e.offsetParent && !e.closest('.mf-main') && e.childNodes.length === 1 && e.textContent.trim() === v); el && el.click(); }, v); await p.waitForTimeout(800); };
  const lists = () => p.locator('[data-pk-list]').count();
  await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => [...document.querySelectorAll('button,a')].find(e => e.offsetParent && /^Descriptive statistics/.test(e.textContent.trim())).click()); await p.waitForTimeout(500);
  await pickVar('x');
  const settings = p.getByRole('button', { name: /Settings/ }).first();
  await settings.click(); await p.waitForTimeout(400);
  const panel = p.locator('.mf-settings-view').locator('xpath=..');

  // chips go to their control
  await panel.getByRole('button', { name: /^Unweighted$/ }).click(); await p.waitForTimeout(300);
  check(/Weight variable/.test(await act()), 'the weight chip goes to the weight box');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await panel.getByRole('button', { name: /^α = 0\.05$/ }).click(); await p.waitForTimeout(300);
  check(/BUTTON \.05/.test(await act()), 'the α chip goes to the alpha buttons');
  // weight: numeric variables only; a typed name + Tab is taken and the focus moves on
  await p.getByLabel('Weight variable').focus(); await p.waitForTimeout(300);
  const names = await p.locator('[data-pk-list] [data-kb] span:first-child').allInnerTexts();
  check(names.includes('w') && !names.includes('grp'), 'the weight list has numeric variables only (no grp)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.getByLabel('Weight variable').fill('w'); await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  check(/Weight: w/.test(await body()) && /Survey strata/.test(await act()), 'w + Tab sets the weight and moves to Strata');
  check(/MEAN 49\.02/.test(await body()) && /WEIGHTED BY W/.test(await body()), 'the descriptives use the weight (mean 49.02)');
  await p.keyboard.type('grp'); await p.keyboard.press('Tab'); await p.waitForTimeout(400); await p.keyboard.type('hijos'); await p.keyboard.press('Tab'); await p.waitForTimeout(500);
  check(/Survey design: strata grp · PSU hijos/.test(await body()) && /Missing codes/.test(await act()), 'strata and PSU typed with Tab');
  check(/STRATA \/ PSU IN SETTINGS ARE USED BY REGRESSION/.test(await body()), 'the CI note says the strata / PSU are not used by it');
  // keyboard in a list: ↓ opens and moves, Enter picks and comes back, Escape closes the list before the panel
  await p.getByLabel('Weight variable').focus(); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250); check(await lists() === 1, '↓ opens the list');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(150); const row = await act();
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  check(/DIV x/.test(row) && /Weight: x/.test(await body()) && /Weight variable/.test(await act()) && await lists() === 0, '↓ ↓ Enter picks x and the focus comes back to the box');
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  check(await lists() === 0 && await p.locator('.mf-settings-view').count() === 1, 'Escape closes the list first');
  await p.getByLabel('Weight variable').fill('UNW'); await p.waitForTimeout(250); check(await lists() === 1, 'typing reopens the list');
  await p.locator('[data-pk-list] div', { hasText: /UNWEIGHTED/ }).first().click(); await p.waitForTimeout(500);
  check(/Unweighted/.test(await body()), 'UNWEIGHTED with the mouse');
  for (const [lab, none] of [['Survey strata', /NONE/], ['Survey PSU (primary sampling unit)', /NONE/]]) { await p.getByLabel(lab).click(); await p.waitForTimeout(250); await p.locator('[data-pk-list] div', { hasText: none }).first().click(); await p.waitForTimeout(400); }
  check(!/Survey design:/.test(await body()), 'strata and PSU back to none');
  // missing codes: the variable list counts follow; clear is a button
  await panel.getByRole('button', { name: 'Off', exact: true }).click(); await p.waitForTimeout(500);
  check(/CODES KEPT AS DATA/.test(await body()), 'auto-screen Off');
  await p.getByLabel('Missing codes').fill('99'); await panel.getByRole('button', { name: /^Set$/i }).click(); await p.waitForTimeout(600);
  await pickVar('codes');
  check(/codes 291 valid · 7 lvls/.test(await body()) && /N VALID 291/.test(await body()), 'Set 99: the variable list says 291 valid · 7 levels, as the tab');
  await panel.getByRole('button', { name: 'clear', exact: true }).click(); await p.waitForTimeout(400);
  check(!/ACTIVE:/.test(await body()) && /codes 300 valid/.test(await body()), 'clear (a button) removes the codes');
  await panel.getByRole('button', { name: 'On', exact: true }).click(); await p.waitForTimeout(500);
  check(/1 VAR SCREENED/.test(await body()) && /codes 291 valid/.test(await body()), 'auto-screen On screens 99 again');
  await pickVar('x');
  // alpha, stars, commands
  await panel.getByRole('button', { name: '.10', exact: true }).click(); await p.waitForTimeout(400);
  check(/α = 0\.10/.test(await body()) && /90% CI LO/.test(await body()), 'α .10: chip 0.10 and a 90% CI');
  check(await p.evaluate(() => document.querySelector('[aria-label="Significance level (alpha)"] [aria-pressed="true"]').textContent) === '.10', 'aria-pressed follows alpha');
  await panel.getByRole('button', { name: '.05', exact: true }).click();
  await panel.getByRole('button', { name: '.10 .05 .01' }).click(); await p.waitForTimeout(200);
  check(await p.evaluate(() => document.querySelector('[aria-label="Significance stars"] [aria-pressed="true"]').textContent) === '.10 .05 .01', 'stars .10 .05 .01');
  await panel.getByRole('button', { name: '.05 .01 .001' }).click();
  await panel.getByRole('button', { name: 'R', exact: true }).click(); await p.waitForTimeout(200); check(/Commands: R/.test(await body()), 'commands in R');
  await panel.getByRole('button', { name: 'Stata', exact: true }).click(); await p.waitForTimeout(200);
  // view
  await panel.getByRole('button', { name: 'Serif', exact: true }).click(); await panel.getByRole('button', { name: 'Large', exact: true }).click(); await panel.getByRole('button', { name: 'Night', exact: true }).click(); await p.waitForTimeout(400);
  const look = () => p.evaluate(() => getComputedStyle(document.body).fontFamily.split(',')[0] + '|' + getComputedStyle(document.documentElement).getPropertyValue('--c194F39').trim());
  const l1 = await look(); check(/Georgia/.test(l1), 'Serif font applied (' + l1 + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'settings-night.png') });
  // close: Escape, Done; Close dataset asks
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); check(await p.locator('.mf-settings-view').count() === 0, 'Escape closes Settings');
  await settings.click(); await p.waitForTimeout(300); await panel.getByRole('button', { name: 'Done' }).click(); await p.waitForTimeout(300);
  check(await p.locator('.mf-settings-view').count() === 0, 'Done closes Settings');
  const box = p.locator('input[placeholder*="Stata command"]').first(); if (!(await box.isVisible().catch(() => false))) { await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^(Output|Console)/.test(e.textContent.trim()))?.click()); await p.waitForTimeout(400); }
  await box.fill('generate z = 1'); await box.press('Enter'); await p.waitForTimeout(700);
  await settings.click(); await p.waitForTimeout(300); await panel.getByRole('button', { name: 'Close dataset' }).click(); await p.waitForTimeout(400);
  check(dialogs.some(m => /unsaved changes/.test(m)) && await p.locator('.mf-main').count() === 1, 'Close dataset asks first; No keeps the data');
  const p2 = await ctx.newPage(); await p2.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await p2.goto('file://' + path.resolve(__dirname, '../index.html')); await p2.waitForTimeout(2500); // (the first tab keeps its unsaved-changes guard)
  const l2 = await p2.evaluate(() => getComputedStyle(document.body).fontFamily.split(',')[0] + '|' + getComputedStyle(document.documentElement).getPropertyValue('--c194F39').trim());
  check(l2 === l1, 'font, size and palette kept when the page opens again (' + l2 + ')');
  await p2.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  if (fails.length) { console.log(fails.length + ' failed'); process.exit(1); }
  console.log('Settings passed in the browser.');
})().catch(e => { console.error(e); process.exit(1); });
