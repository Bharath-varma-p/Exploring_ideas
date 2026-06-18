/* ============================================================
   app.js — Foundry SDK Academy SPA engine
   Hash router · data-driven views · search · quiz · flashcards ·
   teaching mode · progress (localStorage) · mermaid + hljs.
   Depends on: window.CURRICULUM, window.EXTRAS, window.FSA
   ============================================================ */
(function () {
  "use strict";
  var U = window.FSA;
  var el = U.el, esc = U.esc, md = U.mdToHtml, Store = U.Store;
  var DATA = window.CURRICULUM || { lanes: [], stats: {} };
  var EXTRAS = window.EXTRAS || {};
  var LANES = DATA.lanes || [];

  /* ---------- index ---------- */
  var byLane = {};            // laneId -> lane
  var conceptByUid = {};      // uid -> {concept, lane}
  var allConcepts = [];       // [{c, lane}]
  LANES.forEach(function (lane) {
    byLane[lane.id] = lane;
    (lane.concepts || []).forEach(function (c) {
      conceptByUid[c.uid] = { c: c, lane: lane };
      allConcepts.push({ c: c, lane: lane });
    });
  });

  var TOTAL_CONCEPTS = allConcepts.length;

  /* ---------- diagram + highlight queues ---------- */
  var mermaidReady = !!window.__mermaid;
  window.addEventListener("mermaid-ready", function () { mermaidReady = true; renderPendingDiagrams(); });

  var diagCounter = 0;
  function renderPendingDiagrams() {
    if (!mermaidReady || !window.__mermaid) return;
    var nodes = document.querySelectorAll(".diagram[data-src]:not([data-done])");
    nodes.forEach(function (node) {
      var src = node.getAttribute("data-src");
      node.setAttribute("data-done", "1");
      var id = "mmd-" + (++diagCounter);
      try {
        window.__mermaid.render(id, src).then(function (res) {
          node.innerHTML = res.svg;
          if (res.bindFunctions) res.bindFunctions(node);
        }).catch(function (err) {
          node.innerHTML = '<div class="diagram-err">Diagram could not render.\n' + esc(String(err && err.message || err)) + "</div>";
        });
      } catch (e) {
        node.innerHTML = '<div class="diagram-err">Diagram error.</div>';
      }
    });
  }

  function highlightAll(scope) {
    if (!window.hljs) return;
    (scope || document).querySelectorAll("pre.code code:not([data-hl])").forEach(function (block) {
      block.setAttribute("data-hl", "1");
      try { window.hljs.highlightElement(block); } catch (e) {}
    });
  }
  // If highlight.js loads after the first view renders, highlight everything then.
  window.addEventListener("hljs-ready", function () { highlightAll(document); });

  /* ---------- small render helpers ---------- */
  function langLabel(l) { return (l || "text").toUpperCase(); }

  function codeBlock(code) {
    if (!code || !code.content) return null;
    var lang = code.language || "text";
    var wrap = el("div", { class: "code-wrap" });
    var head = el("div", { class: "code-head" }, [
      el("span", { class: "lang" }, langLabel(lang)),
      el("span", { class: "cap" }, code.caption || ""),
      el("button", { class: "copy-btn", type: "button", "aria-label": "Copy code" }, "Copy")
    ]);
    var pre = el("pre", { class: "code" });
    var codeEl = el("code", { class: "language-" + esc(lang) });
    codeEl.textContent = code.content;
    pre.appendChild(codeEl);
    var btn = head.querySelector(".copy-btn");
    btn.addEventListener("click", function () {
      U.copyText(code.content).then(function (ok) {
        btn.textContent = ok ? "Copied!" : "Press ⌘C";
        btn.classList.toggle("copied", ok);
        setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
      });
    });
    wrap.appendChild(head); wrap.appendChild(pre);
    return wrap;
  }

  function diagramBlock(src) {
    if (!src || !src.trim()) return null;
    var clean = src.replace(/^\s*mermaid\s*\n/, "").trim();
    var d = el("div", { class: "diagram", "data-src": clean, role: "img", "aria-label": "Architecture or flow diagram" });
    d.textContent = "Rendering diagram…";
    return d;
  }

  function sectionEl(label, icon, contentNode) {
    if (!contentNode) return null;
    var s = el("div", { class: "section" });
    s.appendChild(el("div", { class: "s-label" }, [icon ? icon + " " : "", label]));
    s.appendChild(contentNode);
    return s;
  }

  /* ---------- concept card ---------- */
  function conceptCard(c, lane, opts) {
    opts = opts || {};
    var learned = Store.isLearned(c.uid);
    var card = el("div", { class: "concept" + (learned ? " learned" : "") + (opts.open ? " open" : ""), id: "c-" + c.uid });

    var titleWrap = el("div", { class: "c-title" }, [
      el("h3", null, c.title),
      el("div", { class: "c-term" }, c.term || "")
    ]);
    var head = el("div", { class: "concept-head" }, [
      el("span", { class: "twist", "aria-hidden": "true" }, "▶"),
      titleWrap
    ]);
    if (c.uncertain) head.appendChild(el("span", { class: "badge-uncertain", title: "Some specifics are preview/internal — verify against official docs." }, "⚠ verify"));
    (c.tags || []).slice(0, 3).forEach(function (t) { head.appendChild(el("span", { class: "tag" }, t)); });

    var check = el("label", { class: "learn-check", title: "Mark this concept learned" }, [
      el("input", { type: "checkbox" }),
      el("span", null, learned ? "Learned" : "Mark learned")
    ]);
    var cb = check.querySelector("input");
    cb.checked = learned;
    check.addEventListener("click", function (e) { e.stopPropagation(); });
    cb.addEventListener("change", function () {
      Store.setLearned(c.uid, cb.checked);
      card.classList.toggle("learned", cb.checked);
      check.querySelector("span").textContent = cb.checked ? "Learned" : "Mark learned";
      updateProgressUI();
    });
    head.appendChild(check);

    var body = el("div", { class: "concept-body" });
    body.appendChild(sectionEl("First principles · why it exists", "🧭", el("div", { class: "prose", html: md(c.firstPrinciples) })));

    var defWrap = el("div", { class: "prose" });
    defWrap.appendChild(el("p", { html: U.inlineMd(esc(c.definition)) }));
    body.appendChild(sectionEl("Definition", "📖", defWrap));
    if (c.analogy) body.appendChild(sectionEl("Analogy", "💡", el("div", { class: "analogy-box", html: U.inlineMd(esc(c.analogy)) })));
    if (c.mentalModel) body.appendChild(sectionEl("Mental model", "🧠", el("div", { class: "prose", html: md(c.mentalModel) })));

    var diag = diagramBlock(c.diagram);
    if (diag) body.appendChild(sectionEl("Diagram", "🗺️", diag));

    var code = codeBlock(c.code);
    if (code) body.appendChild(sectionEl("Worked example", "⌨️", code));

    if (c.drills && c.drills.length) {
      var drillWrap = el("div");
      c.drills.forEach(function (d) {
        var dr = el("div", { class: "drill" }, [ el("div", { class: "q", html: U.inlineMd(esc(d.q)) }) ]);
        var btn = el("button", { class: "reveal", type: "button" }, "Show answer");
        var ans = el("div", { class: "a", html: U.inlineMd(esc(d.a)) });
        btn.addEventListener("click", function () { dr.classList.add("show"); });
        dr.appendChild(btn); dr.appendChild(ans); drillWrap.appendChild(dr);
      });
      body.appendChild(sectionEl("Drill · rep it out", "🎯", drillWrap));
    }

    if (c.teachBack) body.appendChild(sectionEl("Teach it back", "🗣️", el("div", { class: "teachback", html: U.inlineMd(esc(c.teachBack)) })));

    if (c.glossary && c.glossary.length) {
      var gi = el("div", { class: "gloss-inline" });
      c.glossary.forEach(function (g) { gi.appendChild(el("span", { class: "gterm", title: g.definition }, g.term)); });
      body.appendChild(sectionEl("Key terms", "🔤", gi));
    }

    if (c.sources && c.sources.length) {
      var ul = el("ul", { class: "sources-list" });
      c.sources.forEach(function (s) {
        ul.appendChild(el("li", null, el("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.title || s.url)));
      });
      body.appendChild(sectionEl("Official sources", "📚", ul));
    }

    head.addEventListener("click", function () {
      card.classList.toggle("open");
      if (card.classList.contains("open")) { renderPendingDiagrams(); highlightAll(card); }
    });

    card.appendChild(head); card.appendChild(body);
    return card;
  }

  /* expose pieces used by later part */
  window.__FSA_APP = {
    U: U, DATA: DATA, EXTRAS: EXTRAS, LANES: LANES, byLane: byLane,
    conceptByUid: conceptByUid, allConcepts: allConcepts, TOTAL_CONCEPTS: TOTAL_CONCEPTS,
    conceptCard: conceptCard, codeBlock: codeBlock, diagramBlock: diagramBlock,
    sectionEl: sectionEl, renderPendingDiagrams: renderPendingDiagrams, highlightAll: highlightAll
  };
})();
