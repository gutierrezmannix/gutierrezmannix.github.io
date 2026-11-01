// Edit data tab in a real browser, fully offline: NODE_PATH=$(npm root -g) node calculator/tests/data-edit-e2e.cjs [GM26_SHOTS=dir]
// Uses every task through the page (menus, selects, buttons), saves the CSV and checks it, and fails on any console error.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
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
  await p.getByText('Change a variable (rename', { exact: false }).first().click(); await p.waitForTimeout(400);
  const de = p.locator('.tl.de'); check(await de.count() === 1, 'Edit data opens on Change a variable');
  // 1 · change a variable: words become value labels, description, rename
  await de.getByLabel('Variable to change').selectOption('democrat'); await p.waitForTimeout(300);
  await de.getByLabel('New value for 0').fill('Rep'); await de.getByLabel('New value for 1').fill('Dem'); await p.waitForTimeout(200);
  await shot('1-words');
  await de.getByRole('button', { name: /Keep the numbers and show the words as labels/ }).click(); await p.waitForTimeout(300);
  check(/Labels added: 0 = Rep, 1 = Dem/.test(await de.innerText()), 'words on a 0/1 variable become value labels');
  const desc = de.getByLabel('Description (variable label)'); await desc.fill('Member is a Democrat'); await desc.press('Enter'); await p.waitForTimeout(200);
  check(/Description saved/.test(await de.innerText()), 'description saved');
  const nm = de.getByLabel('Name', { exact: true }); await nm.fill('party'); await de.getByRole('button', { name: 'Rename', exact: true }).click(); await p.waitForTimeout(300);
  check(/Renamed democrat → party/.test(await de.innerText()), 'rename');
  await de.getByRole('tab', { name: 'Value labels' }).click(); await p.waitForTimeout(200); await shot('1b-labels');
  check(await de.getByLabel('Label for 1').inputValue() === 'Dem', 'labels kept after renaming');
  // group into ranges
  await de.getByLabel('Variable to change').selectOption('ideology'); await p.waitForTimeout(300);
  await de.getByRole('tab', { name: 'Group into ranges' }).click(); await de.getByRole('button', { name: '4 equal-size groups (quartiles)' }).click(); await p.waitForTimeout(200);
  await shot('2-groups');
  await de.getByRole('button', { name: 'Create the grouped variable' }).click(); await p.waitForTimeout(400);
  check(/ideology_q4 created: 4 groups · 80 rows grouped/.test(await de.innerText()), 'quartile groups created');
  // only where … (replace if) on an existing variable, with the live count
  await de.getByRole('tab', { name: /Only where/ }).click(); await de.getByLabel('New value').fill('0');
  await de.getByLabel('Condition 1 variable').selectOption('senator'); await de.getByLabel('Condition 1 value').fill('1'); await p.waitForTimeout(200);
  const nSen = lines.slice(1).filter(l => l.split(',')[2] === '1').length;
  check(new RegExp(nSen + ' of 80 rows match').test(await de.innerText()), 'live count of matching rows');
  await de.getByRole('button', { name: 'Replace', exact: true }).click(); await p.waitForTimeout(300);
  check(/real changes? made/.test(await de.innerText()), 'replace if');
  // 2 · new variable: a dummy, then fill it in
  await de.getByRole('tab', { name: /New variable/ }).click(); await p.waitForTimeout(200);
  await de.getByLabel('Name of the new variable').fill('dem_sen'); await de.getByRole('button', { name: 'Zero (0)' }).click(); await de.getByRole('button', { name: 'Create', exact: true }).click(); await p.waitForTimeout(300);
  check(/working on dem_sen/.test(await de.innerText()), 'new variable created and opened for filling in');
  await de.getByLabel('New value').fill('1'); await de.getByLabel('Condition 1 variable').selectOption('party'); await de.getByLabel('Condition 1 value').fill('1');
  await de.getByRole('button', { name: '+ and another condition' }).click(); await de.getByLabel('Condition 2 variable').selectOption('senator'); await de.getByLabel('Condition 2 value').fill('1'); await p.waitForTimeout(200);
  await shot('3-new');
  await de.getByRole('button', { name: 'Replace', exact: true }).click(); await p.waitForTimeout(300);
  const want = lines.slice(1).filter(l => { const r = l.split(','); return r[1] === '1' && r[2] === '1'; }).length;
  check(new RegExp('\\(' + want + ' real changes? made').test(await de.innerText()), 'dummy = 1 only where both conditions hold (' + want + ')');
  // formula
  await de.getByLabel('Name of the new variable').fill('ideo10'); await de.getByRole('button', { name: 'A number or formula…' }).click();
  await de.getByLabel('Starting number or formula').fill('ideology * 10'); await de.getByRole('button', { name: 'Create', exact: true }).click(); await p.waitForTimeout(300);
  check(/working on ideo10/.test(await de.innerText()), 'formula variable');
  // 3 · make a scale
  await de.getByRole('tab', { name: /Make a scale/ }).click(); await p.waitForTimeout(200);
  for (const v of ['q1', 'q2', 'q3', 'q4']) { await de.getByLabel('Add an item to the scale').selectOption(v); await p.waitForTimeout(150); }
  check(/q3 goes against the others/.test(await de.innerText()), 'reverse-worded item detected');
  await de.locator('.de-item', { hasText: 'q3' }).getByRole('checkbox').check(); await p.waitForTimeout(300);
  const st = await de.locator('.tl-stat').first().innerText(); const alpha = parseFloat(st.replace(/[^\d.]/g, ' ').trim().split(/\s+/)[0]);
  check(alpha > 0.7, 'alpha with q3 reversed = ' + alpha);
  await de.getByLabel('Name of the scale variable').fill('trust'); await de.getByRole('button', { name: 'Create the scale variable' }).click(); await p.waitForTimeout(300);
  check(/trust added — 80 rows have a score/.test(await de.innerText()), 'scale variable created');
  await shot('4-scale');
  // 4 · rows
  await de.getByRole('tab', { name: /^Rows/ }).click(); await p.waitForTimeout(200);
  await de.getByLabel('Keep rows where').selectOption('senator'); await p.waitForTimeout(200);
  await de.locator('.de-lvls .tl-chip', { hasText: /^1/ }).click(); await de.getByRole('button', { name: /Keep rows where senator is one of these 1/ }).click(); await p.waitForTimeout(300);
  check(new RegExp('Analyses and charts use ' + nSen + ' of 80 rows').test(await de.innerText()), 'rows in use');
  check(new RegExp('ROWS: senator = 1').test(await p.locator('body').innerText()), 'status bar shows the rows in use');
  await shot('5-rows');
  await de.getByRole('button', { name: 'Use all rows' }).click(); await p.waitForTimeout(200);
  await de.getByRole('button', { name: '+ 10 rows' }).click(); await p.waitForTimeout(300);
  check(/90 rows ×/.test(await de.innerText()), 'rows added');
  // 5 · show / hide
  await de.getByRole('tab', { name: /Show \/ hide/ }).click(); await p.waitForTimeout(200);
  await de.getByRole('button', { name: /Hide the 1 empty variable/ }).click(); await p.waitForTimeout(200);
  check(/1 of \d+ hidden/.test(await de.innerText()), 'empty variable hidden');
  await shot('6-cols');
  // save: hidden left out by default, included when ticked
  let [dl] = await Promise.all([p.waitForEvent('download'), de.getByRole('button', { name: 'Save data as CSV' }).click()]);
  let csv = fs.readFileSync(await dl.path(), 'utf8').split('\n'); const head = csv[0].split(',');
  check(!head.includes('blank') && ['party', 'ideology_q4', 'dem_sen', 'ideo10', 'trust'].every(v => head.includes(v)) && csv.length === 91, 'CSV has the new variables, 90 rows, hidden left out');
  check(/1 hidden left out/.test(await p.locator('body').innerText()), 'save is confirmed');
  await de.getByLabel(/include the 1 hidden/).check();
  [dl] = await Promise.all([p.waitForEvent('download'), de.getByRole('button', { name: 'Save data as CSV' }).click()]);
  csv = fs.readFileSync(await dl.path(), 'utf8').split('\n'); check(csv[0].split(',').includes('blank'), 'hidden variable included when ticked');
  // undo from the header
  const before = await de.locator('.de-dims').innerText();
  await de.getByRole('button', { name: /↶ Undo/ }).click(); await p.waitForTimeout(300);
  check((await de.locator('.de-dims').innerText()) !== before, 'undo from the tab header (' + before + ' → ' + (await de.locator('.de-dims').innerText()) + ')');
  // phone width
  await p.setViewportSize({ width: 390, height: 900 }); await dataBtn.click().catch(() => {}); await p.waitForTimeout(200);
  await p.getByText('Change a variable (rename', { exact: false }).first().click().catch(() => {}); await p.waitForTimeout(400);
  const ov = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(ov <= 1, 'no sideways scrolling at 390 px (' + ov + ')');
  await shot('7-phone');
  console.log('EXTERNAL REQUESTS', external.length, external.slice(0, 3).join(' '));
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log('   ', e));
  console.log(fails.length ? 'FAILED: ' + fails.join(' | ') : 'ALL PASSED');
  await b.close(); if (errs.length || fails.length) process.exit(1);
})();
