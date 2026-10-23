// Brazos HealthLens · Tab 1 "Map & profile" (R1 explore where · R2 tract profile · R4 reliability)
// Choropleth map with three color modes, the selected tract's profile with CIs, the ranked tracts
// with CI whiskers, and county averages.
"use strict";
let mainScale = null;
function ciIds(m){ return scopeIds().filter(i=>!isNaN(ciw(m,i))); }
function buildMainScale(){
  const m=S.measure;
  if(S.mapMode==="ci" && HI[m]){ const vals=ciIds(m).map(i=>ciw(m,i)); mainScale=d3.scaleQuantile().domain(vals).range(UNC); }
  else mainScale = quantScale(m, scopeIds());
}
function mainColor(i){
  if(S.mapMode==="cluster") return CL[i]<0? null : CLCOL[CL[i]];
  if(S.mapMode==="ci"){ const w=ciw(S.measure,i); return isNaN(w)? null : mainScale(w); }
  const v=V[S.measure][i]; return isNaN(v)? null : mainScale(v);
}
function initMapTab(){
  MAPS.main = new MapView(document.getElementById("mainMap"), {height:640, name:"main", focus:"scope",
    color: mainColor,
    countyColor: c=>{ const v=CTY[c] && CTY[c].m[S.measure]; return v==null? "#eee": mainScale(v); },
    // CI-width and group colors only exist per tract, so those modes always draw tracts
    layer: ()=> S.mapMode==="measure"? S.layer : "tract",
    hatch: null,
    tip: i=>{
      if(S.mapMode==="ci"){ const m=S.measure, w=ciw(m,i);
        return tipTract(i, measLine(m,i)+(isNaN(w)?"":'<div class="mu">CI width '+fmt1(w)+' pts · Texas 90th percentile '+fmt1(p90[m])+' pts</div>')); }
      return tipTract(i); }
  });
  d3.selectAll("#mapMode button").on("click", function(){ setMapMode(this.dataset.m); });
  d3.select("#layerSel").on("change", e=>{ S.layer=e.target.value; if(S.layer==="county" && MAPS.main.t.k>=2.2) MAPS.main.zoomTo("tx"); changed("opts"); });
  d3.select("#lowconf").on("change", e=>{ S.lowconf=e.target.checked; renderMapTab(); });
  registerView("map", ch=>{
    if(ch.scope && MAPS.main.framed!==S.scope) MAPS.main.frameScope();
    if(ch.all||ch.scope||ch.measure||ch.hl||ch.sel||ch.opts) renderMapTab();
    else if(ch.hover){ MAPS.main.drawTop(); hoverRank(); } });
}
function setMapMode(k){
  S.mapMode=k; d3.selectAll("#mapMode button").classed("on",function(){return this.dataset.m===S.mapMode;});
  if(MAPS.main) renderMapTab();
}
function hatchSwatch(row){ const c=row.append("canvas").attr("width",15).attr("height",11).style("border","1px solid #9aa4b0").node(); const cx=c.getContext("2d"); cx.fillStyle="#fed976"; cx.fillRect(0,0,15,11); cx.fillStyle=cx.createPattern(hatchCanvas,"repeat"); cx.fillRect(0,0,15,11); }
function renderMapTab(){
  buildMainScale(); const m=S.measure, M=MID[m];
  MAPS.main.o.hatch = S.lowconf && S.mapMode!=="ci" && HI[m]? (i=>lowc(m,i)) : null;
  MAPS.main.draw();
  const L=MAPS.main.legend;
  if(S.mapMode==="measure"){
    d3.select("#mapTitle").text(M.label+" — share of adults, by census tract");
    d3.select("#mapNote").html((M.good? "Darker = <b>lower</b> (worse for this care measure). ": "Darker = higher burden, i.e. more adults likely needing "+(M.group==="Disease"||M.group==="Other condition"? "care and medication for this condition":"support")+". ")+
      "Brazos Valley "+pct(REF.bv[m])+" vs. Texas "+pct(REF.tx[m])+". Dashed teal outline = the 7-county Brazos Valley."+(M.derived? " <i>Derived: high BP × (1 − BP-medicine share); no CI.</i>":""));
    legendQuant(L, mainScale, m, M.short+" (% of adults)", "Quintiles of "+scopeName()+" tracts"+(MAPS.main.countyMode()? "; counties = adult-weighted means.":".")+" Gray = no estimate.");
    if(S.lowconf && HI[m]){ const r=L.append("div").attr("class","row"); hatchSwatch(r); r.append("span").text("Low confidence (CI in widest 10% of Texas)"); }
  } else if(S.mapMode==="ci"){
    d3.select("#mapTitle").text("How reliable is each estimate? Width of the 95% CI — "+M.short);
    if(!HI[m]){ d3.select("#mapNote").html("<b>"+M.short+"</b> is derived and has no confidence interval. Pick a PLACES measure in <b>Focus measure</b>."); L.html(""); }
    else {
      const ids=ciIds(m), nlow=ids.filter(i=>lowc(m,i)).length;
      d3.select("#mapNote").html("Darker purple = wider interval = <b>less certain</b> estimate. Small rural tracts usually have the widest intervals. "+
        fmtInt(nlow)+" of "+fmtInt(ids.length)+" "+scopeName()+" tracts are <b>low confidence</b> (CI wider than "+fmt1(p90[m])+" pts, the widest 10% in Texas): treat their ranks with care.");
      L.html(""); L.append("div").attr("class","lt").text("95% CI width (pts)");
      const br=quantBreaks(mainScale);
      mainScale.range().forEach((c,k)=>{ const r=L.append("div").attr("class","row"); r.append("span").attr("class","sw").style("background",c); r.append("span").text(fmt1(br[k])+" – "+fmt1(br[k+1])); });
      const r=L.append("div").attr("class","row click").attr("title","Click to highlight the low-confidence tracts").on("click",()=>setHL(new Set(ids.filter(i=>lowc(m,i))), "low confidence: "+M.short));
      r.append("span").attr("class","sw").style("background","#fff").style("border","2px solid "+UNC[4]); r.append("span").text("Low confidence: "+fmtInt(nlow)+" (click)");
      L.append("div").attr("class","mu").text("Quintiles of "+scopeName()+" tracts.");
    }
  } else {
    d3.select("#mapTitle").text("Health profile groups — tracts with a similar mix of 23 measures");
    d3.select("#mapNote").html("Five groups from k-means clustering of all Texas tracts (see <b>Similar &amp; unusual</b>). Ordered from lightest to heaviest overall burden. Click a legend row to highlight that group in every view.");
    L.html(""); L.append("div").attr("class","lt").text("Profile group (tracts in "+scopeName()+")");
    const SID=scopeIds();
    CLS.forEach((c,k)=>{ const n=SID.filter(i=>CL[i]===k).length; if(!n) return;
      const r=L.append("div").attr("class","row click").classed("on", S.filter && S.filter.type==="cluster" && S.filter.key===k).attr("title",c.desc+" Click to highlight.").on("click",()=>setFilter("cluster",k));
      r.append("span").attr("class","sw").style("background",CLCOL[k]); r.append("span").text((k+1)+". "+c.name+" ("+fmtInt(n)+")"); });
  }
  RSTAT.mapMode=S.mapMode;
  drawProfile(); drawRank(); drawCtyBars();
}

