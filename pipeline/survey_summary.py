"""
Summarize the initial user survey and link every answer to a design requirement.

    python pipeline/survey_summary.py
    python pipeline/survey_summary.py --csv survey/initial_user_survey.csv --out data/survey_summary.js

Input : the Google Forms export (one row per respondent, multi-select answers
        separated by ";").
Output: data/survey_summary.js  (window.HL_SURVEY = {...}) used by the
        "Survey & requirements" tab, plus a short printout of the evidence table.

The survey is anonymous. Respondents are numbered S1..Sn in submission order;
timestamps are not copied into the summary.
"""
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The five design requirements from the proposal.
REQUIREMENTS = [
    ("R1", "Explore where", "See any measure on a map across valley and Texas tracts; find places by name"),
    ("R2", "Compare a tract's full profile", "Many measures at once, against county, valley and Texas; relate risk factors to outcomes"),
    ("R3", "Find similar and unusual tracts", "Similar health profiles anywhere in Texas; tracts that stand out from their group"),
    ("R4", "Judge reliability and context", "How reliable each estimate is; whether urban–rural context explains a difference"),
    ("R5", "Find care gaps", "Where high disease burden meets weak preventive care, to target outreach"),
]

# Short question labels, matched against the start of each CSV column header.
QUESTIONS = {
    "Q1": ("Role", "single"),
    "Q2": ("How often they use community health data", "single"),
    "Q3": ("What they use the data for", "multi"),
    "Q4": ("Tools and sources used today", "multi"),
    "Q5": ("Challenges when analyzing community health data", "multi"),
    "Q6": ("Measures examined together", "multi"),
    "Q7": ("Most useful comparisons", "multi"),
    "Q8": ("What helps interpret a difference between two communities", "single"),
    "Q9": ("Tasks they want Brazos HealthLens to support", "multi"),
    "Q10": ("One improvement to current tools", "text"),
}

# Answer option (matched by its opening words, case-insensitive) -> requirement(s).
EVIDENCE_MAP = {
    "Q5": {
        "Finding specific communities": ["R1"],
        "Comparing multiple health measures": ["R2"],
        "Comparing a community with county or state": ["R2"],
        "Finding communities with similar": ["R3"],
        "Understanding the reliability": ["R4"],
        "Comparing urban and rural": ["R4"],
        "Identifying areas with high disease burden": ["R5"],
    },
    "Q7": {
        "Comparing neighborhoods within the same county": ["R1", "R2"],
        "Comparing a community with county or Texas": ["R2"],
        "Examining relationships between multiple": ["R2"],
        "Finding similar communities": ["R3"],
        "Comparing urban and rural": ["R4"],
    },
    "Q8": {
        "Comparison with county, regional, or state": ["R2"],
        "Confidence intervals": ["R4"],
        "Additional local context": ["R4"],
    },
    "Q9": {
        "Locate communities with high disease rates": ["R1"],
        "Compare a community's health profile": ["R2"],
        "Explore relationships between multiple": ["R2"],
        "Find communities with similar health profiles": ["R3"],
        "Identify communities whose health patterns differ": ["R3"],
        "Compare health patterns across urban and rural": ["R4"],
        "Identify communities with both high disease burden": ["R5"],
    },
}

# How the team responded to each open-ended suggestion (Q10). Keyed by matching words.
OPEN_RESPONSES = [
    ("social vulnerability", "Future work: a CDC/ATSDR Social Vulnerability Index layer. Not in this release; PLACES and RUCA only."),
    ("language", "Future work: interface translation (e.g., Spanish). Labels are kept short and plain to make this easier."),
    ("accessib", "Design principle: colorblind-safe palettes, darker always means worse, text labels on every encoding, keyboard-usable controls."),
    ("more communities", "Data coverage: the tool includes all 6,844 Texas tracts with PLACES estimates; 40 tracts without estimates are shown gray."),
]

