# Intro page — builds 2026-11-01.58 to .60

The intro page is now just the data box. After loading a file, people use the tabs.

- **The box.** *Drag a data file here*, with *CSV · TSV · Excel (.xlsx, .xls) · Stata (.dta) · SPSS (.sav)* (since build .88), **Browse files**, and
  **Create your own dataset**. Clicking anywhere in the box opens the file picker, and dropping a file on it loads
  the file. Saved sessions still open as before; they are just not listed in the file types.
- **Continue where you left off.** Unsaved work appears below the box, up to four entries, and only when there is
  some. Each card shows the file name, what is in it (*1 result in the log, 2 plots*) and when. **Continue** restores
  the work (`autoRestore`); **Remove** discards it (`autoDiscard`). These cards replace the "Unsaved work from …"
  banners that used to appear at the top of the page.
- **Name and footer.** The calculator is called **GM 26.11**. The *Mainframe* label next to the logo is gone. The
  name is changed in the logo, the browser tab title, the report header, the "new version" message and the exported
  command log. The footer reads *GM 26.11 · BUILD … · Carlos Daniel Gutierrez-Mannix, PhD · CSV / TSV / EXCEL XLSX · XLS /
  STATA DTA / SPSS SAV*. *All computation local* and *saved sessions* are no longer in it.
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

## Build .90 — audit of the start page and its two buttons

Both buttons were tested in a real browser with the mouse, Enter and Space, on a phone, after a cancelled dialog, after
a wrong file (PDF) and with a double click; the box was tested with drag and drop. Browse files opens the file dialog
exactly once (also from anywhere in the box), Create your own dataset never opens it. What was fixed:

| Problem | Before | Now |
| --- | --- | --- |
| The page was taller than the window | at every size (1920×849, 1366×768, full HD, tablet, phone) a scroll bar and the footer below the bottom edge, 80–150 px. The text size setting zooms the page (1.12 by default) and the page's minimum height, 100% of the window, was zoomed too | heights tied to the window divide by the zoom (`--gmZoom`): no scroll bar, the footer on screen. The same fix keeps the console panel inside the window. Less padding above and below the box, so a 1280×650 window fits too |
| A file dropped next to the box (on the background or the footer) | the browser opened the file itself and left the calculator | the whole start page takes the drop and RELEASE TO LOAD shows anywhere; on the workbench a dropped file opens as File → Open another dataset does (asking first when there are unsaved changes) |
| Several files dropped at once | the first opened with no word about the others | the first opens and a message says so |
| After Create your own dataset | the keyboard was left at the top of the page | the cursor is in *Name of the new variable* |
| No heading | the page had no h1 | *Drag a data file here* is the h1 (same look) |

Checked and unchanged: the tab order (back link, Browse files, Create your own dataset), the focus ring, touch targets
on a phone (314×61 and 288×52 px), the reason for a PDF and that a good file then loads, cancelling the dialog, text
dragged in (not a file) is left alone, no console errors. `tests/intro-e2e.cjs` covers the new behaviour.
