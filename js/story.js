// Brazos HealthLens · Guided story: seven findings, each tied to a requirement. Every number in the
// text is computed from the data at run time, so the story stays correct if the data is rebuilt.
"use strict";
const G = g=>GIDX.get(g);
const HEARNE = "48395960501";
function cAvg(name,m){ const c=Object.keys(CTY).find(k=>CTY[k].name===name && BVC.has(k)); return CTY[c].m[m]; }
function clearAnno(){ Object.values(MAPS).forEach(mp=>{ if(mp && mp.setAnno) mp.setAnno([]); }); }
function storyMapMode(k){ S.mapMode=k; d3.selectAll("#mapMode button").classed("on",function(){return this.dataset.m===k;}); changed("opts"); }
const STORY = [
 {req:"R1", title:"1 · Leon County carries the valley's heaviest chronic-disease load", go:()=>{
   setScope("bv"); storyMapMode("measure"); setMeasure("DIABETES"); showTab("map"); setSel(null);
   setHL(null); setFilter("county","289"); MAPS.main.zoomTo("bv");
   setTimeout(()=>MAPS.main.setAnno([{i:G("48289950102"),text:"Leon County\nhighest county averages",dx:60,dy:-50}]),700); },
  body:()=>{ const L=m=>fmt1(cAvg("Leon",m)); return `<p>Among the seven valley counties, <b>Leon</b> has the highest adult-weighted averages for <b>diabetes (${L("DIABETES")}%)</b>, <b>high blood pressure (${L("BPHIGH")}%)</b>, COPD (${L("COPD")}%), coronary heart disease (${L("CHD")}%) and cancer (${L("CANCER")}%).</p><p>Texas averages: diabetes ${fmt1(REF.tx.DIABETES)}%, high BP ${fmt1(REF.tx.BPHIGH)}%, COPD ${fmt1(REF.tx.COPD)}%. These are crude rates and Leon is older than the state, which explains part of the gap. Try the search box: type any town or county to find it.</p>`; }},
 {req:"R2", pos:"left", title:"2 · One Hearne tract is the valley's worst on four measures", go:()=>{
   setScope("bv"); setHL(null); storyMapMode("measure"); setMeasure("BPHIGH"); showTab("map"); const i=G(HEARNE); setSel(i,true); MAPS.main.zoomToIds([i],2.2);
   setTimeout(()=>MAPS.main.setAnno([{i,text:"Hearne · tract 9605.01",dx:70,dy:-60}]),700); },
  body:()=>{ const i=G(HEARNE); const v=m=>fmt1(V[m][i]); return `<p><b>Robertson County tract 9605.01 (Hearne)</b> has the valley's highest estimates of <b>high blood pressure (${v("BPHIGH")}%, CI ${fmt1(LO.BPHIGH[i])}–${fmt1(HI.BPHIGH[i])})</b>, <b>obesity (${v("OBESITY")}%)</b>, <b>COPD (${v("COPD")}%)</b> and <b>stroke (${v("STROKE")}%)</b>.</p><p>The profile panel compares every measure with Robertson County (■ ${fmt1(cAvg("Robertson","BPHIGH"))}% high BP), the valley (◆) and Texas (|). Red rows have their whole CI above the valley average. Profile group: <b>${clName(CL[i])}</b>.</p>`; }},
 {req:"R4", pos:"left", title:"3 · Two Bryan diabetes outliers, and how sure we are", go:()=>{
   setScope("bv"); storyMapMode("measure"); setMeasure("DIABETES"); showTab("map"); const a=G("48041000502"), b=G("48041000501"); setHL(new Set([a,b]),"Bryan 5.01 & 5.02"); setSel(a,true);
   MAPS.main.zoomTo("bcs"); setTimeout(()=>MAPS.main.setAnno([{i:a,text:"Tract 5.02: "+fmt1(V.DIABETES[a])+"%",dx:110,dy:70},{i:b,text:"Tract 5.01: "+fmt1(V.DIABETES[b])+"%",dx:-100,dy:-60}]),700); },
  body:()=>{ const a=G("48041000502"), b=G("48041000501"); return `<p>Bryan tracts <b>5.02 (${fmt1(V.DIABETES[a])}%, CI ${fmt1(LO.DIABETES[a])}–${fmt1(HI.DIABETES[a])})</b> and <b>5.01 (${fmt1(V.DIABETES[b])}%, CI ${fmt1(LO.DIABETES[b])}–${fmt1(HI.DIABETES[b])})</b> are far above Brazos County's ${fmt1(cAvg("Brazos","DIABETES"))}% and Texas's ${fmt1(REF.tx.DIABETES)}%.</p><p>Both CIs lie entirely above the valley average (whiskers in the profile and the ranked bars below), so the difference is real even though 5.02 has only ${fmtInt(ADULTS[a])} adults and a wider interval. Switch <b>Color by</b> to <b>CI width</b> to see where estimates are least certain.</p>`; }},
 {req:"R2", title:"4 · Obesity and diabetes rise together", go:()=>{
   setScope("bv"); setSel(null); setHL(null); setMeasure("DIABETES"); showTab("compare");
   d3.select("#riskX").property("value","OBESITY"); d3.select("#riskY").property("value","DIABETES"); drawRisk();
   document.getElementById("riskScatter").scrollIntoView({block:"center"}); },
  body:()=>{ const r=pearson(ID_BV.map(i=>V.OBESITY[i]), ID_BV.map(i=>V.DIABETES[i])), rt=pearson(ID_TX.map(i=>V.OBESITY[i]), ID_TX.map(i=>V.DIABETES[i]));
   return `<p>Across the ${ID_BV.length} valley tracts, obesity and diabetes are strongly related: <b>r = ${fmt2(r)}</b> (Texas: r = ${fmt2(rt)}). The ranking on the right lists the measures most related to diabetes.</p><p>Above, the parallel coordinates show all of a tract's measures at once: drag on any axis to brush a range and highlight those tracts everywhere. Remember these are tract-level patterns, not individual risks.</p>`; }},
 {req:"R3", pos:"left", title:"5 · Hearne's closest matches are across Texas", go:()=>{
   setHL(null); setScope("tx"); setSel(G(HEARNE),true); showTab("similar"); window.scrollTo({top:document.getElementById("tab-similar").offsetTop-120}); },
  body:()=>{ const i=G(HEARNE), p=(D.peers[i]||[]).slice(0,10); const names=[...new Set(p.map(j=>TR.place[j]? pname(j) : "rural "+cname(j)+" Co."))].slice(0,6);
   return `<p>Searching all of Texas on 23 standardized measures, Hearne tract 9605.01's nearest peers are in <b>${names.join(", ")}</b>, ${p.filter(j=>!IN_BV[j]).length} of 10 outside the valley.</p><p>Peers are communities that may share causes and solutions, so programs that worked there are worth a look. Further down, <b>Unusual for their group</b> lists tracts that do not look like the rest of their profile group.</p>`; }},
 {req:"R4", title:"6 · Brazos County lags Texas on blood-pressure medicine", go:()=>{
   setScope("bv"); setSel(null); setHL(null); storyMapMode("measure"); setMeasure("BPMED"); showTab("map"); setFilter("cluster",0); MAPS.main.zoomTo("bcs"); },
  body:()=>{ const b=cAvg("Brazos","BPMED"), young=ID_BV.filter(i=>CL[i]===0); return `<p>Among adults with high blood pressure, only <b>${fmt1(b)}%</b> in Brazos County take BP medicine, against <b>${fmt1(REF.tx.BPMED)}%</b> for Texas and ${fmt1(d3.min(D.bv_cfp.filter(c=>c!=="041"),c=>CTY[c].m.BPMED))}–${fmt1(d3.max(D.bv_cfp.filter(c=>c!=="041"),c=>CTY[c].m.BPMED))}% in the other valley counties.</p><p>Context matters: the highlighted <b>${young.length} “${CLS[0].name}”</b> tracts average ${fmt1(wmean("BPMED",young))}%. Young adults with high BP are less often treated, so the student-heavy tracts pull the county down. Crude rates, not age-adjusted.</p>`; }},
 {req:"R5", title:"7 · Where care and medication are most needed", go:()=>{
   setScope("bv"); setSel(null); showTab("gap"); gapT=gapCuts(); const hh=ID_BV.filter(i=>{ const c=gapClass(i); return c[0]===2&&c[1]===2; }); setHL(new Set(hh),"care-gap tracts"); MAPS.gap.zoomTo("bv"); },
  body:()=>{ gapT=gapCuts(); const hh=ID_BV.filter(i=>{ const c=gapClass(i); return c[0]===2&&c[1]===2; }).sort((a,b)=>(BURDEN[b]+DEFICIT[b])-(BURDEN[a]+DEFICIT[a])); return `<p>Crossing a disease-burden index with a care-deficit index (uninsured, no checkup, no BP medicine, no cholesterol screening) leaves <b>${hh.length} valley tracts</b> in the darkest cell: ${hh.map(i=>tname(i).replace("Tract ","")+" ("+pname(i)+")").join(", ")}.</p><p>Switch the scope to <b>All Texas</b> for the statewide list. These are the places where outreach for checkups, insurance enrollment and hypertension treatment would matter most.</p>`; }},
];
let stK=0;
function storyGo(k){ stK=Math.max(0,Math.min(STORY.length-1,k)); clearAnno(); const st=STORY[stK];
  d3.select("#story").style("display","block").style("left", st.pos==="left"? "20px" : null).style("right", st.pos==="left"? "auto" : "20px"); st.go();
  d3.select("#stTitle").html(rqBadge(st.req)+" "+st.title); d3.select("#stBody").html(st.body());
  d3.select("#stDots").selectAll("span").data(STORY).join("span").classed("on",(d,j)=>j===stK).attr("title",d=>d.title).on("click",(e,d)=>storyGo(STORY.indexOf(d)));
  d3.select("#stPrev").property("disabled",stK===0); d3.select("#stNext").text(stK===STORY.length-1?"Finish ✓":"Next ▶");
  RSTAT.story={step:stK, tab:S.tab}; }
function storyClose(){ d3.select("#story").style("display","none"); clearAnno(); }
d3.select("#storyBtn").on("click",()=>storyGo(0));
d3.select("#stNext").on("click",()=>{ if(stK===STORY.length-1) storyClose(); else storyGo(stK+1); });
d3.select("#stPrev").on("click",()=>storyGo(stK-1));
d3.select("#storyX").on("click",storyClose);
document.addEventListener("keydown", e=>{ if(!STORY_ON() || e.target.tagName==="INPUT" || e.target.tagName==="SELECT") return;
  if(e.key==="ArrowRight") d3.select("#stNext").dispatch("click"); else if(e.key==="ArrowLeft" && stK>0) storyGo(stK-1); else if(e.key==="Escape") storyClose(); });
d3.select("#resetBtn").on("click",()=>{ storyClose(); d3.select("#search").property("value",""); storyMapMode("measure");
  setHL(null); setSel(null); setScope("bv"); setMeasure("DIABETES"); if(MAPS.main) MAPS.main.zoomTo("bv"); });
