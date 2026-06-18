// views.js — all view renderers + quiz and flashcard engines.
import { h, md, enhance, esc, renderMermaid, copyText, toast } from "./render.js";
import { State, lane, lessonsIn, lesson, teardowns, search, Progress, QuizStore } from "./data.js";

const TYPE_LABEL = { concept: "Concept", pattern: "Pattern", teardown: "Teardown", framework: "Framework", blueprint: "Blueprint" };

function go(hash) { location.hash = hash; }
function chip(text, cls = "") { return h("span", { class: "chip " + cls }, text); }
function laneName(id) { const l = lane(id); return l ? l.title : id; }
function laneIcon(id) { const l = lane(id); return l ? l.icon : "•"; }

function mermaidBlock(code) {
  const div = h("div", { class: "mermaid diagram", dataset: { src: code } });
  div.textContent = code;
  return div;
}

function lessonCard(l) {
  const learned = Progress.isLearned(l.id);
  return h("a", { class: "card lesson-card" + (learned ? " is-learned" : ""), href: `#/lesson/${l.id}` },
    h("div", { class: "card-top" },
      chip(TYPE_LABEL[l.type] || l.type, "chip-type chip-" + l.type),
      learned ? h("span", { class: "learned-dot", title: "Learned" }, "✓") : null),
    h("h3", { class: "card-title" }, l.title),
    h("p", { class: "card-summary" }, l.summary || ""),
    (l.tags && l.tags.length) ? h("div", { class: "card-tags" }, ...l.tags.slice(0, 4).map((t) => chip(t, "chip-tag"))) : null);
}

// ---------------- Home ----------------
export function renderHome() {
  const c = Progress.counts();
  const next = State.lessons.find((l) => !Progress.isLearned(l.id));
  const wrap = h("div", { class: "view view-home" });

  wrap.append(
    h("section", { class: "hero" },
      h("div", { class: "hero-glow" }),
      h("p", { class: "hero-kicker" }, "Interactive curriculum"),
      h("h1", { class: "hero-title" }, "Context-Aware & Platform-Aware ", h("span", { class: "grad" }, "Agentic AI"), " System Design"),
      h("p", { class: "hero-sub" }, "Learn how the best teams design agents that sense the screen, the app, and even the cursor — then build your own. Patterns, teardowns, a design framework, and drills. Grows one file at a time."),
      h("div", { class: "hero-actions" },
        h("a", { class: "btn btn-primary", href: next ? `#/lesson/${next.id}` : "#/lane/architecture" }, next ? "Start learning →" : "Review →"),
        h("a", { class: "btn btn-ghost", href: "#/framework" }, "See the build blueprint"),
        h("button", { class: "btn btn-ghost", type: "button", onClick: () => go("#/flashcards") }, "Drill flashcards"))));

  // progress + stats
  wrap.append(h("section", { class: "stat-row" },
    statCard(`${c.learned}/${c.total}`, "concepts learned", c.pct),
    statCard(String(State.stats?.lessons ?? State.lessons.length), "total lessons"),
    statCard(String(teardowns().length), "product teardowns"),
    statCard(String(State.quiz.length), "quiz questions")));

  // lane grid
  const grid = h("div", { class: "lane-grid" });
  for (const l of State.lanes) {
    const lc = Progress.laneCounts(l.id);
    grid.append(h("a", { class: "card lane-card", href: `#/lane/${l.id}` },
      h("div", { class: "lane-ico" }, l.icon),
      h("h3", {}, l.title),
      h("p", { class: "lane-blurb" }, l.blurb),
      h("div", { class: "lane-meta" },
        h("span", {}, `${l.count} lesson${l.count === 1 ? "" : "s"}`),
        h("span", { class: "lane-prog" }, `${lc.learned}/${lc.total} done`)),
      progressBar(l.count ? Math.round((lc.learned / l.count) * 100) : 0)));
  }
  wrap.append(h("section", {}, h("h2", { class: "section-h" }, "The five lanes"), grid));

  // quick links
  wrap.append(h("section", { class: "quicklinks" },
    quickLink("🔤", "A–Z Index", "Every pattern & term", "#/index"),
    quickLink("📚", "Glossary", `${State.glossary.length} terms defined`, "#/glossary"),
    quickLink("🔍", "Teardown Gallery", "Real products, dissected", "#/teardowns"),
    quickLink("🧠", "Quizzes", "Test yourself", "#/quiz"),
    quickLink("🃏", "Flashcards", "Spaced drill mode", "#/flashcards"),
    quickLink("➕", "Extend this site", "Add a lesson in one file", "#/about")));
  return wrap;
}
function statCard(big, label, pct) {
  return h("div", { class: "stat-card" },
    h("div", { class: "stat-big" }, big),
    h("div", { class: "stat-label" }, label),
    pct != null ? progressBar(pct) : null);
}
function quickLink(icon, title, sub, href) {
  return h("a", { class: "card quicklink", href },
    h("span", { class: "ql-ico" }, icon),
    h("span", { class: "ql-text" }, h("strong", {}, title), h("span", {}, sub)));
}
function progressBar(pct) {
  return h("div", { class: "pbar", title: pct + "%" }, h("div", { class: "pbar-fill", style: `width:${pct}%` }));
}

