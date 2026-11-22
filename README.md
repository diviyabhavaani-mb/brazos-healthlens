# Brazos HealthLens

**A linked visual analytics dashboard for chronic disease, risk factors and care gaps in the Brazos Valley, Texas.**

CSCE 679 Data Visualization · Texas A&M University · Fall 2026 · **Graduate Team 6**

Design, data processing, implementation, evaluation is done by the below team members : 
1. Diviya Bhavaani Meenakkshi Sundar Banumathy
2. Manogna Rayala 
3. Seo Hyeon Beom 
4. Alexis Santiago 

**Live site:** https://diviyabhavaani-mb.github.io/brazos-healthlens/

![Start here: one question, five linked views](docs/screenshots/tab_overview.jpg)

---

## What it does

Brazos HealthLens maps CDC PLACES estimates for all **6,844 Texas census tracts** with a focus on the
**7-county Brazos Valley** (Brazos, Burleson, Grimes, Leon, Madison, Robertson, Washington; 102 tracts).
Every view is linked: pick a tract, brush a range or choose a group in one view and it lights up in all the
others. Darker colors always mean worse, and every estimate shows its 95% confidence interval.

**Open `index.html` in a browser. No install, server or internet connection is needed.**
Start on the **Start here** tab: it shows how the views connect (question → map & profile → compare → similar →
care gaps → export & share) and what is carried between them. The **▶ Guided story** follows one tract (Tract 5.01,
Bryan) through every view in 8 steps to answer one question: *where should blood-pressure outreach start?*

## What changed for the final version

The prototype was evaluated with a 13-person feedback survey (`survey/prototype_feedback_survey.csv`) and
instructor feedback ("the overview needs a consistent story showing how the views are linked"; "demonstrate
the data pipeline with fresh datasets"). Every theme in the comments is linked to a change in
`evaluation/feedback_results.md` and in the **Survey & evaluation** tab.

| Feedback | Change |
|---|---|
| Overview should tell one connected story (instructor; 7 of 13) | New **Start here** tab with a live flow diagram; guided story rebuilt around one question and one tract, ending in a recap with the outreach list |
| Parallel coordinates cluttered (8 of 13) | Selected tract bold with values on every axis, five measure presets, fade-other-lines, line key, hover values with CIs, “how to read” panel |
| Export / save / share (4) | CSV of the current set, printable summary report, PNG with caption and source, shareable links (the URL keeps tab, scope, measure, selection, brushes, pins and axes) |
| Compare a few areas (1) | Pin up to 4 tracts into a side-by-side table |
| Color and legibility (4) | High-contrast (Okabe–Ito) option, larger legends, keyboard navigation of maps and a text summary for screen readers |
| Data source and date (2); fresh data (instructor) | Release and retrieval date in the header; **Refresh data** GitHub Actions workflow with automatic checks (`pipeline/check_data.py`) |
| Uncertainty and similarity explained (3) | Uncertainty key beside the profile, “Uncertainty and limitations” section, plain-language similarity labels |

## Requirements and how the survey supports them

We surveyed six intended users (3 hospital or healthcare staff, 1 epidemiologist, 1 faculty researcher,
1 public-health student) before building. Their answers produced the five requirements in our proposal. The
dashboard implements these five and nothing else. The **Survey & requirements** tab shows every answer.

| ID | Requirement | Survey evidence (n = 6) | Where in the dashboard |
|---|---|---|---|
| **R1** | **Explore where**: see any measure on a map; find places by name | 4/6 · Q7 “comparing neighborhoods within the same county” (4), Q5 “finding specific communities” (3) | Map & profile: choropleth, county layer, search, ranked tracts |
| **R2** | **Compare a tract's full profile** with county, valley and Texas; relate risk factors to outcomes | 6/6 · Q9 “explore relationships between multiple measures” (4), Q7 “compare with county or Texas averages” (3) | Tract profile (county ■, valley ◆, Texas markers); Compare measures: parallel coordinates and relationship explorer |
| **R3** | **Find similar and unusual tracts** | 5/6 · Q5 “finding communities with similar profiles” (4), Q7 “similar communities elsewhere in Texas” (3) | Similar & unusual: peer finder, profile groups, “unusual for their group”; map colored by group |
| **R4** | **Judge reliability and urban–rural context** | 5/6 · Q5 “understanding the reliability of estimates” (4), Q8 local context (2) and CIs (1) | CI whiskers and ⚠ flags in all views; CI-width map mode; urban–rural filter and color option |
| **R5** | **Find care gaps**: high disease burden with weak preventive care | 2/6 · Q5 and Q9 (2 each; epidemiologist and student) | Care gaps: bivariate map, scatterplot, ranked outreach list |

Ease of use is a design principle across all views (Q4: four of six respondents work in spreadsheets, only two
use GIS; Q10 asked for accessibility). R5 has the weakest support and will be re-tested in our think-aloud evaluation.

## The seven tabs

| Tab | Views (all D3.js) |
|---|---|
| **Start here** | Flow diagram of the linked views with live status for the selected tract; five quick-start questions; visual grammar; data card |
| **Map & profile** (R1 · R2 · R4) | Canvas choropleth of 6,884 tracts with zoom, three color modes (focus measure / CI width / profile group), low-confidence hatching; tract profile with CIs; 15 highest-burden tracts with CI whiskers; county averages |
| **Compare measures** (R2) | Parallel coordinates with brushable, reorderable axes; scatterplot with least-squares fit and live r; ranking of the measures most correlated with the Y measure |
| **Similar & unusual** (R3) | Peer finder (5–20 nearest tracts, valley or statewide) with peer map and per-measure panels; five profile-group cards; group heatmap; tracts most unlike their own group |
| **Care gaps** (R5) | 3×3 bivariate map (burden × care deficit); matching scatterplot; ranked list of high/high tracts |
| **Survey & evaluation** | Prototype feedback results (task outcomes, themes, change per theme); evidence matrix R1–R5 × survey question; respondents; design decisions; one card per requirement; every question's answers; Q10 suggestions and our responses |
| **Methods & data** | Sources, methods, caveats, palettes |

Shared controls: comparison scope (Brazos Valley / all Texas), focus measure (34 measures), search, urban–rural
filter, the selected tract chip, the highlighted group chip and Reset. KPI cards at the top follow the scope and
the current highlight.

| | |
|---|---|
| ![Compare measures](docs/screenshots/tab_compare.jpg) | ![Similar & unusual](docs/screenshots/tab_similar.jpg) |
| ![Care gaps](docs/screenshots/tab_gap.jpg) | ![Survey & evaluation](docs/screenshots/tab_survey.jpg) |

## Run it

```bash
git clone https://github.com/<your-account>/brazos-healthlens.git
cd brazos-healthlens
# then double-click index.html, or serve the folder:
python -m http.server 8000      # open http://localhost:8000
```

The data are loaded as plain `<script>` files (`window.HL_DATA = …`), so the page also works straight from
`file://` without a server.

### Publish on GitHub Pages

The workflow in `.github/workflows/deploy.yml` publishes the site on every push to `main`.
In the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**, push, and the site
appears at `https://<your-account>.github.io/brazos-healthlens/`.

## Fresh data: the Refresh data workflow

`.github/workflows/refresh-data.yml` runs the whole pipeline on GitHub's servers (monthly, or by hand from
**Actions → Refresh data → Run workflow**):

