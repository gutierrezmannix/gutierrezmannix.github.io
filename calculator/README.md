# GM26.1 statistics calculator

`index.html` is the whole calculator: one self-contained page that runs entirely in the browser, works offline
and from a downloaded copy. It is a **build output** — edit the sources below, never `index.html` itself.

## Build and test

```sh
python3 calculator/tools/build.py            # writes index.html, version.json and src/app/*
python3 calculator/tools/build.py --check    # exit 1 if index.html is not what the sources produce
node --test calculator/tests/*.test.mjs      # unit and component tests (includes the --check above)
Rscript calculator/tests/regression-numerics-reference.R   # regenerate the regression references (see REGRESSION.md)
Rscript calculator/tests/descriptives-reference.R   # regenerate the descriptives references (see DESCRIPTIVES.md)
NODE_PATH=$(npm root -g) node calculator/tests/chart-builder-e2e.cjs   # browser tests (Playwright), also *-e2e.cjs (map-lab-e2e.cjs: maps; compare-means-e2e.cjs: t-tests and the correlation matrix; regression-e2e.cjs: regression; descriptives-e2e.cjs: the descriptives tab; file-menu-e2e.cjs: the start page and File menu, see FILE-MENU.md; settings-e2e.cjs: Settings, see SETTINGS.md)
```

## Where the code lives

| Path | What it is |
| --- | --- |
| `src/app/component.js` | The page logic (one React class component). |
| `src/app/template.html` | The page template; the component goes in at `@@COMPONENT@@`. |
| `src/app/engine.mjs` | Statistics, file parsing and chart drawing. |
| `src/app/page.html`, `assets.json`, `embedded/`, `ext_resources.json` | The outer page and its loader, and the embedded fonts, React and world map. |
| `src/*.js`, `src/*.mjs`, `src/*.css` | Feature modules. `tools/*.py` copy each one into its block marked `GM26 … begin` / `GM26 … end` in `src/app/`. |
| `src/engine/**/*.mjs` | The Tests ▾ analysis engine, validated against R (`tools/engine/`, `tests/engine/`). |
| `src/maps/*.json.gz` | Built-in maps (every country's first level; Mexico's states and municipalities), made by `tools/maps/` and embedded by `tools/build.py`. See `MAPS.md`. |
| `tools/build.py` | Runs every integrator, writes the result back to `src/app/` and packs `index.html`. |

Change code outside the marked blocks directly in `src/app/`. Change code inside a block in the module it
names, because the next build copies the module over the block. `src/app/` always shows exactly what the page
runs, so a change to the calculator is reviewable as an ordinary diff.

# Explicit time-series setup

The time-series preparation module is maintained in `src/time-series-setup.mjs`, and its setup controls in
`src/time-series-controls.html`. Test:

```sh
node calculator/tests/time-series.test.mjs
```

An optional local integration test uses a supplied Stata fixture without adding
the dataset to this repository:

```sh
GM26_TEST_DTA=/absolute/path/to/incidencia_1997_2025.dta \
  node calculator/tests/time-series.test.mjs
```

## Behavior

- Existing numeric calendar dates or year + month/quarter columns; declared
  annual, quarterly, monthly, weekly, daily, or integer-period frequencies.
- Original frequency retained by default. Coarser periods require an explicit
  sum, mean, or population-rate rule.
- A measurement/source filter selects one version using stored codes while
  displaying value labels. Alternative measurements are never automatically
  merged, averaged, or deleted.
- Unit–period uniqueness is checked before aggregation, including records with
  missing outcomes. Invalid dates and missing unit identifiers require correction
  or an explicit filter.
- Calendar aggregations require complete observed periods. Incomplete periods
  remain missing; population rates require a positive period-level denominator
  that is constant across contributing subperiods.
- Gaps are preserved. The current time-series estimator requires a contiguous
  observed range; it blocks unsupported gaps instead of treating separated rows
  as adjacent periods. No implicit interpolation or zero filling occurs.
- Monthly/quarterly/daily interventions and period limits accept calendar dates.
  Differing intervention dates across pooled units require a separate design;
  the tool directs users to a common-date subset or separate estimates.
- Preparation, filters, transformations, centered time, intervention terms and
  model specifications are included in logged/exported Stata and R scripts.
  Each analysis preserves/restores the original data in Stata and uses a local
  copy in R. Source data are not changed by preparing the series.
- Existing linear segmented models remain unweighted. The summary makes this
  explicit. Adding count-family estimators or automatic seasonality selection is
  outside this setup change.

The tests cover calendar encoding, duplicate measurements, structural missingness,
incomplete periods, sums/means/rates, denominator validation, gap rejection,
segmented-model coefficients, generated scripts and bundled component syntax.
