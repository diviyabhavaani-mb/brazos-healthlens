// Brazos HealthLens · Tab 4 "Care gaps" (R5)
// Bivariate map (disease burden × care deficit, tertiles of the scope), the matching scatterplot, and the
// ranked list of high-burden / high-deficit tracts for outreach planning.
"use strict";
let gapT=null;
function gapCuts(){ const ids=scopeIds(); const b=ids.map(i=>BURDEN[i]).sort(d3.ascending), d=ids.map(i=>DEFICIT[i]).sort(d3.ascending);
  return {b:[d3.quantileSorted(b,1/3), d3.quantileSorted(b,2/3)], d:[d3.quantileSorted(d,1/3), d3.quantileSorted(d,2/3)]}; }
function gapClass(i){ const t=gapT; const bi=BURDEN[i]<=t.b[0]?0:BURDEN[i]<=t.b[1]?1:2, di=DEFICIT[i]<=t.d[0]?0:DEFICIT[i]<=t.d[1]?1:2; return [bi,di]; }
function gapScore(i){ const ids=scopeIds(); return (gapPct.b.get(i)+gapPct.d.get(i)); }
let gapPct={b:new Map(),d:new Map()};
function initGap(){
  MAPS.gap = new MapView(document.getElementById("gapMap"), {height:560, name:"gap", focus:"scope", color:i=>{ if(isNaN(BURDEN[i])) return null; const [b,d]=gapClass(i); return BIV[b][d]; },
    tip:i=>{ const [b,d]=gapClass(i); return tipTract(i, '<div style="margin-top:3px">Burden index <b>'+fmtS(BURDEN[i])+'</b> SD ('+["low","middle","high"][b]+' third) · Care deficit <b>'+fmtS(DEFICIT[i])+'</b> SD ('+["low","middle","high"][d]+' third)</div>'+
      ["DIABETES","BPHIGH","ACCESS2","CHECKUP","BPMED","UNTREATED"].map(m=>'<div>'+short(m)+': <b>'+pct(V[m][i])+'</b> <span class="mu">(TX '+fmt1(REF.tx[m])+')</span></div>').join("")); }});
  MAPS.gap.sc = new ScatterView(document.getElementById("gapScatter"), {height:560, name:"care-gap scatter", m:{l:52,r:16,t:14,b:44}});
  registerView("gap", ch=>{
    if(ch.scope && !ch.all) MAPS.gap.frameScope();
    if(ch.all||ch.scope||ch.hl||ch.sel||ch.measure) drawGap();
    else if(ch.hover){ MAPS.gap.drawTop(); MAPS.gap.sc.drawTop(); hoverGapList(); } });
}
function drawGap(){
  gapT=gapCuts(); const ids=scopeIds();
  const rb=d3.rank(ids.map(i=>BURDEN[i])), rd=d3.rank(ids.map(i=>DEFICIT[i])); gapPct={b:new Map(ids.map((i,k)=>[i,rb[k]/(ids.length-1)])), d:new Map(ids.map((i,k)=>[i,rd[k]/(ids.length-1)]))};
  MAPS.gap.draw();
  // bivariate legend
  const L=MAPS.gap.legend.html(""); L.append("div").attr("class","lt").text("Burden × care deficit (tertiles of "+scopeName()+")");
  const s=L.append("svg").attr("width",215).attr("height",132); const cs=30, ox=62, oy=8;
  for(let b=0;b<3;b++) for(let d=0;d<3;d++){ const n=ids.filter(i=>{ const c=gapClass(i); return c[0]===b&&c[1]===d; }).length;
    const src="care-gap class "+["low","mid","high"][b]+" burden / "+["low","mid","high"][d]+" deficit"; const on=S.hlSrc===src;
    s.append("rect").attr("class","bivcell").attr("data-b",b).attr("data-d",d).attr("x",ox+d*cs).attr("y",oy+(2-b)*cs).attr("width",cs-1).attr("height",cs-1).attr("fill",BIV[b][d]).style("cursor","pointer")
      .attr("stroke",on?HL:"none").attr("stroke-width",on?3:0)
      .on("click",()=>on? setHL(null) : setHL(new Set(ids.filter(i=>{ const c=gapClass(i); return c[0]===b&&c[1]===d; })), "care-gap class "+["low","mid","high"][b]+" burden / "+["low","mid","high"][d]+" deficit"))
      .append("title").text(["Low","Middle","High"][b]+" burden, "+["low","middle","high"][d]+" care deficit: "+n+" tracts. Click to highlight.");
    s.append("text").attr("x",ox+d*cs+cs/2).attr("y",oy+(2-b)*cs+cs/2+4).attr("text-anchor","middle").attr("font-size",9.5).attr("fill",b+d>=3?"#fff":"#333").attr("pointer-events","none").text(n); }
  s.append("text").attr("x",ox+1.5*cs).attr("y",oy+3*cs+14).attr("text-anchor","middle").attr("font-size",10.5).text("Care deficit →");
  s.append("text").attr("transform","translate("+(ox-8)+","+(oy+1.5*cs)+") rotate(-90)").attr("text-anchor","middle").attr("font-size",10.5).text("Disease burden →");
  s.append("text").attr("x",ox+3*cs+4).attr("y",oy+12).attr("font-size",10).attr("font-weight",650).text("care gap");
  L.append("div").attr("class","mu").text("Numbers = tracts per cell. Click a cell to highlight.");
  // scatter
  MAPS.gap.sc.set({ids, bgIds:S.scope==="bv"?ID_TX:null, x:i=>DEFICIT[i], y:i=>BURDEN[i], color:i=>{ const [b,d]=gapClass(i); return BIV[b][d]; }, alpha:S.scope==="bv"?.95:.7,
    xLabel:"Care deficit index (SD, → worse access/prevention)", yLabel:"Disease burden index (SD, ↑ worse)", tip:i=>MAPS.gap.o.tip(i),
    extra: sv=>{ const g=sv.gFit; gapT.d.forEach(v=>g.append("line").attr("x1",sv.xs(v)).attr("x2",sv.xs(v)).attr("y1",sv.o.m.t).attr("y2",sv.h-sv.o.m.b).attr("stroke","#888").attr("stroke-dasharray","3 3"));
      gapT.b.forEach(v=>g.append("line").attr("x1",sv.o.m.l).attr("x2",sv.w-sv.o.m.r).attr("y1",sv.ys(v)).attr("y2",sv.ys(v)).attr("stroke","#888").attr("stroke-dasharray","3 3"));
      g.append("text").attr("x",sv.w-sv.o.m.r-4).attr("y",sv.o.m.t+12).attr("text-anchor","end").attr("class","anno-text").attr("fill","#804d36").text("CARE GAP: high burden + high deficit"); }});
  // ranked list
  const hh=ids.filter(i=>{ const c=gapClass(i); return c[0]===2&&c[1]===2; }).sort((a,b)=>(gapPct.b.get(b)+gapPct.d.get(b))-(gapPct.b.get(a)+gapPct.d.get(a)));
  const list=(S.hl? hh.filter(i=>S.hl.has(i)) : hh).slice(0,40);
  RSTAT.gap={scope:S.scope, cuts:gapT, hh:hh.length, rows:list.length, outside:list.filter(i=>!IN_BV[i]).length, first:list.length? TR.tract[list[0]]+" "+cname(list[0]) : null, hlPts: S.hl? MAPS.gap.sc.ids.filter(i=>S.hl.has(i)).length:0};
  d3.select("#gapListTitle").text("Where care and medication are most needed: "+hh.length+" "+scopeName()+" tracts in the high-burden / high-deficit cell");
  d3.select("#gapListNote").html("Ranked by combined percentile of burden and deficit"+(S.hl?" (filtered to the highlighted group)":"")+". <b>Untreated BP</b> = estimated % of all adults who have high BP and are not taking BP medicine (high BP × (1 − BP-medicine share)). Red values are worse than Texas. <a href='#' id='gapHL'>Highlight all "+hh.length+"</a>.");
  d3.select("#gapHL").on("click",e=>{ e.preventDefault(); setHL(new Set(hh),"care-gap tracts"); });
  const T=d3.select("#gapList").html(""); const cols=["DIABETES","BPHIGH","COPD","CHD","ACCESS2","CHECKUP","BPMED","CHOLSCREEN","UNTREATED"];
  const hr=T.append("tr"); ["#","Tract","Place, county","Profile","Burden","Deficit",...cols.map(short)].forEach(t=>hr.append("th").text(t));
  list.forEach((i,k)=>{ const tr=T.append("tr").attr("class","r").datum(i).classed("on",i===S.sel).classed("hlrow",!!(S.hl&&S.hl.has(i))).on("mouseenter",e=>setHover(i,e)).on("mousemove",moveTip).on("mouseleave",()=>setHover(null)).on("click",()=>setSel(i));
    tr.append("td").text(k+1); tr.append("td").html("<b>"+TR.tract[i]+"</b>"); tr.append("td").text(pname(i)+", "+cname(i)); tr.append("td").html(clPill(CL[i]));
    tr.append("td").text(fmtS(BURDEN[i])); tr.append("td").text(fmtS(DEFICIT[i]));
    cols.forEach(m=>{ const v=V[m][i], w=worseVal(m,v)>worseVal(m,REF.tx[m]); tr.append("td").style("color",w?"#b42318":null).style("font-weight",w?600:null).text(fmt1(v)); }); });
  if(!list.length) T.append("tr").append("td").attr("colspan",15).attr("class","note").text("No tracts in this cell for the current highlight.");
}
function hoverGapList(){ d3.selectAll("#gapList tr.r").classed("on",i=>i===S.hover||i===S.sel); }
INITS.gap = initGap;
