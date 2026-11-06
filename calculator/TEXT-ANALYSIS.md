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
