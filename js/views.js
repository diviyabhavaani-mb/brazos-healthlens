// Brazos HealthLens · shared views: geometry, MapView (canvas choropleth), ScatterView (canvas points + SVG axes).
"use strict";
// ======================= GEOMETRY (shared by every canvas map) =======================
const tractsFC = topojson.feature(TOPO, TOPO.objects.tracts);
const countiesFC = topojson.feature(TOPO, TOPO.objects.counties);
const countyMesh = topojson.mesh(TOPO, TOPO.objects.counties, (a,b)=>a!==b);
const stateOutline = topojson.mesh(TOPO, TOPO.objects.counties, (a,b)=>a===b);
// map topojson feature order -> tract index
const FIDX = tractsFC.features.map(f=>GIDX.get(f.id || f.properties.GEOID));
const BASEW = 1000, BASEH = 940;
const projBase = d3.geoConicConformal().parallels([27.5,35]).rotate([100,0]).fitExtent([[8,8],[BASEW-8,BASEH-8]], tractsFC);
const gpath = d3.geoPath(projBase);
const TP = new Array(N), TB = new Array(N), TC = new Array(N);
tractsFC.features.forEach((f,k)=>{ const i=FIDX[k]; const s=gpath(f); TP[i]=new Path2D(s||""); TB[i]=gpath.bounds(f); TC[i]=gpath.centroid(f); });
const CFP = countiesFC.features.map(f=>f.id || f.properties.CO);
const CPATH = countiesFC.features.map(f=>new Path2D(gpath(f)));
const CB = countiesFC.features.map(f=>gpath.bounds(f));
const MESH = new Path2D(gpath(countyMesh)), OUTLINE = new Path2D(gpath(stateOutline));
const BVPATH = new Path2D(gpath(topojson.merge(TOPO, TOPO.objects.counties.geometries.filter(g=>BVC.has(g.id || g.properties.CO)))));
const LABELS = D.labels.map(l=>Object.assign({}, l, {p: projBase([l.lon,l.lat])}));
// spatial grid for picking
const GCELL = 10, GW = Math.ceil(BASEW/GCELL), GH = Math.ceil(BASEH/GCELL);
const GRID = Array.from({length:GW*GH}, ()=>[]);
for(let i=0;i<N;i++){ const b=TB[i]; if(!b || !isFinite(b[0][0])) continue;
  for(let gx=Math.max(0,Math.floor(b[0][0]/GCELL)); gx<=Math.min(GW-1,Math.floor(b[1][0]/GCELL)); gx++)
    for(let gy=Math.max(0,Math.floor(b[0][1]/GCELL)); gy<=Math.min(GH-1,Math.floor(b[1][1]/GCELL)); gy++) GRID[gy*GW+gx].push(i); }
const pickCtx = document.createElement("canvas").getContext("2d");
function pickTract(bx,by){
  const gx=Math.floor(bx/GCELL), gy=Math.floor(by/GCELL); if(gx<0||gy<0||gx>=GW||gy>=GH) return null;
  const c=GRID[gy*GW+gx];
  for(let k=0;k<c.length;k++){ const i=c[k], b=TB[i]; if(bx<b[0][0]||bx>b[1][0]||by<b[0][1]||by>b[1][1]) continue; if(pickCtx.isPointInPath(TP[i],bx,by)) return i; }
  return null;
}
function pickCounty(bx,by){ for(let k=0;k<CPATH.length;k++){ const b=CB[k]; if(bx<b[0][0]||bx>b[1][0]||by<b[0][1]||by>b[1][1]) continue; if(pickCtx.isPointInPath(CPATH[k],bx,by)) return k; } return null; }
function boundsOf(ids){ let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9; ids.forEach(i=>{ const b=TB[i]; if(!b) return; x0=Math.min(x0,b[0][0]); y0=Math.min(y0,b[0][1]); x1=Math.max(x1,b[1][0]); y1=Math.max(y1,b[1][1]); }); return [[x0,y0],[x1,y1]]; }
const BV_BOUNDS = boundsOf(d3.range(N).filter(i=>IN_BV[i]));
const BCS_IDS = ID_BV.filter(i=>TR.cfp[i]==="041" && /Bryan|College Station/.test(TR.place[i]) && TB[i][1][0]-TB[i][0][0] < 4);
const hatchCanvas = (()=>{ const c=document.createElement("canvas"); c.width=c.height=8; const x=c.getContext("2d"); x.strokeStyle="rgba(20,20,20,.75)"; x.lineWidth=1.3;
  x.beginPath(); x.moveTo(-2,10); x.lineTo(10,-2); x.moveTo(-2,2); x.lineTo(2,-2); x.moveTo(6,10); x.lineTo(10,6); x.stroke(); return c; })();