1. `download.py --latest` asks the data.cdc.gov catalog for the newest *PLACES Census Tract Data* release (or uses
   the dataset id you type), downloads Texas rows, Census boundaries and RUCA codes, and writes `pipeline/raw/provenance.json`;
2. `build_topology.py` and `build_data.py` rebuild `data/` (the release, retrieval and build dates go into the metadata);
3. `check_data.py` runs 7 sanity checks and compares the new build with the previous one
   (`evaluation/refresh_report.md`, shown in the Methods tab);
4. both test suites run; only if everything passes is the new data committed and the site republished.

If a check fails, nothing is published and the report is attached to the run as an artifact.

## Rebuild the data locally (optional)

The repository ships with built data in `data/`, so this is only needed to refresh it.

```bash
pip install -r pipeline/requirements.txt
cd pipeline
python download.py          # CDC PLACES (Texas), Census 2020 tract and place boundaries, USDA RUCA 2020 -> pipeline/raw/
python build_topology.py    # -> data/tracts_topo.js and pipeline/work/tract_geo.csv
python build_data.py        # -> data/healthlens_data.js
python check_data.py --old ../data/healthlens_data.js   # sanity checks + old/new comparison
python survey_summary.py    # -> data/survey_summary.js (from survey/initial_user_survey.csv)
python feedback_summary.py  # -> data/feedback_summary.js + evaluation/ (from survey/prototype_feedback_survey.csv)
```

`make refresh` does the download (newest release), build and check in one step.

Or `make data` from the repository root. If the USDA RUCA link has moved, download the 2020 tract RUCA file
from the ERS website and save it as `pipeline/raw/ruca2020_tracts.xlsx` (see `pipeline/config.py`).
Profile-group names live in `pipeline/config.py`; check them against the group heatmap after a rebuild.

