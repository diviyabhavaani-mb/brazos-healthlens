// Brazos HealthLens · core: data decoding, palettes, the shared state store, helpers,
// tooltip, chips, profile drawer, search, KPI strip and tabs.
// All js/*.js files are classic scripts loaded in order; top-level consts are shared.
"use strict";

// ======================= DATA DECODING =======================
// Values are stored as integers (percent × 10, z × 100) to keep the data file small.
const D = window.HL_DATA, TOPO = window.HL_TOPO, SURVEY = window.HL_SURVEY;
const TR = D.tracts, N = TR.gid.length;
const MEAS = D.measures.slice();
MEAS.push({id:"UNTREATED", label:"High BP and not taking BP medicine (est.)", short:"Untreated BP", group:"Derived", good:0, derived:true});
const MID = Object.fromEntries(MEAS.map(m=>[m.id,m]));
const IDS = D.measures.map(m=>m.id);               // 33 PLACES measures
const dec = (a,s)=>Float64Array.from(a, x=> x==null? NaN : x/s);
const V = {}, LO = {}, HI = {};
IDS.forEach(m=>{ V[m]=dec(D.v[m],10); LO[m]=dec(D.lo[m],10); HI[m]=dec(D.hi[m],10); });
V.UNTREATED = dec(D.untreated,10);
const POP = dec(TR.pop,1), ADULTS = dec(TR.adults,1);
const CL = Int8Array.from(D.cl, x=> x==null? -1 : x);
const BURDEN = dec(D.burden,100), DEFICIT = dec(D.deficit,100);
const CTY = D.counties, BVC = new Set(D.bv_cfp);
const HAS = Uint8Array.from({length:N}, (_,i)=> isNaN(V.DIABETES[i])?0:1);
const IN_BV = Uint8Array.from({length:N}, (_,i)=> BVC.has(TR.cfp[i])?1:0);
const ID_TX = d3.range(N).filter(i=>HAS[i]);
const ID_BV = ID_TX.filter(i=>IN_BV[i]);
const GIDX = new Map(TR.gid.map((g,i)=>[g,i]));
const REF = D.ref, CLS = D.clusters, K = D.meta.K;
const p90 = D.meta.p90;
const CORE = D.meta.core, MU = D.meta.mu, SD = D.meta.sd;
const RU_NAMES = D.meta.ru_names;
const fmt1 = d3.format(".1f"), fmt2 = d3.format(".2f"), fmtInt = d3.format(","), fmtS = d3.format("+.1f");

// ======================= PALETTES (colorblind-safe) =======================
const SEQ = d3.schemeYlOrRd[5];                       // ColorBrewer YlOrRd: darker = worse
const UNC = d3.schemePurples[5];                      // CI width: darker = wider (less reliable)
const HL = "#0b63ce";                                 // the single highlight color
const CLCOL = ["#88CCEE","#44AA99","#DDCC77","#CC6677","#882255"];
const CLTXT = ["#111","#111","#111","#111","#fff"];   // Paul Tol muted, ordered light->dark by burden
const RUCOL = ["#1f2933","#6b7785","#a3adb8","#d6dbe1","#eeeeee"];
// bivariate 3x3 (Stevens purple–gold): index [burden][deficit]; darkest = high/high
const BIV = [["#e8e8e8","#cbb8d7","#9972af"],["#e4d9ac","#c8ada0","#976b82"],["#c8b35a","#af8e53","#804d36"]];
const ZDIV = t => d3.interpolateBrBG(0.5 - t/2);      // z>0 (worse) -> brown, z<0 (better) -> teal
const CORRCOL = r => d3.interpolatePuOr(0.5 - r/2);   // r>0 purple, r<0 orange
// requirement colors (survey tab and badges)
const REQ = {
  R1:{name:"Explore where", col:"#015f64", tab:"map"},
  R2:{name:"Compare a tract's full profile", col:"#c2410c", tab:"compare"},
  R3:{name:"Find similar and unusual tracts", col:"#6e2c5e", tab:"similar"},
  R4:{name:"Judge reliability and context", col:"#4a5f80", tab:"map"},
  R5:{name:"Find care gaps", col:"#8a5a00", tab:"gap"},
};
function rqBadge(r){ return '<span class="rqb" style="background:'+REQ[r].col+'" title="'+r+': '+REQ[r].name+'">'+r+'</span>'; }

