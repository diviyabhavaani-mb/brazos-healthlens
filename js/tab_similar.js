// Brazos HealthLens · Tab 3 "Similar & unusual" (R3)
// Peer finder (20 nearest tracts on 23 standardized measures), profile-group cards and heatmap,
// and a table of tracts that are unusual for their own group.
"use strict";
function peerDist(i,j){ let s=0; CORE.forEach(m=>{ const a=zc(m,i), b=zc(m,j); if(!isNaN(a)&&!isNaN(b)) s+=(a-b)**2; }); return Math.sqrt(s); }
const PEER_SM = ["DIABETES","BPHIGH","OBESITY","COPD","CHD","DEPRESSION","CSMOKING","LPA","ACCESS2","CHECKUP","BPMED","GHLTH"];
let peerSet = null;
const PEERCOL = "#3b2f4a";   // peers are a result list, not the brushed highlight: drawn as dark dots (blue stays reserved for the shared highlight)
const PEER_MED = (()=>{ const r=d3.randomLcg(7); const d=[]; for(let k=0;k<1500;k++){ const a=ID_TX[Math.floor(r()*ID_TX.length)], b=ID_TX[Math.floor(r()*ID_TX.length)]; if(a!==b) d.push(peerDist(a,b)); } return d3.median(d); })();
function getPeers(){
  if(S.sel==null || !HAS[S.sel]) return [];
  const k=+d3.select("#peerK").property("value"); const out=d3.select("#peerOut").property("checked");
  if(S.scope==="bv")   // within-valley peers: full scan of the other 101 valley tracts
    return ID_BV.filter(j=>j!==S.sel && HAS[j]).map(j=>[j,peerDist(S.sel,j)]).sort((a,b)=>a[1]-b[1]).slice(0,k).map(a=>a[0]);
  if(out) return ID_TX.filter(j=>j!==S.sel && !IN_BV[j]).map(j=>[j,peerDist(S.sel,j)]).sort((a,b)=>a[1]-b[1]).slice(0,k).map(a=>a[0]);
  return (D.peers[S.sel]||[]).slice(0,k);   // precomputed 20 nearest among all Texas tracts
}
function peerPanels(){ const ms=PEER_SM.slice(); if(!ms.includes(S.measure)){ ms.unshift(S.measure); ms.pop(); } return ms; }
function initSimilarTab(){
  MAPS.peer = new MapView(document.getElementById("peerMap"), {height:330, name:"peer", focus:"scope", labels:true, countyK:0,
    color: i=> peerSet && peerSet.has(i)? "#8d84a0" : "#e3e7ec", markSet: ()=> peerSet, markColor: PEERCOL,
    selSet: ()=> S.sel!=null? [S.sel] : [],
    tip: i=> tipTract(i, peerSet && peerSet.has(i)? '<div><b>Peer</b> · distance '+fmt2(peerDist(S.sel,i))+'</div>'+measLine(S.measure,i) : measLine(S.measure,i)) });
  { const L=MAPS.peer.legend; L.append("div").attr("class","row").html('<svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="'+PEERCOL+'" stroke="#fff"/></svg> Peer tract (dot at its center)');
    L.append("div").attr("class","row").html('<svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke="#000" stroke-width="2"/></svg> Selected tract');
    L.append("div").attr("class","row").html('<svg width="14" height="14"><rect x="1" y="1" width="12" height="12" fill="none" stroke="'+HL+'" stroke-width="2"/></svg> Highlighted group (shared)'); }
  d3.select("#peerK").on("input", function(){ d3.select("#peerKv").text(this.value); drawPeers({}); });
  d3.select("#peerOut").on("change", ()=>drawPeers({}));
  registerView("similar", ch=>{
    if(ch.all||ch.sel||ch.scope||ch.measure) drawPeers(ch);
    else if(ch.hl){ MAPS.peer.draw(); markPeerRows(); }
    if(ch.all||ch.scope||ch.hl||ch.sel||ch.measure){ drawClCards(); drawClHeat(); drawOdd(); }
    if(ch.hover && !(ch.all||ch.sel||ch.scope||ch.measure)){ MAPS.peer.drawTop(); markPeerRows(); } });
}
function markPeerRows(){ d3.selectAll("#peerList tr.r").classed("on",j=>j===S.hover).classed("hlrow", j=>!!(S.hl && S.hl.has(j))); }
function drawPeers(ch){
  const TXS=S.scope==="tx", ref=REF[scopeKey()];
  d3.select("#peerDesc").html("Finds the "+(TXS? "Texas tracts" : "<b>other Brazos Valley tracts</b>")+" whose health profile is most similar to the selected tract: Euclidean distance on 23 standardized measures (Texas z-scores of diseases, risk factors, care access and health status). "+(TXS? "Scope = All Texas: peers can be anywhere in the state." : "Switch the scope to <b>All Texas</b> to search statewide."));
  d3.select("#peerOutWrap").style("display", TXS? null : "none");
  d3.select("#peerMapNote").text("Selected tract circled in black, peers as dark dots; the map is framed to "+(TXS?"all of Texas":"the Brazos Valley")+" (the scope). Blue outline = the shared highlighted group.");
  d3.select("#peerSMNote").html("Each panel is one measure: gray = distribution of "+(TXS?"all Texas":"Brazos Valley")+" tracts, dark dots = peers, black diamond = selected tract (with 95% CI), orange tick = "+scopeName()+" average. The focus measure ("+short(S.measure)+") is outlined.");
  const H=d3.select("#peerHead").html(""); const L=d3.select("#peerList").html(""); const SM=d3.select("#peerSM").html("");
  if(ch.all||ch.scope) MAPS.peer.frameScope(ch.all?0:600);
  if(S.sel==null || !HAS[S.sel]){
    H.html("<p class='note' style='font-size:12.5px;color:#1f2933'><b>Select a tract first</b>: click one on any map or chart, or use the search box. Try <a href='#' id='peerEx'>Hearne tract 9605.01</a>.</p>");
    d3.select("#peerEx").on("click",e=>{ e.preventDefault(); setSel(GIDX.get("48395960501"),true); });
    peerSet=null; MAPS.peer.draw(); RSTAT.peers={n:0, scope:S.scope}; return; }
  const i=S.sel, peers=getPeers(); peerSet=new Set(peers);
  RSTAT.peers={n:peers.length, scope:S.scope, outside:peers.filter(j=>!IN_BV[j]).length, first:peers[0], panels:peerPanels()};
  H.html("<div style='font-size:13px;margin:4px 0 6px'><b>"+tfull(i)+"</b><br><span class='clpill' style='background:"+CLCOL[CL[i]]+";color:"+CLTXT[CL[i]]+"'>"+clName(CL[i])+"</span></div>");
  H.append("button").attr("class","btn").style("margin-bottom","6px").text("Highlight these "+peers.length+" peers everywhere").on("click",()=>setHL(new Set(peers),"peers of "+tname(i)));
  const hr=L.append("tr"); ["#","Tract","County","Profile","Dist."].forEach(t=>hr.append("th").text(t));
  peers.forEach((j,k)=>{ const tr=L.append("tr").datum(j).attr("class","r").on("mouseenter",e=>setHover(j,e)).on("mousemove",moveTip).on("mouseleave",()=>setHover(null)).on("click",()=>setSel(j));
    tr.append("td").text(k+1); tr.append("td").html("<b>"+TR.tract[j]+"</b> <span class='note'>"+pname(j)+"</span>"); tr.append("td").text(cname(j)+(IN_BV[j]?" ★":""));
    tr.append("td").html("<span class='clpill' style='background:"+CLCOL[CL[j]]+";color:"+CLTXT[CL[j]]+"' title='"+clName(CL[j])+"'>"+(CL[j]+1)+"</span>"); tr.append("td").text(fmt2(peerDist(i,j))); });
  L.append("tr").append("td").attr("colspan",5).attr("class","note").html("★ = Brazos Valley tract. Blue row = also in the shared highlighted group. Distance = Euclidean on 23 z-scores (0 = identical; median distance between two random Texas tracts = "+fmt1(PEER_MED)+"). Click a row to make that tract the selection.");
  markPeerRows();
  MAPS.peer.draw();
  // small multiples (focus measure first)
  const w=230, h=74, ids=scopeIds();
  peerPanels().forEach(m=>{ const s=SM.append("div").classed("pfocus", m===S.measure).append("svg").attr("viewBox",[0,0,w,h]).attr("class","svgfull").style("cursor","pointer").on("click",()=>setMeasure(m));
    const vals=ids.map(j=>V[m][j]).filter(v=>!isNaN(v)); const ext=d3.extent([...vals, ...peers.map(j=>V[m][j]), V[m][i]]); const x=d3.scaleLinear().domain(ext).range([8,w-8]).nice();
    const bins=d3.bin().domain(x.domain()).thresholds(TXS?40:20)(vals); const yb=d3.scaleLinear().domain([0,d3.max(bins,b=>b.length)]).range([0,30]);
    s.append("text").attr("x",8).attr("y",11).attr("font-size",11.5).attr("font-weight",m===S.measure?800:650).attr("fill",m===S.measure?"#015f64":null).text(MID[m].short);
    s.append("text").attr("x",w-8).attr("y",11).attr("text-anchor","end").attr("font-size",10.5).text(pct(V[m][i])+" vs peers "+pct(d3.mean(peers,j=>V[m][j])));
    s.append("g").selectAll("rect").data(bins).join("rect").attr("x",b=>x(b.x0)).attr("width",b=>Math.max(0,x(b.x1)-x(b.x0)-.5)).attr("y",b=>50-yb(b.length)).attr("height",b=>yb(b.length)).attr("fill","#dfe3e8");
    s.append("line").attr("x1",x(ref[m])).attr("x2",x(ref[m])).attr("y1",16).attr("y2",58).attr("stroke","#c2410c").attr("stroke-width",1.8);
    s.selectAll("circle").data(peers).join("circle").attr("cx",j=>x(V[m][j])).attr("cy",(j,k)=>54+(k%3)*2.5).attr("r",3).attr("fill",PEERCOL).attr("fill-opacity",.75).attr("stroke",j=>S.hl&&S.hl.has(j)?HL:"#fff").attr("stroke-width",.8);
    if(HI[m]) s.append("line").attr("x1",x(LO[m][i])).attr("x2",x(HI[m][i])).attr("y1",44).attr("y2",44).attr("stroke","#000").attr("stroke-width",1.5);
    s.append("path").attr("d",d3.symbol(d3.symbolDiamond,70)()).attr("transform","translate("+x(V[m][i])+",44)").attr("fill","#000").attr("stroke","#fff");
    s.append("g").attr("class","axis").attr("transform","translate(0,"+(h-12)+")").call(d3.axisBottom(x).ticks(4).tickSize(2).tickFormat(d=>d+"%")).select(".domain").remove(); });
}

