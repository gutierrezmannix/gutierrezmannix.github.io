# Rebuilding the deputies dashboard

The member-level file (`mexico_nominate_within_term_WORKING_vXX.dta`) is never committed. The page runs on
summaries and pictures that you build locally from it:

1. `Rscript build/build_data.R /path/to/the.dta /tmp/dipbuild`
   Writes `data/diputados-agg.js` (per term, party and state: counts, medians, quartiles, spreads; no names,
   no member scores) and a temporary `strips.json` in `/tmp/dipbuild`. Needs R with haven, dplyr, jsonlite.
2. `node build/render_strips.cjs /tmp/dipbuild`
   Draws `img/strip-<legislature>-<tit|all>.png` (one picture per term, titulares and everyone, no names)
   and deletes `strips.json`. Needs Node with Playwright's Chromium.
3. Copy `img/strip-64-tit.png` to `preview.png` if you want the hub card to change.
4. Commit `data/`, `img/` and `preview.png`. Check `git status` shows no `.dta`.

Orientation: each term is flipped so the president's party sits to the right (`gov` in `build_data.R`).
Delegations with fewer than five scored deputies get no mean position, so no single member can be read off the map.

## Refresh geography without changing the voting views

Run `python build/refresh_geography.py /private/path/to/the.dta` (requires pandas).
This updates only state aggregates, geography coverage, and election-type record counts in the existing public summaries.
It checks the existing all-member voting summaries and orientation first; it preserves voting summaries and strip pictures.
The geography source is tracked separately because a metadata update can retain the previous score version internally.

State maps include every legislature with eligible records, including LVIII. They use only scored members explicitly recorded
as titulares with a recognized state. Missing roles are excluded rather than assumed to be titulares; blank and `.` states
are not geographic data. Coverage is shown for each term. Tied leading parties are neutral, not assigned arbitrarily.
The input Stata file is read locally and is never copied into the site. No export button or downloadable dataset is created.