// ---------------- Lane ----------------
export function renderLane(id) {
  const l = lane(id);
  if (!l) return notFound("Unknown lane");
  const items = lessonsIn(id);
  const wrap = h("div", { class: "view view-lane" });
  wrap.append(breadcrumb([["Home", "#/"], [l.title, null]]));
  wrap.append(h("header", { class: "lane-head" },
    h("div", { class: "lane-ico big" }, l.icon),
    h("div", {}, h("h1", {}, l.title), h("p", { class: "muted" }, l.blurb))));
  const grid = h("div", { class: "card-grid" });
  if (!items.length) grid.append(h("p", { class: "muted" }, "No lessons yet — drop a JSON file in content/lessons/" + id + "/ and rebuild."));
  for (const it of items) grid.append(lessonCard(it));
  wrap.append(grid);
  return wrap;
}

// ---------------- Lesson ----------------
export function renderLesson(id) {
  const l = lesson(id);
  if (!l) return notFound("Lesson not found: " + id);
  const wrap = h("div", { class: "view view-lesson" });
  wrap.append(breadcrumb([["Home", "#/"], [laneName(l.lane), `#/lane/${l.lane}`], [l.title, null]]));

  // header
  const learned = Progress.isLearned(l.id);
  const head = h("header", { class: "lesson-head" },
    h("div", { class: "lesson-head-top" },
      chip(TYPE_LABEL[l.type] || l.type, "chip-type chip-" + l.type),
      chip(laneIcon(l.lane) + " " + laneName(l.lane), "chip-lane"),
      ...(l.tags || []).slice(0, 5).map((t) => chip(t, "chip-tag"))),
    h("h1", { class: "lesson-title" }, l.title),
    l.summary ? h("p", { class: "lesson-summary" }, l.summary) : null,
    l.analogy ? h("div", { class: "analogy" }, h("span", { class: "analogy-ico" }, "💡"), h("div", {}, h("strong", {}, "Analogy. "), l.analogy)) : null,
    learnedButton(l));
  wrap.append(head);

  // pattern card
  if (l.type === "pattern" && (l.problem || l.solution)) {
    wrap.append(h("section", { class: "pattern-card" },
      patternRow("Problem", l.problem),
      l.forces ? patternRow("Forces", h("ul", {}, ...l.forces.map((f) => h("li", {}, f)))) : null,
      patternRow("Solution", l.solution),
      l.tradeoffs ? patternRow("Trade-offs", h("ul", {}, ...l.tradeoffs.map((t) => h("li", {}, t)))) : null));
  }

  // teardown meta
  if (l.type === "teardown") {
    wrap.append(h("section", { class: "teardown-meta" },
      metaChips("Context signals", l.contextSignals, "sig"),
      metaChips("Patterns used", l.patterns, "pat"),
      metaChips("UX moves", l.uxMoves, "ux")));
  }

  // diagram
  if (l.diagram) wrap.append(h("section", { class: "diagram-wrap" },
    h("div", { class: "section-eyebrow" }, "Mental model"), mermaidBlock(l.diagram)));

  // body
  if (l.body) {
    const body = h("article", { class: "prose" });
    body.innerHTML = md(l.body);
    enhance(body);
    wrap.append(body);
  }

  // examples
  if (l.examples && l.examples.length) {
    wrap.append(h("section", { class: "examples" },
      h("h2", { class: "section-h" }, "Real examples"),
      ...l.examples.map((ex) => h("div", { class: "example" },
        h("div", { class: "example-head" }, h("strong", {}, ex.product || "Example"),
          ex.source ? h("a", { class: "src-link", href: ex.source, target: "_blank", rel: "noopener" }, "source ↗") : null),
        h("p", {}, ex.what || "")))));
  }

  // drills
  if (l.drills && l.drills.length) wrap.append(drillsBlock(l.drills));

  // mini quiz
  if (l.quiz && l.quiz.length) {
    const q = h("section", { class: "lesson-quiz" }, h("h2", { class: "section-h" }, "Quick check"));
    q.append(quizEngine(l.quiz, { bankId: "lesson-" + l.id, compact: true }));
    wrap.append(q);
  }

  // teach it back
  if (l.teachItBack) wrap.append(h("section", { class: "teachback" },
    h("div", { class: "teachback-ico" }, "🗣️"),
    h("div", {}, h("h2", {}, "Teach it back"),
      h("p", {}, l.teachItBack),
      h("button", { class: "btn btn-tiny", type: "button", onClick: () => copyText(l.teachItBack) }, "Copy script"))));

  // sources — ranked by recency × authority, split into current vs historical
  if (l.sources && l.sources.length) wrap.append(sourcesSection(l));

  // related
  const rel = (l.related || []).map((rid) => lesson(rid)).filter(Boolean);
  if (rel.length) wrap.append(h("section", { class: "related" },
    h("h2", { class: "section-h" }, "Related"),
    h("div", { class: "related-row" }, ...rel.map((r) => h("a", { class: "chip chip-link", href: `#/lesson/${r.id}` }, r.title)))));

  // footer nav
  wrap.append(lessonNav(l));
  return wrap;
}

