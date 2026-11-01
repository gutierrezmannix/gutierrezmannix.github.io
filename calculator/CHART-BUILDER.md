# Chart builder (Design A) — builds 2026-11-01.53 and .54

Before this build, the Charts tab had 37 pages built at different times. Each page had its own options, and nine of
them were older charts with fewer options. Most charts had no way to rename groups, show values or pick colors. Every
chart in the Charts tab now goes through one builder with one look and one set of options. Maps keep their current
pages for now; the map tool will be redesigned separately.

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
| `tools/chart_builder.py` | Puts the files into `index.html`. Called by `tools/text_lab.py`. |

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
