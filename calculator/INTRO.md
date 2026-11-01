# Intro page (Design B) — builds 2026-11-01.58 and .59

The intro page used to have three things:

- a large drop zone;
- *Create your own dataset*;
- a *Use summary statistics or plan a study* button. It opened an empty workspace (0 rows, 0 variables) with a blank
  Output page, so build .58 removed it.

The summary and study-planning tools still work from Tests ▾.

Build .59 redesigns the page around what people want to do.

## Hero

- The heading *What would you like to do today?* with *Statistics calculator · works offline* above it, and a line on
  privacy: everything runs on this computer, and the data never leaves it.
- Next to it, one drop zone, *Drop any data file here*, for CSV, TSV, Excel, Stata or a saved session, with **Browse
  files**.

## Continue where you left off

- Unsaved work is shown as cards, up to four. Each card shows the file name, what is in it (*1 result in the log, 2
  plots*) and when.
- **Continue** restores the work (`autoRestore`); **Remove** discards it (`autoDiscard`).
- These cards replace the "Unsaved work from …" banners at the top of the page. The actions are the same.

## Start from a task

There are six cards. Each says what it does and what file to bring. **Open a file →** opens the file picker, and once
the file has loaded the calculator goes straight to the task:

| Card | Bring | Opens |
|---|---|---|
| Explore and test a dataset | a survey or spreadsheet | the usual first tab |
| Make charts | any dataset | Charts, at the gallery of chart questions |
| Make a map | a column with the place, by name or code | Charts → Map (which finds the place column itself) |
| Analyze texts | a column of texts | Text analysis |
| Analyze a network | a list of ties (from, to) | Networks, with the opened file already used as the ties |
| Type in your own data | nothing | a new empty dataset |

A task is remembered for 15 minutes. Dropping a file or using **Browse files** clears it.

On a phone the hero, the cards and the buttons stack in one column, with no sideways scrolling.

## Files

| File | What it holds |
|---|---|
| `src/intro.html` | The page. It replaces the "Load bay" section between `GM26 intro` markers. The hidden file input, the drag-and-drop handlers, the loading bar and the error line are kept exactly as before. |
| `src/intro.css` | Styles. |
| `src/intro.js` | `introVals`: the card actions and the Continue list. `introApply`: going to the task after the file loads. |
| `tools/intro_page.py` | Puts the page into the app. Called by `tools/build.py`. |

## Tests

`tests/intro-e2e.cjs` runs in a real browser with no internet. It checks:

- the heading and the six cards;
- that the removed button stays removed;
- that the drop zone loads a file;
- that unsaved work (a result in the log) comes back under *Continue where you left off* after a reload, and that
  Continue restores it;
- each card landing on its tool:
  - the Map page, with `ent` found;
  - the chart gallery;
  - Text analysis;
  - Networks, with the file used as the ties;
  - the dataset;
  - a new empty dataset;
- no sideways scrolling at 390 px;
- no console errors.

The mockups that led to this design are on the canvas *GM26.1 intro page redesign*.
