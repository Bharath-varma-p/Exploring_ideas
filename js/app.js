// app.js — boot, router, sidebar, command palette, theme, progress ring.
import { loadData, State, lane, lessonsIn, lesson, search, Progress } from "./data.js";
import { reRenderMermaidTheme } from "./render.js";
import { h } from "./render.js";
import * as Views from "./views.js";

const view = () => document.getElementById("view");
const SIDEBAR_COLLAPSE_KEY = "ada.sidebar.collapsed-lanes.v1";
let collapsedLanes = readCollapsedLanes();

function readCollapsedLanes() {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDEBAR_COLLAPSE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeCollapsedLanes(next) {
  try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(next)); } catch {}
}

function setLaneCollapsed(laneId, collapsed, laneTitle = laneId, persist = true) {
  if (collapsed) collapsedLanes[laneId] = true;
  else delete collapsedLanes[laneId];
  if (persist) writeCollapsedLanes(collapsedLanes);

  const group = document.querySelector(`.side-group[data-lane="${laneId}"]`);
  if (!group) return;
  group.classList.toggle("is-collapsed", collapsed);
  const toggle = group.querySelector(".side-collapse");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${laneTitle} lessons`);
    toggle.title = collapsed ? "Expand lessons" : "Collapse lessons";
  }
}

function toggleLaneCollapsed(laneId, laneTitle = laneId) {
  setLaneCollapsed(laneId, !collapsedLanes[laneId], laneTitle);
}

function ensureRouteLaneVisible(parts) {
  const [a, b] = parts;
  const laneId = a === "lane" ? b : (a === "lesson" ? lesson(b)?.lane : null);
  if (!laneId || !collapsedLanes[laneId]) return;
  setLaneCollapsed(laneId, false, lane(laneId)?.title || laneId);
}

// ---------------- Router ----------------
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  return { parts, raw };
}

function route() {
  const { parts } = parseHash();
  const [a, b] = parts;
  let node;
  try {
    switch (a) {
      case undefined: case "": case "home": node = Views.renderHome(); break;
      case "lane": node = Views.renderLane(b); break;
      case "lesson": node = Views.renderLesson(b); break;
      case "teardowns": node = Views.renderTeardowns(); break;
      case "glossary": node = Views.renderGlossary(); break;
      case "index": node = Views.renderIndex(); break;
      case "changes": node = Views.renderChangeCatalog(); break;
      case "quiz": node = b ? Views.renderQuiz(b) : Views.renderQuizHub(); break;
      case "flashcards": node = Views.renderFlashcards(b || "all"); break;
      case "about": node = Views.renderAbout(); break;
      case "framework": {
        const bp = lesson("blueprint-cursor-context-agent");
        node = bp ? Views.renderLesson(bp.id) : Views.renderLane("framework"); break;
      }
      default: node = Views.renderLane(a) ? Views.renderLane(a) : Views.renderHome();
    }
  } catch (e) {
    console.error(e);
    node = h("div", { class: "view" }, h("div", { class: "empty" }, h("h1", {}, "Something broke"), h("pre", {}, String(e && e.stack || e))));
  }
  const v = view();
  v.innerHTML = "";
  v.append(node);
  v.classList.remove("fade-in"); void v.offsetWidth; v.classList.add("fade-in");
  window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  highlightNav();
  closeDrawer();
}

function highlightNav() {
  const { raw, parts } = parseHash();
  ensureRouteLaneVisible(parts);
  document.querySelectorAll(".side-link").forEach((el) => {
    const target = el.getAttribute("data-route");
    el.classList.toggle("active", target === raw || (target && raw.startsWith(target)));
  });
}

// ---------------- Sidebar ----------------
function buildSidebar() {
  collapsedLanes = readCollapsedLanes();
  const nav = document.getElementById("sidenav");
  nav.innerHTML = "";
  nav.append(sideItem("🏠", "Home", ""));
  // lanes with nested lessons
  for (const l of State.lanes) {
    const isCollapsed = !!collapsedLanes[l.id];
    const group = h("div", { class: "side-group" + (isCollapsed ? " is-collapsed" : ""), dataset: { lane: l.id } });
    const row = h("div", { class: "side-lane-row" });
    const head = h("a", { class: "side-link side-lane", href: `#/lane/${l.id}`, dataset: { route: `lane/${l.id}` } },
      h("span", { class: "side-ico" }, l.icon), h("span", { class: "side-label" }, l.title), h("span", { class: "side-count" }, String(l.count)));
    const collapseBtn = h("button", {
      class: "side-collapse",
      type: "button",
      "aria-expanded": String(!isCollapsed),
      "aria-label": `${isCollapsed ? "Expand" : "Collapse"} ${l.title} lessons`,
      title: isCollapsed ? "Expand lessons" : "Collapse lessons",
    }, "▾");
    collapseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleLaneCollapsed(l.id, l.title);
    });
    row.append(head, collapseBtn);
    group.append(row);
    const sub = h("div", { class: "side-sub" });
    for (const les of lessonsIn(l.id)) {
      sub.append(h("a", { class: "side-link side-lesson", href: `#/lesson/${les.id}`, dataset: { route: `lesson/${les.id}` } },
        h("span", { class: "side-dot" + (Progress.isLearned(les.id) ? " on" : "") }), h("span", {}, les.title)));
    }
    group.append(sub);
    nav.append(group);
  }
  // tools
  const tools = h("div", { class: "side-group side-tools" }, h("div", { class: "side-section" }, "Explore"));
  tools.append(sideItem("🔤", "A–Z Index", "index"), sideItem("📚", "Glossary", "glossary"),
    sideItem("🗂️", "Change Catalog", "changes"), sideItem("🔍", "Teardowns", "teardowns"), sideItem("🧠", "Quizzes", "quiz"),
    sideItem("🃏", "Flashcards", "flashcards"), sideItem("➕", "Extend", "about"));
  nav.append(tools);
}
function sideItem(icon, label, routeRaw) {
  return h("a", { class: "side-link", href: "#/" + routeRaw, dataset: { route: routeRaw } },
    h("span", { class: "side-ico" }, icon), h("span", { class: "side-label" }, label));
}

