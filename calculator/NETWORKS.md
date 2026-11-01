# Networks analysis (Design A) — build 2026-11-01.51

Tests → Networks analysis is rebuilt as eight guided steps, in the style of Text analysis. Everything runs in
the page, offline; heavy work (layouts, permutation tests, the network model) runs in a background worker.

| Step | What it does | Based on |
|---|---|---|
| 1 Data | Ties file (CSV, Excel, Stata; NodeXL/Gephi/UCINET edge lists recognised) and optional people file. Dropdowns for sender, receiver, tie strength, kind of tie, date; keep/drop kinds of tie (e.g. Mentions, Retweet); kinds recorded once that mean both ways (alliances) are detected; minimum strength; years. **Label people with** any column, with an option to drop titles (“Rep.”, “Senator”, “Office of”). Characteristics picked automatically; NodeXL display and metric columns hidden. Cross-check with NodeXL’s own In-Degree. | NOAA guide (data management), Capener (edge lists) |
| 2 Overview | Density, reciprocity, clustering compared with 100 random networks of the same size (CUG), distances, centralization, separate pieces and isolates, number of groups, dyad census, in-degree distribution, triad census against chance (random networks with the same mutual/one-way/empty pairs, U\|MAN), all in plain words | Kadushin ch. 2–3; Capener network-level metrics |
| 3 Map | Each separate piece laid out on its own (stress majorization from a pivot-MDS start), the main piece gets the space, small pieces in a side column, isolates in a strip; labels from the chosen column, never cut, never overlapping (white halo); colour by groups or any characteristic; size by any measure; tie width = strength; dashed kinds of tie; arrows (automatic for sparse networks); top/bottom 20 (Fowler figs. 3–4); click anyone for an inspector with ties, measures and broker roles; PNG 150/300/600 dpi and SVG | Kadushin ch. 1, 3; Fowler |
| 4 People | Eight questions: attention (in-degree), reaching out (out-degree), bridges (betweenness), reach (closeness/harmonic), connected to the well-connected (eigenvector, PageRank), brokers (Burt constraint, effective size, Gould–Fernandez roles), best connected counting strength (Fowler’s connectedness, distances = 1/strength), core (k-core); full names; correlation matrix of measures (Fowler Table 6) | Kadushin ch. 3, 5, 7; Fowler §6–7; NOAA |
| 5 Groups | Communities (Louvain, modularity, resolution), core/periphery (k-cores), cliques, same position (structural equivalence, complete-linkage on profile correlations), separate pieces; group cards with members and characteristics; density within/between groups; save as a variable | Kadushin ch. 4, 8 |
| 6 Ties & similarity | Homophily: mixing table, % within vs expected, E–I index, assortativity, permutation test (1,000 shuffles); numeric characteristics: difference of tied vs untied pairs. **Network model (ERGM)** — pick reasons (returned ties, friends of friends, popularity, same/higher/similar characteristic), press Run; MCMC maximum likelihood like R’s `ergm()`; converged / not converged badge; plain-language messages with fix buttons (missing values, infinite estimates, degenerate models); odds ratios with confidence intervals; goodness-of-fit plots like `plot(gof(fit))` | Kadushin ch. 2 (homophily, triads), statnet |
| 7 Over time | One network per year (ties, active people, density, reciprocity, % across groups) with charts; heads-up when NodeXL merged repeated ties; sub-networks side by side (e.g. House vs Senate) | Fowler (per Congress), Kadushin ch. 9 |
| 8 Save | Measures and groups added to the current dataset (matched by ID, undoable) or downloaded; edge list, weighted matrix, GraphML for Gephi; hide names in exports (P1, P2, …); statnet R code that recreates every step | Kadushin ch. 11 (ethics); NOAA (trust) |

## The network model (ERGM)

- Terms: `edges`, `mutual`, `gwesp(0.5, fixed = TRUE)` (outgoing two-paths for directed networks, as ergm ≥ 4),
  `gwidegree`/`gwodegree`/`gwdegree(0.5, fixed = TRUE)`, `nodematch`, `nodecov`, `nodeicov`, `nodeocov`, `absdiff`.
- Estimation: MPLE start → Markov chain Monte Carlo maximum likelihood with the tie/no-tie (TNT) sampler; each round
  restarts its chain from the observed network; Hummel-style targets, log-normal Newton steps inside an
  importance-sampling trust region (Geyer–Thompson); the sampling interval grows until the effective sample size
  is large enough; Polyak averaging near the answer; standard errors from the covariance of the simulated statistics;
  convergence = simulated statistics within 0.12–0.2 standard deviations of the observed ones.
- Safeguards: runaway (almost empty/complete or stuck) simulations step back towards the last good estimate before the
  model is declared degenerate; a time limit (90 s) with a clear “not converged” message and advice.
- Polishing: once settled, larger well-mixed samples and full Newton steps until every statistic is within Monte Carlo
  error of the observed value; that sample gives the final standard errors.
- Goodness of fit: 100 networks simulated from the estimate; degrees, edgewise shared partners and distances.

