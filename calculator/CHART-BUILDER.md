# Year axes and the X interval — build 2026-11-02.72

- **Timelines (and any chart over years)** label the x axis at evenly spaced years, including years with no data.
  For example, LAPOP waves 2016 and 2019 now have 2017 and 2018 between them, where before the axis skipped them.
  The interval is picked so the labels fit: every year, every two years, every five …
- **Customize → Axes & size → X interval**: the years between labels. 1 = every year, 2 = every two years. Five or
  more lands on round years (2005, 2010 …); smaller intervals start at the first year. On any other X axis it sets the
  distance between labels. When the chosen labels would touch, they are tilted rather than dropped.
- **Labels → Years on the axis → Every year with data** still labels only the years that have data.

Test: `tests/chart-builder.test.mjs`, "a year axis is evenly spaced …". It checks automatic, interval 1, 3 and 5, and
"Every year with data".

# Charts named by type — build 2026-11-02.70

The Charts menu and the gallery used to group charts by question ("Compare amounts", "Change over time", …). They
now name the chart, as Stata's `graph` menu or Excel do:

| Group (`CB_FAMILIES` in `src/chart-builder.mjs`) | Charts |
| --- | --- |
| Bar charts | Bar chart, Grouped bars, Stacked bars, 100% stacked bars, Dot plot |
| Timelines (line charts) | Timeline, Area chart, One panel per group |
| Histograms & box plots | Histogram, Density curve, Box plot, Box plots by group, Violin plot |
| Scatter plots | Scatter plot, Scatter + fitted line, Scatter + smoother, Hexbin (many points), Scatter-plot matrix |
| Error bars: means & proportions | Means with CIs, Proportions with CIs |
| Pie & donut charts | Pie chart, Donut chart |
| Likert charts | Likert chart |
| Heat maps | Correlation heat map, Heat map of a mean |
| Before & after | Dumbbell chart, Slope chart, Paired before / after |
| Regression results | Coefficient plot, Model comparison, Margins plot, Marginal effects plot, Interaction plot, Event-study plot, Conjoint (AMCE) |
| Survival curves | Kaplan–Meier curves |
| Maps | Map: countries, states, municipalities |

- **Menu** (`cbMenu`): *All charts* and *Output — everything you have run* at the top; then each group as a heading
  with an icon and its charts as buttons.
- **Gallery** (`cbGallery`): one card per group (icon, name, one line on what it shows, its charts).
- **Chart page**: the group's icon and name as the title; panel *1 · Variables*. Every variable box is a search box
  (type part of the name or of the label; see [SEARCH-BOXES.md](SEARCH-BOXES.md)).
- **Timelines** with no year in common between the outcome and the split variable say which years each one has, e.g.
  "No year has both d5 and ur1new: d5 has data in 2004, …, 2023; ur1new in 2021. Split by another variable, or by none."

Tested with the LAPOP Mexico file (3,623 rows × 1,624 variables): timeline of d5 by year split by q1, histogram of q2,
scatter ed × q2, means of it1 by q1, Likert b1 by q1, correlation heat map with variables added by label.

# Chart builder (Design A) — builds 2026-11-01.53 and .54

Before this build, the Charts tab had 37 pages built at different times. Each page had its own options, and nine of
them were older charts with fewer options. Most charts had no way to rename groups, show values or pick colors. Every
chart in the Charts tab now goes through one builder with one look and one set of options. Maps have their own
page (one Map page since build .57, see [MAPS.md](MAPS.md)).

## How a chart page works

1. **Gallery** (Charts → *What do you want to show? — all charts*). Charts are grouped by the question they answer:
   - compare amounts;
   - parts of a whole;
   - survey answers;
   - spread;
   - change over time;
   - two numbers;
   - estimates with uncertainty;
   - model results;
   - maps.

   Each group shows a thumbnail and its chart types. The Charts menu is grouped the same way.
2. **Data sentence.** For example: *Show the % equal to 1 of `ss_dir` over `year`, split by `sexo`*. Time charts also
   have:
   - which groups to draw;
   - From / To;
   - a shaded 95% interval;
   - more outcomes.

   The chart type buttons in the top bar switch between related charts and keep the chosen variables.
3. **The chart** redraws as you change anything; there is no Draw button. Under the chart are:
   - **PNG 150 / 300 / 600 dpi**, with the resolution saved in the file;
   - **SVG**, with the fonts embedded;
   - **Data behind the chart**, with a copy button.

   The Plots pane keeps one entry per chart page and updates it in place.
4. **Customize** (under the chart):
   - **Labels**:
     - names for every group, line, slice or bar;
     - title and subtitle;
     - a source line (filled in automatically with the file, *n*, the weight and the rows used);
     - axis titles;
     - legend position, including names at the line ends;
     - a description for screen readers.
   - **Values**:
     - none, every point, last point, first and last, or totals;
     - number format (17,500 or 17.5k) and decimals;
     - which lines show values.

     Labels that would overlap at the same year are moved apart.
   - **Colors**:
     - a color for each category;
     - four palettes: GM26, colorblind-safe, grays for printing, and bold;
     - highlight one group and gray out the rest;
     - one color for each bar;
     - patterns for black-and-white printing.

     The chart color chosen in Settings is used first.
   - **Axes & size**:
     - start the axis at zero;
     - log scale;
     - axis limits;
     - every year on the axis;
     - sort the bars;
     - horizontal bars;
     - line width;
     - markers;
     - gridlines;
     - text size;
     - size: automatic, report, slide or square.