// ---------- profile panel (R2: full profile vs. county, valley and Texas; R4: CIs) ----------
function drawProfile(target){
  const P=(target||d3.select("#profile")).html("");
  const inDrawer = !!target;
  if(S.sel==null){
    const TXS = S.scope==="tx";
    const cfps = TXS? [...Object.keys(CTY).sort((a,b)=>CTY[b].pop-CTY[a].pop).slice(0,8), "041"].filter((c,k,a)=>a.indexOf(c)===k) : D.bv_cfp;
    P.append("h2").text(TXS? "Texas at a glance: largest counties" : "Brazos Valley at a glance");
    P.append("p").attr("class","note").html("Adult-weighted county averages (% of adults). Darker = worse within each column. Click a county row to highlight it in every tab. <b>Click any tract</b> (in any view) for its full profile with confidence intervals.");
    const cols=["DIABETES","BPHIGH","OBESITY","COPD","CHD","DEPRESSION","CANCER","ACCESS2","BPMED"];
    const tab=P.append("table").attr("class","list").style("font-size","11px").style("table-layout","fixed");
    const hr=tab.append("tr"); hr.append("th").style("width","86px").text("County");
    const AB={DIABETES:"Diab.",BPHIGH:"High BP",OBESITY:"Obes.",COPD:"COPD",CHD:"Heart",DEPRESSION:"Depr.",CANCER:"Cancer",ACCESS2:"Unins.",BPMED:"BP med"};
    cols.forEach(c=>hr.append("th").style("text-align","center").style("font-size","10px").style("padding","3px 1px").attr("title",MID[c].label).text(AB[c]));
    const rows=[...cfps.map(c=>[CTY[c].name, CTY[c].m, c]), ["Brazos Valley", REF.bv], ["Texas", REF.tx]];
    rows.forEach(([n,r,c],k)=>{ const tr=tab.append("tr").attr("class",c?"r":null).classed("on", c && S.filter && S.filter.type==="county" && S.filter.key===c);
      if(c) tr.on("click",()=>{ setFilter("county", c); if(S.hl) MAPS.main.zoomToIds([...S.hl],.1); });
      tr.append("td").style("font-weight",600).style("color",c?"var(--accent)":null).style("border-top",k===cfps.length?"2px solid #ccd":null).text(n);
      cols.forEach(m=>{ const vals=cfps.map(cc=>CTY[cc].m[m]); const sc=d3.scaleQuantize().domain(d3.extent(vals)).range(isGood(m)?SEQ.slice().reverse():SEQ); const v=r[m];
        tr.append("td").style("text-align","center").style("padding","3px 1px").style("background",c?sc(v):"#f1f3f5").style("color",(c && SEQ.indexOf(sc(v))>=3)?"#fff":"#1f2933").style("border-top",k===cfps.length?"2px solid #ccd":null).text(fmt1(v)); }); });
    const SID=scopeIds(), CNT=CLS.map((c,k)=>SID.filter(i=>CL[i]===k).length);
    P.append("h3").style("margin-top","12px").text((TXS?"Texas":"Valley")+" tracts by community health profile");
    P.append("p").attr("class","note").text(fmtInt(d3.sum(CNT))+" "+scopeName()+" tracts grouped by the 5 Texas-wide profile groups (see Similar & unusual). Click a segment to highlight that group in every tab.");
    { const W=440, sv=P.append("svg").attr("width",W).attr("height",66); const x=d3.scaleLinear().domain([0,d3.sum(CNT)]).range([0,W]); let acc=0;
      CNT.forEach((n,k)=>{ if(!n) return; const g=sv.append("g").style("cursor","pointer").on("click",()=>setFilter("cluster",k))
          .on("mouseenter",e=>showTip("<div class='tt'>"+(k+1)+". "+CLS[k].name+"</div>"+fmtInt(n)+" "+scopeName()+" tracts<div class='mu'>"+CLS[k].desc+"</div>",e)).on("mousemove",moveTip).on("mouseleave",hideTip);
        g.append("rect").attr("x",x(acc)).attr("y",4).attr("width",Math.max(0,x(n)-1)).attr("height",26).attr("fill",CLCOL[k]);
        g.append("text").attr("x",x(acc)+x(n)/2).attr("y",22).attr("text-anchor","middle").attr("font-size",11.5).attr("font-weight",650).attr("fill",CLTXT[k]).text(x(n)>26? fmtInt(n):"");
        acc+=n; });
      let lx=0, ly=44; CLS.forEach((c,k)=>{ const t=sv.append("g").attr("transform","translate("+lx+","+ly+")"); t.append("rect").attr("width",10).attr("height",10).attr("fill",CLCOL[k]); const tx=t.append("text").attr("x",13).attr("y",9).attr("font-size",10).text((k+1)+". "+c.name.split(",")[0]); lx+=tx.node().getComputedTextLength()+26; if(lx>W-90 && k<CLS.length-1){ lx=0; ly+=13; } });
      sv.attr("height",ly+16); }
    P.append("p").attr("class","note").style("margin-top","10px").html("<b>Reading the views.</b> A census tract is a neighborhood-sized area (about 1,200–8,000 people). Values are CDC model-based estimates of the share of adults with each condition (crude, not age-adjusted), each with a 95% confidence interval. Brazos County (Texas A&amp;M) is young on average, which lowers its crude chronic-disease rates; rural counties are older and carry more heart, lung and cancer burden.");
    P.append("p").attr("class","note").html("<b>Legend conventions.</b> Darker = worse everywhere. <span style='color:"+HL+";font-weight:700'>Blue</span> = highlighted group; <b>black outline</b> = selected tract.");
    return;
  }
  const i=S.sel, cty=CTY[TR.cfp[i]];
  P.append("h2").html(tname(i)+" · "+cname(i)+" County <span class='pill'>"+(TR.place[i]? TR.place[i].split(", ")[0]:"rural")+"</span>");
  if(!HAS[i]){ P.append("p").attr("class","note").text("No PLACES estimate for this tract."); return; }
  P.append("p").attr("class","note").html("Population "+fmtInt(POP[i])+" ("+fmtInt(ADULTS[i])+" adults) · "+RU_NAMES[TR.ru[i]]+"<br>Profile group: "+clPill(CL[i],true)+
    " · <a href='#' class='toPeers'>Find similar tracts →</a>"+(inDrawer? " · <a href='#' class='toMap'>Open on map →</a>":""));
  P.selectAll(".toPeers").on("click", e=>{ e.preventDefault(); showTab("similar"); });
  P.selectAll(".toMap").on("click", e=>{ e.preventDefault(); showTab("map"); MAPS.main.zoomToIds([S.sel],2.2); });
  P.append("div").attr("class","note").html('<svg width="40" height="12"><line x1="2" x2="38" y1="6" y2="6" stroke="#1f2933" stroke-width="1.5"/><circle cx="20" cy="6" r="4" fill="#1f2933"/></svg> tract &amp; 95% CI &nbsp; <svg width="11" height="11"><rect x="1.5" y="1.5" width="8" height="8" fill="#6b7785" stroke="#fff"/></svg> '+cname(i)+' Co. &nbsp; <svg width="12" height="12"><path d="M6,1L11,6L6,11L1,6Z" fill="#fff" stroke="#015f64" stroke-width="1.6"/></svg> valley &nbsp; <svg width="8" height="13"><line x1="4" x2="4" y1="0" y2="13" stroke="#c2410c" stroke-width="2.4"/></svg> Texas &nbsp; <svg width="20" height="9"><rect width="20" height="9" fill="#eceff3"/></svg> '+(S.scope==="bv"?"valley range":"Texas 1st–99th pct.")+'');
  const groups=d3.groups(MEAS.filter(m=>!isNaN(V[m.id][i])), m=>m.group);
  const rh=18, lw=150, rw=104, w=440, pw=w-lw-rw; const n=d3.sum(groups,g=>g[1].length+1);
  const s=P.append("svg").attr("width",w).attr("height",n*rh+6); let y=2;
  groups.forEach(([gname,ms])=>{
    s.append("text").attr("x",0).attr("y",y+13).attr("font-weight",650).attr("font-size",10.5).attr("fill","#015f64").text(gname.toUpperCase()); y+=rh;
    ms.forEach(M=>{ const id=M.id, v=V[id][i], lo=LO[id]? LO[id][i]:v, hi=HI[id]? HI[id][i]:v; const cv = cty? cty.m[id] : NaN;
      const ext=scopeRange(id); const x=d3.scaleLinear().domain([Math.min(ext[0],lo,REF.tx[id]),Math.max(ext[1],hi,REF.tx[id])]).range([lw,lw+pw]).nice();
      const g=s.append("g").attr("transform","translate(0,"+y+")").style("cursor","pointer").on("click",()=>setMeasure(id));
      const RS = REF[scopeKey()][id]; const worse = M.good? v<RS : v>RS; const sig = HI[id]? (M.good? hi<RS : lo>RS) : false; const lc=lowc(id,i);
      g.append("title").text(M.label+": "+pct(v)+(HI[id]?" (95% CI "+fmt1(lo)+"–"+fmt1(hi)+")":"")+"; "+cname(i)+" County "+pct(cv)+"; valley "+pct(REF.bv[id])+"; Texas "+pct(REF.tx[id])+"; "+ord(txPct(id,i))+" percentile in Texas. Click to map it.");
      g.append("rect").attr("width",w).attr("height",rh).attr("fill",id===S.measure?"#eef5f5":"transparent");
      g.append("text").attr("x",2).attr("y",12.5).attr("font-size",11).attr("fill","#1f2933").attr("font-weight",id===S.measure?650:400).text(M.short);
      g.append("rect").attr("x",x(ext[0])).attr("width",x(ext[1])-x(ext[0])).attr("y",5).attr("height",8).attr("fill","#eceff3");
      g.append("line").attr("x1",x(REF.tx[id])).attr("x2",x(REF.tx[id])).attr("y1",1).attr("y2",17).attr("stroke","#c2410c").attr("stroke-width",2.2);
      if(!isNaN(cv)) g.append("rect").attr("x",x(cv)-4).attr("y",5).attr("width",8).attr("height",8).attr("fill","#6b7785").attr("stroke","#fff");
      if(HI[id]){ g.append("line").attr("x1",x(lo)).attr("x2",x(hi)).attr("y1",9).attr("y2",9).attr("stroke",lc?"#8a94a1":"#1f2933").attr("stroke-width",1.6);
        [lo,hi].forEach(b=>g.append("line").attr("x1",x(b)).attr("x2",x(b)).attr("y1",5.5).attr("y2",12.5).attr("stroke",lc?"#8a94a1":"#1f2933").attr("stroke-width",1.2)); }
      const bx=x(REF.bv[id]); g.append("path").attr("d","M"+bx+",3.5L"+(bx+5)+",9L"+bx+",14.5L"+(bx-5)+",9Z").attr("fill","#fff").attr("stroke","#015f64").attr("stroke-width",1.6);
      g.append("circle").attr("cx",x(v)).attr("cy",9).attr("r",4.2).attr("fill",lc?"#fff":(sig&&worse?"#b42318":"#1f2933")).attr("stroke",sig&&worse?"#b42318":"#1f2933").attr("stroke-width",1.5);
      g.append("text").attr("x",w).attr("y",12.5).attr("text-anchor","end").attr("font-size",10.5).attr("fill",sig&&worse?"#b42318":"#1f2933").attr("font-weight",sig&&worse?650:400)
        .text(fmt1(v)+"%"+(HI[id]?" ["+fmt1(lo)+"–"+fmt1(hi)+"]":" (derived)")+(lc?" ⚠":""));
      y+=rh; }); });
  P.append("p").attr("class","note").html("<b style='color:#b42318'>Red</b> = whole 95% CI worse than the "+(S.scope==="bv"?"valley":"Texas")+" average (scope: "+scopeName()+"). Hollow dot / ⚠ = low confidence. Each row has its own scale. Click a row to map that measure.");
  RSTAT.profile={sel:i, rows:s.selectAll("g").size()};
}
const _srange={};
function scopeRange(m){ const k=S.scope+m; if(!_srange[k]){ const v=scopeIds().map(i=>V[m][i]).filter(x=>!isNaN(x)).sort(d3.ascending);
  _srange[k]= S.scope==="bv"? [v[0],v[v.length-1]] : [d3.quantileSorted(v,.01), d3.quantileSorted(v,.99)]; } return _srange[k]; }

