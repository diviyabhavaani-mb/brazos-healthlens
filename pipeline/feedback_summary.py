"""
Summarize the prototype feedback survey (evaluation, phase 2) and link every comment to a change.

    python pipeline/feedback_summary.py
    python pipeline/feedback_summary.py --csv survey/prototype_feedback_survey.csv

Input : survey/prototype_feedback_survey.csv  (Google Forms export, one row per respondent)
Output: data/feedback_summary.js      window.HL_FEEDBACK = {...}   (shown in the Survey & evaluation tab)
        evaluation/feedback_summary.json  the same numbers for the report and slides
        evaluation/feedback_results.md    a readable table of every metric and theme

Respondents are numbered F1..Fn in submission order; the survey is anonymous.
Open-ended answers (Q4a, Q5a, Q9b, Q11, Q12, Q13a, Q16, Q17) were coded by the team into the
themes in THEMES. CODING lists, for each respondent, the themes their comments raised; edit it
if the team re-codes, then re-run this script.
"""
import argparse
import csv
import json
import re
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Theme id -> (label, what we changed in the final system)
THEMES = OrderedDict([
    ("story",    ("One connected story across the views",
                  "Overview tab that maps the question to each view; guided story rebuilt around one question and one tract, with transitions and a recap")),
    ("pcp",      ("Parallel coordinates: focus and clutter",
                  "Selected tract drawn bold with value labels, highlighted lines in front, five measure presets, line legend, labelled focus axis, hover shows exact values")),
    ("guidance", ("In-context explanations of charts",
                  "\"How to read\" notes on parallel coordinates, whiskers, peers and the care-gap legend; plain-language tooltips")),
    ("export",   ("Save, export or share a view",
                  "Download CSV, printable summary report, PNG export with caption and source, shareable links that keep the selection")),
    ("color",    ("Color contrast and legend size",
                  "High-contrast option for groups and lines; larger legend text")),
    ("onboard",  ("Where to start / too much at once",
                  "Overview tab with five quick-start questions and one primary next step")),
    ("practical", ("A practical outreach example",
                   "Story follows a real outreach question; recap card with a downloadable outreach list")),
    ("provenance", ("Data source and update date",
                    "Data source, release and refresh date shown in the header and Overview; fresh-data workflow on GitHub Actions")),
    ("uncert",   ("Explain uncertainty and methods",
                  "Uncertainty legend beside the profile, methods & limitations panel, exact CI in tooltips and exports")),
    ("linking",  ("Make cross-view linking obvious",
                  "Persistent \"following\" bar, same tract outlined in every view, link captions on every card")),
    ("similar",  ("Explain how similarity is computed",
                  "\"What does similar mean?\" panel and plain-language similarity labels")),
    ("compare",  ("Compare a few chosen areas side by side",
                  "Pin up to 4 tracts and compare them in one table")),
    ("search",   ("Finding a county by name",
                  "Search box labelled \"Find a county, town or tract\" and the / shortcut")),
    ("details",  ("Exact values for an outlier",
                  "Hover on any line or dot shows exact values with CIs")),
])

# Team coding of the open-ended answers (F1..F13 in submission order).
CODING = {
    "F1": ["pcp", "provenance"],
    "F2": ["onboard"],
    "F3": ["guidance", "story", "export"],
    "F4": ["pcp", "story", "provenance", "color"],
    "F5": ["pcp", "practical", "export", "linking"],
    "F6": ["guidance", "story", "export"],
    "F7": ["pcp", "details", "color", "linking"],
    "F8": ["pcp", "story", "search", "uncert"],
    "F9": ["pcp", "practical", "compare", "onboard", "color"],
    "F10": ["similar", "story"],
    "F11": ["guidance", "story", "uncert"],
    "F12": ["pcp", "guidance", "onboard", "color"],
    "F13": ["pcp", "story", "export"],
}

SHORT = {  # short labels for the multiple-choice questions
    "Q1": "Role", "Q3": "Understood the purpose in the first minute (1–5)",
    "Q4": "Found and selected a place on the map", "Q5": "Parallel coordinates showed a relationship",
    "Q6": "Peer finder made sense", "Q7": "Found a high-burden, low-care area",
    "Q8": "Uncertainty indicators changed interpretation", "Q9": "Tried the guided story",
    "Q9a": "Guided story usefulness (1–5)", "Q10": "Most useful tab", "Q13": "Could read the map colors",
    "Q14": "Amount of information on screen", "Q15": "Would change how they work",
}
OPEN = ["Q2", "Q4a", "Q5a", "Q9b", "Q11", "Q12", "Q13a", "Q15a", "Q16", "Q17"]
EMPTY = {"", "n/a", "na", "none", "no", "-"}


