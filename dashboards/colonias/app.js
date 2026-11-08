/* ============================================================
   Texas Colonias dashboard — offline version
   Data:  data/colonias-data.js  (1,716 colonias, OAG CGD + ACS 5-year)
   Map:   tx-geo.js (US Census county outlines, Albers equal-area)
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
      title: 'Texas Colonias', titleLong: 'Texas Colonias Dashboard', offline: 'Works offline', openAnalysis: 'Open analysis',
      lede: '{n} colonias along the Rio Grande · about {p} residents (OAG estimates)',
      find: 'Find a colonia', searchPh: 'Search {n} colonias by name…', colorBy: 'Color the map by', county: 'County', infra: 'Infrastructure flags',
      clearFilters: 'Clear filters', showing: 'Showing <b>{n}</b> of {t}', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
      rAll: 'Whole border', rEP: 'El Paso', rLW: 'Del Rio–Laredo', rRGV: 'Rio Grande Valley',
      mapHelp: 'Scroll or pinch to zoom, drag to move. Click a dot to open that colonia’s profile.',
      lighter: 'Lighter dots = higher values', better: '(better)', worse: '(worse)', noData: 'no data',
      yes: 'Yes', no: 'No', partial: 'Partial', unknown: 'Unknown / not reported',
      fWaterY: 'has water', fWaterN: 'no water', fSewerY: 'has sewer', fSewerN: 'no sewer', fPavedY: 'paved roads', fPavedN: 'unpaved', fFlood: 'in floodplain', fInadeq: 'flagged inadequate',
      kCol: 'colonias shown', kRes: 'est. residents', kWater: 'community water service', kSewer: 'wastewater collection', kPaved: 'paved roads', kFlood: 'in a floodplain',
      kNote: 'Shares of the colonias shown. Colonias with no OAG infrastructure record count as not reported.',
      aboutT: 'About the colonias',
      about1: 'Tiny <strong>border towns</strong> on the edge of Texas — unincorporated neighborhoods where families have built homes, schools, and futures over decades.',
      about2: 'A <em>colonia</em> (co·LOH·nee·ah) is a small residential community along the Texas–Mexico border. Many began as unplatted land sold lot-by-lot to working families, often without paved roads, piped water, or a sewer hookup. The state of Texas tracks <strong>1,716</strong> of them.',
      analysis: 'Analysis', tSum: 'Summary statistics', tTb: 'Top & bottom', tCor: 'Correlation', tCo: 'By county',
      anNote: 'Based on the {n} colonias that match your current filters.', variable: 'Variable', show: 'Show',
      pickSome: 'Pick one or more variables on the left.', highest: 'Highest', lowest: 'Lowest',
      thVar: 'Variable', thN: 'N', thMin: 'Min', thP25: 'P25', thMed: 'Median', thMean: 'Mean', thP75: 'P75', thMax: 'Max', thSd: 'Std dev',
      thCounty: 'County', thCol: 'Colonias', thWith: 'N with data',
      rStrong: 'strong', rMod: 'moderate', rWeak: 'weak', rVWeak: 'very weak', rPos: 'positive', rNeg: 'negative',
      backMap: 'Back to map', pEyebrow: 'Colonia profile · {c} County · {id}', pSub: 'Est. {p} residents (OAG) · host census tract: {t} people{near}', near: ' · near {c}', popUnknown: 'population unknown',
      infraT: 'Infrastructure (Texas OAG)', infraNote: 'From the Texas OAG Colonia Geographic Database.', compares: 'How it compares',
      cmpKey: 'Percentile among all colonias · <span style="color:#E5912A">|</span> county median', countyMed: 'county {v}', allVars: 'All variables',
      tractNote: 'Census values describe the colonia’s host tract, not the colonia itself. Percentages on small subpopulations can be noisy.',
      coCtx: 'County context', coMhi: 'County median HH income', coPci: 'County per-capita income', notFound: 'That colonia was not found.',
      foot: 'Sources: Texas OAG Colonia Geographic Database; ACS 5-year tract estimates (merged on coordinates). Census values describe the colonia’s host tract, not the colonia itself. Base map: US Census county boundaries (us-atlas). Data, map and fonts are stored with this page — no internet connection needed.'
    },
    es: {
      navPubs: 'Publicaciones', navTeach: 'Docencia', navData: 'Datos', navDocs: 'Recomendaciones', navCalc: 'Calculadora', navDash: 'Tableros',
      title: 'Colonias de Texas', titleLong: 'Tablero de las colonias de Texas', offline: 'Funciona sin internet', openAnalysis: 'Abrir análisis',
      lede: '{n} colonias a lo largo del río Bravo · unas {p} personas residentes (estimaciones de la OAG)',
      find: 'Busca una colonia', searchPh: 'Busca entre {n} colonias…', colorBy: 'Colorear el mapa por', county: 'Condado', infra: 'Infraestructura',
      clearFilters: 'Quitar filtros', showing: 'Mostrando <b>{n}</b> de {t}', zoomIn: 'Acercar', zoomOut: 'Alejar',
      rAll: 'Toda la frontera', rEP: 'El Paso', rLW: 'Del Rio–Laredo', rRGV: 'Valle del Río Grande',
      mapHelp: 'Usa la rueda o pellizca para acercar; arrastra para moverte. Haz clic en un punto para ver el perfil de la colonia.',
      lighter: 'Puntos más claros = valores más altos', better: '(mejor)', worse: '(peor)', noData: 'sin datos',
      yes: 'Sí', no: 'No', partial: 'Parcial', unknown: 'Desconocido / sin registro',
      fWaterY: 'con agua', fWaterN: 'sin agua', fSewerY: 'con drenaje', fSewerN: 'sin drenaje', fPavedY: 'calles pavimentadas', fPavedN: 'sin pavimento', fFlood: 'zona inundable', fInadeq: 'infraestructura inadecuada',
      kCol: 'colonias mostradas', kRes: 'residentes estimados', kWater: 'servicio de agua', kSewer: 'drenaje', kPaved: 'calles pavimentadas', kFlood: 'en zona inundable',
      kNote: 'Porcentajes de las colonias mostradas. Las colonias sin registro de infraestructura de la OAG cuentan como no reportadas.',
      aboutT: 'Sobre las colonias',
      about1: 'Pequeños <strong>pueblos fronterizos</strong> en el borde de Texas: vecindarios no incorporados donde las familias han construido casas, escuelas y futuros durante décadas.',
      about2: 'Una <em>colonia</em> es una pequeña comunidad residencial en la frontera entre Texas y México. Muchas comenzaron como terrenos sin plano vendidos lote por lote a familias trabajadoras, a menudo sin calles pavimentadas, agua entubada ni drenaje. El estado de Texas registra <strong>1,716</strong>.',
      analysis: 'Análisis', tSum: 'Estadísticas', tTb: 'Mayores y menores', tCor: 'Correlación', tCo: 'Por condado',
      anNote: 'Con base en las {n} colonias que cumplen tus filtros actuales.', variable: 'Variable', show: 'Mostrar',
      pickSome: 'Elige una o más variables a la izquierda.', highest: 'Más alto', lowest: 'Más bajo',
      thVar: 'Variable', thN: 'N', thMin: 'Mín.', thP25: 'P25', thMed: 'Mediana', thMean: 'Media', thP75: 'P75', thMax: 'Máx.', thSd: 'Desv. est.',
      thCounty: 'Condado', thCol: 'Colonias', thWith: 'N con datos',
      rStrong: 'fuerte', rMod: 'moderada', rWeak: 'débil', rVWeak: 'muy débil', rPos: 'positiva', rNeg: 'negativa',
      backMap: 'Volver al mapa', pEyebrow: 'Perfil de colonia · Condado {c} · {id}', pSub: 'Unas {p} personas residentes (OAG) · tracto censal: {t} personas{near}', near: ' · cerca de {c}', popUnknown: 'población desconocida',
      infraT: 'Infraestructura (OAG de Texas)', infraNote: 'De la base de datos geográfica de colonias de la OAG de Texas.', compares: 'Cómo se compara',
      cmpKey: 'Percentil entre todas las colonias · <span style="color:#E5912A">|</span> mediana del condado', countyMed: 'condado {v}', allVars: 'Todas las variables',
      tractNote: 'Los datos censales describen el tracto donde está la colonia, no la colonia en sí. Los porcentajes de subpoblaciones pequeñas pueden ser inestables.',
      coCtx: 'Contexto del condado', coMhi: 'Ingreso mediano del hogar del condado', coPci: 'Ingreso per cápita del condado', notFound: 'No se encontró esa colonia.',
      foot: 'Fuentes: base de datos geográfica de colonias de la OAG de Texas; estimaciones ACS de 5 años por tracto (unidas por coordenadas). Los datos censales describen el tracto donde está la colonia, no la colonia en sí. Mapa base: límites de condados del Censo de EE. UU. (us-atlas). Los datos, el mapa y las fuentes tipográficas se guardan con esta página: no se necesita internet.'
    }
  });

  /* ---------------- Variable catalog (from the original dashboard) ---------------- */
  const CATS = [['People', 'Personas'], ['Income', 'Ingreso'], ['Education', 'Educación'], ['Housing', 'Vivienda'], ['Internet', 'Internet'], ['Language', 'Idioma'], ['Health', 'Salud'], ['Transport', 'Transporte'], ['Infrastructure', 'Infraestructura']];
  const V = (k, cat, en, es, fmt, dir, desc, descEs, type) => ({ k, cat, en, es, fmt, dir, desc, descEs, type: type || 'num' });
  const VARS = [
    V('pop', 'People', 'Tract population', 'Población del tracto', 'int', 'neutral', 'Total population of the colonia’s host census tract.', 'Población total del tracto censal donde está la colonia.'),
    V('u18', 'People', '% under 18', '% menores de 18', 'pct', 'neutral', 'Share of tract population under 18.', 'Porcentaje de la población menor de 18 años.'),
    V('o65', 'People', '% 65 and over', '% de 65 años o más', 'pct', 'neutral', 'Share of tract population 65 or older.', 'Porcentaje de la población de 65 años o más.'),
    V('age', 'People', 'Median age', 'Edad mediana', 'num1', 'neutral', 'Median age, years.', 'Edad mediana, en años.'),
    V('hisp', 'People', '% Hispanic / Latino', '% hispano / latino', 'pct', 'neutral', 'Share of tract identifying as Hispanic or Latino.', 'Porcentaje que se identifica como hispano o latino.'),
    V('fb', 'People', '% foreign-born', '% nacido en el extranjero', 'pct', 'neutral', 'Share of residents born outside the U.S.', 'Porcentaje de residentes nacidos fuera de EE. UU.'),
    V('mhi', 'Income', 'Median household income', 'Ingreso mediano del hogar', 'usd', 'good', 'ACS median household income.', 'Ingreso mediano del hogar (ACS).'),
    V('pci', 'Income', 'Per-capita income', 'Ingreso per cápita', 'usd', 'good', 'ACS per-capita income.', 'Ingreso per cápita (ACS).'),
    V('pov', 'Income', 'Poverty rate', 'Tasa de pobreza', 'pct', 'bad', 'Share of residents in poverty.', 'Porcentaje de residentes en pobreza.'),
    V('povkids', 'Income', 'Child poverty rate', 'Pobreza infantil', 'pct', 'bad', 'Share of under-18 residents in poverty. Restricted to tracts with at least 100 under-18 residents to suppress small-sample noise.', 'Porcentaje de menores de 18 en pobreza. Solo tractos con al menos 100 menores, para evitar ruido de muestras pequeñas.'),
    V('unemp', 'Income', 'Unemployment rate', 'Tasa de desempleo', 'pct', 'bad', 'Unemployed share of the civilian labor force.', 'Porcentaje desempleado de la fuerza laboral civil.'),
    V('lfp', 'Income', 'Labor force participation', 'Participación laboral', 'pct', 'good', 'Share of 16+ population in the labor force.', 'Porcentaje de personas de 16+ en la fuerza laboral.'),
    V('snap', 'Income', '% households on SNAP', '% hogares con SNAP', 'pct', 'bad', 'Share of households receiving food assistance.', 'Porcentaje de hogares que reciben asistencia alimentaria.'),
    V('elhs', 'Education', '% no high-school diploma', '% sin preparatoria', 'pct', 'bad', 'Share of 25+ without a high-school credential.', 'Porcentaje de personas de 25+ sin preparatoria terminada.'),
    V('ebach', 'Education', '% bachelor’s or higher', '% licenciatura o más', 'pct', 'good', 'Share of 25+ with a bachelor’s degree or higher.', 'Porcentaje de personas de 25+ con licenciatura o más.'),
    V('home', 'Housing', 'Median home value', 'Valor mediano de la vivienda', 'usd', 'neutral', 'Median value of owner-occupied homes.', 'Valor mediano de viviendas ocupadas por sus dueños.'),
    V('rent', 'Housing', 'Median gross rent', 'Renta bruta mediana', 'usd', 'neutral', 'Median monthly gross rent.', 'Renta bruta mensual mediana.'),
    V('own', 'Housing', '% owner-occupied', '% vivienda propia', 'pct', 'good', 'Share of occupied homes that are owner-occupied.', 'Porcentaje de viviendas ocupadas por sus dueños.'),
    V('mob', 'Housing', '% mobile homes', '% casas móviles', 'pct', 'neutral', 'Share of housing units that are mobile homes.', 'Porcentaje de viviendas que son casas móviles.'),
    V('crowd', 'Housing', '% overcrowded', '% hacinamiento', 'pct', 'bad', 'Share of households with >1 occupant per room.', 'Porcentaje de hogares con más de 1 ocupante por cuarto.'),
    V('nplumb', 'Housing', '% lacking plumbing', '% sin plomería completa', 'pct', 'bad', 'Share of homes without complete plumbing.', 'Porcentaje de viviendas sin plomería completa.'),
    V('nkitch', 'Housing', '% lacking kitchen', '% sin cocina completa', 'pct', 'bad', 'Share of homes without complete kitchen facilities.', 'Porcentaje de viviendas sin cocina completa.'),
    V('yblt', 'Housing', 'Median year built', 'Año mediano de construcción', 'year', 'neutral', 'Median year housing units were built.', 'Año mediano en que se construyeron las viviendas.'),
    V('rbur', 'Housing', 'Rent-burdened (>30%)', 'Carga de renta (>30%)', 'pct', 'bad', 'Share of renters paying >30% of income on rent.', 'Porcentaje de inquilinos que pagan más del 30% de su ingreso en renta.'),
    V('obur', 'Housing', 'Owner-burdened (>30%)', 'Carga de propietarios (>30%)', 'pct', 'bad', 'Share of homeowners paying >30% of income on housing.', 'Porcentaje de propietarios que pagan más del 30% de su ingreso en vivienda.'),
    V('bb', 'Internet', '% with broadband', '% con banda ancha', 'pct', 'good', 'Share of households with a broadband subscription.', 'Porcentaje de hogares con internet de banda ancha.'),
    V('noint', 'Internet', '% no internet', '% sin internet', 'pct', 'bad', 'Share of households without any internet subscription.', 'Porcentaje de hogares sin ninguna suscripción de internet.'),
    V('comp', 'Internet', '% with a computer', '% con computadora', 'pct', 'good', 'Share of households with a computer available.', 'Porcentaje de hogares con computadora.'),
    V('span', 'Language', '% Spanish at home', '% habla español en casa', 'pct', 'neutral', 'Share of residents who speak Spanish at home.', 'Porcentaje que habla español en casa.'),
    V('leng', 'Language', '% limited-English HHs', '% hogares con inglés limitado', 'pct', 'bad', 'Share of households where no member 14+ speaks English well.', 'Hogares donde nadie de 14+ habla bien inglés.'),
    V('nohi', 'Health', '% uninsured', '% sin seguro médico', 'pct', 'bad', 'Share of population without health insurance.', 'Porcentaje sin seguro médico.'),
    V('dis', 'Health', '% with a disability', '% con discapacidad', 'pct', 'neutral', 'Share of civilian noninstitutionalized population with a disability.', 'Porcentaje de la población civil no institucionalizada con discapacidad.'),
    V('nveh', 'Transport', '% no vehicle', '% sin vehículo', 'pct', 'bad', 'Share of households without a vehicle available.', 'Porcentaje de hogares sin vehículo.'),
    V('comm', 'Transport', 'Mean commute (min)', 'Traslado promedio (min)', 'num1', 'bad', 'Average one-way commute time in minutes.', 'Tiempo promedio de traslado al trabajo, en minutos.'),
    V('water', 'Infrastructure', 'Community water service', 'Servicio de agua comunitario', null, null, 'Is the colonia served by a community water system?', '¿La colonia tiene sistema de agua comunitario?', 'bool'),
    V('sewer', 'Infrastructure', 'Wastewater collection', 'Drenaje (aguas residuales)', null, null, 'Is the colonia connected to a wastewater collection system?', '¿La colonia está conectada a un sistema de drenaje?', 'bool'),
    V('paved', 'Infrastructure', 'Paved roads', 'Calles pavimentadas', null, null, 'Are the colonia’s roads paved?', '¿Las calles de la colonia están pavimentadas?', 'bool'),
    V('trash', 'Infrastructure', 'Trash collection', 'Recolección de basura', null, null, 'Does the colonia have trash collection service?', '¿La colonia tiene recolección de basura?', 'bool'),
    V('flood', 'Infrastructure', 'In a floodplain', 'En zona inundable', null, null, 'Is the colonia within a designated floodplain?', '¿La colonia está en una zona inundable designada?', 'bool'),
    V('platted', 'Infrastructure', 'Platted subdivision', 'Subdivisión con plano', null, null, 'Is the colonia an officially platted subdivision?', '¿La colonia es una subdivisión con plano oficial?', 'bool'),
    V('inadeq', 'Infrastructure', 'Flagged: inadequate infra', 'Señalada: infraestructura inadecuada', null, null, 'Flagged by the state as having inadequate infrastructure.', 'Señalada por el estado por infraestructura inadecuada.', 'bool'),
    V('clinic', 'Infrastructure', 'Has a clinic nearby', 'Clínica cercana', null, null, 'Is an ambulatory clinic available?', '¿Hay una clínica ambulatoria disponible?', 'bool')
  ];
  const VK = {}; VARS.forEach((v) => { VK[v.k] = v; });
  const NUMV = VARS.filter((v) => v.type === 'num');
  const vl = (v) => (D.lang === 'es' ? v.es : v.en);
  const catL = (c) => { const x = CATS.find((p) => p[0] === c); return x ? (D.lang === 'es' ? x[1] : x[0]) : c; };
  const DEFAULT_PICK = ['mhi', 'pov', 'unemp', 'elhs', 'rbur', 'own', 'home', 'nohi', 'bb', 'span'];
  const CITIES = [
    ['El Paso', 31.7619, -106.4850, 'https://www.elpasotexas.gov'], ['Socorro', 31.6543, -106.2885, 'https://costx.us'], ['Anthony', 31.9989, -106.5994, 'https://townofanthonytx.org'],
    ['Fort Hancock', 31.2960, -105.8478, ''], ['Sierra Blanca', 31.1735, -105.3597, ''], ['Presidio', 29.5611, -104.3727, ''], ['Marfa', 30.3094, -104.0207, ''], ['Alpine', 30.3585, -103.6610, ''],
    ['Del Rio', 29.3625, -100.8966, ''], ['Eagle Pass', 28.7091, -100.4995, ''], ['Carrizo Springs', 28.5219, -99.8584, ''], ['Laredo', 27.5306, -99.4803, 'https://www.cityoflaredo.com'],
    ['Zapata', 26.8975, -99.2700, ''], ['Roma', 26.4068, -99.0103, ''], ['Rio Grande City', 26.3795, -98.8200, ''], ['Mission', 26.2156, -98.3253, ''], ['McAllen', 26.2034, -98.2300, 'https://www.mcallen.net'],
    ['Pharr', 26.1948, -98.1836, 'https://www.pharr-tx.gov'], ['Edinburg', 26.3017, -98.1633, ''], ['Weslaco', 26.1596, -97.9908, ''], ['Mercedes', 26.1490, -97.9133, ''], ['Harlingen', 26.1906, -97.6961, 'https://www.myharlingen.us'],
    ['San Benito', 26.1326, -97.6311, ''], ['Brownsville', 25.9018, -97.4975, 'https://www.cob.us'], ['Raymondville', 26.4828, -97.7806, '']
  ];
  const REGIONS = [
    { id: 'all', key: 'rAll', co: null },
    { id: 'ep', key: 'rEP', co: ['EL PASO', 'HUDSPETH'] },
    { id: 'lw', key: 'rLW', co: ['VAL VERDE', 'KINNEY', 'MAVERICK', 'WEBB', 'ZAPATA'] },
    { id: 'rgv', key: 'rRGV', co: ['HIDALGO', 'CAMERON', 'STARR', 'WILLACY'] }
  ];
  const RAMP = ['#3E8296', '#5DA0B1', '#95C3CE', '#C8E0E6', '#F4FAFB'];
  const NA = '#6B645B';
  const BOOL = { yes: '#5DA0B1', no: '#EFAB3D', partial: '#C8C0B5', unknown: '#57524A' };

  /* ---------------- Data prep ---------------- */
  const DATA = (window.COLONIAS_DATA || []).slice();
  const PCT = new Set(VARS.filter((v) => v.fmt === 'pct').map((v) => v.k));
  DATA.forEach((d) => {
    PCT.forEach((k) => { const x = d[k]; if (x != null && (!isFinite(x) || x < 0 || x > 100.5)) d[k] = null; });
    if (d.yblt != null && (d.yblt < 1800 || d.yblt > 2030)) d.yblt = null;
  });
  // Spherical Albers equal-area — same parameters as tx-geo.js
  const G = window.TX_GEO;
  const proj = (function (p) {
    const r = Math.PI / 180, f1 = p.lat1 * r, f2 = p.lat2 * r, f0 = p.lat0 * r, l0 = p.lon0 * r;
    const n = (Math.sin(f1) + Math.sin(f2)) / 2, C = Math.cos(f1) * Math.cos(f1) + 2 * n * Math.sin(f1);
    const rho0 = p.R * Math.sqrt(C - 2 * n * Math.sin(f0)) / n;
    return (lon, lat) => {
      const rho = p.R * Math.sqrt(C - 2 * n * Math.sin(lat * r)) / n, th = n * (lon * r - l0);
      return [rho * Math.sin(th) / 1000, -(rho0 - rho * Math.cos(th)) / 1000];
    };
  })(G.proj);
  DATA.forEach((d) => { const p = proj(d.lon, d.lat); d._x = p[0]; d._y = p[1]; });
  const BYID = {}; DATA.forEach((d) => { BYID[d.id] = d; });
  const COUNTS = {}; DATA.forEach((d) => { if (d.co) COUNTS[d.co] = (COUNTS[d.co] || 0) + 1; });
  const COUNTY_LIST = Object.keys(COUNTS).sort((a, b) => COUNTS[b] - COUNTS[a]);

  /* ---------------- Formatting ---------------- */
  const loc = () => (D.lang === 'es' ? 'es-MX' : 'en-US');
  const fmt = {
    int: (v) => (v == null ? '—' : Math.round(v).toLocaleString(loc())),
    pct: (v) => (v == null ? '—' : v.toFixed(1) + '%'),
    usd: (v) => (v == null ? '—' : '$' + Math.round(v).toLocaleString(loc())),
    num1: (v) => (v == null ? '—' : v.toFixed(1)),
    year: (v) => (v == null ? '—' : String(Math.round(v)))
  };
  const fv = (v, f) => (fmt[f] || fmt.int)(v);
  function compact(v, f) {
    if (v == null || !isFinite(v)) return '—';
    if (f === 'usd') return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? '$' + (v / 1e3).toFixed(1) + 'k' : '$' + Math.round(v);
    if (f === 'pct') return v.toFixed(0) + '%';
    if (f === 'year') return String(Math.round(v));
    if (f === 'num1') return v.toFixed(1);
    return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : Math.round(v).toLocaleString(loc());
  }
  const titleCase = (s) => (s ? s.toLowerCase().replace(/\b(\w)/g, (c) => c.toUpperCase()) : '');
  const bucket = (v) => (v === true ? 'yes' : v === false ? 'no' : v === 'partial' ? 'partial' : 'unknown');
  const boolText = (v) => D.t(bucket(v));
  function ordinal(p) {
    if (D.lang === 'es') return 'p' + p;
    const s = p % 100 >= 11 && p % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[p % 10] || 'th');
    return p + s;
  }

  /* ---------------- Stats ---------------- */
  const SORTED = {};
  function sortedAll(k) { return SORTED[k] || (SORTED[k] = DATA.map((d) => d[k]).filter((x) => x != null && isFinite(x)).sort((a, b) => a - b)); }
  function pctile(k, v) {
    const a = sortedAll(k); if (!a.length || v == null) return null;
    let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= v) lo = m + 1; else hi = m; }
    return Math.max(1, Math.min(100, Math.round(lo / a.length * 100)));
  }
  function stats(arr) {
    const a = arr.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
    if (!a.length) return null;
    const n = a.length, mean = a.reduce((s, x) => s + x, 0) / n;
    const q = (f) => a[Math.min(n - 1, Math.floor((n - 1) * f))];
    return { n, min: a[0], max: a[n - 1], median: a[Math.floor(n / 2)], mean, sd: Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / n), p25: q(0.25), p75: q(0.75) };
  }
  function qbreaks(k) {
    const a = sortedAll(k); if (!a.length) return null;
    const q = (i) => a[Math.min(a.length - 1, Math.floor(a.length * i / 5))];
    return [a[0], q(1), q(2), q(3), q(4), a[a.length - 1]];
  }
  function classOf(v, br) {
    if (v == null || !isFinite(v) || !br) return -1;
    for (let i = 1; i < br.length; i++) if (v <= br[i]) return Math.min(i - 1, 4);
    return 4;
  }

  /* ---------------- State ---------------- */
  const S = { v: 'mhi', counties: new Set(), infra: {}, sel: null, tab: 'sum', picked: new Set(DEFAULT_PICK) };
  function passes(d) {
    if (S.counties.size && !S.counties.has(d.co)) return false;
    for (const k in S.infra) {
      const b = bucket(d[k]);
      if (S.infra[k] === 'yes' && b !== 'yes') return false;
      if (S.infra[k] === 'no' && b !== 'no' && b !== 'unknown') return false;
    }
    return true;
  }
  let FILT = DATA;

  /* ---------------- Map ---------------- */
  const svg = $('#map');
  const NS = (t, a) => D.svg(t, a);
  const gOth = NS('g'), gCty = NS('g'), gLab = NS('g'), gDots = NS('g'), gCity = NS('g'), gRing = NS('g');
  svg.append(gOth, gCty, gLab, gDots, gCity, gRing);
  G.others.forEach((o) => gOth.append(NS('path', { d: o.d, class: 'oth', 'vector-effect': 'non-scaling-stroke' })));
  G.counties.forEach((c) => gCty.append(NS('path', { d: c.d, class: 'cty', 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1 })));
  // County labels at the middle of each county's colonias (counties with 10+ colonias)
  const LABELS = COUNTY_LIST.filter((c) => COUNTS[c] >= 10).map((c) => {
    const pts = DATA.filter((d) => d.co === c);
    const x = pts.reduce((s, d) => s + d._x, 0) / pts.length, y = Math.min(...pts.map((d) => d._y));
    const t = NS('text', { x, y, 'text-anchor': 'middle', class: 'clab' }); t.textContent = c;
    gLab.append(t); return t;
  });
  const DOTS = DATA.map((d) => {
    const c = NS('circle', { cx: d._x, cy: d._y, r: 1, class: 'dot', 'vector-effect': 'non-scaling-stroke', 'stroke-width': 0.6, tabindex: '-1' });
    c.addEventListener('mousemove', (ev) => tipFor(d, ev));
    c.addEventListener('mouseleave', () => D.hideTip());
    c.addEventListener('click', () => { if (!dragMoved) openProfile(d.id); });
    gDots.append(c); return c;
  });
  const CITY_EL = CITIES.map(([n, lat, lon, url]) => {
    const p = proj(lon, lat);
    const g = NS('g', { class: 'city' });
    const c = NS('circle', { cx: p[0], cy: p[1], r: 1, 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1.4 });
    const t = NS('text', { x: p[0], y: p[1] }); t.textContent = n;
    c.addEventListener('mousemove', (ev) => D.showTip('<b>' + D.esc(n) + '</b>' + (url ? '<div class="s">' + D.esc(url.replace(/^https?:\/\//, '')) + ' ↗</div>' : ''), ev.clientX, ev.clientY));
    c.addEventListener('mouseleave', () => D.hideTip());
    if (url) c.addEventListener('click', () => { if (!dragMoved) window.open(url, '_blank', 'noopener'); });
    g.append(c, t); gCity.append(g);
    return { g, c, t, x: p[0], y: p[1] };
  });
  const ring = NS('circle', { class: 'ring', r: 1, 'vector-effect': 'non-scaling-stroke', 'stroke-width': 3, visibility: 'hidden' });
  gRing.append(ring);

  function tipFor(d, ev) {
    const v = VK[S.v];
    const val = v.type === 'bool' ? boolText(d[v.k]) : fv(d[v.k], v.fmt);
    D.showTip('<b>' + D.esc(d.n) + '</b><div class="s">' + D.esc(titleCase(d.co)) + (d.pop_est != null ? ' · ' + D.num(d.pop_est) + ' res.' : '') + '</div><div class="v">' + D.esc(val) + '</div><div class="s">' + D.esc(vl(v)) + '</div>', ev.clientX, ev.clientY);
  }

  // ---- view box, zoom and pan ----
  const ASPECT = 4 / 3;
  function fit(pts, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    let w = (x1 - x0) * (1 + pad * 2) || 40, h = (y1 - y0) * (1 + pad * 2) || 30;
    if (w / h > ASPECT) h = w / ASPECT; else w = h * ASPECT;
    w = Math.max(w, 24); h = w / ASPECT;
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
  }
  const FULL = fit(DATA.map((d) => [d._x, d._y]), 0.06);
  let view = Object.assign({}, FULL);
  function pxPerUnit() { return (svg.getBoundingClientRect().width || 800) / view.w; }
  function applyView() {
    svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].map((x) => x.toFixed(3)).join(' '));
    const k = 1 / pxPerUnit();
    const r = Math.max(3, Math.min(6, 2.8 + (FULL.w / view.w) * 0.25)) * k;
    DOTS.forEach((c) => c.setAttribute('r', r));
    ring.setAttribute('r', 11 * k);
    const showCityLabels = view.w < 420, showCities = view.w < 700;
    CITY_EL.forEach((c) => { c.g.style.display = showCities ? '' : 'none'; c.c.setAttribute('r', 3.5 * k); c.t.style.display = showCityLabels ? '' : 'none'; c.t.setAttribute('font-size', 12.5 * k); c.t.setAttribute('x', c.x + 7 * k); c.t.setAttribute('y', c.y - 6 * k); c.t.setAttribute('stroke-width', 3.5 * k); });
    // county labels: biggest counties first, skip any that would overlap one already placed
    const placed = [];
    LABELS.forEach((t) => {
      t.setAttribute('font-size', 11 * k); t.setAttribute('dy', -10 * k);
      const x = +t.getAttribute('x'), y = +t.getAttribute('y') - 10 * k, hw = t.textContent.length * 4.2 * k, hh = 8 * k;
      const hit = view.w < 120 || placed.some((b) => Math.abs(b.x - x) < b.hw + hw && Math.abs(b.y - y) < b.hh + hh);
      t.style.display = hit ? 'none' : '';
      if (!hit) placed.push({ x, y, hw, hh });
    });
  }
  let anim = null;
  function animateTo(target, ms) {
    cancelAnimationFrame(anim);
    const from = Object.assign({}, view), t0 = performance.now(), dur = ms == null ? 350 : ms;
    const step = (t) => {
      const u = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - u, 3);
      view = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyView(); if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(f, cx, cy) {
    const w = Math.max(6, Math.min(FULL.w * 1.3, view.w * f)), h = w / ASPECT;
    const fx = (cx - view.x) / view.w, fy = (cy - view.y) / view.h;
    view = { x: cx - fx * w, y: cy - fy * h, w, h }; applyView();
  }
  function clientToSvg(x, y) { const r = svg.getBoundingClientRect(); return [view.x + (x - r.left) / r.width * view.w, view.y + (y - r.top) / r.height * view.h]; }
  svg.addEventListener('wheel', (ev) => { ev.preventDefault(); D.hideTip(); const p = clientToSvg(ev.clientX, ev.clientY); zoomAt(Math.exp(ev.deltaY * 0.0015), p[0], p[1]); setRegion(null); }, { passive: false });
  const ptrs = new Map(); let dragMoved = false, last = null, pinch = null;
  svg.addEventListener('pointerdown', (ev) => { ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); dragMoved = false; last = [ev.clientX, ev.clientY]; if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); } });
  svg.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ptrs.size === 2 && pinch) {
      const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      const c = clientToSvg((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2);
      zoomAt(pinch / d, c[0], c[1]); pinch = d; dragMoved = true; setRegion(null); return;
    }
    const dx = ev.clientX - last[0], dy = ev.clientY - last[1];
    if (!dragMoved && Math.hypot(dx, dy) < 4) return;
    if (!dragMoved) { svg.setPointerCapture(ev.pointerId); svg.classList.add('dragging'); D.hideTip(); }
    dragMoved = true; last = [ev.clientX, ev.clientY];
    const k = view.w / svg.getBoundingClientRect().width;
    view.x -= dx * k; view.y -= dy * k; applyView(); setRegion(null);
  });
  const endPtr = (ev) => { ptrs.delete(ev.pointerId); if (ptrs.size < 2) pinch = null; svg.classList.remove('dragging'); setTimeout(() => { dragMoved = false; }, 0); };
  svg.addEventListener('pointerup', endPtr); svg.addEventListener('pointercancel', endPtr);
  $('#zin').addEventListener('click', () => { const c = [view.x + view.w / 2, view.y + view.h / 2]; const w = Math.max(6, view.w * 0.6); animateTo({ x: c[0] - w / 2, y: c[1] - w / ASPECT / 2, w, h: w / ASPECT }); setRegion(null); });
  $('#zout').addEventListener('click', () => { const c = [view.x + view.w / 2, view.y + view.h / 2]; const w = Math.min(FULL.w * 1.3, view.w / 0.6); animateTo({ x: c[0] - w / 2, y: c[1] - w / ASPECT / 2, w, h: w / ASPECT }); setRegion(null); });

  function regionBox(r) { return r.co ? fit(DATA.filter((d) => r.co.includes(d.co)).map((d) => [d._x, d._y]), 0.08) : FULL; }
  let REGION = 'all';
  function setRegion(id) { REGION = id; D.$$('#regions button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.r === id))); }
  function buildRegions() {
    const box = $('#regions'); box.innerHTML = '';
    REGIONS.forEach((r) => {
      const b = D.el('button', { type: 'button', 'data-r': r.id, 'aria-pressed': String(REGION === r.id), text: D.t(r.key) });
      b.addEventListener('click', () => { setRegion(r.id); animateTo(regionBox(r)); });
      box.append(b);
    });
  }

  /* ---------------- Render: map view ---------------- */
  function recolor() {
    const v = VK[S.v];
    const br = v.type === 'num' ? qbreaks(v.k) : null;
    FILT = DATA.filter(passes);
    DATA.forEach((d, i) => {
      const c = DOTS[i];
      if (!passes(d)) { c.style.display = 'none'; return; }
      c.style.display = '';
      let col;
      if (v.type === 'bool') col = BOOL[bucket(d[v.k])];
      else { const ci = classOf(d[v.k], br); col = ci < 0 ? NA : RAMP[ci]; }
      c.setAttribute('fill', col);
    });
    // legend
    const lg = $('#legend'); lg.innerHTML = '';
    lg.append(D.el('span', { class: 'label', text: vl(v) }));
    if (v.type === 'bool') ['yes', 'no', 'partial', 'unknown'].forEach((b) => lg.append(D.el('span', { class: 'sw' }, [D.el('i', { class: 'dot', style: { background: BOOL[b] } }), D.t(b)])));
    else {
      for (let i = 0; i < 5; i++) lg.append(D.el('span', { class: 'sw' }, [D.el('i', { class: 'dot', style: { background: RAMP[i] } }), compact(br[i], v.fmt) + '–' + compact(br[i + 1], v.fmt)]));
      lg.append(D.el('span', { class: 'sw' }, [D.el('i', { class: 'dot', style: { background: NA } }), D.t('noData')]));
    }
    $('#cv-desc').textContent = (D.lang === 'es' ? v.descEs : v.desc) + (v.type === 'num' ? ' ' + D.t('lighter') + (v.dir === 'good' ? ' ' + D.t('better') : v.dir === 'bad' ? ' ' + D.t('worse') : '') + '.' : '');
    $('#showing').innerHTML = D.t('showing', { n: D.num(FILT.length), t: D.num(DATA.length) });
    // KPIs
    const share = (k) => FILT.length ? FILT.filter((d) => d[k] === true).length / FILT.length * 100 : null;
    const kp = $('#kpis'); kp.innerHTML = '';
    [[D.num(FILT.length), 'kCol'], [D.num(FILT.reduce((s, d) => s + (d.pop_est || 0), 0)), 'kRes'], [fv(share('water'), 'pct'), 'kWater'], [fv(share('sewer'), 'pct'), 'kSewer'], [fv(share('paved'), 'pct'), 'kPaved'], [fv(share('flood'), 'pct'), 'kFlood']]
      .forEach(([v2, k]) => kp.append(D.el('div', { class: 'kpi' }, [D.el('div', { class: 'big', text: v2 }), D.el('div', { class: 'l', text: D.t(k) })])));
    $('#kpi-note').textContent = D.t('kNote');
    renderAnalysis();
  }
  function buildControls() {
    // variable select
    const sel = $('#v'); sel.innerHTML = '';
    CATS.forEach(([c]) => {
      const og = D.el('optgroup', { label: catL(c).toUpperCase() });
      VARS.filter((v) => v.cat === c).forEach((v) => og.append(D.el('option', { value: v.k, text: vl(v), selected: v.k === S.v })));
      sel.append(og);
    });
    // category chips
    const cats = $('#cats'); cats.innerHTML = '';
    CATS.forEach(([c]) => {
      const b = D.el('button', { type: 'button', class: 'tag', 'aria-pressed': String(VK[S.v].cat === c), text: catL(c) });
      b.addEventListener('click', () => { const first = VARS.find((v) => v.cat === c); setVar(first.k); });
      cats.append(b);
    });
    // counties
    const cb = $('#counties'); cb.innerHTML = '';
    COUNTY_LIST.forEach((c) => {
      const b = D.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.counties.has(c)) }, [titleCase(c), D.el('span', { class: 'ct', text: COUNTS[c] })]);
      b.addEventListener('click', () => { if (S.counties.has(c)) S.counties.delete(c); else S.counties.add(c); b.setAttribute('aria-pressed', String(S.counties.has(c))); recolor(); });
      cb.append(b);
    });
    // infra
    const ib = $('#infra'); ib.innerHTML = '';
    [['water', 'yes', 'fWaterY'], ['water', 'no', 'fWaterN'], ['sewer', 'yes', 'fSewerY'], ['sewer', 'no', 'fSewerN'], ['paved', 'yes', 'fPavedY'], ['paved', 'no', 'fPavedN'], ['flood', 'yes', 'fFlood'], ['inadeq', 'yes', 'fInadeq']].forEach(([k, want, key]) => {
      const b = D.el('button', { type: 'button', class: 'chip', 'aria-pressed': String(S.infra[k] === want), text: D.t(key), 'data-k': k, 'data-w': want });
      b.addEventListener('click', () => {
        if (S.infra[k] === want) delete S.infra[k]; else S.infra[k] = want;
        D.$$('#infra .chip').forEach((x) => x.setAttribute('aria-pressed', String(S.infra[x.dataset.k] === x.dataset.w)));
        recolor();
      });
      ib.append(b);
    });
    $('#s').setAttribute('placeholder', D.t('searchPh', { n: D.num(DATA.length) }));
    $('#lede').textContent = D.t('lede', { n: D.num(DATA.length), p: D.num(Math.round(DATA.reduce((s, d) => s + (d.pop_est || 0), 0) / 100) * 100) });
    buildRegions();
  }
  function setVar(k) { S.v = k; $('#v').value = k; D.$$('#cats .tag').forEach((b, i) => b.setAttribute('aria-pressed', String(CATS[i][0] === VK[k].cat))); recolor(); writeHash(); }
  $('#v').addEventListener('change', (ev) => setVar(ev.target.value));
  $('#reset').addEventListener('click', () => { S.counties.clear(); S.infra = {}; buildControls(); recolor(); });

  /* ---------------- Search ---------------- */
  const sIn = $('#s'), hits = $('#hits');
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let hi = -1;
  sIn.addEventListener('input', () => {
    const q = norm(sIn.value.trim()); hits.innerHTML = ''; hi = -1;
    if (!q) { hits.classList.remove('open'); sIn.setAttribute('aria-expanded', 'false'); return; }
    const m = DATA.filter((d) => norm(d.n).includes(q)).slice(0, 40);
    m.forEach((d) => {
      const b = D.el('button', { type: 'button', role: 'option' }, [D.el('span', { text: d.n }), D.el('span', { class: 'sub', text: titleCase(d.co) })]);
      b.addEventListener('mousedown', (ev) => { ev.preventDefault(); sIn.value = ''; hits.classList.remove('open'); openProfile(d.id); });
      hits.append(b);
    });
    hits.classList.toggle('open', m.length > 0); sIn.setAttribute('aria-expanded', String(m.length > 0));
  });
  sIn.addEventListener('keydown', (ev) => {
    const items = D.$$('button', hits);
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); hi = Math.max(0, Math.min(items.length - 1, hi + (ev.key === 'ArrowDown' ? 1 : -1))); items.forEach((b, i) => b.classList.toggle('active', i === hi)); }
    else if (ev.key === 'Enter') { const b = items[hi >= 0 ? hi : 0]; if (b) b.dispatchEvent(new MouseEvent('mousedown')); }
    else if (ev.key === 'Escape') { hits.classList.remove('open'); }
  });
  sIn.addEventListener('blur', () => setTimeout(() => hits.classList.remove('open'), 150));

  /* ---------------- Analysis ---------------- */
  function numOptions(sel, chosen) {
    sel.innerHTML = '';
    CATS.forEach(([c]) => {
      const vs = NUMV.filter((v) => v.cat === c); if (!vs.length) return;
      const og = D.el('optgroup', { label: catL(c).toUpperCase() });
      vs.forEach((v) => og.append(D.el('option', { value: v.k, text: vl(v), selected: v.k === chosen })));
      sel.append(og);
    });
  }
  function buildAnalysis() {
    const pl = $('#picklist'); pl.innerHTML = '';
    CATS.forEach(([c]) => {
      const vs = NUMV.filter((v) => v.cat === c); if (!vs.length) return;
      pl.append(D.el('h4', { text: catL(c) }));
      vs.forEach((v) => {
        const cb = D.el('input', { type: 'checkbox', checked: S.picked.has(v.k) });
        cb.addEventListener('change', () => { if (cb.checked) S.picked.add(v.k); else S.picked.delete(v.k); renderAnalysis(); });
        pl.append(D.el('label', {}, [cb, vl(v)]));
      });
    });
    numOptions($('#tb-var'), $('#tb-var').value || 'mhi');
    numOptions($('#x-var'), $('#x-var').value || 'elhs');
    numOptions($('#y-var'), $('#y-var').value || 'mhi');
    numOptions($('#co-var'), $('#co-var').value || 'mhi');
  }
  ['#tb-var', '#tb-n', '#x-var', '#y-var', '#co-var'].forEach((s) => $(s).addEventListener('change', renderAnalysis));
  D.$$('#an-tabs button').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.t; renderAnalysis(); }));
  function renderAnalysis() {
    D.$$('#an-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === S.tab)));
    ['sum', 'tb', 'cor', 'co'].forEach((t) => { $('#an-' + t).hidden = S.tab !== t; });
    $('#an-note').textContent = D.t('anNote', { n: D.num(FILT.length) });
    const rows = FILT;
    if (S.tab === 'sum') {
      const tbl = $('#sum-table'); tbl.innerHTML = '';
      if (!S.picked.size) { tbl.append(D.el('tbody', {}, [D.el('tr', {}, [D.el('td', { class: 'muted', text: D.t('pickSome') })])])); return; }
      tbl.append(D.el('thead', {}, [D.el('tr', {}, ['thVar', 'thN', 'thMin', 'thP25', 'thMed', 'thMean', 'thP75', 'thMax', 'thSd'].map((k, i) => D.el('th', { class: i ? 'n' : '', text: D.t(k) })))]));
      const tb = D.el('tbody');
      NUMV.filter((v) => S.picked.has(v.k)).forEach((v) => {
        const s = stats(rows.map((d) => d[v.k])); const f = (x) => compact(x, v.fmt);
        tb.append(D.el('tr', {}, [D.el('td', { text: vl(v) })].concat(s ? [D.num(s.n), f(s.min), f(s.p25), f(s.median), f(s.mean), f(s.p75), f(s.max), f(s.sd)].map((x) => D.el('td', { class: 'n', text: x })) : [D.el('td', { class: 'n', colspan: 8, text: '—' })])));
      });
      tbl.append(tb);
    } else if (S.tab === 'tb') {
      const k = $('#tb-var').value, v = VK[k], n = +$('#tb-n').value;
      const f = rows.filter((d) => d[k] != null && isFinite(d[k])).sort((a, b) => b[k] - a[k]);
      const list = (items, top) => D.el('ol', {}, items.map((d, i) => {
        const b = D.el('button', { type: 'button' }, [D.el('span', { class: 'rk', text: '#' + (top ? i + 1 : f.length - i) }), D.el('span', { class: 'nm' }, [d.n, D.el('span', { class: 'co', text: titleCase(d.co) })]), D.el('span', { class: 'vv', text: compact(d[k], v.fmt) })]);
        b.addEventListener('click', () => openProfile(d.id));
        return D.el('li', {}, [b]);
      }));
      const box = $('#tb'); box.innerHTML = '';
      box.append(D.el('div', {}, [D.el('h3', { class: 'label', style: { margin: '0 0 8px' }, text: D.t('highest') + ' · ' + vl(v) }), list(f.slice(0, n), true)]),
        D.el('div', {}, [D.el('h3', { class: 'label', style: { margin: '0 0 8px' }, text: D.t('lowest') + ' · ' + vl(v) }), list(f.slice(-n).reverse(), false)]));
    } else if (S.tab === 'cor') {
      drawScatter(rows);
    } else {
      const k = $('#co-var').value, v = VK[k];
      const groups = {}; rows.forEach((d) => { if (d.co) (groups[d.co] = groups[d.co] || []).push(d[k]); });
      const list = Object.keys(groups).map((co) => ({ co, n: groups[co].length, s: stats(groups[co]) })).sort((a, b) => ((b.s && b.s.median) ?? -Infinity) - ((a.s && a.s.median) ?? -Infinity));
      const f = (x) => (x == null ? '—' : compact(x, v.fmt));
      const tbl = $('#co-table'); tbl.innerHTML = '';
      tbl.append(D.el('thead', {}, [D.el('tr', {}, ['thCounty', 'thCol', 'thWith', 'thMed', 'thMean', 'thMin', 'thMax'].map((key, i) => D.el('th', { class: i ? 'n' : '', text: D.t(key) })))]));
      tbl.append(D.el('tbody', {}, list.map((r) => D.el('tr', {}, [D.el('td', { text: titleCase(r.co) }), D.el('td', { class: 'n', text: D.num(r.n) }), D.el('td', { class: 'n', text: r.s ? D.num(r.s.n) : '0' })].concat([r.s && r.s.median, r.s && r.s.mean, r.s && r.s.min, r.s && r.s.max].map((x) => D.el('td', { class: 'n', text: f(x) })))))));
    }
  }
  function drawScatter(rows) {
    const xk = $('#x-var').value, yk = $('#y-var').value, xv = VK[xk], yv = VK[yk];
    const sc = $('#scatter'); sc.innerHTML = '';
    const W = Math.max(320, Math.round(sc.getBoundingClientRect().width) || 700), H = W < 500 ? 300 : 380, L = 64, B = 44, T = 12, R = 16;
    sc.setAttribute('viewBox', '0 0 ' + W + ' ' + H); sc.setAttribute('height', H);
    const pts = rows.filter((d) => d[xk] != null && d[yk] != null && isFinite(d[xk]) && isFinite(d[yk]));
    if (pts.length < 2) { $('#r-out').textContent = 'r = —'; return; }
    const xs = pts.map((d) => d[xk]), ys = pts.map((d) => d[yk]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const iw = W - L - R, ih = H - T - B;
    const sx = (x) => L + (x - x0) / (x1 - x0 || 1) * iw, sy = (y) => T + ih - (y - y0) / (y1 - y0 || 1) * ih;
    const g = D.svg('g', { 'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#9A9288' });
    g.append(D.svg('line', { x1: L, y1: T + ih, x2: L + iw, y2: T + ih, stroke: '#57524A' }), D.svg('line', { x1: L, y1: T, x2: L, y2: T + ih, stroke: '#57524A' }));
    const txt = (x, y, s, a, extra) => { const t = D.svg('text', Object.assign({ x, y, 'text-anchor': a }, extra || {})); t.textContent = s; g.append(t); };
    txt(L, T + ih + 16, compact(x0, xv.fmt), 'start'); txt(L + iw, T + ih + 16, compact(x1, xv.fmt), 'end');
    txt(L - 6, T + ih, compact(y0, yv.fmt), 'end'); txt(L - 6, T + 8, compact(y1, yv.fmt), 'end');
    txt(L + iw / 2, H - 6, vl(xv), 'middle', { fill: '#C8C0B5', 'font-family': 'Hanken Grotesk, sans-serif', 'font-size': 12 });
    const yt = D.svg('text', { transform: 'translate(14 ' + (T + ih / 2) + ') rotate(-90)', 'text-anchor': 'middle', fill: '#C8C0B5', 'font-family': 'Hanken Grotesk, sans-serif', 'font-size': 12 }); yt.textContent = vl(yv); g.append(yt);
    pts.forEach((d) => {
      const c = D.svg('circle', { cx: sx(d[xk]).toFixed(1), cy: sy(d[yk]).toFixed(1), r: 2.6, fill: '#5DA0B1', 'fill-opacity': 0.75, style: 'cursor:pointer' });
      c.addEventListener('mousemove', (ev) => D.showTip('<b>' + D.esc(d.n) + '</b><div class="s">' + D.esc(vl(xv)) + ': ' + fv(d[xk], xv.fmt) + '<br>' + D.esc(vl(yv)) + ': ' + fv(d[yk], yv.fmt) + '</div>', ev.clientX, ev.clientY));
      c.addEventListener('mouseleave', () => D.hideTip());
      c.addEventListener('click', () => openProfile(d.id));
      g.append(c);
    });
    sc.append(g);
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
    const r = dx && dy ? num / Math.sqrt(dx * dy) : 0, ar = Math.abs(r);
    $('#r-out').innerHTML = 'r = <b>' + (r > 0 ? '+' : '') + r.toFixed(3) + '</b> · ' + D.t(ar > 0.7 ? 'rStrong' : ar > 0.4 ? 'rMod' : ar > 0.2 ? 'rWeak' : 'rVWeak') + ' ' + D.t(r >= 0 ? 'rPos' : 'rNeg') + ' · n = ' + D.num(n);
  }

  /* ---------------- Profile ---------------- */
  const locSvg = $('#loc');
  function renderProfile() {
    const d = BYID[S.sel];
    if (!d) { $('#error').hidden = false; $('#error').textContent = D.t('notFound'); S.sel = null; return render(); }
    $('#error').hidden = true;
    $('#crumb-col').textContent = ' / ' + d.n;
    $('#p-eyebrow').textContent = D.t('pEyebrow', { c: titleCase(d.co), id: d.id });
    $('#p-name').textContent = d.n;
    $('#p-sub').textContent = d.pop_est != null ? D.t('pSub', { p: D.num(d.pop_est), t: D.num(d.pop), near: d.city ? D.t('near', { c: titleCase(d.city) }) : '' }) : D.t('popUnknown');
    // locator: same base map, zoomed to ~70 km around the colonia
    locSvg.innerHTML = '';
    const w = 70, h = w / ASPECT;
    locSvg.setAttribute('viewBox', [d._x - w / 2, d._y - h / 2, w, h].join(' '));
    locSvg.setAttribute('aria-label', d.n + ', ' + titleCase(d.co) + ' County');
    const k = w / (locSvg.getBoundingClientRect().width || 500);
    G.counties.forEach((c) => locSvg.append(D.svg('path', { d: c.d, fill: '#35312C', stroke: '#57524A', 'vector-effect': 'non-scaling-stroke' })));
    DATA.forEach((o) => { if (Math.abs(o._x - d._x) < w && Math.abs(o._y - d._y) < h) locSvg.append(D.svg('circle', { cx: o._x, cy: o._y, r: 3.2 * k, fill: o === d ? '#E5912A' : '#5DA0B1', 'fill-opacity': o === d ? 1 : 0.6 })); });
    CITY_EL.forEach((c, i) => {
      if (Math.abs(c.x - d._x) > w / 2 || Math.abs(c.y - d._y) > h / 2) return;
      locSvg.append(D.svg('circle', { cx: c.x, cy: c.y, r: 3.5 * k, fill: '#1C1B1A', stroke: '#F7F3EC', 'stroke-width': 1.4 * k }));
      const t = D.svg('text', { x: c.x + 7 * k, y: c.y - 6 * k, 'font-size': 12.5 * k, fill: '#F7F3EC', 'font-family': 'Hanken Grotesk, sans-serif', 'font-weight': 600, 'paint-order': 'stroke', stroke: '#1C1B1A', 'stroke-width': 3.5 * k }); t.textContent = CITIES[i][0]; locSvg.append(t);
    });
    locSvg.append(D.svg('circle', { cx: d._x, cy: d._y, r: 11 * k, fill: 'none', stroke: '#E5912A', 'stroke-width': 3 * k }));
    // infrastructure
    const inf = $('#p-infra'); inf.innerHTML = '';
    ['water', 'sewer', 'paved', 'trash', 'platted', 'flood', 'inadeq', 'clinic'].forEach((key) => {
      const b = bucket(d[key]); const badIfYes = key === 'flood' || key === 'inadeq';
      const good = badIfYes ? b === 'no' : b === 'yes', bad = badIfYes ? b === 'yes' : b === 'no';
      const bg = good ? '#357F93' : bad ? '#A65D0F' : b === 'partial' ? '#57524A' : '#3D3934';
      const sym = good ? '✓' : bad ? '✕' : b === 'partial' ? '½' : '?';
      inf.append(D.el('div', { class: 'infra-row' }, [D.el('span', { class: 'ic', style: { background: bg }, text: sym, 'aria-hidden': 'true' }), D.el('span', { class: 'lb', text: vl(VK[key]) }), D.el('span', { class: 'vl', text: boolText(d[key]) })]));
    });
    // comparisons
    const cmp = $('#p-cmp'); cmp.innerHTML = '';
    const coRows = DATA.filter((o) => o.co === d.co);
    DEFAULT_PICK.forEach((k2) => {
      const v = VK[k2]; const x = d[k2]; const p = pctile(k2, x);
      const cs = stats(coRows.map((o) => o[k2])); const cmed = cs ? cs.median : null; const cp = pctile(k2, cmed);
      cmp.append(D.el('div', { class: 'cmp' }, [
        D.el('span', { class: 'lb', text: vl(v) }), D.el('span', { class: 'vl', text: fv(x, v.fmt) }),
        D.el('span', { class: 'tr' }, [D.el('span', { class: 'ax' }), cp == null ? null : D.el('span', { class: 'md', style: { left: cp + '%' } }), p == null ? null : D.el('span', { class: 'pin', style: { left: p + '%' } })]),
        D.el('span', { class: 'pc', text: p == null ? '—' : ordinal(p) }), D.el('span', { class: 'cm', text: D.t('countyMed', { v: fv(cmed, v.fmt) }) })
      ]));
    });
    // all variables
    const all = $('#p-all'); all.innerHTML = '';
    CATS.forEach(([c]) => {
      const vs = NUMV.filter((v) => v.cat === c); if (!vs.length) return;
      all.append(D.el('h3', { class: 'label', style: { margin: '14px 0 0' }, text: catL(c) }));
      all.append(D.el('div', { class: 'kvgrid' }, vs.map((v) => D.el('div', {}, [D.el('div', { class: 'k', text: vl(v) }), D.el('div', { class: 'v', text: fv(d[v.k], v.fmt) })]))));
    });
    all.append(D.el('h3', { class: 'label', style: { margin: '14px 0 0' }, text: D.t('coCtx') }));
    all.append(D.el('div', { class: 'kvgrid' }, [D.el('div', {}, [D.el('div', { class: 'k', text: D.t('coMhi') }), D.el('div', { class: 'v', text: fv(d.co_mhi, 'usd') })]), D.el('div', {}, [D.el('div', { class: 'k', text: D.t('coPci') }), D.el('div', { class: 'v', text: fv(d.co_pci, 'usd') })])]));
  }
  function openProfile(id) { S.sel = id; render(); window.scrollTo(0, 0); }
  $('#back').addEventListener('click', (ev) => { ev.preventDefault(); const d = BYID[S.sel]; S.sel = null; render(); if (d) { animateTo({ x: d._x - 30, y: d._y - 22.5, w: 60, h: 45 }, 0); ring.setAttribute('cx', d._x); ring.setAttribute('cy', d._y); ring.setAttribute('visibility', 'visible'); } });
  $('#crumb-home').addEventListener('click', (ev) => { ev.preventDefault(); S.sel = null; render(); });
  $('#go-analysis').addEventListener('click', (ev) => { ev.preventDefault(); if (S.sel) { S.sel = null; render(); } $('#analysis').scrollIntoView({ behavior: 'smooth' }); });

  /* ---------------- Root ---------------- */
  function writeHash() { const h = new URLSearchParams(); if (S.sel) h.set('c', S.sel); else h.set('v', S.v); history.replaceState(null, '', '#' + h.toString()); }
  function readHash() { const h = new URLSearchParams(location.hash.slice(1)); if (VK[h.get('v')]) S.v = h.get('v'); S.sel = h.get('c') || null; }
  function render() {
    D.hideTip();
    $('#view-map').hidden = !!S.sel;
    $('#view-profile').hidden = !S.sel;
    $('#go-analysis').hidden = !!S.sel;
    $('h1.title[data-i18n="titleLong"]').hidden = !!S.sel; $('#lede').hidden = !!S.sel;
    if (S.sel) renderProfile(); else { $('#crumb-col').textContent = ''; requestAnimationFrame(applyView); }
    writeHash();
  }
  D.onLang(() => { buildControls(); buildAnalysis(); recolor(); render(); });
  window.addEventListener('hashchange', () => { readHash(); render(); });
  let rz = null; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { applyView(); if (S.tab === 'cor') renderAnalysis(); }, 150); });

  function boot() {
    if (!DATA.length || !G) { $('#error').hidden = false; $('#error').textContent = 'Data files are missing (data/colonias-data.js, tx-geo.js).'; return; }
    readHash();
    buildControls(); buildAnalysis(); recolor();
    applyView();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
