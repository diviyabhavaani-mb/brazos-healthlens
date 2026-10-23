"""
Step 3 · Build data/healthlens_data.js, the file the dashboard reads.

    python pipeline/build_data.py
    python pipeline/build_data.py --places X.csv --ruca Y.xlsx --geo tract_geo.csv --out data/healthlens_data.js

Inputs : PLACES tract CSV (download.py), RUCA file (download.py), pipeline/work/tract_geo.csv (build_topology.py)
Output : window.HL_DATA = {...}

What it computes
  * estimates and 95% CIs for 33 measures (stored as integers = percent x 10) and derived "untreated BP"
  * adult-weighted averages for Texas, the Brazos Valley, each county and each urban-rural class
  * Texas z-scores of 23 core measures, signed so + = worse                       (R3, R5)
  * low-confidence threshold: 90th percentile of CI width per measure            (R4)
  * PCA + k-means profile groups (best silhouette over k = 4..8), ordered by burden (R3)
  * the 20 nearest peer tracts of every tract (Euclidean on the 23 z-scores)     (R3)
  * burden and care-deficit indices for the care-gap view                        (R5)
"""
import argparse
import datetime as dt
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.neighbors import NearestNeighbors

import config as C

MIDS = [m["id"] for m in C.MEASURES]
GOOD = {m["id"]: bool(m["good"]) for m in C.MEASURES}


# ---------------------------------------------------------------- inputs
def load_places(path):
    df = pd.read_csv(path, dtype=str)
    df.columns = [c.lower() for c in df.columns]
    if "datavaluetypeid" in df:
        df = df[df["datavaluetypeid"] == "CrdPrv"]
    elif "data_value_type" in df:
        df = df[df["data_value_type"].str.startswith("Crude")]
    df = df[df["stateabbr"] == C.STATE]
    df = df[df["measureid"].isin(MIDS)].copy()
    df["gid"] = df["locationname"].str.zfill(11)
    for c in ["data_value", "low_confidence_limit", "high_confidence_limit", "totalpopulation", "totalpop18plus"]:
        df[c] = pd.to_numeric(df[c].str.replace(",", ""), errors="coerce")
    return df


def load_ruca(path):
    p = Path(path)
    df = pd.read_excel(p, dtype=str) if p.suffix in (".xlsx", ".xls") else pd.read_csv(p, dtype=str)
    if not any("fips" in c.lower() for c in df.columns):        # some ERS files have notes above the header
        hdr = df.index[df.apply(lambda r: r.astype(str).str.contains("FIPS", case=False).any(), axis=1)][0]
        df.columns = df.iloc[hdr]
        df = df.iloc[hdr + 1:]
    cols = {c.lower().replace(" ", "").replace("_", ""): c for c in df.columns if isinstance(c, str)}
    fips = next(cols[k] for k in cols if "tract" in k and "fips" in k)
    code = next(cols[k] for k in cols if k.startswith("primaryruca") or k in ("ruca1", "primaryrucacode"))
    s = df[[fips, code]].dropna(subset=[fips])
    return dict(zip(s[fips].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(11), s[code].map(C.ruca_class)))


# ---------------------------------------------------------------- helpers
def wmean(vals, w):
    ok = ~np.isnan(vals)
    return float(np.sum(vals[ok] * w[ok]) / np.sum(w[ok])) if ok.any() else None