// ---------- ranked bars with CI whiskers (R1 + R4) ----------
const RW=640, RH=380;
function drawRank(){
  const m=S.measure, M=MID[m]; const sv=d3.select("#rank").attr("viewBox",[0,0,RW,RH]); sv.selectAll("*").remove();
  const sc = quantScale(m, scopeIds());
  let ids = (S.hl? scopeIds().filter(i=>S.hl.has(i)) : scopeIds()).filter(i=>!isNaN(V[m][i]));
  ids.sort((a,b)=>worseVal(m,V[m][b])-worseVal(m,V[m][a])); ids=ids.slice(0,15);
  d3.select("#rankTitle").text((M.good? "Lowest 15 tracts: ":"Highest-burden 15 tracts: ")+M.short+" ("+(S.hl? "highlighted group": scopeName())+")");
  d3.select("#rankNote").text("Bar = estimate, whisker = 95% CI, ⚠ = low confidence. Orange line = Texas average, teal = valley average. Overlapping whiskers mean the order is uncertain.");
  RSTAT.rank={n:ids.length};
  if(!ids.length) return;
  const lw=250, xmax=d3.max(ids,i=>HI[m]? HI[m][i]: V[m][i]); const x=d3.scaleLinear().domain([0,Math.max(xmax,REF.tx[m])*1.04]).range([lw,RW-62]);
  const bh=(RH-28)/15;
  const g=sv.selectAll("g.bar").data(ids).join("g").attr("class","bar").attr("transform",(d,k)=>"translate(0,"+(4+k*bh)+")").style("cursor","pointer")
    .on("mouseenter",(e,i)=>setHover(i,e)).on("mousemove",e=>moveTip(e)).on("mouseleave",()=>setHover(null)).on("click",(e,i)=>setSel(i));
  g.append("rect").attr("class","hbg").attr("x",0).attr("width",RW).attr("height",bh).attr("fill","transparent");
  g.append("text").attr("x",lw-6).attr("y",bh*.64).attr("text-anchor","end").attr("font-size",11).attr("font-weight",i=>i===S.sel?700:400).text(i=>tname(i)+" · "+pname(i)+", "+cname(i));
  g.append("rect").attr("x",lw).attr("y",3).attr("height",bh-6).attr("width",i=>x(V[m][i])-lw).attr("fill",i=>sc(V[m][i])).attr("stroke",i=>S.hl&&S.hl.has(i)?HL:(i===S.sel?"#000":"none")).attr("stroke-width",1.5);
  if(HI[m]) g.append("line").attr("x1",i=>x(LO[m][i])).attr("x2",i=>x(HI[m][i])).attr("y1",bh/2).attr("y2",bh/2).attr("stroke","#1f2933").attr("stroke-width",1.3);
  g.append("text").attr("x",i=>x(HI[m]? HI[m][i]:V[m][i])+5).attr("y",bh*.64).attr("font-size",10.5).attr("fill","#4a5562").text(i=>pct(V[m][i])+(lowc(m,i)?" ⚠":""));
  [[REF.tx[m],"#c2410c"],[REF.bv[m],"#015f64"]].forEach(([v,c])=>sv.append("line").attr("x1",x(v)).attr("x2",x(v)).attr("y1",2).attr("y2",4+ids.length*bh).attr("stroke",c).attr("stroke-width",1.6).attr("stroke-dasharray","4 2"));
  sv.append("g").attr("class","axis").attr("transform","translate(0,"+(6+ids.length*bh)+")").call(d3.axisBottom(x).ticks(6).tickFormat(d=>d+"%"));
  hoverRank();
}
function hoverRank(){ d3.selectAll("#rank g.bar .hbg").attr("fill",i=>i===S.hover?"#f0f4f8":"transparent"); }

