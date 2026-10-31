# Text analysis (Design A) and Excel files — build 2026-10-31.45

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

Every chart downloads as SVG (fonts embedded) or PNG at 150/300/600 dpi (with the dpi stored in the file).
"Recipe · R code" shows the quanteda script for the current cleaning.

## Fixes to the old tab

Accents broke matching ("economia" found 0 tweets, 313 when accents are ignored); keywords were not
Unicode-normalised; overlapping keywords were double counted; `#hashtag`, `covid-19` and `*terror*`
keywords never matched; links became "https"/"co" words; inclusive spellings (tod@s) were split;
variable names lost accented letters (d_econom_a) and could pass Stata's 32-character limit; two
categories with the same name overwrote each other; the R code could not reproduce the counts.

## Excel

`.xlsx`/`.xlsm` load like CSV: shared and inline strings, rich text, numbers, booleans, errors
(missing), formulas' cached values, 1900/1904 dates and date/time formats, hidden sheets, a sheet
picker under Data information, ZIP64, native or pure-JS inflate. Old `.xls`, `.xlsb` and `.ods`
files get a clear message asking to save as .xlsx or CSV.

## Build and test

```sh
python calculator/tools/text_lab.py
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