IGNORE_TEXT = {"", "n/a", "na", "none", "no", "-"}


def match(option, table):
    o = option.lower()
    for prefix, reqs in table.items():
        if o.startswith(prefix.lower()):
            return reqs
    return []


def split_multi(cell):
    return [p.strip() for p in cell.split(";") if p.strip()]


def load(csv_path):
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header, body = rows[0], [r for r in rows[1:] if any(c.strip() for c in r)]
    cols = {}
    for k, h in enumerate(header):
        m = re.match(r"\s*(Q\d+)\.", h)
        if m:
            cols[m.group(1)] = (k, h.split(".", 1)[1].strip())
    missing = [q for q in QUESTIONS if q not in cols]
    if missing:
        raise SystemExit(f"Survey CSV is missing columns for {missing}")
    return cols, body


def summarize(csv_path):
    cols, body = load(csv_path)
    respondents = []
    for n, row in enumerate(body, start=1):
        r = {"id": f"S{n}"}
        for q, (k, _) in cols.items():
            kind = QUESTIONS[q][1]
            cell = row[k].strip() if k < len(row) else ""
            r[q] = split_multi(cell) if kind == "multi" else cell
        respondents.append(r)

    questions = []
    for q, (label, kind) in QUESTIONS.items():
        k, full = cols[q]
        entry = {"id": q, "label": label, "text": full, "type": kind}
        if kind == "text":
            answers = []
            for r in respondents:
                t = r[q].strip()
                if t.lower() in IGNORE_TEXT:
                    continue
                resp = next((note for key, note in OPEN_RESPONSES if key in t.lower()), "Noted for the final evaluation.")
                answers.append({"respondent": r["id"], "text": t, "response": resp})
            entry["answers"] = answers
        else:
            cnt = Counter()
            who = {}
            for r in respondents:
                vals = r[q] if kind == "multi" else ([r[q]] if r[q] else [])
                for v in vals:
                    cnt[v] += 1
                    who.setdefault(v, []).append(r["id"])
            entry["options"] = [
                {"option": o, "n": c, "respondents": who[o], "requirements": match(o, EVIDENCE_MAP.get(q, {}))}
                for o, c in sorted(cnt.items(), key=lambda kv: (-kv[1], kv[0]))
            ]
        questions.append(entry)

    reqs = []
    for rid, title, desc in REQUIREMENTS:
        evidence, supporters = [], set()
        for qe in questions:
            for o in qe.get("options", []):
                if rid in o["requirements"]:
                    evidence.append({"question": qe["id"], "option": o["option"], "n": o["n"], "respondents": o["respondents"]})
                    supporters.update(o["respondents"])
        reqs.append({"id": rid, "title": title, "description": desc, "evidence": evidence,
                     "supporters": sorted(supporters, key=lambda s: int(s[1:])), "n_supporters": len(supporters)})

    return {
        "n": len(respondents),
        "source": Path(csv_path).name,
        "note": "Anonymous formative survey (Google Forms), collected Oct 19–20, 2026. Multi-select questions can sum to more than n.",
        "respondents": [{"id": r["id"], "role": r["Q1"], "frequency": r["Q2"]} for r in respondents],
        "questions": questions,
        "requirements": reqs,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=ROOT / "survey" / "initial_user_survey.csv")
    ap.add_argument("--out", default=ROOT / "data" / "survey_summary.js")
    a = ap.parse_args()
    s = summarize(a.csv)
    out = Path(a.out)
    out.write_text("// Generated by pipeline/survey_summary.py from survey/initial_user_survey.csv\n"
                   "window.HL_SURVEY = " + json.dumps(s, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"{s['n']} respondents -> {out}")
    for r in s["requirements"]:
        print(f"  {r['id']} {r['title']:<34} supported by {r['n_supporters']}/{s['n']} respondents "
              f"({len(r['evidence'])} answer options)")


if __name__ == "__main__":
    main()
