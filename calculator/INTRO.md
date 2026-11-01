# Intro page — builds 2026-11-01.58 to .60

The intro page is now just the data box. After loading a file, people use the tabs.

- **The box.** *Drag a data file here*, with *CSV · TSV · Excel (.xlsx) · Stata (.dta)*, **Browse files**, and
  **Create your own dataset**. Clicking anywhere in the box opens the file picker, and dropping a file on it loads
  the file. Saved sessions still open as before; they are just not listed in the file types.
- **Continue where you left off.** Unsaved work appears below the box, up to four entries, and only when there is
  some. Each card shows the file name, what is in it (*1 result in the log, 2 plots*) and when. **Continue** restores
  the work (`autoRestore`); **Remove** discards it (`autoDiscard`). These cards replace the "Unsaved work from …"
  banners that used to appear at the top of the page.
- **Name and footer.** The calculator is called **GM 26.11**. The *Mainframe* label next to the logo is gone. The
  name is changed in the logo, the browser tab title, the report header, the "new version" message and the exported
  command log. The footer reads *GM 26.11 · BUILD … · Carlos Daniel Gutierrez-Mannix, PhD · CSV / TSV / EXCEL XLSX /
  STATA DTA*. *All computation local* and *saved sessions* are no longer in it.
- **History.**
  - Build .58 removed the *Use summary statistics or plan a study* button. It opened an empty workspace; the tools
    remain in Tests ▾.
  - Build .59 tried task cards (design B on the canvas *GM26.1 intro page redesign*).
  - Build .60 replaced them with the box alone, at the user's request.

## Files

| File | What it holds |
|---|---|
| `src/intro.html` | The page. It replaces the "Load bay" section between `GM26 intro` markers. The hidden file input, the drag-and-drop handlers, the loading bar and the error line are kept exactly as before. |
| `src/intro.css` | Styles, including one column on a phone. |
| `src/intro.js` | `introVals`: the box actions and the Continue list. |
| `tools/intro_page.py` | Puts the page into the app. Called by `tools/build.py`. |
| `src/app/template.html`, `src/app/page.html`, `src/app/component.js` | The name and the footer, outside any build-managed block. |

## Tests

`tests/intro-e2e.cjs` runs in a real browser with no internet. It checks:

- the box and its file types;
- that there are no task cards or intro lines;
- the GM 26.11 name and the footer;
- that the removed button stays removed;
- that the box loads a file;
- that unsaved work comes back under *Continue where you left off* after a reload, and that Continue restores it;
- that *Create your own dataset* opens an empty table;
- that there is no sideways scrolling at 390 px;
- that there are no console errors.