// ======================= MapView =======================
class MapView {
  constructor(el, o){
    this.el = d3.select(el); this.o = Object.assign({height:560, countyK:2.2, labels:true, categorical:false, focus:"bv"}, o);
    this.w = el.clientWidth || 800; this.h = this.o.height; this.dpr = window.devicePixelRatio||1;
    this.el.style("height", this.h+"px");
    this.c0 = this.el.append("canvas").node(); this.c1 = this.el.append("canvas").node();
    [this.c0,this.c1].forEach(c=>{ c.width=this.w*this.dpr; c.height=this.h*this.dpr; c.style.width=this.w+"px"; c.style.height=this.h+"px"; });
    this.c1.style.pointerEvents="none";
    this.svg = this.el.append("svg").attr("class","anno").attr("width",this.w).attr("height",this.h);
    this.x0 = this.c0.getContext("2d"); this.x1 = this.c1.getContext("2d");
    this.t = d3.zoomIdentity; this.anno = []; this.hoverC = null;
    this.pat = this.x0.createPattern(hatchCanvas,"repeat");
    const btns = this.el.append("div").attr("class","mapbtns").style("display", this.o.mini? "none": null);
    (this.o.buttons||[["Brazos Valley","bv"],["Bryan–College Station","bcs"],["All Texas","tx"]]).forEach(([l,k])=>
      btns.append("button").attr("class","btn").text(l).on("click",()=>this.zoomTo(k)));
    this.legend = this.el.append("div").attr("class","legend");
    if(!this.o.mini) this.el.append("div").attr("class","zoomhint").text("Scroll to zoom · drag to pan");
    this.zoom = d3.zoom().scaleExtent([0.8, 600]).on("zoom", e=>{ this.t=e.transform; this.schedule(); if(this.o.onZoom && e.sourceEvent) this.o.onZoom(e.transform, this); });
    d3.select(this.c0).call(this.zoom).on("dblclick.zoom", null);
    d3.select(this.c0).on("mousemove", e=>this.onMove(e)).on("mouseleave", ()=>{ this.hoverC=null; setHover(null); this.drawTop(); })
      .on("click", e=>{ const i=this.pickAt(e); if(i!=null && HAS[i]) (this.o.onClick||setSel)(i); });
    this.framed = null;
    this.zoomTo(this.o.focus==="scope"? scopeKey() : this.o.focus, 0); if(this.o.focus==="scope") this.framed=S.scope;
  }
  // frame the map to the current comparison scope (Brazos Valley or all Texas)
  frameScope(dur){ this.framed=S.scope; this.zoomTo(scopeKey(), dur==null? 600 : dur); }
  pickAt(e){ const [mx,my]=d3.pointer(e,this.c0); const [bx,by]=this.t.invert([mx,my]); return this.countyMode()? null : pickTract(bx,by); }
  onMove(e){
    const [mx,my]=d3.pointer(e,this.c0); const [bx,by]=this.t.invert([mx,my]);
    if(this.countyMode()){ const k=pickCounty(bx,by); this.hoverC=k; if(S.hover!=null){ S.hover=null; changed("hover"); }
      if(k!=null) showTip(this.o.countyTip? this.o.countyTip(CFP[k]) : countyTip(CFP[k]), e); else hideTip(); this.drawTop(); return; }
    this.hoverC=null; const i=pickTract(bx,by);
    if(i==null){ setHover(null); return; }
    if(S.hover!==i){ S.hover=i; changed("hover"); }
    showTip(this.o.tip? this.o.tip(i) : tipTract(i), e);
  }
  countyMode(){ if(!this.o.countyColor) return false; const L=this.o.layer? this.o.layer(): "auto"; const hl = this.o.hlSet? this.o.hlSet() : S.hl;
    return L==="county" || (L==="auto" && this.t.k < this.o.countyK && !hl); }   // a highlighted set forces tracts so it stays visible
  zoomTo(k, dur){ let b; if(k==="tx") b=[[0,0],[BASEW,BASEH]]; else if(k==="bcs") b=boundsOf(BCS_IDS); else if(k==="bv") b=BV_BOUNDS; else b=k;
    this.zoomToBounds(b, 0.06, dur); }
  zoomToIds(ids, pad, maxK){ if(!ids.length) return; this.zoomToBounds(boundsOf(ids), pad==null? .1: pad, 650, maxK); }
  zoomToBounds(b, pad, dur, maxK){ const [[x0,y0],[x1,y1]]=b; const bw=Math.max(x1-x0,0.6), bh=Math.max(y1-y0,0.6);
    let k = Math.min(this.w/(bw*(1+2*pad)), this.h/(bh*(1+2*pad))); if(maxK) k=Math.min(k,maxK);
    const t = d3.zoomIdentity.translate(this.w/2,this.h/2).scale(k).translate(-(x0+x1)/2,-(y0+y1)/2);
    if(dur===0) d3.select(this.c0).call(this.zoom.transform, t); else d3.select(this.c0).transition().duration(dur||650).call(this.zoom.transform, t); }
  schedule(){ if(this._raf) return; this._raf=requestAnimationFrame(()=>{ this._raf=null; this.draw(); }); }
  viewBox(){ const t=this.t; return [-t.x/t.k, -t.y/t.k, (this.w-t.x)/t.k, (this.h-t.y)/t.k]; }
  draw(){
    const x=this.x0, t=this.t, d=this.dpr, o=this.o, vb=this.viewBox();
    x.setTransform(d,0,0,d,0,0); x.fillStyle="#e9eef3"; x.fillRect(0,0,this.w,this.h);
    x.setTransform(d*t.k,0,0,d*t.k,d*t.x,d*t.y);
    x.fillStyle="#fff"; x.fill(CPATH_ALL());
    const hl = o.hlSet? o.hlSet() : S.hl;
    if(this.countyMode()){
      CPATH.forEach((p,k)=>{ x.fillStyle=o.countyColor(CFP[k])||"#f2f2f2"; x.fill(p); });
    } else {
      const lc = o.hatch; const fade = !o.noFade && S.scope==="bv";
      for(let i=0;i<N;i++){ const b=TB[i]; if(!b || b[1][0]<vb[0]||b[0][0]>vb[2]||b[1][1]<vb[1]||b[0][1]>vb[3]) continue;
        const c = HAS[i]? o.color(i) : null;
        x.globalAlpha = (hl && !hl.has(i))? 0.28 : (fade && !IN_BV[i]? (o.fadeAlpha||0.42) : 1);
        x.fillStyle = c || "#d5d9de"; x.fill(TP[i]); }
      x.globalAlpha=1;
      if(t.k>5){ x.strokeStyle="rgba(255,255,255,.85)"; x.lineWidth=Math.min(0.9, 0.12*t.k)/t.k;
        for(let i=0;i<N;i++){ const b=TB[i]; if(!b || b[1][0]<vb[0]||b[0][0]>vb[2]||b[1][1]<vb[1]||b[0][1]>vb[3]) continue; x.stroke(TP[i]); } }
      if(lc){ this.pat.setTransform(new DOMMatrix().scale(1/t.k)); x.fillStyle=this.pat;
        for(let i=0;i<N;i++){ const b=TB[i]; if(!b || !HAS[i] || b[1][0]<vb[0]||b[0][0]>vb[2]||b[1][1]<vb[1]||b[0][1]>vb[3]) continue; if(lc(i)) x.fill(TP[i]); } }
    }
    x.strokeStyle="#59636f"; x.lineWidth=(t.k<3? 0.45: 1.1)/t.k; x.stroke(MESH);
    x.strokeStyle="#2f3740"; x.lineWidth=1.3/t.k; x.stroke(OUTLINE);
    if(t.k<14){ x.strokeStyle="#015f64"; x.lineWidth=2/t.k; x.setLineDash([5/t.k,3/t.k]); x.stroke(BVPATH); x.setLineDash([]); }
    if(o.name){ RSTAT.maps=RSTAT.maps||{}; RSTAT.maps[o.name]={k:+t.k.toFixed(2), framed:this.framed, county:this.countyMode(), hl: hl? hl.size : 0, sel:S.sel}; }
    this.drawTop();
  }
  drawTop(){
    this.legend.style("display", this.legend.node().childNodes.length? null : "none");
    const x=this.x1, t=this.t, d=this.dpr, o=this.o;
    x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,this.w,this.h);
    x.setTransform(d*t.k,0,0,d*t.k,d*t.x,d*t.y);
    const hl = o.hlSet? o.hlSet() : S.hl;
    if(hl && !this.countyMode()){ x.strokeStyle=HL; x.lineWidth=Math.max(1.3, Math.min(2.2, 0.25*t.k))/t.k; hl.forEach(i=>{ if(TP[i]) x.stroke(TP[i]); }); }
    // at state zoom small highlighted tracts are sub-pixel: add centroid dots so a brushed set is visible anywhere in Texas
    if(hl && !this.countyMode() && t.k<6 && hl.size<=400 && !o.markSet){ x.fillStyle=HL; hl.forEach(i=>{ if(!TC[i]) return; const b=TB[i]; if((b[1][0]-b[0][0])*t.k>6) return; x.beginPath(); x.arc(TC[i][0],TC[i][1],3.6/t.k,0,7); x.fill(); x.strokeStyle="#fff"; x.lineWidth=0.8/t.k; x.stroke(); }); }
    const mk = o.markSet? o.markSet() : null;
    if(mk){ mk.forEach(i=>{ const [cx,cy]=TC[i]; x.beginPath(); x.arc(cx,cy,5/t.k,0,7); x.fillStyle=o.markColor||HL; x.globalAlpha=.85; x.fill(); x.globalAlpha=1; x.strokeStyle="#fff"; x.lineWidth=1.2/t.k; x.stroke(); }); }
    if(this.hoverC!=null){ x.strokeStyle="#111"; x.lineWidth=2/t.k; x.stroke(CPATH[this.hoverC]); }
    if(S.hover!=null && TP[S.hover]){ x.strokeStyle="#111"; x.lineWidth=1.8/t.k; x.stroke(TP[S.hover]); }
    const sel = o.selSet? o.selSet() : (S.sel!=null? [S.sel]: []);
    sel.forEach(i=>{ x.strokeStyle="#000"; x.lineWidth=3.4/t.k; x.stroke(TP[i]); x.strokeStyle="#fff"; x.lineWidth=1.2/t.k; x.stroke(TP[i]);
      if(t.k<20){ const [cx,cy]=TC[i]; x.beginPath(); x.arc(cx,cy,7/t.k,0,7); x.strokeStyle="#000"; x.lineWidth=2.4/t.k; x.stroke(); } });
    // labels in screen space
    x.setTransform(d,0,0,d,0,0);
    if(o.labels){
      const bvZoom = t.k>=3;
      x.textBaseline="middle"; x.lineJoin="round";
      const BIG=["Houston","Dallas","San Antonio","Austin","Bryan","College Station"]; const placed=[];
      const cand = LABELS.filter(l=>{ if(bvZoom) return l.bv && (t.k>9 || ["Bryan","College Station","Brenham","Navasota","Hearne","Madisonville","Centerville","Caldwell","Franklin","Buffalo"].includes(l.name)) && !(t.k>60 && !["Bryan","College Station"].includes(l.name));
          return l.tx && l.name!=="College Station"; }).sort((a,b)=>(BIG.includes(b.name)?1:0)-(BIG.includes(a.name)?1:0));
      cand.forEach(l=>{ const [sx,sy]=t.apply(l.p); if(sx<-50||sy<-10||sx>this.w+50||sy>this.h+10) return;
        const big = BIG.includes(l.name); const txt = (!bvZoom && l.name==="Bryan")? "Bryan–College Station" : l.name;
        x.font=(big?"600 13px":"12px")+" Segoe UI, Roboto, Arial"; const tw=x.measureText(txt).width;
        let rx=sx+5, anchor="start"; let r=[rx-2, sy-14, rx+tw+2, sy+1];
        const hit = q=>placed.some(p=>!(q[2]<p[0]||q[0]>p[2]||q[3]<p[1]||q[1]>p[3]));
        if(hit(r)){ rx=sx-5; r=[rx-tw-2, sy-14, rx+2, sy+1]; anchor="end"; if(hit(r)) return; }
        placed.push(r); x.fillStyle="#1f2933"; x.beginPath(); x.arc(sx,sy,2.4,0,7); x.fill();
        x.textAlign=anchor==="end"?"right":"left"; x.strokeStyle="rgba(255,255,255,.95)"; x.lineWidth=3.2; x.strokeText(txt, rx, sy-6); x.fillText(txt, rx, sy-6); x.textAlign="left"; });
    }
    this.drawAnno();
  }
  setAnno(a){ this.anno=a||[]; this.drawAnno(); }
  drawAnno(){
    const t=this.t; const g=this.svg.selectAll("g.a").data(this.anno).join(en=>{ const g=en.append("g").attr("class","a"); g.append("path").attr("class","anno-line"); g.append("circle").attr("r",4).attr("fill","none").attr("stroke","#111").attr("stroke-width",1.6); g.append("text").attr("class","anno-text"); return g; });
    g.each(function(a){ const p = a.i!=null? TC[a.i] : projBase([a.lon,a.lat]); const [sx,sy]=t.apply(p); const tx=sx+(a.dx||40), ty=sy+(a.dy||-40);
      const s=d3.select(this); s.select("circle").attr("cx",sx).attr("cy",sy);
      s.select("path").attr("d","M"+sx+","+sy+"L"+tx+","+ty);
      const tt=s.select("text").attr("x",tx+(a.dx<0?-4:4)).attr("y",ty).attr("text-anchor",a.dx<0?"end":"start");
      tt.selectAll("tspan").data(a.text.split("\n")).join("tspan").attr("x",tx+(a.dx<0?-4:4)).attr("dy",(d,k)=>k? "1.15em":"0.3em").text(d=>d); });
  }
}
let _cpAll=null; function CPATH_ALL(){ if(!_cpAll){ _cpAll=new Path2D(); CPATH.forEach(p=>_cpAll.addPath(p)); } return _cpAll; }
function countyTip(cfp, mm){ const c=CTY[cfp]; if(!c) return ""; const m=mm||S.measure;
  return '<div class="tt">'+c.name+' County'+(BVC.has(cfp)?' <span class="pill">Brazos Valley</span>':'')+'</div><div><b>'+short(m)+': '+pct(c.m[m])+'</b> <span class="mu">(adult-weighted mean of '+c.n+' tracts)</span></div>'+
   '<div class="mu">Texas '+pct(REF.tx[m])+' · Valley '+pct(REF.bv[m])+'</div><div class="mu">Population '+fmtInt(c.pop)+'. Zoom in to see tracts.</div>'; }