## Variables with many values (build .54)

Charts used to stop at 40 categories with “filter or recode the data”. They now group the values instead, and a
**“edad has 98 values”** choice appears in the data sentence for any category variable with more than 12 values:

- **Number variables** (age, income, household ID …) go into ranges: automatically about 10–20 groups of a round width
  (age → 0–4, 5–9 … 95–99), or ranges of any other round width (2, 10, 20, 25 …), or **each value**. Ranges are in order
  of their value and use thousands separators (2,500–5,000).
- **Text and labelled variables** keep the 20 largest categories and put the rest in **Other (combined)** — or the 5,
  8, 10, 15, 25, 30 or 39 largest — or all of them when the chart allows it. Other is always last; no rows are lost.
- **Heat maps** take up to 120 columns and 60 rows, so each single age (98 columns) works; column labels thin out
  when the cells are narrow. The heat map now has a real title (*Mean of ss_dir by edad and sexo*), the column and
  row variables named on the axes, and the color key labelled.
- The grouping is per chart and per variable; line charts split by a grouped variable offer the ranges as chips.
- Heat maps, group means, violins and dumbbells sort the rows into groups in one pass (512,860 rows: about half a
  second for the first draw, under 10 ms to restyle).

## Names are shared

When you rename a category, the new name is used in every chart and table:

- **Number-coded variable** (for example `sexo` 1 / 2): the name is saved as a **value label**, the same as Stata's
  `label define sexo_lb 1 "Hombres", modify`. The command is written to the Console log. Tables, the Univariate tab and
  every chart then show *Hombres*.
- **Text variable**: the name is kept for that variable and used by every chart of it.
- **Chart-only names**: untick *Use these names in every chart and table* to rename on one chart only.

Colors set for a variable are also shared by every chart of that variable. Names and colors are saved with the session.

## Charts in the other tabs

- **Univariate → Break down by groups** (for example, % of `ss_dir` by year and sex): the chart is drawn by the same
  builder. Under it are the downloads and a **Customize this chart** panel:
  - **Labels**: names for the lines, saved as value labels, plus title, subtitle, source and legend;
  - **Values**: every point, last point, or first and last; every year on the axis; where the axis starts; number
    format; decimals;
  - **Colors**: one per line, including the Total line, plus the palettes.

  **More options in Charts →** opens the same chart in the Charts tab with its names and colors. The link appears only
  when the Charts page computes exactly the same numbers.
- **Univariate, Two variables, t-tests, Regression:** the bar chart, histogram, box plot, scatter plot, stacked bars,
  group box plot, group means, paired chart and coefficient plot each have a link under them. It opens the same chart
  in the Charts tab with the variables already chosen, so all the options above are available:
  - the coefficient plot uses the model you just ran;
  - Time series has the link when its time variable is a number.

## Files

| File | What it holds |
|---|---|
| `src/chart-builder.mjs` | Drawing for every chart: bars, lines, areas, pies and donuts, boxes and violins, heat maps, dumbbells and slopes, correlation matrices. Also number formats, palettes and label spreading. |
| `src/chart-builder-data.mjs` | The numbers behind each chart, using the chart suite's statistics (Wilson intervals, Kaplan–Meier, densities). |
| `src/chart-builder.js` | Component: gallery, data sentence, Customize, names and colors, the compact panel for other tabs, and the links under analysis charts. |
| `src/chart-builder.css` | Styles. |
| `src/breakdown.js` | The Univariate breakdown chart, now drawn by the builder. |
| `tools/chart_builder.py` | Puts the files into `index.html`. Called by `tools/build.py`. |

## Tests

- `tests/chart-builder.test.mjs` checks:
  - all 37 chart types draw with no errors and no NaN;
  - the gallery and the menu;
  - names become value labels, with the Stata log line;
  - text names and chart-only names;
  - colors and palettes reach the SVG;
  - values at every point and the last point;
  - every year on the axis;
  - sums by year and sex match a direct count;
  - percentages add to 100 and histogram counts add to *n*;
  - number formats and exact axis limits;
  - the breakdown chart: names, colors, values and the link to the same numbers in Charts;
  - the links under the analysis-tab charts open a chart that draws;
  - many categories: age in ranges of 5 with the right cell means, each value on the heat map, ranges of 10, the 20
    largest text categories plus Other (nothing lost), ranges with thousands separators, line groups.
