// Brazos HealthLens · Tab 5 "Survey & requirements"
// Shows the initial user survey (data/survey_summary.js, built by pipeline/survey_summary.py) and how each
// answer supports one of the five requirements R1–R5. Every chart here is drawn from the survey file.
"use strict";
const SV_EVQ = ["Q5","Q7","Q8","Q9"];   // questions whose options map to requirements
const HOW = {
  R1:{text:"Map & profile tab: choropleth of any of 34 measures for the valley or all Texas, county layer when zoomed out, search by town, county or tract, ranked list of the 15 worst tracts.", tab:"map", setup:()=>{ setMapMode("measure"); }},
  R2:{text:"Tract profile with county ■, valley ◆ and Texas | markers for every measure; parallel coordinates for many measures at once; scatterplot + correlation ranking to relate risk factors to outcomes.", tab:"compare", setup:()=>{}},
  R3:{text:"Similar & unusual tab: 5–20 nearest peer tracts anywhere in Texas, five profile groups (also a map color mode), and a table of tracts that differ most from their own group.", tab:"similar", setup:()=>{}},
  R4:{text:"95% CI whiskers in the profile, ranked bars and peer panels; ⚠ low-confidence flag; CI-width map mode; urban–rural filter and color option in every view.", tab:"map", setup:()=>{ setMapMode("ci"); }},
  R5:{text:"Care gaps tab: bivariate map of disease burden × care deficit, matching scatterplot, and the ranked list of high/high tracts for outreach.", tab:"gap", setup:()=>{}},
};
const DECISIONS = [
  ["R3 · R4","The two most-reported challenges (4 of 6 each) were finding communities with similar profiles and understanding how reliable estimates are, so peers and confidence intervals are built into the core views rather than a separate tab."],
  ["R1 · R2","“Comparing neighborhoods within the same county” was the most useful comparison (4 of 6), so the tract profile adds a county marker next to the valley and Texas references, and county bars sit under the map."],
  ["R2","“Explore relationships between multiple measures” was the most requested task (4 of 6): the Compare measures tab pairs parallel coordinates with a scatterplot and a ranking of the strongest correlates."],
  ["R4","Q8 split between reference averages, local context and confidence intervals, so all three are shown together, and an urban–rural filter supplies the context."],
  ["Ease of use","Four of six respondents use spreadsheets today and only two use GIS tools, so the dashboard uses plain labels, search by place name, a single focus measure shared by all views, and a 7-step guided story."],
  ["Q10","Accessibility was asked for directly: colorblind-safe palettes, darker always means worse, text values next to every color, keyboard-usable controls and visible focus outlines."],
  ["R5","Care gaps had the weakest support (2 of 6) but came from the epidemiologist and a student, and serves outreach planning. It is kept as one tab and will be re-tested in the evaluation sessions."],
];
function svCount(q, rid){ const Q=SURVEY.questions.find(x=>x.id===q); const who=new Set(); (Q.options||[]).forEach(o=>{ if(o.requirements.includes(rid)) o.respondents.forEach(r=>who.add(r)); }); return who.size; }
function initSurveyTab(){
  const n=SURVEY.n;
  d3.select("#svIntro").html("Six people answered an anonymous 10-question survey before we built the tool ("+SURVEY.note.replace("Anonymous formative survey (Google Forms), collected ","collected ")+"). Each cell counts the respondents who picked at least one option in that question that points to the requirement; the last column counts respondents who support it anywhere. Click a row to read its evidence.");
  // ---- evidence matrix ----
  const W=760, lw=250, cw=90, rh=34, top=40, H=top+5*rh+10; const sv=d3.select("#svMatrix").attr("viewBox",[0,0,W,H]); sv.selectAll("*").remove();
  const cols=[...SV_EVQ.map(q=>({q, label:q, sub:SURVEY.questions.find(x=>x.id===q).label})),{q:"all",label:"Supporters",sub:"Any question"}];
  cols.forEach((c,k)=>{ const g=sv.append("g").attr("transform","translate("+(lw+k*cw+cw/2)+",0)");
    g.append("text").attr("y",15).attr("text-anchor","middle").attr("font-size",12).attr("font-weight",700).text(c.label);
    g.append("text").attr("y",30).attr("text-anchor","middle").attr("font-size",9.5).attr("fill","#5f6b7a").text(c.sub.length>18? c.sub.slice(0,17)+"…" : c.sub).append("title").text(c.sub); });
  const col=d3.scaleLinear().domain([0,n]).range([0,1]);
  SURVEY.requirements.forEach((r,j)=>{ const y=top+j*rh; const g=sv.append("g").attr("transform","translate(0,"+y+")").style("cursor","pointer")
      .on("click",()=>{ const el=document.getElementById("rc-"+r.id); if(el){ el.scrollIntoView({behavior:"smooth",block:"center"}); el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"),1200); } });
    g.append("rect").attr("x",0).attr("y",3).attr("width",8).attr("height",rh-6).attr("fill",REQ[r.id].col);
    g.append("text").attr("x",14).attr("y",rh/2+4).attr("font-size",12.5).attr("font-weight",650).text(r.id+" · "+r.title);
    cols.forEach((c,k)=>{ const v = c.q==="all"? r.n_supporters : svCount(c.q, r.id);
      g.append("rect").attr("x",lw+k*cw+3).attr("y",2).attr("width",cw-6).attr("height",rh-4).attr("rx",4).attr("fill",REQ[r.id].col).attr("fill-opacity",v? 0.12+0.78*col(v) : 0.04)
        .attr("stroke",c.q==="all"?"#1f2933":"none").attr("stroke-width",1);
      g.append("text").attr("x",lw+k*cw+cw/2).attr("y",rh/2+5).attr("text-anchor","middle").attr("font-size",13).attr("font-weight",c.q==="all"?800:600)
        .attr("fill", v/n>0.55? "#fff" : "#1f2933").text(v? v+"/"+n : "–");
      g.append("title").text(r.id+" in "+(c.q==="all"?"any question":c.q)+": "+v+" of "+n+" respondents"); }); });
  // ---- who answered ----
  const roles=SURVEY.questions.find(q=>q.id==="Q1").options, freq=SURVEY.questions.find(q=>q.id==="Q2").options;
  d3.select("#svWhoNote").text("Roles (Q1) and how often they use community health data (Q2). Mostly hospital staff and public-health users, the audiences named in the proposal.");
  { const W2=440, bh=20, rows=[{h:"Role"},...roles.map(o=>({o})),{h:"Use of community health data"},...freq.map(o=>({o}))]; const H2=rows.length*bh+6;
    const s=d3.select("#svWho").attr("viewBox",[0,0,W2,H2]).style("max-width",W2+"px"); s.selectAll("*").remove(); const x=d3.scaleLinear().domain([0,n]).range([0,150]);
    rows.forEach((r,k)=>{ const g=s.append("g").attr("transform","translate(0,"+(k*bh)+")");
      if(r.h){ g.append("text").attr("y",14).attr("font-size",10.5).attr("font-weight",700).attr("fill","#015f64").text(r.h.toUpperCase()); return; }
      g.append("text").attr("x",270).attr("y",14).attr("text-anchor","end").attr("font-size",11).text(r.o.option);
      g.append("rect").attr("x",278).attr("y",4).attr("height",bh-8).attr("width",x(r.o.n)).attr("fill","#7b8794");
      g.append("text").attr("x",282+x(r.o.n)).attr("y",14).attr("font-size",10.5).text(r.o.n); }); }
  d3.select("#svDecisions").selectAll("li").data(DECISIONS).join("li").html(d=>"<b>"+d[0]+"</b> — "+d[1]);
  // ---- requirement cards ----
  const C=d3.select("#svReqs").selectAll("div.reqcard").data(SURVEY.requirements).join("div").attr("class","card reqcard").attr("id",r=>"rc-"+r.id).style("border-top-color",r=>REQ[r.id].col);
  C.each(function(r){ const c=d3.select(this).html("");
    c.append("div").attr("class","rt").html(rqBadge(r.id)+" "+r.title);
    c.append("div").attr("class","rd").text(r.description);
    const m=c.append("div").attr("class","meter"); m.append("div").attr("class","bar").append("div").style("width",(r.n_supporters/n*100)+"%").style("height","100%").style("background",REQ[r.id].col);
    m.append("span").html("<b>"+r.n_supporters+"/"+n+"</b> respondents");
    c.append("ul").attr("class","ev").selectAll("li").data(r.evidence.slice().sort((a,b)=>b.n-a.n)).join("li").html(e=>"<b>"+e.question+"</b> “"+e.option+"” <span class='mu'>("+e.n+")</span>");
    c.append("div").attr("class","how").html("<b>How the dashboard meets it:</b> "+HOW[r.id].text);
    c.append("button").attr("class","btn").text("Open view →").on("click",()=>{ showTab(HOW[r.id].tab); HOW[r.id].setup(); window.scrollTo({top:0,behavior:"smooth"}); }); });
  // ---- every question ----
  const Q=d3.select("#svQs").selectAll("div.q").data(SURVEY.questions.filter(q=>q.type!=="text")).join("div").attr("class","q");
  Q.each(function(q){ const d=d3.select(this).html(""); d.append("h3").html(q.id+" · "+q.label+(q.type==="multi"?" <span class='mu'>(select all)</span>":""));
    const W3=420, bh=19, opts=q.options, H3=opts.length*bh+4; const s=d.append("svg").attr("viewBox",[0,0,W3,H3]).attr("class","svgfull");
    const x=d3.scaleLinear().domain([0,n]).range([0,110]);
    opts.forEach((o,k)=>{ const g=s.append("g").attr("transform","translate(0,"+(k*bh)+")"); const rq=o.requirements[0];
      g.append("title").text(o.option+": "+o.n+" of "+n+(o.requirements.length? " → "+o.requirements.join(", ") : " (context)"));
      g.append("text").attr("x",268).attr("y",13).attr("text-anchor","end").attr("font-size",10.5).text(o.option.length>48? o.option.slice(0,46)+"…" : o.option);
      g.append("rect").attr("x",274).attr("y",3).attr("height",bh-6).attr("width",x(o.n)).attr("fill",rq? REQ[rq].col : "#b8c0c9");
      g.append("text").attr("x",278+x(o.n)).attr("y",13).attr("font-size",10).text(o.n+(o.requirements.length? "  "+o.requirements.join("·") : "")); }); });
  // ---- open answers ----
  const T=d3.select("#svOpen").html(""); const hr=T.append("tr"); ["","Suggestion (Q10)","Our response"].forEach(t=>hr.append("th").text(t));
  SURVEY.questions.find(q=>q.id==="Q10").answers.forEach(a=>{ const tr=T.append("tr"); tr.append("td").text(a.respondent); tr.append("td").text("“"+a.text+"”"); tr.append("td").text(a.response); });
  d3.select("#svCaveat").html("<b>Limits of this evidence.</b> Six respondents is a small, convenience sample, so counts show direction, not proportions of any population. Options were mapped to requirements by the team before analysis (see <code>pipeline/survey_summary.py</code>). R5 has the weakest support (2 of 6). All five requirements will be checked again in think-aloud sessions with the finished tool.");
  RSTAT.survey={n, reqs:SURVEY.requirements.map(r=>r.id+":"+r.n_supporters), cards:d3.selectAll("#svReqs .reqcard").size(), qs:d3.selectAll("#svQs .q").size()};
}
INITS.survey = initSurveyTab;