// ======================= GLOBAL STATE STORE =======================
// One store for everything shared between views. Every mutation goes through a setter that bumps a
// version counter; each registered view remembers the versions it last rendered, so a view on a hidden
// tab catches up with exactly what changed (scope, measure, selection, highlight, options) when shown.
const S = {scope:"bv", measure:"DIABETES", sel:null, hl:null, hlSrc:"", hover:null, tab:"map", filter:null,
           mapMode:"measure", layer:"auto", lowconf:false};
const STORE_V = {scope:1, measure:1, sel:1, hl:1, hover:1, opts:1};
const VIEWS = [];   // {tab, update(ch), seen}
const RSTAT = {};   // render statistics written by each view, read by tests/smoke_test.py
function registerView(tab, update, name){ const v={tab, update, seen:{}, name:name||tab, rendered:false}; VIEWS.push(v); if(tab===S.tab||tab==="*") syncView(v); return v; }
function syncView(v){
  const ch={}; let any=false;
  for(const k in STORE_V){ if(v.seen[k]!==STORE_V[k]){ ch[k]=true; any=true; } }
  if(!any) return;
  v.seen=Object.assign({},STORE_V);
  if(!v.rendered){ ch.all=true; v.rendered=true; }
  try{ v.update(ch); }catch(e){ console.error(e); }
}
function changed(k){
  STORE_V[k]++;
  VIEWS.forEach(v=>{ if(v.tab===S.tab||v.tab==="*") syncView(v); });
  if(k!=="hover"){ updateChips(); updateLinkCaps(); }
}
function scopeIds(){ return S.scope==="bv"? ID_BV : ID_TX; }
function scopeName(){ return S.scope==="bv"? "Brazos Valley" : "Texas"; }
function scopeKey(){ return S.scope==="bv"? "bv" : "tx"; }
function inScope(i){ return S.scope==="tx" || IN_BV[i]; }
// selection: one focus tract. A user click toggles it and opens the profile drawer when not on the Map tab.
function setSel(i, keep){
  S.sel = (i==null || (!keep && S.sel===i))? null : i;
  changed("sel");
  if(S.sel!=null && !keep && S.tab!=="map" && !STORY_ON()) openDrawer();
  if(S.sel==null) closeDrawer();
}
// highlight: a set of tracts (brush, legend cell, group/county/urban–rural filter, search...).
function setHL(set, src, filter){
  S.hl = (set && set.size)? set : null; S.hlSrc = S.hl? src : ""; S.filter = S.hl? (filter||null) : null;
  changed("hl");
}
function filterIds(f){
  if(!f) return [];
  if(f.type==="cluster") return scopeIds().filter(i=>CL[i]===f.key);
  if(f.type==="county")  return ID_TX.filter(i=>TR.cfp[i]===f.key);
  if(f.type==="ru")      return scopeIds().filter(i=>TR.ru[i]===f.key);
  return [];
}
function filterLabel(f){ return f.type==="cluster"? "group: "+CLS[f.key].name : f.type==="county"? CTY[f.key].name+" County" : "urban–rural: "+RU_NAMES[f.key]; }
// group / county / urban–rural filter: highlights that group everywhere; re-evaluated when the scope changes.
function setFilter(type, key){
  if(S.filter && S.filter.type===type && S.filter.key===key){ setHL(null); return; }
  const f={type,key}; const ids=filterIds(f);
  if(type==="county" && S.scope==="bv" && !BVC.has(key)){ S.scope="tx"; syncScopeButtons(); STORE_V.scope++; }
  setHL(new Set(ids), filterLabel(f), f);
}
function setHover(i, e){ if(S.hover!==i){ S.hover=i; changed("hover"); } if(i==null) hideTip(); else showTip(tipTract(i), e); }
function setMeasure(m){ if(S.measure===m) return; S.measure=m; d3.select("#measureSel").property("value",m); changed("measure"); }
function syncScopeButtons(){ d3.selectAll("#scopeSeg button").classed("on",function(){return this.dataset.s===S.scope;}); }
function setScope(s){
  if(S.scope===s) return;
  S.scope=s; syncScopeButtons();
  // a group / urban–rural filter follows the scope (its member set changes); other highlights are kept
  if(S.filter && S.filter.type!=="county"){ const ids=filterIds(S.filter); S.hl = ids.length? new Set(ids) : null; if(!S.hl){ S.filter=null; S.hlSrc=""; } STORE_V.hl++; }
  changed("scope");
}
function STORY_ON(){ const n=document.getElementById("story"); return n && n.style.display==="block"; }

