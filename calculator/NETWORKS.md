# Networks analysis (Design A) — build 2026-10-31.50

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
- Goodness of fit: 100 networks simulated from the estimate; degrees, edgewise shared partners and distances.

## Validation (`tests/net-lab.test.mjs`)

R and `ergm` could not be installed in the build environment, so the estimator is checked without them:

1. For every term, the statistics tracked by the sampler equal a brute-force recount on every sampled network
   (directed and undirected).
2. An edges-only model simulates the binomial number of ties.
3. Models without dyad dependence: the MCMC estimate equals the exact maximum likelihood (logistic MPLE).
4. Known parameters (edges, mutual, gwesp, nodematch) are recovered from networks simulated with them.
5. Triad census against a direct classification of every triad; k-cores, Burt’s constraint and effective size on known
   graphs; Louvain on two cliques; homophily statistics.

To compare with R on your computer: `Rscript calculator/tests/net-lab-reference.R edges.csv nodes.csv` prints
`ergm()` estimates for the same models as the calculator’s defaults.

## Build and test

```sh
python calculator/tools/text_lab.py
node --test calculator/tests/net-lab.test.mjs calculator/tests/net-lab-component.test.mjs
GM26_NET_FILES="/path/edges.csv,/path/nodes.csv" node --test calculator/tests/net-lab-component.test.mjs
GM26_NET_FILES="/path/edges.csv,/path/nodes.csv" NODE_PATH=$(npm root -g) node calculator/tests/net-lab-e2e.cjs
```

Sources: `src/net-lab-engine.mjs`, `src/net-lab-layout.mjs`, `src/net-lab-ergm.mjs`, `src/net-lab*.js`,
`src/net-lab.css`, `tools/net_lab.py`. CSV files saved by Excel on Windows (cp1252) are now read with their accents.