### Tests

```bash
python tests/test_pipeline.py   # offline: rebuilds raw inputs from data/, runs the pipeline, compares the output
python tests/smoke_test.py      # headless Chromium: every tab, 8 story steps, linking, presets, pins, CSV, share links
python tests/perf_test.py       # interaction timings -> evaluation/performance.md
```

## Repository structure

```
brazos-healthlens/
├── index.html                 # the dashboard
├── css/style.css
├── js/
│   ├── core.js                # data decoding, palettes, shared state store, tooltip, search, KPIs, tabs
│   ├── views.js               # geometry, MapView (canvas choropleth), ScatterView (canvas + SVG + brush)
│   ├── tab_map.js             # R1 R2 R4: map, tract profile, ranked tracts, county bars
│   ├── tab_compare.js         # R2: parallel coordinates, relationship explorer
│   ├── tab_similar.js         # R3: peers, profile groups, unusual-for-group table
│   ├── tab_gaps.js            # R5: bivariate care-gap map, scatter, list
│   ├── overview.js            # Start here tab: flow diagram, quick-start questions, provenance line
│   ├── share.js               # exports (CSV, print, PNG), shareable links, pins, keyboard access
│   ├── tab_survey.js          # survey evidence for R1–R5 and prototype feedback results
│   ├── tab_methods.js         # methods text and footer
│   ├── story.js               # 8-step guided story (one question, one tract)
│   └── main.js                # start-up
├── data/
│   ├── healthlens_data.js     # tract estimates, CIs, groups, peers, aggregates (built by build_data.py)
│   ├── tracts_topo.js         # TopoJSON tracts + counties (built by build_topology.py)
│   ├── survey_summary.js      # initial survey summary (survey_summary.py)
│   ├── feedback_summary.js    # prototype feedback survey summary (feedback_summary.py)
│   └── refresh_status.js      # result of the last data check (check_data.py)
├── vendor/                    # D3.js v7.9.0 and topojson-client 3.1.0 (ISC license)
├── pipeline/                  # Python data pipeline (config, download, build_topology, build_data, check_data, survey/feedback summaries)
├── survey/                    # initial_user_survey.csv, prototype_feedback_survey.csv
├── evaluation/                # feedback results, refresh report, interaction timings
├── tests/                     # test_pipeline.py, smoke_test.py, perf_test.py
├── docs/                      # proposal PDF, screenshots
└── .github/workflows/      # deploy.yml, tests.yml, refresh-data.yml
```

## Data sources

- Centers for Disease Control and Prevention. **PLACES: Local Data for Better Health, Census Tract Data, 2025 release**
  (BRFSS 2023; five measures 2022). https://data.cdc.gov/resource/cwsq-ngmh
- U.S. Census Bureau. **2020 Cartographic Boundary Files**: `cb_2020_48_tract_500k`, `cb_2020_48_place_500k`.
- USDA Economic Research Service. **2020 Rural-Urban Commuting Area (RUCA) Codes**, census tracts.
- Team 6. **Initial user survey** (6 anonymous responses, October 2026), `survey/initial_user_survey.csv`.

**Caveats.** PLACES values are model-based, crude (not age-adjusted) prevalence estimates, not case counts.
Tract-level patterns do not describe individuals. Older rural tracts look worse on crude rates; the young,
student-heavy tracts in College Station look better on chronic disease but worse on checkups and BP medicine.

## Methods in brief

- **Color**: 5-class quantiles of the chosen scope (ColorBrewer YlOrRd; reversed for care measures).
- **Reliability (R4)**: CI width; ⚠ low confidence = CI among the widest 10% of Texas tracts for that measure.
- **Profile groups and peers (R3)**: 23 core measures z-scored across Texas (signed + = worse) → PCA (3 components,
  90% of variance) → k-means, k = 5 (best silhouette for k = 4–8, stable across restarts). Peers = 20 nearest tracts
  in Euclidean distance on the z-scores. Unusual score = distance from the tract to its group's mean profile.
- **Care gap (R5)**: burden = mean z of diabetes, high BP, heart disease, stroke, COPD; deficit = mean z of uninsured,
  no checkup, not taking BP medicine, no cholesterol screening; tertiles crossed in a 3×3 bivariate palette.

## Acknowledgements and AI use

Built with [D3.js](https://d3js.org) v7 and topojson-client (both ISC license). We used AI assistants
(Claude) to help draft code, documentation and the survey summary script; the team reviewed, tested and is
responsible for all of it.

## License

Code: MIT (see `LICENSE`). Data are U.S. federal public-domain sources; survey responses are anonymous.
