// Brazos HealthLens · start-up. Runs last, after every view file has registered its INITS entry.
"use strict";
registerView("*", ch=>{ if(ch.all||ch.scope||ch.hl||ch.measure) drawKPIs(); }, "kpi");
drawMethods();
// a small "linked" caption in every main card states what it currently shows from the shared state
document.querySelectorAll(".tab .card").forEach(c=>{ if(c.closest("#tab-about")||c.closest("#tab-survey")||c.classList.contains("reqcard")) return; const h=c.querySelector("h2,h3"); if(!h) return;
  const d=document.createElement("div"); d.className="linkcap"; h.insertAdjacentElement("afterend", d); });
// views are built the first time their tab is shown, so canvases get their real on-screen width
showTab("map");
updateChips(); updateLinkCaps();
window.__ready = true;
window.HL_API = {S, setSel, setHL, setFilter, setScope, setMeasure, showTab, storyGo, setMapMode, GIDX, MAPS, ID_BV, ID_TX, STORY, RSTAT, STORE_V, VIEWS, IN_BV, CL, TR, SURVEY};
