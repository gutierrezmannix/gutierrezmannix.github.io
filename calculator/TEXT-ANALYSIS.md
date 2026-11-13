# Text analysis (Design A) and Excel files — build 2026-10-31.49

Tests → Text analysis is rebuilt as five steps that follow quanteda's order
(corpus → tokens → dfm → statistics and models). Everything runs inside
`index.html`, offline, with heavy work in the background worker.

| Step | What it does | quanteda equivalent |
|---|---|---|
| 1 Texts | text, group and date columns; each row or each sentence; language detected; warnings (Excel's 32,767-character cell limit, blank rows, groups that differ only in capitals, date order) | `corpus()`, `corpus_reshape()` |
| 2 Clean | links, numbers, emoji, @mentions, #hashtags, hyphens; accents (ignore keeps ñ/ç); stopwords in 15 languages (Snowball or stopwords-iso) plus your own list (import/export, × in any table); stems (Snowball es/en) or lemmas (es/en/pt/fr); joined phrases with suggestions; rare/common word trimming; live preview of one text | `tokens(remove_*)`, `tokens_remove(stopwords())`, `tokens_compound(phrase())`, `tokens_wordstem()`, `tokens_replace()`, `dfm_trim()` |
| 3 Explore | Words (table + word cloud with colour rules by frequency bands / group / dictionary category, split by any column, comparison cloud, bar chart); Phrases; Compare groups (keyness); In context (kwic with match lists); Over time; Connections (network); Clusters (dendrogram); Text stats | `textstat_frequency`, `textplot_wordcloud(comparison =)`, `textstat_collocations`, `textstat_keyness` + `textplot_keyness`, `kwic`, `fcm` + `textplot_network`, `textstat_simil/dist` + `hclust`, `textstat_lexdiv`, `textstat_readability` |
| 4 Measure | Dictionary (glob `*` `?`, phrases, `-exclusions`, untick false matches, accents, LIWC/YAML/Lexicoder import, precision check); Sentiment (polarity, valence); Topics (LDA and seeded LDA, choose k by divergence, 3-seed stability, pooling); Classify (Naive Bayes); Scale (Wordfish, Wordscores, CA) | `dictionary`, `tokens_lookup(nested_scope = "key")`, `quanteda.sentiment`, `seededlda::textmodel_lda/seededlda`, `divergence`, `textmodel_nb`, `textmodel_wordfish/wordscores/ca` |
| 5 Save | per category: count, 1/0, per 100 words, share; word counts; main topic + shares; sentiment; predicted label; clusters; all rows or the subgroup; preview and an automatic totals check; R code that recreates the columns | `convert(dfm(tokens_lookup()), to = "data.frame")` |

Over time opens on the number of texts (e.g. tweets) per day, week, month, quarter or year, one
line per author; empty periods count as 0 and each line runs from that author's first to last text.
It also compares authors and words/categories together: one line per author, one line per
word / category, one chart per author (lines = words, categories or variables) or one chart per
word / category (lines = authors). Items can be the words of a search (each its own line), all
dictionary categories, or saved variables (d_economia, d_salud_any, …) from the second dropdown.
The Dictionary results include the same timeline and a category cloud, shown by default: each
category sized in proportion to its mentions, texts or % of texts (one cloud per author on a common
scale), or the words inside each category coloured by category.

**Plot by (builds .79–.80).** Explore → Over time and the Dictionary timeline have a **Plot by** box: pick the
column with the authors (president, party, outlet …) to get one line per author, or *none — all texts together* for a
single line. There is no separate "one line per …" switch any more: the variable you pick decides. When several words
or categories are plotted, a **Layout** choice (one line per word, one chart per author, one chart per word) appears.
It is the same setting as *Groups to compare* in step 1, so it can be set in either place.

**Number of texts and searches over time (builds .80–.82).** With Show = *Number of texts*, **As** offers *Count* and
*% of all texts* (each line's texts spread over the periods). A search typed in any tab (or a word clicked in a table)
switches Over time from *Number of texts* to that search, with the same **As** choices as the Measure timeline:
*% of texts*, *Count* and *Per 10k words*. A dictionary category or saved variable already on show is left as it is.
(The *100% per year* option of build .80 was removed in .82.)

**Search in Over time and Connections (build .81).** Both tabs now have the same **Search** box as *In context*
(it is one search: typing it in any of the three changes it everywhere), with the list of the word forms it matched
so you can untick the ones that do not belong.
- *Over time*: typing a search switches **Show** to it, e.g. `corrup*` plotted by president as % of texts, count or
  per 10k words.
- *Connections*: the search becomes one node (all its ticked forms) in the middle, linked to the words that stand
  out most with it — words used more in the texts that use it (*Same text*) or within 5 words of it (*Within 5 words*)
  than elsewhere (keyness, χ², as `textstat_keyness`). Ranking by keyness rather than raw co-occurrence keeps common
  words (entonces, va, pues) from filling the chart. When the search is in most texts, *Same text* mostly contrasts
  long with short texts, and the page says so. Checked against quanteda 4.5.1 on the mañaneras sample: the same 39
  words in both modes, the strongest eight in the same order (window: impunidad, acabar, régimen, desterrar, combate,
  cero, actos, imperaba). The R code under the chart reproduces it.

**Audit (build .83).** A student was simulated through every step and sub-tab on the mañaneras sample (2,198 long
transcript parts) and on 30,932 tweets: no page errors, and the numbers agree across tabs (a search's mentions in
*In context* = the sum of its *Over time* counts = its dictionary category = the saved variable; texts per period add
up to all texts with a date). Every R block the page shows was then run in R (quanteda 4.5.1) on both files; fixes:
- *Over time* with one search word wrote an empty dictionary; it now writes the search (accents folded like the
  recipe, unticked forms removed) and matches the measure shown: % of texts, count, or per 10,000 words. The
  dictionary timeline's *Per 10k words* R code divided by the words, too.
- Column names with spaces (`Author Username`) broke Compare groups, Scale and topic pooling; they are quoted now,
  and CSV files are read with `check.names = FALSE` so the names stay as they are.
- *Clusters* by group × year and *Topics* pooled by group × month build the grouping with `interaction()`.
- *Connections* selects its words before `fcm()` (the full fcm ran out of memory on the transcripts).
- *Phrases* no longer overwrites `toks`; *Text stats* skips texts under 50 words for MATTR (it failed on empty rows);
  *In context* folds accents in the pattern.
- The *Check accuracy* sample in Measure scrolls inside its panel instead of spilling past it; clearing the search
  sends *Over time* back to the number of texts.

**See one text change, folded (build .84).** In Clean, the word-by-word *After cleaning* view starts closed: its
one-line summary gives the counts (e.g. 2,035 of 4,556 words kept · 2,488 common words · 33 removed). Opened, the words
scroll inside a 420-pixel window; the choice stays while you step through texts. A long transcript no longer fills the page.

**Audit 2 (build .85).** A second simulated student went through every cleaning option (stems, lemmas, extended
stopwords, accents kept, 3+ letters, hashtags as words, rare/common trim and back), sentence units, the IF subgroup, all
four Compare-groups measures, search edge cases (phrases, `-word`, `#*`, `@*`, no match, several words), clusters by
groups / texts / words, sentiment, seeded and pooled topics, Classify, Scale and Save, on the 202 mañaneras (.xlsx), the
same data as a Stata .dta with a labelled president variable and a %td date, and the 30,932 tweets. Every R block the
page showed was then run in R on all three files (25 per file, all run). Fixes:
- *Sentiment* with a subgroup drew a bar for a group with no texts (page errors); such groups are left out, and bar
  charts never draw a missing value. Long value notes no longer run off the chart.
- *Classify*: with only one label in the subgroup it now says so (the accuracy and baseline were computed on different
  rows); the baseline uses the subgroup's labelled texts; Save uses the Classify run that matches the current settings.
- *Scale* needs 3 groups with 100+ words; with fewer (e.g. in a subgroup) it says so instead of drawing empty points.
- *Fisher exact*: words only one group uses showed an odds ratio of "1,000,000,000" and the other group's words never
  appeared. Words are now ranked and drawn by the log odds ratio (+0.5), the table shows the odds ratio (∞ when
  infinite), and the R code ranks and plots the same way. Long #hashtags fit in the keyness chart.
- R recipe: Stata files are read with `haven::read_dta` (value labels as text), tab files with `read.delim`; Excel's empty
  trailing rows are dropped; groups that differ only in capital letters are merged as on the page.
- R code: sentiment and word scores in plain quanteda (quanteda.sentiment is not on CRAN); clusters of texts use the
  page's even sample of texts with 5+ words; clusters of words use a symmetric co-occurrence matrix; clusters of groups
  keep groups with 200+ words; the number of clusters never exceeds what R allows.
- Save says whether its totals check covers all rows or only the subgroup.

Every chart downloads as SVG (fonts embedded) or PNG at 150/300/600 dpi (with the dpi stored in the file).
"Recipe · R code" shows the quanteda script for the current cleaning.

## Fixes to the old tab

Accents broke matching ("economia" found 0 tweets, 313 when accents are ignored); keywords were not
Unicode-normalised; overlapping keywords were double counted; `#hashtag`, `covid-19` and `*terror*`
keywords never matched; links became "https"/"co" words; inclusive spellings (tod@s) were split;
variable names lost accented letters (d_econom_a) and could pass Stata's 32-character limit; two
categories with the same name overwrote each other; the R code could not reproduce the counts.

## Checked with R

`tests/r/text-lab-dictionary.R` counts a dictionary independently in R. On the tweets CSV (30,932 texts) and the
Mañaneras Excel file (202 speeches) it gives exactly the calculator’s mentions and texts ≥ 1 for all categories.
Two rules matter and are shown under the keyword box: a hashtag counts as its word (`covid*` also counts `#covid19`;
write `#covid19` to count only the hashtag), and hyphenated words stay whole (`vida-salud`), as in quanteda.

## Excel

`.xlsx`/`.xlsm` load like CSV: shared and inline strings, rich text, numbers, booleans, errors
(missing), formulas' cached values, 1900/1904 dates and date/time formats, hidden sheets, a sheet
picker under Data information, ZIP64, native or pure-JS inflate. Old `.xls`, `.xlsb` and `.ods`
files get a clear message asking to save as .xlsx or CSV.

## Build and test

```sh
python3 calculator/tools/build.py
node --test calculator/tests/text-lab.test.mjs calculator/tests/text-lab-component.test.mjs calculator/tests/xlsx.test.mjs
GM26_TEST_XLSX=/path/to/workbook.xlsx node --test calculator/tests/xlsx.test.mjs
GM26_TEXT_FILES="/path/tweets.csv,/path/speeches.xlsx" NODE_PATH=$(npm root -g) node calculator/tests/text-lab-e2e.cjs
```

Validation: the Snowball stemmers match the reference implementation on 3,000 Spanish and 183
English words; stopword lists are quanteda's own (`stopwords` package data); keyness, collocations
(λ, z), hclust heights and cophenetic correlation are checked against hand computations; the
browser test walks every step on a CSV and an Excel file and checks that saved columns add up to
the dictionary table.

Sources: `src/text-lab*.{mjs,js,css}`, `src/xlsx-reader.mjs`, `src/lemmas/` (spaCy lookup tables,
MIT), `tools/text_lab.py`.

## Build .92 — the text column is chosen only when it is obvious

Before: opening the tab chose the text column silently (a column named `text`, `texto`, `tweet`, … or else the one with
the most words) and started reading it, and also chose the date and the groups by their names. Nothing said so, and a
file with two long text columns (Excel splits texts over 32,767 characters into `text` and `text1`; a transcript and a
summary) got a guess.

Now (`tlAutoPick`, `tlAutoNotes` in `src/text-lab.js`):

| Column | Chosen when | Otherwise |
| --- | --- | --- |
| Text | it is the only column with sentences (3 or more words per row), or it has 3 times the words of the next | buttons for the real contenders (a tenth of the longest or more), e.g. *text · 5,357 words per row* / *text1 · 5,234*; nothing is read until one is picked |
| Groups | exactly one column is named like a group (party, author, speaker, user, source, **president, candidate, account, outlet**…) with 2–60 values | buttons when there are several; none when there is none (optional) |
| Date | exactly one column is named like a date | buttons when there are several (optional) |

What was chosen is said under the pickers, with the reason, while it is still the choice: *Chosen for you: Text as the
text — far longer texts than any other column (27 words per row; next: Source, 4.7 words per row); Created At as the
date — named like a date. Change them above if they are not right.* A restored session keeps its own choices.

On the files used for testing: the tweets and *The_Mananeras_Data* open ready (with the notice); *MananerasSA* (text /
text1) and a file with a transcript and a summary ask first. Tests: `tests/text-lab-autopick.test.mjs`;
`tests/text-lab-e2e.cjs` logs what was chosen or asked and answers the question as a person would.

## Build .98 — In context, Over time and the Measure timeline

Tested on *mananeras.dta* (288 conferences, AMLO and Sheinbaum, 2018–2026).

**In context (kwic)**

- The row number is the row in the loaded data (the Data tab's numbering). It is now a link: clicking *row 42* opens
  the Data tab at that row with the text column in view.
- Each side is as wide as its words need (about 62 px a word), so 12 or 20 words each side are no longer cut. The
  table scrolls sideways, with the keyword in the middle when it opens; the row column stays pinned on the left.
- Clicking a line shows the passage around it (60 words each side, from the original text) under that line; clicking
  again closes it.

**Over time**

- *Length of the texts* (Show) charts how long the texts are: all words before cleaning, words kept after cleaning, or
  characters; as the mean or median per text, or the total per period; a line per group with Plot by. The old *Words
  per text* (after cleaning only) is one of its options. R: `ntoken(toks)`, `ntoken(toks_clean)` or `nchar(df$text)`
  with `aggregate(..., FUN = mean | median | sum)`.
- Layouts with several words and a group column:
  - **One line per word, *group* marked** (the default): each word is one line across the whole period; the groups'
    eras (where each group's texts begin and end) are drawn as brackets with their names, with a dashed line where one
    group's era ends and the next begins. Made for presidents, legislatures and other groups that follow one another.
  - **Word × group**: a line per combination, colour by word and dashes by group, labelled *brasil · Sheinbaum*. For
    groups that overlap in time (parties, outlets).
  - *One line per word, groups pooled*, *One chart per group*, *One chart per word* and *All together* as before.
- End labels always sit in the right margin; a line that ends early (a president who left office) gets a dotted
  leader from its last point, so labels no longer sit over other lines.

**Measure → Timeline** uses the same layouts (with *category* instead of *word*): *All categories* no longer means one
chart per group; the default is one chart with a line per category and the groups' eras marked.

Tests: `tests/text-lab-component.test.mjs` (the layouts, eras and dashes, the length options and their R code, the row
link and the passage); `tests/text-lab-e2e.cjs` in a browser.