def ints(a, scale):
    return [None if np.isnan(x) else int(round(x * scale)) for x in a]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--places", default=C.PLACES_CSV)
    ap.add_argument("--ruca", default=C.RUCA_FILE)
    ap.add_argument("--geo", default=C.TRACT_GEO_CSV)
    ap.add_argument("--out", default=C.DATA / "healthlens_data.js")
    ap.add_argument("--retrieved", default=None, help="date the PLACES file was downloaded (default: file date)")
    a = ap.parse_args()

    geo = pd.read_csv(a.geo, dtype={"GEOID": str, "CO": str, "tract": str, "place": str}).fillna({"place": ""})
    gids = geo["GEOID"].tolist()
    N = len(gids)
    P = load_places(a.places)
    ruca = load_ruca(a.ruca)
    print(f"{N:,} map tracts · {P['gid'].nunique():,} tracts with PLACES rows · {len(ruca):,} RUCA codes")

    piv = {k: P.pivot_table(index="gid", columns="measureid", values=c, aggfunc="first").reindex(index=gids, columns=MIDS)
           for k, c in [("v", "data_value"), ("lo", "low_confidence_limit"), ("hi", "high_confidence_limit")]}
    V = {m: piv["v"][m].to_numpy(float) for m in MIDS}
    LO = {m: piv["lo"][m].to_numpy(float) for m in MIDS}
    HI = {m: piv["hi"][m].to_numpy(float) for m in MIDS}
    V["UNTREATED"] = V["BPHIGH"] * (1 - V["BPMED"] / 100)
    first = P.groupby("gid").first().reindex(gids)
    pop = first["totalpopulation"].fillna(0).to_numpy(float)
    adults = first["totalpop18plus"].fillna(0).to_numpy(float)
    has = ~np.isnan(V["DIABETES"])
    cfp = geo["CO"].str.zfill(3).to_numpy()
    in_bv = np.isin(cfp, list(C.BV_COUNTIES))
    ru = np.array([ruca.get(g, 4) for g in gids])
    years = P.groupby("measureid")["year"].first().astype(int).to_dict()
    cnames = P.groupby(P["countyfips"].str[-3:])["countyname"].first().to_dict()
    tx = np.where(has)[0]
    bv = np.where(has & in_bv)[0]

    # ---- standardization (R3, R5) and reliability threshold (R4)
    mu = {m: float(np.nanmean(V[m][tx])) for m in MIDS}
    sd = {m: float(np.nanstd(V[m][tx], ddof=1)) for m in MIDS}
    Z = {m: (V[m] - mu[m]) / sd[m] * (-1 if GOOD[m] else 1) for m in MIDS}
    p90 = {m: round(float(np.nanpercentile((HI[m] - LO[m])[tx], C.LOW_CONF_PCT)), 1) for m in MIDS}
    burden = np.nanmean(np.vstack([Z[m] for m in C.BURDEN]), axis=0)
    deficit = np.nanmean(np.vstack([Z[m] for m in C.CARE]), axis=0)

    # ---- profile groups: PCA then k-means (R3)
    X = np.nan_to_num(np.column_stack([Z[m][tx] for m in C.CORE]))
    pca = PCA(random_state=C.SEED).fit(X)
    npc = int(np.searchsorted(np.cumsum(pca.explained_variance_ratio_), C.PCA_VAR) + 1)
    S = pca.transform(X)[:, :npc]
    rng = np.random.default_rng(C.SEED)
    samp = rng.choice(len(S), size=min(3000, len(S)), replace=False)
    sil, fits = {}, {}
    for k in C.K_RANGE:
        km = KMeans(n_clusters=k, n_init=C.KMEANS_RESTARTS, random_state=C.SEED).fit(S)
        fits[k] = km.labels_
        sil[str(k)] = float(silhouette_score(S[samp], km.labels_[samp]))
    K = int(max(sil, key=sil.get))
    if K != len(C.CLUSTERS):
        print(f"  note: best k = {K} but config.CLUSTERS names {len(C.CLUSTERS)} groups; using k = {len(C.CLUSTERS)}")
        K = len(C.CLUSTERS)
        if K not in fits:
            fits[K] = KMeans(n_clusters=K, n_init=C.KMEANS_RESTARTS, random_state=C.SEED).fit(S).labels_
    lab = fits[K]
    order = np.argsort([burden[tx][lab == c].mean() for c in range(K)])   # group 0 = lowest burden
    remap = np.empty(K, int)
    remap[order] = np.arange(K)
    lab = remap[lab]
    ari = [round(float(adjusted_rand_score(lab, KMeans(n_clusters=K, n_init=C.KMEANS_RESTARTS, random_state=s).fit(S).labels_)), 3)
           for s in range(101, 106)]
    cl = np.full(N, -1)
    cl[tx] = lab

    # ---- peers: 20 nearest tracts on the 23 z-scores (R3)
    nn = NearestNeighbors(n_neighbors=C.N_PEERS + 1).fit(X)
    _, idx = nn.kneighbors(X)
    peers = {str(int(tx[r])): [int(tx[j]) for j in row if j != r][:C.N_PEERS] for r, row in enumerate(idx)}

    # ---- aggregates
    ALL = MIDS + ["UNTREATED"]
    ref = {"tx": {m: round(wmean(V[m][tx], adults[tx]), 2) for m in ALL},
           "bv": {m: round(wmean(V[m][bv], adults[bv]), 2) for m in ALL},
           "ru": {}}
    for k in range(4):
        ids = tx[ru[tx] == k]
        if len(ids):
            ref["ru"][str(k)] = {m: round(wmean(V[m][ids], adults[ids]), 2) for m in ALL}
    counties = {}
    for c in sorted(set(cfp[tx])):
        ids = tx[cfp[tx] == c]
        counties[c] = {"name": cnames.get(c, C.BV_COUNTIES.get(c, c)), "n": int(len(ids)), "pop": int(pop[ids].sum()),
                       "adults": int(adults[ids].sum()), "m": {m: round(wmean(V[m][ids], adults[ids]), 2) for m in ALL}}
    cl_z = {m: [round(float(np.nanmean(Z[m][tx][lab == k])), 3) for k in range(K)] for m in MIDS}
    cl_raw = {m: [round(float(np.nanmean(V[m][tx][lab == k])), 2) for k in range(K)] for m in MIDS}

    aland = pd.to_numeric(geo.get("aland_sqmi"), errors="coerce").to_numpy(float) if "aland_sqmi" in geo else np.full(N, np.nan)
    dens = np.where(aland > 0, pop / aland, np.nan)
    retrieved = a.retrieved or dt.date.fromtimestamp(Path(a.places).stat().st_mtime).isoformat()

    out = {
        "meta": {"source": C.SOURCE_TEXT, "dataset": C.PLACES_DATASET, "url": C.PLACES_URL.replace(".csv", ""), "retrieved": retrieved,
                 "years": {m: int(years.get(m, 2023)) for m in MIDS}, "geometry": C.GEOMETRY_TEXT, "ruca": C.RUCA_TEXT,
                 "ntx": int(len(tx)), "ngeom": N, "nbv": int(len(bv)), "core": C.CORE, "burden": C.BURDEN, "care": C.CARE,
                 "npc": npc, "K": K, "sil": sil, "ari": ari, "ru_names": C.RU_NAMES,
                 "pca_ev_top3": [round(float(x), 4) for x in pca.explained_variance_ratio_[:3]],
                 "p90": p90, "mu": {m: round(mu[m], 3) for m in MIDS}, "sd": {m: round(sd[m], 3) for m in MIDS},
                 "format_version": 3, "notes": "Built by pipeline/build_data.py"},
        "measures": C.MEASURES,
        "tracts": {"gid": gids, "tract": geo["tract"].tolist(), "cfp": cfp.tolist(), "place": geo["place"].tolist(), "ru": ru.tolist(),
                   "pop": pop.astype(int).tolist(), "adults": adults.astype(int).tolist(), "dens": [None if np.isnan(x) else int(round(x)) for x in dens]},
        "v": {m: ints(V[m], 10) for m in MIDS}, "lo": {m: ints(LO[m], 10) for m in MIDS}, "hi": {m: ints(HI[m], 10) for m in MIDS},
        "untreated": ints(V["UNTREATED"], 10),
        "cl": [None if c < 0 else int(c) for c in cl], "cl_z": cl_z, "cl_raw": cl_raw,
        "cl_size": [int((lab == k).sum()) for k in range(K)], "cl_bv": [int((cl[bv] == k).sum()) for k in range(K)],
        "peers": peers, "burden": ints(np.where(has, burden, np.nan), 100), "deficit": ints(np.where(has, deficit, np.nan), 100),
        "ref": ref, "counties": counties, "bv_cfp": sorted(C.BV_COUNTIES), "clusters": C.CLUSTERS, "labels": C.LABELS,
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write("// Generated by pipeline/build_data.py. Sources: CDC PLACES 2025, Census 2020 boundaries, USDA ERS RUCA 2020\n")
        f.write("window.HL_DATA = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
    print(f"  -> {a.out}: {len(tx):,} tracts, k = {K} (silhouette {sil[str(K)]:.3f}), {npc} PCs, groups {out['cl_size']}")


if __name__ == "__main__":
    main()
