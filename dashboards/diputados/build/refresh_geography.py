#!/usr/bin/env python3
"""Refresh only dashboard geography from a local Stata file; never copy the input.

Usage: python build/refresh_geography.py /private/path/to/file.dta
Requires pandas. Existing voting summaries and strip pictures are preserved.
"""
import argparse
import datetime
import json
import re
from pathlib import Path

import pandas as pd

STATES = [
    "Aguascalientes", "Baja California", "Baja California Sur", "Campeche",
    "Coahuila", "Colima", "Chiapas", "Chihuahua", "Ciudad de México", "Durango",
    "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "México", "Michoacán",
    "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro",
    "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
    "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
]
PARTIES = ["PAN", "PRI", "PRD", "MORENA", "PVEM", "PT", "MC"]
GOV = {58: "PAN", 59: "PAN", 60: "PAN", 61: "PAN", 62: "PRI", 63: "PRI",
       64: "MORENA", 65: "MORENA", 66: "MORENA"}


def load_public(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text.split("window.DIP =", 1)[1].strip().removesuffix(";"))


def refresh(source, output):
    public = load_public(output)
    df = pd.read_stata(source, convert_categoricals=False)
    if len(df) != public["meta"]["totals"]["rows"]:
        raise ValueError("Roster changed: rebuild the full dashboard instead.")
    df["p"] = df["party"].where(df["party"].isin(PARTIES), "Other")
    names = df["state"].fillna("").str.strip().replace({"Distrito Federal": "Ciudad de México"})
    df["cve"] = names.map({name: f"{i:02d}" for i, name in enumerate(STATES, 1)})
    state_rows = []
    for leg in public["legs"]:
        term = int(leg["legislature"])
        group = df[df["legislature"].eq(term)].copy()
        scored = group[group["score"].notna()].copy()
        if len(scored) != leg["scored"]:
            raise ValueError(f"Scored roster changed in term {term}; rebuild all views.")
        sign = 1 if scored.loc[scored.p.eq(GOV[term]), "score"].median() > scored.loc[scored.p.ne(GOV[term]), "score"].median() else -1
        if sign != leg["s"]:
            raise ValueError(f"Score orientation changed in term {term}.")
        scored["x"] = scored["score"] * sign
        # Check all-member summaries before preserving the existing score views.
        for row in (r for r in public["coh"] if r["legislature"] == term and r["who"] == "all"):
            values = scored.loc[scored.p.eq(row["p"]), "x"]
            if len(values) != row["n"] or abs(float(values.median()) - row["med"]) > .001:
                raise ValueError(f"Voting summaries changed in term {term}.")
        titulares = scored[scored["is_suplente"].eq(0)]
        mapped = titulares[titulares["cve"].notna()]
        # Unknown roles are not silently converted to titulares on state maps.
        leg.update(
            hasGeo=not mapped.empty,
            geoMapped=len(mapped),
            geoScoredTit=len(titulares),
            geoMissingState=int(titulares["cve"].isna().sum()),
            geoUnknownRole=int(scored["is_suplente"].isna().sum()),
            geoStates=int(mapped["cve"].nunique()),
            nMR=int(group["election_type"].eq("MR").sum()),
            nRP=int(group["election_type"].eq("RP").sum()),
        )
        for cve, state in mapped.groupby("cve", sort=True):
            enough = len(state) >= 5
            state_rows.append({
                "legislature": term, "cve": cve, "n": len(state),
                "mean": round(float(state["x"].mean()), 3) if enough else None,
                "med": round(float(state["x"].median()), 3) if enough else None,
                "parties": {str(p): int(n) for p, n in state["p"].value_counts().sort_index().items()},
            })
    public["states"] = state_rows
    match = re.search(r"WORKING_v\d+", source.stem)
    public["meta"]["geographySource"] = match.group(0) if match else "local metadata update"
    public["meta"]["geographyBuilt"] = datetime.date.today().isoformat()
    # Only anonymous group summaries are serialized. No names, IDs, individual
    # positions, file paths, evidence URLs, or per-member rows enter the output.
    for row in state_rows:
        assert set(row) == {"legislature", "cve", "n", "mean", "med", "parties"}
        assert sum(row["parties"].values()) == row["n"]
        assert row["n"] >= 5 or (row["mean"] is None and row["med"] is None)
    output.write_text(
        "/* Public dashboard summaries only. Geography refreshed locally; the Stata source is never published. */\nwindow.DIP = "
        + json.dumps(public, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + ";\n",
        encoding="utf-8",
    )
    for leg in public["legs"]:
        print(f'{leg["roman"]}: {leg["geoMapped"]} recorded titulares, {leg["geoStates"]}/32 states')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent.parent / "data" / "diputados-agg.js")
    args = parser.parse_args()
    refresh(args.source, args.output)
