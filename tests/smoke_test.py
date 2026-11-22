"""
Headless smoke test of the dashboard: opens index.html from disk, visits every tab, runs every
guided-story step, exercises the linked selection and filters, and fails on any console error.

    pip install playwright && python -m playwright install chromium
    python tests/smoke_test.py                 # add --shots out/ to save a screenshot per tab
    python tests/smoke_test.py --chromium /path/to/chrome
"""
import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TABS = ["overview", "map", "compare", "similar", "gap", "survey", "about"]
HEARNE = "48395960501"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shots", help="folder for screenshots")
    ap.add_argument("--chromium", help="path to a Chromium/Chrome executable")
    a = ap.parse_args()
    shots = Path(a.shots) if a.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    errors, fails = [], []

    def check(cond, msg):
        print(("  ok   " if cond else "  FAIL ") + msg)
        if not cond:
            fails.append(msg)

    with sync_playwright() as p:
        kw = {"executable_path": a.chromium} if a.chromium else {}
        br = p.chromium.launch(**kw)
        pg = br.new_page(viewport={"width": 1500, "height": 1000})
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto((ROOT / "index.html").as_uri())
        pg.wait_for_function("window.__ready === true", timeout=30000)
        api = "window.HL_API"
        print("load")
        check(pg.evaluate(f"{api}.ID_BV.length") == 102, "102 Brazos Valley tracts")
        check(pg.evaluate(f"{api}.ID_TX.length") == 6844, "6,844 Texas tracts")

        print("tabs")
        for t in TABS:
            pg.evaluate(f"{api}.showTab('{t}')")
            pg.wait_for_timeout(500)
            check(pg.evaluate("document.querySelector('#tab-%s').classList.contains('on')" % t), f"tab {t} visible")
            if shots:
                pg.screenshot(path=str(shots / f"tab_{t}.png"), full_page=True)
        rs = pg.evaluate(f"{api}.RSTAT")
        check(rs.get("pcp", {}).get("lines") == 102, "parallel coordinates draw 102 lines")
        check(rs.get("risk", {}).get("n", 0) > 90, "scatterplot drawn")
        check(rs.get("survey", {}).get("cards") == 5, "five requirement cards")
        check(rs.get("gap", {}).get("hh", 0) > 0, "care-gap list has tracts")
        check(rs.get("odd", {}).get("n") == 15, "unusual-for-group table has 15 rows")
        check(pg.evaluate("document.querySelectorAll('#ovFlow .ovnode').length") >= 4, "overview flow diagram has the five views")
        check(pg.evaluate("document.querySelectorAll('#fbTasks rect').length > 5 && document.querySelectorAll('#fbThemes rect').length > 5"), "feedback results charts drawn")
        check("PLACES" in pg.inner_text("#prov"), "data provenance shown in the header")

        print("linking")
        pg.evaluate(f"{api}.showTab('map'); {api}.setSel({api}.GIDX.get('{HEARNE}'), true)")
        pg.wait_for_timeout(300)
        check(pg.evaluate(f"{api}.RSTAT.profile.sel") == pg.evaluate(f"{api}.GIDX.get('{HEARNE}')"), "profile follows selection")
        for mode in ["ci", "cluster", "measure"]:
            pg.evaluate(f"{api}.setMapMode('{mode}')")
            check(pg.evaluate(f"{api}.RSTAT.mapMode") == mode, f"map mode {mode}")
        pg.select_option("#ruSel", "3")
        pg.wait_for_timeout(200)
        n = pg.evaluate(f"{api}.S.hl ? {api}.S.hl.size : 0")
        check(n > 0 and pg.evaluate(f"{api}.S.filter.type") == "ru", f"urban–rural filter highlights {n} rural tracts")
        pg.evaluate(f"{api}.showTab('compare')")
        check(pg.evaluate(f"{api}.RSTAT.pcp.hl") == n, "highlight carries into parallel coordinates")
        pg.evaluate(f"{api}.setScope('tx')")
        pg.wait_for_timeout(300)
        check(pg.evaluate(f"{api}.RSTAT.pcp.lines") == 6844, "scope switch to all Texas")
        pg.select_option("#ruSel", "")
        pg.fill("#search", "Hearne")
        pg.wait_for_timeout(200)
        check(pg.evaluate("document.querySelectorAll('#searchres div').length") > 0, "search finds Hearne")
        pg.click("#resetBtn")

        print("presets, pins, exports, links")
        pg.evaluate(f"{api}.setScope('bv'); {api}.showTab('compare'); {api}.setPCPPreset('bp')")
        pg.wait_for_timeout(300)
        check(pg.evaluate("document.querySelectorAll('#pcpWrap .pcp-axis').length") == 7, "blood-pressure preset shows 7 axes")
        pg.evaluate(f"{api}.togglePin({api}.GIDX.get('{HEARNE}')); {api}.togglePin({api}.GIDX.get('48041000501'))")
        pg.evaluate(f"{api}.showTab('map')")
        pg.wait_for_timeout(300)
        check(pg.evaluate("document.querySelectorAll('#pinTable tr').length") >= 3, "two pinned tracts compared in a table")
        with pg.expect_download() as dl:
            pg.evaluate(f"{api}.exportCSV()")
        csv = Path(dl.value.path()).read_text(encoding="utf-8-sig")
        check(csv.startswith("#") and "BPHIGH" in csv and len(csv.splitlines()) >= 4, "CSV export has header notes, measures and rows")
        h = pg.evaluate(f"{api}.stateToHash()")
        check("pins=" in h and "axes=bp" in h and "tab=map" in h, "share link encodes tab, pins and axes")
        pg2 = br.new_page(viewport={"width": 1500, "height": 1000})
        pg2.on("pageerror", lambda e: errors.append(str(e)))
        pg2.goto((ROOT / "index.html").as_uri() + h)
        pg2.wait_for_function("window.__ready === true", timeout=30000)
        check(pg2.evaluate(f"{api}.S.tab") == "map" and pg2.evaluate(f"{api}.S.pins.length") == 2, "opening a shared link restores the view")
        pg2.close()
        pg.evaluate(f"{api}.setPalette(true)")
        check(pg.evaluate("document.body.classList.contains('hc')"), "high-contrast palette switches on")
        pg.evaluate(f"{api}.setPalette(false)")
        pg.click("#resetBtn")

        print("guided story")
        k = pg.evaluate(f"{api}.STORY.length")
        check(k == 8, "eight story steps")
        expect = ["overview", "map", "map", "map", "compare", "similar", "gap", "gap"]
        for s in range(k):
            pg.evaluate(f"{api}.storyGo({s})")
            pg.wait_for_timeout(900)
            st = pg.evaluate(f"{api}.RSTAT.story")
            body = pg.inner_text("#stBody")
            check(st["tab"] == expect[s] and "NaN" not in body and "undefined" not in body, f"step {s+1} on {st['tab']}")
            if shots:
                pg.screenshot(path=str(shots / f"story_{s+1}.png"))
        check(pg.evaluate("document.querySelectorAll('#stBody table tr').length") >= 3, "recap lists the outreach tracts")
        pg.click("#storyX")
        br.close()

    print("console errors:", len(errors))
    for e in errors[:10]:
        print("   ", e)
    if errors or fails:
        sys.exit(1)
    print("all checks passed")


if __name__ == "__main__":
    main()
