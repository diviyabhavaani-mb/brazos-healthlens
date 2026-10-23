"""Settings shared by every pipeline step. Edit here, not in the scripts."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "pipeline" / "raw"        # downloads (git-ignored)
WORK = ROOT / "pipeline" / "work"      # intermediate files (git-ignored)
DATA = ROOT / "data"                   # files the dashboard loads
# ---- sources ----
PLACES_DATASET = "cwsq-ngmh"   # CDC PLACES, Census Tract Data, 2025 release (Socrata id on data.cdc.gov)
PLACES_URL = f"https://data.cdc.gov/resource/{PLACES_DATASET}.csv"
PLACES_CSV = RAW / "places_tx_tract_2025.csv"
TRACT_ZIP_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_48_tract_500k.zip"
PLACE_ZIP_URL = "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_48_place_500k.zip"
TRACT_ZIP = RAW / "cb_2020_48_tract_500k.zip"
PLACE_ZIP = RAW / "cb_2020_48_place_500k.zip"
# USDA ERS 2020 RUCA codes. ERS moves this file now and then: if the download fails, get the
# tract-level 2020 RUCA file from https://www.ers.usda.gov/data-products/rural-urban-commuting-area-codes
# and save it as RUCA_FILE (.xlsx or .csv).
RUCA_URL = "https://www.ers.usda.gov/media/5444/2020-rural-urban-commuting-area-codes-census-tracts.xlsx"
RUCA_FILE = RAW / "ruca2020_tracts.xlsx"
TRACT_GEO_CSV = WORK / "tract_geo.csv"   # written by build_topology.py, read by build_data.py

STATE = "TX"
STATE_FIPS = "48"
SOURCE_TEXT = "CDC PLACES: Local Data for Better Health, Census Tract Data, 2025 release (BRFSS 2023; some measures 2022)"
GEOMETRY_TEXT = "U.S. Census Bureau, 2020 cartographic boundary files cb_2020_48_tract_500k and cb_2020_48_place_500k"
RUCA_TEXT = "USDA ERS 2020 Rural-Urban Commuting Area Codes, census tracts"

# ---- study area: Brazos Valley Council of Governments ----
BV_COUNTIES = {"041": "Brazos", "051": "Burleson", "185": "Grimes", "289": "Leon", "313": "Madison", "395": "Robertson", "477": "Washington"}

# RUCA primary code -> class index used by the dashboard
def ruca_class(code):
    try:
        c = int(float(code))
    except (TypeError, ValueError):
        return 4
    return 0 if 1 <= c <= 3 else 1 if c <= 6 else 2 if c <= 9 else 3 if c == 10 else 4
RU_NAMES = ["Metropolitan (RUCA 1–3)", "Micropolitan (4–6)", "Small town (7–9)", "Rural (10)", "Not coded"]

# ---- analysis settings ----
CORE = ["DIABETES", "BPHIGH", "OBESITY", "COPD", "CASTHMA", "CHD", "DEPRESSION", "CANCER", "STROKE", "HIGHCHOL", "ARTHRITIS", "CSMOKING", "LPA", "BINGE", "SLEEP", "ACCESS2", "CHECKUP", "BPMED", "CHOLSCREEN", "DENTAL", "GHLTH", "MHLTH", "DISABILITY"]   # 23 measures used for peers and profile groups
BURDEN = ["DIABETES", "BPHIGH", "CHD", "STROKE", "COPD"]
CARE = ["ACCESS2", "CHECKUP", "BPMED", "CHOLSCREEN"]
N_PEERS = 20
K_RANGE = range(4, 9)     # k-means candidates; the best silhouette is used
PCA_VAR = 0.90            # keep enough components for 90% of variance
KMEANS_RESTARTS = 20
SEED = 7
LOW_CONF_PCT = 90         # CI width above this Texas percentile = low confidence

# Profile-group names, in order of increasing mean burden (group 0 = lowest). Rename after
# reading the group heatmap if a rebuild changes the groups.
CLUSTERS = [
 {
  "name": "Young adult & student areas",
  "desc": "Low chronic disease; more binge drinking and depression; fewer checkups and low BP-medicine use"
 },
 {
  "name": "Healthier, well-served suburbs",
  "desc": "Below-average burden on nearly every measure; insured, screened and connected to care"
 },
 {
  "name": "Working-age, under-insured",
  "desc": "Near-average disease but more uninsured adults, fewer checkups and dental visits"
 },
 {
  "name": "Older, high chronic disease, good care use",
  "desc": "More high BP, heart disease, COPD, cancer, arthritis; high checkup and BP-medicine use; mostly small-town/rural"
 },
 {
  "name": "Highest burden, lowest access",
  "desc": "Highest diabetes, obesity, smoking, inactivity, disability and poor health, plus most uninsured"
 }
]

# The 33 PLACES measures shown, in display order. good=1: higher is better (care measures).
MEASURES = [
    {"id": "DIABETES", "label": "Diabetes", "short": "Diabetes", "group": "Disease", "good": 0},
    {"id": "BPHIGH", "label": "High blood pressure", "short": "High BP", "group": "Disease", "good": 0},
    {"id": "OBESITY", "label": "Obesity", "short": "Obesity", "group": "Disease", "good": 0},
    {"id": "COPD", "label": "COPD", "short": "COPD", "group": "Disease", "good": 0},
    {"id": "CASTHMA", "label": "Current asthma", "short": "Asthma", "group": "Disease", "good": 0},
    {"id": "CHD", "label": "Coronary heart disease", "short": "Heart dis.", "group": "Disease", "good": 0},
    {"id": "DEPRESSION", "label": "Depression", "short": "Depression", "group": "Disease", "good": 0},
    {"id": "CANCER", "label": "Cancer (excl. skin)", "short": "Cancer", "group": "Disease", "good": 0},
    {"id": "STROKE", "label": "Stroke", "short": "Stroke", "group": "Disease", "good": 0},
    {"id": "HIGHCHOL", "label": "High cholesterol", "short": "High chol.", "group": "Other condition", "good": 0},
    {"id": "ARTHRITIS", "label": "Arthritis", "short": "Arthritis", "group": "Other condition", "good": 0},
    {"id": "TEETHLOST", "label": "All teeth lost (65+)", "short": "Teeth lost", "group": "Other condition", "good": 0},
    {"id": "CSMOKING", "label": "Current smoking", "short": "Smoking", "group": "Risk behavior", "good": 0},
    {"id": "LPA", "label": "No leisure-time physical activity", "short": "Inactivity", "group": "Risk behavior", "good": 0},
    {"id": "BINGE", "label": "Binge drinking", "short": "Binge", "group": "Risk behavior", "good": 0},
    {"id": "SLEEP", "label": "Short sleep (<7 h)", "short": "Short sleep", "group": "Risk behavior", "good": 0},
    {"id": "ACCESS2", "label": "Uninsured (18–64)", "short": "Uninsured", "group": "Care access", "good": 0},
    {"id": "CHECKUP", "label": "Routine checkup in past year", "short": "Checkup", "group": "Care access", "good": 1},
    {"id": "BPMED", "label": "Taking BP medicine (adults with high BP)", "short": "BP medicine", "group": "Care access", "good": 1},
    {"id": "CHOLSCREEN", "label": "Cholesterol screening", "short": "Chol. screen", "group": "Care access", "good": 1},
    {"id": "DENTAL", "label": "Dental visit in past year", "short": "Dental visit", "group": "Care access", "good": 1},
    {"id": "COLON_SCREEN", "label": "Colorectal cancer screening (45–75)", "short": "Colon screen", "group": "Care access", "good": 1},
    {"id": "MAMMOUSE", "label": "Mammogram in past 2 yrs (women 50–74)", "short": "Mammogram", "group": "Care access", "good": 1},
    {"id": "GHLTH", "label": "Fair or poor general health", "short": "Fair/poor health", "group": "Health status", "good": 0},
    {"id": "PHLTH", "label": "Frequent physical distress", "short": "Phys. distress", "group": "Health status", "good": 0},
    {"id": "MHLTH", "label": "Frequent mental distress", "short": "Mental distress", "group": "Health status", "good": 0},
    {"id": "DISABILITY", "label": "Any disability", "short": "Any disability", "group": "Disability", "good": 0},
    {"id": "MOBILITY", "label": "Mobility disability", "short": "Mobility", "group": "Disability", "good": 0},
    {"id": "COGNITION", "label": "Cognitive disability", "short": "Cognition", "group": "Disability", "good": 0},
    {"id": "HEARING", "label": "Hearing disability", "short": "Hearing", "group": "Disability", "good": 0},
    {"id": "VISION", "label": "Vision disability", "short": "Vision", "group": "Disability", "good": 0},
    {"id": "SELFCARE", "label": "Self-care disability", "short": "Self-care", "group": "Disability", "good": 0},
    {"id": "INDEPLIVE", "label": "Independent-living disability", "short": "Indep. living", "group": "Disability", "good": 0},
]

# Map labels: towns drawn on the maps (tx = shown at state zoom, bv = shown when zoomed to the valley).
LABELS = [
    {"name": "Tyler", "lon": -95.3118, "lat": 32.3353, "tx": True, "bv": False},
    {"name": "Centerville", "lon": -95.9807, "lat": 31.2585, "tx": False, "bv": True},
    {"name": "Franklin", "lon": -96.4856, "lat": 31.0252, "tx": False, "bv": True},
    {"name": "Normangee", "lon": -96.1166, "lat": 31.0302, "tx": False, "bv": True},
    {"name": "El Paso", "lon": -106.5014, "lat": 31.8119, "tx": True, "bv": False},
    {"name": "Snook", "lon": -96.4659, "lat": 30.4888, "tx": False, "bv": True},
    {"name": "Oakwood", "lon": -95.8474, "lat": 31.5877, "tx": False, "bv": True},
    {"name": "Anderson", "lon": -95.9897, "lat": 30.4858, "tx": False, "bv": True},
    {"name": "McAllen", "lon": -98.2257, "lat": 26.2847, "tx": True, "bv": False},
    {"name": "Brownsville", "lon": -97.471, "lat": 26.0285, "tx": True, "bv": False},
    {"name": "Killeen", "lon": -97.726, "lat": 31.047, "tx": True, "bv": False},
    {"name": "Nacogdoches", "lon": -94.6492, "lat": 31.6174, "tx": True, "bv": False},
    {"name": "Midland", "lon": -102.1204, "lat": 32.0213, "tx": True, "bv": False},
    {"name": "Bremond", "lon": -96.6758, "lat": 31.1647, "tx": False, "bv": True},
    {"name": "Waco", "lon": -97.1662, "lat": 31.5532, "tx": True, "bv": False},
    {"name": "San Angelo", "lon": -100.4555, "lat": 31.4314, "tx": True, "bv": False},
    {"name": "Caldwell", "lon": -96.6964, "lat": 30.5307, "tx": False, "bv": True},
    {"name": "Abilene", "lon": -99.7155, "lat": 32.4833, "tx": True, "bv": False},
    {"name": "Brenham", "lon": -96.3943, "lat": 30.1576, "tx": False, "bv": True},
    {"name": "Calvert", "lon": -96.6716, "lat": 30.9724, "tx": False, "bv": True},
    {"name": "Odessa", "lon": -102.3513, "lat": 31.8779, "tx": True, "bv": False},
    {"name": "Iola", "lon": -96.0742, "lat": 30.7717, "tx": False, "bv": True},
    {"name": "Amarillo", "lon": -101.8134, "lat": 35.1985, "tx": True, "bv": False},
    {"name": "Victoria", "lon": -96.9768, "lat": 28.8343, "tx": True, "bv": False},
    {"name": "Buffalo", "lon": -96.0688, "lat": 31.4573, "tx": False, "bv": True},
    {"name": "San Antonio", "lon": -98.5577, "lat": 29.4583, "tx": True, "bv": False},
    {"name": "Bryan", "lon": -96.3455, "lat": 30.663, "tx": True, "bv": True},
    {"name": "Fort Worth", "lon": -97.3419, "lat": 32.7997, "tx": True, "bv": False},
    {"name": "Beaumont", "lon": -94.1501, "lat": 30.0811, "tx": True, "bv": False},
    {"name": "Hearne", "lon": -96.5961, "lat": 30.8788, "tx": False, "bv": True},
    {"name": "Huntsville", "lon": -95.5466, "lat": 30.6868, "tx": True, "bv": False},
    {"name": "Wichita Falls", "lon": -98.5064, "lat": 33.9156, "tx": True, "bv": False},
    {"name": "Lubbock", "lon": -101.9076, "lat": 33.5786, "tx": True, "bv": False},
    {"name": "Jewett", "lon": -96.1476, "lat": 31.3615, "tx": False, "bv": True},
    {"name": "Austin", "lon": -97.714, "lat": 30.3075, "tx": True, "bv": False},
    {"name": "Madisonville", "lon": -95.9124, "lat": 30.9528, "tx": False, "bv": True},
    {"name": "College Station", "lon": -96.3084, "lat": 30.588, "tx": True, "bv": True},
    {"name": "Somerville", "lon": -96.531, "lat": 30.3497, "tx": False, "bv": True},
    {"name": "Houston", "lon": -95.4466, "lat": 29.8164, "tx": True, "bv": False},
    {"name": "Corpus Christi", "lon": -97.4487, "lat": 27.7595, "tx": True, "bv": False},
    {"name": "Laredo", "lon": -99.4746, "lat": 27.5557, "tx": True, "bv": False},
    {"name": "Navasota", "lon": -96.0843, "lat": 30.3929, "tx": False, "bv": True},
    {"name": "Dallas", "lon": -96.7857, "lat": 32.8148, "tx": True, "bv": False},
    {"name": "Texarkana", "lon": -94.0772, "lat": 33.45, "tx": True, "bv": False},
    {"name": "Longview", "lon": -94.7521, "lat": 32.5093, "tx": True, "bv": False},
]

YEARS_2022 = ["COLON_SCREEN", "DENTAL", "MAMMOUSE", "SLEEP", "TEETHLOST"]   # measures whose BRFSS year is 2022
