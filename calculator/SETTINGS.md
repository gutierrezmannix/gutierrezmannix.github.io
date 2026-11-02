# Settings — build .69

The Settings panel (the **Settings** button): weight, survey design (strata · PSU), missing codes, auto-screen,
alpha, stars, font, text size, palette, the language of the commands, Close dataset and Done, and the chips above
them. Code: `src/app/template.html` (the panel), `src/app/component.js` (`mkPicker`, `missAdj`, `pkRefocus`, the chips,
the key handlers), `tools/data_edit.py` (keeps the picker's blur in step).

## What the audit found and what changed

| Control | Before | Now |
| --- | --- | --- |
| Weight | the list offered every variable; picking text (`grp`) set "WEIGHT: GRP" in the status bar while the weight was ignored | numeric variables only |
| Weight, strata, PSU (and every variable box in the app) | a name typed and left with **Tab** was dropped; Tab went into the suggestion list, which then closed, and the focus fell to the page | Tab takes a name typed exactly, closes the list and moves to the next box; **↓** opens the list and moves in it, **Enter** picks and returns to the box, **Escape** closes the list (a second Escape closes Settings); typing reopens the list |
| Missing codes | after **Set**, the variable list still counted the codes (codes: 300 valid · 8 levels while the tab said 291) | the variable list follows the codes (291 valid · 7 levels) |
| Missing codes → clear | a link (`href="#"`) | a button |
| α chip | "α = 0.1" | "α = 0.10" |
| Chips | Weight, α, survey design and missing codes only opened Settings (nothing happened when it was open) | each goes to its control |
| Escape | did not close Settings | closes it (after any open list) |
| Screen readers | the four boxes had no names; the toggle buttons did not say which one is on | names on the boxes (Weight variable, Survey strata, Survey PSU, Missing codes); every button group has a name and `aria-pressed` |
| Descriptives CI with a survey design | no word on strata / PSU | the note says the strata / PSU are used by regression (survey SEs) and the survey analyses, not by that CI |

Checked and working as they were: alpha (the CI switches to 90 / 99%), stars, auto-screen On / Off (with its note),
font, text size and palette (applied at once and kept when the page opens again), Stata / R (the Commands chip
switches too), Done, and Close dataset (asks first when there are unsaved changes; No keeps the data).

## Tests

`tests/settings-e2e.cjs` (30 browser checks on `tests/data/descriptives.csv`: every control above, the keyboard in the
lists, the counts after missing codes, the CI at α = .10, the view after reopening the page, Close dataset).
