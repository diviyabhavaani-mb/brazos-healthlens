// Brazos HealthLens · "Start here" tab (final version).
// Feedback: the overview should show one consistent story of how the views link (instructor, 7 of 13
// respondents), users did not know where to start (3), and wanted data provenance (2).
// This tab draws the linked-view flow with live values for the current selection, quick-start presets,
// a one-screen visual grammar, and the data source and refresh date.
"use strict";
const STORY_GID = "48041000501";   // the tract the guided story follows (Bryan tract 5.01)
const fmtDate = s=>{ if(!s) return "–"; const d=new Date(s+"T12:00:00"); return isNaN(d)? s : d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}); };
const META = D.meta;
// header provenance line (feedback: make data source and update date prominent)
d3.select("#prov").html("Data: <b>CDC PLACES "+((META.release||2025)+" release")+"</b> (BRFSS "+[...new Set(Object.values(META.years))].sort().join("/")+") · retrieved "+fmtDate(META.retrieved)+
  (META.built? " · data built "+fmtDate(META.built) : "")+" · <a href='#' id='provMore'>sources & limitations</a>");
d3.select("#provMore").on("click", e=>{ e.preventDefault(); showTab("about"); });

// quick-start presets: each sets the focus measure and the parallel-coordinates measures, then opens a view
const PRESETS = [
  {id:"bp", title:"Blood-pressure outreach", q:"Where is high blood pressure common and treatment weak?", measure:"BPHIGH", axes:"bp", tab:"gap"},
  {id:"screen", title:"Preventive screening gaps", q:"Where do fewer adults get checkups and screenings?", measure:"CHOLSCREEN", axes:"screen", tab:"map"},
  {id:"diab", title:"Diabetes and its risk factors", q:"Which risk factors rise with diabetes across tracts?", measure:"DIABETES", axes:"chronic", tab:"compare"},
  {id:"mental", title:"Mental health", q:"Where is depression or poor mental health most common?", measure:"DEPRESSION", axes:"mental", tab:"map"},
  {id:"peers", title:"Places like mine", q:"Which Texas tracts have a health profile like a chosen tract?", measure:null, axes:null, tab:"similar"},
];
function applyPreset(p){
  if(p.measure) setMeasure(p.measure);
  if(p.axes && typeof setPCPPreset==="function") setPCPPreset(p.axes);
  if(p.id==="peers" && S.sel==null) setSel(GIDX.get(STORY_GID), true);
  showTab(p.tab); window.scrollTo({top:0, behavior:"smooth"});
  liveSay("Preset "+p.title+": opened "+TABS.find(t=>t[0]===p.tab)[1]+" with "+short(S.measure)+" as the focus measure.");
}

function initOverview(){
  const st=GIDX.get(STORY_GID);
  d3.select("#ovTract").text(tname(st)+" in "+pname(st));
  d3.select("#ovStory").on("click", ()=>storyGo(0));
  d3.select("#ovIntro").html("Ask one question, then follow it from view to view. <b>Whatever you select stays selected</b>: the selected tract has a <b>black outline</b> and a highlighted group is <b style='color:"+HL+"'>blue</b> in every tab, and the focus measure and comparison area (Brazos Valley or all Texas) are shared too. Click a box to open that view.");
  const P=d3.select("#ovPresets");
  PRESETS.forEach(p=>P.append("button").html("<b>"+p.title+"</b>"+p.q).on("click",()=>applyPreset(p)));
  drawGrammar(); drawDataCard();
  registerView("overview", ()=>drawFlow(), "overview");
}

