// Networks tab in a real browser: GM26_NET_FILES="edges.csv,nodes.csv" [GM26_SHOTS=dir] NODE_PATH=$(npm root -g) node calculator/tests/net-lab-e2e.cjs
// Walks all eight steps, runs the MCMC model, fails on any console error.
const { chromium } = require('playwright');
(async () => {
  const path = require('path'); const url = path.resolve(__dirname, '../index.html'); const [edges, nodes] = (process.env.GM26_NET_FILES || '').split(','); const out = process.env.GM26_SHOTS || ''; const tag = path.basename(edges || 'net').replace(/\.[a-z]+$/i, '');
  if (!edges || !nodes) { console.log('Set GM26_NET_FILES="edges.csv,nodes.csv"'); process.exit(0); }
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|net::/.test(m.text())) errs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack || e).slice(0, 500)));
  await p.goto('file://' + url); await p.waitForTimeout(2500);
  await p.locator('input[type=file]').first().setInputFiles(nodes);
  await p.waitForFunction(() => document.querySelector('.mf-main'), null, { timeout: 120000 }); await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /^Tests/ }).first().click(); await p.waitForTimeout(300);
  const items = p.getByText('Networks analysis', { exact: true }); let vis = []; for (let i = 0; i < await items.count(); i++) if (await items.nth(i).isVisible()) vis.push(i);
  await items.nth(vis[vis.length - 1]).click(); await p.waitForTimeout(400); vis = []; for (let i = 0; i < await items.count(); i++) if (await items.nth(i).isVisible()) vis.push(i); if (vis.length > 1) await items.nth(vis[vis.length - 1]).click();
  await p.waitForSelector('.nl', { timeout: 30000 });
  const nl = p.locator('.nl'), ins = nl.locator('input[type=file]');
  await ins.nth(0).setInputFiles(edges); await p.waitForTimeout(1500); await ins.nth(1).setInputFiles(nodes); await p.waitForTimeout(1500);
  const idle = async (ms) => { await p.waitForFunction(() => !document.querySelector('.nl .tl-pending'), null, { timeout: ms || 60000 }).catch(() => console.log('  (still pending)')); await p.waitForTimeout(500); };
  await idle(); if (out) await nl.screenshot({ path: `${out}/${tag}-1-data.png` }); console.log('data', (await nl.innerText()).replace(/\s+/g, ' ').slice(0, 300));
  const steps = [['Overview', '2-overview'], ['Map', '3-map'], ['People', '4-people'], ['Groups', '5-groups'], ['Ties & similarity', '6-ties'], ['Over time', '7-time'], ['Save', '8-save']];
  for (const [name, file] of steps) {
    const t0 = Date.now(); await nl.locator('nav.tl-steps button', { hasText: name }).first().click(); await idle(90000);
    if (name === 'Map') { if (out) await nl.locator('svg.nl-map').first().screenshot({ path: `${out}/${tag}-map-only.png` }); }
    if (name === 'Ties & similarity') { await nl.getByRole('button', { name: /Run/ }).first().click(); const t1 = Date.now(); await p.waitForFunction(() => document.querySelector('.nl .nl-badge') || document.querySelector('.nl .tl-banner.warn'), null, { timeout: 240000 }).catch(() => console.log('  model still running')); console.log('  model seconds', ((Date.now() - t1) / 1000).toFixed(1), (await nl.locator('.nl-badge, .tl-banner.warn').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)); await p.waitForTimeout(800); }
    if (out) await nl.screenshot({ path: `${out}/${tag}-${file}.png` }); console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's', (await nl.innerText()).replace(/\s+/g, ' ').slice(0, 160));
  }
  console.log('ERRORS', errs.length); errs.slice(0, 6).forEach(e => console.log(e));
  await b.close(); if (errs.length) process.exit(1);
})();
