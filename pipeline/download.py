"""
Step 1 · Download the raw data into pipeline/raw/.

    python pipeline/download.py            # skips files that already exist
    python pipeline/download.py --force    # download again

  * CDC PLACES 2025 tract data for Texas (Socrata API, paged; about 226,000 rows)
  * Census 2020 cartographic boundaries: Texas tracts and places
  * USDA ERS 2020 RUCA codes (tract level)
"""
import argparse
import io
import sys

import pandas as pd
import requests

import config as C

PAGE = 50000


def get(url, dest, force):
    if dest.exists() and not force:
        print(f"  have {dest.name}")
        return
    print(f"  get  {url}")
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    dest.write_bytes(r.content)
    print(f"       -> {dest} ({len(r.content)/1e6:.1f} MB)")


def get_places(force):
    if C.PLACES_CSV.exists() and not force:
        print(f"  have {C.PLACES_CSV.name}")
        return
    parts, off = [], 0
    while True:
        params = {"$where": f"stateabbr='{C.STATE}'", "$limit": PAGE, "$offset": off, "$order": "locationname,measureid"}
        r = requests.get(C.PLACES_URL, params=params, timeout=300)
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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    C.RAW.mkdir(parents=True, exist_ok=True)
    get_places(a.force)
    get(C.TRACT_ZIP_URL, C.TRACT_ZIP, a.force)
    get(C.PLACE_ZIP_URL, C.PLACE_ZIP, a.force)
    try:
        get(C.RUCA_URL, C.RUCA_FILE, a.force)
    except requests.HTTPError as e:
        print(f"\n  RUCA download failed ({e}).\n  Download the 2020 tract RUCA file by hand from\n"
              f"  https://www.ers.usda.gov/data-products/rural-urban-commuting-area-codes\n  and save it as {C.RUCA_FILE}")
        sys.exit(1)
    print("done")


if __name__ == "__main__":
    main()
