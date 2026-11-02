# Search boxes for variables — build 2026-11-02.70

Every box that picks a variable can be typed into, lists all the variables, and shows their labels. This covers the
Charts tab, Regression, Analysis suite, Time series, Maps, Compare means, Edit data, Settings and the predictor
pickers. Before this build, many of them were plain drop-downs (`<select>`): with 1,624 LAPOP variables there was no
way to type "aprobacion" and find d5.

## Two kinds of box, one behaviour

- **`tlSelect` → `tlCombo`** (`src/text-lab-ui.js`, styles in `src/text-lab.css`). Any `tlSelect` whose options are
  mostly variable names, or that has more than 12 options, becomes a search box (`role="combobox"`). `extra.native`
  keeps a plain drop-down for short fixed lists (e.g. Mean / Median).
  - Each row shows the name and the label, plus a count for variables with data in under 90% of the rows ("203 rows").
  - **Search:** name, label and text, accents ignored.
  - **Ranking:** exact name → name starts with → label starts with → contains.
  - **Keyboard:** ↑ ↓, PgUp / PgDn, Enter picks, Escape closes, Tab takes an exact or single match.
  - Only one box is open at a time (`state.tlCombo`).
  - **`tlMultiVar`:** for several variables (correlation matrix, scatter-plot matrix). Chips with a Remove button, plus a search box to add more.
- **`mkPicker`** (`src/app/component.js`, the template's own pickers: outcome, predictors, weight, strata, PSU,
  cluster…).
  - Search, ranking and the "N rows" note are the same as in `tlCombo`.
  - **Keyboard** (from build .69): ↓ goes into the list, Enter takes the exact name, or else the top row, and Tab takes an exact name.
  - Every input with `data-pk-input` gets the keyboard handler; lists carry `data-pk-list`.
- **Console → point-and-click commands** (Summarize, Tab, Reg, Ologit …). Each blank lists every variable that fits
  it (name, label, row count), ranked as above, accents ignored, and Enter takes the top one. It used to show 10 names
  as buttons. Example: 614 numeric variables for Summarize on LAPOP, and "aprobacion del trabajo" → m1, m2.
- **Edit data → Choose what to use → Variables** (show / hide): every variable is listed (it stopped at 400), and the
  search ignores accents ("educacion" → 18 of 1,624 on LAPOP).
- **Not variable pickers, left as they are:**
  - the console's typed-command autocomplete, which suggests 8 names as you type, as Stata does;
  - lists of values, such as subgroup values and map units;
  - fixed choices such as "the mean of".
- **Variable list in the sidebar:** search ignores accents. It shows the first 150 variables, with **show all** to see
  every one.

## Tests

- `tests/search-boxes.test.mjs`:
  - ranking, accents and row counts in both kinds of box;
  - Enter in the predictor picker;
  - the rows-that-do-not-overlap message;
  - the margins box keeping "none";
  - the console builder (every variable, ranking, Enter);
  - the Edit data variables list (no cap, accents).
- `tests/e2e-pick.cjs` (`pickBy`): the browser suites pick variables by typing, as a person would. It falls back to
  `selectOption` for plain drop-downs.
