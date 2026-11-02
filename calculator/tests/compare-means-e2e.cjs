// Tests ▾ → t-tests (Compare means) and Tests ▾ → Correlation (the matrix), clicked through in a real browser, offline:
//   NODE_PATH=$(npm root -g) node calculator/tests/compare-means-e2e.cjs
// GM26_SHOTS=dir saves screenshots; GM26_DATA=file.csv|dta uses another dataset for the smoke part (GM26_DATA_Y, _G).
// Fails on any console error.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-cm-'));
  const csv = path.join(tmp, 'encuesta.csv');
  { let s = 7; const u = () => (s = (s * 16807) % 2147483647) / 2147483647, nrm = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    const L = ['edad,ingreso,satisf,sexo,region,pre,post,comentario'];
    for (let i = 0; i < 120; i++) { const sexo = 1 + (i % 2), edad = Math.round(20 + 40 * u()), pre = +(50 + 10 * nrm()).toFixed(1), post = +(pre + 3 + 4 * nrm()).toFixed(1);
      const ingreso = Math.round(8000 + 150 * edad + (sexo === 1 ? 1500 : 0) + 3000 * nrm()), satisf = +(5 + 0.0002 * ingreso + 1.2 * nrm()).toFixed(1);
      L.push([i % 17 === 3 ? '' : edad, ingreso, i % 23 === 5 ? '' : satisf, sexo, 1 + (i % 4), pre, i % 29 === 7 ? '' : post, 'c' + i].join(',')); }
    fs.writeFileSync(csv, L.join('\n')); }
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => { window.__clip = []; const c = { writeText: s => { window.__clip.push({ text: s }); return Promise.resolve(); }, write: async items => { for (const it of items) { const o = {}; for (const t of it.types) o[t] = await (await it.getType(t)).text(); window.__clip.push(o); } } }; Object.defineProperty(navigator, 'clipboard', { value: c, configurable: true }); });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 400)));
  await p.route('**/*', r => { const u2 = r.request().url(); if (/^(file|data|blob):/.test(u2)) return r.continue(); return r.abort(); });
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(2000);
  const load = async file => { const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 10000 }), p.locator('.gi-drop').click()]); await fc.setFiles(file); await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 120000 }); await p.waitForTimeout(1500); };
  await load(csv);
  const ITEM = { 't-tests': 'One-sample, independent and paired t-tests', Correlation: 'Correlation matrix (Pearson and Spearman)' };
  const clickText = label => p.evaluate(l => { const e = [...document.querySelectorAll('button')].find(x => x.offsetParent && x.textContent.trim() === l); if (e) e.click(); return !!e; }, label);
  const menu = async item => { for (let k = 0; k < 3; k++) { if (await clickText(ITEM[item])) break; await p.locator('button.mf-nav[data-nav="tests"]').click(); await p.waitForTimeout(700); } await p.waitForTimeout(700); };
  const pick = async (aria, value) => { await p.locator('select[aria-label="' + aria + '"]').first().selectOption(value); await p.waitForTimeout(350); };
  const btn = async (name, scope) => { await (scope || p).getByRole('button', { name, exact: true }).first().click(); await p.waitForTimeout(350); };
  const txt = sel => p.locator(sel).first().innerText();
  const clip = () => p.evaluate(() => window.__clip.slice(-1)[0] || {});
  const download = async name => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), btn(name)]); const f = path.join(tmp, d.suggestedFilename()); await d.saveAs(f); return f; };

  // ---------- Compare means ----------
  await menu('t-tests');
  check(await p.locator('.cm').count() === 1 && /Compare the mean of/.test(await txt('.cm')), 'the t-test page opens with its sentence');
  await pick('Outcome', 'ingreso'); await pick('What to compare with', 'groups'); await pick('Group variable', 'sexo');
  let a = await txt('.cm-answer');
  check(/SIGNIFICANT|NOT SIGNIFICANT/.test(a) && /Welch/.test(a) && /120 cases used of 120/.test(a), 'two groups: the answer appears (Welch, 120 cases) — ' + a.split('\n').slice(0, 3).join(' | '));
  console.log('      ' + a.replace(/\n+/g, ' | ').slice(0, 700));
  if (shots) await p.screenshot({ path: path.join(shots, 'cm-groups.png'), fullPage: true });
  const head1 = await txt('.cm-head');
  await btn('Swap the two groups'); const head2 = await txt('.cm-head');
  check(head1 !== head2 && /higher/.test(head1) !== /higher/.test(head2), 'swap reverses the difference: ' + head2.slice(0, 120));
  await btn('Swap the two groups');
  await p.locator('[aria-label="Variances"] button').filter({ hasText: 'Student' }).click(); await p.waitForTimeout(350);
  a = await txt('.cm-answer'); check(/Student/.test(a) && /t\(118\)/.test(a), 'Student’s test: df 118');
  await p.locator('[aria-label="Confidence level"] button').filter({ hasText: '99%' }).click(); await p.waitForTimeout(350);
  a = await txt('.cm-answer'); check(/99% CI/.test(a), '99% confidence interval');
  await p.locator('[aria-label="Alternative hypothesis"] button').filter({ hasText: 'first > second' }).click(); await p.waitForTimeout(350);
  a = await txt('.cm-answer'); check(/one-sided/.test(a), 'one-sided test labelled');
  console.log('      ' + a.replace(/\n+/g, ' | ').slice(0, 500));
  await p.locator('[aria-label="Alternative hypothesis"] button').filter({ hasText: 'two-sided' }).click();
  await p.locator('[aria-label="Confidence level"] button').filter({ hasText: '95%' }).click(); await p.waitForTimeout(350);
  let f = await download('Word table (.docx)'); const docx = fs.readFileSync(f);
  check(path.basename(f) === 'ttest-ingreso.docx' && docx.slice(0, 2).toString() === 'PK' && docx.length > 2000, 'Word table downloads (' + path.basename(f) + ', ' + docx.length + ' bytes)');
  await btn('Copy table for Word'); let c = await clip(); check(/<table/.test(c['text/html'] || '') && /ingreso/.test(c['text/plain'] || c['text/html'] || ''), 'Copy table for Word puts an HTML table on the clipboard');
  await btn('Copy APA'); c = await clip(); check(/^t\(118\) = -?\d/.test(c.text || ''), 'Copy APA: ' + (c.text || ''));
  // more than two groups
  await pick('Group variable', 'region'); a = await txt('.cm');
  check(/pick the two groups|first group/i.test(a), 'four regions: asks for the two groups');
  await pick('First group', '1'); await pick('Second group', '3'); a = await txt('.cm-answer'); check(/60 cases used of 120/.test(a) && /ANOVA/.test(a), 'region 1 vs 3: 60 cases, with the ANOVA link');
  // paired
  await pick('What to compare with', 'paired'); await pick('Outcome', 'post'); await pick('Second measurement', 'pre');
  a = await txt('.cm-answer'); check(/Paired/.test(a) && /d_z/.test(a) && /116 complete pairs of 120/.test(a), 'paired: d_z — ' + a.split('\n').slice(0, 3).join(' | '));
  if (shots) await p.screenshot({ path: path.join(shots, 'cm-paired.png'), fullPage: true });
  // one value
  await pick('What to compare with', 'value'); await p.locator('input[aria-label="Value to compare with"]').fill('60'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  a = await txt('.cm-answer'); check(/One-sample/.test(a) && /116 cases|116 of 120|of 120/.test(a), 'one sample vs 60 — ' + a.split('\n').slice(0, 3).join(' | '));
  // summary numbers
  await pick('What to compare with', 'summary'); a = await txt('.cm');
  const fills = await p.locator('.cm input').count();
  check(fills >= 6, 'summary mode: boxes for the means, SDs and n (' + fills + ')');
  const inputs = p.locator('.cm input'); const vals = { 'Mean of group 1': '72.5', 'SD of group 1': '8.1', 'n of group 1': '30', 'Mean of group 2': '68.2', 'SD of group 2': '9.4', 'n of group 2': '28' };
  for (const [k, v] of Object.entries(vals)) { const loc = p.locator('input[aria-label="' + k + '"]'); check(await loc.count() === 1, 'summary box ' + k); await loc.fill(v); await p.keyboard.press('Enter'); await p.waitForTimeout(150); }
  await p.waitForTimeout(400); a = await txt('.cm-answer'); check(/SIGNIFICANT/.test(a), 'summary numbers run the test — ' + a.split('\n').slice(0, 3).join(' | '));
  if (shots) await p.screenshot({ path: path.join(shots, 'cm-summary.png'), fullPage: true });
  await btn('Add to console'); await p.waitForTimeout(400);

  // ---------- Correlation ----------
  await menu('Correlation');
  check(await p.locator('.cr-table').count() === 1, 'the correlation page opens with a matrix');
  if (await p.getByRole('button', { name: 'clear', exact: true }).count()) await btn('clear');
  for (const v of ['edad', 'ingreso', 'satisf', 'pre', 'post']) await pick('Add a variable', v);
  let cells = await p.locator('button.cr-cell').count(); check(cells === 10, '5 variables: 10 cells (' + cells + ')');
  let t = await txt('.cm'); console.log('      ' + t.replace(/\n+/g, ' | ').slice(0, 900));
  if (shots) await p.screenshot({ path: path.join(shots, 'cor-matrix.png'), fullPage: true });
  const labels = await p.locator('button.cr-cell').evaluateAll(es => es.map(e => e.getAttribute('aria-label')));
  console.log('      ' + labels.join('\n      '));
  await p.locator('button.cr-cell').nth(0).click(); await p.waitForTimeout(400);
  t = await txt('.cr-pair'); console.log('      PAIR ' + t.replace(/\n+/g, ' | ').slice(0, 400)); check(/PEARSON r/i.test(t) && /SPEARMAN RHO/i.test(t) && /SLOPE/i.test(t), 'click a cell: the pair panel');
  const slope = Number((t.match(/SLOPE\s*\|?\s*([+−-]?[\d.,]+)/i) || [])[1]?.replace(/,/g, '').replace('−', '-')); check(slope > 100 && slope < 200, 'slope of ingreso on edad ≈ 150 per year (' + slope + ')');
  await p.locator('[aria-label="Method"] button').filter({ hasText: 'Spearman' }).click(); await p.waitForTimeout(400);
  check(/Spearman’s ρ/.test(await txt('.cm')), 'Spearman: the page says Spearman’s ρ');
  await p.locator('[aria-label="Rows used"] button').filter({ hasText: 'Complete on all' }).click(); await p.waitForTimeout(400);
  t = await txt('.cm'); check(/rows complete on every variable|complete rows|Complete/.test(t), 'complete rows: ' + t.split('\n').find(l => /complete|rows/i.test(l)));
  await p.locator('[aria-label="Show in each cell"] button').filter({ hasText: '% CI' }).click(); await p.waitForTimeout(300);
  await p.locator('[aria-label="Method"] button').filter({ hasText: 'Pearson' }).click(); await p.waitForTimeout(400);
  await btn('Copy matrix (numbers)'); c = await clip(); const rows = (c.text || '').replace(/\s+$/, '').split('\n');
  check(rows.length === 6 && rows[0].split('\t').length === 6 && rows[1].split('\t')[1] === '1', 'Copy matrix: a 5×5 square of numbers with headers');
  console.log('      ' + rows.join('\n      '));
  f = await download('Download CSV (r, p, n)'); const csvOut = fs.readFileSync(f, 'utf8');
  check(path.basename(f) === 'correlation-matrix.csv' && /Pearson r \(complete rows\)/.test(csvOut) && /\np \(two-sided\)\n/.test(csvOut) && /\nn\n/.test(csvOut), 'CSV with the r, p and n matrices');
  f = await download('Word table (.docx)'); const d2 = fs.readFileSync(f); check(path.basename(f) === 'correlation-table.docx' && d2.slice(0, 2).toString() === 'PK', 'Word table of the correlations (' + d2.length + ' bytes)');
  fs.copyFileSync(f, path.join(shots || tmp, 'correlation-table.docx')); fs.copyFileSync(csv, path.join(shots || tmp, 'encuesta.csv')); fs.writeFileSync(path.join(shots || tmp, 'correlation-matrix.csv'), csvOut);
  await btn('Copy table for Word'); c = await clip(); check(/<table/.test(c['text/html'] || ''), 'Copy table for Word (HTML table)');
  // remove a variable
  await p.locator('[aria-label="Remove satisf"]').click(); await p.waitForTimeout(300); check(await p.locator('button.cr-cell').count() === 6, 'remove a variable: 6 cells');
  // the console has both entries
  await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^Console\b/.test(e.textContent.trim()))?.click()); await p.waitForTimeout(800);
  const out = await p.locator('body').innerText(); console.log('      CONSOLE ' + (out.match(/ttesti[^\n]*/) || ['none'])[0]); check(/ttesti 30 72\.5 8\.1 28 68\.2 9\.4/.test(out), 'console: ttesti for the summary test'); check(/correlate edad ingreso pre post/.test(out), 'console: correlate for the matrix');
  if (shots) await p.screenshot({ path: path.join(shots, 'console.png'), fullPage: false });
  // phone width
  await p.setViewportSize({ width: 390, height: 844 }); await menu('Correlation'); await p.waitForTimeout(600);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 1, 'phone width: no sideways page scroll (' + over + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'cor-phone.png'), fullPage: true });
  await menu('t-tests'); await p.waitForTimeout(500); const over2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over2 <= 1, 'phone width t-tests: no sideways scroll (' + over2 + ')');
  if (shots) await p.screenshot({ path: path.join(shots, 'cm-phone.png'), fullPage: true });
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' || ') : ''));
  await b.close();
  console.log(fails.length ? fails.length + ' FAILED' : 'Compare means and the correlation matrix passed in the browser.');
  process.exit(fails.length ? 1 : 0);
})();