function patternRow(label, content) {
  if (!content) return null;
  return h("div", { class: "pattern-row" }, h("div", { class: "pattern-label" }, label),
    typeof content === "string" ? h("div", { class: "pattern-val" }, content) : h("div", { class: "pattern-val" }, content));
}

// ---------------- Citation freshness ----------------
const FRESH_TITLE = {
  fresh: "Fresh (< 6 months)", living: "Living reference (continuously updated)",
  foundational: "Foundational (age-exempt)", aging: "Aging (6–18 months)",
  stale: "Stale (> 18 months)", undated: "Undated — verify before relying",
};
function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function freshnessBadge(f) {
  if (!f) return null;
  const age = f.ageMonths != null ? ` ${f.ageMonths < 12 ? Math.round(f.ageMonths) + "mo" : (f.ageMonths / 12).toFixed(1) + "yr"}` : "";
  return h("span", { class: "fresh-badge fresh-" + f.status, title: FRESH_TITLE[f.status] || f.status },
    f.badge, h("span", { class: "fresh-label" }, f.label + age));
}
function sourceItem(s) {
  const meta = [];
  if (s.publisher) meta.push(s.publisher);
  if (s.type) meta.push(s.type.replace(/-/g, " "));
  const date = s.updated || s.published;
  if (date) meta.push((s.updated ? "updated " : "") + fmtDate(date));
  else if (s.living) meta.push("living doc");
  else meta.push("date unknown");
  return h("li", { class: "source-item" },
    h("div", { class: "source-line" },
      freshnessBadge(s.freshness),
      h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.title || s.url),
      s.verified === false ? chip("unverified", "chip-warn") : (s.verified ? chip("verified", "chip-ok") : null)),
    h("div", { class: "source-meta" }, meta.join(" · "),
      s.note ? h("span", { class: "source-note" }, " — " + s.note) : null));
}
function sourcesSection(l) {
  const current = l.sources.filter((s) => !s.historical);
  const historical = l.sources.filter((s) => s.historical);
  const sec = h("section", { class: "sources" }, h("h2", { class: "section-h" }, "Sources"),
    l.lastVerified ? h("p", { class: "verified-stamp" }, "Last verified: " + fmtDate(l.lastVerified) + " · ranked by recency × authority") : null);
  if (current.length) sec.append(
    historical.length ? h("h3", { class: "source-subhead" }, "Current best practice") : null,
    h("ul", { class: "source-list" }, ...current.map(sourceItem)));
  if (historical.length) sec.append(
    h("h3", { class: "source-subhead" }, "Historical / origin"),
    h("ul", { class: "source-list" }, ...historical.map(sourceItem)));
  return sec;
}