function legendQuant(L, sc, m, title, note){
  L.html(""); L.append("div").attr("class","lt").text(title);
  const br=quantBreaks(sc); let rows=sc.range().map((c,k)=>({c,a:br[k],b:br[k+1]}));
  if(isGood(m)) rows=rows.slice().reverse();
  rows.forEach(r=>{ const row=L.append("div").attr("class","row"); row.append("span").attr("class","sw").style("background",r.c); row.append("span").text(fmt1(r.a)+" – "+fmt1(r.b)+"%"); });
  L.append("div").attr("class","mu").text(note||"");
}

// ======================= ScatterView (canvas points + SVG axes, brush, hover, regression) =======================
class ScatterView {
  constructor(el, o){
    this.o = Object.assign({height:420, m:{l:52,r:16,t:14,b:44}}, o);
    this.root = d3.select(el).style("position","relative");
    this.w = el.clientWidth || 600; this.h = this.o.height; this.dpr = devicePixelRatio||1;
    this.root.style("height", this.h+"px");
    this.c = this.root.append("canvas").node(); this.c.width=this.w*this.dpr; this.c.height=this.h*this.dpr;
    Object.assign(this.c.style,{width:this.w+"px",height:this.h+"px",position:"absolute",left:0,top:0});
    this.svg = this.root.append("svg").attr("width",this.w).attr("height",this.h).style("position","absolute").style("left",0).style("top",0);
    this.gAx = this.svg.append("g"); this.gFit = this.svg.append("g"); this.gTop = this.svg.append("g").style("pointer-events","none");
    this.gBrush = this.svg.append("g").attr("class","brush");
    this.ctx = this.c.getContext("2d"); this.spec=null;
    const m=this.o.m;
    this.brush = d3.brush().extent([[m.l,m.t],[this.w-m.r,this.h-m.b]]).on("end", e=>this.onBrush(e));
    this.gBrush.call(this.brush);
    this.svg.on("mousemove", e=>this.onMove(e)).on("mouseleave", ()=>{ setHover(null); });
  }
  set(spec){ this.spec=spec; this.render(); }
  render(){
    const sp=this.spec; if(!sp) return; const m=this.o.m, w=this.w, h=this.h;
    const ids = sp.ids.filter(i=>!isNaN(sp.x(i)) && !isNaN(sp.y(i)));
    this.ids = ids;
    const domIds = sp.domainIds || ids;
    const xd = sp.xDomain || d3.extent(domIds, sp.x), yd = sp.yDomain || d3.extent(domIds, sp.y);
    const xs = (sp.xLog? d3.scaleLog(): d3.scaleLinear()).domain(xd).range([m.l, w-m.r]); const ys = d3.scaleLinear().domain(yd).range([h-m.b, m.t]);
    if(!sp.xDomain) xs.nice(); if(!sp.yDomain) ys.nice();
    this.xs=xs; this.ys=ys;
    this.gAx.selectAll("*").remove();
    this.gAx.append("g").attr("class","axis").attr("transform","translate(0,"+(h-m.b)+")").call(sp.xLog? d3.axisBottom(xs).tickValues([100,200,500,1000,2000,5000,10000,20000].filter(v=>v>=xs.domain()[0]&&v<=xs.domain()[1])).tickFormat(d3.format("~s")) : d3.axisBottom(xs).ticks(8).tickFormat(sp.xfmt||null));
    this.gAx.append("g").attr("class","axis").attr("transform","translate("+m.l+",0)").call(d3.axisLeft(ys).ticks(7).tickFormat(sp.yfmt||null));
    this.gAx.append("g").attr("class","grid").selectAll("line").data(ys.ticks(7)).join("line").attr("x1",m.l).attr("x2",w-m.r).attr("y1",d=>ys(d)).attr("y2",d=>ys(d)).attr("stroke","#eef1f4");
    this.gAx.append("text").attr("class","alab").attr("x",w-m.r).attr("y",h-8).attr("text-anchor","end").text(sp.xLabel);
    this.gAx.append("text").attr("class","alab").attr("transform","rotate(-90)").attr("x",-m.t).attr("y",13).attr("text-anchor","end").text(sp.yLabel);
    // canvas points
    const x=this.ctx, d=this.dpr; x.setTransform(d,0,0,d,0,0); x.clearRect(0,0,w,h);
    if(sp.bgIds){ x.fillStyle="rgba(150,158,168,.18)"; sp.bgIds.forEach(i=>{ const a=sp.x(i), b=sp.y(i); if(isNaN(a)||isNaN(b)) return; x.fillRect(xs(a)-1.2, ys(b)-1.2, 2.4, 2.4); }); }
    const hl = S.hl; const many = ids.length>1500;
    const alpha = sp.alpha!=null? sp.alpha : (many? 0.45 : 0.85);
    const rad = i=> sp.r? sp.r(i) : (many? 2: 4.5);
    const order = hl? ids.filter(i=>!hl.has(i)).concat(ids.filter(i=>hl.has(i))) : ids;
    order.forEach(i=>{ const px=xs(sp.x(i)), py=ys(sp.y(i)); const dim = hl && !hl.has(i);
      x.globalAlpha = dim? 0.12 : alpha; x.fillStyle = sp.color? sp.color(i) : "#5f6b7a";
      x.beginPath(); x.arc(px,py,rad(i),0,7); x.fill();
      if(!many || (hl && !dim)){ x.globalAlpha = dim? .15 : .9; x.lineWidth = (hl&&!dim)? 1.6: .6; x.strokeStyle=(hl&&!dim)? HL : "#fff"; x.stroke(); } });
    x.globalAlpha=1;
    // quadtree for hover
    this.qt = d3.quadtree().x(i=>xs(sp.x(i))).y(i=>ys(sp.y(i))).addAll(ids);
    // regression
    this.gFit.selectAll("*").remove(); this.stats=null;
    if(sp.fit && ids.length>3){
      const X=ids.map(sp.x), Y=ids.map(sp.y), mx=d3.mean(X), my=d3.mean(Y);
      let sxy=0,sxx=0,syy=0; X.forEach((a,k)=>{ sxy+=(a-mx)*(Y[k]-my); sxx+=(a-mx)**2; syy+=(Y[k]-my)**2; });
      const b=sxy/sxx, a0=my-b*mx, r=sxy/Math.sqrt(sxx*syy); this.stats={r,b,a:a0,n:ids.length};
      const [x0,x1]=xs.domain();
      this.gFit.append("line").attr("x1",xs(x0)).attr("x2",xs(x1)).attr("y1",ys(a0+b*x0)).attr("y2",ys(a0+b*x1)).attr("stroke","#111").attr("stroke-width",2).attr("stroke-dasharray","6 3")
        .attr("clip-path",null);
      const box=this.gFit.append("g").attr("transform","translate("+(m.l+10)+","+(m.t+6)+")");
      box.append("rect").attr("width",250).attr("height",38).attr("rx",4).attr("fill","rgba(255,255,255,.92)").attr("stroke","#ccd3db");
      box.append("text").attr("x",8).attr("y",16).attr("font-size",13).attr("font-weight",650).text("r = "+fmt2(r)+"   r² = "+fmt2(r*r)+"   n = "+fmtInt(ids.length));
      box.append("text").attr("x",8).attr("y",31).attr("font-size",11).attr("fill","#5f6b7a").text("slope: +1 pt X → "+(b>=0?"+":"")+fmt2(b)+" pts Y ("+scopeName()+" tracts)");
      // clip line to plot area
      this.svg.selectAll("defs").remove(); const cid="clip"+Math.random().toString(36).slice(2,8);
      this.svg.insert("defs",":first-child").append("clipPath").attr("id",cid).append("rect").attr("x",m.l).attr("y",m.t).attr("width",w-m.l-m.r).attr("height",h-m.t-m.b);
      this.gFit.select("line").attr("clip-path","url(#"+cid+")");
    }
    if(sp.extra) sp.extra(this);
    RSTAT.sc=RSTAT.sc||{}; RSTAT.sc[this.o.name]={n:ids.length, hl: hl? ids.filter(i=>hl.has(i)).length : 0};
    this.drawTop();
  }
  drawTop(){
    const g=this.gTop; g.selectAll("*").remove(); if(!this.spec) return; const sp=this.spec;
    const mark=(i,cls)=>{ if(i==null || !this.ids || this.ids.indexOf(i)<0) return; const px=this.xs(sp.x(i)), py=this.ys(sp.y(i));
      if(cls==="sel"){ g.append("circle").attr("cx",px).attr("cy",py).attr("r",9).attr("fill","none").attr("stroke","#000").attr("stroke-width",2.6);
        g.append("text").attr("x",px+11).attr("y",py-8).attr("class","anno-text").attr("font-size",11).text(tname(i)+" · "+pname(i)); }
      else g.append("circle").attr("cx",px).attr("cy",py).attr("r",7).attr("fill","none").attr("stroke","#111").attr("stroke-width",1.6); };
    if(this.spec.selSet) this.spec.selSet().forEach(i=>mark(i,"sel")); else mark(S.sel,"sel");
    mark(S.hover,"hover");
  }
  onMove(e){ if(!this.qt) return; const [mx,my]=d3.pointer(e,this.svg.node()); const i=this.qt.find(mx,my,10);
    if(i==null){ if(S.hover!=null) setHover(null); return; } setHover(i,e); if(this.spec.tip) showTip(this.spec.tip(i),e); }
  onBrush(e){
    if(!e.sourceEvent) return;
    if(!e.selection){ // a click
      const [mx,my]=d3.pointer(e.sourceEvent,this.svg.node()); const i=this.qt? this.qt.find(mx,my,10): null;
      if(i!=null) (this.spec.onClick||setSel)(i); else if(S.hl && S.hlSrc===this.o.name) setHL(null);
      return; }
    const [[x0,y0],[x1,y1]]=e.selection;
    const sel=this.ids.filter(i=>{ const px=this.xs(this.spec.x(i)), py=this.ys(this.spec.y(i)); return px>=x0&&px<=x1&&py>=y0&&py<=y1; });
    this.gBrush.call(this.brush.move, null);
    setHL(new Set(sel), this.o.name+" brush");
  }
}

const MAPS = {}; window.MAPS = MAPS;
