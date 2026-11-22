"""
Step 4 · Check a freshly built data file and compare it with the previous one.

    python pipeline/check_data.py --old old_data.js --new data/healthlens_data.js
    python pipeline/check_data.py --old old_data.js --new data/healthlens_data.js --label "offline rebuild"

Run by the refresh-data GitHub Actions workflow after download.py and build_data.py. It
  * runs sanity checks on the new file (fails with exit code 1 if any check fails, so a broken
    download is never published): tract and measure counts, values in 0-100, every estimate inside
    its 95% CI, valley tracts present, profile groups and peers present;
  * compares old and new: release, tracts and measures added or dropped, how many tract values
    changed, and the change in the Texas and Brazos Valley averages of every measure.

Outputs: evaluation/refresh_report.md (readable) and data/refresh_status.js (window.HL_REFRESH,
shown in the Methods & data tab so viewers can see when the data was last checked).
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_js(p):
    s = Path(p).read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def sanity(D):
    res = []
    def chk(name, ok, detail=""):
        res.append({"check": name, "ok": bool(ok), "detail": detail})
    tr = D["tracts"]
    N = len(tr["gid"])
    mids = [m["id"] for m in D["measures"]]
    have = sum(1 for v in D["v"]["DIABETES"] if v is not None)
    chk("Texas tracts with estimates", have > 6000, f"{have:,} of {N:,} map tracts")
    nbv = sum(1 for c, v in zip(tr["cfp"], D["v"]["DIABETES"]) if c in D["bv_cfp"] and v is not None)
    chk("Brazos Valley tracts with estimates", nbv >= 95, f"{nbv} tracts")
    missing = [m for m in mids if sum(1 for v in D["v"][m] if v is not None) < 0.9 * have]
    chk("All measures present", not missing, f"{len(mids) - len(missing)} of {len(mids)}" + (f"; sparse: {', '.join(missing)}" if missing else ""))
    bad = sum(1 for m in mids for v in D["v"][m] if v is not None and not 0 <= v <= 1000)
    chk("Values between 0 and 100%", bad == 0, f"{bad} out of range")
    outside = sum(1 for m in mids for v, lo, hi in zip(D["v"][m], D["lo"][m], D["hi"][m])
                  if None not in (v, lo, hi) and not lo - 1 <= v <= hi + 1)
    chk("Every estimate inside its 95% CI", outside == 0, f"{outside} outside")
    chk("Profile groups built", D["meta"]["K"] >= 3 and sum(D["cl_size"]) > 6000, f"k = {D['meta']['K']}, sizes {D['cl_size']}")
    chk("Peers for every tract", len(D["peers"]) >= have * 0.99, f"{len(D['peers']):,} peer lists")
    return res


def compare(O, D):
    mids = [m["id"] for m in D["measures"]]
    omids = [m["id"] for m in O["measures"]]
    oi = {g: i for i, g in enumerate(O["tracts"]["gid"])}
    common = [(i, oi[g]) for i, g in enumerate(D["tracts"]["gid"]) if g in oi]
    changed, maxd = 0, 0.0
    for m in set(mids) & set(omids):
        for i, j in common:
            a, b = D["v"][m][i], O["v"][m][j]
            if a != b:
                changed += 1
                if a is not None and b is not None:
                    maxd = max(maxd, abs(a - b) / 10)
    total = len(common) * len(set(mids) & set(omids))
    shift = []
    for m in mids:
        if m in O["ref"]["tx"]:
            shift.append({"m": m, "tx_old": O["ref"]["tx"][m], "tx_new": D["ref"]["tx"][m],
                          "bv_old": O["ref"]["bv"][m], "bv_new": D["ref"]["bv"][m]})
    return {"old_release": O["meta"].get("release"), "new_release": D["meta"].get("release"),
            "old_retrieved": O["meta"].get("retrieved"), "new_retrieved": D["meta"].get("retrieved"),
            "added_measures": sorted(set(mids) - set(omids)), "dropped_measures": sorted(set(omids) - set(mids)),
            "tracts_old": len(O["tracts"]["gid"]), "tracts_new": len(D["tracts"]["gid"]),
            "values_compared": total, "values_changed": changed, "max_change_pts": round(maxd, 1),
            "groups_old": O["meta"]["K"], "groups_new": D["meta"]["K"], "avg_shift": shift}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--old", required=True)
    ap.add_argument("--new", default=ROOT / "data" / "healthlens_data.js")
    ap.add_argument("--label", default="scheduled refresh")
    ap.add_argument("--report", default=ROOT / "evaluation" / "refresh_report.md")
    ap.add_argument("--status", default=ROOT / "data" / "refresh_status.js")
    a = ap.parse_args()
    D, O = load_js(a.new), load_js(a.old)
    checks = sanity(D)
    cmp_ = compare(O, D)
    ok = all(c["ok"] for c in checks)
    st = {"label": a.label, "checked": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "passed": ok,
          "n_ok": sum(c["ok"] for c in checks), "n": len(checks), "checks": checks,
          "compare": {k: v for k, v in cmp_.items() if k != "avg_shift"},
          "release": D["meta"].get("release"), "dataset": D["meta"].get("dataset"), "retrieved": D["meta"].get("retrieved")}

    L = [f"# Data refresh report ({a.label})", "",
         f"Checked {st['checked']} · result: **{'PASSED' if ok else 'FAILED'}** ({st['n_ok']} of {st['n']} checks)", "",
         f"PLACES dataset `{st['dataset']}`, release {st['release']}, retrieved {st['retrieved']}.", "",
         "## Sanity checks", "", "| Check | Result | Detail |", "| --- | --- | --- |"]
    L += [f"| {c['check']} | {'ok' if c['ok'] else 'FAIL'} | {c['detail']} |" for c in checks]
    c = cmp_
    L += ["", "## Old vs new", "",
          f"* Release: {c['old_release']} → {c['new_release']}; retrieved {c['old_retrieved']} → {c['new_retrieved']}",
          f"* Tracts: {c['tracts_old']:,} → {c['tracts_new']:,}; profile groups k = {c['groups_old']} → {c['groups_new']}",
          f"* Measures added: {', '.join(c['added_measures']) or 'none'}; dropped: {', '.join(c['dropped_measures']) or 'none'}",
          f"* Tract values changed: {c['values_changed']:,} of {c['values_compared']:,} (largest change {c['max_change_pts']} pts)",
          "", "## Change in adult-weighted averages (percentage points)", "",
          "| Measure | Texas old | Texas new | Δ | Valley old | Valley new | Δ |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for s in c["avg_shift"]:
        L.append(f"| {s['m']} | {s['tx_old']:.1f} | {s['tx_new']:.1f} | {s['tx_new'] - s['tx_old']:+.1f} | "
                 f"{s['bv_old']:.1f} | {s['bv_new']:.1f} | {s['bv_new'] - s['bv_old']:+.1f} |")
    Path(a.report).parent.mkdir(parents=True, exist_ok=True)
    Path(a.report).write_text("\n".join(L) + "\n", encoding="utf-8")
    Path(a.status).write_text("// Generated by pipeline/check_data.py\nwindow.HL_REFRESH = " + json.dumps(st, indent=1) + ";\n", encoding="utf-8")
    for ch in checks:
        print(("  ok   " if ch["ok"] else "  FAIL ") + f"{ch['check']}: {ch['detail']}")
    print(f"  {c['values_changed']:,} of {c['values_compared']:,} tract values changed -> {a.report}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
