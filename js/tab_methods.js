// Brazos HealthLens · Tab 6 "Methods & data" and the page footer.
"use strict";
const TEAM = "Diviya Bhavaani M B · Manogna Rayala · Seo Hyeon Beom · Alexis Santiago";
function drawMethods(){
  const mt=D.meta, ev=mt.pca_ev_top3;
  const y22=Object.entries(mt.years).filter(([k,v])=>v===2022).map(([k])=>MID[k]? MID[k].short:k).join(", ");
  d3.select("#methods").html(`
<h3>Requirements and where they live</h3>
<p>${rqBadge("R1")} Explore where: Map &amp; profile tab, search. ${rqBadge("R2")} Compare a tract's full profile: tract profile, Compare measures tab. ${rqBadge("R3")} Find similar and unusual tracts: Similar &amp; unusual tab, profile-group map mode. ${rqBadge("R4")} Judge reliability and context: CI whiskers, ⚠ flags, CI-width map mode, urban–rural filter. ${rqBadge("R5")} Find care gaps: Care gaps tab. The Survey &amp; requirements tab shows the survey evidence for each one.</p>
<h3>Data</h3>
<p><b>CDC PLACES: Local Data for Better Health, Census Tract Data, 2025 release</b> (Socrata dataset <code>${mt.dataset}</code>, data.cdc.gov; retrieved ${mt.retrieved}). All ${fmtInt(mt.ntx)} Texas tracts with estimates and all ${IDS.length} measures published for Texas. Most measures use 2023 BRFSS data; ${y22} use 2022 BRFSS data. Values are <b>model-based, crude (not age-adjusted) prevalence estimates</b> with 95% confidence intervals, not case counts or medical records.</p>
<p><b>Boundaries:</b> ${mt.geometry}; ${fmtInt(mt.ngeom)} tracts (40 tracts have no PLACES estimate and are drawn gray). <b>Urban–rural:</b> ${mt.ruca}; RUCA 1–3 metropolitan, 4–6 micropolitan, 7–9 small town, 10 rural.</p>
<p><b>Brazos Valley</b> = the 7 counties of the Brazos Valley Council of Governments: Brazos, Burleson, Grimes, Leon, Madison, Robertson, Washington (${mt.nbv} tracts with estimates).</p>
<p><b>Survey:</b> ${SURVEY.n} anonymous responses to the initial user survey (<code>survey/initial_user_survey.csv</code>), summarized by <code>pipeline/survey_summary.py</code>.</p>
<h3>What is not in the data</h3>
<p>Chronic kidney disease is not published in the 2025 PLACES release. Health-related social needs are absent for Texas in this release. The <b>only medication measure</b> is <i>taking BP medicine among adults with high blood pressure</i>. Age structure is not included (no Census ACS layer), so the urban–rural class and the profile groups are the context we offer for crude rates.</p>
<h3>Aggregates and scales</h3>
<p>Valley, county and Texas averages are weighted by adult population. Map colors are 5-class quantiles of the chosen scope (Brazos Valley or all Texas), ColorBrewer YlOrRd; for care measures the ramp is reversed so <b>darker always means worse</b>. Percentiles are among Texas tracts with 100 = worst.</p>
<h3>Standardization and profile groups (R3)</h3>
<p>${CORE.length} core measures are z-scored across all Texas tracts and signed so + = worse. PCA: the first three components explain ${Math.round(ev[0]*100)}%, ${Math.round(ev[1]*100)}% and ${Math.round(ev[2]*100)}% of variance. k-means (20 restarts) on those ${mt.npc} components for k = 4–8; silhouette ${Object.entries(mt.sil).map(([k,v])=>"k="+k+": "+v.toFixed(3)).join(", ")}; k = ${K} is the best, and labels are stable across 5 restarts (adjusted Rand ${d3.min(mt.ari).toFixed(3)}–${d3.max(mt.ari).toFixed(3)}). Groups are numbered from lowest to highest mean burden and named by reading the group-mean heatmap.</p>
<p><b>Peers</b>: the 20 nearest Texas tracts in Euclidean distance on the ${CORE.length} z-scores are precomputed; valley-only and outside-valley peers are recomputed in the browser. Correlated measures carry more combined weight, a known limitation. <b>Unusual for their group</b>: Euclidean distance between a tract's z-scores and its group's mean z-scores; the measure with the largest gap is reported.</p>
<h3>Relationships (R2)</h3>
<p>Pearson r across the tracts in scope, computed live (and for a highlighted group when it has 8+ tracts), with a least-squares line. These are tract-level associations, not individual risks.</p>
<h3>Care-gap index (R5)</h3>
<p><b>Burden</b> = mean z of ${mt.burden.map(short).join(", ")}. <b>Care deficit</b> = mean z of ${mt.care.map(short).join(", ")}. Both are split into tertiles of the chosen scope and crossed into a 3×3 bivariate palette. <b>Untreated BP</b> (derived) = high-BP share × (1 − BP-medicine share); it has no CI.</p>
<h3>Uncertainty (R4)</h3>
<p>Every tract estimate carries a 95% CI shown as whiskers in the profile, ranked bars and peer panels, and as the CI-width map mode. <b>Low-confidence flag ⚠</b>: CI width among the widest 10% of Texas tracts for that measure.</p>
<h3>Caveats</h3>
<p>PLACES estimates are predicted from demographics, so some correlations are built into the model, and tract-level associations do not describe individuals (ecological fallacy). Crude rates make older, mostly rural tracts look worse than age-adjusted rates would; the young, student-heavy tracts in College Station look better on chronic disease but worse on checkups and BP-medicine use.</p>
<h3>Engineering</h3>
<p>Preprocessing in Python (<code>pipeline/</code>: pandas, GeoPandas, scikit-learn, topojson). Rendering with D3.js v7.9: maps on HTML canvas with spatial-grid picking (${fmtInt(mt.ngeom)} polygons) and a county layer when zoomed out; parallel coordinates and scatterplots on canvas with SVG axes and D3 brushes. One shared state store links every view. Runs offline from <code>index.html</code>; no server or build step.</p>
<h3>Palettes</h3>
<p>Burden: ColorBrewer YlOrRd · CI width: ColorBrewer Purples · Groups: Paul Tol “muted” · Group heatmap: ColorBrewer BrBG (brown = worse) · Correlations: ColorBrewer PuOr · Care gap: Stevens bivariate · Highlight: one blue (${HL}); selection: black outline.</p>
<h3>Team</h3>
<p>Graduate Team 6, CSCE 679 Data Visualization, Texas A&amp;M University: ${TEAM}. All four members share design, data processing, implementation and evaluation equally.</p>`);
  d3.select("#foot").html("<b>Data:</b> CDC PLACES 2025 release (tract data, dataset cwsq-ngmh; BRFSS 2023/2022), U.S. Census Bureau 2020 cartographic boundaries, USDA ERS 2020 RUCA codes. Model-based crude prevalence estimates with 95% CIs, not case counts. Built with D3.js v7. Brazos HealthLens · CSCE 679 Data Visualization · Graduate Team 6: "+TEAM+".");
}
INITS.about = ()=>{};
