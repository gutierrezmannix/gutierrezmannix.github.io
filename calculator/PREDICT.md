# Predict (machine learning) — build 2026-11-15.99

Tests → Predictive modeling → Predict (machine learning) asks one question: *given the other
variables, how well can we predict this answer, and what does the model lean on?* It is the
supervised-learning companion to the Regression tab. Regression is for explaining and for
causal claims; Predict is for out-of-sample accuracy. Everything runs inside `index.html`,
offline, in the background worker; nothing leaves the browser.

## The six steps

| Step | What you do | What the page does |
|---|---|---|
| 1 Setup | pick the outcome (a coded yes/no question or a number), which answer counts as "yes", answers to leave out (Don't know, Not applicable, missing codes), and the predictors (All variables / Clear) | detects the outcome type; flags **possible leakage**: a near-copy of the outcome, another item of the same question battery, an ID-like column, the weight variable (Leave it out / Keep it) |
| 2 Split | random (default 20 % test), by time (test = rows from a cut-point onwards) or by group (hold out whole states, schools, …); folds 5 or 10; a seed; use the survey weight or not | shows the training and test cards; the test set is **locked** until step 4 |
| 3 Models | choose among logit (baseline, always offered), lasso, decision tree, random forest, gradient boosting, k-nearest neighbours; rank by AUC / balanced accuracy / Brier / log loss (RMSE / MAE / R² for a number); trees for the forest; a group variable for step 5 | runs in the worker with progress and Cancel; tuning (λ, depth, mtry, rounds, k) by cross-validation on the training set only |
| 4 Evaluate | read the leaderboard; open the test set **once** for one model | leaderboard with the null model first (always the most common answer: AUC 0.500 by definition), CV mean ± sd per model, the tuned setting; then ROC, calibration and confusion matrix with a threshold slider on the test set, bootstrap CI for the AUC, predicted-against-observed for a number |
| 5 Interpret | choose a variable and a "by" variable | permutation importance (drop in test AUC when the variable is shuffled, 5 repeats); partial dependence with ICE lines and by group; does it work equally for everyone (test set by group: n, AUC, sensitivity, specificity, % predicted) |
| 6 Use | add the variables; copy the model card | `p_<outcome>_<model>` (probability), `<outcome>_<model>_hat` (predicted answer), `<outcome>_fold` (0 = test set); a model card with data, split, models, test metrics and "Not for"; R and Stata code for the same analysis |

Opening the test set is deliberate: cross-validation on the training set is where models are
compared and tuned; the test set answers one question once. If settings change after a run the
leaderboard is marked stale until the models are run again.

## Methods

| Model | Implementation | R reference |
|---|---|---|
| Logit / linear regression | weighted IRLS / weighted least squares, one-hot coding with the first level as reference, medians for missing numbers, a "missing" level for missing codes | `glm`, `lm` |
| Lasso | coordinate descent on standardised columns, 100 λ values, λ by inner 5-fold CV (1-se rule) | `glmnet::cv.glmnet` |
| Decision tree | CART, weighted Gini / SSE, depth and minimum leaf tuned by CV | `rpart` |
| Random forest | weighted bootstrap, mtry √p, OOB and CV | `ranger` |
| Gradient boosting | depth 3, learning rate 0.1, subsample 0.8, rounds by CV | `gbm` / `xgboost` style |
| k-nearest neighbours | standardised distance, ties at the k-th neighbour included, k by CV | `class::knn` |
| Metrics | weighted Mann–Whitney AUC, balanced accuracy, Brier, log loss; bootstrap CI (200 draws) | `pROC::auc` |

Survey weights are used in every fit, in the metrics and in the importance. The reference
run is `tests/predict-reference.R` on `tests/data/predict-sim.csv`; `tests/predict.test.mjs`
compares the page's engine with it (coefficients, λ path, tree splits, AUC exact or near-exact;
forest within tolerance). `tests/predict-component.test.mjs` walks the six steps on the bundle.

## What it is not

Importance says what the model uses, not what causes the outcome. A model trained on one
survey round, country or population is not tested on another until it is split that way.
Predicted probabilities are for the rows the model was built for; adding them to the data is
for description and further modelling, not for individual decisions.

## Files

`src/predict-engine.mjs` (design, splits, fits, metrics, importance, partial dependence),
`src/predict-lab.js` (the six steps, worker call, save, model card, code),
`src/predict-lab.css`, `tools/predict_lab.py` (integration into `src/app/`).
