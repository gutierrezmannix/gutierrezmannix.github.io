// The start page's two buttons and the File menu in a real browser, offline (build .67):
// NODE_PATH=$(npm root -g) node calculator/tests/file-menu-e2e.cjs
// Create your own dataset (a button: mouse and keyboard, no file dialog, lands on Make a new variable, values
// typed in Browse are kept); drag and drop without flicker; File → Open another dataset… and Open a saved session…
// open the file dialog at once and keep the open dataset if the dialog is cancelled or the file cannot be read;
// unsaved changes are asked about before they are replaced; Create a new dataset asks too; Copy session log with an
// empty log says so; Save data as CSV, Save session and Print lab report. GM26_SHOTS=dir saves screenshots.
const { chromium } = require('playwright'); const path = require('path'), os = require('os'), fs = require('fs');
(async () => {
  const shots = process.env.GM26_SHOTS || '', tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gm26-file-'));
  const put = (n, body) => { const f = path.join(tmp, n); fs.writeFileSync(f, body); return f; };
  const tricky = put('tricky.csv', 'nombre,edad,region\n"Ana, María",31,1\n"José ""Pepe""",45.5,2\n"Línea\nnueva",,1\nÑandú,1000000000.07,3\n,0.000001234,2\n');
  const small = put('small.csv', 'a,b\n1,2\n3,4\n'), pdf = put('informe.pdf', '%PDF-1.4 not data');
  const b = await chromium.launch(); const fails = []; const check = (ok, what) => { console.log((ok ? '  ok  ' : '  FAIL') + ' ' + what); if (!ok) fails.push(what); };
  const errs = [];
  const fresh = async () => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage(); p.__dialogs = []; p.__answer = true;
    p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' && !/net::|ERR_/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    p.on('dialog', async d => { p.__dialogs.push(d.message()); if (p.__answer) await d.accept(); else await d.dismiss(); });
    await p.addInitScript(() => { window.__clip = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: t => { window.__clip.push(t); return Promise.resolve(); }, write: async () => {} }, configurable: true }); window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await p.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
    await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForSelector('.gi-drop'); await p.waitForTimeout(1500); return { ctx, p };
  };
  const chooser = async (p, act, ms = 3000) => { const ev = p.waitForEvent('filechooser', { timeout: ms }).catch(() => null); await act(); return await ev; };
  const body = async p => (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  const fileName = async p => ((await body(p)).match(/GM 26\.11 (\S+) \d/) || [])[1];
  const menu = async (p, item) => { await p.getByRole('button', { name: /^File/ }).first().click(); await p.waitForTimeout(250); await p.getByText(item, { exact: true }).first().click(); };
  const load = async (p, f) => { const fc = await chooser(p, () => p.locator('.gi-browse').click()); await fc.setFiles(f); await p.waitForSelector('.mf-main', { timeout: 60000 }); await p.waitForTimeout(1200); };
  const cmd = async (p, s) => { const box = p.locator('input[placeholder*="Stata command"]').first(); if (!(await box.isVisible().catch(() => false))) { await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.offsetParent && /^(Output|Console)/.test(e.textContent.trim()))?.click()); await p.waitForTimeout(400); } await box.fill(s); await box.press('Enter'); await p.waitForTimeout(900); };

  // ---- Create your own dataset
  let { ctx, p } = await fresh();
  check(await p.evaluate(() => document.querySelector('.gi-new').tagName) === 'BUTTON', 'Create your own dataset is a button');
  await p.locator('.gi-new').focus(); let fc = await chooser(p, () => p.keyboard.press('Space')); await p.waitForTimeout(1500);
  check(!fc && /1 · Create it/i.test(await body(p)), 'Space opens the new dataset on Make a new variable (create it · set its values), with no file dialog');
  await p.getByRole('tab', { name: /Fix a variable/ }).click(); await p.waitForTimeout(300);
  check(/this dataset has no variables yet/.test(await body(p)), 'Fix a variable on an empty dataset says what to do');
  await p.getByRole('button', { name: 'Make a new variable →' }).click(); await p.waitForTimeout(300);
  await p.getByLabel('Name of the new variable').fill('edad'); await p.getByRole('button', { name: /^Create edad/ }).click(); await p.waitForTimeout(800);
  await p.getByRole('button', { name: /Type values by hand in Browse/ }).first().click(); await p.waitForTimeout(800);
  await p.locator('input.mf-browse-cell[data-ck="0:0"]').click(); for (const v of ['34', '41', '29']) { await p.keyboard.type(v); await p.keyboard.press('Enter'); await p.waitForTimeout(250); }
  check(/edad • \[new\] 3 valid/.test(await body(p)), 'values typed in Browse are kept (3 valid)');
  if (shots) await p.screenshot({ path: path.join(shots, 'file-create.png'), fullPage: true });
  await ctx.close();

  // ---- drag and drop
  ({ ctx, p } = await fresh());
  await p.evaluate(async () => { const dt = new DataTransfer(); dt.items.add(new File(['a,b\n1,2\n'], 'dropped.csv', { type: 'text/csv' })); const z = document.querySelector('.gi-drop'); z.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 100)); z.dispatchEvent(new DragEvent('dragleave', { dataTransfer: dt, bubbles: true, relatedTarget: z.querySelector('.gi-browse') })); });
  await p.waitForTimeout(200); check(await p.locator('.gi-release').count() === 1, 'dragging over the button keeps RELEASE TO LOAD (no flicker)');
  await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['a,b\n1,2\n3,4\n'], 'dropped.csv', { type: 'text/csv' })); document.querySelector('.gi-drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); });
  await p.waitForSelector('.mf-main', { timeout: 20000 }).catch(() => {}); check(await fileName(p) === 'dropped.csv', 'a dropped file loads');
  await ctx.close();

  // ---- File menu
  ({ ctx, p } = await fresh());
  await load(p, tricky);
  fc = await chooser(p, () => menu(p, 'Open another dataset…')); check(!!fc, 'Open another dataset… opens the file dialog at once');
  if (fc) await fc.setFiles([]); await p.waitForTimeout(600);
  check(await fileName(p) === 'tricky.csv' && await p.locator('.mf-main').count() === 1, 'cancelling the dialog keeps the dataset');
  fc = await chooser(p, () => menu(p, 'Open another dataset…')); await fc.setFiles(pdf); await p.waitForTimeout(1800);
  check(await fileName(p) === 'tricky.csv' && /Could not open informe\.pdf: "informe\.pdf" is not a data file/.test(await body(p)), 'a file that cannot be read: the dataset stays, with the reason');
  let dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await menu(p, 'Save data as CSV'); dl = await dl;
  let csvOut = dl ? fs.readFileSync(await dl.path(), 'utf8') : '';
  check(dl && dl.suggestedFilename() === 'tricky.csv' && csvOut.includes('"Ana, María",31,1') && csvOut.includes('"José ""Pepe""",45.5,2') && csvOut.includes('1000000000.07'), 'Save data as CSV keeps commas, quotes, accents and every digit');
  dl = p.waitForEvent('download', { timeout: 5000 }).catch(() => null); await menu(p, 'Save session (data + settings + log)'); dl = await dl;
  const sess = path.join(tmp, 'tricky.gm26.json'); if (dl) await dl.saveAs(sess); check(dl && dl.suggestedFilename() === 'tricky.gm26.json', 'Save session downloads tricky.gm26.json');
  await cmd(p, 'generate z = 1');
  p.__answer = false; p.__dialogs = []; fc = await chooser(p, () => menu(p, 'Open another dataset…')); await fc.setFiles(small); await p.waitForTimeout(1500);
  check(p.__dialogs.some(m => /replaces the current dataset, which has unsaved changes/.test(m)) && await fileName(p) === 'tricky.csv', 'unsaved changes: it asks first, and No keeps the dataset');
  p.__dialogs = []; await menu(p, 'Create a new dataset'); await p.waitForTimeout(800);
  check(p.__dialogs.some(m => /Start a new, empty dataset\? It replaces the current one/.test(m)) && await fileName(p) === 'tricky.csv', 'Create a new dataset asks first too');
  p.__answer = true; await menu(p, 'Create a new dataset'); await p.waitForTimeout(1500);
  check(await fileName(p) === 'my-dataset' && /1 · Create it/i.test(await body(p)), 'Yes → a new dataset on Make a new variable');
  await menu(p, 'Copy session log'); await p.waitForTimeout(300); check(/The session log is empty/.test(await body(p)), 'Copy session log with an empty log says so');
  fc = await chooser(p, () => menu(p, 'Open a saved session…')); check(!!fc, 'Open a saved session… opens the file dialog at once');
  if (fc) { await fc.setFiles(sess); await p.waitForTimeout(2500); }
  check(await fileName(p) === 'tricky.csv' && /5 ROWS × 3 VARS/.test(await body(p)), 'the saved session opens (5 rows × 3 variables)');
  await cmd(p, 'summarize edad');
  await menu(p, 'Copy session log'); await p.waitForTimeout(400);
  check(/^\. summarize edad, detail\nci means edad/.test(await p.evaluate(() => window.__clip.at(-1) || '')), 'Copy session log copies the commands with their output');
  await menu(p, 'Print lab report…'); await p.waitForTimeout(800); check(/Analysis session report/.test(await body(p)), 'Print lab report opens the report');
  await p.getByRole('button', { name: /Print \/ save as PDF/i }).click(); await p.waitForTimeout(300); check(await p.evaluate(() => window.__printed) === 1, 'Print / save as PDF calls the browser print');
  await p.getByRole('button', { name: /Back to workbench/i }).click(); await p.waitForTimeout(600); check(await p.locator('.mf-main').count() === 1, 'Back to workbench returns');
  await ctx.close();

  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  if (fails.length) { console.log(fails.length + ' failed'); process.exit(1); }
  console.log('Start page and File menu passed in the browser.');
})().catch(e => { console.error(e); process.exit(1); });
