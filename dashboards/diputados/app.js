/* ============================================================
   Deputies dashboard — voting alignment in Mexico's Chamber of Deputies
   Data: data/diputados-agg.js (summaries per term, party and state) and img/strip-<leg>-<who>.png,
   both produced locally by build/build_data.R and build/render_strips.cjs from the member-level file,
   which is never published. No network, no libraries: works from GitHub Pages or from disk.
   ============================================================ */
(function () {
  'use strict';
  const D = window.Dash, $ = (s) => document.querySelector(s);
  const COL = { PAN: '#3A7BD5', PRI: '#2DA06A', PRD: '#E6B83A', MORENA: '#B2385C', PVEM: '#8FD05A', PT: '#D9533A', MC: '#F08A3C', Other: '#8A847B' };
  const ORDER = ['PAN', 'PRI', 'PRD', 'MORENA', 'PVEM', 'PT', 'MC', 'Other'];

  D.strings({
    en: {
      navPubs: 'Publications', navTeach: 'Teaching', navData: 'Data', navDocs: 'Recommendations', navCalc: 'Calculator', navDash: 'Dashboards',
      title: 'Voting alignment in the Chamber of Deputies',
      lede: 'Where each deputy sits on the main voting dimension of every legislature since 2000, estimated from roll-call votes. Positions are comparable inside a term; across terms, compare how tightly each caucus votes.',
      tabTerm: 'One legislature', tabCoh: 'Cohesion over time', tabStates: 'States', tabCov: 'Coverage & method',
      legislature: 'Legislature', who: 'Deputies', whoTit: 'Titulares', whoAll: 'Including suplentes', parties: 'Parties in this term', about: 'About this term',
      stripNote: 'Each dot is one deputy; the tick is the party median and the band its middle half. Hollow dots are one-sided estimates, pinned at the edge of the scale. The picture carries no names: this page publishes summaries, not the member-level file.',
      ptableNote: 'Scored / seats: deputies with an estimate out of the titulares on the roster. Median and middle half are on the oriented scale.',
      party: 'Party', seats: 'Seats', scored: 'Scored', median: 'Median', half: 'Middle half', termTitle: '{r} Legislature · {y}', termSub: '{n} deputies with an estimate · opposition to the left, governing party ({g}) to the right',
      fYears: 'Years', fGov: "President's party", fScored: 'Deputies with an estimate', fOne: 'One-sided estimates', fVotes: 'Median votes per deputy', fSe: 'Median standard error', fSeat: 'Seats', fPartial: 'Partial term', fPartialV: 'votes up to {d}; estimates will move as the term goes on', fNoGeo: 'No state or seat-type data for this term',
      legMedian: 'party median', legBand: 'middle half of the caucus', legOne: 'one-sided estimate',
      measure: 'Measure', mIqr: 'Width of the middle half', mSd: 'Standard deviation', mMed: 'Median position',
      cohIqr: 'How tightly each caucus votes', cohSd: 'Spread of each caucus', cohMed: 'Where each caucus sits',
      cohSubW: 'Width of the middle half of the party’s deputies, term by term. 0 means everyone votes alike. Widths compare across terms; positions do not.',
      cohSubSd: 'Standard deviation of the party’s deputies’ positions, term by term. Spreads compare across terms; positions do not.',
      cohSubMed: 'Median position per term on the oriented scale: opposition to the left, the president’s party to the right. Read it within a term; the scale is re-estimated every term.',
      cohNote: 'Hollow points mark caucuses with fewer than 10 scored deputies. Hover a point for the numbers.', legFew: 'fewer than 10 scored deputies',
      colour: 'Colour the map by', modeParty: 'Largest party', modePos: 'Mean position', delegation: 'Delegation', pickState: 'Click a state',
      mapTitle: 'State delegations · {r} Legislature', mapSubParty: 'Each state coloured by the party with most scored titulares in its delegation; paler when that party holds less than half.',
      mapSubPos: 'Mean position of the delegation on the oriented scale; grey where fewer than five deputies have an estimate.', noGeo: 'The LVIII Legislature has no state data. Pick another term.',
      stNote: 'Titulares with an estimate, by the party they sat with. The mean position is shown only for delegations of five or more scored deputies, so that no single member’s value can be read off the map. The LVIII Legislature has no state data.',
      stSub: '{n} titulares with an estimate{m}', stMean: ' · mean position {v}', stFew: ' · mean not shown (fewer than five)', opp: 'opposition', gov: 'government', noData: 'No data',
      perTerm: 'Per term', kRows: 'deputy-terms, {l} legislatures', kScored: 'with an estimate ({p}%)', kSe: 'median standard error', kSupl: 'suplentes among them',
      cTerm: 'Term', cN: 'Deputies', cScored: 'Scored', cPct: '%', cOne: 'One-sided', cVotes: 'Median votes', cSe: 'Median SE', cUnder: '< 20 votes', cDropped: 'Dropped', cPending: 'Pending',
      method: '<p><strong>What the numbers are.</strong> For each legislature separately, every deputy’s recorded votes are scaled with a within-term NOMINATE model. The first dimension orders deputies from one voting bloc to the other; it is the dimension that explains most of the recorded divisions. Each estimate comes with a standard error from a {b}-draw parametric bootstrap.</p><p><strong>Orientation.</strong> The sign of the dimension is arbitrary in every term, so each term is flipped so that the caucus of the president’s party lies to the right and the opposition to the left. Nothing else is changed.</p><p><strong>Across terms.</strong> The scale is estimated anew in every legislature, so a position of 0.4 in one term is not the same as 0.4 in another. What does compare across terms is how tightly a caucus votes (the width of its middle half, its standard deviation) and ranks within the chamber.</p><p><strong>Who is left out.</strong> Deputies with fewer than 20 usable votes, members not retained after the identity review, and a few records still under review. Suplentes score on far fewer votes than titulares and are off by default. The LXVI Legislature is a partial term: its estimates will move as more votes are recorded.</p><p><strong>What is published.</strong> This page carries only summaries per term, party and state, and pictures without names. The member-level file stays with the author; data version {v}, built {d}.</p>',
    },
    es: {
      navPubs: 'Publicaciones', navTeach: 'Docencia', navData: 'Datos', navDocs: 'Recomendaciones', navCalc: 'Calculadora', navDash: 'Tableros',
      title: 'Alineamiento de voto en la Cámara de Diputados',
      lede: 'Dónde se ubica cada diputado en la dimensión principal de votación de cada legislatura desde 2000, estimada a partir de las votaciones nominales. Las posiciones se comparan dentro de una legislatura; entre legislaturas, compare qué tan unida vota cada bancada.',
      tabTerm: 'Una legislatura', tabCoh: 'Cohesión en el tiempo', tabStates: 'Estados', tabCov: 'Cobertura y método',
      legislature: 'Legislatura', who: 'Diputados', whoTit: 'Titulares', whoAll: 'Con suplentes', parties: 'Partidos en esta legislatura', about: 'Sobre esta legislatura',
      stripNote: 'Cada punto es un diputado; la raya es la mediana del partido y la banda su mitad central. Los puntos huecos son estimaciones de un solo lado, fijadas en el borde de la escala. La imagen no lleva nombres: esta página publica resúmenes, no el archivo por diputado.',
      ptableNote: 'Estimados / escaños: diputados con posición entre los titulares de la nómina. Mediana y mitad central están en la escala orientada.',
      party: 'Partido', seats: 'Escaños', scored: 'Estimados', median: 'Mediana', half: 'Mitad central', termTitle: 'Legislatura {r} · {y}', termSub: '{n} diputados con estimación · oposición a la izquierda, partido en el gobierno ({g}) a la derecha',
      fYears: 'Años', fGov: 'Partido del presidente', fScored: 'Diputados con estimación', fOne: 'Estimaciones de un solo lado', fVotes: 'Mediana de votos por diputado', fSe: 'Mediana del error estándar', fSeat: 'Escaños', fPartial: 'Legislatura en curso', fPartialV: 'votaciones hasta el {d}; las estimaciones cambiarán conforme avance', fNoGeo: 'Sin datos de estado ni de tipo de elección en esta legislatura',
      legMedian: 'mediana del partido', legBand: 'mitad central de la bancada', legOne: 'estimación de un solo lado',
      measure: 'Medida', mIqr: 'Ancho de la mitad central', mSd: 'Desviación estándar', mMed: 'Posición mediana',
      cohIqr: 'Qué tan unida vota cada bancada', cohSd: 'Dispersión de cada bancada', cohMed: 'Dónde se ubica cada bancada',
      cohSubW: 'Ancho de la mitad central de los diputados del partido, legislatura por legislatura. 0 significa que todos votan igual. Los anchos se comparan entre legislaturas; las posiciones no.',
      cohSubSd: 'Desviación estándar de las posiciones de los diputados del partido, por legislatura. Las dispersiones se comparan entre legislaturas; las posiciones no.',
      cohSubMed: 'Posición mediana por legislatura en la escala orientada: oposición a la izquierda, partido del presidente a la derecha. Léala dentro de cada legislatura; la escala se estima de nuevo en cada una.',
      cohNote: 'Los puntos huecos marcan bancadas con menos de 10 diputados estimados. Pase el cursor por un punto para ver las cifras.', legFew: 'menos de 10 diputados estimados',
      colour: 'Colorear el mapa por', modeParty: 'Partido mayoritario', modePos: 'Posición media', delegation: 'Delegación', pickState: 'Elija un estado',
      mapTitle: 'Delegaciones estatales · Legislatura {r}', mapSubParty: 'Cada estado con el color del partido con más titulares estimados en su delegación; más pálido cuando ese partido tiene menos de la mitad.',
      mapSubPos: 'Posición media de la delegación en la escala orientada; gris donde menos de cinco diputados tienen estimación.', noGeo: 'La LVIII Legislatura no tiene datos por estado. Elija otra.',
      stNote: 'Titulares con estimación, según el partido con el que se sentaron. La posición media se muestra solo para delegaciones de cinco o más diputados estimados, para que ningún valor individual pueda leerse del mapa. La LVIII Legislatura no tiene datos por estado.',
      stSub: '{n} titulares con estimación{m}', stMean: ' · posición media {v}', stFew: ' · media no mostrada (menos de cinco)', opp: 'oposición', gov: 'gobierno', noData: 'Sin datos',
      perTerm: 'Por legislatura', kRows: 'diputado-legislaturas, {l} legislaturas', kScored: 'con estimación ({p}%)', kSe: 'mediana del error estándar', kSupl: 'suplentes entre ellos',
      cTerm: 'Legislatura', cN: 'Diputados', cScored: 'Estimados', cPct: '%', cOne: 'Un solo lado', cVotes: 'Mediana de votos', cSe: 'Mediana EE', cUnder: '< 20 votos', cDropped: 'Excluidos', cPending: 'En revisión',
      method: '<p><strong>Qué son las cifras.</strong> Para cada legislatura por separado, las votaciones registradas de cada diputado se escalan con un modelo NOMINATE dentro de la legislatura. La primera dimensión ordena a los diputados de un bloque de votación al otro; es la que explica la mayor parte de las divisiones registradas. Cada estimación lleva un error estándar de un bootstrap paramétrico de {b} réplicas.</p><p><strong>Orientación.</strong> El signo de la dimensión es arbitrario en cada legislatura, así que cada una se voltea para que la bancada del partido del presidente quede a la derecha y la oposición a la izquierda. Nada más cambia.</p><p><strong>Entre legislaturas.</strong> La escala se estima de nuevo en cada legislatura, de modo que 0.4 en una no es lo mismo que 0.4 en otra. Lo que sí se compara es qué tan unida vota una bancada (el ancho de su mitad central, su desviación estándar) y los rangos dentro de la cámara.</p><p><strong>Quién queda fuera.</strong> Diputados con menos de 20 votaciones utilizables, integrantes no conservados tras la revisión de identidades y unos pocos registros aún en revisión. Los suplentes se estiman con muchas menos votaciones que los titulares y están apagados por defecto. La LXVI Legislatura está en curso: sus estimaciones cambiarán conforme se registren más votaciones.</p><p><strong>Qué se publica.</strong> Esta página solo lleva resúmenes por legislatura, partido y estado, e imágenes sin nombres. El archivo por diputado queda con el autor; versión de datos {v}, construida el {d}.</p>',
    }
  });

  const DIP = window.DIP; if (!DIP || !window.MX_STATES) { const e = $('#error'); e.hidden = false; e.textContent = 'data/diputados-agg.js or ../envipe/mx-states.js could not be loaded. Keep the folder together.'; return; }
  const LEGS = DIP.legs.slice().sort((a, b) => a.legislature - b.legislature), byLeg = {}; LEGS.forEach((l) => { byLeg[l.legislature] = l; });
  const S = { view: 'term', leg: 64, who: 'tit', measure: 'iqr', who2: 'tit', mapmode: 'party', state: null };
  const fmt = (v, d) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(d == null ? 2 : d));
  const pos = (v) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(2));
  const parties = (leg) => ORDER.filter((p) => DIP.coh.some((c) => c.legislature === leg && c.p === p));

  /* ---------- tabs ---------- */
  D.$$('#tabs button').forEach((b) => b.addEventListener('click', () => { S.view = b.dataset.view; render(); }));
  function renderTabs() {
    D.$$('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === S.view)));
    ['term', 'coh', 'states', 'cov'].forEach((v) => { $('#view-' + v).hidden = v !== S.view; });
  }

  /* ---------- legislature buttons (two copies) ---------- */
  function legButtons(sel) {
    const box = $(sel); box.innerHTML = '';
    LEGS.forEach((l) => box.append(D.el('button', { type: 'button', 'aria-pressed': String(l.legislature === S.leg), onclick: () => { S.leg = l.legislature; S.state = null; render(); } }, [l.roman, D.el('span', { class: 'yrs', text: l.years })])));
  }
  function seg(sel, key, attr) { D.$$(sel + ' button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset[attr] === S[key])); b.onclick = () => { S[key] = b.dataset[attr]; render(); }; }); }

  /* ---------- one legislature ---------- */
  function renderTerm() {
    legButtons('#legbtns'); seg('#who', 'who', 'who');
    const L = byLeg[S.leg], rows = DIP.coh.filter((c) => c.legislature === S.leg && c.who === S.who), n = rows.reduce((a, r) => a + r.n, 0);
    $('#term-title').textContent = D.t('termTitle', { r: L.roman, y: L.years });
    $('#term-sub').textContent = D.t('termSub', { n: D.num(n), g: L.gov });
    const img = $('#strip'); img.src = 'img/strip-' + S.leg + '-' + S.who + '.png'; img.alt = D.t('termTitle', { r: L.roman, y: L.years });
    $('#strip-leg').innerHTML = parties(S.leg).map((p) => '<span><i style="background:' + COL[p] + '"></i>' + p + '</span>').join('') + '<span><i class="band" style="background:#C8C0B5"></i>' + D.t('legBand') + '</span><span><i class="hollow"></i>' + D.t('legOne') + '</span>';
    const t = $('#ptable'); t.innerHTML = '';
    t.append(D.el('tr', null, [D.el('th', { text: D.t('party') }), D.el('th', { class: 'n', text: D.t('scored') + ' / ' + D.t('seats') }), D.el('th', { class: 'n', text: D.t('median') }), D.el('th', { class: 'n', text: D.t('half') })]));
    ORDER.filter((p) => rows.some((r) => r.p === p)).sort((a, b) => { const ra = rows.find((r) => r.p === a), rb = rows.find((r) => r.p === b); return rb.n - ra.n; }).forEach((p) => {
      const r = rows.find((x) => x.p === p), st = DIP.seats.find((x) => x.legislature === S.leg && x.p === p);
      const sw = D.el('i', { class: 'sw', style: { background: COL[p] } });
      t.append(D.el('tr', { class: p === L.gov ? 'gov' : '' }, [D.el('td', null, [sw, p]), D.el('td', { class: 'n', text: D.num(r.n) + ' / ' + (st ? D.num(st.seats) : '—') }), D.el('td', { class: 'n', text: pos(r.med) }), D.el('td', { class: 'n', text: pos(r.q1) + '…' + pos(r.q3) })]));
    });
    const f = $('#facts'); f.innerHTML = '';
    const kv = (k, v) => { f.append(D.el('span', { text: D.t(k) }), D.el('b', { text: v })); };
    kv('fYears', L.years); kv('fGov', L.gov); kv('fScored', D.num(L.scored) + ' / ' + D.num(L.n) + (L.scoredSupl ? ' (' + D.num(L.scoredSupl) + ' supl.)' : ''));
    kv('fOne', D.num(L.oneSided)); kv('fVotes', D.num(L.medVotes)); kv('fSe', fmt(L.medSe, 3));
    if (L.hasGeo) kv('fSeat', D.num(L.nMR) + ' MR · ' + D.num(L.nRP) + ' RP'); else f.append(D.el('span', { style: { gridColumn: '1 / -1', color: 'var(--accent-2)' }, text: D.t('fNoGeo') }));
    if (L.partial) kv('fPartial', D.t('fPartialV', { d: L.cutoff }));
  }

  /* ---------- cohesion small multiples ---------- */
  function renderCoh() {
    seg('#measure', 'measure', 'm'); seg('#who2', 'who2', 'who');
    const m = S.measure, title = { iqr: 'cohIqr', sd: 'cohSd', med: 'cohMed' }[m], sub = { iqr: 'cohSubW', sd: 'cohSubSd', med: 'cohSubMed' }[m];
    $('#coh-title').textContent = D.t(title); $('#coh-sub').textContent = D.t(sub); $('#coh-note').textContent = D.t('cohNote');
    const svg = $('#coh'); svg.innerHTML = ''; svg.setAttribute('aria-label', D.t(title));
    const P = ORDER.slice(0, 7), legs = LEGS.map((l) => l.legislature), pw = 150, gap = 12, left = 50, top = 36, h = 220, W = left + P.length * (pw + gap);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + (top + h + 44));
    const ymax = m === 'med' ? 1 : .7, ymin = m === 'med' ? -1 : 0, y = (v) => top + (1 - (Math.min(Math.max(v, ymin), ymax) - ymin) / (ymax - ymin)) * h;
    const grid = m === 'med' ? [-1, -.5, 0, .5, 1] : [0, .2, .4, .6];
    grid.forEach((v) => { const t = D.svg('text', { x: left - 8, y: y(v) + 4, fill: '#9A9288', 'font-size': 10, 'text-anchor': 'end', class: 'mono' }); t.textContent = v.toFixed(1); svg.append(t); });
    P.forEach((p, i) => {
      const x0 = left + i * (pw + gap), xx = (l) => x0 + legs.indexOf(l) * ((pw - 14) / (legs.length - 1));
      const t = D.svg('text', { x: x0, y: 22, fill: COL[p], 'font-size': 13, 'font-weight': 700 }); t.textContent = p; svg.append(t);
      grid.forEach((v) => svg.append(D.svg('line', { x1: x0, x2: x0 + pw - 14, y1: y(v), y2: y(v), stroke: v === 0 ? '#57524A' : '#3D3934' })));
      const rows = DIP.coh.filter((c) => c.p === p && c.who === S.who2).sort((a, b) => a.legislature - b.legislature); if (!rows.length) return;
      const val = (r) => r[m];
      if (m !== 'med') { let a = 'M' + xx(rows[0].legislature) + ',' + y(0); rows.forEach((r) => { a += ' L' + xx(r.legislature) + ',' + y(val(r)); }); a += ' L' + xx(rows[rows.length - 1].legislature) + ',' + y(0) + ' Z'; svg.append(D.svg('path', { d: a, fill: COL[p], opacity: .18 })); }
      else rows.forEach((r) => svg.append(D.svg('line', { x1: xx(r.legislature), x2: xx(r.legislature), y1: y(r.q1), y2: y(r.q3), stroke: COL[p], 'stroke-width': 6, opacity: .35 })));
      svg.append(D.svg('path', { d: rows.map((r, k) => (k ? 'L' : 'M') + xx(r.legislature) + ',' + y(val(r))).join(' '), fill: 'none', stroke: COL[p], 'stroke-width': 2.2 }));
      rows.forEach((r) => {
        const c = D.svg('circle', { cx: xx(r.legislature), cy: y(val(r)), r: 4.5, fill: r.n < 10 ? '#2E2B28' : COL[p], stroke: COL[p], 'stroke-width': 1.6, style: 'cursor:help' });
        const L = byLeg[r.legislature];
        c.addEventListener('mousemove', (ev) => D.showTip('<strong>' + p + ' · ' + L.roman + '</strong> <span style="color:#7A7264">' + L.years + '</span><div class="rows"><span>' + D.t('scored') + '</span><span>' + r.n + '</span><span>' + D.t('mIqr') + '</span><span>' + fmt(r.iqr, 2) + '</span><span>' + D.t('mSd') + '</span><span>' + fmt(r.sd, 2) + '</span><span>' + D.t('median') + '</span><span>' + fmt(r.med, 2) + '</span><span>' + D.t('half') + '</span><span>' + fmt(r.q1, 2) + ' … ' + fmt(r.q3, 2) + '</span></div>', ev.clientX, ev.clientY));
        c.addEventListener('mouseleave', () => D.hideTip()); svg.append(c);
      });
      [legs[0], legs[Math.floor(legs.length / 2)], legs[legs.length - 1]].forEach((l, k) => { const q = D.svg('text', { x: xx(l), y: top + h + 18, fill: '#9A9288', 'font-size': 10, 'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle', class: 'mono' }); q.textContent = byLeg[l].roman; svg.append(q); });
    });
    $('#coh-leg').innerHTML = (m === 'med' ? '<span><i class="band" style="background:#C8C0B5"></i>' + D.t('legBand') + '</span>' : '') + '<span><i class="hollow"></i>' + D.t('legFew') + '</span>';
  }

  /* ---------- states ---------- */
  const PATHS = {};
  function buildMap() {
    const svg = $('#map'); svg.innerHTML = '';
    window.MX_STATES.states.forEach((s) => {
      const p = D.svg('path', { d: s.d, class: 'st na' }); p.dataset.cve = s.cve; PATHS[s.cve] = p;
      p.addEventListener('mousemove', (ev) => hoverState(s, ev.clientX, ev.clientY)); p.addEventListener('mouseleave', () => D.hideTip());
      p.addEventListener('click', () => { if (!p.classList.contains('na')) { S.state = s.cve; renderStates(); } });
      svg.append(p);
    });
  }
  const stRow = (cve) => DIP.states.find((r) => r.legislature === S.leg && r.cve === cve);
  const largest = (r) => { let best = null, bn = 0, tot = 0; for (const p in r.parties) { tot += r.parties[p]; if (r.parties[p] > bn) { bn = r.parties[p]; best = p; } } return { p: best, share: bn / tot }; };
  const posColor = (v) => { const t = Math.max(-1, Math.min(1, v)); const mix = (a, b, f) => a.map((c, i) => Math.round(c + (b[i] - c) * f)); const g = [61, 57, 52], c = t < 0 ? mix(g, [76, 135, 217], -t) : mix(g, [229, 145, 42], t); return 'rgb(' + c.join(',') + ')'; };
  function hoverState(s, x, y) {
    const r = stRow(s.cve); if (!r) return D.showTip('<strong>' + s.name + '</strong><div class="rows"><span>' + D.t('noData') + '</span><span></span></div>', x, y);
    const rows = ORDER.filter((p) => r.parties[p]).map((p) => '<span>' + p + '</span><span>' + r.parties[p] + '</span>').join('');
    D.showTip('<strong>' + s.name + '</strong> <span style="color:#7A7264">' + byLeg[S.leg].roman + '</span><div class="rows">' + rows + (r.mean != null ? '<span>' + D.t('modePos') + '</span><span>' + pos(r.mean) + '</span>' : '') + '</div>', x, y);
  }
  function renderStates() {
    legButtons('#legbtns2'); seg('#mapmode', 'mapmode', 'mode');
    const L = byLeg[S.leg]; $('#map-title').textContent = D.t('mapTitle', { r: L.roman });
    $('#map-sub').textContent = L.hasGeo ? D.t(S.mapmode === 'party' ? 'mapSubParty' : 'mapSubPos') : D.t('noGeo');
    window.MX_STATES.states.forEach((s) => {
      const p = PATHS[s.cve], r = L.hasGeo ? stRow(s.cve) : null; p.classList.toggle('sel', S.state === s.cve);
      if (!r) { p.classList.add('na'); p.style.fill = ''; p.style.fillOpacity = ''; return; }
      p.classList.remove('na');
      if (S.mapmode === 'party') { const b = largest(r); p.style.fill = COL[b.p]; p.style.fillOpacity = b.share >= .5 ? 1 : .55; }
      else if (r.mean != null) { p.style.fill = posColor(r.mean); p.style.fillOpacity = 1; } else { p.classList.add('na'); p.style.fill = ''; }
    });
    $('#map-leg').innerHTML = S.mapmode === 'party' ? ORDER.map((p) => '<span><i style="background:' + COL[p] + '"></i>' + p + '</span>').join('') : '<span class="scale">' + D.t('opp') + ' <span class="ramp" style="display:inline-block;width:160px"></span> ' + D.t('gov') + '</span><span><i style="background:#34302C"></i>' + D.t('stFew') .replace(/^ · /, '') + '</span>';
    const nm = $('#st-name'), sub = $('#st-sub'), bars = $('#st-bars'); bars.innerHTML = '';
    const st = S.state && window.MX_STATES.states.find((s) => s.cve === S.state), r = st && stRow(st.cve);
    if (!r) { nm.textContent = D.t('pickState'); sub.textContent = ''; return; }
    nm.textContent = st.name; sub.textContent = D.t('stSub', { n: r.n, m: r.mean != null ? D.t('stMean', { v: pos(r.mean) }) : D.t('stFew') });
    const tot = Object.values(r.parties).reduce((a, b) => a + b, 0);
    ORDER.filter((p) => r.parties[p]).sort((a, b) => r.parties[b] - r.parties[a]).forEach((p) => {
      bars.append(D.el('div', { class: 'bar' }, [D.el('span', { text: p }), D.el('div', { class: 'tr' }, [D.el('i', { style: { width: (100 * r.parties[p] / tot).toFixed(1) + '%', background: COL[p] } })]), D.el('span', { class: 'v', text: r.parties[p] + ' · ' + Math.round(100 * r.parties[p] / tot) + '%' })]));
    });
  }

  /* ---------- coverage ---------- */
  function renderCov() {
    const T = DIP.meta.totals, k = $('#kpis'); k.innerHTML = '';
    const tile = (v, l) => k.append(D.el('div', { class: 'kpi' }, [D.el('div', { class: 'big', text: v }), D.el('div', { class: 'l', text: l })]));
    tile(D.num(T.rows), D.t('kRows', { l: T.legislatures })); tile(D.num(T.scored), D.t('kScored', { p: Math.round(100 * T.scored / T.rows) })); tile(fmt(T.medSe, 2), D.t('kSe')); tile(D.num(T.suplScored), D.t('kSupl'));
    const t = $('#covtable'); t.innerHTML = '';
    t.append(D.el('tr', null, ['cTerm', 'cN', 'cScored', 'cPct', 'cOne', 'cVotes', 'cSe', 'cUnder', 'cDropped', 'cPending'].map((c) => D.el('th', { text: D.t(c) }))));
    LEGS.forEach((L) => { const pct = 100 * L.scored / L.n; t.append(D.el('tr', null, [D.el('td', null, [L.roman + ' · ' + L.years + (L.partial ? ' *' : '')]), D.el('td', { text: D.num(L.n) }), D.el('td', { text: D.num(L.scored) }), D.el('td', null, [pct.toFixed(0) + '%', D.el('span', { class: 'pb' }, [D.el('i', { style: { width: pct.toFixed(0) + '%' } })])]), D.el('td', { text: D.num(L.oneSided) }), D.el('td', { text: D.num(L.medVotes) }), D.el('td', { text: fmt(L.medSe, 3) }), D.el('td', { text: D.num(L.under20) }), D.el('td', { text: D.num(L.dropped) }), D.el('td', { text: D.num(L.pending) })])); });
    $('#method').innerHTML = D.t('method', { b: DIP.meta.bootDraws, v: D.esc(DIP.meta.version), d: DIP.meta.built });
  }

  function render() { renderTabs(); if (S.view === 'term') renderTerm(); else if (S.view === 'coh') renderCoh(); else if (S.view === 'states') renderStates(); else renderCov(); }
  buildMap(); render(); D.onLang(render);
})();
