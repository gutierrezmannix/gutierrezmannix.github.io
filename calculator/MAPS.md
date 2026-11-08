# Maps (Charts → Map) — build 2026-11-01.57

There used to be two map pages: a world map, and a page where you uploaded your own boundary file. They are now one
**Map** page for people who have never made a map. Everything is built in and works without internet:

- the world and its regions;
- the states, provinces or regions of every country (197 countries, about 3,200 areas);
- Mexico's 32 states and 2,475 municipalities, with INEGI codes.

## How it works

The page has three steps.

1. **Where.** Choose a country and its areas (for example Mexico: *States · 32* or *Municipalities · 2,475*), the world
   (or Africa, Europe, Asia, USA & Canada, Latin America, Oceania), or your own boundary file. For municipalities you
   can choose *Only in* one state.
2. **Your data.** When the page opens, it looks at every column and picks the one that names or codes the place, and
   the map that fits it. A sentence says what it found, for example: *32 of 32 values of ent recognised as Mexico's
   states (INEGI codes)*. Anything it cannot recognise is listed in a table with a place list for each value. You
   pick the place once, or paste a list of codes and names from the survey's codebook. Choose *Each value is: a
   group of areas* when one number means several areas, such as a survey region. The group gets one value, and no
   borders are drawn inside it.
3. **What to show.** The % equal to 1, the mean, median or total of a variable, or the number of rows. You can use the
   survey weight and choose a year (*Latest* by default, or all years together). The rows in use (the IF subgroup)
   apply. If a column such as `factor`, `fac_hog` or `peso` looks like the survey weight and none is set, the page
   offers *Use factor as the weight* in one click.

The map redraws as you change anything. Below it are:

- **downloads:** PNG at 150, 300 or 600 dpi, and SVG;
- **Data behind the map**, with a copy button;
- **Customize:**
  - **Colors:** the same number of areas per color (quantiles), equal steps, natural groups (Fisher–Jenks), a smooth
    scale, or your own cut points; 3–7 colors; schemes (chart color, blues, oranges, purples, reds, grays for
    printing, two-sided); darkest for the lowest values.
  - **Labels:** title, subtitle, source line and legend title; area names and/or values on the map; number format
    and decimals.
  - **Map:** state borders over municipalities, far-away parts in boxes, the small-sample threshold, size and text
    size.

### How places are matched

- **Official codes**, in any common form:
  - INEGI state codes 01–32 (`28` = Tamaulipas, `24` = San Luis Potosí);
  - INEGI municipality keys of 5 digits (`14039` = Guadalajara) or 9 digits with the locality (`090070000` =
    Iztapalapa), with or without the leading zero;
  - US FIPS state codes;
  - ISO 3166-2 codes (`MX-JAL`, `DE-BY`, `JP-27`);
  - for the world, ISO codes, UN numbers and LAPOP country codes.
- **Names**:
  - accents, upper or lower case, and words like *Estado de* or *Province* do not matter;
  - names in other languages from Natural Earth (*Bayern = Bavaria = Baviera = Bavière*, *Khovd = Hovd = Kobdo*);
  - common Mexican forms (CDMX, D.F., Distrito Federal, Edomex, Coahuila, Michoacán, Veracruz, Q. Roo…);
  - close spellings (*Chihuahau*), only when one area is clearly closest; these are marked *close spelling*.
- **Value labels** of a number variable are used when present.
- **A survey's own numbers are never taken for official codes.** A set of numbers is read as codes only when at least
  80% of them are codes of the chosen map. Otherwise none are used, and the page says why. For example, a survey's
  regions 1–10 for Mongolia would match only `1` as Ulaanbaatar's ISO code MN-1, and silently put the wrong numbers on
  the map.
- **Names picked by hand for numbers are saved as value labels**, in the same way as Stata's
  `label define region_lb 1 "Uvs", modify` (the command is logged in the Console). Tables and charts then show the
  names too, and they are remembered the next time a file has a column with the same name.

### Small samples

Each area shows its number of observations (*n*) when you hover over it, and in the data table. When the data has
several rows per area, areas with fewer than 30 observations are hatched: *value not reliable*. You can change the
threshold. For municipalities the page also says that surveys are usually designed for state or national results. In
the CONEVAL file (25,643 rows), most municipalities have very few people, and many have none.

### Drawing

- **Projections:** each country is drawn with a Lambert azimuthal equal-area projection centered on it, so areas keep
  their true relative size. The world uses Natural Earth I. A boundary file in flat coordinates (for example INEGI's
  Lambert files) is drawn as it is.
- **Far-away parts:** these are found automatically. Pieces that touch or nearly touch form the main body. The group
  with the most areas is chosen, so the lower 48 US states are the main body, not Alaska's mainland, which is the
  largest single piece. Island chains (Indonesia, the Philippines, Greece) and nearby islands (the Balearics,
  Corsica) stay in place, and so does a large part of the country (Malaysian Borneo). Whole areas that are far away
  go into boxes: Alaska, Hawaii and Puerto Rico, the Canary Islands, the Azores and Madeira, the Galápagos.
