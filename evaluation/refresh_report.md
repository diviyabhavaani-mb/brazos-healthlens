# Data refresh report (baseline: shipped 2025 release (run the refresh-data workflow to replace this))

Checked 2026-11-22T01:18:06+00:00 · result: **PASSED** (7 of 7 checks)

PLACES dataset `cwsq-ngmh`, release 2025, retrieved 2026-10-02.

## Sanity checks

| Check | Result | Detail |
| --- | --- | --- |
| Texas tracts with estimates | ok | 6,844 of 6,884 map tracts |
| Brazos Valley tracts with estimates | ok | 102 tracts |
| All measures present | ok | 33 of 33 |
| Values between 0 and 100% | ok | 0 out of range |
| Every estimate inside its 95% CI | ok | 0 outside |
| Profile groups built | ok | k = 5, sizes [856, 1805, 1703, 1418, 1062] |
| Peers for every tract | ok | 6,844 peer lists |

## Old vs new

* Release: 2025 → 2025; retrieved 2026-10-02 → 2026-10-02
* Tracts: 6,884 → 6,884; profile groups k = 5 → 5
* Measures added: none; dropped: none
* Tract values changed: 0 of 227,172 (largest change 0.0 pts)

## Change in adult-weighted averages (percentage points)

| Measure | Texas old | Texas new | Δ | Valley old | Valley new | Δ |
| --- | --- | --- | --- | --- | --- | --- |
| DIABETES | 12.9 | 12.9 | +0.0 | 11.1 | 11.1 | +0.0 |
| BPHIGH | 33.1 | 33.1 | +0.0 | 31.7 | 31.7 | +0.0 |
| OBESITY | 35.8 | 35.8 | +0.0 | 32.3 | 32.3 | +0.0 |
| COPD | 5.9 | 5.9 | +0.0 | 6.3 | 6.3 | +0.0 |
| CASTHMA | 9.7 | 9.7 | +0.0 | 10.2 | 10.2 | +0.0 |
| CHD | 5.7 | 5.7 | +0.0 | 5.5 | 5.5 | +0.0 |
| DEPRESSION | 21.5 | 21.5 | +0.0 | 24.0 | 24.0 | +0.0 |
| CANCER | 6.2 | 6.2 | +0.0 | 6.2 | 6.2 | +0.0 |
| STROKE | 3.3 | 3.3 | +0.0 | 3.1 | 3.1 | +0.0 |
| HIGHCHOL | 35.1 | 35.1 | +0.0 | 32.2 | 32.2 | +0.0 |
| ARTHRITIS | 21.8 | 21.8 | +0.0 | 21.0 | 21.0 | +0.0 |
| TEETHLOST | 14.0 | 14.0 | +0.0 | 16.0 | 16.0 | +0.0 |
| CSMOKING | 12.9 | 12.9 | +0.0 | 13.2 | 13.2 | +0.0 |
| LPA | 28.3 | 28.3 | +0.0 | 26.9 | 26.9 | +0.0 |
| BINGE | 17.0 | 17.0 | +0.0 | 17.9 | 17.9 | +0.0 |
| SLEEP | 38.3 | 38.3 | +0.0 | 36.5 | 36.5 | +0.0 |
| ACCESS2 | 19.6 | 19.6 | +0.0 | 16.7 | 16.7 | +0.0 |
| CHECKUP | 73.7 | 73.7 | +0.0 | 72.9 | 72.9 | +0.0 |
| BPMED | 73.3 | 73.3 | +0.0 | 67.6 | 67.6 | +0.0 |
| CHOLSCREEN | 84.3 | 84.3 | +0.0 | 80.1 | 80.1 | +0.0 |
| DENTAL | 54.7 | 54.7 | +0.0 | 52.7 | 52.7 | +0.0 |
| COLON_SCREEN | 58.4 | 58.4 | +0.0 | 59.3 | 59.3 | +0.0 |
| MAMMOUSE | 73.2 | 73.2 | +0.0 | 71.7 | 71.7 | +0.0 |
| GHLTH | 22.6 | 22.6 | +0.0 | 22.1 | 22.1 | +0.0 |
| PHLTH | 13.5 | 13.5 | +0.0 | 13.2 | 13.2 | +0.0 |
| MHLTH | 17.2 | 17.2 | +0.0 | 19.5 | 19.5 | +0.0 |
| DISABILITY | 31.5 | 31.5 | +0.0 | 33.0 | 33.0 | +0.0 |
| MOBILITY | 14.5 | 14.5 | +0.0 | 13.4 | 13.4 | +0.0 |
| COGNITION | 15.6 | 15.6 | +0.0 | 17.6 | 17.6 | +0.0 |
| HEARING | 6.3 | 6.3 | +0.0 | 6.4 | 6.4 | +0.0 |
| VISION | 6.6 | 6.6 | +0.0 | 6.3 | 6.3 | +0.0 |
| SELFCARE | 4.4 | 4.4 | +0.0 | 4.0 | 4.0 | +0.0 |
| INDEPLIVE | 8.7 | 8.7 | +0.0 | 9.8 | 9.8 | +0.0 |