// ---------------- Progress ring ----------------
function updateProgressRing() {
  const c = Progress.counts();
  const ring = document.getElementById("progress-ring");
  if (!ring) return;
  const circ = 2 * Math.PI * 15;
  ring.querySelector(".ring-fill").style.strokeDasharray = `${(c.pct / 100) * circ} ${circ}`;
  ring.querySelector(".ring-text").textContent = c.pct + "%";
  ring.title = `${c.learned} of ${c.total} concepts learned`;
}

// ---------------- Theme ----------------
function initTheme() {
  const saved = localStorage.getItem("ada.theme");
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextT = cur === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextT;
    localStorage.setItem("ada.theme", nextT);
    reRenderMermaidTheme();
    // re-run route to re-render mermaid with new theme
    setTimeout(route, 10);
  });
}

// ---------------- Command palette ----------------
function initPalette() {
  const overlay = document.getElementById("palette");
  const input = document.getElementById("palette-input");
  const results = document.getElementById("palette-results");
  let sel = 0, items = [];

  function open() {
    overlay.classList.add("open");
    input.value = ""; results.innerHTML = ""; sel = 0; items = [];
    draw("");
    setTimeout(() => input.focus(), 20);
  }
  function close() { overlay.classList.remove("open"); }
  function draw(q) {
    const res = q ? search(q) : defaultSuggestions();
    items = res;
    results.innerHTML = "";
    if (!res.length) { results.append(h("div", { class: "pal-empty" }, "No matches.")); return; }
    res.forEach((r, idx) => {
      const el = h("a", { class: "pal-item" + (idx === sel ? " sel" : ""), href: r.type === "term" && r.lessonId ? `#/lesson/${r.lessonId}` : (r.type === "term" ? "#/glossary" : `#/lesson/${r.id}`) },
        h("span", { class: "pal-kind pal-" + (r.type === "term" ? "term" : (lesson(r.id)?.type || "lesson")) }, r.type === "term" ? "Term" : (lesson(r.id)?.type || "")),
        h("span", { class: "pal-title" }, r.title),
        h("span", { class: "pal-sub" }, r.lane ? (lane(r.lane)?.icon || "") + " " + (lane(r.lane)?.title || r.lane) : ""));
      el.addEventListener("click", () => close());
      el.addEventListener("mousemove", () => { sel = idx; markSel(); });
      results.append(el);
    });
  }
  function markSel() { [...results.children].forEach((c, i) => c.classList && c.classList.toggle("sel", i === sel)); }
  function defaultSuggestions() {
    return State.lessons.slice(0, 8).map((l) => ({ id: l.id, type: "lesson", title: l.title, lane: l.lane }));
  }

  input.addEventListener("input", () => { sel = 0; draw(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); markSel(); scrollSel(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); markSel(); scrollSel(); }
    else if (e.key === "Enter") { e.preventDefault(); const a = results.children[sel]; if (a && a.getAttribute) { location.hash = a.getAttribute("href").slice(1); close(); } }
    else if (e.key === "Escape") close();
  });
  function scrollSel() { results.children[sel]?.scrollIntoView({ block: "nearest" }); }
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.getElementById("search-trigger").addEventListener("click", open);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName))) {
      e.preventDefault(); overlay.classList.contains("open") ? close() : open();
    }
  });
}

// ---------------- Mobile drawer ----------------
function initDrawer() {
  document.getElementById("menu-toggle").addEventListener("click", () => {
    document.body.classList.toggle("drawer-open");
  });
  document.getElementById("scrim").addEventListener("click", closeDrawer);
}
function closeDrawer() { document.body.classList.remove("drawer-open"); }

// ---------------- Boot ----------------
async function boot() {
  try {
    await loadData();
  } catch (e) {
    view().innerHTML = `<div class="view"><div class="empty"><h1>Content not built</h1><p>${e.message}</p><p class="muted">Run <code>npm run build</code> then reload.</p></div></div>`;
    return;
  }
  buildSidebar();
  initTheme();
  initPalette();
  initDrawer();
  updateProgressRing();
  document.addEventListener("progress-changed", () => { updateProgressRing(); refreshSidebarDots(); });
  window.addEventListener("hashchange", route);
  route();
  // reveal app
  document.body.classList.add("ready");
}
function refreshSidebarDots() {
  document.querySelectorAll(".side-lesson").forEach((el) => {
    const id = el.getAttribute("data-route")?.replace("lesson/", "");
    const dot = el.querySelector(".side-dot");
    if (id && dot) dot.classList.toggle("on", Progress.isLearned(id));
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
