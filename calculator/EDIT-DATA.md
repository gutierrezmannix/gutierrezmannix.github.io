# Edit data (Design A) — build 2026-11-01.52

Data → Edit data had seven panels whose tools overlapped: four different ways to change values (replace, “replace
if…”, recode values, recode into groups), two ways to hide variables, a row filter that duplicated the IF subgroup bar,
and Cronbach’s alpha mixed in with editing. Every Data-menu entry opened the same long page. It is now one place for
each job, opened directly from the Data menu:

| Task | What it does |
|---|---|
| Change a variable | Pick it once (or click a column name in Browse). Name and description (variable label); stored as numbers or text; analysed as categories or a number scale (the same as READ AS in Overview); hide; delete (click twice — Undo brings it back). **Change its values**: one value at a time (up to 40 values), value labels, group into ranges (quick fill: median split, terciles, quartiles), or only where a condition is true (replace … if) with a live count and preview of the rows that will change. |
| New variable | Name, numbers or text, start as missing / 0 / a number or formula (insert variables, functions listed) / text; ideas for a 0/1 dummy, a formula, text categories. Then **fill it in** with the same replace … if tool. |
| Make a scale | Add items; Cronbach’s alpha updates at once with item–rest correlations and alpha if removed; tick “reverse” for items worded the other way (flagged automatically when they go against the others); then create the scale score (mean or sum). |
| Rows | Use only some rows — the same subgroup as the IF bar on every tab (values or a range), with the number of rows in use; Use all rows; add empty rows. |
| Show / hide variables | Search, tick to show, hide all empty variables in one click, show all. |

The header always shows the size of the data, **Undo** (with what it will undo) and **Save data as CSV**; when
variables are hidden, a tick box decides whether they go into the file, and the save is confirmed.

## Fixes found while testing

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

Sources: `src/data-edit.js`, `src/data-edit.css`, `tools/data_edit.py` (run through `tools/text_lab.py`).