// ---- the linked-view flow, with what each view says about the current selection ----
function flowStatus(){
  const i=S.sel, m=S.measure, has=i!=null && HAS[i];
  const st={};
  st.map = has? tname(i)+": "+short(m)+" "+pct(V[m][i])+" · "+ord(scopeRankPct(m,i))+" pct. in "+(S.scope==="bv"?"valley":"Texas")
              : short(m)+" across "+fmtInt(scopeIds().length)+" "+scopeName()+" tracts";
  if(has){ const ref=REF[scopeKey()]; const worse=CORE.filter(mm=>worseVal(mm,V[mm][i])>worseVal(mm,ref[mm])).length;
    st.compare = worse+" of "+CORE.length+" core measures worse than the "+(S.scope==="bv"?"valley":"Texas")+" average";
    const pe=(D.peers[i]||[]).slice(0,3).map(j=>TR.place[j]? pname(j) : cname(j)+" Co."); st.similar="Closest peers: "+[...new Set(pe)].join(", ");
    if(typeof gapCuts==="function"){ gapT=gapCuts(); const c=gapClass(i); st.gap=["Low","Middle","High"][c[0]]+" burden · "+["low","middle","high"][c[1]]+" care deficit"+(c[0]===2&&c[1]===2? " → care gap":""); }
  } else { st.compare="One line per tract, every axis up = worse"; st.similar="Pick a tract to find its peers"; st.gap="Where high burden meets weak care"; }
  st.share = (S.pins.length? S.pins.length+" pinned · ":"")+"CSV, printable report, PNG, link";
  return st;
}
function scopeRankPct(m,i){ const ids=scopeIds().filter(j=>!isNaN(V[m][j])); const v=worseVal(m,V[m][i]); return 100*ids.filter(j=>worseVal(m,V[m][j])<=v).length/ids.length; }
function drawFlow(){
  const W=1040, H=330, sv=d3.select("#ovFlow").attr("viewBox",[0,0,W,H]); sv.selectAll("*").remove();
  const st=flowStatus();
  const nodes=[
    {k:"q",   x:8,   y:118, w:160, h:96, t:"Your question", s:["e.g. Where should","blood-pressure","outreach start?"], col:"#6e2c5e"},
    {k:"map", x:200, y:38,  w:210, h:118, t:"1 · Map & profile", r:"R1 R2 R4", s:["Where is it worst?","How does one tract compare?"], tab:"map"},
    {k:"compare", x:440, y:38, w:210, h:118, t:"2 · Compare measures", r:"R2", s:["What rises with it?","Many measures at once"], tab:"compare"},
    {k:"similar", x:680, y:38, w:210, h:118, t:"3 · Similar & unusual", r:"R3", s:["Which places look alike?","Who stands out?"], tab:"similar"},
    {k:"gap", x:440, y:196, w:210, h:118, t:"4 · Care gaps", r:"R5", s:["Where is burden high","and care weak?"], tab:"gap"},
    {k:"share", x:680, y:196, w:210, h:118, t:"5 · Export & share", r:"", s:["Take it to your team"], tab:null},
  ];
  const byK=Object.fromEntries(nodes.map(n=>[n.k,n]));
  sv.append("defs").append("marker").attr("id","ovArrow").attr("viewBox","0 0 10 10").attr("refX",9).attr("refY",5).attr("markerWidth",7).attr("markerHeight",7).attr("orient","auto-start-reverse")
    .append("path").attr("d","M0 0L10 5L0 10z").attr("fill","#59636f");
  const edge=(a,b,pts)=>sv.append("path").attr("d",pts).attr("fill","none").attr("stroke","#59636f").attr("stroke-width",1.6).attr("marker-end","url(#ovArrow)");
  const q=byK.q, mp=byK.map, cp=byK.compare, si=byK.similar, gp=byK.gap, sh=byK.share;
  edge(q,mp,"M"+(q.x+q.w)+","+(q.y+30)+"L"+(mp.x-4)+","+(mp.y+56));
  edge(mp,cp,"M"+(mp.x+mp.w)+","+(mp.y+56)+"L"+(cp.x-4)+","+(cp.y+56));
  edge(cp,si,"M"+(cp.x+cp.w)+","+(cp.y+56)+"L"+(si.x-4)+","+(si.y+56));
  edge(mp,gp,"M"+(mp.x+mp.w/2)+","+(mp.y+mp.h)+"L"+(mp.x+mp.w/2)+","+(gp.y+56)+"L"+(gp.x-4)+","+(gp.y+56));
  edge(gp,sh,"M"+(gp.x+gp.w)+","+(gp.y+56)+"L"+(sh.x-4)+","+(sh.y+56));
  edge(si,gp,"M"+(si.x+si.w/2)+","+(si.y+si.h)+"L"+(si.x+si.w/2)+","+(si.y+si.h+20)+"L"+(gp.x+gp.w/2)+","+(si.y+si.h+20)+"L"+(gp.x+gp.w/2)+","+(gp.y-4));
  // the shared-state band: what is carried between views
  const band=sv.append("g").attr("transform","translate(906,38)");
  band.append("rect").attr("width",130).attr("height",276).attr("rx",8).attr("fill","#eef4fd").attr("stroke","#9dbbe6").attr("stroke-dasharray","4 3");
  band.append("text").attr("x",63).attr("y",22).attr("text-anchor","middle").attr("font-size",12).attr("font-weight",700).attr("fill","#0a3f85").text("Carried across");
  band.append("text").attr("x",63).attr("y",37).attr("text-anchor","middle").attr("font-size",12).attr("font-weight",700).attr("fill","#0a3f85").text("every view");
  const items=[["sel","Selected tract","black outline"],["hl","Highlighted","blue group"],["m","Focus measure",short(S.measure)],["sc","Compare within",scopeName()]];
  items.forEach(([k,a,b],j)=>{ const y=62+j*52; const g=band.append("g").attr("transform","translate(12,"+y+")");
    if(k==="sel") g.append("rect").attr("width",16).attr("height",16).attr("fill","#fde0a8").attr("stroke","#000").attr("stroke-width",2.6);
    else if(k==="hl") g.append("rect").attr("width",16).attr("height",16).attr("fill","#fde0a8").attr("stroke",HL).attr("stroke-width",2.6);
    else g.append("circle").attr("cx",8).attr("cy",8).attr("r",7).attr("fill","#015f64");
    g.append("text").attr("x",24).attr("y",8).attr("font-size",11.5).attr("font-weight",650).text(a);
    g.append("text").attr("x",24).attr("y",24).attr("font-size",11).attr("fill","#5f6b7a").text(b.length>16? b.slice(0,15)+"…" : b); });
  if(S.sel!=null) band.append("text").attr("x",12).attr("y",276-10).attr("font-size",10.5).attr("fill","#0a3f85").text("Now: "+tname(S.sel));
  // nodes
  nodes.forEach(n=>{ const g=sv.append("g").attr("class",n.tab? "ovnode":"").attr("transform","translate("+n.x+","+n.y+")");
    if(n.tab) g.attr("tabindex",0).attr("role","button").attr("aria-label","Open "+n.t).on("click",()=>showTab(n.tab)).on("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); showTab(n.tab); } });
    if(n.k==="share") g.style("cursor","pointer").on("click",()=>toggleExportMenu(true));
    g.append("rect").attr("class","box").attr("width",n.w).attr("height",n.h).attr("rx",9).attr("fill",n.k==="q"?"#f6eef4":"#fff").attr("stroke",n.col||"#9aa4b0").attr("stroke-width",1.4);
    g.append("text").attr("x",12).attr("y",22).attr("font-size",13.5).attr("font-weight",700).attr("fill",n.col||"#015f64").text(n.t);
    if(n.r) g.append("text").attr("x",n.w-10).attr("y",n.h-8).attr("text-anchor","end").attr("font-size",10.5).attr("font-weight",700).attr("fill","#5f6b7a").text(n.r);
    n.s.forEach((t,j)=>g.append("text").attr("x",12).attr("y",43+j*16).attr("font-size",12).attr("fill","#1f2933").text(t));
    if(st[n.k]){ const lines=wrapText(st[n.k], 31); lines.slice(0,2).forEach((t,j)=>g.append("text").attr("x",12).attr("y",n.h-38+j*14).attr("font-size",11).attr("font-weight",600).attr("fill",S.sel!=null&&n.k!=="share"?"#000":"#5f6b7a").text(t)); }
  });
  RSTAT.overview={sel:S.sel, status:st};
}
function wrapText(t,n){ const w=t.split(" "), out=[]; let cur=""; w.forEach(x=>{ if((cur+" "+x).trim().length>n){ out.push(cur.trim()); cur=x; } else cur+=" "+x; }); if(cur.trim()) out.push(cur.trim()); return out; }

// ---- one-screen visual grammar ----
function drawGrammar(){
  const G=d3.select("#ovGrammar"); const sw=(html,txt)=>{ G.append("div").html(html); G.append("div").html(txt); };
  sw('<svg width="44" height="14">'+SEQ.map((c,k)=>'<rect x="'+(k*8.8)+'" y="1" width="8.8" height="12" fill="'+c+'"/>').join("")+'</svg>', "<b>Darker = worse</b>, in every map and chart (care measures are flipped)");
  sw('<svg width="44" height="16"><rect x="12" y="1" width="18" height="14" fill="#fde0a8" stroke="#000" stroke-width="2.6"/></svg>', "<b>Black outline</b> = the selected tract, the same in every tab");
  sw('<svg width="44" height="16"><rect x="12" y="1" width="18" height="14" fill="#fde0a8" stroke="'+HL+'" stroke-width="2.6"/></svg>', "<b style='color:"+HL+"'>Blue</b> = the highlighted group (brush, legend, search, filter)");
  sw('<svg width="44" height="14"><line x1="6" x2="38" y1="7" y2="7" stroke="#1f2933" stroke-width="1.6"/><line x1="6" x2="6" y1="3" y2="11" stroke="#1f2933"/><line x1="38" x2="38" y1="3" y2="11" stroke="#1f2933"/><circle cx="22" cy="7" r="4" fill="#1f2933"/></svg>', "<b>Whisker</b> = 95% confidence interval; wider = less sure. <b>⚠</b> = among the least certain 10%");
  sw('<svg width="44" height="14"><line x1="22" x2="22" y1="0" y2="14" stroke="#c2410c" stroke-width="2.6"/></svg>', "<b>Orange tick</b> = Texas average; <span style='color:#015f64'>◆</span> valley, ■ county");
}
function drawDataCard(){
  const rows=[["Health data","<a href='https://data.cdc.gov/resource/"+META.dataset+"' target='_blank' rel='noopener'>CDC PLACES</a>, "+((META.release||2025)+" release")+", census tracts"],
    ["Survey years","BRFSS "+[...new Set(Object.values(META.years))].sort().join(", ")],
    ["Retrieved",fmtDate(META.retrieved)+(META.built? " · built "+fmtDate(META.built):"")],
    ["Coverage",fmtInt(META.ntx)+" Texas tracts · "+META.nbv+" in the Brazos Valley · "+MEAS.length+" measures"],
    ["Estimates","Model-based, crude (not age-adjusted), with 95% CIs"],
    ["Boundaries","Census 2020 · urban–rural: USDA RUCA 2020"],
    ["Refresh","GitHub Actions workflow <code>refresh-data</code> re-downloads, rebuilds, checks and republishes"]];
  const K=d3.select("#ovData"); rows.forEach(([a,b])=>{ K.append("div").style("color","#5f6b7a").text(a); K.append("div").html(b); });
}
INITS.overview = initOverview;
