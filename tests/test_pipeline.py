"""
Offline test of the Python pipeline (no downloads needed).

    python tests/test_pipeline.py

It rebuilds the pipeline's raw inputs from the shipped data files (a long-format PLACES CSV, a RUCA
CSV and a tract GeoJSON with Census-style columns), runs build_topology.py and build_data.py on them
in a temporary folder, and checks that the results match the shipped data/healthlens_data.js.
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PIPE = ROOT / "pipeline"
RU_CODE = {0: 1, 1: 4, 2: 7, 3: 10, 4: ""}


def load_js(path):
    s = path.read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def topo_to_geojson(t, obj):
    """Minimal TopoJSON decoder (quantized arcs, Polygon/MultiPolygon)."""
    sx, sy = t["transform"]["scale"]
    tx, ty = t["transform"]["translate"]
    arcs = []
    for a in t["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in a:
            x += dx
            y += dy
            pts.append([x * sx + tx, y * sy + ty])
        arcs.append(pts)

    def ring(ids):
        out = []
        for i in ids:
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(pts if not out else pts[1:])
        return out

    feats = []
    for g in t["objects"][obj]["geometries"]:
        if g["type"] == "Polygon":
            geom = {"type": "Polygon", "coordinates": [ring(r) for r in g["arcs"]]}
        elif g["type"] == "MultiPolygon":
            geom = {"type": "MultiPolygon", "coordinates": [[ring(r) for r in p] for p in g["arcs"]]}
        else:
            continue
        feats.append({"type": "Feature", "properties": g.get("properties", {}), "geometry": geom})
    return {"type": "FeatureCollection", "features": feats}


def main():
    D = load_js(ROOT / "data" / "healthlens_data.js")
    T = load_js(ROOT / "data" / "tracts_topo.js")
    tr = D["tracts"]
    N = len(tr["gid"])
    fails = []

    def check(cond, msg):
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # ---- fixture 1: long-format PLACES CSV (Socrata column names)
        rows = []
        cname = {c: o["name"] for c, o in D["counties"].items()}
        for i in range(N):
            if D["v"]["DIABETES"][i] is None:
                continue
            for m in D["measures"]:
                mid = m["id"]
                v = D["v"][mid][i]
                if v is None:
                    continue
                rows.append({"year": D["meta"]["years"][mid], "stateabbr": "TX", "countyname": cname[tr["cfp"][i]],
                             "countyfips": "48" + tr["cfp"][i], "locationname": tr["gid"][i], "measureid": mid,
                             "datavaluetypeid": "CrdPrv", "data_value": v / 10, "low_confidence_limit": D["lo"][mid][i] / 10,
                             "high_confidence_limit": D["hi"][mid][i] / 10, "totalpopulation": tr["pop"][i], "totalpop18plus": tr["adults"][i]})
        pd.DataFrame(rows).to_csv(tmp / "places.csv", index=False)
        # ---- fixture 2: RUCA CSV
        pd.DataFrame({"TractFIPS20": tr["gid"], "PrimaryRUCA": [RU_CODE[r] for r in tr["ru"]]}).to_csv(tmp / "ruca.csv", index=False)
        # ---- fixture 3: tract and place boundaries with Census-style columns
        import geopandas as gpd
        gj = topo_to_geojson(T, "tracts")
        g = gpd.GeoDataFrame.from_features(gj["features"], crs=4326)
        k = {gid: i for i, gid in enumerate(tr["gid"])}
        ii = g["GEOID"].map(k)
        g["NAME"] = [tr["tract"][i] for i in ii]
        g["ALAND"] = [(tr["pop"][i] / tr["dens"][i] * 2_589_988.11) if tr["dens"][i] else 1e6 for i in ii]
        g.to_file(tmp / "tracts.geojson", driver="GeoJSON")
        # one fake place made from the Hearne tract, to exercise the place overlay
        pl = g[g["GEOID"] == "48395960501"][["geometry"]].copy()
        pl["NAME"] = "Hearne"
        pl.to_file(tmp / "places.geojson", driver="GeoJSON")

        print("build_topology.py")
        env = {"PYTHONPATH": str(PIPE)}
        r = subprocess.run([sys.executable, str(PIPE / "build_topology.py"), "--tracts", str(tmp / "tracts.geojson"),
                            "--places", str(tmp / "places.geojson"), "--simplify", "0", "--out", str(tmp / "topo.js")],
                           capture_output=True, text=True, cwd=PIPE)
        print(r.stdout.strip()); print(r.stderr[-2000:]) if r.returncode else None
        check(r.returncode == 0, "build_topology.py runs")
        if r.returncode == 0:
            t2 = load_js(tmp / "topo.js")
            check(len(t2["objects"]["tracts"]["geometries"]) == N, f"{N} tract geometries")
            check(len(t2["objects"]["counties"]["geometries"]) == 254, "254 counties dissolved")
            geo = pd.read_csv(PIPE / "work" / "tract_geo.csv", dtype=str)
            check(geo.loc[geo.GEOID == "48395960501", "place"].iloc[0] == "Hearne", "place overlay names Hearne")
        # build_data reads the shipped tract list/places so the comparison is like for like
        pd.DataFrame({"GEOID": tr["gid"], "CO": tr["cfp"], "tract": tr["tract"], "place": tr["place"],
                      "aland_sqmi": [(p / d) if d else "" for p, d in zip(tr["pop"], tr["dens"])]}).to_csv(tmp / "geo.csv", index=False)

        print("build_data.py")
        r = subprocess.run([sys.executable, str(PIPE / "build_data.py"), "--places", str(tmp / "places.csv"), "--ruca", str(tmp / "ruca.csv"),
                            "--geo", str(tmp / "geo.csv"), "--out", str(tmp / "data.js"), "--retrieved", D["meta"]["retrieved"]],
                           capture_output=True, text=True, cwd=PIPE)
        print(r.stdout.strip()); print(r.stderr[-2000:]) if r.returncode else None
        check(r.returncode == 0, "build_data.py runs")
        if r.returncode:
            sys.exit(1)
        B = load_js(tmp / "data.js")

    check(B["v"] == D["v"] and B["lo"] == D["lo"] and B["hi"] == D["hi"], "estimates and CIs identical")
    check(B["tracts"]["ru"] == D["tracts"]["ru"], "urban–rural classes identical")
    ut = [abs((a or 0) - (b or 0)) for a, b in zip(B["untreated"], D["untreated"])]
    check(max(ut) <= 1, "untreated BP matches (±0.1 pt)")
    dref = max(abs(B["ref"][s][m] - D["ref"][s][m]) for s in ("tx", "bv") for m in D["ref"]["tx"])
    check(dref < 0.02, f"Texas and valley averages match (max diff {dref:.3f})")
    dc = max(abs(B["counties"][c]["m"][m] - D["counties"][c]["m"][m]) for c in D["counties"] for m in D["counties"][c]["m"])
    check(dc < 0.02, f"county averages match (max diff {dc:.3f})")
    dmu = max(abs(B["meta"]["mu"][m] - D["meta"]["mu"][m]) for m in D["meta"]["mu"])
    dsd = max(abs(B["meta"]["sd"][m] - D["meta"]["sd"][m]) for m in D["meta"]["sd"])
    check(dmu < 0.01 and dsd < 0.01, f"z-score means/SDs match ({dmu:.4f}, {dsd:.4f})")
    dp = max(abs(B["meta"]["p90"][m] - D["meta"]["p90"][m]) for m in D["meta"]["p90"])
    check(dp <= 0.15, f"low-confidence thresholds match (max diff {dp:.2f})")
    db = np.nanmax([abs(a - b) for a, b in zip(B["burden"], D["burden"]) if a is not None and b is not None])
    check(db <= 2, f"burden index matches (max diff {db/100:.2f} SD)")
    from sklearn.metrics import adjusted_rand_score
    ok = [i for i in range(N) if D["cl"][i] is not None]
    ari = adjusted_rand_score([D["cl"][i] for i in ok], [B["cl"][i] for i in ok])
    same = np.mean([D["cl"][i] == B["cl"][i] for i in ok])
    check(B["meta"]["K"] == D["meta"]["K"] and ari > 0.95, f"k = {B['meta']['K']}, groups agree (adjusted Rand {ari:.3f}, {same:.1%} same label)")
    ov = np.mean([len(set(B["peers"][k][:10]) & set(D["peers"][k][:10])) / 10 for k in D["peers"]])
    check(ov > 0.9, f"peer lists agree ({ov:.1%} of top-10 peers shared)")
    if fails:
        sys.exit(1)
    print("all pipeline checks passed")


if __name__ == "__main__":
    main()
