# Start page and File menu — build .67

The start page's two buttons (**Browse files**, **Create your own dataset**) and the **File** menu. Code:
`src/intro.html`, `src/intro.css`, `src/intro.js` (integrated by `tools/intro_page.py`), the file input and the
File menu in `src/app/template.html` / `src/app/component.js` (`ingest`, `notDataReason`, `openFileDialog`,
`newDataset`, `saveCsv`, `saveSession`), the empty-dataset hint in `src/data-edit.js`, and UTF-16 text in
`src/net-lab-engine.mjs` (`nlDecodeText`).

## What changed in build .67 (from the audit)

| Where | Before | Now |
| --- | --- | --- |
| Create your own dataset | a link (`href="#"`): Space did nothing; it opened Edit data → Fix a variable with an empty picker ("20 rows × 0 variables") | a button; it opens **Make a new variable → Blank**, and Fix a variable on an empty dataset says what to do |
| Files that are not data | a PDF or a binary file gave "found a header but no data rows" | a reason: not a data file / an SPSS, SAS or R file (with how to export it) / a LibreOffice or Numbers sheet / a .json that is not a session |
| Excel's Unicode text (UTF-16) | read as Windows-1252: garbage | read as UTF-16 (byte-order mark) |
| Drag and drop | RELEASE TO LOAD flickered when passing over the button or the link | stays while the file is over the box |
| File → Open another dataset… | closed the dataset and went to the start page (nothing to cancel) | opens the file dialog at once; cancelling keeps the dataset |
| File → Open a saved session… | the same as above | opens the file dialog at once |
| Opening a file over unsaved changes | asked only when closing | asks once the file is chosen; No keeps the dataset |
| A file that cannot be read, opened from File | the dataset was already closed | the dataset stays, with "Could not open …: reason" |
| File → Create a new dataset | replaced the data without asking, even with unsaved changes | asks when there are unsaved changes; opens Make a new variable → Blank |
| File → Copy session log | with an empty log, copied nothing silently | says the log is empty |
| Save data as CSV | `libro.xlsx` saved as `libro.xlsx.csv` | `libro.csv` (any data extension is dropped) |
| Console log line for summarize | "mean, SD, min, max" | percentiles, mean, SD, skewness, kurtosis and the CI |
| Plots | cleared when a load started, also when it then failed | cleared once the new file is read |

Unchanged on purpose: the formats line on the start page does not list saved sessions (build .60); there is no
`accept` filter on the file dialog, because phones (Android) can grey out `.dta` files that a filter lists by
extension — the reasons above cover wrong files instead. The whole box opens the dialog (not only the button), as
before. Checked and working as they were: Save data as CSV (commas, quotes, line breaks, accents, every digit),
Save session → Open a saved session (data, settings, log, plots), Copy session log, Print lab report (Print / save
as PDF, Back to workbench), Browse files with the mouse, Enter and Space, the same file twice, and the phone layout.

## Tests

`tests/file-menu.test.mjs` (4 tests: reasons for non-data files, UTF-8 / Windows-1252 / UTF-16 text, CSV names,
the new-dataset landing) and `tests/file-menu-e2e.cjs` (22 browser checks: both buttons with mouse and keyboard,
typing values into a new dataset, drag and drop, every File item, confirmations, failed loads, the session round
trip, the report). `tests/intro-e2e.cjs` also checks Space on Create and the reasons for PDF, SPSS and binary files.
