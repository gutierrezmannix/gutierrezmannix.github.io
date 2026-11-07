# Data formats audit — build .88

Every format was tested with files written by real software (R haven, foreign, writexl and readxl; LibreOffice; a
BIFF5 writer for Excel 5.0/95) from one 40-row dataset with accents, labels, dates, missing values and a 395-character
text. Each file was compared value by value with that dataset, and loaded through the real file dialog in the browser.

| Format | Before | Now |
| --- | --- | --- |
| Excel 97–2003 `.xls` (BIFF8) | refused ("save as .xlsx") | read: numbers, text (shared strings across CONTINUE records), dates, booleans, formulas' cached values, merged cells, every sheet, the 1904 date system; large (6,000 rows) and tiny (mini-stream) files |
| Excel 5.0 / 95 `.xls` (BIFF5, 1993) | refused | read the same way, text in the workbook's code page |
| SPSS `.sav` (uncompressed and compressed) and `.zsav` | refused ("export to CSV") | read: variable labels, value labels, user-missing values and system-missing as missing, dates, long names, text longer than 255 bytes, the file's own encoding |
| SPSS portable `.por` | "an SPSS file" | its own message: open it in SPSS and Save As `.sav` |
| Stata 6 (release 108) and 5 (105) | refused | read (Stata 5 value labels stay as codes) |
| Stata 7–12 dates (`%td`, `%tc`, `%tm`) | day counts (21,522) | dates (2018-12-04), as Stata 13+ files already were |
| Stata 7–12 files written as UTF-8 (by R) | "PeÃ±a" | "Peña"; true Latin-1 files are still read as Latin-1 |
| CSV with old-Mac line endings (CR only) | one long row | rows |
| Excel Unicode text (UTF-16) with no byte-order mark, and big-endian UTF-16 | garbage | read |
| A file cut short (broken download) | `.xls`: the page froze (out of memory); `.dta`: made-up rows or "Offset is outside the bounds"; `.sav`: part of the rows | "this … file is damaged or incomplete" with what to do |

Already fine and unchanged: `.xlsx` (writexl, LibreOffice), Stata 8–15+ (releases 113–119), CSV in UTF-8 (with
and without a byte-order mark), Windows-1252, semicolons with decimal commas, tabs, CRLF.

Where it shows: the formats line on the start page and the footer list `.xls` and `.sav`; the Networks file buttons
accept `.xls`, `.sav` and `.zsav`; the session log and R code start with `import spss using "file.sav", clear` /
`haven::read_sav()` for SPSS files.

Kept as they are, on purpose:
- **"NA" in a text column stays the text "NA"** in CSV files (R writes missing text that way). Number columns already
  treat NA as missing. Turning text "NA" into missing would also blank a real value such as Namibia's country code.
- **Codes with leading zeros** ("04182") in a column that is all digits become numbers (4182), as in `read.csv` and
  Stata's `import delimited`. Keep such codes as text in the source file, or rebuild them with Make a new variable.
- Limits of the formats themselves: Stata 6–7 text holds 80 characters, Stata 8–12 244 bytes, an Excel 5.0 cell 255.

Tests: `tests/file-formats.test.mjs` (19 tests) with the files in `tests/data/formats/` and `truth.json`, and the
Networks tab run end to end from CSV, `.xls` and `.sav` copies of the same edge and node lists (same 390 people,
331 ties, same model).

# Stata long text and dates — build .77

- **Long text (strL).** Stata stores text longer than 2,045 characters (speeches, transcripts, open answers) as strL.
  The reader filled every strL value with an empty string, so a transcript file opened with a blank text column. It
  now reads the `<strls>` section for Stata 13, 14 and 15+ files (releases 117, 118, 119; R haven's 119 layout too):
  every text in full, with accents. A 72 MB file with 1,128 transcripts of about 63,000 characters reads in 0.5 s.
- **Dates.** Numbers with a `%td`, `%tc` / `%tC` or `%tm` format are read as dates (2018-12-04, 2019-01-02 07:30:00,
  2019-01), as Excel dates are, so Text analysis and time charts find them. They used to arrive as day counts (21,522).
- **Stata 13 files written as UTF-8** (e.g. by R) keep their accents; true Latin-1 files are still read as before.
- **Text analysis, Excel's cell limit.** The warning counted every text of 32,767 characters *or more* as cut off by
  Excel, so complete texts from Stata or CSV were flagged. It now counts texts of exactly 32,767 characters, and also
  warns when many texts stop just under it (31,000–32,766) and none is longer, as when a program trims a little more.

Tests: `tests/stata-strl.test.mjs` with `tests/data/stata-strl-v13/14/15.dta` (texts, the empty text, accents, the
three date formats).

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
