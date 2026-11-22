"""
Step 1 · Download the raw data into pipeline/raw/.

    python pipeline/download.py                 # skips files that already exist
    python pipeline/download.py --force         # download again
    python pipeline/download.py --latest        # find the newest PLACES tract release on data.cdc.gov first
    python pipeline/download.py --dataset ID    # use a specific Socrata dataset id

  * CDC PLACES tract data for Texas (Socrata API, paged; about 226,000 rows)
  * Census 2020 cartographic boundaries: Texas tracts and places
  * USDA ERS 2020 RUCA codes (tract level). ERS moves this file now and then, so several URLs are
    tried; if all fail, the RUCA classes already in data/healthlens_data.js are reused (they are
    fixed for 2020 tracts) and the provenance file records that.

Writes pipeline/raw/provenance.json (dataset id, release, row count, download time, RUCA source),
which build_data.py copies into the dashboard's metadata and check_data.py reports.
"""
import argparse
import datetime as dt
import io
import json
import re
import sys

import pandas as pd
import requests

import config as C

PAGE = 50000
CATALOG = "https://api.us.socrata.com/api/catalog/v1"
RUCA_CANDIDATES = [
    C.RUCA_URL,
    "https://www.ers.usda.gov/media/5444/2020-rural-urban-commuting-area-codes-census-tracts.xlsx?v=1",
    "https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA-codes-2020-tract.xlsx",
]


def get(url, dest, force):
    if dest.exists() and not force:
        print(f"  have {dest.name}")
        return
    print(f"  get  {url}")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"       -> {dest} ({len(r.content)/1e6:.1f} MB)")


def find_latest():
    """Ask the Socrata catalog for 'PLACES: Local Data for Better Health, Census Tract Data <year> release'."""
    try:
        r = requests.get(CATALOG, params={"domains": "data.cdc.gov", "search_context": "data.cdc.gov",
                                          "q": "PLACES Local Data for Better Health Census Tract Data", "only": "dataset",
                                          "limit": 50}, timeout=60)
        r.raise_for_status()
        best = None
        for res in r.json().get("results", []):
            name = res["resource"]["name"]
            m = re.search(r"Census Tract Data,?\s*(\d{4}) release", name)
            if m and "GIS" not in name:
                yr = int(m.group(1))
                if not best or yr > best[0]:
                    best = (yr, res["resource"]["id"], name)
        if best:
            print(f"  newest PLACES tract release: {best[2]} ({best[1]})")
            return {"release": best[0], "dataset": best[1], "name": best[2]}
    except Exception as e:  # network or format change: fall back to config
        print(f"  catalog lookup failed ({e}); using config dataset {C.PLACES_DATASET}")
    return None


def get_places(dataset, force):
    url = f"https://data.cdc.gov/resource/{dataset}.csv"
    if C.PLACES_CSV.exists() and not force:
        print(f"  have {C.PLACES_CSV.name}")
        return url, None
    parts, off = [], 0
    while True:
        params = {"$where": f"stateabbr='{C.STATE}'", "$limit": PAGE, "$offset": off, "$order": "locationname,measureid"}
        r = requests.get(url, params=params, timeout=300)
        r.raise_for_status()
        df = pd.read_csv(io.StringIO(r.text), dtype=str)
        if df.empty:
            break
        parts.append(df)
        off += len(df)
        print(f"  PLACES rows: {off:,}")
        if len(df) < PAGE:
            break
    pd.concat(parts).to_csv(C.PLACES_CSV, index=False)
    print(f"       -> {C.PLACES_CSV}")
    return url, off


def ruca_from_shipped(dest):
    """Write a RUCA CSV from the classes already in data/healthlens_data.js (class -> a representative code)."""
    p = C.DATA / "healthlens_data.js"
    s = p.read_text(encoding="utf-8")
    d = json.loads(s[s.index("=") + 1:].strip().rstrip(";"))
    code = {0: 1, 1: 4, 2: 7, 3: 10, 4: ""}
    pd.DataFrame({"TractFIPS20": d["tracts"]["gid"], "PrimaryRUCA": [code[c] for c in d["tracts"]["ru"]]}).to_csv(dest, index=False)
    print(f"       -> reused RUCA classes from {p.name} ({dest.name})")


def get_ruca(force):
    have = [p for p in (C.RUCA_FILE, C.RUCA_FILE.with_suffix(".csv")) if p.exists()]
    if have and not force:
        print(f"  have {have[0].name}")
        return "existing file"
    for url in RUCA_CANDIDATES:
        try:
            get(url, C.RUCA_FILE, True)
            pd.read_excel(C.RUCA_FILE, nrows=5)   # make sure it is a real spreadsheet, not an HTML page
            return url
        except Exception as e:
            print(f"       failed ({str(e)[:80]})")
            C.RUCA_FILE.unlink(missing_ok=True)
    ruca_from_shipped(C.RUCA_FILE.with_suffix(".csv"))
    return "reused from previous build (2020 RUCA classes; ERS download unavailable)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--latest", action="store_true", help="look up the newest PLACES tract release first")
    ap.add_argument("--dataset", default=None, help="Socrata dataset id (overrides config and --latest)")
    a = ap.parse_args()
    C.RAW.mkdir(parents=True, exist_ok=True)
    info = {"release": None, "dataset": C.PLACES_DATASET, "name": None}
    if a.dataset:
        info["dataset"] = a.dataset
    elif a.latest:
        info = find_latest() or info
    url, rows = get_places(info["dataset"], a.force)
    get(C.TRACT_ZIP_URL, C.TRACT_ZIP, a.force)
    get(C.PLACE_ZIP_URL, C.PLACE_ZIP, a.force)
    ruca = get_ruca(a.force)
    prov = {"dataset": info["dataset"], "release": info["release"], "name": info["name"], "url": url, "rows": rows,
            "retrieved": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "ruca_source": ruca}
    (C.RAW / "provenance.json").write_text(json.dumps(prov, indent=1), encoding="utf-8")
    print(f"  provenance -> {C.RAW / 'provenance.json'}")
    print("done")


if __name__ == "__main__":
    main()