- **Borders:** each border is drawn once. Lines between areas are white. State borders are dark over municipalities.
  The outline is gray.

## Where the boundaries come from

| Map | Source | License |
|---|---|---|
| World | Natural Earth 110m (world-atlas) | Public domain |
| States and provinces of every country | geoBoundaries gbOpen ADM1 (wmgeolab.org), simplified for whole-country maps | Per country: mostly CC BY 4.0, ODbL or public domain (see geoBoundaries' metadata). The map's source line credits geoBoundaries. |
| Names in other languages, HASC and FIPS codes | Natural Earth admin-1 (10m) | Public domain |
| Mexico: states and municipalities | INEGI Marco Geoestadístico 2023 (as published by CONABIO, via PhantomInsights/mexico-geojson), simplified to about 400 m | INEGI free-use terms, with credit (*Boundaries: INEGI 2023*) |

Sizes in the page:

- every country's first level: 673 KB;
- Mexico's states and municipalities: 324 KB.

Both load only when the Map page is opened. The page grew from 4.3 to 5.7 MB.

**Not yet built in:** second levels outside Mexico (for example US counties, French départements, Mongolian soums).
The plan is to prepare each country's file and offer it as a one-click download that stays on the computer. Until
then, load such a file as *My own boundary file*.

## Files

| File | What it holds |
|---|---|
| `src/map-lab.mjs` | Engine: TopoJSON and GeoJSON geometry, projections, layout and insets, color classes, drawing (as the chart builder's `map` kind), and matching (`mlMatch`, `mlNorm`, the Mexican alternate names). |
| `src/map-lab.js` | The Map page: loading the built-in maps, finding the place column, the matching table, pasted lists, groups, value labels, the values per area, and Customize. |
| `src/map-lab.css` | Styles. |
| `src/maps/adm1.json.gz`, `src/maps/mex.json.gz` | The built-in maps, made by `tools/maps/` (see its README). |
| `tools/map_lab.py` | Puts the page into the app. The engine is added by `tools/chart_builder.py`. `tools/build.py` embeds `src/maps/*.json.gz` as modules the page loads with `import()`. |

## Tests

`tests/map-lab.test.mjs` checks:

- **The built-in maps:** every country's first level, and all 2,475 INEGI municipality keys unique.
- **Matching:**
  - INEGI codes in every form (`14039`, `090070000`, `9007`);
  - names, other languages and close spellings;
  - the Mongolia case: numbers 1–10 are not taken for codes, then are placed by hand and from a pasted list, saved
    as value labels, and the mean per province is correct.
- **Groups:** groups of areas.
- **A CONEVAL-like file:**
  - `ent` is found as Mexico's states, and % in poverty is chosen;
  - the 2022 weighted value for Tamaulipas equals a direct count, both by year and for all years together;
  - municipalities from `ubica_geo`, with state borders, and only Jalisco.
- **Other countries and the world:** Germany found from *Bavaria/Baviera*; US FIPS numbers with Alaska in a box; the
  world and Latin America.
- **Boundary files:** a GeoJSON boundary file and the older boundary page's saved settings.
- **Drawing:** color classes, and the hatching of small samples.

`tests/map-lab-e2e.cjs` runs in a real browser with no internet:

- it opens the Map page from the gallery with a CONEVAL file (`GM26_MAP_DTA=` for a real one, otherwise a generated
  one);
- it uses the weight in one click;
- it draws states, then municipalities with state borders, then Jalisco only with area names;
- it changes colors and downloads a PNG;
- it checks phone width;
- it matches a Mongolia file whose regions are coded 1–10, by hand and with a pasted list.

With the real `coneval.dta`, the state values were checked against a direct weighted count: 2022 poverty is 31.60% in
Tamaulipas, 29.84% in San Luis Potosí and 19.83% in Ciudad de México.

## Build .97 — Nothing is picked by itself (large files)

On first visit, the Map page used to guess the place column. To do that it read every row of every column that might
name a place, building a label for each row. On a Stata file with 1.5 million rows and 1,000 coded questions that took
more memory than the tab had, and the page crashed. Its Year list also made a full numeric copy of every column (about
12 GB on that file).

What happens now:

- The page waits for you to pick **Which column says the place?**. Columns named like places (ent, municipio, ubica_geo,
  país, country, state…) are listed first, judged by their names only.
- Picking a column reads only that column to find the map it fits: Mexico's states or municipalities, the world, or
  another country's provinces by name. Once you have chosen the map yourself (country, areas, world), picking a column
  keeps your choice.
- You also pick the variable to show; there is no automatic "% in poverty".
- The Year list reads the column profile only.
- Measured in Chromium on 1.5 million rows × 1,000 variables (1.6 GB .dta):
  - opening Maps takes 2 s;
  - picking `ent` takes 1.3 s and finds 32 of 32 states;
  - drawing the mean of a number takes 0.9 s, and the % of a coded question 3 s;
  - memory stays at about 8 GB, the same as with the file just open. Before this build, the page crashed.