- `tests/chart-builder-e2e.cjs` runs in a real browser with no network access:
  - builds a line chart from the gallery;
  - renames the groups, adds values and picks a color;
  - checks that the same names appear on a donut;
  - downloads PNG and SVG;
  - runs the Univariate breakdown with its Customize panel;
  - follows *More options in Charts →* and checks that the value matches the table;
  - checks that a 390 px wide screen has no sideways scrolling;
  - fails on any console error.

  Run it with:

  ```bash
  NODE_PATH=$(npm root -g) node calculator/tests/chart-builder-e2e.cjs
  ```

## Build .95 — Timelines for coded survey questions

The Timeline page (Charts → Timelines) now counts a coded question by its answers. Before, you had to split a variable
by itself, and the chart still showed no percentages.

- **Show** adapts to the variable. A question with value labels (or a text variable) offers:
  - *the % giving each answer* (the default for labelled questions): one line per answer, each year adds to 100%;
  - *the % giving one answer…*: pick the answer by its label; several answers add up (Mucha + Alguna);
  - *the mean score of*: only for answers in order (three or more scale answers);
  - *the number giving each answer*: people represented, i.e. the sum of the weight as stored.

  The mean of a labelled variable is called *the mean of the codes*, and its note says how to count the answers instead.
- **Leave out**: a checklist of every answer with its code and how many people gave it.
  - Nothing is left out by default, so No aplica and No sabe are lines too, drawn in grey.
  - A ticked answer leaves both the chart and the 100%. Quick picks: *No aplica + No sabe*, *only No sabe*, *nothing*.
  - The field says what the 100% now is, and the subtitle always names what was left out.
- **Mean score**:
  - The score is the answer's code. *Direction* reverses it, e.g. Mucha = 4 for *higher = more trust*, and the chips
    show the values.
  - No aplica and No sabe can't be scored, so they are left out of the score. They still appear: a small chart under
    the main one plots their % each year.
  - *Axis* switches between a zoomed axis (said in the subtitle) and the whole scale.
- **Smooth**: *Each year / 3-year average / 5-year average*.
  - Each point pools the people of that year with its neighbours. Neighbours are taken by position among the years in
    the data, so a year that was not asked is skipped. The weighted estimate covers everyone in the window; it is not
    an average of the yearly values.
  - Points whose window is cut at the first or last year are hollow.
  - The single years stay as faint dots, or can be hidden.
  - Sums and counts are averaged per year in the window.
- **Compare groups** replaces *Split by*. With *the % giving each answer*, *Style* switches between lines and stacked
  100% (the Area chart).
- **Intervals**: the interval of a weighted mean or % is now the survey one, as Stata's `mean [pw=]` and R's
  `survey::svymean`: se = √(n/(n−1) · Σw²(y−ȳ)²) / Σw, with Stata's t(n−1). Unweighted it is s/√n, as before. Before
  this build, weighted intervals treated the weight as an analytic weight.
- Long chart subtitles wrap, up to three lines.

Tests:

- `tests/timeline-coded.test.mjs` uses `tests/data/timeline-coded.dta`, a labelled survey over seven years with 2019
  not asked, written by `tests/timeline-coded-reference.R`. It compares the page with R's `survey` package
  (`tests/data/timeline-coded-reference.json`) on:
  - the % giving each answer, with and without No sabe;
  - one answer by sex, with the standard error and interval;
  - the pooled 3-year windows (2018 pooled with 2017 and 2020) and the hollow ends;
  - the reversed score and its pooled version;
  - the left-out strip;
  - weighted and unweighted standard errors;
  - weighted counts.

  It also checks what the page offers: no mean score for Sí / No, and the score's checklist with No aplica and No sabe
  locked.
- Checked by hand on the ENVIPE sample (samplevic.dta, weighted by fac_ele), where every number matched R `svymean`:
  - % Sí among taxi users, pooled 3-year: 33.9 (2017, 2-year window), 37.8 (2019) and 31.8 (2026);
  - trust in neighbours reversed: 2.96 to 3.09.

## Build .96 — No aplica and No sabe stored as missing codes

Many survey files store No aplica and No sabe as missing codes, so Stata's `tab` leaves them out unless you add `, missing`:

- Stata files use extended missing values (`.a`, `.b` …) with value labels.
- SPSS files use user-missing values (e.g. 8, 9).

The readers used to turn these into plain blanks, so the Timeline could not count them.

What happens now:

- The cells stay missing for every other analysis, as in Stata and haven.
- The Stata reader keeps each cell's letter (`col.x`: 1 = `.a` … 26 = `.z`), from Stata 8 files onward. Labels stay under
  Stata's code (`.a` = 2147483622; `dtaXCode`).
- The SPSS reader keeps the user-missing code (`col.um`).
- Sessions and the browser autosave keep both.
- The Timeline counts these codes as answers: lines, part of the 100%, listed under Leave out with their code (`.a`,
  `.b`, `9`). They count as non-substantive answers, so they are drawn in grey and the mean score leaves them out.
- `tests/timeline-coded.test.mjs` checks the same question coded three ways against R's `survey`: as 3/9, as `.a`/`.b`
  in Stata 15 and Stata 12 files, and as SPSS user-missing codes.