// ---------- profile groups ----------
function drawClCards(){
  const sid=scopeIds(); const cnt=CLS.map((c,k)=>sid.filter(i=>CL[i]===k).length);
  const C=d3.select("#clCards");
  C.selectAll("div.card").data(CLS).join("div").attr("class","card clcard").style("cursor","pointer").style("border-top",(d,k)=>"6px solid "+CLCOL[k]).style("padding","8px 10px")
    .classed("on",(d,k)=>!!(S.filter && S.filter.type==="cluster" && S.filter.key===k))
    .attr("title","Click to filter this profile in every view (click again to clear)")
    .on("click",(e,d)=>setFilter("cluster", CLS.indexOf(d)))
    .html((d,k)=>"<div style='font-weight:650;font-size:13px'>"+(k+1)+". "+d.name+"</div><div class='note' style='margin:2px 0'>"+(S.scope==="bv"? "<b>"+cnt[k]+"</b> Brazos Valley tracts · "+fmtInt(D.cl_size[k])+" in Texas" : "<b>"+fmtInt(cnt[k])+"</b> Texas tracts · "+D.cl_bv[k]+" in the Brazos Valley")+"</div><div style='font-size:11.5px;line-height:1.35'>"+d.desc+"</div>");
}
const _clz={};
function clMeans(){   // cluster mean z (Texas-standardized, signed worse>0) and raw mean, over the tracts in scope
  if(S.scope==="tx") return {z:(m,k)=>D.cl_z[m][k], raw:(m,k)=>D.cl_raw[m][k], n:k=>D.cl_size[k]};
  if(!_clz.bv){ const ms=MEAS.filter(m=>!m.derived).map(m=>m.id); const z={}, raw={}, n=CLS.map((c,k)=>ID_BV.filter(i=>CL[i]===k).length);
    ms.forEach(m=>{ z[m]=CLS.map((c,k)=>{ const ids=ID_BV.filter(i=>CL[i]===k&&!isNaN(V[m][i])); return ids.length? d3.mean(ids,i=>zc(m,i)) : NaN; });
      raw[m]=CLS.map((c,k)=>{ const ids=ID_BV.filter(i=>CL[i]===k&&!isNaN(V[m][i])); return ids.length? d3.mean(ids,i=>V[m][i]) : NaN; }); });
    _clz.bv={z:(m,k)=>z[m][k], raw:(m,k)=>raw[m][k], n:k=>n[k]}; }
  return _clz.bv;
}
function drawClHeat(){
  const ms=MEAS.filter(m=>!m.derived).map(m=>m.id); const W=1360, cw=(W-290-40)/ms.length, ch=30, top=96; const H=top+K*ch+(S.sel!=null?ch+8:0)+(S.hl?ch+8:0)+40;
  const sv=d3.select("#clHeat").attr("viewBox",[0,0,W,H]); sv.selectAll("*").remove();
  const x=k=>290+k*cw;
  // group labels
  d3.groups(ms.map((m,k)=>[m,k]), d=>MID[d[0]].group).forEach(([g,arr])=>{ const a=arr[0][1], b=arr[arr.length-1][1];
    sv.append("line").attr("x1",x(a)+2).attr("x2",x(b)+cw-2).attr("y1",12).attr("y2",12).attr("stroke","#015f64").attr("stroke-width",2);
    sv.append("text").attr("x",(x(a)+x(b)+cw)/2).attr("y",9).attr("text-anchor","middle").attr("font-size",10.5).attr("fill","#015f64").attr("font-weight",650).text(g); });
  sv.selectAll("text.col").data(ms).join("text").attr("class","col").attr("transform",(m,k)=>"translate("+(x(k)+cw/2+4)+","+(top-6)+") rotate(-55)").attr("font-size",10.5).text(m=>short(m));
  const CM=clMeans();
  if(ms.includes(S.measure)){ const j=ms.indexOf(S.measure); sv.append("rect").attr("x",x(j)-1).attr("y",18).attr("width",cw+2).attr("height",H-18-40+4).attr("fill","none").attr("stroke","#015f64").attr("stroke-width",2.2).attr("rx",3); }
  const rows=CLS.map((c,k)=>({label:(k+1)+". "+c.name, sub:fmtInt(CM.n(k))+" "+scopeName()+" tracts", z:m=>CM.z(m,k), raw:m=>CM.raw(m,k), col:CLCOL[k], k, on: S.filter&&S.filter.type==="cluster"&&S.filter.key===k}))
    .filter(r=>CM.n(r.k)>0);
  if(S.hl){ const hid=[...S.hl].filter(i=>HAS[i]); rows.push({label:"Highlighted ("+hid.length+")", z:m=>d3.mean(hid,i=>zc(m,i)), raw:m=>d3.mean(hid,i=>V[m][i]), col:HL, sel:1}); }
  if(S.sel!=null && HAS[S.sel]) rows.push({label:"Selected: "+tname(S.sel), z:m=>(V[m][S.sel]-MU[m])/SD[m]*(isGood(m)?-1:1), raw:m=>V[m][S.sel], col:"#000", sel:1});
  RSTAT.clheat={scope:S.scope, rows:rows.map(r=>r.label+(r.sub?" ("+r.sub+")":"")), z0:+CM.z("DIABETES",0).toFixed(3)};
  rows.forEach((r,k)=>{ const y=top+k*ch+(r.sel?8:0)+(r.sel && k>0 && rows[k-1].sel? 0:0); const g=sv.append("g").attr("transform","translate(0,"+y+")");
    g.append("rect").attr("x",4).attr("y",4).attr("width",12).attr("height",ch-8).attr("fill",r.col);
    if(r.sub) g.append("text").attr("x",22).attr("y",ch-3).attr("font-size",9.5).attr("fill","#5f6b7a").text(r.sub);
    g.append("text").attr("x",22).attr("y",r.sub? ch/2-1 : ch/2+4).attr("font-size",11.5).attr("font-weight",r.on?800:650).attr("fill",r.on?HL:null).text(r.label).style("cursor",r.sel?null:"pointer")
      .on("click",()=>{ if(!r.sel) setFilter("cluster",r.k); });
    ms.forEach((m,j)=>{ const z=r.z(m); g.append("rect").attr("x",x(j)+1).attr("y",1).attr("width",cw-2).attr("height",ch-2).attr("fill",isNaN(z)?"#eee":ZDIV(Math.max(-1,Math.min(1,z/1.8))))
        .on("mouseenter",e=>showTip('<div class="tt">'+r.label+'</div><b>'+MID[m].label+'</b>: '+pct(r.raw(m))+' <span class="mu">(mean of '+(r.sel?'these':scopeName())+' tracts; Texas tract mean '+pct(MU[m])+')</span><div>z = '+fmtS(z)+' SD '+(z>0?'(worse)':'(better)')+'</div>',e)).on("mousemove",moveTip).on("mouseleave",hideTip);
      if(Math.abs(z)>=1) g.append("text").attr("x",x(j)+cw/2).attr("y",ch/2+4).attr("text-anchor","middle").attr("font-size",9.5).attr("fill",Math.abs(z)>1.3?"#fff":"#1f2933").attr("pointer-events","none").text(fmt1(z)); });
  });
  // legend
  const lg=sv.append("g").attr("transform","translate(290,"+(H-24)+")"); const lw=260;
  const grad=sv.append("defs").append("linearGradient").attr("id","zgrad"); d3.range(0,1.01,.1).forEach(t=>grad.append("stop").attr("offset",t).attr("stop-color",ZDIV(t*2-1)));
  lg.append("rect").attr("width",lw).attr("height",10).attr("fill","url(#zgrad)");
  [[-1.8,"−1.8 SD better"],[0,"Texas avg"],[1.8,"+1.8 SD worse"]].forEach(([v,t])=>lg.append("text").attr("x",(v/1.8+1)/2*lw).attr("y",22).attr("text-anchor",v<0?"start":v>0?"end":"middle").attr("font-size",10.5).text(t));
  lg.append("text").attr("x",lw+16).attr("y",9).attr("font-size",10.5).attr("fill","#5f6b7a").text("Numbers shown where |z| ≥ 1. Silhouette "+fmt2(D.meta.sil[K])+"; stability across 5 random restarts: adjusted Rand "+d3.min(D.meta.ari).toFixed(2)+"–"+d3.max(D.meta.ari).toFixed(2)+".");
}