function metaChips(label, arr, cls) {
  if (!arr || !arr.length) return null;
  return h("div", { class: "meta-block" }, h("div", { class: "meta-label" }, label),
    h("div", { class: "meta-chips" }, ...arr.map((x) => chip(x, "chip-" + cls))));
}
function drillsBlock(drills) {
  const sec = h("section", { class: "drills" }, h("h2", { class: "section-h" }, "Drills"));
  drills.forEach((d, i) => {
    const ans = h("div", { class: "drill-answer" }, d.a);
    const btn = h("button", { class: "drill-toggle", type: "button" }, "Show answer");
    btn.addEventListener("click", () => {
      const open = ans.classList.toggle("show");
      btn.textContent = open ? "Hide answer" : "Show answer";
    });
    sec.append(h("div", { class: "drill" }, h("div", { class: "drill-q" }, h("span", { class: "drill-n" }, "Q" + (i + 1)), d.q), btn, ans));
  });
  return sec;
}
function learnedButton(l) {
  const btn = h("button", { class: "btn btn-learn" + (Progress.isLearned(l.id) ? " on" : ""), type: "button" });
  const sync = () => { const on = Progress.isLearned(l.id); btn.classList.toggle("on", on); btn.innerHTML = on ? "✓ Learned" : "○ Mark as learned"; };
  sync();
  btn.addEventListener("click", () => { Progress.toggle(l.id); sync(); });
  return btn;
}
function lessonNav(l) {
  const flat = State.lessons;
  const i = flat.findIndex((x) => x.id === l.id);
  const prev = flat[i - 1], next = flat[i + 1];
  return h("nav", { class: "lesson-nav" },
    prev ? h("a", { class: "ln-link prev", href: `#/lesson/${prev.id}` }, h("span", {}, "← Previous"), h("strong", {}, prev.title)) : h("span", {}),
    next ? h("a", { class: "ln-link next", href: `#/lesson/${next.id}` }, h("span", {}, "Next →"), h("strong", {}, next.title)) : h("span", {}));
}

// ---------------- Teardown gallery ----------------
export function renderTeardowns() {
  const items = teardowns();
  const wrap = h("div", { class: "view view-teardowns" });
  wrap.append(breadcrumb([["Home", "#/"], ["Teardown Gallery", null]]));
  wrap.append(h("header", { class: "lane-head" }, h("div", { class: "lane-ico big" }, "🔍"),
    h("div", {}, h("h1", {}, "Teardown Gallery"), h("p", { class: "muted" }, "Real products, dissected: the context they sense, the patterns under the hood, and the UX moves worth stealing."))));

  const allPatterns = [...new Set(items.flatMap((t) => t.patterns || []))].sort();
  const filterBar = h("div", { class: "filter-bar" });
  const grid = h("div", { class: "card-grid teardown-grid" });
  let active = "all";
  function draw() {
    grid.innerHTML = "";
    const shown = active === "all" ? items : items.filter((t) => (t.patterns || []).includes(active));
    for (const t of shown) grid.append(teardownCard(t));
    if (!shown.length) grid.append(h("p", { class: "muted" }, "No teardowns match this filter yet."));
  }
  const mkBtn = (val, label) => {
    const b = h("button", { class: "filter-btn" + (val === active ? " on" : ""), type: "button" }, label);
    b.addEventListener("click", () => { active = val; filterBar.querySelectorAll(".filter-btn").forEach((x) => x.classList.remove("on")); b.classList.add("on"); draw(); });
    return b;
  };
  filterBar.append(mkBtn("all", "All"));
  for (const p of allPatterns) filterBar.append(mkBtn(p, p));
  wrap.append(filterBar, grid);
  draw();
  return wrap;
}
function teardownCard(t) {
  return h("a", { class: "card teardown-card", href: `#/lesson/${t.id}` },
    h("div", { class: "tc-head" }, h("h3", {}, t.product || t.title), Progress.isLearned(t.id) ? h("span", { class: "learned-dot" }, "✓") : null),
    h("p", { class: "card-summary" }, t.summary || ""),
    (t.contextSignals && t.contextSignals.length) ? h("div", { class: "tc-sigs" }, h("span", { class: "tc-tag" }, "senses:"), ...t.contextSignals.slice(0, 4).map((s) => chip(s, "chip-sig"))) : null,
    (t.patterns && t.patterns.length) ? h("div", { class: "tc-pats" }, ...t.patterns.slice(0, 4).map((p) => chip(p, "chip-pat"))) : null);
}

