// Edit data tab in a real browser, fully offline: NODE_PATH=$(npm root -g) node calculator/tests/data-edit-e2e.cjs [GM26_SHOTS=dir]
// Uses every task through the page (menus, selects, buttons), saves the CSV and checks it, and fails on any console error.
const { chromium } = require('playwright'); const { pickBy } = require('./e2e-pick.cjs'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || ''; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-de-'));
  // a small survey: party 0/1, senator 0/1, ideology, a name, an empty column and four 1–5 items (q3 worded the other way)
  let seed = 3; const rnd = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const lines = ['id,democrat,senator,ideology,name,blank,q1,q2,q3,q4'];
  for (let i = 0; i < 80; i++) { const t = rnd() * 4, it = () => Math.max(1, Math.min(5, Math.round(1 + t + (rnd() - 0.5) * 1.6))); lines.push([i + 1, i % 3 ? 1 : 0, i % 7 === 0 ? 1 : 0, (rnd() * 2 - 1).toFixed(3), 'P' + i, '', it(), it(), 6 - it(), it()].join(',')); }
  const file = path.join(tmp, 'survey.csv'); fs.writeFileSync(file, lines.join('\n'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
  const external = []; await p.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); external.push(u); return r.abort(); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
  await p.locator('input[type=file]').first().setInputFiles(file);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 90000 }); await p.waitForTimeout(1200);
  const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const shot = async name => { if (shots) await p.screenshot({ path: path.join(shots, 'de-' + name + '.png'), fullPage: true }); };
  // a variable typed exactly in a picker is accepted without clicking the suggestion (the start tab shows its profile)
  const pk = p.locator('input[placeholder="TYPE A VARIABLE NAME"]').first();
  check(/Pick a variable to profile/.test(await p.locator('.mf-main').first().innerText()), 'start tab waits for a variable');
  await pk.click(); await pk.fill('ideology'); await pk.press('Tab'); await p.waitForTimeout(700);
  check((await pk.count()) === 0 || (await pk.inputValue()) === 'ideology', 'typed variable name accepted on leaving the box');
  check(!/Pick a variable to profile/.test(await p.locator('.mf-main').first().innerText()), 'the typed variable is profiled');
  // the Data menu opens under its own button
  const dataBtn = p.locator('button.mf-nav[data-nav="datam"]'); await dataBtn.click(); await p.waitForTimeout(300);
  const mb = await p.locator('.mf-navwrap:has(> .mf-nav[data-nav="datam"]) .mf-menu').boundingBox(), bb = await dataBtn.boundingBox();
  check(mb && Math.abs(mb.x - bb.x) < 4, 'Data menu opens under the Data button');
  if (shots) await p.screenshot({ path: path.join(shots, 'de-menu.png'), clip: { x: 0, y: 100, width: 1440, height: 640 } });
  await p.getByText('Fix a variable (rename', { exact: false }).first().click(); await p.waitForTimeout(400);
  const de = p.locator('.tl.de'); check(await de.count() === 1, 'Edit data opens on Fix a variable');
  check((await de.locator('.de-task').count()) === 3, 'three jobs at the top');
  // 1 · fix a variable: words typed as new values become value labels; description; rename
  await pickBy(p, de, 'Variable to change', 'democrat'); await p.waitForTimeout(300);
  check(await de.getByRole('radio', { name: /^Groups/ }).getAttribute('aria-checked') === 'true', '0/1 variable reads as groups');
  await de.getByLabel('New value for 0').fill('Rep'); await de.getByLabel('New value for 1').fill('Dem'); await p.waitForTimeout(200);
  await de.getByRole('button', { name: /Keep the numbers and use the words as labels/ }).click(); await p.waitForTimeout(300);
  check(/Labels added: 0 = Rep, 1 = Dem/.test(await de.innerText()), 'words on a 0/1 variable become value labels');
  check(await de.getByLabel('Label for 1').inputValue() === 'Dem', 'labels shown in the values table');
  await de.getByLabel('Label for 0').fill('Republican'); await p.waitForTimeout(150);
  check(/label define democrat_lb 0 "Republican" 1 "Dem", replace/.test(await de.innerText()), 'command shown before applying');
  await de.getByRole('button', { name: 'Apply', exact: true }).click(); await p.waitForTimeout(300);
  check(/2 labels saved/.test(await de.innerText()), 'labels applied from the one table');
  const desc = de.getByLabel('Description (variable label)'); await desc.fill('Member is a Democrat'); await desc.press('Enter'); await p.waitForTimeout(200);
  check(/Description saved/.test(await de.innerText()), 'description saved');
  await shot('1-fix');
  const nm = de.getByLabel('Name', { exact: true }); await nm.fill('party'); await de.getByRole('button', { name: 'Rename', exact: true }).click(); await p.waitForTimeout(300);
  check(/Renamed democrat → party/.test(await de.innerText()), 'rename');
  check(await de.getByLabel('Label for 1').inputValue() === 'Dem', 'labels kept after renaming');
  // a number with many values: a summary and a way to make groups (a new variable)
  await pickBy(p, de, 'Variable to change', 'ideology'); await p.waitForTimeout(300);
  check(await de.getByRole('radio', { name: /^Numbers/ }).getAttribute('aria-checked') === 'true', 'ideology reads as numbers');
  await de.getByRole('button', { name: /Make groups from it/ }).click(); await p.waitForTimeout(300);
  check(await de.getByRole('radio', { name: /Groups from a number/ }).getAttribute('aria-checked') === 'true', 'opens the groups recipe');
  await de.getByRole('button', { name: '4 equal-size groups (quartiles)' }).click(); await p.waitForTimeout(200);
  await shot('2-groups');
  await de.getByRole('button', { name: 'Create the grouped variable' }).click(); await p.waitForTimeout(400);
  check(/ideology_q4 created: 4 groups · 80 rows grouped/.test(await de.innerText()), 'quartile groups created');
  // change values only in some rows (replace … if), folded away under Fix a variable
  await de.getByRole('tab', { name: /Fix a variable/ }).click(); await pickBy(p, de, 'Variable to change', 'ideology'); await p.waitForTimeout(200);
  await de.getByRole('button', { name: /Change values only in some rows/ }).click(); await p.waitForTimeout(200);
  await de.getByLabel('New value').fill('0');
  await pickBy(p, de, 'Condition 1 variable', 'senator'); await de.getByLabel('Condition 1 value').fill('1'); await p.waitForTimeout(200);
  const nSen = lines.slice(1).filter(l => l.split(',')[2] === '1').length;
  check(new RegExp(nSen + ' of 80 rows match').test(await de.innerText()), 'live count of matching rows');
  await de.getByRole('button', { name: 'Replace', exact: true }).click(); await p.waitForTimeout(300);
  check(/real changes? made/.test(await de.innerText()), 'replace if');
  // 2 · make a new variable (build .68): create it, then set its values — generate + replace
  await de.getByRole('tab', { name: /Make a new variable/ }).click(); await p.waitForTimeout(200);
  check(/1 · Create it/i.test(await de.innerText()) && /2 · Change values/i.test(await de.innerText()), 'the two steps come first');
  await de.getByLabel('Name of the new variable').fill('dem_sen'); await de.getByRole('button', { name: '0', exact: true }).click();
  await de.getByRole('button', { name: 'Create dem_sen' }).click(); await p.waitForTimeout(300);
  check(/dem_sen created: 80 rows, every one 0/.test(await de.innerText()), 'generate dem_sen = 0');
  await de.getByLabel('New value').fill('1');
  await pickBy(p, de, 'Condition 1 variable', 'party'); await de.getByLabel('Condition 1 value').fill('1');
  await de.getByRole('button', { name: '+ and another condition' }).click(); await pickBy(p, de, 'Condition 2 variable', 'senator'); await de.getByLabel('Condition 2 value').fill('1'); await p.waitForTimeout(200);
  const want = lines.slice(1).filter(l => { const r = l.split(','); return r[1] === '1' && r[2] === '1'; }).length;
  check(new RegExp(want + ' of 80 rows match').test(await de.innerText()), 'live count before replacing (' + want + ')');
  await shot('3-new');
  await de.getByRole('button', { name: 'Replace', exact: true }).click(); await p.waitForTimeout(300);
  check(new RegExp('\\(' + want + ' real changes? made').test(await de.innerText()), 'dummy = 1 only where both conditions hold');
  await de.getByRole('button', { name: /More ways to make a variable/ }).click(); await p.waitForTimeout(200);
  // calculation
  await de.getByRole('radio', { name: /Calculation/ }).click(); await de.getByLabel('Name of the new variable').fill('ideo10');
  await de.getByLabel('Formula', { exact: true }).fill('ideology * 10'); await de.getByRole('button', { name: 'Create ideo10' }).click(); await p.waitForTimeout(300);
  check(/ideo10 created/.test(await de.innerText()), 'formula variable');
  // copy and recode
  await de.getByRole('radio', { name: /Copy and recode/ }).click(); await pickBy(p, de, 'Copy from', 'q1'); await p.waitForTimeout(200);
  for (const [k, g] of [['1', 'Disagree'], ['2', 'Disagree'], ['3', 'Neutral'], ['4', 'Agree'], ['5', 'Agree']]) { const box = de.getByLabel('New group for ' + k); if (await box.count()) await box.fill(g); }
  await p.waitForTimeout(200); check(/gen\(q1_r\)/.test(await de.innerText()), 'recode command shown');
  await shot('3b-copy');
  await de.getByRole('button', { name: 'Create q1_r' }).click(); await p.waitForTimeout(300);
  check(/q1_r created: \d groups/.test(await de.innerText()), 'copy and recode');
  // scale from several questions
  await de.getByRole('radio', { name: /Scale from several questions/ }).click(); await p.waitForTimeout(200);
  for (const v of ['q1', 'q2', 'q3', 'q4']) { await pickBy(p, de, 'Add an item to the scale', v); await p.waitForTimeout(150); }
  check(/q3 goes against the others/.test(await de.innerText()), 'reverse-worded item detected');
  await de.locator('.de-item', { hasText: 'q3' }).getByRole('checkbox').check(); await p.waitForTimeout(300);
  const st = await de.locator('.tl-stat').first().innerText(); const alpha = parseFloat(st.replace(/[^\d.]/g, ' ').trim().split(/\s+/)[0]);
  check(alpha > 0.7, 'alpha with q3 reversed = ' + alpha);
  await de.getByLabel('Name of the scale variable').fill('trust'); await de.getByRole('button', { name: 'Create the scale variable' }).click(); await p.waitForTimeout(300);
  check(/trust added — 80 rows have a score/.test(await de.innerText()), 'scale variable created');
  await shot('4-scale');
  // 3 · choose what to use: rows, then save only those rows
  await de.getByRole('tab', { name: /Choose what to use/ }).click(); await p.waitForTimeout(200);
  await pickBy(p, de, 'Keep rows where', 'senator'); await p.waitForTimeout(200);
  await de.locator('.de-lvls .tl-chip', { hasText: /^1/ }).click(); await de.getByRole('button', { name: /Keep rows where senator is one of these 1/ }).click(); await p.waitForTimeout(300);
  check(new RegExp('Analyses and charts use ' + nSen + ' of 80 rows').test(await de.innerText()), 'rows in use');
  check(new RegExp(nSen + ' of 80 rows').test(await de.getByRole('tab', { name: /Choose what to use/ }).innerText()), 'the tab shows the rows in use');
  check(new RegExp('ROWS: senator = 1').test(await p.locator('body').innerText()), 'status bar shows the rows in use');
  await de.getByRole('button', { name: /Save data as CSV/ }).click(); await p.waitForTimeout(200);
  await de.getByLabel(new RegExp('Only the ' + nSen + ' rows in use')).check(); await p.waitForTimeout(150);
  await shot('5-use');
  let [dl] = await Promise.all([p.waitForEvent('download'), de.getByRole('button', { name: 'Download CSV' }).click()]);
  let csv = fs.readFileSync(await dl.path(), 'utf8').split('\n');
  check(csv.length === nSen + 1 && csv.slice(1).every(l => l.split(',')[2] === '1'), 'CSV with only the ' + nSen + ' rows in use');
  await de.getByRole('button', { name: 'Use all rows' }).click(); await p.waitForTimeout(200);
  await de.getByRole('button', { name: /^More/ }).click(); await de.getByRole('button', { name: '+ 10 rows' }).click(); await p.waitForTimeout(300);
  check(/90 rows ×/.test(await de.innerText()), 'rows added');
  await de.getByRole('button', { name: /Hide empty \(1\)/ }).click(); await p.waitForTimeout(200);
  check(/1 of \d+ hidden/.test(await de.innerText()), 'empty variable hidden');
  await shot('6-use-vars');
  // save: hidden left out by default, included when ticked
  await de.getByRole('button', { name: /Save data as CSV/ }).click(); await p.waitForTimeout(200);
  [dl] = await Promise.all([p.waitForEvent('download'), de.getByRole('button', { name: 'Download CSV' }).click()]);
  csv = fs.readFileSync(await dl.path(), 'utf8').split('\n'); const head = csv[0].split(',');
  check(!head.includes('blank') && ['party', 'ideology_q4', 'dem_sen', 'ideo10', 'q1_r', 'trust'].every(v => head.includes(v)) && csv.length === 91, 'CSV has the new variables, 90 rows, hidden left out');
  check(/1 hidden left out/.test(await p.locator('body').innerText()), 'save is confirmed');
  await de.getByRole('button', { name: /Save data as CSV/ }).click(); await p.waitForTimeout(200);
  await de.getByLabel(/Include the 1 hidden/).check();
  [dl] = await Promise.all([p.waitForEvent('download'), de.getByRole('button', { name: 'Download CSV' }).click()]);
  csv = fs.readFileSync(await dl.path(), 'utf8').split('\n'); check(csv[0].split(',').includes('blank'), 'hidden variable included when ticked');
  // undo from the header
  const before = await de.locator('.de-dims').innerText();
  await de.getByRole('button', { name: /↶ Undo/ }).click(); await p.waitForTimeout(300);
  check((await de.locator('.de-dims').innerText()) !== before, 'undo from the tab header (' + before + ' → ' + (await de.locator('.de-dims').innerText()) + ')');
  // phone width
  await p.setViewportSize({ width: 390, height: 900 }); await dataBtn.click().catch(() => {}); await p.waitForTimeout(200);
  await p.getByText('Fix a variable (rename', { exact: false }).first().click().catch(() => {}); await p.waitForTimeout(400);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ov <= 1, 'no sideways scrolling at 390 px (' + ov + ')');
  await shot('7-phone');
  console.log('EXTERNAL REQUESTS', external.length, external.slice(0, 3).join(' '));
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
