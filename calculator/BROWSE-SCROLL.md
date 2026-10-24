# Scrolling data browser and fluid workspace

Build 2026-10-24.20 replaces the data browser's 100-row / 14-variable pages with a native two-axis scroll region. Column headings remain at the top; row numbers remain at the left. Enter/Up/Down move between rows; Tab and Shift+Tab move across variables and wrap to the adjacent row. Existing Data actions and sessions that specify a browser position still work.

Only visible rows/columns plus a small overscan are rendered. Unfiltered scrolling indexes raw rows directly; filtered scrolling builds and caches a compact index of matching original row IDs. Very large row counts use a compressed scrollbar capped at eight million pixels to avoid browser element-height limits. All rows remain reachable. This affects display only; analyses still use the full eligible dataset.

Cells expose exact raw numeric values for editing and value labels in tooltips. Leaving a cell or scrolling it out of view commits its draft through the existing edit/undo path. Escape cancels the draft. Merely focusing and leaving a cell does not write data or append rows.

The shell's desktop maximum-width cap is removed. The workspace has 12px desktop gutters and 8px mobile gutters. Existing responsive columns, dock controls, palette, analyses and chart sizing controls remain in place.

Build: `PYTHONDONTWRITEBYTECODE=1 python3 calculator/tools/build_time_series.py`

Focused checks: `node calculator/tests/browse-scroll.test.mjs`