// ---------------- Glossary ----------------
export function renderGlossary() {
  const wrap = h("div", { class: "view view-glossary" });
  wrap.append(breadcrumb([["Home", "#/"], ["Glossary", null]]));
  wrap.append(h("header", { class: "lane-head" }, h("div", { class: "lane-ico big" }, "📚"),
    h("div", {}, h("h1", {}, "Glossary"), h("p", { class: "muted" }, State.glossary.length + " terms, defined before they're used."))));
  const input = h("input", { class: "filter-input", type: "search", placeholder: "Filter terms…", "aria-label": "Filter glossary" });
  const list = h("div", { class: "glossary-list" });
  function draw(q = "") {
    list.innerHTML = "";
    const ql = q.toLowerCase();
    const items = State.glossary.filter((g) => !ql || g.term.toLowerCase().includes(ql) || (g.definition || "").toLowerCase().includes(ql));
    for (const g of items) list.append(h("div", { class: "glossary-item" },
      h("dt", {}, g.term, g.lessonId ? h("a", { class: "g-jump", href: `#/lesson/${g.lessonId}` }, "↗") : null),
      h("dd", {}, g.definition)));
    if (!items.length) list.append(h("p", { class: "muted" }, "No matching terms."));
  }
  input.addEventListener("input", () => draw(input.value));
  wrap.append(input, list); draw();
  return wrap;
}

// ---------------- A–Z index ----------------
export function renderIndex() {
  const wrap = h("div", { class: "view view-index" });
  wrap.append(breadcrumb([["Home", "#/"], ["A–Z Index", null]]));
  wrap.append(h("header", { class: "lane-head" }, h("div", { class: "lane-ico big" }, "🔤"),
    h("div", {}, h("h1", {}, "A–Z Index"), h("p", { class: "muted" }, "Every lesson and term, alphabetical."))));
  const entries = [
    ...State.lessons.map((l) => ({ key: l.title, href: `#/lesson/${l.id}`, tag: TYPE_LABEL[l.type], cls: l.type })),
    ...State.glossary.map((g) => ({ key: g.term, href: g.lessonId ? `#/lesson/${g.lessonId}` : "#/glossary", tag: "Term", cls: "term" })),
  ].sort((a, b) => a.key.localeCompare(b.key));
  const groups = {};
  for (const e of entries) { const L = (e.key[0] || "#").toUpperCase(); (groups[L] ||= []).push(e); }
  const letters = Object.keys(groups).sort();
  wrap.append(h("div", { class: "az-nav" }, ...letters.map((L) => h("a", { class: "az-letter", href: "#az-" + L }, L))));
  const body = h("div", { class: "az-body" });
  for (const L of letters) {
    body.append(h("h2", { class: "az-h", id: "az-" + L }, L));
    const ul = h("div", { class: "az-list" });
    for (const e of groups[L]) ul.append(h("a", { class: "az-item", href: e.href }, h("span", {}, e.key), chip(e.tag, "chip-" + e.cls)));
    body.append(ul);
  }
  wrap.append(body);
  return wrap;
}

