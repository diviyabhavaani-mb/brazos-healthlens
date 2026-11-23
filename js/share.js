// Brazos HealthLens · export, sharing, pinned comparison and accessibility (final version).
// Feedback this answers: export or print a summary (4 respondents), save/share a view with its filters (2),
// compare a few chosen areas side by side (1), high-contrast colors (4), plus the remaining accessibility work
// (keyboard access and text summaries for the canvas maps).
"use strict";
const SITE_NAME = "Brazos HealthLens";
const SOURCE_LINE = ()=> "Source: CDC PLACES "+((D.meta.release||2025)+" release")+" (dataset "+D.meta.dataset+", retrieved "+D.meta.retrieved+"); Census 2020 boundaries; USDA RUCA 2020. Model-based crude estimates with 95% CIs.";
const today = ()=> new Date().toISOString().slice(0,10);

// ---------------- small UI helpers ----------------
function liveSay(t){ const n=document.getElementById("live"); if(!n) return; n.textContent=""; setTimeout(()=>{ n.textContent=t; }, 30); }
function toast(t){ const n=document.createElement("div"); n.className="toast"; n.setAttribute("role","status"); n.textContent=t; document.body.appendChild(n); setTimeout(()=>n.remove(), 2600); }
function download(name, blob){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function toggleExportMenu(open){ const m=d3.select("#exportMenu"); const o=open==null? !m.classed("open") : open; m.classed("open",o); d3.select("#exportBtn").attr("aria-expanded",o);
  if(o){ const b=m.select("button").node(); if(b) b.focus(); } }
d3.select("#exportBtn").on("click", e=>{ e.stopPropagation(); toggleExportMenu(); });
d3.select("#exportMenu").selectAll("button").on("click", function(e){ e.stopPropagation(); toggleExportMenu(false); const x=this.dataset.x;
  if(x==="csv") exportCSV(); else if(x==="print") printSummary(); else if(x==="png") exportPNG(); else copyLink(); });
document.addEventListener("click", ()=>toggleExportMenu(false));
document.addEventListener("keydown", e=>{ if(e.key==="Escape") toggleExportMenu(false);
  if(e.key==="/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){ e.preventDefault(); document.getElementById("search").focus(); } });
d3.select("#linkBtn").on("click", copyLink);
d3.select("#hcToggle").on("change", e=>setPalette(e.target.checked));

// ---------------- which tracts an export covers ----------------
function exportSet(){
  const out=[], seen=new Set(), add=(i,role)=>{ if(i==null||!HAS[i]) return; if(seen.has(i)){ const r=out.find(o=>o.i===i); if(!r.role.includes(role)) r.role+="; "+role; return; } seen.add(i); out.push({i,role}); };
  if(S.sel!=null) add(S.sel,"selected");
  S.pins.forEach(i=>add(i,"pinned"));
  if(S.hl) [...S.hl].sort((a,b)=>worseVal(S.measure,V[S.measure][b])-worseVal(S.measure,V[S.measure][a])).forEach(i=>add(i,"highlighted ("+S.hlSrc+")"));
  if(!out.length) scopeIds().forEach(i=>add(i,"in scope ("+scopeName()+")"));
  return out;
}
function exportCSV(){
  const rows=exportSet(); const ms=MEAS.map(m=>m.id);
  const head=["role","geoid","tract","place","county","urban_rural","profile_group","population","adults_18plus","burden_index_sd","care_deficit_index_sd"];
  ms.forEach(m=>{ head.push(m+"_pct"); if(HI[m]){ head.push(m+"_ci_low"); head.push(m+"_ci_high"); head.push(m+"_low_confidence"); } });
  const q=v=>{ const s=v==null||(typeof v==="number"&&isNaN(v))? "" : String(v); return /[",\n]/.test(s)? '"'+s.replace(/"/g,'""')+'"' : s; };
  const lines=["# "+SITE_NAME+" export "+today()+" · scope: "+scopeName()+" · focus: "+MID[S.measure].label+(S.hl? " · highlight: "+S.hlSrc : ""), "# "+SOURCE_LINE(), head.join(",")];
  rows.forEach(({i,role})=>{ const r=[role, TR.gid[i], TR.tract[i], TR.place[i]||"", cname(i), RU_NAMES[TR.ru[i]], CL[i]>=0? (CL[i]+1)+". "+CLS[CL[i]].name : "", POP[i], ADULTS[i], fmt2(BURDEN[i]), fmt2(DEFICIT[i])];
    ms.forEach(m=>{ r.push(isNaN(V[m][i])? "" : fmt1(V[m][i])); if(HI[m]){ r.push(isNaN(LO[m][i])?"":fmt1(LO[m][i])); r.push(isNaN(HI[m][i])?"":fmt1(HI[m][i])); r.push(lowc(m,i)?"yes":"no"); } });
    lines.push(r.map(q).join(",")); });
  download("brazos-healthlens_"+S.scope+"_"+S.measure.toLowerCase()+"_"+today()+".csv", new Blob(["﻿"+lines.join("\n")],{type:"text/csv;charset=utf-8"}));
  RSTAT.export={csvRows:rows.length}; toast("Downloaded "+rows.length+" tract"+(rows.length===1?"":"s")+" as CSV"); liveSay("CSV with "+rows.length+" tracts downloaded.");
}

// ---------------- printable summary report ----------------
function printSummary(){
  const set=exportSet(); const sel=S.sel!=null && HAS[S.sel]? S.sel : null;
  const esc=t=>String(t).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
  const ref=REF[scopeKey()];
  let h='<!doctype html><html><head><meta charset="utf-8"><title>'+SITE_NAME+' summary '+today()+'</title><style>'+
   'body{font:12.5px/1.45 "Segoe UI",Arial,sans-serif;color:#1f2933;margin:28px 34px}h1{color:#015f64;font-size:20px;margin:0}h2{color:#015f64;font-size:15px;margin:18px 0 5px;border-bottom:2px solid #13807a;padding-bottom:2px}'+
   '.mu{color:#5f6b7a}table{border-collapse:collapse;width:100%;font-size:11.5px}th{background:#0b4f4f;color:#fff;text-align:left;padding:4px 6px}td{padding:3px 6px;border-bottom:1px solid #e3e8ee}'+
   'tr:nth-child(even) td{background:#f3f8f7}.w{color:#b42318;font-weight:650}.box{background:#fbece5;border-radius:6px;padding:8px 10px;margin:8px 0}@media print{a{color:#1f2933}}</style></head><body>';
  h+='<h1>'+SITE_NAME+': summary</h1><div class="mu">Created '+today()+' · CSCE 679 Graduate Team 6 · <a href="'+esc(location.href)+'">open this exact view</a></div>';
  h+='<div class="box"><b>View:</b> comparing within '+scopeName()+' · focus measure: '+esc(MID[S.measure].label)+(S.hl? ' · highlighted: '+S.hl.size+' tracts ('+esc(S.hlSrc)+')':'')+(S.pins.length? ' · pinned: '+S.pins.map(tname).join(", "):'')+'</div>';
  if(sel!=null){ const i=sel;
    h+='<h2>Selected: '+esc(tfull(i))+'</h2><div class="mu">'+esc(RU_NAMES[TR.ru[i]])+' · profile group: '+esc(clName(CL[i]))+' · population '+fmtInt(POP[i])+' ('+fmtInt(ADULTS[i])+' adults)</div>';
    if(typeof gapCuts==="function"){ gapT=gapCuts(); const c=gapClass(i); h+='<div>Care gap: <b>'+["low","middle","high"][c[0]]+' disease burden, '+["low","middle","high"][c[1]]+' care deficit</b> (tertiles of '+scopeName()+')</div>'; }
    h+='<table><tr><th>Measure</th><th>Tract</th><th>95% CI</th><th>'+esc(cname(i))+' Co.</th><th>Valley</th><th>Texas</th><th>Texas pct. (100 = worst)</th></tr>';
    MEAS.forEach(M=>{ const m=M.id, v=V[m][i]; if(isNaN(v)) return; const w=HI[m]? (M.good? HI[m][i]<ref[m] : LO[m][i]>ref[m]) : false; const c=CTY[TR.cfp[i]];
      h+='<tr><td>'+esc(M.label)+'</td><td class="'+(w?'w':'')+'">'+fmt1(v)+'%</td><td>'+(HI[m]? fmt1(LO[m][i])+'–'+fmt1(HI[m][i])+(lowc(m,i)?' ⚠':'') : 'derived')+'</td><td>'+(c?fmt1(c.m[m])+'%':'–')+'</td><td>'+fmt1(REF.bv[m])+'%</td><td>'+fmt1(REF.tx[m])+'%</td><td>'+ord(txPct(m,i))+'</td></tr>'; });
    h+='</table><div class="mu">Red = the whole 95% CI is worse than the '+scopeName()+' average. ⚠ = CI among the widest 10% in Texas for that measure.</div>'; }
  if(S.pins.length>1){ h+='<h2>Pinned tracts</h2><table><tr><th>Measure</th>'+S.pins.map(i=>'<th>'+esc(tname(i))+'<br><span style="font-weight:400">'+esc(pname(i)+", "+cname(i))+'</span></th>').join("")+'<th>Texas</th></tr>';
    PIN_MEAS().forEach(m=>{ h+='<tr><td>'+esc(MID[m].short)+'</td>'+S.pins.map(i=>{ const w=worseVal(m,V[m][i])>worseVal(m,REF.tx[m]); return '<td class="'+(w?'w':'')+'">'+pct(V[m][i])+(HI[m]?' <span class="mu">('+fmt1(LO[m][i])+'–'+fmt1(HI[m][i])+')</span>':'')+'</td>'; }).join("")+'<td>'+fmt1(REF.tx[m])+'%</td></tr>'; });
    h+='</table>'; }
  const list=set.filter(o=>o.i!==sel).slice(0,60);
  if(list.length){ const cols=["DIABETES","BPHIGH","ACCESS2","CHECKUP","BPMED","UNTREATED"]; if(!cols.includes(S.measure)) cols.unshift(S.measure);
    h+='<h2>'+(S.hl? 'Highlighted tracts ('+esc(S.hlSrc)+')' : 'Tracts in '+scopeName())+', worst first by '+esc(short(S.measure))+(set.length>61? ' (first 60 of '+(set.length-(sel!=null?1:0))+')':'')+'</h2>';
    h+='<table><tr><th>#</th><th>Tract</th><th>Place, county</th>'+cols.map(m=>'<th>'+esc(short(m))+'</th>').join("")+'</tr>';
    list.forEach((o,k)=>{ const i=o.i; h+='<tr><td>'+(k+1)+'</td><td>'+esc(TR.tract[i])+'</td><td>'+esc(pname(i)+", "+cname(i))+'</td>'+cols.map(m=>{ const w=worseVal(m,V[m][i])>worseVal(m,REF.tx[m]); return '<td class="'+(w?'w':'')+'">'+fmt1(V[m][i])+(lowc(m,i)?' ⚠':'')+'</td>'; }).join("")+'</tr>'; });
    h+='</table><div class="mu">Red = worse than the Texas average.</div>'; }
  h+='<h2>Read with care</h2><ul><li>Values are CDC PLACES model-based estimates of the share of adults, crude (not age-adjusted). Older, rural tracts look worse on crude rates.</li><li>Small tracts have wide confidence intervals; treat ⚠ estimates as uncertain.</li><li>Tract-level patterns describe places, not individuals.</li></ul><div class="mu">'+esc(SOURCE_LINE())+'</div>';
  h+='<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script></body></html>';
  const w=window.open("", "_blank"); if(!w){ download("brazos-healthlens_summary_"+today()+".html", new Blob([h],{type:"text/html"})); toast("Pop-up blocked: the summary was downloaded as an HTML file"); return; }
  w.document.open(); w.document.write(h); w.document.close(); RSTAT.export={print:true}; liveSay("Printable summary opened in a new tab.");
}

// ---------------- PNG of the main chart on this tab, with caption and source ----------------
const PNG_TARGET = {overview:"#ovFlow", map:"#mainMap", compare:"#pcpWrap", similar:"#peerMap", gap:"#gapMap", survey:"#fbTasks", about:null};
const SVG_STYLE = '.axis text{font:10.5px Segoe UI,Arial,sans-serif;fill:#4a5562}.axis path,.axis line{stroke:#b9c2cd;fill:none}.pcp-axis .title{font:600 11px Segoe UI,Arial;fill:#1f2933}.pcp-axis .sub{font:9.5px Segoe UI,Arial;fill:#5f6b7a}.anno-text{font:600 12px Segoe UI,Arial;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:3.5px}.anno-line{stroke:#111;fill:none}.alab{font:11.5px Segoe UI,Arial;fill:#1f2933}text{font-family:Segoe UI,Arial,sans-serif}.brush .selection{fill:#0b63ce;fill-opacity:.15;stroke:#0b63ce}';
function svgImage(svg){ return new Promise(res=>{ const c=svg.cloneNode(true); const r=svg.getBoundingClientRect(); c.setAttribute("xmlns","http://www.w3.org/2000/svg"); c.setAttribute("width",r.width); c.setAttribute("height",r.height);
  const st=document.createElementNS("http://www.w3.org/2000/svg","style"); st.textContent=SVG_STYLE; c.insertBefore(st,c.firstChild);
  const img=new Image(); img.onload=()=>res(img); img.onerror=()=>res(null); img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(c)); }); }
async function exportPNG(){
  const sel=PNG_TARGET[S.tab]; const el=sel && document.querySelector(sel); if(!el){ toast("This tab has no chart to export"); return; }
  const card=el.closest(".card"); const title=(card && card.querySelector("h2,h3"))? card.querySelector("h2,h3").textContent : SITE_NAME;
  const r=el.getBoundingClientRect(), sc=2, top=64, foot=46, W=Math.round(r.width), H=Math.round(r.height);
  const cv=document.createElement("canvas"); cv.width=W*sc; cv.height=(H+top+foot)*sc; const x=cv.getContext("2d"); x.scale(sc,sc);
  x.fillStyle="#fff"; x.fillRect(0,0,W,H+top+foot);
  x.fillStyle="#015f64"; x.font="700 16px Segoe UI, Arial"; x.fillText(title.slice(0,110), 12, 24);
  x.fillStyle="#1f2933"; x.font="12px Segoe UI, Arial";
  const state="Compare within: "+scopeName()+" · Focus: "+MID[S.measure].label+(S.sel!=null? " · Selected: "+tfull(S.sel) : "")+(S.hl? " · Highlighted: "+S.hl.size+" ("+S.hlSrc+")":"");
  x.fillText(state.slice(0,170), 12, 44);
  x.save(); x.translate(0,top);
  for(const c of el.querySelectorAll("canvas")){ const b=c.getBoundingClientRect(); if(!b.width) continue; x.drawImage(c, b.left-r.left, b.top-r.top, b.width, b.height); }
  const svgs=[...el.querySelectorAll("svg")].concat(el.tagName.toLowerCase()==="svg"? [el] : []);
  for(const s of svgs){ const b=s.getBoundingClientRect(); if(!b.width) continue; const img=await svgImage(s); if(img) x.drawImage(img, b.left-r.left, b.top-r.top, b.width, b.height); }
  // HTML legends (map legends are HTML): redraw their swatches and text
  el.querySelectorAll(".legend").forEach(L=>{ const b=L.getBoundingClientRect(); if(!b.width||getComputedStyle(L).display==="none") return; const ox=b.left-r.left, oy=b.top-r.top;
    x.fillStyle="rgba(255,255,255,.96)"; x.strokeStyle="#d9dee5"; x.fillRect(ox,oy,b.width,b.height); x.strokeRect(ox,oy,b.width,b.height);
    L.querySelectorAll(".lt,.row,.mu").forEach(n=>{ const nb=n.getBoundingClientRect(); const yy=nb.top-r.top+nb.height/2+4; let xx=nb.left-r.left;
      const sw=n.querySelector(".sw"); if(sw){ const sb=sw.getBoundingClientRect(); x.fillStyle=getComputedStyle(sw).backgroundColor; x.fillRect(sb.left-r.left, sb.top-r.top, sb.width, sb.height); x.strokeStyle="#9aa4b0"; x.strokeRect(sb.left-r.left, sb.top-r.top, sb.width, sb.height); xx=sb.right-r.left+5; }
      const ic=n.querySelector("svg"); if(ic && !sw){ const ib=ic.getBoundingClientRect(); xx=ib.right-r.left+5; }
      x.fillStyle=n.classList.contains("mu")? "#5f6b7a" : "#1f2933"; x.font=(n.classList.contains("lt")?"600 ":"")+"11.5px Segoe UI, Arial";
      const txt=n.textContent.trim(); if(txt) x.fillText(txt.slice(0,60), xx, yy); }); });
  for(const L of el.querySelectorAll(".legend svg")){ const b=L.getBoundingClientRect(); const img=await svgImage(L); if(img) x.drawImage(img, b.left-r.left, b.top-r.top, b.width, b.height); }
  x.restore();
  x.fillStyle="#5f6b7a"; x.font="10.5px Segoe UI, Arial"; const src=SOURCE_LINE(); x.fillText(src.slice(0,190), 12, top+H+18); x.fillText(SITE_NAME+" · CSCE 679 Graduate Team 6 · exported "+today()+" · "+location.href.slice(0,120), 12, top+H+34);
  cv.toBlob(b=>{ download("brazos-healthlens_"+S.tab+"_"+today()+".png", b); RSTAT.export={png:S.tab, w:cv.width, h:cv.height}; toast("Saved the "+TABS.find(t=>t[0]===S.tab)[1]+" chart as PNG"); }, "image/png");
}

// ---------------- shareable links: the view lives in the URL hash ----------------
let hashLock=false;
function stateToHash(){
  const p=new URLSearchParams(); p.set("tab",S.tab); if(S.scope!=="bv") p.set("scope",S.scope); p.set("m",S.measure);
  if(S.sel!=null) p.set("sel",TR.gid[S.sel]);
  if(S.filter) p.set("f",S.filter.type+":"+S.filter.key);
  else if(S.hl && S.hl.size<=120 && S.hlSrc!=="parallel coordinates") { p.set("hl",[...S.hl].map(i=>TR.gid[i].slice(2)).join(".")); p.set("hs",S.hlSrc.slice(0,60)); }
  if(typeof pcpBrushes!=="undefined" && pcpBrushes.size) p.set("br",[...pcpBrushes].map(([a,[l,h]])=>a+"~"+fmt1(l)+"~"+fmt1(h)).join("."));
  if(S.mapMode!=="measure") p.set("mode",S.mapMode);
  if(S.pins.length) p.set("pins",S.pins.map(i=>TR.gid[i].slice(2)).join("."));
  if(typeof pcpPresetId!=="undefined" && pcpPresetId!=="core") p.set("axes", pcpPresetId==="custom"? pcpAxes.join(".") : pcpPresetId);
  if(S.hc) p.set("hc","1");
  return "#"+p.toString();
}
function syncHash(){ if(hashLock) return; const h=stateToHash(); if(h!==location.hash) history.replaceState(null,"",h); }
HOOKS.push(k=>{ if(k!=="hover") syncHash(); });
function applyHash(){
  if(!location.hash || location.hash.length<3) return false;
  const p=new URLSearchParams(location.hash.slice(1)); hashLock=true;
  try{
    const g=v=>GIDX.get(v.length===9? "48"+v : v);
    if(p.get("hc")==="1"){ d3.select("#hcToggle").property("checked",true); setPalette(true); }
    if(p.get("scope")==="tx") setScope("tx");
    if(p.get("m") && MID[p.get("m")]) setMeasure(p.get("m"));
    if(p.get("mode")) setMapMode(p.get("mode"));
    if(p.get("axes")) { const a=p.get("axes"); if(typeof setPCPPreset==="function"){ if(PCP_PRESETS[a]) setPCPPreset(a); else setPCPPreset("custom", a.split(".").filter(m=>MID[m])); } }
    if(p.get("pins")) S.pins=p.get("pins").split(".").map(g).filter(i=>i!=null).slice(0,4);
    if(p.get("sel")){ const i=g(p.get("sel")); if(i!=null) setSel(i,true); }
    if(p.get("f")){ const [t,k]=p.get("f").split(":"); setFilter(t, t==="county"? k : +k); }
    else if(p.get("hl")){ const ids=p.get("hl").split(".").map(g).filter(i=>i!=null); if(ids.length) setHL(new Set(ids), p.get("hs")||"shared link"); }
    if(p.get("br") && typeof pcpBrushes!=="undefined"){ p.get("br").split(".").forEach(s=>{ const [a,l,h]=s.split("~"); if(MID[a]) pcpBrushes.set(a,[+l,+h]); }); }
    changed("pins");
    return p.get("tab") || "map";
  } finally { hashLock=false; }
}
function copyLink(){ syncHash(); const url=location.href;
  const ok=()=>{ toast("Link copied: it reopens this tab, measure, selection and highlight"); liveSay("Link copied to the clipboard."); };
  if(navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, ()=>window.prompt("Copy this link:", url)); else window.prompt("Copy this link:", url);
  RSTAT.link=url; }

// ---------------- pinned tracts: compare up to four side by side ----------------
const PIN_MEAS = ()=>{ const base=["DIABETES","BPHIGH","OBESITY","COPD","CHD","DEPRESSION","CSMOKING","LPA","ACCESS2","CHECKUP","BPMED","CHOLSCREEN","UNTREATED","GHLTH"]; return base.includes(S.measure)? base : [S.measure, ...base]; };
function togglePin(i){ if(i==null) return; const k=S.pins.indexOf(i); if(k>=0) S.pins.splice(k,1); else { if(S.pins.length>=4) S.pins.shift(); S.pins.push(i); }
  changed("pins"); liveSay((k>=0? "Unpinned ":"Pinned ")+tname(i)+". "+S.pins.length+" pinned."); }
{ const chip=d3.select("#selchip"); chip.insert("button","#selx").attr("class","pinbtn").attr("id","selpin").attr("title","Pin this tract to compare up to four side by side (Map tab)").text("📌 pin").on("click",()=>togglePin(S.sel)); }
HOOKS.push(k=>{ if(k==="sel"||k==="pins") d3.select("#selpin").classed("on", S.sel!=null && S.pins.includes(S.sel)).text(S.sel!=null && S.pins.includes(S.sel)? "📌 pinned" : "📌 pin"); });
function drawPins(){
  const T=d3.select("#pinTable").html(""); const ps=S.pins.filter(i=>HAS[i]);
  d3.select("#pinNote").html(ps.length? "Up to four tracts, compared on the measures most used in the survey. <b class='w'>Red</b> = worse than Texas; gray = 95% CI; ⚠ = low confidence. Click a column name to select that tract, × to unpin. Pinned tracts are included in CSV and printable exports."
    : "Nothing pinned yet. Select a tract and press <b>📌 pin</b> in the control bar (or in its profile) to compare up to four tracts side by side.");
  RSTAT.pins={n:ps.length};
  if(!ps.length) return;
  const hr=T.append("tr"); hr.append("th").text("Measure");
  ps.forEach(i=>{ const th=hr.append("th"); th.append("a").attr("href","#").text(tname(i)).on("click",e=>{ e.preventDefault(); setSel(i,true); });
    th.append("span").attr("class","ci").text(" "+pname(i)+", "+cname(i)+" ");
    th.append("button").attr("class","chipx").attr("aria-label","Unpin "+tname(i)).text("×").on("click",()=>togglePin(i)); });
  hr.append("th").text("Valley"); hr.append("th").text("Texas");
  PIN_MEAS().forEach(m=>{ const tr=T.append("tr").classed("on", m===S.measure); tr.append("td").html((m===S.measure?"<b>":"")+MID[m].short+(m===S.measure?"</b>":""));
    ps.forEach(i=>{ const v=V[m][i], w=worseVal(m,v)>worseVal(m,REF.tx[m]); const td=tr.append("td"); td.append("span").attr("class",w?"w":null).text(pct(v)+(lowc(m,i)?" ⚠":""));
      if(HI[m]) td.append("div").attr("class","ci").text(fmt1(LO[m][i])+"–"+fmt1(HI[m][i])); });
    tr.append("td").text(pct(REF.bv[m])); tr.append("td").text(pct(REF.tx[m])); });
}

// ---------------- accessibility: keyboard access and text summaries for canvas maps ----------------
// Tab to a map, then arrow keys move through the tracts in scope from worst to best on the map's measure;
// Enter selects; the current tract is announced and shown in the tooltip.
function enableMapKeyboard(mv, orderFn, label){
  const el=mv.el.node(); el.setAttribute("tabindex","0"); el.setAttribute("role","application"); el.setAttribute("aria-roledescription","map");
  const upd=()=>el.setAttribute("aria-label", label()+". Use arrow keys to move between tracts from worst to best, Enter to select, Escape to leave.");
  upd(); HOOKS.push(upd);
  let pos=-1;
  el.addEventListener("keydown", e=>{
    const ids=orderFn(); if(!ids.length) return;
    if(["ArrowRight","ArrowDown","ArrowLeft","ArrowUp","Home","End"].includes(e.key)){ e.preventDefault();
      if(pos<0 || ids[pos]!==S.hover) pos = S.sel!=null? Math.max(0,ids.indexOf(S.sel)) : -1;
      pos = e.key==="Home"? 0 : e.key==="End"? ids.length-1 : Math.max(0, Math.min(ids.length-1, pos + (/Right|Down/.test(e.key)? 1 : -1)));
      const i=ids[pos]; S.hover=i; changed("hover");
      const [sx,sy]=mv.t.apply(TC[i]); const b=el.getBoundingClientRect(); showTip(mv.o.tip? mv.o.tip(i) : tipTract(i), {clientX:b.left+sx, clientY:b.top+sy});
      liveSay((pos+1)+" of "+ids.length+": "+tfull(i)+". "+short(S.measure)+" "+pct(V[S.measure][i])+(HI[S.measure]? ", confidence interval "+fmt1(LO[S.measure][i])+" to "+fmt1(HI[S.measure][i]) : "")+".");
    } else if(e.key==="Enter" && S.hover!=null){ e.preventDefault(); setSel(S.hover,true); liveSay("Selected "+tfull(S.hover)+"."); }
    else if(e.key==="Escape"){ setHover(null); el.blur(); } });
  el.addEventListener("blur", ()=>{ hideTip(); });
}
function orderWorstFirst(m){ return ()=> scopeIds().filter(i=>!isNaN(V[m||S.measure][i])).sort((a,b)=>worseVal(m||S.measure,V[m||S.measure][b])-worseVal(m||S.measure,V[m||S.measure][a])); }
function mapTextSummary(){
  const m=S.measure, ids=orderWorstFirst(m)(); const box=d3.select("#mapSummary div"); if(!ids.length){ box.html(""); return; }
  const v=ids.map(i=>V[m][i]); const nlow=HI[m]? ids.filter(i=>lowc(m,i)).length : 0;
  const li=i=>"<li>"+tfull(i)+": <b>"+pct(V[m][i])+"</b>"+(HI[m]? " (95% CI "+fmt1(LO[m][i])+"–"+fmt1(HI[m][i])+")" : "")+(lowc(m,i)?" ⚠ low confidence":"")+"</li>";
  box.html("<p>"+MID[m].label+" across "+ids.length+" "+scopeName()+" tracts ranges from "+pct(d3.min(v))+" to "+pct(d3.max(v))+"; "+scopeName()+" average "+pct(REF[scopeKey()][m])+", Texas "+pct(REF.tx[m])+". "+(HI[m]? nlow+" tracts are low confidence." : "Derived measure, no confidence intervals.")+"</p>"+
    "<p><b>Five worst:</b></p><ol>"+ids.slice(0,5).map(li).join("")+"</ol><p><b>Five best:</b></p><ol>"+ids.slice(-5).reverse().map(li).join("")+"</ol>");
}