// ======================= HELPERS =======================
function isGood(m){ return !!MID[m].good; }
function pct(v){ return (v==null||isNaN(v))? "–" : fmt1(v)+"%"; }
function ord(n){ n=Math.round(n); const s=["th","st","nd","rd"],v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function cname(i){ return CTY[TR.cfp[i]] ? CTY[TR.cfp[i]].name : "?"; }
function tname(i){ return "Tract "+TR.tract[i]; }
function pname(i){ return TR.place[i] ? TR.place[i].split(", ")[0] : "rural"; }
function tfull(i){ return tname(i)+" · "+(TR.place[i]? TR.place[i].split(", ")[0]+", ": "rural ")+cname(i)+" Co."; }
function ciw(m,i){ return HI[m]? HI[m][i]-LO[m][i] : NaN; }
function lowc(m,i){ return HI[m]? (HI[m][i]-LO[m][i]) > p90[m] : false; }
function worseVal(m,v){ return isGood(m)? -v : v; }   // larger = worse
const _rank = {};
function txPct(m,i){   // percentile among Texas tracts, 100 = worst
  if(!_rank[m]){ const ids = ID_TX.slice().sort((a,b)=>worseVal(m,V[m][a])-worseVal(m,V[m][b])); const r=new Float32Array(N).fill(NaN);
    ids.forEach((id,k)=>r[id]=(k+0.5)/ids.length*100); _rank[m]=r; }
  return _rank[m][i];
}
function quantScale(m, ids, range){
  const vals = ids.map(i=>V[m][i]).filter(v=>!isNaN(v));
  const r = (range||SEQ).slice(); return d3.scaleQuantile().domain(vals).range(isGood(m)? r.reverse(): r);
}
function quantBreaks(sc){ const q=sc.quantiles(), dom=d3.extent(sc.domain()); return [dom[0],...q,dom[1]]; }
function clName(c){ return c<0? "–" : CLS[c].name; }
function clPill(c, full){ return "<span class='clpill' style='background:"+CLCOL[c]+";color:"+CLTXT[c]+"' title='"+clName(c)+"'>"+(full? clName(c) : (c+1))+"</span>"; }
function wmean(m, ids){ let s=0,w=0; ids.forEach(i=>{ const v=V[m][i]; if(!isNaN(v)){ s+=v*ADULTS[i]; w+=ADULTS[i]; } }); return w? s/w : NaN; }
function short(m){ return MID[m].short; }
function measLabel(m){ return MID[m].label; }
// Texas z-score signed so + = worse (care measures flipped); used by peers, groups and outliers
const zc = (m,i)=> (V[m][i]-MU[m])/SD[m]*(isGood(m)?-1:1);
function pearson(X,Y){ const ok=X.map((v,k)=>!isNaN(v)&&!isNaN(Y[k])); const xs=X.filter((v,k)=>ok[k]), ys=Y.filter((v,k)=>ok[k]); const mx=d3.mean(xs), my=d3.mean(ys); let a=0,b=0,c=0; xs.forEach((v,k)=>{ a+=(v-mx)*(ys[k]-my); b+=(v-mx)**2; c+=(ys[k]-my)**2; }); return a/Math.sqrt(b*c); }

// ======================= TOOLTIP =======================
const tip = d3.select("#tooltip");
function showTip(html, e){ tip.html(html).style("display","block"); if(e) moveTip(e); }
function moveTip(e){ if(!e || e.clientX==null) return; const r=tip.node().getBoundingClientRect(); const x=e.clientX+16, y=e.clientY+14;
  tip.style("left",(x+r.width>innerWidth-8? e.clientX-r.width-12: x)+"px").style("top",(y+r.height>innerHeight-8? Math.max(4,e.clientY-r.height-10): y)+"px"); }
function hideTip(){ tip.style("display","none"); }
function measLine(m,i){
  const v=V[m][i]; if(isNaN(v)) return "";
  let h='<div><b>'+short(m)+': '+pct(v)+'</b>';
  if(HI[m]) h+=' <span class="mu">(95% CI '+fmt1(LO[m][i])+'–'+fmt1(HI[m][i])+')</span>';
  const c=CTY[TR.cfp[i]];
  h+='</div><div class="mu">County '+(c? pct(c.m[m]) : "–")+' · Valley '+pct(REF.bv[m])+' · Texas '+pct(REF.tx[m])+' · '+ord(txPct(m,i))+' pct. in Texas'+(isGood(m)?' (100 = lowest)':'')+'</div>';
  if(lowc(m,i)) h+='<div class="warn">⚠ Low confidence: CI among widest 10% in Texas</div>';
  return h;
}
function tipTract(i, extra){
  let h='<div class="tt">'+tname(i)+' · '+cname(i)+' County</div><div class="mu">'+(TR.place[i]||"Rural / unincorporated")+' · '+RU_NAMES[TR.ru[i]]+'</div>';
  if(!HAS[i]) return h+'<div>No PLACES estimate for this tract.</div>';
  h+='<div style="margin-top:3px">Profile group: '+clPill(CL[i],true)+'</div>';
  h+= extra!=null? extra : measLine(S.measure,i);
  h+='<div class="mu" style="margin-top:2px">Population '+fmtInt(POP[i])+' ('+fmtInt(ADULTS[i])+' adults)</div>';
  return h;
}

// ======================= CHIPS / LINK CAPTIONS / PROFILE DRAWER =======================
function hlInScope(){ if(!S.hl) return 0; let n=0; S.hl.forEach(i=>{ if(inScope(i)) n++; }); return n; }
function updateChips(){
  d3.select("#selchip").style("display", S.sel!=null? "inline-flex":"none"); if(S.sel!=null) d3.select("#selname").text(tfull(S.sel));
  d3.select("#hlchip").style("display", S.hl? "inline-flex":"none");
  if(S.hl) d3.select("#hlname").text(S.hl.size+" tract"+(S.hl.size===1?"":"s")); d3.select("#hlsrc").text(S.hl? S.hlSrc : "");
  d3.select("#scopeTag").text(S.scope==="bv"? "Comparing within the Brazos Valley ("+ID_BV.length+" tracts)" : "Comparing across all of Texas ("+fmtInt(ID_TX.length)+" tracts)");
  d3.select("#ruSel").property("value", S.filter && S.filter.type==="ru"? String(S.filter.key) : "");
}
// every main card carries a small "linked" caption stating what it currently shows from the shared state
function linkCapText(){
  const p=[];
  p.push('<span class="lk">🔗 linked</span>');
  p.push('<span>Scope: <b>'+scopeName()+'</b></span>');
  p.push('<span>Focus: <b>'+short(S.measure)+'</b></span>');
  if(S.sel!=null) p.push('<span>Selected: <b>'+tname(S.sel)+'</b>'+(!inScope(S.sel)?' <i>(outside scope)</i>':'')+'</span>');
  if(S.hl){ const n=hlInScope(); p.push('<span class="h">Highlighted: <b>'+S.hl.size+'</b> ('+S.hlSrc+')'+(n<S.hl.size? ' · <b>'+n+'</b> in scope' : '')+'</span>'); }
  return p.join(' · ');
}
function updateLinkCaps(){ const t=linkCapText(); d3.selectAll(".linkcap").html(t); }
d3.select("#selx").on("click", ()=>setSel(null));
d3.select("#hlx").on("click", ()=>setHL(null));
d3.select("#selprof").on("click", ()=>{ if(S.tab==="map") return; openDrawer(); });
function openDrawer(){ if(S.sel==null) return; placeDrawer(); d3.select("#drawer").classed("open",true); drawDrawer(); }
// the drawer starts below the sticky tab/control bar so tabs, scope switch and chips stay usable
function placeDrawer(){ const t=Math.max(0, document.getElementById("bar").getBoundingClientRect().bottom); d3.select("#drawer").style("top",t+"px").style("height",(innerHeight-t)+"px"); }
window.addEventListener("scroll", ()=>{ if(d3.select("#drawer").classed("open")) placeDrawer(); }, {passive:true});
window.addEventListener("resize", ()=>{ if(d3.select("#drawer").classed("open")) placeDrawer(); });
function closeDrawer(){ d3.select("#drawer").classed("open",false); }
d3.select("#drawerX").on("click", closeDrawer);
function drawDrawer(){ if(!d3.select("#drawer").classed("open") || S.sel==null || typeof drawProfile!=="function") return; drawProfile(d3.select("#drawerBody")); }
registerView("*", ch=>{ if(ch.sel||ch.measure||ch.scope||ch.all){ if(S.tab==="map") closeDrawer(); else drawDrawer(); } }, "drawer");

// focus measure selector, scope switch and urban–rural filter (R4)
const msel = d3.select("#measureSel");
d3.groups(MEAS, m=>m.group).forEach(([g,ms])=>{ const og=msel.append("optgroup").attr("label",g); ms.forEach(m=>og.append("option").attr("value",m.id).text(m.label)); });
msel.property("value",S.measure).on("change", e=>setMeasure(e.target.value));
d3.selectAll("#scopeSeg button").on("click", function(){ setScope(this.dataset.s); });
RU_NAMES.slice(0,4).forEach((n,k)=>d3.select("#ruSel").append("option").attr("value",k).text(n));
d3.select("#ruSel").on("change", e=>{ const v=e.target.value; if(v==="") { if(S.filter && S.filter.type==="ru") setHL(null); } else setFilter("ru", +v); });

// ======================= SEARCH (R1: find places by name) =======================
const SEARCH = [];
Object.entries(CTY).forEach(([c,o])=>SEARCH.push({label:o.name+" County", sub:(BVC.has(c)?"Brazos Valley county · ":"")+o.n+" tracts", type:"county", key:c, bv:BVC.has(c)}));
{ const pl = new Map(); ID_TX.forEach(i=>{ if(TR.place[i]) TR.place[i].split(", ").forEach(p=>{ const k=p+"|"+cname(i); if(!pl.has(k)) pl.set(k,{p, c:cname(i), bv:IN_BV[i]}); }); });
  pl.forEach(o=>SEARCH.push({label:o.p, sub:"place · "+o.c+" Co.", type:"place", key:o.p, county:o.c, bv:o.bv})); }
d3.range(N).forEach(i=>SEARCH.push({label:tname(i)+", "+cname(i)+" Co.", sub:(TR.place[i]||"rural"), type:"tract", key:i, bv:IN_BV[i]}));
const sres = d3.select("#searchres"); let sItems=[], sOn=0;
function searchFind(q){ q=q.trim().toLowerCase(); if(!q) return [];
  const sc = d=>{ const l=d.label.toLowerCase(); const s2=(d.sub||"").toLowerCase(); let s = l===q?0: l.startsWith(q)?1: l.includes(q)?2: (d.type==="tract"&&s2.startsWith(q))?3: 9; if(s<9 && d.bv) s-=0.5; if(d.type==="tract") s+=0.2; return s; };
  return SEARCH.map(d=>[sc(d),d]).filter(a=>a[0]<9).sort((a,b)=>a[0]-b[0]).slice(0,14).map(a=>a[1]); }
d3.select("#search").on("input", function(){ sItems=searchFind(this.value); sOn=0; drawSres(); })
  .on("keydown", function(e){ if(e.key==="ArrowDown"){ sOn=Math.min(sOn+1,sItems.length-1); drawSres(); e.preventDefault(); }
    else if(e.key==="ArrowUp"){ sOn=Math.max(sOn-1,0); drawSres(); e.preventDefault(); }
    else if(e.key==="Enter"){ if(sItems[sOn]) runSearch(sItems[sOn]); } else if(e.key==="Escape"){ sres.style("display","none"); } })
  .on("blur", ()=>setTimeout(()=>sres.style("display","none"),180));
function drawSres(){ sres.style("display", sItems.length?"block":"none").selectAll("div").data(sItems).join("div").attr("role","option").classed("on",(d,k)=>k===sOn)
  .html(d=>d.label+"<span>"+d.sub+"</span>").on("mousedown",(e,d)=>runSearch(d)); }
function runSearch(it){
  sres.style("display","none"); d3.select("#search").property("value", it.label);
  let ids;
  if(it.type==="county"){ setFilter("county", it.key); if(window.MAPS && MAPS.main && S.tab==="map") MAPS.main.zoomToIds(filterIds(S.filter||{type:"county",key:it.key}), 0.12); return; }
  else if(it.type==="place") ids = ID_TX.filter(i=>TR.place[i] && TR.place[i].split(", ").includes(it.key) && cname(i)===it.county);
  else { setSel(it.key, true); if(window.MAPS && MAPS.main) MAPS.main.zoomToIds([it.key], 0.25); return; }
  if(ids.length && !ids.every(i=>IN_BV[i]) && S.scope==="bv") setScope("tx");
  setHL(new Set(ids), "search: "+it.label);
  if(window.MAPS && MAPS.main && S.tab==="map") MAPS.main.zoomToIds(ids, 0.12);
}

// ======================= KPI CARDS (follow scope, highlight and focus measure) =======================
const KPIM = ["DIABETES","BPHIGH","OBESITY","DEPRESSION","ACCESS2","CHECKUP","BPMED","UNTREATED"];
function kpiFrame(){
  if(S.hl){ const ids=[...S.hl].filter(i=>HAS[i]); return {mode:"sel", ids, label:"selection", cap:"Highlighted selection ("+ids.length+" tracts, "+S.hlSrc+") vs. Texas", ref:"tx", refLabel:"TX"}; }
  if(S.scope==="bv") return {mode:"bv", ids:ID_BV, label:"valley", cap:"Brazos Valley ("+ID_BV.length+" tracts) vs. Texas · adult-weighted averages", ref:"tx", refLabel:"TX"};
  return {mode:"tx", ids:ID_TX, label:"Texas", cap:"All Texas ("+fmtInt(ID_TX.length)+" tracts) vs. Brazos Valley · adult-weighted averages", ref:"bv", refLabel:"Valley"};
}
function drawKPIs(){
  const F=kpiFrame();
  RSTAT.kpi={mode:F.mode, n:F.ids.length};
  d3.select("#kpiCap").html("<b>Key measures:</b> "+F.cap+(S.hl?' <span class="mu">— clear the selection to return to the scope view</span>':''));
  const main = m=> F.mode==="sel"? wmean(m,F.ids) : F.mode==="bv"? REF.bv[m] : REF.tx[m];
  const ref  = m=> F.ref==="tx"? REF.tx[m] : REF.bv[m];
  const Kc = d3.select("#kpis").selectAll("div.kpi").data(KPIM).join("div").attr("class","kpi").attr("tabindex",0).attr("role","button").classed("focus", m=>m===S.measure)
    .attr("title", m=>F.label+" "+fmt1(main(m))+"% vs. "+F.refLabel+" "+fmt1(ref(m))+"% (adult-weighted averages). "+(isGood(m)?"Higher is better. ":"Higher is worse. ")+"Click to make "+measLabel(m)+" the focus measure in every tab.")
    .on("click",(e,m)=>setMeasure(m)).on("keydown",(e,m)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); setMeasure(m); } });
  Kc.html("");
  Kc.append("div").attr("class","kl").text(m=>short(m)==="Untreated BP"? "High BP, no BP medicine" : MID[m].label.replace(" (adults with high BP)"," (if high BP)"));
  Kc.append("div").attr("class","kv").html(m=>fmt1(main(m))+"% <small>"+F.label+"</small>");
  Kc.append("div").attr("class",m=>{ const d=main(m)-ref(m); const w = isGood(m)? d<0 : d>0; return "kd "+(Math.abs(d)<0.3?"": w?"w":"b"); })
    .html(m=>{ const d=main(m)-ref(m); const w = isGood(m)? d<0 : d>0;
      return F.refLabel+" "+fmt1(ref(m))+"% · "+(Math.abs(d)<0.3? "about the same" : fmt1(Math.abs(d))+" pts "+(w?"worse":"better")); });
  Kc.append("svg").attr("width","100%").attr("height",14).each(function(m){
    const s=d3.select(this), w=this.getBoundingClientRect().width||150;
    const ids=F.ids.filter(i=>!isNaN(V[m][i])), ext=d3.extent(ids,i=>V[m][i]);
    const x=d3.scaleLinear().domain([Math.min(ext[0],REF.tx[m],REF.bv[m]),Math.max(ext[1],REF.tx[m],REF.bv[m])]).range([3,w-3]);
    s.append("title").text("Strip: distribution of "+(F.mode==="sel"?"selected":F.mode==="bv"?"Brazos Valley":"Texas")+" tracts ("+fmt1(ext[0])+"–"+fmt1(ext[1])+"%). Orange = Texas average, teal = valley average.");
    if(ids.length<=400) s.selectAll("line.t").data(ids).join("line").attr("x1",i=>x(V[m][i])).attr("x2",i=>x(V[m][i])).attr("y1",3).attr("y2",11).attr("stroke","#9aa4b0").attr("stroke-opacity",.55);
    else { const bins=d3.bin().domain(x.domain()).thresholds(40)(ids.map(i=>V[m][i])); const hy=d3.scaleLinear().domain([0,d3.max(bins,b=>b.length)]).range([0,10]);
      s.selectAll("rect.b").data(bins).join("rect").attr("x",b=>x(b.x0)).attr("width",b=>Math.max(0.5,x(b.x1)-x(b.x0)-0.5)).attr("y",b=>12-hy(b.length)).attr("height",b=>hy(b.length)).attr("fill","#aab3bd"); }
    s.append("line").attr("x1",x(REF.tx[m])).attr("x2",x(REF.tx[m])).attr("y1",0).attr("y2",14).attr("stroke","#c2410c").attr("stroke-width",2.2);
    s.append("line").attr("x1",x(REF.bv[m])).attr("x2",x(REF.bv[m])).attr("y1",0).attr("y2",14).attr("stroke","#015f64").attr("stroke-width",2.2);
  });
}