// ---------------- Freshness report ----------------
export function renderFreshness() {
  const wrap = h("div", { class: "view view-freshness" });
  wrap.append(breadcrumb([["Home", "#/"], ["Freshness report", null]]));
  const report = State.data?.freshnessReport || { counts: {}, items: [] };
  const c = report.counts || {};
  const verified = State.data?.verifiedOn || report.verifiedOn;
  wrap.append(h("header", { class: "lane-head" }, h("div", { class: "lane-ico big" }, "🩺"),
    h("div", {}, h("h1", {}, "Citation freshness report"),
      h("p", { class: "muted" }, "Every source ranked by recency × authority. Last verified: " + (fmtDate(verified) || "—") + "."))));

  wrap.append(h("section", { class: "fresh-legend" },
    legendChip("🟢", "fresh / living", (c.fresh || 0) + (c.living || 0)),
    legendChip("📘", "foundational", c.foundational || 0),
    legendChip("🟡", "aging (6–18mo)", c.aging || 0),
    legendChip("🔴", "stale (>18mo)", c.stale || 0),
    legendChip("⚠️", "undated", c.undated || 0)));

  const items = report.items || [];
  if (!items.length) {
    wrap.append(h("div", { class: "empty" }, h("p", {}, "✅ No aging, stale, or undated citations. Everything checks out.")));
    return wrap;
  }
  wrap.append(h("p", { class: "muted" }, items.length + " citation(s) need attention, worst first:"));
  const table = h("div", { class: "fresh-table" });
  for (const it of items) {
    table.append(h("div", { class: "fresh-row fresh-" + it.status },
      h("div", { class: "fresh-cell fresh-badge-cell" }, freshnessBadge({ status: it.status, badge: it.badge, label: it.status, ageMonths: it.ageMonths })),
      h("div", { class: "fresh-cell" },
        h("a", { href: it.url, target: "_blank", rel: "noopener" }, it.title),
        h("div", { class: "source-meta" }, [it.publisher, it.type && it.type.replace(/-/g, " "), it.published ? fmtDate(it.published) : "date unknown"].filter(Boolean).join(" · "),
          it.historical ? " · historical/origin" : "")),
      h("div", { class: "fresh-cell" }, h("a", { class: "chip chip-link", href: `#/lesson/${it.lessonId}` }, it.lessonTitle))));
  }
  wrap.append(table);
  return wrap;
}
function legendChip(badge, label, n) {
  return h("div", { class: "legend-chip" }, h("span", { class: "legend-badge" }, badge),
    h("span", {}, label), h("span", { class: "legend-count" }, String(n)));
}

// ---------------- Quiz hub + engine ----------------
export function renderQuizHub() {
  const wrap = h("div", { class: "view view-quizhub" });
  wrap.append(breadcrumb([["Home", "#/"], ["Quizzes", null]]));
  wrap.append(h("header", { class: "lane-head" }, h("div", { class: "lane-ico big" }, "🧠"),
    h("div", {}, h("h1", {}, "Quizzes"), h("p", { class: "muted" }, "Instant-feedback drills. Pick a lane or take the full self-test."))));
  const grid = h("div", { class: "card-grid" });
  const scores = QuizStore.all();
  const finalBank = State.quizBanks && State.quizBanks["final-exam"];
  const finalCount = finalBank ? finalBank.questions.length : State.quiz.length;
  grid.append(quizLaunchCard("🏆 Final self-test", finalBank ? finalBank.title : "Mixed questions across the whole curriculum", finalCount, "#/quiz/all", scores["all"]));
  for (const l of State.lanes) {
    const qs = State.quiz.filter((q) => q.lane === l.id);
    if (qs.length) grid.append(quizLaunchCard(l.icon + " " + l.title, qs.length + " questions", qs.length, `#/quiz/${l.id}`, scores[l.id]));
  }
  wrap.append(grid);
  return wrap;
}
function quizLaunchCard(title, sub, count, href, score) {
  return h("a", { class: "card quiz-card", href },
    h("h3", {}, title), h("p", { class: "card-summary" }, sub),
    h("div", { class: "quiz-card-foot" }, h("span", { class: "muted" }, count + " Q"),
      score ? chip(`Best ${score.correct}/${score.total}`, "chip-ok") : chip("Not attempted", "chip-tag")));
}

export function renderQuiz(scope) {
  let questions, title, bankId = scope;
  if (scope === "all") {
    const bank = State.quizBanks && State.quizBanks["final-exam"];
    questions = (bank && bank.questions.length) ? bank.questions : State.quiz;
    title = bank ? bank.title : "Final Self-Test";
  } else {
    questions = State.quiz.filter((q) => q.lane === scope);
    title = (lane(scope)?.title || scope) + " Quiz";
  }
  const wrap = h("div", { class: "view view-quiz" });
  wrap.append(breadcrumb([["Home", "#/"], ["Quizzes", "#/quiz"], [title, null]]));
  wrap.append(h("h1", { class: "quiz-h1" }, title));
  if (!questions.length) { wrap.append(h("p", { class: "muted" }, "No questions yet.")); return wrap; }
  wrap.append(quizEngine(questions, { bankId, title }));
  return wrap;
}