def qid(header):
    m = re.match(r"\s*(Q\d+[a-z]?)\.", header)
    return m.group(1) if m else None


def summarize(csv_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    hdr = [qid(h) for h in rows[0]]
    text = {qid(h): h.split(".", 1)[1].strip() for h in rows[0] if qid(h)}
    resp = []
    for n, r in enumerate([r for r in rows[1:] if any(c.strip() for c in r)], start=1):
        d = {"id": f"F{n}"}
        for q, v in zip(hdr, r):
            if q:
                d[q] = v.strip()
        resp.append(d)
    n = len(resp)

    def counts(q):
        c = Counter(r[q] for r in resp if r.get(q))
        return [{"option": k, "n": v} for k, v in c.most_common()]

    def mean(q):
        vals = [float(r[q]) for r in resp if r.get(q, "").replace(".", "", 1).isdigit()]
        return {"mean": round(sum(vals) / len(vals), 2), "n": len(vals),
                "dist": {str(k): sum(1 for v in vals if v == k) for k in range(1, 6)}} if vals else None

    metrics = OrderedDict()
    for q in ["Q1", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q13", "Q14", "Q15"]:
        metrics[q] = {"label": SHORT[q], "text": text.get(q, ""), "counts": counts(q)}
    for q in ["Q3", "Q9a"]:
        metrics[q] = {"label": SHORT[q], "text": text.get(q, ""), **mean(q)}

    themes = []
    for t, (label, change) in THEMES.items():
        who = [r["id"] for r in resp if t in CODING.get(r["id"], [])]
        themes.append({"id": t, "label": label, "change": change, "n": len(who), "respondents": who})
    themes.sort(key=lambda x: -x["n"])

    comments = []
    for r in resp:
        for q in OPEN:
            v = r.get(q, "")
            if v and v.lower() not in EMPTY:
                comments.append({"respondent": r["id"], "role": r.get("Q1", ""), "question": q, "text": v})

    return {"n": n, "source": Path(csv_path).name,
            "note": "Anonymous prototype feedback survey (Google Forms) taken after using the live prototype. Open answers coded by the team into themes.",
            "questions": {q: text[q] for q in text},
            "respondents": [{"id": r["id"], "role": r.get("Q1", "")} for r in resp],
            "metrics": metrics, "themes": themes, "comments": comments}


def write_md(s, path):
    L = [f"# Prototype feedback survey: results (n = {s['n']})", ""]
    L += ["| Question | Result |", "| --- | --- |"]
    for q, m in s["metrics"].items():
        res = f"mean {m['mean']} (n = {m['n']})" if "mean" in m else ", ".join(f"{c['option']}: {c['n']}" for c in m["counts"])
        L.append(f"| {q} {m['label']} | {res} |")
    L += ["", "## Themes from open-ended answers", "", "| Theme | Respondents | What we changed |", "| --- | --- | --- |"]
    for t in s["themes"]:
        L.append(f"| {t['label']} | {t['n']} ({', '.join(t['respondents'])}) | {t['change']} |")
    Path(path).write_text("\n".join(L) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=ROOT / "survey" / "prototype_feedback_survey.csv")
    ap.add_argument("--out", default=ROOT / "data" / "feedback_summary.js")
    a = ap.parse_args()
    s = summarize(a.csv)
    Path(a.out).write_text("// Generated by pipeline/feedback_summary.py from survey/prototype_feedback_survey.csv\n"
                           "window.HL_FEEDBACK = " + json.dumps(s, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
    ev = ROOT / "evaluation"
    ev.mkdir(exist_ok=True)
    (ev / "feedback_summary.json").write_text(json.dumps(s, indent=1, ensure_ascii=False), encoding="utf-8")
    write_md(s, ev / "feedback_results.md")
    print(f"{s['n']} responses -> {a.out}")
    for q, m in s["metrics"].items():
        print(f"  {q:4} {m['label'][:48]:<48}", f"mean {m['mean']}" if "mean" in m else "; ".join(f"{c['option']} {c['n']}" for c in m["counts"]))
    for t in s["themes"]:
        print(f"  theme {t['n']:>2}  {t['label']}")


if __name__ == "__main__":
    main()
