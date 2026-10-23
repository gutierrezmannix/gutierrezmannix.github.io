# Network validation — 2026-10-23.10

The network analyzer uses binary, loop-free graphs. Duplicate ties are merged; directed reciprocal ties remain distinct. A supplied nodes file fixes vertex order and retains isolates. Blank or duplicate node IDs block preparation; edges with unknown endpoints are excluded and counted. No selected attribute is mean-imputed. Dataset filters, edge weights and survey weights do not apply to this separate network dataset.

## Reproduce

```sh
Rscript calculator/tests/network-reference.R /tmp/gm26-network-reference
GM26_NETWORK_R_DIR=/tmp/gm26-network-reference node calculator/tests/network.test.mjs
node calculator/tests/time-series.test.mjs
```

The R script requires `sna` and `network`. With the supplied media files available locally, pass their paths as the second and third R arguments, and set `GM26_NETWORK_EDGES` and `GM26_NETWORK_NODES` for the Node test. User CSV files are not committed.

## Executed comparisons

R 4.3.3, sna 2.7-2, network 1.18.2. Seed 8261. Twenty R-generated networks (10 directed and 10 undirected), each with 18 vertices and varied densities. All 200 comparisons passed: six centrality vectors per network and 80 logistic MPLE models covering edges, reciprocity, triangles, nodematch, nodecov, and absdiff. Coefficients and centralities agree to absolute tolerance 1e-7; standard errors to 1e-6. PageRank is compared to an independent R linear-system solution with damping .85 and uniform dangling-node redistribution.

For the supplied files: 48 nodes, 937 edge rows, 48 self-ties removed, 889 directed ties; density .39406028368794327, mean total degree 37.041666666666664, edgewise reciprocity .7379077615298087. Directed centrality maximum absolute errors versus sna were below 1e-10. Default edges + mutual MPLE coefficients are -1.582468030722029 and 2.6175903661004316, matching base-R binomial GLM. The generated standalone R snapshot was executed with network/sna and retained the exact adjacency and ID order.

These are comparisons to sna and base-R conditional logistic MPLE, **not** a full MCMC ERGM validation. The ergm package was not installed in the validation runtime. Exported R includes an optional ergm MPLE fit and requests the complete dyad sample. Naive MPLE standard errors do not account for network dependence; dependent-term p-values are provisional.

## Definitions and repairs

- Directed degree is in-degree + out-degree; mean degree is 2E/N.
- Betweenness is raw Freeman betweenness, honoring direction.
- Closeness uses outgoing paths, (N−1)/sum(distance); zero when any other node is unreachable, matching sna. Harmonic centrality provides a useful alternative for disconnected graphs.
- Eigenvector uses the right eigenvector of outgoing adjacency, matching sna, scaled to maximum 1. Shifted power iteration resolves bipartite oscillation. Unavailable/nonconvergent scores are displayed as n/a, with finite plot radii. Reducible graphs may have nonunique dominant eigenvectors; their coordinates are not uniquely defined by the network.
- Directed triangle changes count orientation multiplicity; they no longer use binary undirected common-neighbor counts.
- Plot edges have direction arrows. All five layouts, attribute coloring, labels, sizing, PNG/SVG, copy and adding centralities remain available for networks up to 400 nodes.
- The R export contains the prepared graph snapshot. It preserves node order, isolates and cleaning exactly, supports DTA/current edited datasets, and does not depend on CSV name conversion or source-file order.
- Valid descriptives/plots survive an undefined, separated, collinear or oversized model. No unstable model is presented as a completed fit. Changing a model specification clears stale results.
- Adding or replacing centrality variables aligns by node ID and can be undone as one operation.

Additional tests cover duplicate/blank/mismatched IDs, duplicate and reciprocal ties, self-loop-only isolates, large numeric ID formatting, missing attributes, disconnected graphs, bipartite eigenvectors, directed SVG markers, nonfinite node sizes, actual component error recovery, dataset write-back, and undo. Existing calendar/time-series tests also passed, including the supplied Stata data.

Primary definitions: [sna degree](https://search.r-project.org/CRAN/refmans/sna/html/degree.html), [closeness](https://search.r-project.org/CRAN/refmans/sna/html/closeness.html), [evcent](https://search.r-project.org/CRAN/refmans/sna/html/evcent.html), [ergm triangle](https://search.r-project.org/CRAN/refmans/ergm/html/triangle-ergmTerm-9b49a585.html).
