// Draws the per-term dot plots (one PNG per legislature, titulares and everyone) from the temporary strips.json
// written by build_data.R, then deletes that file. Needs Playwright's Chromium (NODE_PATH to a global install is fine).
//   node render_strips.cjs /path/to/tmpdir
const fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const tmp = process.argv[2] || require('os').tmpdir(), src = path.join(tmp, 'strips.json'), out = path.join(__dirname, '..', 'img');
const rows = JSON.parse(fs.readFileSync(src, 'utf8')); fs.mkdirSync(out, { recursive: true });
const COL = { PAN: '#3A7BD5', PRI: '#2DA06A', PRD: '#E6B83A', MORENA: '#B2385C', PVEM: '#8FD05A', PT: '#D9533A', MC: '#F08A3C', Other: '#8A847B' };
const ORDER = ['MORENA', 'PT', 'PVEM', 'PRD', 'MC', 'PRI', 'PAN', 'Other'];
function svgFor(leg, who) {
  const pts = rows.filter(r => r.legislature === leg && (who === 'all' || r.supl === 0)), parties = ORDER.filter(p => pts.some(d => d.p === p));
  const W = 800, L = 96, R = 24, rowH = 36, top = 30, H = top + parties.length * rowH + 34, x = v => L + (v + 1) / 2 * (W - L - R);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Hanken Grotesk, system-ui, sans-serif"><rect width="${W}" height="${H}" fill="#2E2B28"/>`;
  for (const t of [-1, -.5, 0, .5, 1]) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 10}" y2="${top + parties.length * rowH}" stroke="#3D3934"/><text x="${x(t)}" y="${top - 14}" fill="#9A9288" font-size="11" text-anchor="middle" font-family="Space Mono, monospace">${t}</text>`;
  let seed = 11 + leg; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  parties.forEach((p, i) => {
    const y = top + i * rowH + rowH / 2, xs = pts.filter(d => d.p === p).map(d => d.x).sort((a, b) => a - b), q = f => xs[Math.min(xs.length - 1, Math.floor(f * (xs.length - 1)))];
    if (xs.length >= 3) s += `<rect x="${x(q(.25))}" y="${y - 12}" width="${Math.max(2, x(q(.75)) - x(q(.25)))}" height="24" fill="${COL[p]}" opacity=".18" rx="3"/>`;
    s += `<line x1="${x(q(.5))}" x2="${x(q(.5))}" y1="${y - 14}" y2="${y + 14}" stroke="${COL[p]}" stroke-width="2.5"/>`;
    s += `<text x="${L - 8}" y="${y + 4}" fill="#C8C0B5" font-size="12" text-anchor="end" font-weight="600">${p} ${xs.length}</text>`;
    // deterministic jitter, sorted so the picture is stable between builds
    pts.filter(d => d.p === p).sort((a, b) => a.x - b.x).forEach(d => { const jy = y + (rnd() - .5) * 20; s += d.one ? `<circle cx="${x(d.x)}" cy="${jy.toFixed(1)}" r="3.2" fill="none" stroke="${COL[p]}" stroke-width="1.4"/>` : `<circle cx="${x(d.x)}" cy="${jy.toFixed(1)}" r="3.2" fill="${COL[p]}" opacity=".85"/>`; });
  });
  s += `<text x="${x(0)}" y="${H - 10}" fill="#9A9288" font-size="11.5" text-anchor="middle">opposition ◀ · first dimension · ▶ governing party · ${pts.length} deputies</text></svg>`;
  return { s, W, H };
}
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2 });
  const legs = [...new Set(rows.map(r => r.legislature))].sort();
  for (const leg of legs) for (const who of ['tit', 'all']) {
    const { s, W, H } = svgFor(leg, who); await p.setViewportSize({ width: W, height: H });
    await p.setContent(`<!doctype html><html><body style="margin:0;background:#2E2B28">${s}</body></html>`);
    await p.screenshot({ path: path.join(out, `strip-${leg}-${who}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  }
  await b.close(); fs.unlinkSync(src); console.log('wrote', legs.length * 2, 'pictures to img/; removed', src);
})();
