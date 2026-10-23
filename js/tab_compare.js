// Brazos HealthLens · Tab 2 "Compare measures" (R2)
// Parallel coordinates (brushable axes; color by profile group or urban–rural class) and a
// relationship explorer (scatterplot with fit line and a ranking of the strongest correlates).
"use strict";
// ---------- parallel coordinates (R2: many measures at once) ----------
let pcpAxes = ["DIABETES","BPHIGH","OBESITY","COPD","DEPRESSION","CSMOKING","LPA","ACCESS2","CHECKUP","BPMED"];
const pcpBrushes = new Map();   // measure -> [v0,v1] in data units
let pcp = null;
function initPCP(){
  const wrap=document.getElementById("pcpWrap"); const W=wrap.clientWidth||1300, H=500, dpr=devicePixelRatio||1;
  const c=d3.select(wrap).append("canvas").attr("width",W*dpr).attr("height",H*dpr).style("width",W+"px").style("height",H+"px").style("position","absolute").node();
  const c2=d3.select(wrap).append("canvas").attr("width",W*dpr).attr("height",H*dpr).style("width",W+"px").style("height",H+"px").style("position","absolute").style("pointer-events","none").node();
  const svg=d3.select(wrap).style("height",H+"px").append("svg").attr("width",W).attr("height",H).style("position","absolute");
  pcp={W,H,c,c2,svg,m:{l:40,r:40,t:46,b:24},dpr};
  d3.select("#pcpColor").on("change", drawPCP);
  d3.select("#pcpClear").on("click", ()=>{ pcpBrushes.clear(); applyPCPFilter(); drawPCP(); });
  d3.select("#pcpPickBtn").on("click", ()=>{ const p=d3.select("#pcpPicker"); p.style("display", p.style("display")==="none"?null:"none"); });
  const pk=d3.select("#pcpPicker");
  d3.select("#pcpPickBtn").on("click.aria", function(){ this.setAttribute("aria-expanded", d3.select("#pcpPicker").style("display")!=="none"); });
  pk.append("div").attr("class","note").style("width","100%").text("Pick 3–14 measures (fewer axes = more readable).");
  d3.groups(MEAS, m=>m.group).forEach(([g,ms])=>{ pk.append("div").attr("class","g").text(g);
    ms.forEach(m=>{ const l=pk.append("label"); l.append("input").attr("type","checkbox").attr("value",m.id).property("checked",pcpAxes.includes(m.id))
      .on("change",function(){ if(this.checked){ if(pcpAxes.length>=14){ this.checked=false; return;} pcpAxes.push(m.id);} else { if(pcpAxes.length<=3){ this.checked=true; return;} pcpAxes=pcpAxes.filter(a=>a!==m.id); pcpBrushes.delete(m.id); applyPCPFilter(); } drawPCP(); });
      l.append("span").text(m.short); }); });
  // hover: nearest line
  d3.select(c).on("mousemove", e=>pcpHover(e)).on("mouseleave",()=>setHover(null)).on("click", e=>{ const i=pcpNearest(e); if(i!=null) setSel(i); });
  registerView("compare", ch=>{
    if(ch.all||ch.measure) ensureFocusAxis();
    if(ch.hl && S.hlSrc!=="parallel coordinates" && pcpBrushes.size) pcpBrushes.clear();
    if(ch.scope && pcpBrushes.size && S.hlSrc==="parallel coordinates") setTimeout(()=>applyPCPFilter(true),0);   // brushes re-apply to the new scope's tracts
    if(ch.all||ch.scope||ch.measure||ch.hl) drawPCP(); else if(ch.sel||ch.hover) drawPCPTop(); });
}
let pcpAuto=null;   // axis that was added only because it is the focus measure
function ensureFocusAxis(){
  if(pcpAuto && pcpAuto!==S.measure && !pcpBrushes.has(pcpAuto) && pcpAxes.length>3){ pcpAxes=pcpAxes.filter(a=>a!==pcpAuto); pcpAuto=null; }
  if(!pcpAxes.includes(S.measure)){ pcpAxes=[S.measure, ...pcpAxes]; if(pcpAxes.length>14) pcpAxes.pop(); pcpAuto=S.measure; }
  d3.selectAll("#pcpPicker input").property("checked", function(){ return pcpAxes.includes(this.value); });
}
function pcpScales(){
  const {W,H,m}=pcp; const ids=scopeIds();
  const x=d3.scalePoint().domain(pcpAxes).range([m.l+30, W-m.r-30]);
  const y={}; pcpAxes.forEach(a=>{ const ext=d3.extent(ids,i=>V[a][i]); const s=d3.scaleLinear().domain(ext).range(isGood(a)?[m.t,H-m.b]:[H-m.b,m.t]).nice(); y[a]=s; });
  return {x,y,ids};
}
function pcpColorFn(){
  const mode=d3.select("#pcpColor").property("value");
  if(mode==="cluster") return i=>CLCOL[CL[i]];
  if(mode==="ru") return i=>RUCOL[TR.ru[i]]||"#ccc";
  if(mode==="measure"){ const sc=quantScale(S.measure, scopeIds()); return i=>sc(V[S.measure][i]); }
  return ()=>"#7b8794";
}
function drawPCP(){
  if(!pcp) return; const {x,y,ids}=pcpScales(); pcp.x=x; pcp.y=y; pcp.ids=ids;
  drawPCPLines(); drawPCPAxes();
}
function drawPCPLines(){
  const {W,H,c,dpr}=pcp, x=pcp.x, y=pcp.y, ids=pcp.ids;
  const ctx=c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const col=pcpColorFn(); const many=ids.length>1000; const hl=S.hl;
  ctx.lineWidth = many? 0.6 : 1.2;
  const line=(i)=>{ ctx.beginPath(); pcpAxes.forEach((a,k)=>{ const v=V[a][i]; if(isNaN(v)) return; const px=x(a), py=y[a](v); k? ctx.lineTo(px,py): ctx.moveTo(px,py); }); ctx.stroke(); };
  ctx.globalAlpha = hl? (many? .025 : .12) : (many? .07 : .55);
  ids.forEach(i=>{ if(hl && hl.has(i)) return; ctx.strokeStyle = hl? "#9aa4b0" : col(i); line(i); });
  if(hl){ ctx.globalAlpha = many? Math.max(.08, Math.min(.6, 60/hl.size)) : .85; ctx.lineWidth = many? .9: 1.6; ctx.strokeStyle=HL; ids.forEach(i=>{ if(hl.has(i)) line(i); }); }
  ctx.globalAlpha=1;
  RSTAT.pcp={lines:ids.length, hl: hl? ids.filter(i=>hl.has(i)).length : 0, axes:pcpAxes.slice(), focus:S.measure, scope:S.scope};
  d3.select("#pcpCount").html((hl? "<b style='color:"+HL+"'>"+fmtInt(ids.filter(i=>hl.has(i)).length)+"</b> of ": "")+fmtInt(ids.length)+" "+scopeName()+" tracts"+(hl? " highlighted ("+S.hlSrc+")":"")+". Orange tick = Texas average.");
  drawPCPTop();
}
function drawPCPAxes(){
  const {W,H,svg,m}=pcp, x=pcp.x, y=pcp.y, hl=S.hl;
  svg.selectAll("*").remove();
  if(pcpAxes.includes(S.measure)){ const fx=x(S.measure); svg.append("rect").attr("x",fx-34).attr("y",0).attr("width",68).attr("height",H-m.b+8).attr("rx",6).attr("fill","#e3f1f1").attr("stroke","#015f64").attr("stroke-width",1.2);
    svg.append("text").attr("x",fx).attr("y",H-m.b+20).attr("text-anchor","middle").attr("font-size",10).attr("font-weight",700).attr("fill","#015f64").text("FOCUS"); }
  const ax=svg.selectAll("g.pcp-axis").data(pcpAxes, d=>d).join("g").attr("class","pcp-axis").attr("transform",a=>"translate("+x(a)+",0)");
  ax.each(function(a){ d3.select(this).append("g").attr("class","axis").call(d3.axisLeft(y[a]).ticks(6).tickFormat(d=>d+"%")); });
  ax.append("text").attr("class","title").attr("y",14).attr("text-anchor","middle").attr("fill",a=>a===S.measure?"#015f64":null).style("font-weight",a=>a===S.measure?800:null).text(a=>short(a)).append("title").text(a=>MID[a].label+" — drag to reorder, double-click to remove");
  ax.append("text").attr("class","sub").attr("y",27).attr("text-anchor","middle").text(a=>isGood(a)?"flipped: ↑ lower":"↑ higher");
  ax.append("text").attr("class","sub").attr("y",38).attr("text-anchor","middle").attr("fill","#c2410c").text(a=>"TX "+fmt1(REF.tx[a]));
  ax.append("path").attr("d",a=>{ const yy=y[a](REF.tx[a]); return "M-7,"+yy+"L7,"+yy; }).attr("stroke","#c2410c").attr("stroke-width",2.5);
  // brushes
  ax.append("g").attr("class","brush").each(function(a){
    const b=d3.brushY().extent([[-12,m.t],[12,H-m.b]]).on("brush end", e=>{ if(!e.sourceEvent) return;
      if(!e.selection) pcpBrushes.delete(a); else { const v=e.selection.map(y[a].invert); pcpBrushes.set(a,[Math.min(...v),Math.max(...v)]); }
      applyPCPFilter(e.type==="end"); });
    d3.select(this).call(b); const r=pcpBrushes.get(a); if(r) d3.select(this).call(b.move, [y[a](r[0]), y[a](r[1])].sort((p,q)=>p-q)); });
  // drag to reorder
  ax.select("text.title").call(d3.drag().on("start",function(e,a){ pcp.dragging=a; }).on("drag",function(e,a){
      const g=d3.select(this.parentNode); const px=Math.max(x.range()[0],Math.min(x.range()[1], e.x + x(a))); g.attr("transform","translate("+px+",0)");
      const order=pcpAxes.slice().sort((p,q)=>(p===a?px:x(p))-(q===a?px:x(q))); if(order.join()!==pcpAxes.join()){ pcpAxes=order; }
    }).on("end",()=>{ pcp.dragging=null; drawPCP(); }))
    .on("dblclick",(e,a)=>{ if(pcpAxes.length>3){ pcpAxes=pcpAxes.filter(z=>z!==a); pcpBrushes.delete(a); d3.selectAll("#pcpPicker input").filter(function(){return this.value===a;}).property("checked",false); applyPCPFilter(); drawPCP(); } });
  // legend
  const mode=d3.select("#pcpColor").property("value");
  const lg=svg.append("g").attr("transform","translate("+(m.l+90)+","+(H-6)+")");
  if(mode==="cluster" && !hl){ let xx=0; CLS.forEach((c,k)=>{ lg.append("rect").attr("x",xx).attr("y",-9).attr("width",12).attr("height",9).attr("fill",CLCOL[k]); const t=lg.append("text").attr("x",xx+15).attr("y",-1).attr("font-size",10.5).text(c.name); xx+=t.node().getComputedTextLength()+30; }); }
  if(mode==="ru" && !hl){ let xx=0; RU_NAMES.slice(0,4).forEach((n,k)=>{ lg.append("rect").attr("x",xx).attr("y",-9).attr("width",12).attr("height",9).attr("fill",RUCOL[k]).attr("stroke","#999"); const t=lg.append("text").attr("x",xx+15).attr("y",-1).attr("font-size",10.5).text(n); xx+=t.node().getComputedTextLength()+30; }); }
}
function applyPCPFilter(final=true){
  if(!pcpBrushes.size){ if(S.hlSrc==="parallel coordinates"){ if(final) setTimeout(()=>setHL(null),0); else { S.hl=null; drawPCPLines(); } } return; }
  const ids=scopeIds().filter(i=>{ for(const [a,[lo,hi]] of pcpBrushes){ const v=V[a][i]; if(isNaN(v)||v<lo||v>hi) return false; } return true; });
  if(final) setTimeout(()=>setHL(new Set(ids), "parallel coordinates"),0);
  else { S.hl=new Set(ids); S.hlSrc="parallel coordinates"; S.filter=null; updateChips(); drawPCPLines(); }
}
function drawPCPTop(){
  if(!pcp||!pcp.x) return; const {W,H,c2,dpr}=pcp, x=pcp.x, y=pcp.y; const ctx=c2.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const line=(i,col,w)=>{ ctx.strokeStyle=col; ctx.lineWidth=w; ctx.beginPath(); pcpAxes.forEach((a,k)=>{ const v=V[a][i]; if(isNaN(v)) return; k? ctx.lineTo(x(a),y[a](v)): ctx.moveTo(x(a),y[a](v)); }); ctx.stroke(); };
  if(S.hover!=null && HAS[S.hover]){ line(S.hover,"#fff",4.5); line(S.hover,"#333",2); }
  if(S.sel!=null && HAS[S.sel]){ line(S.sel,"#fff",5.5); line(S.sel,"#000",2.8);
    ctx.font="600 11px Segoe UI, Arial"; ctx.fillStyle="#000"; const a=pcpAxes[pcpAxes.length-1]; ctx.textAlign="left"; ctx.fillText(tname(S.sel), x(a)+8, y[a](V[a][S.sel])+4); }
}
function pcpNearest(e){
  const [mx,my]=d3.pointer(e,pcp.c); const x=pcp.x, y=pcp.y; const dom=pcpAxes; let k=0; while(k<dom.length-2 && x(dom[k+1])<mx) k++;
  const a=dom[k], b=dom[k+1]; if(!b) return null; const t=Math.max(0,Math.min(1,(mx-x(a))/(x(b)-x(a))));
  let best=null, bd=6; const cand = S.hl? pcp.ids.filter(i=>S.hl.has(i)) : pcp.ids;
  cand.forEach(i=>{ const va=V[a][i], vb=V[b][i]; if(isNaN(va)||isNaN(vb)) return; const yy=y[a](va)*(1-t)+y[b](vb)*t; const d=Math.abs(yy-my); if(d<bd){ bd=d; best=i; } });
  return best;
}
function pcpHover(e){ const i=pcpNearest(e); if(i==null){ if(S.hover!=null) setHover(null); return; }
  setHover(i,e); showTip(tipTract(i, pcpAxes.slice(0,6).map(a=>'<div>'+short(a)+': <b>'+pct(V[a][i])+'</b> <span class="mu">(TX '+fmt1(REF.tx[a])+')</span></div>').join("")+'<div class="mu">Click to select</div>'), e); }