## When a model does not converge (build .56)

A small alert under the result names the reason and offers the fix, most important reason first:

| Reason | Example message | Fix button |
|---|---|---|
| A structural effect mixes too slowly | “Friends of friends” is the problem: only 69 of 228 ties (30%) share a contact and the network has few triangles, so the simulation keeps producing almost the same networks. The characteristics are not the problem. | Remove it and run · Run longer |
| A characteristic almost perfectly predicts ties | nearly every tie falls inside the same groups, so its effect heads towards infinity | Remove it and run |
| A characteristic has a tiny group | only 3 people have financial = 1 | Remove it and run |
| A number with extreme values, or one that does not vary | one value lies 9 standard deviations from the mean | Remove it and run |
| No standard error for an effect | the simulated networks hardly vary on it | Remove it and run |
| The effects together are near-degenerate | the simulated networks jump between very different shapes | Remove the effect to blame |
| Nothing wrong with the data | it ran out of time while the estimates were still settling | Run longer |

**Run longer** now really runs longer: each press doubles the time allowed (90 s → 3 min → 6 min), allows more rounds
and starts a fresh chain (it used to repeat the same 90-second run with the same seed). The diagnosis is
`nlErgmDiagnose()` in `src/net-lab-ergm.mjs`, tested in `tests/net-lab.test.mjs`. On the cartel files (390 groups,
331 ties), mutual + friends of friends + same sinaloa does not converge (friends of friends is named); the same model
without it converges in about 20 s.

## Validation against R

`tests/r/net-lab-compare.R` checks the calculator against R 4.3 with **sna 2.7-2, network 1.18.2 and igraph 1.6**
(`tests/r/net-lab-export.mjs` writes what the calculator computes). Results on the Congress (48 people, 889 ties) and
cartel (390 groups, 331 ties) NodeXL files:

- The network R builds from the raw files is identical to the calculator’s (same ties, same strengths).
- Exact agreement (differences below 1e-9): density, reciprocity, clustering, separate pieces, isolates, average
  distance, diameter, centralization, triad census (16 types), modularity, assortativity, share of ties within groups,
  maximal cliques; in/out-degree, betweenness, closeness, harmonic closeness, eigenvector, PageRank, Burt’s constraint,
  k-cores, local clustering, effective size, Fowler’s connectedness and the five Gould–Fernandez broker roles.
- Louvain: the calculator’s groups reach the best modularity of 20 R runs (0.330 Congress, 0.706 cartel).
- Network model: observed statistics identical; MPLE identical to `glm()` on the change statistics (to 1e-7).
  Models without dyad dependence equal the exact maximum likelihood (within 0.02). Models with returned ties plus
  same-group terms are still pair-by-pair, so `tests/r/net-lab-exact-mutual.R` computes their exact maximum likelihood:
  the calculator’s MCMC estimates agree within 0.04 standard errors (Congress and cartel), standard errors within 6%.
  For models with friends of friends or popularity, an **independent R Markov chain simulation at the calculator’s
  estimates reproduces the observed statistics** (Congress: |t| ≤ 0.17, within Monte Carlo error). This check found
  that popularity terms needed a final polishing stage, now part of the estimator.
- Friends-of-friends and popularity terms mix slowly, so short R chains are noisy: a first R run on the undirected
  cartel model (gwesp) gave t = −0.6, and on Congress gwideg a standard error of 1.78 vs 1.22. Repeating R’s chain
  settings 30 times shows that spread is chance (t from −0.9 to +0.8). Three longer independent R chains, pooled, give
  t = −0.015 to 0.012 and a gwesp standard error of 0.0857 (calculator 0.0863); a 40-million-step chain gives the
  gwideg standard error as 1.16 (calculator 1.22). The R script now says so when it flags a term, and takes a seed
  (argument 10) so runs can be pooled.

`ergm` itself could not be installed in the build environment (its source download was blocked), so
`tests/net-lab-reference.R` lets you compare with `ergm()` on your computer.

Engine tests (`tests/net-lab.test.mjs`): sampler statistics equal brute-force recounts; edges-only simulation is
binomial; exact MLE for dyad-independent models; known parameters recovered from simulated networks; triad census vs a
direct classification; k-cores, constraint, Louvain, homophily; NodeXL import.

## Build and test

```sh
python3 calculator/tools/build.py
node --test calculator/tests/net-lab.test.mjs calculator/tests/net-lab-component.test.mjs
GM26_NET_FILES="/path/edges.csv,/path/nodes.csv" node --test calculator/tests/net-lab-component.test.mjs
GM26_NET_FILES="/path/edges.csv,/path/nodes.csv" NODE_PATH=$(npm root -g) node calculator/tests/net-lab-e2e.cjs
```

Sources: `src/net-lab-engine.mjs`, `src/net-lab-layout.mjs`, `src/net-lab-ergm.mjs`, `src/net-lab*.js`,
`src/net-lab.css`, `tools/net_lab.py`. CSV files saved by Excel on Windows (cp1252) are now read with their accents.