// ======================= TABS =======================
// Each tab names the requirement(s) it serves.
const TABS = [["map","Map & profile","R1 R2 R4"],["compare","Compare measures","R2"],["similar","Similar & unusual","R3"],
              ["gap","Care gaps","R5"],["survey","Survey & requirements",""],["about","Methods & data",""]];
d3.select("#tabs").selectAll("button").data(TABS).join("button").attr("role","tab").attr("data-t",d=>d[0])
  .html(d=>d[1]+(d[2]? '<span class="rq">'+d[2].split(" ").join(" · ")+'</span>':'')).on("click",(e,d)=>showTab(d[0]));
const INITS = {}, INITED = {};
function showTab(t){
  S.tab=t; d3.selectAll("#tabs button").classed("on",d=>d[0]===t).attr("aria-selected",d=>d[0]===t);
  d3.selectAll(".tab").classed("on",function(){return this.id==="tab-"+t;});
  hideTip();
  if(!INITED[t] && INITS[t]){ INITED[t]=true; INITS[t](); }
  // lazy catch-up: every view of this tab re-renders for whatever changed while it was hidden
  VIEWS.forEach(v=>{ if(v.tab===t) syncView(v); });
  VIEWS.forEach(v=>{ if(v.tab==="*") syncView(v); });
  updateLinkCaps();
}
