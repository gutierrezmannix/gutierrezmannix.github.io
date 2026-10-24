# Statistical expansion — build 2026-10-24.26

The original embedded analyses, Charts pages, data editor, exports, plot history,
report tools, settings and visual shell remain available. Tests now has expandable
families and a directory. Each of 78 added methods has its own page with Setup,
Results, Diagnostics and Predictions subtabs. Help contains 100 entries, including
all additions. Summary inputs and power calculations can start without a dataset.

## Coverage

See `src/analysis-catalog.json` for the exact methods, controls and R packages.
The additions cover proportion and categorical inference; rank tests; Welch,
factorial and repeated-measures ANOVA, ANCOVA and post-hoc comparisons; new
regression families; mixed and panel models; survival regression; PCA/EFA;
resampling and planning; survey estimates, missingness and multiple imputation;
regularized regression, trees, classification evaluation and clustering; and
merge, append, reshape and duplicate-key tools.

Forecasting includes naïve, seasonal-naïve, drift, ETS, ARIMA/SARIMA and regression
with ARIMA errors. Fourier terms, seasonal indicators and STL support seasonality.
ARDL, VAR/VECM, structural breaks and conditional count time-series regression
provide additional methods. Expanding-window evaluation compares one-step errors
with naïve/drift/seasonal benchmarks using common evaluation origins. Prediction
intervals are distinct from coefficient confidence intervals.

## Runtime and data

Advanced methods use official webR 0.5.8 / R 4.5.1 in a local worker. Runtime and
compatible packages download over HTTPS; data is not sent to a statistical server.
The advanced procedures require external assets and are not wholly contained in
the HTML. The original embedded engine remains self-contained. Browser caching is
not a guarantee that every advanced method will initialize offline.

Inputs use JSON and safe column aliases. Results include actual analysis N,
excluded rows, warnings, R/package versions and reproducible R export. Analysis
results become stale when data, filters, variable treatment, confidence level,
weights or plot colors change. Cancellation closes the worker; failed startup or
package loading can be retried. Sample summaries and planning do not require a raw
file. Data operations preview full datasets, support a second CSV/TSV with different
columns for joins, and apply through the existing atomic Undo mechanism.

## Statistical boundaries

- Non-survey additions require unweighted analyses; active weights trigger an
  explicit guard. Survey methods support weights, strata, PSUs and domain
  estimation retaining the full sampled design. Lonely-PSU handling is not silently
  changed. Survey mean-test confidence intervals explicitly honor Settings.
- Repeated-measures ANOVA requires complete unique subject-by-condition data;
  sphericity corrections appear in Diagnostics. Mixed models handle more flexible
  longitudinal designs but require identification and convergence.
- Linear mixed-model intervals are asymptotic Wald intervals; finite-sample
  Satterthwaite/Kenward–Roger p-values are not supplied. Panel inference clusters by
  panel with G−1 reference degrees of freedom. Difference GMM uses collapsed lag
  instruments; validity still requires substantive and diagnostic assessment.
- ARIMA-based methods require unique regular numeric time indices without missing
  periods or outcomes. Forecast evaluation is one-step, not a full multi-horizon
  validation system. Explanatory forecasts require future predictor rows. Count
  time-series regression uses log(1 + lagged counts), not INAR/INGARCH estimation.
- Supervised prediction uses random train/holdout splits and training-only penalty
  selection; this is suitable for independent rows, not temporal or cluster-aware
  validation. Classification evaluation expects held-out probabilities.
- Multiple imputation uses chained equations and Rubin pooling; the MAR and model
  compatibility assumptions remain the analyst's responsibility.
- Bootstrap supports mean, median or SD with IID or moving-block resampling.
  Permutation location tests require exchangeability, optionally within strata.
- Browser memory and package availability limit dataset sizes. Hierarchical
  clustering is capped at 3,000 rows; secondary uploads at two million cells.

## Validation

Run from the repository root:

```
python calculator/tools/generate_analysis_catalog.py
python calculator/tools/generate_analysis_guide.py
python calculator/tools/build_time_series.py
node --test calculator/tests/*.test.mjs
python calculator/tests/stata-template.test.py
python calculator/tools/prepare_analysis_tests.py /absolute/runtime-directory
# Download webr@0.5.8 with npm pack, extract to runtime-directory/package,
# and install ws into runtime-directory for Node-based webR checks.
DETAILS=1 node calculator/tools/analysis_integration.mjs /absolute/runtime-directory
python calculator/tools/analysis_reference.py /absolute/runtime-directory/integration-results.json
node calculator/tools/analysis_edges.mjs /absolute/runtime-directory
```

The validation covers all 78 methods with synthetic data, 25 independent
NumPy/SciPy numerical comparisons, invalid inputs and alternate options, all
existing component/engine suites, every new setup callback, navigation/subtabs,
packet typing/missingness, stale-result protection, cancellation, exports, and
preview apply/undo. Browser verification additionally exercises real webR/package
loading, a proportion test, ARIMA forecasts/intervals, diagnostics, plot history
and PNG export. Smoke-test coverage is not an independent reference validation of
every advanced estimator or proof of suitability for every study design.