/** Stepper quiz with instant feedback. opts: {bankId, title, compact} */
export function quizEngine(questions, opts = {}) {
  const qs = shuffle(questions.map((q) => ({ ...q })));
  let i = 0, correct = 0; const answered = new Array(qs.length).fill(false);
  const host = h("div", { class: "quiz" + (opts.compact ? " quiz-compact" : "") });
  const progress = h("div", { class: "quiz-progress" });
  const body = h("div", { class: "quiz-body" });
  host.append(progress, body);

  function draw() {
    const q = qs[i];
    progress.innerHTML = "";
    progress.append(h("span", { class: "quiz-count" }, `Question ${i + 1} of ${qs.length}`),
      progressBarInline(Math.round((i) / qs.length * 100)),
      h("span", { class: "quiz-score" }, `Score ${correct}`));
    body.innerHTML = "";
    const card = h("div", { class: "quiz-q-card" }, h("p", { class: "quiz-q" }, q.q));
    const choices = h("div", { class: "quiz-choices" });
    q.choices.forEach((ch, idx) => {
      const b = h("button", { class: "quiz-choice", type: "button" }, ch);
      b.addEventListener("click", () => {
        if (answered[i]) return;
        answered[i] = true;
        const right = idx === q.answer;
        if (right) { correct++; b.classList.add("correct"); }
        else { b.classList.add("wrong"); choices.children[q.answer]?.classList.add("correct"); }
        choices.querySelectorAll("button").forEach((x) => x.disabled = true);
        card.append(h("div", { class: "quiz-explain " + (right ? "ok" : "no") },
          h("strong", {}, right ? "Correct. " : "Not quite. "), q.explanation || ""));
        nextBtn.classList.add("show");
        progress.querySelector(".quiz-score").textContent = `Score ${correct}`;
      });
      choices.append(b);
    });
    card.append(choices);
    const nextBtn = h("button", { class: "btn btn-primary quiz-next", type: "button" }, i === qs.length - 1 ? "See results" : "Next →");
    nextBtn.addEventListener("click", () => { if (!answered[i]) return; if (i < qs.length - 1) { i++; draw(); } else finish(); });
    card.append(nextBtn);
    body.append(card);
  }
  function finish() {
    const pct = Math.round(correct / qs.length * 100);
    if (opts.bankId) QuizStore.save(opts.bankId, { correct, total: qs.length });
    body.innerHTML = "";
    progress.innerHTML = "";
    const verdict = pct >= 80 ? "Mastery 🏆" : pct >= 60 ? "Solid — review the misses" : "Keep drilling";
    body.append(h("div", { class: "quiz-result" },
      h("div", { class: "quiz-result-pct" }, pct + "%"),
      h("p", {}, `You got ${correct} of ${qs.length} right. ${verdict}`),
      h("div", { class: "quiz-result-actions" },
        h("button", { class: "btn btn-primary", type: "button", onClick: () => { i = 0; correct = 0; answered.fill(false); shuffleInPlace(qs); draw(); } }, "Retry"),
        h("a", { class: "btn btn-ghost", href: "#/quiz" }, "All quizzes"))));
  }
  draw();
  return host;
}
function progressBarInline(pct) { return h("div", { class: "pbar inline" }, h("div", { class: "pbar-fill", style: `width:${pct}%` })); }