// ---------- unusual for their group (R3: tracts that stand out) ----------
// Score = Euclidean distance (23 Texas z-scores, + = worse) between a tract and its own group's mean
// profile. A high score means the tract does not look like the rest of its group; the measure with the
// largest gap says how it differs.
const ODD = (()=>{ const sc=new Float32Array(N).fill(NaN), mm=new Array(N), dz=new Float32Array(N);
  ID_TX.forEach(i=>{ const k=CL[i]; if(k<0) return; let s=0, best=null, bd=0;
    CORE.forEach(m=>{ const z=zc(m,i); if(isNaN(z)) return; const d=z-D.cl_z[m][k]; s+=d*d; if(Math.abs(d)>Math.abs(bd)){ bd=d; best=m; } });
    sc[i]=Math.sqrt(s); mm[i]=best; dz[i]=bd; });
  return {sc, mm, dz}; })();
function oddIds(){ const base=(S.hl? scopeIds().filter(i=>S.hl.has(i)) : scopeIds()).filter(i=>!isNaN(ODD.sc[i])); return base.sort((a,b)=>ODD.sc[b]-ODD.sc[a]).slice(0,15); }
function drawOdd(){
  const ids=oddIds();
  d3.select("#oddNote").html("Tracts in "+(S.hl? "the highlighted group" : scopeName())+" whose profile is furthest from the average profile of <b>their own group</b> (distance on 23 Texas z-scores). "+
    "“Differs most on” is the measure with the largest gap; <span class='dir-up'>▲ worse</span> / <span class='dir-down'>▼ better</span> than the group. Low-confidence tracts (⚠) may look unusual only because their estimates are noisy.");
  const H=d3.select("#oddHead").html("");
  if(ids.length) H.append("button").attr("class","btn").style("margin-bottom","6px").text("Highlight these "+ids.length+" tracts everywhere").on("click",()=>setHL(new Set(ids),"unusual for their group"));
  const L=d3.select("#oddList").html("");
  const hr=L.append("tr"); ["#","Tract","County","Group","Score","Differs most on"].forEach(t=>hr.append("th").text(t));
  ids.forEach((i,k)=>{ const m=ODD.mm[i], up=ODD.dz[i]>0, lc=CORE.some(mm=>lowc(mm,i));
    const tr=L.append("tr").datum(i).attr("class","r").classed("on",i===S.sel).on("mouseenter",e=>setHover(i,e)).on("mousemove",moveTip).on("mouseleave",()=>setHover(null)).on("click",()=>setSel(i));
    tr.append("td").text(k+1); tr.append("td").html("<b>"+TR.tract[i]+"</b> <span class='note'>"+pname(i)+"</span>"+(lc?" ⚠":""));
    tr.append("td").text(cname(i)+(IN_BV[i]?" ★":"")); tr.append("td").html(clPill(CL[i]));
    tr.append("td").text(fmt1(ODD.sc[i]));
    tr.append("td").html(m? "<span class='"+(up?"dir-up":"dir-down")+"'>"+(up?"▲ ":"▼ ")+short(m)+"</span> "+pct(V[m][i])+" <span class='mu'>vs group "+pct(D.cl_raw[m][CL[i]])+"</span>" : "–"); });
  if(!ids.length) L.append("tr").append("td").attr("colspan",6).attr("class","note").text("No tracts in the current highlight.");
  RSTAT.odd={n:ids.length, first:ids[0], scope:S.scope};
}

INITS.similar = initSimilarTab;
