// Brazos HealthLens · Guided story (final version).
// Feedback: "needs a consistent story to show how different visualizations are linked together" (instructor),
// "keep the same selected area throughout", "one question answered across tabs", "a practical outreach
// example", "a final recap". The story now asks ONE question and follows ONE tract through every view; the
// tract stays outlined in black and the group found in step 4 stays blue in every later step.
// Every number is computed from the data at run time, so the story stays correct after a data refresh.
"use strict";
const G = g=>GIDX.get(g);
const HEARNE = "48395960501";
const ST = ()=>G(STORY_GID);                 // the tract the story follows (defined in overview.js)
function cAvg(name,m){ const c=Object.keys(CTY).find(k=>CTY[k].name===name && BVC.has(k)); return CTY[c].m[m]; }
function clearAnno(){ Object.values(MAPS).forEach(mp=>{ if(mp && mp.setAnno) mp.setAnno([]); }); }
function storyMapMode(k){ S.mapMode=k; d3.selectAll("#mapMode button").classed("on",function(){return this.dataset.m===k;}); changed("opts"); }
const valleyRank = (m,i)=>{ const ids=ID_BV.filter(j=>!isNaN(V[m][j])).sort((a,b)=>worseVal(m,V[m][b])-worseVal(m,V[m][a])); return [ids.indexOf(i)+1, ids.length, ids]; };
const nextLine = t=>'<p class="next">Next → '+t+'</p>';
let storyGroup = null;                       // the tracts found in step 4, kept highlighted afterwards
function storyGroupIds(){ return ID_BV.filter(i=>V.BPHIGH[i]>=REF.bv.BPHIGH && V.ACCESS2[i]>=REF.bv.ACCESS2); }
function gapHH(){ gapT=gapCuts(); return scopeIds().filter(i=>{ const c=gapClass(i); return c[0]===2&&c[1]===2; }); }

