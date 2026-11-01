# Edit data (Design B) — build 2026-11-01.56

Design A (build .52) gave each job its own place, but the tab still had five tasks, four sub-tabs and two steps: twelve
places to look. Some of them did the same thing. `replace … if` appeared twice, the type was asked twice (“stored as”
and “analysed as”), recoding and value labels each listed the same values, “group into ranges” sat under Change a
variable although it makes a new variable, and hiding had a button in one task and a whole task of its own. Design B
keeps every tool and puts them into three jobs, in plain words, each tagged with its Stata name:

| Job | What it does |
|---|---|
| **Fix a variable** | Pick it once (or click a column name in Browse). Name and description. **What kind of variable is it?** One choice, Groups or Numbers, with examples. Storage (numbers or text) sits under “Storage options”; turning text that holds words into numbers asks first and says how many values would become missing. **Its values**: one table with each value, how many rows have it (with a bar), what it means (the value label) and what to change it to (the recode). One Apply runs both, and the Stata/R commands are shown before applying. Numbers with many values get a summary and **Make groups from it →**. **Change values only in some rows** (`replace … if`, live count and preview) folds away. Delete (click twice; Undo brings it back). |
| **Make a new variable** | Pick a recipe: **Yes / No (0/1)** (name, rule, “everyone else is 0 or missing”, live count “8 of 80 rows will be 1”, preview, then one click: `generate` + `replace … if`); **Groups from a number** (median split, terciles, quartiles or your own ranges); **Scale from several questions** (Cronbach’s alpha, reverse items, mean or sum); **Calculation** (formula with variables and functions); **Copy and recode** (new: type a group next to each value, e.g. 7-point party ID → 3 groups; stored as 1, 2, 3 with labels, like `recode …, gen()`; the original is unchanged); **Blank**. |
| **Choose what to use** | **Rows**: the same subgroup as the IF bar on every tab, with the number of rows in use and a bar showing how much of the data is left (the job’s button shows “12 of 80 rows”). **Variables**: search, tick to show, hide empty ones, show all. **More**: add empty rows. |

**Save data as CSV.** When rows are set aside or variables are hidden, the button opens a small panel: **only the rows in
use** (as Stata’s `keep if` would leave the data) or all rows, and hidden variables in or out. Without either, it saves at
once. File → Save data as CSV still saves every row.

The Data menu has three entries for the jobs instead of five. Older links (the model guide’s scale link, saved sessions,
console entries) open the job that now holds the tool.

## Also fixed in build .56

- Typing `keep if` / `drop if` in the console, or clearing the filter, re-logged the analysis on screen. After
  `tab region compulsory, row chi2` and `keep if region == "Europe"`, the console showed an unrequested
  `tabulate region compulsory, column chi2`, with the typed `row` option lost. These filter changes now write only their
  own line. Changing the IF bar on an analysis page still logs that analysis.

## Fixes from build .52 (Design A)

- Recoding a number variable with words (0 → Rep, 1 → Dem) used to stop with an error. It now offers to keep the
  numbers and add the words as value labels (recommended), or to turn the variable into text.
- Values for recoding and labelling are the stored codes; with value labels the old list showed the labels, so a recode
  silently matched nothing.
- A variable typed in a picker without clicking the suggestion was ignored; in replace … if that meant the condition
  was dropped and every row changed. Typed names are now accepted, and the replace tool says how many rows will change
  (“No condition: all 80 rows will change”).
- Group into ranges now stores 1, 2, 3… with value labels, as the Stata command it shows (`recode … (else=.), gen()`)
  and as the command bar does; it used to create text.
- Save as CSV silently left out hidden variables although the panel said the data was untouched.
- Failed recodes, failed replaces and adding rows to a too-large file each left an empty Undo step.
- Renaming a variable lost its value labels and its READ AS choice.
- Commands for number variables read as categories printed `democrat == "1"` (an error in Stata); now `democrat == 1`.
- The Data menu opened over the Tests and Charts buttons; it now opens under its own button. The filter showed twice
  in the toolbar chips; the status bar now shows the rows in use (`ROWS: senator = 1`).

## Tests

```sh
node --test calculator/tests/data-edit-component.test.mjs
NODE_PATH=$(npm root -g) node calculator/tests/data-edit-e2e.cjs     # offline browser walk-through, GM26_SHOTS=dir for screenshots
```

The component test checks each step against a direct computation (alpha against the textbook formula with a reversed
item, quartile groups, dummy counts, CSV contents, undo). The browser test uses every task through the page with all
internet requests blocked (only the update check is attempted), at 1440 px and 390 px.

Sources: `src/data-edit.js`, `src/data-edit.css`, `tools/data_edit.py` (run by `tools/build.py`). Before/after mockups were
made from the same fonts and colours; the browser test saves real screenshots with `GM26_SHOTS=dir`.
