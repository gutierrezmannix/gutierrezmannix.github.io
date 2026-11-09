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
      mapLevel: 'Map', lSt: 'States', lMu: 'Municipalities', lAu: 'Urban areas',
      who: 'Who', gAll: 'All adults', gM: 'Men', gF: 'Women', gA1: 'Ages 18–30', gA2: 'Ages 31–50', gA3: 'Ages 51+',
      whoNote: 'Gender and age groups are available for states.', loadingSet: 'Loading data…', noLevel: 'This question has no data at this level.',
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Show all of Mexico',
      rankSt: 'All 32 states', rankMu: 'Municipalities · {n} with data', rankAu: 'Urban areas · {n}',
      minSt: 'smallest state n', minMu: 'smallest municipality n', minAu: 'smallest urban area n',
      noteSt: '', noteMu: 'Only municipalities with at least {n} interviews in that edition are shown; the rest are grey. Scroll or pinch to zoom, drag to move.',
      noteAu: 'INEGI urban areas of interest, placed on and named after the municipality where most of their respondents live. Scroll or pinch to zoom, drag to move.',
      areaOf: '{m} urban area', areaN: 'Urban area {n}', fewN: 'Few answers (n < 50) — read with care', fewLeg: 'faded = fewer than 50 answers',
      natAll: 'Mexico (all adults)',
      seeAll: 'See all answers', detTitle: 'All answers · {p} · {y}', detAns: 'Answer', detPct: '%', detMoe: '±', detN: 'n',
      detLegP: '{p}', detLegN: 'Mexico', detNote: 'Bars show {p}; orange marks show Mexico{g}. ± is a margin of error (at least; the real survey error is larger). n = people giving each answer. {b}', detMean: '{p}: {v} (Mexico {n}), from {k} answers.',
      selNote: 'Based on {n} people who answered this question here in {y}.', selMoe: ' Margin of error at least ±{m} points.', selSmall: ' Small sample — read as a rough estimate.',
      foot: 'Source: INEGI, Encuesta Nacional de Victimización y Percepción sobre Seguridad Pública (ENVIPE), 2011–2026 editions. Recoded master files and weighted estimates (person weight fac_ele) by Dr. Gutiérrez-Mannix. Years are survey editions. Maps: Natural Earth (public domain); municipalities from geoBoundaries / World Bank (CC BY 4.0). Data, maps and fonts are stored with this page — no internet connection needed.'
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
      mapLevel: 'Mapa', lSt: 'Estados', lMu: 'Municipios', lAu: 'Áreas urbanas',
      who: 'Quiénes', gAll: 'Toda la población adulta', gM: 'Hombres', gF: 'Mujeres', gA1: '18 a 30 años', gA2: '31 a 50 años', gA3: '51 años o más',
      whoNote: 'Los grupos por sexo y edad están disponibles por estado.', loadingSet: 'Cargando datos…', noLevel: 'Esta pregunta no tiene datos en este nivel.',
      zoomIn: 'Acercar', zoomOut: 'Alejar', zoomReset: 'Ver todo México',
      rankSt: 'Las 32 entidades', rankMu: 'Municipios · {n} con datos', rankAu: 'Áreas urbanas · {n}',
      minSt: 'n mínima por entidad', minMu: 'n mínima por municipio', minAu: 'n mínima por área urbana',
      noteSt: '', noteMu: 'Solo se muestran los municipios con al menos {n} entrevistas en esa edición; los demás aparecen en gris. Usa la rueda o pellizca para acercar; arrastra para moverte.',
      noteAu: 'Áreas urbanas de interés del INEGI, ubicadas en el municipio donde vive la mayoría de sus informantes y nombradas por él. Usa la rueda o pellizca para acercar; arrastra para moverte.',
      areaOf: 'Área urbana de {m}', areaN: 'Área urbana {n}', fewN: 'Pocas respuestas (n < 50): interpretar con cautela', fewLeg: 'tenue = menos de 50 respuestas',
      natAll: 'México (toda la población adulta)',
      seeAll: 'Ver todas las respuestas', detTitle: 'Todas las respuestas · {p} · {y}', detAns: 'Respuesta', detPct: '%', detMoe: '±', detN: 'n',
      detLegP: '{p}', detLegN: 'México', detNote: 'Las barras muestran {p}; las marcas naranjas, México{g}. ± es un margen de error (mínimo; el error real de la encuesta es mayor). n = personas que dieron cada respuesta. {b}', detMean: '{p}: {v} (México {n}), con base en {k} respuestas.',
      selNote: 'Con base en {n} personas que respondieron esta pregunta aquí en {y}.', selMoe: ' Margen de error de al menos ±{m} puntos.', selSmall: ' Muestra pequeña: tómese como una estimación aproximada.',
      foot: 'Fuente: INEGI, Encuesta Nacional de Victimización y Percepción sobre Seguridad Pública (ENVIPE), ediciones 2011–2026. Archivos maestros recodificados y estimaciones ponderadas (factor de persona fac_ele) por el Dr. Gutiérrez-Mannix. Los años corresponden a la edición de la encuesta. Mapas: Natural Earth (dominio público); municipios de geoBoundaries / Banco Mundial (CC BY 4.0). Los datos, los mapas y las fuentes tipográficas se guardan con esta página: no se necesita internet.'
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
  // Four data sets, as written by envipe_dashboard_build.do:
  //   agg = states, all adults (loaded at start)   grp = states, by gender / age
  //   mun = municipalities                          aum = urban areas
  // The last three are loaded only when the view needs them, one part file at a time.
  const CAT = {};       // v -> {label, type, agg, grp, mun, aum (part numbers)}
  const LAB = {};       // v -> {code -> label}
  const LINES = {};     // v -> [csv lines] (all adults, states)
  const SET_LINES = { agg: LINES, grp: {}, mun: {}, aum: {} };
  const SET_LOADED = { grp: {}, mun: {}, aum: {} };
  const CACHE = {};
  const MUNI = {};      // INEGI code -> {name, state, ok}
  let MUNI_CODES = [];  // municipalities with at least one published edition
  const AREAS = {};     // edition -> area code -> {state, main, name, n}
  let AREA_CODES = [];
  let PICK = [];        // [{v,label,sec}]
  const SETTINGS = { minmun: '100' };   // overwritten by envipe_settings.csv when present

  function cleanLabel(s) {
    if (!s) return s;
    s = s.replace(/^¿\s*/, '').replace(/\s*\?$/, '').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function tcase(s) {
    const small = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1, EL: 1 };
    return String(s || '').toLowerCase().split(' ').map((w, i) => (i && small[w.toUpperCase()] ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error(src));
      document.body.append(s);
    });
  }
  function loadParts(n) {
    let chain = Promise.resolve();
    for (let i = 1; i <= n; i++) chain = chain.then(() => loadScript('data/envipe-part' + i + '.js'));
    return chain;
  }
  function indexText(text, target, keep) {
    const lines = text.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i]; if (!ln) continue;
      const a = ln.indexOf(','), b = ln.indexOf(',', a + 1), c = ln.indexOf(',', b + 1);
      const v = ln.slice(b + 1, c);
      if (keep && !keep(v)) continue;
      (target[v] || (target[v] = [])).push(ln);
    }
  }
  /** Make sure the part file holding variable v for data set `set` is loaded. Resolves true/false (no data at that level). */
  function ensureSet(set, v) {
    if (set === 'agg') return Promise.resolve(true);
    const k = CAT[v] && CAT[v][set];
    if (!k) return Promise.resolve(false);
    // a part file that has not been uploaded yet: treat as "no data at this level"
    const avail = window.ENVIPE_META.setparts && window.ENVIPE_META.setparts[set];
    if (avail && !avail.includes(k)) return Promise.resolve(false);
    if (SET_LOADED[set][k]) return Promise.resolve(true);
    return loadScript('data/envipe-' + set + k + '.js').then(() => {
      const key = set + k, store = window.ENVIPE_SETS || {};
      // keep only variables the catalog assigns to this part (ignores leftovers from older runs)
      indexText(store[key] || '', SET_LINES[set], (v) => CAT[v] && CAT[v][set] === k);
      delete store[key];
      SET_LOADED[set][k] = true;
      return true;
    });
  }
  function hasLevel(v, set) {
    const k = CAT[v] && CAT[v][set]; if (!k) return false;
    const avail = window.ENVIPE_META.setparts && window.ENVIPE_META.setparts[set];
    return !avail || avail.includes(k);
  }
  let geoMunis = null;
  function ensureMunis() { return geoMunis ? Promise.resolve() : loadScript('mx-munis.js').then(() => { geoMunis = window.MX_MUNIS; }); }

  function indexData() {
    const meta = window.ENVIPE_META;
    D.parseCSV(meta.catalog).slice(1).forEach((r) => { if (r[0]) CAT[r[0]] = { label: r[1] || r[0], type: r[2], agg: +r[3] || 0, grp: +r[4] || 0, mun: +r[5] || 0, aum: +r[6] || 0 }; });
    D.parseCSV(meta.labels).slice(1).forEach((r) => { if (r[0]) (LAB[r[0]] = LAB[r[0]] || {})[r[1]] = r[2]; });
    (window.ENVIPE_PARTS || []).forEach((text) => indexText(text, LINES));
    if (meta.municipios) D.parseCSV(meta.municipios).slice(1).forEach((r) => { if (r[0]) MUNI[r[0]] = { state: r[1], name: tcase(r[2]), ok: +r[4] || 0 }; });
    MUNI_CODES = Object.keys(MUNI).filter((e) => MUNI[e].ok > 0).sort();
    const ac = new Set();
    if (meta.areas) D.parseCSV(meta.areas).slice(1).forEach((r) => { if (r[0] && r[1]) { (AREAS[+r[0]] = AREAS[+r[0]] || {})[r[1]] = { state: r[2], main: r[3], name: r[4], n: +r[5] || 0 }; ac.add(r[1]); } });
    AREA_CODES = [...ac].sort();
    if (meta.settings) D.parseCSV(meta.settings).slice(1).forEach((r) => { if (r[0]) SETTINGS[r[0]] = r[1]; });
    PICK = Object.keys(LINES).filter((v) => CAT[v])
      .map((v) => ({ v, label: CAT[v].label, sec: SECTIONS.slice(1).find((s) => s.test(v)).id }))
      .sort((x, y) => x.v.localeCompare(y.v, 'en', { numeric: true }));
  }
  /** All estimates for variable v in data set `set`, keyed "year|place|group". */
  function getVar(v, set) {
    set = set || 'agg';
    const ck = set + '|' + v;
    if (CACHE[ck]) return CACHE[ck];
    const rec = {}; const years = new Set(); const cats = new Set();
    (SET_LINES[set][v] || []).forEach((ln) => {
      const a = ln.split(',');
      const y = +a[0], e = a[1], c = a[3], g = set === 'grp' ? a[7] : 'all';
      years.add(y); cats.add(c);
      const k = y + '|' + e + '|' + g;
      (rec[k] || (rec[k] = {}))[c] = { p: a[4] === '' ? null : +a[4], pa: a[5] === '' ? null : +a[5], n: +a[6] };
    });
    const order = (c) => (c === '' ? -1 : /^\d+$/.test(c) ? +c : 1e6 + 'dru'.indexOf(c));
    const out = { v, set, rec, years: [...years].sort((a, b) => a - b), cats: [...cats].sort((a, b) => order(a) - order(b)), isMean: (CAT[v] && CAT[v].type === 'mean') || cats.has('') };
    if (out.years.length) CACHE[ck] = out;
    return out;
  }
  const isDK = (c) => c === 'd' || c === 'r' || c === 'u';
  function val(V, y, e, c, base, g) {
    const r = V.rec[y + '|' + e + '|' + (g || 'all')]; if (!r) return null;
    const x = r[V.isMean ? '' : c]; if (!x) return null;
    const out = V.isMean ? x.p : x[base];
    return out == null || !isFinite(out) ? null : out;
  }
  function nOf(V, y, e, g) {
    const r = V.rec[y + '|' + e + '|' + (g || 'all')]; if (!r) return null;
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

  /** n behind the shown answer (for the small-sample flag). */
  function nCell(V, y, e, c, g) {
    const r = V.rec[y + '|' + e + '|' + (g || 'all')]; if (!r) return null;
    if (V.isMean) return r[''] ? r[''].n : null;
    let n = 0; for (const k in r) if (!isDK(k) || S.base === 'pa') n += r[k].n || 0; return n;
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
  const S = { v: 'ap4_3_3', c: '2', base: 'p', y: null, sel: null, view: 'map', sec: 'all', lvl: 'st', g: 'all' };
  const GROUPS = { all: 'gAll', m: 'gM', f: 'gF', a1: 'gA1', a2: 'gA2', a3: 'gA3' };
  const curSet = () => (S.lvl === 'mu' ? 'mun' : S.lvl === 'au' ? 'aum' : S.g === 'all' ? 'agg' : 'grp');
  const curG = () => (S.lvl === 'st' ? S.g : 'all');
  function readHash() {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('v') && LINES[h.get('v')]) S.v = h.get('v');
    if (h.has('c')) S.c = h.get('c');
    if (h.get('b') === 'pa') S.base = 'pa';
    if (h.get('y')) S.y = +h.get('y');
    S.lvl = ['st', 'mu', 'au'].includes(h.get('l')) ? h.get('l') : 'st';
    S.g = GROUPS[h.get('g')] ? h.get('g') : 'all';
    S.sel = h.get('s') || null;
    if (S.lvl === 'st' && !STATES[S.sel]) S.sel = null;
    S.view = h.get('view') === 'state' && STATES[S.sel] ? 'state' : 'map';
  }
  function writeHash() {
    const h = new URLSearchParams();
    if (S.view === 'state') { h.set('view', 'state'); h.set('s', S.sel); if (S.py) h.set('y', S.py); }
    else { h.set('v', S.v); if (!getVar(S.v).isMean) h.set('c', S.c); if (S.base === 'pa') h.set('b', 'pa'); h.set('y', S.y); if (S.lvl !== 'st') h.set('l', S.lvl); if (S.lvl === 'st' && S.g !== 'all') h.set('g', S.g); if (S.sel) h.set('s', S.sel); }
    history.replaceState(null, '', '#' + h.toString());
  }
  function normalize() {
    const V = getVar(S.v, curSet());
    if (!V.isMean) {
      if (!V.cats.includes(S.c)) S.c = defaultCat(V);
      if (isDK(S.c)) S.base = 'pa';
    }
    if (!V.years.includes(S.y)) S.y = V.years[V.years.length - 1];
  }

  /* ---------------- Map ---------------- */
  // Layers, back to front: bg (states, filled) · mu (municipalities) · ol (state outlines) · au (urban-area dots)
  const svgMap = $('#map');
  const PATHS = {};
  const gSt = D.svg('g'), gMu = D.svg('g'), gOl = D.svg('g'), gAu = D.svg('g');
  const MUPATHS = {};
  let FULL = null, VB = null;
  function buildMap() {
    const G = window.MX_STATES;
    FULL = G.viewBox.split(/\s+/).map(Number); VB = FULL.slice();
    svgMap.setAttribute('viewBox', G.viewBox);
    G.states.forEach((s) => {
      const p = D.svg('path', { d: s.d, class: 'st', tabindex: '0' });
      p.dataset.cve = s.cve;
      p.addEventListener('mousemove', (ev) => { if (S.lvl === 'st') hoverPlace(s.cve, ev.clientX, ev.clientY); });
      p.addEventListener('mouseleave', () => D.hideTip());
      p.addEventListener('click', () => { if (S.lvl === 'st' && !dragMoved) selectPlace(s.cve); });
      p.addEventListener('keydown', (ev) => { if (S.lvl === 'st' && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); selectPlace(s.cve); } });
      PATHS[s.cve] = p;
      gSt.append(p);
      gOl.append(D.svg('path', { d: s.d, class: 'ol' }));
    });
    svgMap.append(gSt, gMu, gOl, gAu);
  }
  function buildMunis() {
    if (gMu.childNodes.length || !geoMunis) return;
    geoMunis.munis.forEach((m) => {
      const p = D.svg('path', { d: m.d, class: 'mu nodata' });
      if (m.c) {
        p.dataset.e = m.c;
        MUPATHS[m.c] = p;
        p.addEventListener('mousemove', (ev) => { if (!p.classList.contains('nodata')) hoverPlace(m.c, ev.clientX, ev.clientY); });
        p.addEventListener('mouseleave', () => D.hideTip());
        p.addEventListener('click', () => { if (!dragMoved && !p.classList.contains('nodata')) selectPlace(m.c); });
      }
      gMu.append(p);
    });
  }

  // ---- zoom and pan (viewBox) ----
  function applyVB() {
    svgMap.setAttribute('viewBox', VB.map((x) => x.toFixed(2)).join(' '));
    const k = VB[2] / (svgMap.getBoundingClientRect().width || 800);
    D.$$('circle.au', gAu).forEach((c) => { c.setAttribute('r', (+c.dataset.r || 8) * k); c.setAttribute('stroke-width', (c.classList.contains('sel') ? 2.5 : 1) * k); });
  }
  function zoomAt(f, cx, cy) {
    const w = Math.max(FULL[2] / 60, Math.min(FULL[2], VB[2] * f)), h = w * FULL[3] / FULL[2];
    const fx = (cx - VB[0]) / VB[2], fy = (cy - VB[1]) / VB[3];
    VB = [cx - fx * w, cy - fy * h, w, h]; applyVB();
  }
  function zoomTo(x, y, w) { const h = w * FULL[3] / FULL[2]; VB = [x - w / 2, y - h / 2, w, h]; applyVB(); }
  function resetZoom() { VB = FULL.slice(); applyVB(); }
  function clientToSvg(x, y) { const r = svgMap.getBoundingClientRect(); return [VB[0] + (x - r.left) / r.width * VB[2], VB[1] + (y - r.top) / r.height * VB[3]]; }
  svgMap.addEventListener('wheel', (ev) => { if (S.lvl === 'st') return; // the state map scrolls the page; zoom with the buttons
    ev.preventDefault(); D.hideTip(); const p = clientToSvg(ev.clientX, ev.clientY); zoomAt(Math.exp(ev.deltaY * 0.0015), p[0], p[1]); }, { passive: false });
  const ptrs = new Map(); let dragMoved = false, last = null, pinch = null;
  svgMap.addEventListener('pointerdown', (ev) => { ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); dragMoved = false; last = [ev.clientX, ev.clientY]; if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } });
  svgMap.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 2 && pinch) { const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); const c = clientToSvg((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2); zoomAt(pinch / d, c[0], c[1]); pinch = d; dragMoved = true; return; }
    const dx = ev.clientX - last[0], dy = ev.clientY - last[1];
    if (!dragMoved && Math.hypot(dx, dy) < 4) return;
    if (VB[2] >= FULL[2] - 1e-6) return; // nothing to pan at full extent
    if (!dragMoved) { svgMap.setPointerCapture(ev.pointerId); svgMap.classList.add('dragging'); D.hideTip(); }
    dragMoved = true; last = [ev.clientX, ev.clientY];
    const k = VB[2] / svgMap.getBoundingClientRect().width;
    VB[0] -= dx * k; VB[1] -= dy * k; applyVB();
  });
  const endPtr = (ev) => { ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null; svgMap.classList.remove('dragging'); setTimeout(() => { dragMoved = false; }, 0); };
  svgMap.addEventListener('pointerup', endPtr); svgMap.addEventListener('pointercancel', endPtr);
  $('#zin').addEventListener('click', () => zoomAt(0.6, VB[0] + VB[2] / 2, VB[1] + VB[3] / 2));
  $('#zout').addEventListener('click', () => zoomAt(1 / 0.6, VB[0] + VB[2] / 2, VB[1] + VB[3] / 2));
  $('#zreset').addEventListener('click', resetZoom);

  // ---- places at the current level ----
  function areaYear(e, y) { if (AREAS[y] && AREAS[y][e]) return y; const ys = Object.keys(AREAS).map(Number).filter((yy) => AREAS[yy][e]).sort((a, b) => b - a); return ys[0]; }
  function placeName(e, y, lvl) {
    lvl = lvl || S.lvl;
    if (e === '00') return D.t('mexico');
    if (lvl === 'st') return STATES[e] || e;
    if (lvl === 'mu') { const m = MUNI[e]; return m ? m.name + ', ' + (TILES[m.state] ? TILES[m.state][0] : m.state) : e; }
    const yy = areaYear(e, y), a = yy && AREAS[yy][e];
    if (!a) return D.t('areaN', { n: e });
    // named after the municipality where most of the area's respondents live
    const m = MUNI[a.main], st = (m && m.state) || a.state;
    return ((m && m.name) || tcase(a.name) || a.main) + ', ' + (TILES[st] ? TILES[st][0] : st);
  }
  function placePoint(e, y) {
    if (!geoMunis) return null;
    if (S.lvl === 'mu') return geoMunis.pts[e] || null;
    const yy = areaYear(e, y), a = yy && AREAS[yy][e];
    return a ? geoMunis.pts[a.main] || null : null;
  }
  function levelPlaces() { return S.lvl === 'st' ? CODES : S.lvl === 'mu' ? MUNI_CODES : AREA_CODES; }

  function hoverPlace(e, x, y) {
    const V = getVar(S.v, curSet()), g = curG();
    const natV = S.lvl === 'st' ? V : getVar(S.v, 'agg');
    const v = val(V, S.y, e, S.c, S.base, g), nat = val(natV, S.y, '00', S.c, S.base, g);
    const n = nCell(V, S.y, e, S.c, g);
    let diff = '';
    if (v != null && nat != null) { const d = v - nat; diff = (d >= 0 ? '+' : '−') + D.num(Math.abs(d), V.isMean ? 2 : 1) + (V.isMean ? '' : ' pts') + ' vs. ' + D.t('mexico'); }
    // every answer's share for this place and year (current base), chosen answer highlighted
    let rows = '';
    const r = V.rec[S.y + '|' + e + '|' + g];
    if (!V.isMean && r) {
      rows = '<div class="rows">' + V.cats.filter((c) => (S.base === 'pa' || !isDK(c)) && r[c]).map((c) => {
        const x = r[c] ? r[c][S.base] : null, on = c === S.c ? ' on' : '';
        return '<span class="' + on + '">' + D.esc(catLabel(S.v, c)) + '</span><span class="' + on + ' n">' + fmt(x, V) + '</span>';
      }).join('') + '</div>';
    }
    D.showTip('<b>' + D.esc(placeName(e, S.y)) + ' · ' + S.y + '</b>' + (V.isMean ? '<div class="v">' + fmt(v, V) + '</div>' : rows) + '<div class="s">' + diff + (n ? ' · n = ' + D.num(n) : '') + '</div>' +
      (n != null && n < 50 ? '<div class="s" style="color:#A65D0F">' + D.t('fewN') + '</div>' : '') +
      '<div class="s" style="color:#A65D0F;font-weight:600">' + D.t('clickSelect') + '</div>', x, y);
  }
  function breaksOver(V, places, c, base, g) {
    const a = [];
    V.years.forEach((y) => places.forEach((e) => { const x = val(V, y, e, c, base, g); if (x != null) a.push(x); }));
    a.sort((p, q) => p - q);
    if (!a.length) return null;
    const q = (f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
    return [a[0], q(0.2), q(0.4), q(0.6), q(0.8), a[a.length - 1]];
  }
  function breaks(V) { return breaksOver(V, CODES, S.c, S.base, 'all'); }
  function colorOf(x, br) {
    if (x == null || !br) return NA;
    for (let i = 1; i <= 4; i++) if (x < br[i]) return RAMP[i - 1];
    return RAMP[4];
  }

  /* ---------------- Render: map view ---------------- */
  let loadToken = 0;
  function renderMapView() {
    const set = curSet(), needGeo = S.lvl !== 'st';
    const ready = set === 'agg' || (CAT[S.v] && SET_LOADED[set][CAT[S.v][set]]);
    if (ready && (!needGeo || geoMunis)) { $('#map-loading').hidden = true; return drawMapView(); }
    const tok = ++loadToken;
    $('#map-loading').hidden = false;
    Promise.all([ensureSet(set, S.v), needGeo ? ensureMunis() : null]).then(([ok]) => {
      if (tok !== loadToken) return;
      $('#map-loading').hidden = true;
      if (!ok) { S.lvl = 'st'; S.sel = null; D.showTip(D.t('noLevel'), innerWidth / 2 - 120, 160); setTimeout(() => D.hideTip(), 2600); }
      render();
    }).catch((err) => { $('#map-loading').textContent = D.t('loadErr') + ' (' + err.message + ')'; });
  }
  function drawMapView() {
    normalize();
    const set = curSet(), g = curG();
    const V = getVar(S.v, set);
    const natV = S.lvl === 'st' ? V : getVar(S.v, 'agg');
    const places = levelPlaces();
    const br = breaksOver(V, places, S.c, S.base, g);
    // ---- controls ----
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
    D.$$('#lvl button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.l === S.lvl)); b.disabled = b.dataset.l !== 'st' && !hasLevel(S.v, b.dataset.l === 'mu' ? 'mun' : 'aum'); });
    D.$$('#who button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.g === g)); b.disabled = S.lvl !== 'st' || (b.dataset.g !== 'all' && !(CAT[S.v] && CAT[S.v].grp)); });
    $('#who-note').textContent = S.lvl !== 'st' ? D.t('whoNote') : '';
    $('#lvl-note').textContent = D.t(S.lvl === 'mu' ? 'noteMu' : S.lvl === 'au' ? 'noteAu' : 'noteSt', { n: SETTINGS.minmun });
    // ---- years ----
    const yb = $('#years'); yb.innerHTML = '';
    V.years.forEach((y) => {
      const b = D.el('button', { type: 'button', 'aria-pressed': String(y === S.y), text: y });
      b.addEventListener('click', () => { S.y = y; render(); });
      yb.append(b);
    });
    $('#yr-span').textContent = V.years[0] + '–' + V.years[V.years.length - 1];
    // ---- headline (national, for the chosen group) ----
    const nat = val(natV, S.y, '00', S.c, S.base, g);
    $('#hl-v').textContent = fmt(nat, V);
    $('#hl-t').innerHTML = (V.isMean ? D.t('hlMean') : D.t('hlCat', { a: D.esc(catLabel(S.v, S.c)) })) + ' — ' + D.esc(cleanLabel(CAT[S.v].label)) + '<br>' + D.t('hlWhere', { y: S.y }) + (g !== 'all' ? ' · <strong>' + D.esc(D.t(GROUPS[g])) + '</strong>' : '');
    // ---- map ----
    gSt.setAttribute('class', S.lvl === 'st' ? '' : 'bg');
    gOl.style.display = S.lvl === 'st' ? 'none' : '';
    gMu.style.display = S.lvl === 'mu' ? '' : 'none';
    gAu.style.display = S.lvl === 'au' ? '' : 'none';
    const few = (e) => { const n = nCell(V, S.y, e, S.c, g); return n != null && n < 50; };
    if (S.lvl === 'st') {
      CODES.forEach((e) => {
        const p = PATHS[e]; if (!p) return;
        const x = val(V, S.y, e, S.c, S.base, g);
        p.setAttribute('fill', colorOf(x, br));
        p.classList.toggle('na', x == null);
        p.classList.toggle('sel', e === S.sel);
        p.classList.toggle('few', x != null && few(e));
        p.setAttribute('aria-label', STATES[e] + ': ' + fmt(x, V));
      });
      if (S.sel && PATHS[S.sel]) gSt.append(PATHS[S.sel]);
    } else {
      CODES.forEach((e) => { const p = PATHS[e]; if (p) { p.removeAttribute('fill'); p.classList.remove('sel', 'na', 'few'); } });
    }
    if (S.lvl === 'mu') {
      buildMunis();
      Object.keys(MUPATHS).forEach((e) => {
        const p = MUPATHS[e], x = val(V, S.y, e, S.c, S.base, g);
        p.classList.toggle('nodata', x == null);
        if (x == null) p.removeAttribute('fill'); else p.setAttribute('fill', colorOf(x, br));
        p.classList.toggle('few', x != null && few(e));
        p.classList.toggle('sel', e === S.sel);
      });
      if (S.sel && MUPATHS[S.sel]) gMu.append(MUPATHS[S.sel]);
    }
    if (S.lvl === 'au') {
      gAu.innerHTML = '';
      Object.keys(AREAS[S.y] || {}).map((e) => ({ e, x: val(V, S.y, e, S.c, S.base, g), pt: placePoint(e, S.y) }))
        .filter((o) => o.pt).sort((a, b) => (a.e === S.sel) - (b.e === S.sel))
        .forEach((o) => {
          const c = D.svg('circle', { cx: o.pt[0], cy: o.pt[1], r: 8, class: 'au' + (o.e === S.sel ? ' sel' : '') + (o.x != null && few(o.e) ? ' few' : ''), fill: colorOf(o.x, br) });
          c.dataset.r = o.e === S.sel ? 11 : 8;
          c.addEventListener('mousemove', (ev) => hoverPlace(o.e, ev.clientX, ev.clientY));
          c.addEventListener('mouseleave', () => D.hideTip());
          c.addEventListener('click', () => { if (!dragMoved) selectPlace(o.e); });
          gAu.append(c);
        });
    }
    applyVB();
    svgMap.setAttribute('aria-label', D.t('title') + ' — ' + cleanLabel(CAT[S.v].label) + ', ' + S.y);
    // ---- legend ----
    const lg = $('#legend'); lg.innerHTML = '';
    lg.append(D.el('span', { class: 'label', text: V.isMean ? D.t('mean') : '%' }));
    if (br) for (let i = 0; i < 5; i++) lg.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: RAMP[i] } }), fmtShort(br[i], V) + '–' + fmtShort(br[i + 1], V)]));
    lg.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: NA } }), D.t('noData')]));
    lg.append(D.el('span', { class: 'sw', style: { color: 'var(--fg-4)' }, text: D.t('fewLeg') }));
    // ---- ranking ----
    const rows = places.map((e) => ({ e, x: val(V, S.y, e, S.c, S.base, g) }))
      .filter((r) => S.lvl === 'st' || r.x != null)
      .sort((a, b) => (b.x == null ? -Infinity : b.x) - (a.x == null ? -Infinity : a.x));
    $('#rank-title').textContent = S.lvl === 'st' ? D.t('rankSt') : D.t(S.lvl === 'mu' ? 'rankMu' : 'rankAu', { n: D.num(rows.length) });
    const mx = Math.max(...rows.map((r) => r.x || 0), 1e-9);
    const rk = $('#rank'); rk.innerHTML = '';
    rows.forEach((r, i) => {
      const b = D.el('button', { type: 'button', class: (r.e === S.sel ? 'sel ' : '') + (r.x != null && few(r.e) ? 'few' : ''), 'aria-pressed': String(r.e === S.sel) }, [
        D.el('span', { class: 'r', text: r.x == null ? '' : i + 1 }),
        D.el('span', { class: 'nm', text: placeName(r.e, S.y), title: placeName(r.e, S.y) }),
        D.el('span', { class: 'bar' }, [D.el('i', { style: { width: (r.x == null ? 0 : (V.isMean ? r.x / mx * 100 : r.x)) + '%', background: colorOf(r.x, br) } })]),
        D.el('span', { class: 'v', text: fmt(r.x, V) })
      ]);
      b.addEventListener('click', () => selectPlace(r.e, true));
      rk.append(b);
    });
    $('#rank-sub').textContent = S.y + ' · ' + (V.isMean ? D.t('mean') : '%');
    // ---- selection card ----
    const sc = $('#sel-card');
    sc.classList.toggle('on', !!S.sel);
    if (S.sel) {
      $('#sel-name').textContent = placeName(S.sel, S.y);
      $('#sel-val').textContent = fmt(val(V, S.y, S.sel, S.c, S.base, g), V);
      const n = nCell(V, S.y, S.sel, S.c, g);
      $('#sel-sub').textContent = n ? '· n = ' + D.num(n) : '';
      // small note: sample size and a simple-random-sample margin of error
      // (the real survey error is larger because of weighting and clustering)
      const xv = val(V, S.y, S.sel, S.c, S.base, g);
      let note = n ? D.t('selNote', { n: D.num(n), y: S.y }) : '';
      if (n && !V.isMean && xv != null) note += D.t('selMoe', { m: D.num(1.96 * Math.sqrt(xv * (100 - xv) / n), 0) });
      if (n && n < 50) note += D.t('selSmall');
      $('#sel-note').textContent = note;
      $('#sel-open').hidden = S.lvl !== 'st';
      $('#sel-open').href = '#view=state&s=' + S.sel + '&y=' + S.y;
    }
    // ---- answer detail for the selected place ----
    renderDetail(V, natV, g);
    // ---- trend: national (same group) vs. selected place ----
    const natName = S.lvl === 'st' ? D.t('mexico') + (g !== 'all' ? ' · ' + D.t(GROUPS[g]) : '') : D.t('natAll');
    const yrs = S.lvl === 'st' ? V.years : [...new Set(V.years.concat(natV.years))].sort((a, b) => a - b);
    const series = [{ name: natName, color: C_NAT, pts: yrs.map((y) => [y, val(natV, y, '00', S.c, S.base, g)]) }];
    if (S.sel) series.push({ name: placeName(S.sel, S.y), color: C_ST, pts: yrs.map((y) => [y, val(V, y, S.sel, S.c, S.base, g)]) });
    $('#trend-title').textContent = D.t('trendTitle') + ': ' + series.map((s) => s.name).join(' vs. ');
    legendLines($('#trend-legend'), series);
    drawTrend($('#trend'), series, yrs, V, S.y);
    // ---- about ----
    $('#about-q').textContent = V.isMean ? D.t('aboutM', { q: cleanLabel(CAT[S.v].label) + ' (' + S.v + ')' }) : D.t('aboutQ', { a: catLabel(S.v, S.c), q: cleanLabel(CAT[S.v].label) + ' (' + S.v + ')' });
    $('#about-base').textContent = V.isMean ? D.t('baseM') : S.base === 'p' ? D.t('baseP') : D.t('baseA');
    $('#about-n').textContent = D.num(nOf(natV, S.y, '00', g));
    const ns = places.map((e) => nOf(V, S.y, e, g)).filter((n) => n);
    $('#about-min').textContent = ns.length ? D.num(Math.min(...ns)) : '—';
    $('#about-min-l').textContent = D.t(S.lvl === 'mu' ? 'minMu' : S.lvl === 'au' ? 'minAu' : 'minSt');
  }

  /** Every answer for the selected place and edition: %, Mexico for comparison, margin of error, n. */
  function renderDetail(V, natV, g) {
    const box = $('#detail');
    box.hidden = !S.sel;
    $('#sel-detail').hidden = !S.sel;
    if (!S.sel) return;
    const pn = placeName(S.sel, S.y);
    const gTxt = g !== 'all' ? ' · ' + D.t(GROUPS[g]) : '';
    $('#det-title').textContent = D.t('detTitle', { p: pn + gTxt, y: S.y });
    const lg = $('#det-legend'); lg.innerHTML = '';
    lg.append(D.el('span', { class: 'sw' }, [D.el('i', { style: { background: '#95C3CE' } }), pn]),
      D.el('span', { class: 'sw' }, [D.el('i', { style: { background: '#E5912A', width: '4px' } }), D.t('detLegN')]));
    const rows = $('#det-rows'); rows.innerHTML = '';
    const r = V.rec[S.y + '|' + S.sel + '|' + g] || {}, rn = natV.rec[S.y + '|00|' + g] || {};
    if (V.isMean) {
      const x = r[''] ? r[''].p : null, nx = rn[''] ? rn[''].p : null, k = r[''] ? r[''].n : null;
      rows.append(D.el('p', { class: 'muted', style: { margin: 0 }, text: D.t('detMean', { p: pn, v: fmt(x, V), n: fmt(nx, V), k: D.num(k) }) }));
      $('#det-note').textContent = '';
      return;
    }
    const cats = V.cats.filter((c) => (S.base === 'pa' || !isDK(c)) && (r[c] || rn[c]));
    let tot = 0; cats.forEach((c) => { tot += (r[c] && r[c].n) || 0; });
    rows.append(D.el('div', { class: 'det-row det-head' }, [D.el('span', { text: D.t('detAns') }), D.el('span'), D.el('span', { class: 'vv', text: D.t('detPct') }), D.el('span', { class: 'mo', text: D.t('detMoe') }), D.el('span', { class: 'nn', text: D.t('detN') })]));
    cats.forEach((c) => {
      const x = r[c] ? r[c][S.base] : null, nx = rn[c] ? rn[c][S.base] : null, k = r[c] ? r[c].n : 0;
      const moe = x != null && tot ? 1.96 * Math.sqrt(x * (100 - x) / tot) : null;
      const row = D.el('div', { class: 'det-row' + (c === S.c ? ' on' : ''), title: catLabel(S.v, c) }, [
        D.el('span', { text: catLabel(S.v, c) }),
        D.el('span', { class: 'tr' }, [D.el('i', { style: { width: (x || 0) + '%' } }), nx == null ? null : D.el('b', { style: { left: nx + '%' } })]),
        D.el('span', { class: 'vv', text: fmt(x, V) }),
        D.el('span', { class: 'mo', text: moe == null ? '—' : '±' + D.num(moe, 1) }),
        D.el('span', { class: 'nn', text: D.num(k) })
      ]);
      rows.append(row);
    });
    $('#det-note').textContent = D.t('detNote', { p: pn, g: gTxt, b: S.base === 'p' ? D.t('baseP') : D.t('baseA') });
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
    if (S.lvl !== 'st' && !hasLevel(v, S.lvl === 'mu' ? 'mun' : 'aum')) { S.lvl = 'st'; S.sel = null; resetZoom(); }
    if (S.lvl === 'st' && S.sel && !STATES[S.sel]) S.sel = null;
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
  function selectPlace(e, fromList) {
    S.sel = S.sel === e ? null : e;
    render();
    if (S.sel && fromList && S.lvl !== 'st') { const pt = placePoint(S.sel, S.y); if (pt) zoomTo(pt[0], pt[1], FULL[2] / (S.lvl === 'mu' ? 9 : 5)); }
  }
  D.$$('#lvl button').forEach((b) => b.addEventListener('click', () => { if (b.disabled || S.lvl === b.dataset.l) return; S.lvl = b.dataset.l; S.sel = null; resetZoom(); render(); }));
  D.$$('#who button').forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; S.g = b.dataset.g; render(); }));
  $('#sel-clear').addEventListener('click', () => { S.sel = null; render(); });
  $('#sel-detail').addEventListener('click', (ev) => { ev.preventDefault(); $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#sel-open').addEventListener('click', (ev) => { ev.preventDefault(); openProfile(S.sel, S.y); });
  D.$$('#base button').forEach((b) => b.addEventListener('click', () => { S.base = b.dataset.b; if (S.base === 'p' && isDK(S.c)) S.c = defaultCat(getVar(S.v, curSet())); render(); }));
  $('#crumb-home').addEventListener('click', (ev) => { ev.preventDefault(); S.view = 'map'; render(); window.scrollTo(0, 0); });
  $('#back-map').addEventListener('click', (ev) => { ev.preventDefault(); S.view = 'map'; S.lvl = 'st'; render(); window.scrollTo(0, 0); });
  $('#dl').addEventListener('click', () => {
    const set = curSet(), V = getVar(S.v, set);
    const lvlName = { st: 'state', mu: 'municipality', au: 'urban_area' }[S.lvl];
    const lines = ['edition,level,place_code,place,group,variable,question,category,category_label,pct_valid_or_mean,pct_incl_dk,n'];
    const q = '"' + cleanLabel(CAT[S.v].label).replace(/"/g, '""') + '"';
    Object.keys(V.rec).sort().forEach((k) => {
      const [y, e, g] = k.split('|'); const r = V.rec[k];
      const nm = '"' + placeName(e, +y).replace(/"/g, '""') + '"';
      Object.keys(r).forEach((c) => lines.push([y, e === '00' ? 'national' : lvlName, e, nm, g, S.v, q, c, '"' + (c === '' ? '' : catLabel(S.v, c).replace(/"/g, '""')) + '"', r[c].p == null ? '' : r[c].p, r[c].pa == null ? '' : r[c].pa, r[c].n].join(',')));
    });
    D.download('envipe_' + S.v + '_' + lvlName + (set === 'grp' ? '_groups' : '') + '.csv', lines.join('\n') + '\n');
  });

  /* ---------------- State profile ---------------- */
  function openProfile(e, y) { S.lvl = 'st'; S.sel = e; S.view = 'state'; S.py = y || null; render(); window.scrollTo(0, 0); }
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