const STORY = [
 {req:"", tab:"overview", title:"The question: where should blood-pressure outreach start?", go:()=>{
   setScope("bv"); setHL(null); setMeasure("BPHIGH"); setSel(ST(),true); showTab("overview"); window.scrollTo({top:0}); },
  body:()=>{ const i=ST(); return `<p>A health district wants to start a <b>high-blood-pressure outreach program</b> in the Brazos Valley. Where first, and how sure can it be?</p>
   <p>We follow one place through every view: <b>${tfull(i)}</b>. It keeps its <b>black outline</b> in every tab, and the group we find in step 4 stays <b style="color:${HL}">blue</b>. The diagram shows the route.</p>` + nextLine("the map: where is high blood pressure most common?"); }},
 {req:"R1", tab:"map", title:"1 · Where is high blood pressure most common?", go:()=>{
   setScope("bv"); setHL(null); storyMapMode("measure"); setMeasure("BPHIGH"); setSel(ST(),true); showTab("map"); MAPS.main.zoomTo("bv");
   setTimeout(()=>MAPS.main.setAnno([{i:ST(),text:tname(ST())+" · "+pname(ST()),dx:90,dy:60},{i:G(HEARNE),text:"Hearne",dx:-70,dy:-50}]),700); },
  body:()=>{ const i=ST(), [r,n,ids]=valleyRank("BPHIGH",i); const top=ids.slice(0,3).map(j=>pname(j)+" "+pct(V.BPHIGH[j])).join(", ");
   return `<p>Darker tracts have more adults with high blood pressure. The valley average is <b>${pct(REF.bv.BPHIGH)}</b> (Texas ${pct(REF.tx.BPHIGH)}); the highest tracts are ${top}.</p>
   <p>Our tract is at <b>${pct(V.BPHIGH[i])}</b>, ranked <b>${r} of ${n}</b> valley tracts. High, but the map alone cannot say whether care is reaching people.</p>` + nextLine("the same tract's full profile, on the right of the map."); }},
 {req:"R2", tab:"map", pos:"left", title:"2 · How does this tract compare on every measure?", go:()=>{
   setScope("bv"); setHL(null); storyMapMode("measure"); setMeasure("BPHIGH"); setSel(ST(),true); showTab("map"); MAPS.main.zoomToIds([ST()],2.2);
   const p=document.getElementById("profile"); if(p) p.scrollTop=0; },
  body:()=>{ const i=ST(), c=CTY[TR.cfp[i]]; const red=CORE.filter(m=>HI[m] && (isGood(m)? HI[m][i]<REF.bv[m] : LO[m][i]>REF.bv[m])).length;
   return `<p>The profile puts every measure on one row: the dot and line are this tract with its 95% interval, ■ is ${cname(i)} County, ◆ the valley and | Texas.</p>
   <p><b>${red} of ${CORE.length}</b> core measures are clearly worse than the valley (red rows). Uninsured adults: <b>${pct(V.ACCESS2[i])}</b> vs. county ${pct(c.m.ACCESS2)} and Texas ${pct(REF.tx.ACCESS2)}. Routine checkups: ${pct(V.CHECKUP[i])} vs. Texas ${pct(REF.tx.CHECKUP)}.</p>` + nextLine("how sure are we about the blood-pressure number?"); }},
 {req:"R4", tab:"map", title:"3 · How sure are we?", go:()=>{
   setScope("bv"); setHL(null); setMeasure("BPHIGH"); setSel(ST(),true); showTab("map"); storyMapMode("ci"); MAPS.main.zoomTo("bv"); },
  body:()=>{ const i=ST(), lo=LO.BPHIGH[i], hi=HI.BPHIGH[i], w=hi-lo; const nlow=ID_BV.filter(j=>lowc("BPHIGH",j)).length; const above=lo>REF.bv.BPHIGH;
   return `<p>The map now shows <b>how wide each estimate's 95% interval is</b> (darker purple = less certain). Our tract's high-BP estimate is ${pct(V.BPHIGH[i])} with an interval of <b>${fmt1(lo)}–${fmt1(hi)}%</b> (${fmt1(w)} points wide${lowc("BPHIGH",i)? ", among the least certain 10% in Texas" : ", not among the least certain"}).</p>
   <p>${above? "The <b>whole interval is above</b> the valley average of "+pct(REF.bv.BPHIGH)+", so the difference is real, not noise." : "The interval overlaps the valley average of "+pct(REF.bv.BPHIGH)+", so treat the difference with care."} ${nlow} valley tracts are flagged ⚠ for this measure. These are crude rates: it is a ${RU_NAMES[TR.ru[i]].toLowerCase()} tract in the <i>${clName(CL[i])}</i> group.</p>` + nextLine("which other valley tracts share the problem?"); }},
 {req:"R2", tab:"compare", title:"4 · Which tracts share the problem?", go:()=>{
   setScope("bv"); storyMapMode("measure"); setMeasure("BPHIGH"); setSel(ST(),true); showTab("compare"); setPCPPreset("bp");
   pcpBrushes.clear(); pcpBrushes.set("BPHIGH",[REF.bv.BPHIGH, 100]); pcpBrushes.set("ACCESS2",[REF.bv.ACCESS2, 100]); drawPCP(); applyPCPFilter(true);
   setTimeout(()=>{ storyGroup=S.hl? new Set(S.hl) : new Set(storyGroupIds()); const c=document.getElementById("pcpWrap"); if(c) c.scrollIntoView({block:"center"}); }, 60); },
  body:()=>{ const i=ST(), g=storyGroupIds();
   return `<p>Each line is a tract; every axis points up = worse. Our tract is the <b>thick black line</b>, with its values printed on each axis.</p>
   <p>We brushed two axes: <b>high BP above the valley average</b> and <b>uninsured above the valley average</b>. <b style="color:${HL}">${g.length} valley tracts</b> match${g.includes(i)? ", including ours" : ""}. They turn blue here <b>and in every other view</b>, so we can follow the group, not just one tract.</p>` + nextLine("places elsewhere in Texas with the same profile."); }},
 {req:"R3", tab:"similar", pos:"left", title:"5 · Which places elsewhere in Texas look like it?", go:()=>{
   setScope("tx"); setSel(ST(),true); if(storyGroup) setHL(new Set(storyGroup),"story: high BP + uninsured"); showTab("similar"); window.scrollTo({top:document.getElementById("tab-similar").offsetTop-120}); },
  body:()=>{ const i=ST(), p=(D.peers[i]||[]).slice(0,10); const names=[...new Set(p.map(j=>TR.place[j]? pname(j) : "rural "+cname(j)+" Co."))].slice(0,5); const sw=simWords(peerDist(i,p[0]));
   return `<p>Searching all ${fmtInt(ID_TX.length)} Texas tracts on 23 standardized measures, our tract's closest matches are in <b>${names.join(", ")}</b>. The nearest is <i>${sw.label}</i> (closer than ${sw.pct}% of random pairs of tracts).</p>
   <p>Peers share a health profile, so outreach programs that worked there are worth borrowing. The blue group from step 4 is still highlighted on this tab's map and heatmap.</p>` + nextLine("is it a true care gap: high burden and weak care?"); }},
 {req:"R5", tab:"gap", title:"6 · Is it a care gap?", go:()=>{
   setScope("bv"); setSel(ST(),true); if(storyGroup) setHL(new Set(storyGroup),"story: high BP + uninsured"); showTab("gap"); MAPS.gap.zoomTo("bv"); },
  body:()=>{ const i=ST(); gapT=gapCuts(); const c=gapClass(i), hh=gapHH(), h=G(HEARNE), ch=gapClass(h); const inGroup=storyGroup? hh.filter(j=>storyGroup.has(j)).length : 0;
   return `<p>Disease burden (up) crossed with weak preventive care (right). Our tract sits in the <b>${["low","middle","high"][c[0]]}-burden, ${["low","middle","high"][c[1]]}-deficit</b> cell${c[0]===2&&c[1]===2? ": the darkest, a true care gap" : ""}. <b>${hh.length}</b> valley tracts are in that cell; ${inGroup} of them are in our blue group.</p>
   <p>Contrast: Hearne has the valley's highest high-BP rate (${pct(V.BPHIGH[h])}) but ${["low","middle","high"][ch[1]]} care deficit (BP medicine ${pct(V.BPMED[h])}). It needs disease management, while our tract needs <b>access</b>: insurance, checkups, treatment.</p>` + nextLine("the answer, and a list to take to the team."); }},
 {req:"", tab:"gap", title:"7 · The answer, and what to take away", go:()=>{
   setScope("bv"); setSel(ST(),true); const hh=gapHH(); setHL(new Set(hh),"care-gap tracts"); showTab("gap");
   const h=G(HEARNE); if(!S.pins.includes(ST())) S.pins.push(ST()); if(!S.pins.includes(h)) S.pins.push(h); S.pins=S.pins.slice(-4); changed("pins"); },
  body:()=>{ const i=ST(), h=G(HEARNE), hh=gapHH().sort((a,b)=>V.UNTREATED[b]-V.UNTREATED[a]);
   const row=(lab,m)=>'<tr><td>'+lab+'</td><td><b>'+pct(V[m][i])+'</b></td><td>'+pct(V[m][h])+'</td><td>'+pct(REF.bv[m])+'</td><td>'+pct(REF.tx[m])+'</td></tr>';
   return `<p><b>Start outreach in the ${hh.length} care-gap tracts</b>, led by ${hh.slice(0,3).map(j=>tname(j).replace("Tract ","")+" ("+pname(j)+")").join(", ")}: the most adults with high BP who are not treated.</p>
   <table class="list storytab"><tr><th></th><th>${tname(i).replace("Tract ","")}</th><th>Hearne</th><th>Valley</th><th>Texas</th></tr>${row("High BP","BPHIGH")}${row("Uninsured","ACCESS2")}${row("BP medicine","BPMED")}${row("Untreated BP","UNTREATED")}</table>
   <p class="storybtns"><button class="btn primary" id="stCSV">⤓ Outreach list (CSV)</button> <button class="btn" id="stPrint">Printable summary</button> <button class="btn" id="stLink">🔗 Share link</button></p>
   <p class="mu">Both tracts are pinned on the Map tab for a side-by-side check. Estimates are modeled and crude: confirm with local data before acting.</p>`; },
  after:()=>{ d3.select("#stCSV").on("click",exportCSV); d3.select("#stPrint").on("click",printSummary); d3.select("#stLink").on("click",copyLink); }},
];
let stK=0;
function storyGo(k){ stK=Math.max(0,Math.min(STORY.length-1,k)); clearAnno(); const st=STORY[stK];
  d3.select("#story").style("display","block").style("left", st.pos==="left"? "20px" : null).style("right", st.pos==="left"? "auto" : "20px"); st.go();
  d3.select("#story .sh span").text("Guided story · step "+(stK+1)+" of "+STORY.length+" · following "+tname(ST())+", "+pname(ST()));
  d3.select("#stTitle").html((st.req? rqBadge(st.req)+" " : "")+st.title); d3.select("#stBody").html(st.body()); if(st.after) st.after();
  d3.select("#stDots").selectAll("span").data(STORY).join("span").classed("on",(d,j)=>j===stK).attr("title",d=>d.title).on("click",(e,d)=>storyGo(STORY.indexOf(d)));
  d3.select("#stPrev").property("disabled",stK===0); d3.select("#stNext").text(stK===STORY.length-1?"Finish ✓":"Next ▶");
  RSTAT.story={step:stK, tab:S.tab, sel:S.sel, hl:S.hl? S.hl.size:0}; liveSay("Story step "+(stK+1)+": "+st.title); }
function storyClose(){ d3.select("#story").style("display","none"); clearAnno(); }
d3.select("#storyBtn").on("click",()=>storyGo(0));
d3.select("#stNext").on("click",()=>{ if(stK===STORY.length-1) storyClose(); else storyGo(stK+1); });
d3.select("#stPrev").on("click",()=>storyGo(stK-1));
d3.select("#storyX").on("click",storyClose);
document.addEventListener("keydown", e=>{ if(!STORY_ON() || e.target.tagName==="INPUT" || e.target.tagName==="SELECT") return;
  if(e.key==="ArrowRight") d3.select("#stNext").dispatch("click"); else if(e.key==="ArrowLeft" && stK>0) storyGo(stK-1); else if(e.key==="Escape") storyClose(); });
d3.select("#resetBtn").on("click",()=>{ storyClose(); d3.select("#search").property("value",""); storyMapMode("measure");
  if(typeof pcpBrushes!=="undefined") pcpBrushes.clear(); S.pins=[]; changed("pins");
  setHL(null); setSel(null); setScope("bv"); setMeasure("DIABETES"); if(MAPS.main) MAPS.main.zoomTo("bv"); });
