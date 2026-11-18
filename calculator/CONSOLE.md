# Console — build 2026-11-18.103

The console has its own page, laid out like Stata's main window.

| Part | What it does |
|---|---|
| **Console** button (top bar, after Data) · Ctrl+K | opens the page; Esc or **← Back to …** returns to the page underneath, which stays as it was |
| Review (left) | every command so far, numbered; click puts it back in the command line, double-click runs it again. Blue lines came from buttons on the page, red ones were errors |
| Results (middle) | oldest first, the whole session, as in Stata. Typed commands echo exactly as typed (`. tab sexo`), followed by Stata's output; errors in red under the command. Tables longer than 400 lines are cut on screen only |
| Variables (right) | filter, click a name to type it at the cursor |
| Command line (bottom) | Enter runs, ↑ ↓ earlier commands, Tab completes a variable or command name; **Commands ▾** fills in a template; **Do-file** runs several lines in order (`*` and `//` comments, `///` continues a line) |
| Header | Stata / R, **Record what I run** (default) or **Also what I open**, Copy, Save log (.log), Save do-file (.do), Clear (like `cls`) |

**Printing rules.** The console records actions, not views. A typed command prints once. A button that runs
something (the regression's Run, Tests ▾ Run, a data edit, Time series, SEM …) prints its command once, marked
`* from the page`. Looking at a variable or switching tabs prints nothing; **› Print in console** above each page
prints what is on screen, once. **Also what I open** brings back the old behaviour of printing every view.

**As in Stata (build .103).**
- `summarize v` prints the one-line table (`, detail` the long one); `tabulate v` prints in the console; `, missing` adds the `.` row.
- A weight typed on a command (`[aw=w]`) applies to that command only, like `if`.
- `describe v1 v2` lists only those variables, in Stata 17's layout (storage type, display format, value label).
- `tostring x, gen(x_s)` makes a new text variable and keeps `x`.
- Conditions understand `missing(x)`, `!missing(x)`, `inlist(x, 1, 2)` and `inrange(x, a, b)`; `generate … if !missing(x)` too.

The side pane keeps Plots, Report and Help. Source: `src/console-page.js`, `src/console-page.css`,
`tools/console_page.py`; tests in `tests/console-stata.test.mjs`.
