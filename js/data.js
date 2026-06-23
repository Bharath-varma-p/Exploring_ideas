// data.js — load content bundle, build indexes, search, and progress store.

export const State = {
  data: null,
  repo: null,
  changeCatalog: { entries: [] },
  lessons: [],
  byId: new Map(),
  byLane: new Map(),
  glossary: [],
  quiz: [],
  quizBanks: {},
  lanes: [],
  stats: {},
};

export async function loadData() {
  const res = await fetch("content/data.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Could not load content/data.json — run `npm run build`.");
  const data = await res.json();
  State.data = data;
  State.repo = data.repo || null;
  State.changeCatalog = data.changeCatalog || { entries: [] };
  State.lessons = data.lessons || [];
  State.glossary = data.glossary || [];
  State.quiz = data.quiz || [];
  State.quizBanks = data.quizBanks || {};
  State.lanes = data.lanes || [];
  State.stats = data.stats || {};
  State.byId = new Map(State.lessons.map((l) => [l.id, l]));
  State.byLane = new Map();
  for (const l of State.lessons) {
    if (!State.byLane.has(l.lane)) State.byLane.set(l.lane, []);
    State.byLane.get(l.lane).push(l);
  }
  buildSearchIndex();
  return data;
}

export function lane(id) { return State.lanes.find((l) => l.id === id); }
export function lessonsIn(id) { return State.byLane.get(id) || []; }
export function lesson(id) { return State.byId.get(id); }
export function teardowns() { return State.lessons.filter((l) => l.type === "teardown"); }

// ---------- Search ----------
let index = [];
function buildSearchIndex() {
  index = State.lessons.map((l) => ({
    id: l.id, type: "lesson", lane: l.lane, title: l.title, summary: l.summary || "",
    haystack: [l.title, l.summary, (l.tags || []).join(" "), l.body, l.product, (l.patterns || []).join(" ")].filter(Boolean).join(" \n ").toLowerCase(),
  }));
  for (const g of State.glossary) index.push({
    id: g.lessonId || ("term-" + g.term), type: "term", term: g.term, lane: g.lane,
    title: g.term, summary: g.definition, lessonId: g.lessonId,
    haystack: (g.term + " " + g.definition).toLowerCase(),
  });
}

export function search(q) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const terms = query.split(/\s+/);
  const scored = [];
  for (const item of index) {
    let score = 0;
    for (const t of terms) {
      if (!item.haystack.includes(t)) { score = -1; break; }
      if (item.title.toLowerCase().includes(t)) score += 6;
      if ((item.summary || "").toLowerCase().includes(t)) score += 2;
      score += 1;
    }
    if (item.title.toLowerCase() === query) score += 20;
    if (item.title.toLowerCase().startsWith(query)) score += 8;
    if (score > 0) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 40).map((s) => s.item);
}

// ---------- Progress (localStorage) ----------
const PKEY = "ada.progress.v1";
function readProgress() {
  try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch { return {}; }
}
function writeProgress(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch {} }

export const Progress = {
  all() { return readProgress(); },
  isLearned(id) { return !!readProgress()[id]; },
  toggle(id) {
    const p = readProgress();
    if (p[id]) delete p[id]; else p[id] = Date.now();
    writeProgress(p);
    document.dispatchEvent(new CustomEvent("progress-changed", { detail: { id } }));
    return !!p[id];
  },
  set(id, v) {
    const p = readProgress();
    if (v) p[id] = Date.now(); else delete p[id];
    writeProgress(p);
    document.dispatchEvent(new CustomEvent("progress-changed", { detail: { id } }));
  },
  counts() {
    const p = readProgress();
    const learnable = State.lessons.length;
    const learned = State.lessons.filter((l) => p[l.id]).length;
    return { learned, total: learnable, pct: learnable ? Math.round((learned / learnable) * 100) : 0 };
  },
  laneCounts(laneId) {
    const p = readProgress();
    const ls = lessonsIn(laneId);
    const learned = ls.filter((l) => p[l.id]).length;
    return { learned, total: ls.length };
  },
  reset() { writeProgress({}); document.dispatchEvent(new CustomEvent("progress-changed", { detail: {} })); },
};

// ---------- Quiz score store ----------
const QKEY = "ada.quiz.v1";
export const QuizStore = {
  all() { try { return JSON.parse(localStorage.getItem(QKEY)) || {}; } catch { return {}; } },
  save(bankId, result) {
    const a = this.all(); a[bankId] = { ...result, at: Date.now() };
    try { localStorage.setItem(QKEY, JSON.stringify(a)); } catch {}
  },
};