// ---------- county bars (R2: county context) ----------
function drawCtyBars(){
  const m=S.measure; const W=640, H=380; const sv=d3.select("#ctybars").attr("viewBox",[0,0,W,H]); sv.selectAll("*").remove();
  let cs;
  if(S.scope==="bv") cs=D.bv_cfp.slice();
  else { const all=Object.keys(CTY).filter(c=>CTY[c].n>=3); all.sort((a,b)=>worseVal(m,CTY[b].m[m])-worseVal(m,CTY[a].m[m])); cs=[...new Set([...all.slice(0,10),...D.bv_cfp])]; }
  cs.sort((a,b)=>worseVal(m,CTY[b].m[m])-worseVal(m,CTY[a].m[m]));
  const rows=[...cs.map(c=>({c,n:CTY[c].name+" Co.",v:CTY[c].m[m],bv:BVC.has(c)})),{n:"Brazos Valley",v:REF.bv[m],ref:1},{n:"Texas",v:REF.tx[m],ref:1}];
  const lw=130, bh=Math.min(24,(H-26)/rows.length); const x=d3.scaleLinear().domain([0,d3.max(rows,r=>r.v)*1.08]).range([lw,W-50]);
  const sc=d3.scaleQuantize().domain(d3.extent(cs,c=>CTY[c].m[m])).range(isGood(m)?SEQ.slice().reverse():SEQ);
  const g=sv.selectAll("g").data(rows).join("g").attr("transform",(d,k)=>"translate(0,"+(4+k*bh+(d.ref?6:0))+")").style("cursor",d=>d.c?"pointer":null)
    .on("click",(e,d)=>{ if(d.c){ setFilter("county", d.c); if(S.hl) MAPS.main.zoomToIds([...S.hl],.1);} })
    .on("mouseenter",(e,d)=>showTip('<div class="tt">'+d.n+'</div>'+short(m)+': <b>'+pct(d.v)+'</b>'+(d.c?'<div class="mu">'+CTY[d.c].n+' tracts · population '+fmtInt(CTY[d.c].pop)+'. Click to highlight its tracts.</div>':''),e)).on("mousemove",e=>moveTip(e)).on("mouseleave",hideTip);
  g.append("text").attr("x",lw-6).attr("y",bh*.65).attr("text-anchor","end").attr("font-size",11).attr("font-weight",d=>d.bv||d.ref?650:400).text(d=>d.n);
  g.append("rect").attr("x",lw).attr("y",3).attr("height",bh-6).attr("width",d=>Math.max(0,x(d.v)-lw)).attr("fill",d=>d.ref?"#c9d1da":sc(d.v))
    .attr("stroke",d=>d.c && S.filter && S.filter.type==="county" && S.filter.key===d.c? HL : "none").attr("stroke-width",2);
  g.append("text").attr("x",d=>x(d.v)+4).attr("y",bh*.65).attr("font-size",10.5).attr("fill","#4a5562").text(d=>fmt1(d.v)+"%");
  if(S.scope!=="bv") sv.append("text").attr("x",W-4).attr("y",H-4).attr("text-anchor","end").attr("font-size",10.5).attr("fill","#5f6b7a").text("10 worst Texas counties (with 3+ tracts) + the 7 valley counties");
}
INITS.map = initMapTab;