// ---------- relationship explorer (R2: relate risk factors to outcomes) ----------
const RISKX = ["CSMOKING","LPA","OBESITY","BINGE","SLEEP","ACCESS2","CHECKUP","BPMED","CHOLSCREEN","DENTAL","GHLTH","MHLTH","DISABILITY"];
function initRisk(){
  const xs=d3.select("#riskX"), ys=d3.select("#riskY");
  d3.groups(MEAS.filter(m=>!m.derived), m=>m.group).forEach(([g,ms])=>{ [xs,ys].forEach(s=>{ const og=s.append("optgroup").attr("label",g); ms.forEach(m=>og.append("option").attr("value",m.id).text(m.label)); }); });
  ys.append("option").attr("value","UNTREATED").text(MID.UNTREATED.label);
  xs.property("value","LPA"); ys.property("value","DIABETES");
  [xs,ys,d3.select("#riskC")].forEach(s=>s.on("change", drawRisk));
  MAPS.risk = new ScatterView(document.getElementById("riskScatter"), {height:520, name:"risk explorer"});
  registerView("compare", ch=>{
    if(ch.measure||ch.all){ const ys=d3.select("#riskY"); if(ys.selectAll("option").filter(function(){return this.value===S.measure;}).size()){ ys.property("value",S.measure);
        if(d3.select("#riskX").property("value")===S.measure) d3.select("#riskX").property("value", S.measure==="LPA"?"CSMOKING":"LPA"); } }
    if(ch.all||ch.scope||ch.measure) drawRisk(); else if(ch.hl){ MAPS.risk.render(); if(RSTAT.risk) RSTAT.risk.hl=RSTAT.sc["risk explorer"].hl; } else if(ch.sel||ch.hover) MAPS.risk.drawTop(); });
}
function drawRisk(){
  const a=d3.select("#riskX").property("value"), b=d3.select("#riskY").property("value"), cm=d3.select("#riskC").property("value");
  const ids=scopeIds(); const many=ids.length>1000;
  const rs=d3.scaleSqrt().domain([0,d3.max(ID_TX,i=>POP[i])]).range([0, many? 5: 11]);
  d3.select("#riskTitle").text("Relationship explorer: "+MID[a].short+" → "+MID[b].short);
  MAPS.risk.set({ids, bgIds: S.scope==="bv"? ID_TX : null, x:i=>V[a][i], y:i=>V[b][i], r:i=>Math.max(many?1.2:2.5, rs(POP[i])),
    color: cm==="cluster"? (i=>CLCOL[CL[i]]) : cm==="ru"? (i=>RUCOL[TR.ru[i]]||"#ccc") : (()=>"#5f6b7a"),
    fit:true, alpha: many? .35 : .8, xLabel:MID[a].label+" (%)", yLabel:MID[b].label+" (%)", tip:i=>tipTract(i, measLine(a,i)+measLine(b,i)),
    extra: sv=>{ const g=sv.gFit.append("g").attr("transform","translate("+(sv.w-sv.o.m.r-215)+","+(sv.h-sv.o.m.b-(cm==="none"?40:(cm==="cluster"?92:76)))+")");
      g.append("rect").attr("x",-8).attr("y",-12).attr("width",222).attr("height",cm==="none"?36:(cm==="cluster"?88:72)).attr("fill","rgba(255,255,255,.9)").attr("stroke","#dde2e8");
      let y=0; if(cm==="cluster") CLS.forEach((c,k)=>{ g.append("circle").attr("cx",0).attr("cy",y-3).attr("r",4).attr("fill",CLCOL[k]); g.append("text").attr("x",8).attr("y",y+1).attr("font-size",10).text(c.name); y+=13; });
      if(cm==="ru") RU_NAMES.slice(0,4).forEach((n,k)=>{ g.append("circle").attr("cx",0).attr("cy",y-3).attr("r",4).attr("fill",RUCOL[k]).attr("stroke","#999"); g.append("text").attr("x",8).attr("y",y+1).attr("font-size",10).text(n); y+=13; });
      [[1000,"1,000"],[8000,"8,000 people"]].forEach(([p,t])=>{ g.append("circle").attr("cx",0).attr("cy",y+1).attr("r",Math.max(1.2,rs(p))).attr("fill","none").attr("stroke","#555"); g.append("text").attr("x",14).attr("y",y+5).attr("font-size",10).text(t); y+=13; });
      if(S.hl){ const h=sv.ids.filter(i=>S.hl.has(i)); if(h.length>=8){ const r=pearson(h.map(i=>V[a][i]),h.map(i=>V[b][i]));
        sv.gFit.append("text").attr("x",sv.o.m.l+18).attr("y",sv.o.m.t+60).attr("font-size",11.5).attr("font-weight",650).attr("fill",HL).text("Highlighted group ("+h.length+"): r = "+fmt2(r)); } } }});
  RSTAT.risk={scope:S.scope, n:MAPS.risk.ids.length, r:MAPS.risk.stats? +MAPS.risk.stats.r.toFixed(4):null, x:a, y:b, hl: S.hl? MAPS.risk.ids.filter(i=>S.hl.has(i)).length:0};
  // predictor ranking for Y
  const rank=IDS.filter(m=>m!==b && (b==="UNTREATED"? !["BPHIGH","BPMED"].includes(m):true)).map(m=>{ const X=ids.map(i=>V[m][i]), Y=ids.map(i=>V[b][i]); return [m, pearson(X,Y)]; }).sort((p,q)=>Math.abs(q[1])-Math.abs(p[1])).slice(0,16);
  d3.select("#riskRankNote").text("Pearson r of every measure with "+MID[b].short+" across "+fmtInt(ids.length)+" "+scopeName()+" tracts. Y follows the focus measure. Click a bar to use it as X.");
  RSTAT.risk.top=rank[0][0]; RSTAT.risk.topR=+rank[0][1].toFixed(4);
  const W=360, H=440, sv=d3.select("#riskRank").attr("viewBox",[0,0,W,H]); sv.selectAll("*").remove();
  const x=d3.scaleLinear().domain([-1,1]).range([120,W-30]); const bh=(H-30)/rank.length;
  sv.append("line").attr("x1",x(0)).attr("x2",x(0)).attr("y1",0).attr("y2",H-24).attr("stroke","#999");
  const g=sv.selectAll("g.rb").data(rank).join("g").attr("class","rb").attr("transform",(d,k)=>"translate(0,"+(k*bh)+")").style("cursor","pointer").on("click",(e,d)=>{ d3.select("#riskX").property("value",d[0]); drawRisk(); });
  g.append("text").attr("x",115).attr("y",bh*.65).attr("text-anchor","end").attr("font-size",11).attr("font-weight",d=>d[0]===a?700:400).text(d=>short(d[0]));
  g.append("rect").attr("x",d=>x(Math.min(0,d[1]))).attr("width",d=>Math.abs(x(d[1])-x(0))).attr("y",3).attr("height",bh-6).attr("fill",d=>CORRCOL(d[1])).attr("stroke",d=>d[0]===a?"#000":"none");
  g.append("text").attr("x",d=>d[1]>=0? x(d[1])+3 : x(0)+3).attr("text-anchor","start").attr("y",bh*.65).attr("font-size",10).text(d=>fmt2(d[1]));
  sv.append("g").attr("class","axis").attr("transform","translate(0,"+(H-24)+")").call(d3.axisBottom(x).ticks(5));
}

function initCompareTab(){ initPCP(); initRisk(); }
INITS.compare = initCompareTab;
