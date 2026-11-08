/* ============================================================
   ENVIPE dashboard — map view + state profile
   Data: data/envipe-meta.js (catalog + value labels) and
         data/envipe-part*.js (weighted estimates), produced by
         envipe_dashboard_aggregates.do -> build_data.py.
   No network, no libraries: works from GitHub Pages or from disk.
   ============================================================ */
(function () {
  'use strict';
  const D = window.Dash;
  const $ = (s) => document.querySelector(s);

  /* ---------------- Strings ---------------- */
  D.strings({
    en: {
      navPubs: 'Publications', navTeach: 'Teaching', navData: 'Data', navDocs: 'Recommendations', navCalc: 'Calculator', navDash: 'Dashboards',
      title: 'Crime & Insecurity in Mexico', offline: 'Works offline', download: 'Download CSV',
      loading: 'Loading 16 editions of ENVIPE…', loadErr: 'The data files could not be loaded. Make sure the data folder sits next to this page.',
      question: 'Question', available: 'available', searchPh: 'Search questions in Spanish or by variable name…', answer: 'Show answer', base: 'Base',
      baseValid: 'Valid answers', baseAll: 'Incl. “No sabe”', play: 'Play through the editions', pause: 'Pause', edition: 'Survey edition',
      all32: 'All 32 states', about: 'About this number', respNat: 'respondents (national)', smallestN: 'smallest state n',
      clear: 'Clear', openProfile: 'Open state profile', clickSelect: 'Click to select', noData: 'No data',
      secAll: 'All', secPer: 'Perception & fear', secIns: 'Local institutions', secHv: 'Household victimization', secPv: 'Personal victimization', secHh: 'Household & people',
      hlCat: 'answered <strong>“{a}”</strong>', hlMean: 'average', hlWhere: 'Mexico, {y} edition', nResults: '{n} matches',
      trendTitle: 'Over time', mexico: 'Mexico', mean: 'Mean',
      baseP: 'Base: valid answers (“No sabe / no responde” left out of the denominator).', baseA: 'Base: everyone asked, including “No sabe / no responde”.', baseM: 'Weighted mean among respondents with a valid answer.',
      aboutQ: 'Weighted share of adults (18+) answering “{a}” to: {q}', aboutM: 'Weighted mean of: {q}',
      pickState: 'Pick a state', backMap: 'Back to map', tilesNote: 'Tiles placed roughly by geography · shaded by % who feel unsafe in their state',
      profileEyebrow: 'State profile · vs. national', profileSub: '{n} adults answered · ranked {r} of 32 for feeling unsafe in the state',
      unsafeState: 'Unsafe in the <strong>state</strong>', unsafeMun: 'Unsafe in the <strong>municipality</strong>', unsafeCol: 'Unsafe in the <strong>neighborhood</strong>',
      vs: 'vs. {v}', notAsked: 'Not asked in this edition', worries: 'What worries people most', worriesNote: '% naming each topic among their top concerns (several answers allowed).',
      habits: 'Stopped doing, out of fear', hood: 'Seen in the neighborhood', trustTitle: 'Trust in authorities — {s}',
      trust1: 'A lot', trust2: 'Some', trust3: 'Some distrust', trust4: 'A lot of distrust', trustPct: 'trust', trustNote: 'Among adults who can identify each authority.', corrupt: '{s}% see the state police as corrupt (Mexico {n}%).',
      pTrend: 'Feeling unsafe in the state, over time',
      foot: 'Source: INEGI, Encuesta Nacional de Victimización y Percepción sobre Seguridad Pública (ENVIPE), 2011–2026 editions. Recoded master files and weighted estimates (person weight fac_ele) by Dr. Gutiérrez-Mannix. Years are survey editions. Map: Natural Earth (public domain). Data, map and fonts are stored with this page — no internet connection needed.'
    },
    es: {
      navPubs: 'Publicaciones', navTeach: 'Docencia', navData: 'Datos', navDocs: 'Recomendaciones', navCalc: 'Calculadora', navDash: 'Tableros',
      title: 'Delincuencia e inseguridad en México', offline: 'Funciona sin internet', download: 'Descargar CSV',
      loading: 'Cargando 16 ediciones de la ENVIPE…', loadErr: 'No se pudieron cargar los datos. Verifica que la carpeta data esté junto a esta página.',
      question: 'Pregunta', available: 'disponibles', searchPh: 'Busca preguntas o el nombre de la variable…', answer: 'Mostrar respuesta', base: 'Base',
      baseValid: 'Respuestas válidas', baseAll: 'Incl. “No sabe”', play: 'Reproducir las ediciones', pause: 'Pausa', edition: 'Edición de la encuesta',
      all32: 'Las 32 entidades', about: 'Sobre esta cifra', respNat: 'informantes (nacional)', smallestN: 'n mínima por entidad',
      clear: 'Quitar', openProfile: 'Ver perfil de la entidad', clickSelect: 'Haz clic para seleccionar', noData: 'Sin datos',
      secAll: 'Todas', secPer: 'Percepción y temor', secIns: 'Instituciones locales', secHv: 'Victimización del hogar', secPv: 'Victimización personal', secHh: 'Hogar y personas',
      hlCat: 'respondió <strong>“{a}”</strong>', hlMean: 'promedio', hlWhere: 'México, edición {y}', nResults: '{n} resultados',
      trendTitle: 'A lo largo del tiempo', mexico: 'México', mean: 'Promedio',
      baseP: 'Base: respuestas válidas (“No sabe / no responde” fuera del denominador).', baseA: 'Base: todas las personas a quienes se preguntó, incluido “No sabe / no responde”.', baseM: 'Promedio ponderado entre informantes con respuesta válida.',
      aboutQ: 'Porcentaje ponderado de personas adultas (18+) que respondieron “{a}” a: {q}', aboutM: 'Promedio ponderado de: {q}',
      pickState: 'Elige una entidad', backMap: 'Volver al mapa', tilesNote: 'Mosaicos ubicados aproximadamente por geografía · sombreados por % que se siente inseguro en su estado',
      profileEyebrow: 'Perfil estatal · vs. nacional', profileSub: '{n} personas respondieron · lugar {r} de 32 en inseguridad percibida en el estado',
      unsafeState: 'Inseguro en el <strong>estado</strong>', unsafeMun: 'Inseguro en el <strong>municipio</strong>', unsafeCol: 'Inseguro en la <strong>colonia</strong>',
      vs: 'vs. {v}', notAsked: 'No se preguntó en esta edición', worries: 'Lo que más preocupa', worriesNote: '% que menciona cada tema entre sus principales preocupaciones (respuesta múltiple).',
      habits: 'Dejó de hacer, por temor', hood: 'En la colonia', trustTitle: 'Confianza en autoridades — {s}',
      trust1: 'Mucha', trust2: 'Algo', trust3: 'Algo de desconfianza', trust4: 'Mucha desconfianza', trustPct: 'confía', trustNote: 'Entre quienes identifican a cada autoridad.', corrupt: '{s}% percibe corrupta a la policía estatal (México {n}%).',
      pTrend: 'Inseguridad percibida en el estado, a lo largo del tiempo',
      foot: 'Fuente: INEGI, Encuesta Nacional de Victimización y Percepción sobre Seguridad Pública (ENVIPE), ediciones 2011–2026. Archivos maestros recodificados y estimaciones ponderadas (factor de persona fac_ele) por el Dr. Gutiérrez-Mannix. Los años corresponden a la edición de la encuesta. Mapa: Natural Earth (dominio público). Los datos, el mapa y las fuentes tipográficas se guardan con esta página: no se necesita internet.'
    }
  });

  /* ---------------- Reference tables ---------------- */
  const STATES = { '01': 'Aguascalientes', '02': 'Baja California', '03': 'Baja California Sur', '04': 'Campeche', '05': 'Coahuila', '06': 'Colima', '07': 'Chiapas', '08': 'Chihuahua', '09': 'Ciudad de México', '10': 'Durango', '11': 'Guanajuato', '12': 'Guerrero', '13': 'Hidalgo', '14': 'Jalisco', '15': 'Estado de México', '16': 'Michoacán', '17': 'Morelos', '18': 'Nayarit', '19': 'Nuevo León', '20': 'Oaxaca', '21': 'Puebla', '22': 'Querétaro', '23': 'Quintana Roo', '24': 'San Luis Potosí', '25': 'Sinaloa', '26': 'Sonora', '27': 'Tabasco', '28': 'Tamaulipas', '29': 'Tlaxcala', '30': 'Veracruz', '31': 'Yucatán', '32': 'Zacatecas' };
  const CODES = Object.keys(STATES);
  // tile grid: abbreviation, column, row
  const TILES = { '02': ['BC', 0, 0], '26': ['SON', 1, 0], '08': ['CHIH', 2, 0], '05': ['COAH', 3, 0], '19': ['NL', 4, 0], '28': ['TAMS', 5, 0], '03': ['BCS', 0, 1], '25': ['SIN', 1, 1], '10': ['DGO', 2, 1], '32': ['ZAC', 3, 1], '24': ['SLP', 4, 1], '30': ['VER', 5, 1], '18': ['NAY', 1, 2], '01': ['AGS', 2, 2], '11': ['GTO', 3, 2], '22': ['QRO', 4, 2], '13': ['HGO', 5, 2], '31': ['YUC', 7, 2], '23': ['QROO', 8, 2], '14': ['JAL', 1, 3], '16': ['MICH', 2, 3], '15': ['MEX', 3, 3], '09': ['CDMX', 4, 3], '29': ['TLAX', 5, 3], '27': ['TAB', 6, 3], '04': ['CAM', 7, 3], '06': ['COL', 1, 4], '12': ['GRO', 2, 4], '17': ['MOR', 3, 4], '21': ['PUE', 4, 4], '20': ['OAX', 5, 4], '07': ['CHIS', 6, 4] };
  const RAMP = ['#5C340D', '#A65D0F', '#CE7714', '#EFAB3D', '#FAE2BC'];
  const NA = '#34302C';
  const C_NAT = '#E5912A', C_ST = '#95C3CE';
  const SECTIONS = [
    { id: 'all', key: 'secAll', test: () => true },
    { id: 'per', key: 'secPer', test: (v) => /^ap4/.test(v) },
    { id: 'ins', key: 'secIns', test: (v) => /^ap5/.test(v) },
    { id: 'hv', key: 'secHv', test: (v) => /^ap6/.test(v) },
    { id: 'pv', key: 'secPv', test: (v) => /^ap[78]/.test(v) },
    { id: 'hh', key: 'secHh', test: (v) => !/^ap[45678]/.test(v) }
  ];
  const PROFILE = {
    concerns: { ap4_2_01: ['Poverty', 'Pobreza'], ap4_2_02: ['Unemployment', 'Desempleo'], ap4_2_03: ['Drug trafficking', 'Narcotráfico'], ap4_2_04: ['Rising prices', 'Aumento de precios'], ap4_2_05: ['Insecurity', 'Inseguridad'], ap4_2_06: ['Natural disasters', 'Desastres naturales'], ap4_2_07: ['Water shortage', 'Escasez de agua'], ap4_2_08: ['Corruption', 'Corrupción'], ap4_2_09: ['Education', 'Educación'], ap4_2_10: ['Health', 'Salud'], ap4_2_11: ['Criminals go unpunished', 'Falta de castigo a delincuentes'], ap4_2_12: ['Online crime', 'Delitos por internet'], ap4_2_13: ['Online misinformation', 'Información falsa en internet'] },
    habits: { ap4_10_02: ['Letting children go out alone', 'Permitir que menores salgan solos'], ap4_10_01: ['Going out at night', 'Salir de noche'], ap4_10_06: ['Carrying cash', 'Llevar dinero en efectivo'] },
    hood: { ap4_5_09: ['frequent robberies or assaults', 'robos o asaltos frecuentes'], ap4_5_15: ['extortion (“cobro de piso”)', 'extorsiones (cobro de piso)'] },
    trust: { ap5_4_08: ['Army', 'Ejército'], ap5_4_04: ['National Guard', 'Guardia Nacional'], ap5_4_03: ['State police', 'Policía Estatal'] }
  };
  const L2 = (pair) => (D.lang === 'es' ? pair[1] : pair[0]);

  /* ---------------- Data ---------------- */
  const CAT = {};       // v -> {label, type}
  const LAB = {};       // v -> {code -> label}
  const LINES = {};     // v -> [csv lines]
  const CACHE = {};
  let PICK = [];        // [{v,label,sec}]

  function cleanLabel(s) {
    if (!s) return s;
    s = s.replace(/^¿\s*/, '').replace(/\s*\?$/, '').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function loadParts(n) {
    return new Promise((resolve, reject) => {
      let i = 1;
      const next = () => {
        if (i > n) return resolve();
        const s = document.createElement('script');
        s.src = 'data/envipe-part' + i + '.js';
        s.onload = () => { i++; next(); };
        s.onerror = () => reject(new Error('envipe-part' + i + '.js'));
        document.body.append(s);
      };
      next();
    });
  }
  function indexData() {
    const meta = window.ENVIPE_META;
    D.parseCSV(meta.catalog).slice(1).forEach((r) => { if (r[0]) CAT[r[0]] = { label: r[1] || r[0], type: r[2] }; });
    D.parseCSV(meta.labels).slice(1).forEach((r) => { if (r[0]) (LAB[r[0]] = LAB[r[0]] || {})[r[1]] = r[2]; });
    (window.ENVIPE_PARTS || []).forEach((text) => {
      const lines = text.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const ln = lines[i]; if (!ln) continue;
        const a = ln.indexOf(','), b = ln.indexOf(',', a + 1), c = ln.indexOf(',', b + 1);
        const v = ln.slice(b + 1, c);
        (LINES[v] || (LINES[v] = [])).push(ln);
      }
    });
    PICK = Object.keys(LINES).filter((v) => CAT[v])
      .map((v) => ({ v, label: CAT[v].label, sec: SECTIONS.slice(1).find((s) => s.test(v)).id }))
      .sort((x, y) => x.v.localeCompare(y.v, 'en', { numeric: true }));
  }
  function getVar(v) {
    if (CACHE[v]) return CACHE[v];
    const rec = {}; const years = new Set(); const cats = new Set();
    (LINES[v] || []).forEach((ln) => {
      const a = ln.split(',');
      const y = +a[0], e = a[1], c = a[3];
      years.add(y); cats.add(c);
      const k = y + '|' + e;
      (rec[k] || (rec[k] = {}))[c] = { p: a[4] === '' ? null : +a[4], pa: a[5] === '' ? null : +a[5], n: +a[6] };
    });
    const order = (c) => (c === '' ? -1 : /^\d+$/.test(c) ? +c : 1e6 + 'dru'.indexOf(c));
    const out = { v, rec, years: [...years].sort((a, b) => a - b), cats: [...cats].sort((a, b) => order(a) - order(b)), isMean: (CAT[v] && CAT[v].type === 'mean') || cats.has('') };
    CACHE[v] = out;
    return out;
  }
  const isDK = (c) => c === 'd' || c === 'r' || c === 'u';
  function val(V, y, e, c, base) {
    const r = V.rec[y + '|' + e]; if (!r) return null;
    const x = r[V.isMean ? '' : c]; if (!x) return null;
    const out = V.isMean ? x.p : x[base];
    return out == null || !isFinite(out) ? null : out;
  }
  function nOf(V, y, e) {
    const r = V.rec[y + '|' + e]; if (!r) return null;
    let n = 0; for (const c in r) n += r[c].n || 0; return n;
  }
  function catLabel(v, c) {
    const l = LAB[v] && LAB[v][c];
    if (l) return cleanLabel(l);
    return c === 'd' ? 'No sabe / no responde' : c === 'r' ? 'No responde' : c === 'u' ? 'No especificado' : c;
  }
  function defaultCat(V) {
    const lab = LAB[V.v] || {};
    const valid = V.cats.filter((c) => !isDK(c));
    if (valid.includes('1') && /^s[ií]$/i.test(cleanLabel(lab['1'] || ''))) return '1';
    const non0 = valid.filter((c) => !(c === '0' && /no se declar/i.test(lab['0'] || '')));
    return non0[0] || valid[0] || V.cats[0];
  }

  /* ---------------- Formatting ---------------- */
  function fmt(x, V) {
    if (x == null) return '—';
    if (V && V.isMean) return D.num(x, Math.abs(x) >= 100 ? 1 : 2);
    return D.num(x, 1) + '%';
  }
  function fmtShort(x, V) {
    if (x == null) return '—';
    if (V && V.isMean) return D.num(x, Math.abs(x) >= 100 ? 0 : 1);
    return D.num(x, 0) + '%';
  }

  /* ---------------- State ---------------- */
  const S = { v: 'ap4_3_3', c: '2', base: 'p', y: null, sel: null, view: 'map', sec: 'all' };
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('v') && LINES[h.get('v')]) S.v = h.get('v');
    if (h.has('c')) S.c = h.get('c');
    if (h.get('b') === 'pa') S.base = 'pa';
    if (h.get('y')) S.y = +h.get('y');
    S.sel = STATES[h.get('s')] ? h.get('s') : null;
    S.view = h.get('view') === 'state' && S.sel ? 'state' : 'map';
  }
  function writeHash() {
    const h = new URLSearchParams();
    if (S.view === 'state') { h.set('view', 'state'); h.set('s', S.sel); if (S.py) h.set('y', S.py); }
    else { h.set('v', S.v); if (!getVar(S.v).isMean) h.set('c', S.c); if (S.base === 'pa') h.set('b', 'pa'); h.set('y', S.y); if (S.sel) h.set('s', S.sel); }
    history.replaceState(null, '', '#' + h.toString());
  }
  function normalize() {
    const V = getVar(S.v);
    if (!V.isMean) {
      if (!V.cats.includes(S.c)) S.c = defaultCat(V);
      if (isDK(S.c)) S.base = 'pa';
    }
    if (!V.years.includes(S.y)) S.y = V.years[V.years.length - 1];
  }

  /* ---------------- Map ---------------- */
  const svgMap = $('#map');
  const PATHS = {};
  function buildMap() {
    const G = window.MX_STATES;
    svgMap.setAttribute('viewBox', G.viewBox);
    G.states.forEach((s) => {
      const p = D.svg('path', { d: s.d, class: 'st', tabindex: '0' });
      p.dataset.cve = s.cve;
      p.addEventListener('mousemove', (ev) => hoverState(s.cve, ev.clientX, ev.clientY));
      p.addEventListener('mouseleave', () => D.hideTip());
      p.addEventListener('click', () => selectState(s.cve));
      p.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectState(s.cve); } });
      PATHS[s.cve] = p;
      svgMap.append(p);
    });
  }
  function hoverState(cve, x, y) {
    const V = getVar(S.v);
    const v = val(V, S.y, cve, S.c, S.base), nat = val(V, S.y, '00', S.c, S.base);
    const n = nOf(V, S.y, cve);
    let diff = '';
    if (v != null && nat != null) { const d = v - nat; diff = (d >= 0 ? '+' : '−') + D.num(Math.abs(d), V.isMean ? 2 : 1) + (V.isMean ? '' : ' pts') + ' vs. ' + D.t('mexico'); }
    D.showTip('<b>' + D.esc(STATES[cve]) + '</b><div class="v">' + fmt(v, V) + '</div><div class="s">' + diff + (n ? ' · n = ' + D.num(n) : '') + '</div><div class="s" style="color:#A65D0F;font-weight:600">' + D.t('clickSelect') + '</div>', x, y);
  }
  function breaks(V) {
    const a = [];
    V.years.forEach((y) => CODES.forEach((e) => { const x = val(V, y, e, S.c, S.base); if (x != null) a.push(x); }));
    a.sort((p, q) => p - q);
    if (!a.length) return null;
    const q = (f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    return [a[0], q(0.2), q(0.4), q(0.6), q(0.8), a[a.length - 1]];
  }
  function colorOf(x, br) {
    if (x == null || !br) return NA;
    for (let i = 1; i <= 4; i++) if (x < br[i]) return RAMP[i - 1];
    return RAMP[4];
  }

  /* ---------------- Render: map view ---------------- */
  function renderMapView() {
    normalize();
    const V = getVar(S.v);
    const br = breaks(V);
    // controls
    $('#q').value = cleanLabel(CAT[S.v] ? CAT[S.v].label : S.v);
    $('#qvar').textContent = S.v;
    $('#answer-box').hidden = V.isMean;
    $('#base-box').hidden = V.isMean;
    const ans = $('#answers'); ans.innerHTML = '';
    V.cats.filter((c) => S.base === 'pa' || !isDK(c)).forEach((c) => {
      const b = D.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(c === S.c), text: catLabel(S.v, c) });
      b.addEventListener('click', () => { S.c = c; if (isDK(c)) S.base = 'pa'; render(); });
      ans.append(b);
    });
    D.$$('#base button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.b === S.base)));
    // years
    const yi = V.years.indexOf(S.y);
    const yr = $('#yr'); yr.max = V.years.length - 1; yr.value = yi;
    yr.setAttribute('aria-valuetext', String(S.y));
    const ticks = $('#ticks'); ticks.innerHTML = '';
    const step = V.years.length > 10 ? 3 : 1;
    V.years.forEach((y, i) => { if (i % step === 0 || i === V.years.length - 1 || y === S.y) ticks.append(D.el('span', { class: y === S.y ? 'on' : '', text: y })); });
    $('#yr-span').textContent = V.years[0] + '–' + V.years[V.years.length - 1];
    // headline
    const nat = val(V, S.y, '00', S.c, S.base);
    $('#hl-v').textContent = fmt(nat, V);
    $('#hl-t').innerHTML = (V.isMean ? D.t('hlMean') : D.t('hlCat', { a: D.esc(catLabel(S.v, S.c)) })) + ' — ' + D.esc(cleanLabel(CAT[S.v].label)) + '<br>' + D.t('hlWhere', { y: S.y });
    // map fills
    CODES.forEach((e) => {
      const p = PATHS[e]; if (!p) return;
      const x = val(V, S.y, e, S.c, S.base);
      p.setAttribute('fill', colorOf(x, br));
      p.classList.toggle('na', x == null);
      p.classList.toggle('sel', e === S.sel);
      p.setAttribute('aria-label', STATES[e] + ': ' + fmt(x, V));
    });
    if (S.sel && PATHS[S.sel]) svgMap.append(PATHS[S.sel]);
    svgMap.setAttribute('aria-label', D.t('title') + ' — ' + cleanLabel(CAT[S.v].label) + ', ' + S.y);
    // legend
    const lg = $('#legend'); lg.innerHTML = '';
    lg.append(D.el('span', { class: 'label', text: V.isMean ? D.t('mean') : '%' }));
    if (br) for (let i = 0; i < 5; i++) {
      lg.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: RAMP[i] } }), fmtShort(br[i], V) + '–' + fmtShort(br[i + 1], V)]));
    }
    lg.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: NA } }), D.t('noData')]));
    // selection card
    const sc = $('#sel-card');
    sc.classList.toggle('on', !!S.sel);
    if (S.sel) {
      $('#sel-name').textContent = STATES[S.sel];
      $('#sel-val').textContent = fmt(val(V, S.y, S.sel, S.c, S.base), V);
      const n = nOf(V, S.y, S.sel);
      $('#sel-sub').textContent = n ? '· n = ' + D.num(n) : '';
      $('#sel-open').href = '#view=state&s=' + S.sel + '&y=' + S.y;
    }
    // ranking
    const rows = CODES.map((e) => ({ e, x: val(V, S.y, e, S.c, S.base) })).sort((a, b) => (b.x == null ? -Infinity : b.x) - (a.x == null ? -Infinity : a.x));
    const mx = Math.max(...rows.map((r) => r.x || 0), 1e-9);
    const rk = $('#rank'); rk.innerHTML = '';
    rows.forEach((r, i) => {
      const b = D.el('button', { type: 'button', class: r.e === S.sel ? 'sel' : '', 'aria-pressed': String(r.e === S.sel) }, [
        D.el('span', { class: 'r', text: r.x == null ? '' : i + 1 }),
        D.el('span', { class: 'nm', text: STATES[r.e] }),
        D.el('span', { class: 'bar' }, [D.el('i', { style: { width: (r.x == null ? 0 : (V.isMean ? r.x / mx * 100 : r.x)) + '%', background: colorOf(r.x, br) } })]),
        D.el('span', { class: 'v', text: fmt(r.x, V) })
      ]);
      b.addEventListener('click', () => selectState(r.e));
      rk.append(b);
    });
    $('#rank-sub').textContent = S.y + ' · ' + (V.isMean ? D.t('mean') : '%');
    // trend
    const series = [{ name: D.t('mexico'), color: C_NAT, pts: V.years.map((y) => [y, val(V, y, '00', S.c, S.base)]) }];
    if (S.sel) series.push({ name: STATES[S.sel], color: C_ST, pts: V.years.map((y) => [y, val(V, y, S.sel, S.c, S.base)]) });
    $('#trend-title').textContent = D.t('trendTitle') + ': ' + series.map((s) => s.name).join(' vs. ');
    legendLines($('#trend-legend'), series);
    drawTrend($('#trend'), series, V.years, V, S.y);
    // about
    $('#about-q').textContent = V.isMean ? D.t('aboutM', { q: cleanLabel(CAT[S.v].label) + ' (' + S.v + ')' }) : D.t('aboutQ', { a: catLabel(S.v, S.c), q: cleanLabel(CAT[S.v].label) + ' (' + S.v + ')' });
    $('#about-base').textContent = V.isMean ? D.t('baseM') : S.base === 'p' ? D.t('baseP') : D.t('baseA');
    $('#about-n').textContent = D.num(nOf(V, S.y, '00'));
    const ns = CODES.map((e) => nOf(V, S.y, e)).filter((n) => n);
    $('#about-min').textContent = ns.length ? D.num(Math.min(...ns)) : '—';
  }

  function legendLines(el, series) {
    el.innerHTML = '';
    series.forEach((s) => el.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: s.color, height: '3px', width: '18px', borderRadius: '0' } }), s.name])));
  }

  /* ---------------- Trend chart (SVG) ---------------- */
  function niceStep(range) {
    const raw = range / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  function drawTrend(svg, series, years, V, current) {
    svg.innerHTML = '';
    // draw at the real on-screen width so text stays the same size on phones and wide screens
    const W = Math.max(300, Math.round(svg.getBoundingClientRect().width) || 640), H = W < 480 ? 220 : 260, L = 46, R = 58, T = 18, B = 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const iw = W - L - R, ih = H - T - B;
    const vals = series.flatMap((s) => s.pts.map((p) => p[1]).filter((x) => x != null));
    if (!vals.length || !years.length) { svg.append(D.svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: '#9A9288', 'font-family': 'Space Mono, monospace', 'font-size': 12 })).textContent = D.t('noData'); return; }
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const st = niceStep(hi - lo);
    lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    const y0 = years[0], y1 = years[years.length - 1];
    const sx = (y) => L + (y1 === y0 ? iw / 2 : (y - y0) / (y1 - y0) * iw);
    const sy = (v) => T + ih - (v - lo) / (hi - lo) * ih;
    const g = D.svg('g', { 'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#9A9288' });
    for (let v = lo; v <= hi + st / 2; v += st) {
      g.append(D.svg('line', { x1: L, x2: L + iw, y1: sy(v), y2: sy(v), stroke: v === lo ? '#57524A' : '#3D3934' }));
      const t = D.svg('text', { x: L - 8, y: sy(v) + 3, 'text-anchor': 'end' }); t.textContent = fmtShort(v, V); g.append(t);
    }
    const every = years.length > 10 ? (W < 480 ? 5 : 3) : 1;
    years.forEach((y, i) => {
      if (i % every && i !== years.length - 1) return;
      const t = D.svg('text', { x: sx(y), y: T + ih + 20, 'text-anchor': 'middle' }); t.textContent = y; g.append(t);
    });
    if (current != null) g.append(D.svg('line', { x1: sx(current), x2: sx(current), y1: T, y2: T + ih, stroke: '#57524A', 'stroke-dasharray': '2 3' }));
    const ends = [];
    series.forEach((s) => {
      const pts = s.pts.filter((p) => p[1] != null);
      // solid where editions are consecutive, dashed across missing editions
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const consecutive = years.indexOf(b[0]) - years.indexOf(a[0]) === 1 && b[0] - a[0] === 1;
        g.append(D.svg('line', { x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]), stroke: s.color, 'stroke-width': consecutive ? 2.5 : 2, 'stroke-dasharray': consecutive ? null : '3 4', 'stroke-linecap': 'round' }));
      }
      pts.forEach((p) => {
        const c = D.svg('circle', { cx: sx(p[0]), cy: sy(p[1]), r: p[0] === current ? 4.5 : 2.5, fill: s.color });
        c.addEventListener('mousemove', (ev) => D.showTip('<b>' + D.esc(s.name) + ' · ' + p[0] + '</b><div class="v">' + fmt(p[1], V) + '</div>', ev.clientX, ev.clientY));
        c.addEventListener('mouseleave', () => D.hideTip());
        g.append(c);
      });
      const last = pts[pts.length - 1];
      if (last) ends.push({ y: sy(last[1]), x: sx(last[0]), text: fmt(last[1], V), color: s.color });
    });
    ends.sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    ends.forEach((e) => { const t = D.svg('text', { x: e.x + 8, y: e.y + 4, fill: e.color, 'font-size': 11, 'font-weight': 700 }); t.textContent = e.text; g.append(t); });
    svg.append(g);
  }

  /* ---------------- Question search ---------------- */
  const qIn = $('#q'), hits = $('#hits');
  let hitIdx = -1;
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function showHits(all) {
    const term = norm(qIn.value.trim());
    const pool = PICK.filter((p) => S.sec === 'all' || p.sec === S.sec);
    const list = (all || !term) ? pool : pool.filter((p) => norm(p.label).includes(term) || p.v.includes(term));
    hits.innerHTML = '';
    hits.append(D.el('div', { class: 'grp', text: D.t('nResults', { n: D.num(list.length) }) }));
    // every match is listed, grouped by survey section
    SECTIONS.slice(1).forEach((sec) => {
      const inSec = list.filter((p) => p.sec === sec.id);
      if (!inSec.length) return;
      hits.append(D.el('div', { class: 'grp', style: { color: '#EFAB3D' }, text: D.t(sec.key) + ' · ' + D.num(inSec.length) }));
      inSec.forEach((p) => {
        const b = D.el('button', { type: 'button', role: 'option', 'aria-selected': String(p.v === S.v) }, [D.el('span', { text: cleanLabel(p.label) }), D.el('span', { class: 'sub', text: p.v })]);
        b.addEventListener('mousedown', (ev) => { ev.preventDefault(); pickVar(p.v); });
        hits.append(b);
      });
    });
    hits.classList.add('open'); qIn.setAttribute('aria-expanded', 'true'); hitIdx = -1;
  }
  function closeHits() { hits.classList.remove('open'); qIn.setAttribute('aria-expanded', 'false'); }
  function pickVar(v) {
    S.v = v; S.c = null; const V = getVar(v); S.c = V.isMean ? '' : defaultCat(V); S.base = 'p';
    closeHits(); qIn.blur(); render();
  }
  qIn.addEventListener('focus', () => { qIn.select(); showHits(true); });
  qIn.addEventListener('input', () => showHits(false));
  qIn.addEventListener('blur', () => setTimeout(() => { closeHits(); $('#q').value = cleanLabel(CAT[S.v].label); }, 120));
  qIn.addEventListener('keydown', (ev) => {
    const items = D.$$('button', hits);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      hitIdx = Math.max(0, Math.min(items.length - 1, hitIdx + (ev.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((b, i) => b.classList.toggle('active', i === hitIdx));
      if (items[hitIdx]) items[hitIdx].scrollIntoView({ block: 'nearest' });
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const b = items[hitIdx >= 0 ? hitIdx : 0]; if (b) b.dispatchEvent(new MouseEvent('mousedown'));
    } else if (ev.key === 'Escape') { closeHits(); qIn.blur(); }
  });
  function buildSections() {
    const box = $('#sections'); box.innerHTML = '';
    SECTIONS.forEach((s) => {
      const n = s.id === 'all' ? PICK.length : PICK.filter((p) => p.sec === s.id).length;
      const b = D.el('button', { type: 'button', class: 'tag', 'aria-pressed': String(S.sec === s.id) }, [D.t(s.key) + ' · ' + D.num(n)]);
      b.addEventListener('click', () => { S.sec = s.id; buildSections(); qIn.focus(); });
      box.append(b);
    });
    $('#nq').textContent = D.num(PICK.length);
  }

  /* ---------------- Interactions ---------------- */
  function selectState(e) { S.sel = S.sel === e ? null : e; render(); }
  $('#sel-clear').addEventListener('click', () => { S.sel = null; render(); });
  $('#sel-open').addEventListener('click', (ev) => { ev.preventDefault(); openProfile(S.sel, S.y); });
  D.$$('#base button').forEach((b) => b.addEventListener('click', () => { S.base = b.dataset.b; if (S.base === 'p' && isDK(S.c)) S.c = defaultCat(getVar(S.v)); render(); }));
  $('#yr').addEventListener('input', (ev) => { const V = getVar(S.v); S.y = V.years[+ev.target.value]; render(); });
  let timer = null;
  function setPlayIcon(on) { $('#play-ic').innerHTML = on ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M7 4v16l13-8z"/>'; $('#play').setAttribute('aria-label', D.t(on ? 'pause' : 'play')); }
  $('#play').addEventListener('click', () => {
    if (timer) { clearInterval(timer); timer = null; setPlayIcon(false); return; }
    const V = getVar(S.v);
    if (S.y === V.years[V.years.length - 1]) S.y = V.years[0];
    render(); setPlayIcon(true);
    timer = setInterval(() => {
      const i = V.years.indexOf(S.y);
      if (i >= V.years.length - 1) { clearInterval(timer); timer = null; setPlayIcon(false); return; }
      S.y = V.years[i + 1]; render();
    }, 900);
  });
  $('#crumb-home').addEventListener('click', (ev) => { ev.preventDefault(); S.view = 'map'; render(); window.scrollTo(0, 0); });
  $('#back-map').addEventListener('click', (ev) => { ev.preventDefault(); S.view = 'map'; render(); window.scrollTo(0, 0); });
  $('#dl').addEventListener('click', () => {
    const V = getVar(S.v);
    const lines = ['edition,state_code,state,variable,question,category,category_label,pct_valid_or_mean,pct_incl_dk,n'];
    const q = '"' + cleanLabel(CAT[S.v].label).replace(/"/g, '""') + '"';
    V.years.forEach((y) => ['00'].concat(CODES).forEach((e) => {
      const r = V.rec[y + '|' + e]; if (!r) return;
      Object.keys(r).forEach((c) => lines.push([y, e, '"' + (e === '00' ? 'México (nacional)' : STATES[e]) + '"', S.v, q, c, '"' + (c === '' ? '' : catLabel(S.v, c).replace(/"/g, '""')) + '"', r[c].p == null ? '' : r[c].p, r[c].pa == null ? '' : r[c].pa, r[c].n].join(',')));
    }));
    D.download('envipe_' + S.v + '.csv', lines.join('\n') + '\n');
  });

  /* ---------------- State profile ---------------- */
  function openProfile(e, y) { S.sel = e; S.view = 'state'; S.py = y || null; render(); window.scrollTo(0, 0); }
  function delta(a, b, invertGood) {
    if (a == null || b == null) return '';
    const d = a - b;
    const up = d >= 0;
    const col = (up !== !!invertGood) ? '#EFAB3D' : '#95C3CE';
    return '<span class="delta" style="color:' + col + '">' + (up ? '▲ ' : '▼ ') + D.num(Math.abs(d), 1) + ' pts ' + D.t('vs', { v: D.num(b, 1) }) + '</span>';
  }
  function renderProfile() {
    const e = S.sel;
    const U = getVar('ap4_3_3');
    const years = U.years;
    if (!S.py || !years.includes(S.py)) S.py = years.includes(S.y) ? S.y : years[years.length - 1];
    const y = S.py;
    // year select
    const ys = $('#p-year'); ys.innerHTML = '';
    years.slice().reverse().forEach((yy) => ys.append(D.el('option', { value: yy, text: yy, selected: yy === y })));
    // header
    $('#p-name').textContent = STATES[e];
    $('#crumb-state').textContent = ' / ' + STATES[e];
    const ranks = CODES.map((c) => ({ c, x: val(U, y, c, '2', 'p') })).filter((r) => r.x != null).sort((a, b) => b.x - a.x);
    const rank = ranks.findIndex((r) => r.c === e) + 1;
    $('#p-sub').textContent = D.t('profileSub', { n: D.num(nOf(U, y, e)), r: rank || '—' });
    // tiles
    const tiles = $('#tiles'); tiles.innerHTML = '';
    CODES.forEach((c) => {
      const t = TILES[c]; const x = val(U, y, c, '2', 'p');
      const bg = colorOf(x, breaksFor(U, '2'));
      const b = D.el('button', { type: 'button', class: c === e ? 'sel' : '', 'aria-label': STATES[c] + ': ' + fmt(x, U), 'aria-pressed': String(c === e), text: t[0],
        style: { gridColumn: String(t[1] + 1), gridRow: String(t[2] + 1), background: bg, color: x != null && x >= breaksFor(U, '2')[2] ? '#1C1B1A' : '#F7F3EC' } });
      b.addEventListener('click', () => { S.sel = c; render(); });
      b.addEventListener('mousemove', (ev) => D.showTip('<b>' + D.esc(STATES[c]) + '</b><div class="v">' + fmt(x, U) + '</div>', ev.clientX, ev.clientY));
      b.addEventListener('mouseleave', () => D.hideTip());
      tiles.append(b);
    });
    // KPIs
    const kp = $('#kpis'); kp.innerHTML = '';
    [['ap4_3_3', 'unsafeState'], ['ap4_3_2', 'unsafeMun'], ['ap4_3_1', 'unsafeCol']].forEach(([v, key]) => {
      const V = getVar(v);
      const s = val(V, y, e, '2', 'p'), n = val(V, y, '00', '2', 'p');
      kp.append(D.el('div', { class: 'kpi' }, [
        Object.assign(D.el('div', { class: 'muted', style: { fontSize: '13px' } }), { innerHTML: D.t(key) }),
        D.el('div', { class: 'big', style: { color: v === 'ap4_3_3' ? '#EFAB3D' : '#F7F3EC' }, text: s == null ? '—' : D.num(s, 1) + '%' }),
        s == null ? D.el('div', { class: 'na-note', text: D.t('notAsked') }) : Object.assign(D.el('div'), { innerHTML: delta(s, n) })
      ]));
    });
    $('#lg-state').textContent = STATES[e];
    // concerns
    const cbox = $('#concerns'); cbox.innerHTML = '';
    const cs = Object.keys(PROFILE.concerns).map((v) => { const V = getVar(v); return { v, s: val(V, y, e, '1', 'p'), n: val(V, y, '00', '1', 'p') }; })
      .filter((r) => r.n != null).sort((a, b) => b.n - a.n).slice(0, 8);
    if (!cs.length) cbox.append(D.el('p', { class: 'na-note', text: D.t('notAsked') }));
    const cmax = Math.max(70, ...cs.map((r) => Math.max(r.s || 0, r.n || 0)));
    const sc = (p) => (p / cmax * 100) + '%';
    cs.forEach((r) => {
      const lo = Math.min(r.s, r.n), hi = Math.max(r.s, r.n);
      cbox.append(D.el('div', { class: 'dumb' }, [
        D.el('span', { class: 'lb', text: L2(PROFILE.concerns[r.v]) }),
        D.el('span', { class: 'tr' }, [D.el('span', { class: 'ax' }), D.el('span', { class: 'ln', style: { left: sc(lo), width: 'calc(' + sc(hi) + ' - ' + sc(lo) + ')' } }), D.el('span', { class: 'n', style: { left: sc(r.n) } }), r.s == null ? null : D.el('span', { class: 's', style: { left: sc(r.s) } })]),
        Object.assign(D.el('span', { class: 'vv' }), { innerHTML: '<b style="color:#95C3CE">' + (r.s == null ? '—' : D.num(r.s, 1)) + '</b> / ' + D.num(r.n, 1) })
      ]));
    });
    // habits
    const hb = $('#habits'); hb.innerHTML = '';
    let anyH = false;
    Object.keys(PROFILE.habits).forEach((v) => {
      const V = getVar(v); const s = val(V, y, e, '1', 'p'), n = val(V, y, '00', '1', 'p');
      if (n == null) return; anyH = true;
      hb.append(D.el('div', { class: 'stack', style: { gap: '5px' } }, [
        Object.assign(D.el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '14px' } }), { innerHTML: '<span>' + D.esc(L2(PROFILE.habits[v])) + '</span><span class="mono" style="font-size:13px"><b style="color:#95C3CE">' + (s == null ? '—' : D.num(s, 1) + '%') + '</b> <span style="color:#9A9288">· MX ' + D.num(n, 1) + '%</span></span>' }),
        D.el('div', { class: 'hbar' }, [D.el('i', { style: { width: (s || 0) + '%' } }), D.el('b', { style: { left: n + '%' } })])
      ]));
    });
    if (!anyH) hb.append(D.el('p', { class: 'na-note', text: D.t('notAsked') }));
    // neighborhood
    const hd = $('#hood'); hd.innerHTML = '';
    let anyN = false;
    Object.keys(PROFILE.hood).forEach((v) => {
      const V = getVar(v); const s = val(V, y, e, '1', 'p'), n = val(V, y, '00', '1', 'p');
      if (n == null) return; anyN = true;
      hd.append(D.el('div', {}, [D.el('div', { class: 'big', style: { fontSize: '32px' }, text: s == null ? '—' : D.num(s, 1) + '%' }), D.el('div', { class: 'muted', style: { fontSize: '13px' }, text: L2(PROFILE.hood[v]) }), D.el('div', { class: 'mono', style: { fontSize: '12px', color: '#95C3CE' }, text: 'MX ' + D.num(n, 1) + '%' })]));
    });
    if (!anyN) hd.append(D.el('p', { class: 'na-note', text: D.t('notAsked') }));
    // trust
    $('#trust-title').textContent = D.t('trustTitle', { s: STATES[e] });
    const TC = [['#95C3CE', '#1C1B1A'], ['#357F93', '#F7F3EC'], ['#A65D0F', '#F7F3EC'], ['#EFAB3D', '#1C1B1A']];
    const tl = $('#trust-legend'); tl.innerHTML = '';
    ['trust1', 'trust2', 'trust3', 'trust4'].forEach((k, i) => tl.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: TC[i][0] } }), D.t(k)])));
    const tb = $('#trust'); tb.innerHTML = '';
    let anyT = false;
    Object.keys(PROFILE.trust).forEach((v) => {
      const V = getVar(v);
      const parts = ['1', '2', '3', '4'].map((c) => val(V, y, e, c, 'p'));
      if (parts.every((x) => x == null)) return; anyT = true;
      const nat = ['1', '2'].map((c) => val(V, y, '00', c, 'p') || 0).reduce((a, b) => a + b, 0);
      const bar = D.el('span', { class: 'stack100' });
      parts.forEach((x, i) => bar.append(D.el('span', { style: { width: (x || 0) + '%', background: TC[i][0], color: TC[i][1] }, text: x != null && x >= 8 ? D.num(x, 0) : '' })));
      tb.append(D.el('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 14px' } }, [
        D.el('span', { style: { width: '160px', fontSize: '14px' }, text: L2(PROFILE.trust[v]) }), bar,
        Object.assign(D.el('span', { style: { width: '170px', fontSize: '13px', color: '#C8C0B5' } }), { innerHTML: '<b style="color:#F7F3EC">' + D.num((parts[0] || 0) + (parts[1] || 0), 1) + '%</b> ' + D.t('trustPct') + ' · MX ' + D.num(nat, 1) + '%' })
      ]));
    });
    if (!anyT) tb.append(D.el('p', { class: 'na-note', text: D.t('notAsked') }));
    const CV = getVar('ap5_5_03'); const cs1 = val(CV, y, e, '1', 'p'), cn1 = val(CV, y, '00', '1', 'p');
    $('#trust-note').textContent = D.t('trustNote') + (cs1 != null && cn1 != null ? ' ' + D.t('corrupt', { s: D.num(cs1, 1), n: D.num(cn1, 1) }) : '');
    // trend
    const series = [{ name: D.t('mexico'), color: C_NAT, pts: years.map((yy) => [yy, val(U, yy, '00', '2', 'p')]) }, { name: STATES[e], color: C_ST, pts: years.map((yy) => [yy, val(U, yy, e, '2', 'p')]) }];
    $('#p-trend-title').textContent = D.t('pTrend');
    legendLines($('#p-trend-legend'), series);
    drawTrend($('#p-trend'), series, years, U, y);
  }
  const BRK = {};
  function breaksFor(V, c) {
    const k = V.v + '|' + c;
    if (!BRK[k]) { const save = [S.c, S.base]; S.c = c; S.base = 'p'; BRK[k] = breaks(V) || [0, 0, 0, 0, 0, 0]; S.c = save[0]; S.base = save[1]; }
    return BRK[k];
  }
  $('#p-year').addEventListener('change', (ev) => { S.py = +ev.target.value; render(); });

  /* ---------------- Render root ---------------- */
  function render() {
    D.hideTip();
    $('#view-map').hidden = S.view !== 'map';
    $('#view-state').hidden = S.view !== 'state';
    if (S.view === 'state') renderProfile(); else { $('#crumb-state').textContent = ''; renderMapView(); }
    writeHash();
  }
  D.onLang(() => { buildSections(); render(); });
  window.addEventListener('hashchange', () => { readHash(); render(); });
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (Object.keys(LINES).length) render(); }, 200); });

  /* ---------------- Boot ---------------- */
  function fail(msg) {
    $('#loading').hidden = true;
    const er = $('#error'); er.hidden = false; er.textContent = D.t('loadErr') + (msg ? ' (' + msg + ')' : '');
  }
  function boot() {
    if (!window.ENVIPE_META || !window.MX_STATES) return fail('envipe-meta.js / mx-states.js');
    loadParts(window.ENVIPE_META.parts || 1).then(() => {
      indexData();
      buildMap();
      buildSections();
      readHash();
      $('#loading').hidden = true;
      render();
    }).catch((err) => fail(err.message));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
