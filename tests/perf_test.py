"""
Technical evaluation: time the dashboard's main interactions in headless Chromium.

    python tests/perf_test.py                    # 5 runs, writes evaluation/performance.json and .md
    python tests/perf_test.py --runs 10

Each timing wraps one synchronous call (all linked views redraw synchronously) with
performance.now(), then waits for the next animation frame so painting is included.
Reported: median and maximum over the runs, in milliseconds.
"""
import argparse
import json
import platform
import statistics as st
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HEARNE, BRYAN = "48395960501", "48041000501"
A = "window.HL_API"
TIMER = """async (code) => { const t0 = performance.now(); (new Function(code))();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - t0; }"""

TASKS = [
    ("Select a tract (all linked views update)", "map", f"{A}.setSel({A}.GIDX.get('{HEARNE}'), true)", f"{A}.setSel(null)"),
    ("Change focus measure (maps, PCP, profile)", "map", f"{A}.setMeasure('OBESITY')", f"{A}.setMeasure('DIABETES')"),
    ("Highlight a group (urban-rural filter)", "map", f"{A}.setFilter('ru', 3)", f"{A}.setHL(null)"),
    ("Switch to Compare tab (102 PCP lines)", "map", f"{A}.showTab('compare')", f"{A}.showTab('map')"),
    ("Scope to all Texas (6,844 PCP lines)", "compare", f"{A}.setScope('tx')", f"{A}.setScope('bv')"),
    ("Open Similar tab (20 peers + map)", "map", f"{A}.setSel({A}.GIDX.get('{BRYAN}'), true); {A}.showTab('similar')", f"{A}.showTab('map')"),
    ("Open Care-gap tab", "map", f"{A}.showTab('gap')", f"{A}.showTab('map')"),
    ("Apply blood-pressure preset", "compare", f"{A}.setPCPPreset('bp')", f"{A}.setPCPPreset('core')"),
    ("Build a share link", "map", f"{A}.stateToHash()", ""),
    ("High-contrast palette (redraw all)", "map", f"{A}.setPalette(true)", f"{A}.setPalette(false)"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=5)
    a = ap.parse_args()
    res = {"runs": a.runs, "machine": f"{platform.system()} {platform.machine()}, headless Chromium", "load_ms": [], "tasks": []}
    times = {t[0]: [] for t in TASKS}
    with sync_playwright() as p:
        br = p.chromium.launch()
        res["browser"] = br.version
        for r in range(a.runs):
            pg = br.new_page(viewport={"width": 1500, "height": 1000})
            t0 = time.perf_counter()
            pg.goto((ROOT / "index.html").as_uri())
            pg.wait_for_function("window.__ready === true", timeout=60000)
            res["load_ms"].append((time.perf_counter() - t0) * 1000)
            pg.wait_for_timeout(400)
            for name, tab, code, undo in TASKS:
                pg.evaluate(f"{A}.showTab('{tab}')")
                pg.wait_for_timeout(150)
                times[name].append(pg.evaluate(TIMER, code))
                if undo:
                    pg.evaluate(undo)
                pg.wait_for_timeout(100)
            pg.close()
        br.close()
    med = lambda xs: round(st.median(xs), 1)
    res["load"] = {"median": med(res["load_ms"]), "max": round(max(res["load_ms"]), 1)}
    for name, _, _, _ in TASKS:
        res["tasks"].append({"task": name, "median": med(times[name]), "max": round(max(times[name]), 1)})
    ev = ROOT / "evaluation"
    ev.mkdir(exist_ok=True)
    (ev / "performance.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    L = [f"# Interaction timings ({a.runs} runs, {res['machine']} {res['browser']})", "",
         "| Interaction | Median (ms) | Max (ms) |", "| --- | --- | --- |",
         f"| Page load to interactive (data + topology + first render) | {res['load']['median']} | {res['load']['max']} |"]
    L += [f"| {t['task']} | {t['median']} | {t['max']} |" for t in res["tasks"]]
    (ev / "performance.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


if __name__ == "__main__":
    main()