// ---------------- Flashcards ----------------
export function renderFlashcards(scope = "all") {
  const wrap = h("div", { class: "view view-flash" });
  wrap.append(breadcrumb([["Home", "#/"], ["Flashcards", null]]));
  wrap.append(h("h1", { class: "quiz-h1" }, "Flashcard Drill"));

  let cards = State.lessons.flatMap((l) => (l.drills || []).map((d) => ({ q: d.q, a: d.a, lane: l.lane, lessonId: l.id, title: l.title })));
  // lane filter
  const laneSel = h("div", { class: "flash-filter" });
  const mk = (val, label) => { const b = h("button", { class: "filter-btn" + (val === scope ? " on" : ""), type: "button", onClick: () => go(val === "all" ? "#/flashcards" : `#/flashcards/${val}`) }, label); return b; };
  laneSel.append(mk("all", "All lanes"));
  for (const l of State.lanes) laneSel.append(mk(l.id, l.icon + " " + l.title.split(" ")[0]));
  wrap.append(laneSel);

  if (scope !== "all") cards = cards.filter((c) => c.lane === scope);
  if (!cards.length) { wrap.append(h("p", { class: "muted" }, "No flashcards in this lane yet.")); return wrap; }
  shuffleInPlace(cards);

  let i = 0, known = 0;
  const counter = h("div", { class: "flash-counter" });
  const stage = h("div", { class: "flash-stage" });
  const controls = h("div", { class: "flash-controls" });
  wrap.append(counter, stage, controls);

  function draw() {
    const c = cards[i];
    counter.innerHTML = "";
    counter.append(h("span", {}, `Card ${i + 1} / ${cards.length}`), h("span", { class: "muted" }, `Known ${known}`), h("a", { class: "flash-src", href: `#/lesson/${c.lessonId}` }, c.title));
    stage.innerHTML = "";
    const card = h("div", { class: "flashcard", tabindex: "0", role: "button", "aria-label": "Flip card" },
      h("div", { class: "flash-inner" },
        h("div", { class: "flash-face flash-front" }, h("span", { class: "flash-tag" }, "Question"), h("p", {}, c.q), h("span", { class: "flash-hint" }, "Click or press Space to flip")),
        h("div", { class: "flash-face flash-back" }, h("span", { class: "flash-tag" }, "Answer"), h("p", {}, c.a))));
    const flip = () => card.classList.toggle("flipped");
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    stage.append(card);
    controls.innerHTML = "";
    controls.append(
      h("button", { class: "btn btn-ghost", type: "button", onClick: () => { card.classList.add("flipped"); } }, "Flip"),
      h("button", { class: "btn btn-warn", type: "button", onClick: () => advance(false) }, "Review again"),
      h("button", { class: "btn btn-ok", type: "button", onClick: () => advance(true) }, "Got it ✓"));
    setTimeout(() => card.focus(), 30);
  }
  function advance(gotIt) {
    if (gotIt) known++;
    if (i < cards.length - 1) { i++; draw(); }
    else {
      stage.innerHTML = ""; controls.innerHTML = ""; counter.innerHTML = "";
      stage.append(h("div", { class: "quiz-result" },
        h("div", { class: "quiz-result-pct" }, Math.round(known / cards.length * 100) + "%"),
        h("p", {}, `You felt confident on ${known} of ${cards.length}.`),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => { i = 0; known = 0; shuffleInPlace(cards); draw(); } }, "Shuffle & restart")));
    }
  }
  draw();
  return wrap;
}

// ---------------- About / extend ----------------
export function renderAbout() {
  const wrap = h("div", { class: "view view-about prose" });
  wrap.append(breadcrumb([["Home", "#/"], ["About & Extend", null]]));
  wrap.innerHTML += `
    <h1>About this site</h1>
    <p>This is a <strong>content-driven</strong> curriculum on context-aware &amp; platform-aware agentic AI design.
    It was assembled by five specialized AI subagents — one per lane — each researching the real world and writing lessons into a shared schema.</p>
    <h2>Extend it in one file</h2>
    <ol>
      <li>Create <code>content/lessons/&lt;lane&gt;/your-id.json</code>.</li>
      <li>Fill the six required fields (<code>id, title, lane, type, summary, body</code>) plus any rich extras.</li>
      <li>Run <code>npm run build</code> (or just push — CI rebuilds). The site picks it up automatically.</li>
    </ol>
    <p>Full schema and rules live in <code>CONTENT_SCHEMA.md</code>. Flashcards, the glossary, the A–Z index and the quizzes all populate themselves from the fields you add.</p>
    <h2>The five lanes</h2>
    <ul>${State.lanes.map((l) => `<li><strong>${esc(l.title)}</strong> — ${esc(l.blurb)}</li>`).join("")}</ul>
    <h2>Stack</h2>
    <p>Pure static HTML/CSS/vanilla JS. Markdown via <code>marked</code>, diagrams via <code>mermaid</code> (lazy-loaded), zero backend. Deployed free on GitHub Pages.</p>
  `;
  enhance(wrap);
  return wrap;
}

// ---------------- shared bits ----------------
function breadcrumb(parts) {
  return h("nav", { class: "crumbs" }, ...parts.flatMap(([label, href], idx) => {
    const node = href ? h("a", { href }, label) : h("span", { class: "crumb-cur" }, label);
    return idx < parts.length - 1 ? [node, h("span", { class: "crumb-sep" }, "/")] : [node];
  }));
}
function notFound(msg) {
  return h("div", { class: "view" }, h("div", { class: "empty" }, h("h1", {}, "404"), h("p", {}, msg || "Nothing here."), h("a", { class: "btn btn-primary", href: "#/" }, "Go home")));
}
function shuffle(a) { return shuffleInPlace([...a]); }
function shuffleInPlace(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
