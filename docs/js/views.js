/* ============================================================
   views.js — routes, views, sidebar, search, quiz, flashcards,
   teaching mode, progress UI, bootstrap.
   Depends on window.__FSA_APP (from app.js).
   ============================================================ */
(function () {
  "use strict";
  var A = window.__FSA_APP;
  var U = A.U, el = U.el, esc = U.esc, md = U.mdToHtml, Store = U.Store;
  var LANES = A.LANES, byLane = A.byLane, allConcepts = A.allConcepts;
  var conceptByUid = A.conceptByUid, TOTAL = A.TOTAL_CONCEPTS;
  var EXTRAS = A.EXTRAS;

  var view = document.getElementById("view");
  var sidebarInner = document.getElementById("sidebarInner");

  function setTitle(t) { document.title = t ? t + " · Foundry SDK Academy" : "Foundry SDK Academy"; }
  function clear() { view.innerHTML = ""; }
  function mount(node) { clear(); view.appendChild(node); window.scrollTo(0, 0); A.renderPendingDiagrams(); A.highlightAll(view); }

  function laneProgress(lane) {
    var ids = (lane.concepts || []).map(function (c) { return c.uid; });
    var done = ids.filter(function (u) { return Store.isLearned(u); }).length;
    return { done: done, total: ids.length, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
  }

  /* ---------------- Sidebar ---------------- */
  function buildSidebar() {
    sidebarInner.innerHTML = "";
    var navItems = [
      { href: "#/", icon: "🏠", label: "Home" },
      { href: "#/index", icon: "🔠", label: "A–Z Topic Index" },
      { href: "#/glossary", icon: "📓", label: "Glossary" },
      { href: "#/quiz", icon: "❓", label: "Quiz Arena" },
      { href: "#/flashcards", icon: "🃏", label: "Drill Mode" },
      { href: "#/teach", icon: "🗣️", label: "Teaching Mode" },
      { href: "#/architecture", icon: "🏛️", label: "Reference Architecture" },
      { href: "#/kit", icon: "🎒", label: "Teaching Kit" },
      { href: "#/capstone", icon: "🏅", label: "Capstone Self-Test" }
    ];
    sidebarInner.appendChild(navGroup("Explore", navItems.map(function (it) {
      return navLink(it.href, it.icon, it.label, null);
    })));

    var laneLinks = LANES.map(function (lane) {
      var lp = laneProgress(lane);
      var link = navLink("#/lane/" + lane.id, lane.icon, lane.title, (lane.concepts || []).length);
      var bar = el("div", { class: "nav-progress" }, el("i", { style: "width:" + lp.pct + "%" }));
      var box = el("div", { "data-lane": lane.id });
      box.appendChild(link); box.appendChild(bar);
      return box;
    });
    sidebarInner.appendChild(navGroup("Curriculum · 10 lanes", laneLinks));
    highlightActiveNav();
  }
  function navGroup(label, children) {
    var g = el("div", { class: "nav-group" });
    g.appendChild(el("div", { class: "nav-group-label" }, label));
    children.forEach(function (c) { g.appendChild(c); });
    return g;
  }
  function navLink(href, icon, label, count) {
    var a = el("a", { class: "nav-link", href: href }, [
      el("span", { class: "ic", "aria-hidden": "true" }, icon),
      el("span", { class: "lane-name" }, label)
    ]);
    if (count != null) a.appendChild(el("span", { class: "nav-badge" }, String(count)));
    return a;
  }
  function highlightActiveNav() {
    var h = location.hash || "#/";
    sidebarInner.querySelectorAll(".nav-link").forEach(function (a) {
      var href = a.getAttribute("href");
      var active = href === h || (href !== "#/" && h.indexOf(href) === 0);
      a.classList.toggle("active", active);
    });
  }

  /* ---------------- Progress UI ---------------- */
  function updateProgressUI() {
    var done = 0;
    allConcepts.forEach(function (x) { if (Store.isLearned(x.c.uid)) done++; });
    var pct = TOTAL ? Math.round(done / TOTAL * 100) : 0;
    var ring = document.getElementById("ringFg");
    if (ring) ring.setAttribute("stroke-dasharray", pct + ", 100");
    var lbl = document.getElementById("progressLabel");
    if (lbl) lbl.textContent = pct + "%";
    var pill = document.getElementById("globalProgress");
    if (pill) pill.title = done + " of " + TOTAL + " concepts marked learned";
    LANES.forEach(function (lane) {
      var box = sidebarInner.querySelector('[data-lane="' + lane.id + '"] .nav-progress > i');
      if (box) box.style.width = laneProgress(lane).pct + "%";
    });
  }
  A.updateProgressUI = updateProgressUI;

  /* ---------------- Home ---------------- */
  function viewHome() {
    setTitle("");
    var stats = (A.DATA.stats) || {};
    var root = el("div");

    var hero = el("div", { class: "hero" });
    hero.appendChild(el("h1", null, "Master the Microsoft Foundry SDK"));
    hero.appendChild(el("p", null, "A first-principles, A–Z field manual for deploying a model in Azure AI Foundry, calling it from code, and wiring it to ICM, Kusto, and Azure DevOps over MCP — authenticated with managed identity, never keys."));
    hero.appendChild(el("p", { class: "muted" }, "Every concept ships with a plain definition, an analogy, a diagram, runnable code, drills, and a 3-sentence script so you can teach it back."));
    var chips = el("div", { class: "mission" }, [
      el("span", { class: "chip" }, "📚 " + (stats.concepts || TOTAL) + " concepts"),
      el("span", { class: "chip" }, "❓ " + (stats.quiz || 0) + " quiz questions"),
      el("span", { class: "chip" }, "🔤 " + (stats.glossaryTerms || 0) + " glossary terms"),
      el("span", { class: "chip good" }, "🔐 Managed Identity only")
    ]);
    hero.appendChild(chips);
    root.appendChild(hero);

    root.appendChild(el("div", { class: "callout mi" }, [
      el("span", { html: "<b>Golden rule of this academy:</b> every authentication example uses <code>DefaultAzureCredential</code> / <code>ManagedIdentityCredential</code>. We never store API keys, connection-string secrets, or service-principal passwords — and one concept explains exactly why we avoid them." })
    ]));

    root.appendChild(el("h2", { class: "mt0" }, "Start a lane"));
    var grid = el("div", { class: "grid cols-auto" });
    LANES.forEach(function (lane) {
      var lp = laneProgress(lane);
      var tile = el("a", { class: "tile", href: "#/lane/" + lane.id }, [
        el("div", { class: "ic", "aria-hidden": "true" }, lane.icon),
        el("h3", null, lane.title),
        el("p", null, U.snippet(lane.summary, "", 110)),
        el("div", { class: "tile-meta" }, [
          el("span", null, (lane.concepts || []).length + " concepts"),
          el("span", null, lp.done + "/" + lp.total + " learned")
        ]),
        el("div", { class: "barline" }, el("i", { style: "width:" + lp.pct + "%" }))
      ]);
      grid.appendChild(tile);
    });
    root.appendChild(grid);

    root.appendChild(el("h2", null, "How to use this site"));
    var how = el("div", { class: "grid cols-3" });
    [["🧭", "Learn", "Open a lane, expand each concept, read the six teaching blocks, run the code."],
     ["🎯", "Drill", "Use Quiz Arena and Drill Mode flashcards to force recall — military rep style."],
     ["🗣️", "Teach", "Switch to Teaching Mode and present the teach-it-back scripts to a peer."]
    ].forEach(function (x) {
      how.appendChild(el("div", { class: "tile" }, [
        el("div", { class: "ic" }, x[0]), el("h3", null, x[1]), el("p", null, x[2])
      ]));
    });
    root.appendChild(how);

    root.appendChild(el("div", { class: "callout" }, [
      el("span", { html: "New here? Follow the lanes in order — Fundamentals → SDK → <b>Managed Identity</b> → Deployment → Inference → MCP → Agents → ICM / Kusto / ADO — then take the <a href='#/capstone'>Capstone Self-Test</a>." })
    ]));
    mount(root);
  }

  /* ---------------- Lane ---------------- */
  function viewLane(id, openConcept) {
    var lane = byLane[id];
    if (!lane) return viewNotFound();
    setTitle(lane.title);
    var root = el("div");
    root.appendChild(el("div", { class: "crumb" }, [el("a", { href: "#/" }, "Home"), " / ", el("span", null, lane.title)]));
    root.appendChild(el("h1", { class: "page-title" }, [lane.icon + "  ", lane.title]));
    var lp = laneProgress(lane);
    root.appendChild(el("p", { class: "page-sub" }, lane.summary));

    var ctrl = el("div", { class: "row", style: "margin-bottom:14px" }, [
      el("button", { class: "btn", type: "button", onclick: function () { toggleAll(true); } }, "Expand all"),
      el("button", { class: "btn", type: "button", onclick: function () { toggleAll(false); } }, "Collapse all"),
      el("span", { class: "quiz-progress" }, lp.done + " / " + lp.total + " concepts learned")
    ]);
    root.appendChild(ctrl);

    var list = el("div", { class: "concept-list" });
    (lane.concepts || []).forEach(function (c) {
      var open = openConcept && c.uid.split(":")[1] === openConcept;
      list.appendChild(A.conceptCard(c, lane, { open: open }));
    });
    root.appendChild(list);

    if (lane.quiz && lane.quiz.length) {
      root.appendChild(el("div", { class: "callout", style: "margin-top:24px" }, [
        el("span", { html: "Ready to test this lane? " }),
        el("a", { href: "#/quiz/" + lane.id }, "Take the " + lane.title + " quiz →")
      ]));
    }
    mount(root);

    function toggleAll(open) {
      list.querySelectorAll(".concept").forEach(function (card) {
        card.classList.toggle("open", open);
      });
      if (open) { A.renderPendingDiagrams(); A.highlightAll(list); }
    }
    if (openConcept) {
      var target = document.getElementById("c-" + lane.id + ":" + openConcept);
      if (target) { A.renderPendingDiagrams(); A.highlightAll(target); setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 60); }
    }
  }

  /* ---------------- A–Z index ---------------- */
  function viewIndex() {
    setTitle("A–Z Topic Index");
    var entries = [];
    allConcepts.forEach(function (x) {
      entries.push({ term: x.c.term || x.c.title, def: x.c.definition, lane: x.lane, uid: x.c.uid, kind: "concept" });
      (x.c.glossary || []).forEach(function (g) {
        entries.push({ term: g.term, def: g.definition, lane: x.lane, uid: x.c.uid, kind: "term" });
      });
    });
    // de-dup by lowercased term, keep concept over term
    var map = {};
    entries.forEach(function (e) {
      var k = e.term.toLowerCase();
      if (!map[k] || (e.kind === "concept" && map[k].kind !== "concept")) map[k] = e;
    });
    var uniq = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.term.toLowerCase().localeCompare(b.term.toLowerCase()); });

    var buckets = {};
    uniq.forEach(function (e) {
      var ch = e.term[0].toUpperCase();
      if (!/[A-Z]/.test(ch)) ch = "#";
      (buckets[ch] = buckets[ch] || []).push(e);
    });
    var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "A–Z Topic Index"));
    root.appendChild(el("p", { class: "page-sub" }, "Every concept and glossary term across all 10 lanes — " + uniq.length + " entries. Jump by letter; click any entry to open its concept."));

    var jump = el("div", { class: "az-jump" });
    letters.forEach(function (L) {
      var has = !!buckets[L];
      jump.appendChild(el("a", { href: has ? "#az-" + L : "#", class: has ? "" : "empty", onclick: function (e) { if (has) { e.preventDefault(); var t = document.getElementById("az-" + L); if (t) t.scrollIntoView({ block: "start" }); } } }, L));
    });
    root.appendChild(jump);

    letters.forEach(function (L) {
      if (!buckets[L]) return;
      var sec = el("div", { class: "az-section" });
      sec.appendChild(el("h2", { id: "az-" + L }, L));
      buckets[L].forEach(function (e) {
        var entry = el("div", { class: "az-entry" }, [
          el("a", { class: "term", href: "#/concept/" + e.uid }, e.term),
          el("span", { class: "def" }, " — " + U.snippet(e.def, "", 150)),
          el("div", { class: "where" }, (e.kind === "term" ? "term in " : "concept in ") + e.lane.icon + " " + e.lane.title)
        ]);
        sec.appendChild(entry);
      });
      root.appendChild(sec);
    });
    mount(root);
  }

  /* ---------------- Glossary ---------------- */
  function viewGlossary() {
    setTitle("Glossary");
    var map = {};
    allConcepts.forEach(function (x) {
      (x.c.glossary || []).forEach(function (g) {
        var k = g.term.toLowerCase();
        if (!map[k]) map[k] = { term: g.term, def: g.definition, lane: x.lane, uid: x.c.uid };
      });
    });
    var terms = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.term.toLowerCase().localeCompare(b.term.toLowerCase()); });

    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "Glossary"));
    root.appendChild(el("p", { class: "page-sub" }, terms.length + " defined terms. Filter to find one fast — every term links back to the concept that teaches it."));
    var filter = el("input", { id: "glossFilter", class: "select", style: "width:100%;max-width:420px;margin-bottom:16px", type: "search", placeholder: "Filter terms…", "aria-label": "Filter glossary" });
    root.appendChild(filter);
    var grid = el("div", { class: "gloss-grid", id: "glossGrid" });
    function render(q) {
      grid.innerHTML = "";
      var ql = (q || "").toLowerCase();
      var shown = 0;
      terms.forEach(function (t) {
        if (ql && t.term.toLowerCase().indexOf(ql) < 0 && t.def.toLowerCase().indexOf(ql) < 0) return;
        shown++;
        grid.appendChild(el("div", { class: "gloss-card" }, [
          el("div", { class: "gt" }, t.term),
          el("div", { class: "gd" }, t.def),
          el("a", { class: "gw", href: "#/concept/" + t.uid }, "→ " + t.lane.icon + " " + t.lane.title)
        ]));
      });
      if (!shown) grid.appendChild(el("div", { class: "empty-state" }, "No terms match “" + esc(q) + "”."));
    }
    filter.addEventListener("input", U.debounce(function () { render(filter.value); }, 120));
    root.appendChild(grid);
    mount(root);
    render("");
  }

  /* ---------------- Concept deep link ---------------- */
  function viewConcept(uid) {
    var hit = conceptByUid[uid];
    if (!hit) return viewNotFound();
    var laneId = uid.split(":")[0];
    var conceptId = uid.split(":").slice(1).join(":");
    viewLane(laneId, conceptId);
  }

  /* ---------------- Quiz ---------------- */
  function buildQuizPool(laneId) {
    var pool = [];
    LANES.forEach(function (lane) {
      if (laneId && lane.id !== laneId) return;
      (lane.quiz || []).forEach(function (q) { pool.push({ q: q, lane: lane }); });
    });
    return pool;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function viewQuiz(laneId) {
    var lane = laneId ? byLane[laneId] : null;
    setTitle(lane ? lane.title + " Quiz" : "Quiz Arena");
    var root = el("div", { class: "quiz-shell" });
    root.appendChild(el("h1", { class: "page-title" }, lane ? lane.icon + " " + lane.title + " — Quiz" : "❓ Quiz Arena"));

    var controls = el("div", { class: "quiz-controls" });
    var sel = el("select", { class: "select", "aria-label": "Choose quiz scope" });
    sel.appendChild(el("option", { value: "" }, "All lanes (" + buildQuizPool().length + " questions)"));
    LANES.forEach(function (l) { var o = el("option", { value: l.id }, l.icon + " " + l.title + " (" + (l.quiz || []).length + ")"); if (l.id === laneId) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { location.hash = sel.value ? "#/quiz/" + sel.value : "#/quiz"; });
    controls.appendChild(sel);
    var progressLbl = el("span", { class: "quiz-progress" });
    controls.appendChild(progressLbl);
    root.appendChild(controls);

    var holder = el("div");
    root.appendChild(holder);
    mount(root);

    var pool = shuffle(buildQuizPool(laneId));
    if (!pool.length) { holder.appendChild(el("div", { class: "empty-state" }, "No questions for this scope.")); return; }
    var idx = 0, score = 0, answered = false;

    function renderQ() {
      answered = false;
      var item = pool[idx];
      var q = item.q;
      progressLbl.textContent = "Question " + (idx + 1) + " / " + pool.length + " · score " + score;
      holder.innerHTML = "";
      var card = el("div", { class: "qcard" });
      card.appendChild(el("div", { class: "qnum" }, item.lane.icon + " " + item.lane.title));
      card.appendChild(el("div", { class: "qtext", html: U.inlineMd(esc(q.q)) }));
      var opts = el("div", { class: "opts" });
      var keys = ["A", "B", "C", "D", "E", "F"];
      q.options.forEach(function (optText, i) {
        var b = el("button", { class: "opt", type: "button" }, [
          el("span", { class: "opt-key" }, keys[i]),
          el("span", { html: U.inlineMd(esc(optText)) })
        ]);
        b.addEventListener("click", function () {
          if (answered) return;
          answered = true;
          var correct = i === q.answer;
          if (correct) score++;
          opts.querySelectorAll(".opt").forEach(function (o, oi) {
            o.setAttribute("disabled", "true");
            if (oi === q.answer) o.classList.add("correct");
            if (oi === i && !correct) o.classList.add("wrong");
          });
          expl.classList.add("show");
          progressLbl.textContent = "Question " + (idx + 1) + " / " + pool.length + " · score " + score;
          nextBtn.removeAttribute("disabled");
          nextBtn.focus();
        });
        opts.appendChild(b);
      });
      card.appendChild(opts);
      var expl = el("div", { class: "qexplain" }, [el("strong", null, "Why: "), el("span", { html: U.inlineMd(esc(q.explain || "")) })]);
      card.appendChild(expl);
      var foot = el("div", { class: "qfoot" });
      var nextBtn = el("button", { class: "btn primary", type: "button", disabled: "true" }, idx + 1 === pool.length ? "See results" : "Next question →");
      nextBtn.addEventListener("click", function () { idx++; if (idx >= pool.length) renderResult(); else renderQ(); });
      foot.appendChild(el("span", { class: "scorebar" }, "Pick an answer to reveal the explanation."));
      foot.appendChild(nextBtn);
      card.appendChild(foot);
      holder.appendChild(card);
      A.highlightAll(card);
    }
    function renderResult() {
      holder.innerHTML = "";
      var pct = Math.round(score / pool.length * 100);
      var grade = pct >= 90 ? "Outstanding 🎖️" : pct >= 75 ? "Strong 💪" : pct >= 50 ? "Getting there 📈" : "Keep drilling 🔁";
      var res = el("div", { class: "qcard quiz-result" }, [
        el("div", { class: "qnum" }, "Result"),
        el("div", { class: "big ring-grade" }, pct + "%"),
        el("div", null, score + " of " + pool.length + " correct — " + grade),
        el("div", { class: "row", style: "justify-content:center;margin-top:18px;gap:10px" }, [
          el("button", { class: "btn primary", type: "button", onclick: function () { idx = 0; score = 0; pool = shuffle(pool); renderQ(); } }, "Retake"),
          el("a", { class: "btn", href: "#/flashcards" }, "Drill weak spots →")
        ])
      ]);
      holder.appendChild(res);
      progressLbl.textContent = "Done · " + pct + "%";
    }
    renderQ();
  }

  /* ---------------- Flashcards / Drill mode ---------------- */
  function viewFlashcards() {
    setTitle("Drill Mode");
    var root = el("div", { class: "flash-shell" });
    root.appendChild(el("h1", { class: "page-title", style: "text-align:center" }, "🃏 Drill Mode"));
    root.appendChild(el("p", { class: "page-sub", style: "text-align:center" }, "Active recall, military rep style. Read the prompt, say the answer out loud, then flip. Space or click to flip; arrows to move."));

    var controls = el("div", { class: "quiz-controls", style: "justify-content:center" });
    var sel = el("select", { class: "select" });
    sel.appendChild(el("option", { value: "" }, "All lanes"));
    LANES.forEach(function (l) { sel.appendChild(el("option", { value: l.id }, l.icon + " " + l.title)); });
    var modeSel = el("select", { class: "select" });
    [["term", "Term → Definition"], ["teach", "Concept → Teach-back"], ["drill", "Drill Q → A"]].forEach(function (m) { modeSel.appendChild(el("option", { value: m[0] }, m[1])); });
    controls.appendChild(sel); controls.appendChild(modeSel);
    root.appendChild(controls);

    var counter = el("div", { class: "flash-hint", style: "text-align:center" });
    root.appendChild(counter);
    var holder = el("div");
    root.appendChild(holder);
    mount(root);

    var deck = [], pos = 0;
    function build() {
      var laneId = sel.value, mode = modeSel.value;
      deck = [];
      allConcepts.forEach(function (x) {
        if (laneId && x.lane.id !== laneId) return;
        if (mode === "term") {
          (x.c.glossary || []).forEach(function (g) { deck.push({ front: g.term, back: g.definition, lane: x.lane }); });
        } else if (mode === "teach") {
          if (x.c.teachBack) deck.push({ front: x.c.title, back: x.c.teachBack, lane: x.lane });
        } else {
          (x.c.drills || []).forEach(function (d) { deck.push({ front: d.q, back: d.a, lane: x.lane }); });
        }
      });
      deck = shuffle(deck); pos = 0; render();
    }
    function render() {
      holder.innerHTML = "";
      if (!deck.length) { holder.appendChild(el("div", { class: "empty-state" }, "No cards for this selection.")); counter.textContent = ""; return; }
      var card = deck[pos];
      counter.textContent = "Card " + (pos + 1) + " of " + deck.length;
      var fc = el("div", { class: "flashcard", tabindex: "0", role: "button", "aria-label": "Flashcard, activate to flip" });
      var inner = el("div", { class: "flash-inner" }, [
        el("div", { class: "flash-face" }, [
          el("span", { class: "face-label" }, "Prompt"),
          el("span", { class: "lane-tag" }, card.lane.icon + " " + card.lane.title),
          el("div", { class: "face-text", html: U.inlineMd(esc(card.front)) }),
          el("div", { class: "flash-hint", style: "position:absolute;bottom:16px" }, "tap to flip")
        ]),
        el("div", { class: "flash-face flash-back" }, [
          el("span", { class: "face-label" }, "Answer"),
          el("div", { class: "face-text", html: U.inlineMd(esc(card.back)) })
        ])
      ]);
      fc.appendChild(inner);
      fc.addEventListener("click", function () { fc.classList.toggle("flipped"); });
      fc.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fc.classList.toggle("flipped"); } });
      holder.appendChild(fc);

      var ctr = el("div", { class: "flash-controls" }, [
        el("button", { class: "btn", type: "button", onclick: prev }, "← Prev"),
        el("button", { class: "btn", type: "button", onclick: function () { fc.classList.toggle("flipped"); } }, "Flip"),
        el("button", { class: "btn primary", type: "button", onclick: next }, "Next →")
      ]);
      holder.appendChild(ctr);
      fc.focus();
    }
    function next() { if (pos < deck.length - 1) { pos++; render(); } }
    function prev() { if (pos > 0) { pos--; render(); } }
    sel.addEventListener("change", build);
    modeSel.addEventListener("change", build);
    document.addEventListener("keydown", deckKey);
    function deckKey(e) {
      if (location.hash.indexOf("flashcards") < 0) { document.removeEventListener("keydown", deckKey); return; }
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    build();
  }

  /* ---------------- Teaching mode ---------------- */
  function viewTeach() {
    setTitle("Teaching Mode");
    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "🗣️ Teaching Mode"));
    root.appendChild(el("p", { class: "page-sub" }, "A clean, presentation-ready view of every teach-it-back script. Read one per concept to explain the whole stack to your team — no jargon left undefined."));
    LANES.forEach(function (lane) {
      var sec = el("div", { class: "teach-lane" });
      sec.appendChild(el("h2", null, lane.icon + "  " + lane.title));
      (lane.concepts || []).forEach(function (c) {
        if (!c.teachBack) return;
        sec.appendChild(el("div", { class: "teach-item" }, [
          el("div", { class: "tt" }, c.title),
          el("div", { class: "ts", html: U.inlineMd(esc(c.teachBack)) })
        ]));
      });
      root.appendChild(sec);
    });
    mount(root);
  }

  /* ---------------- Reference architecture ---------------- */
  function viewArchitecture() {
    setTitle("Reference Architecture");
    var data = EXTRAS.architecture || {};
    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "🏛️ End-to-End Reference Architecture"));
    root.appendChild(el("p", { class: "page-sub" }, data.intro || ""));
    if (data.diagram) {
      var d = A.diagramBlock(data.diagram);
      if (d) root.appendChild(d);
    }
    (data.steps || []).forEach(function (s, i) {
      root.appendChild(el("div", { class: "arch-step" }, [
        el("div", { class: "n" }, String(i + 1)),
        el("div", { class: "body" }, [el("h4", null, s.title), el("div", { class: "prose", html: md(s.body) })])
      ]));
    });
    if (data.code) {
      root.appendChild(el("h2", null, "Glue-it-together code"));
      var cb = A.codeBlock(data.code);
      if (cb) root.appendChild(cb);
    }
    if (data.note) root.appendChild(el("div", { class: "callout mi", html: data.note }));
    mount(root);
  }

  /* ---------------- Teaching kit ---------------- */
  function viewKit() {
    setTitle("Teaching Kit");
    var kit = EXTRAS.kit || {};
    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "🎒 Teaching Kit"));
    root.appendChild(el("p", { class: "page-sub" }, kit.intro || ""));
    (kit.slides || []).forEach(function (s, i) {
      var box = el("div", { class: "tile", style: "margin-bottom:12px" });
      box.appendChild(el("h3", null, "Slide " + (i + 1) + " · " + s.title));
      var ul = el("ul");
      (s.points || []).forEach(function (p) { ul.appendChild(el("li", { html: U.inlineMd(esc(p)) })); });
      box.appendChild(ul);
      if (s.script) box.appendChild(el("div", { class: "teachback", html: "<b>Say:</b> " + U.inlineMd(esc(s.script)) }));
      root.appendChild(box);
    });
    mount(root);
  }

  /* ---------------- Capstone ---------------- */
  function viewCapstone() {
    setTitle("Capstone Self-Test");
    var cap = EXTRAS.capstone || {};
    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "🏅 Capstone Self-Test"));
    root.appendChild(el("p", { class: "page-sub" }, cap.intro || "Prove mastery: explain each from memory, then check yourself."));
    (cap.challenges || []).forEach(function (ch, i) {
      var dr = el("div", { class: "drill", style: "margin-bottom:10px" }, [el("div", { class: "q" }, (i + 1) + ". " + ch.q)]);
      var btn = el("button", { class: "reveal", type: "button" }, "Show model answer");
      var ans = el("div", { class: "a", html: md(ch.a) });
      btn.addEventListener("click", function () { dr.classList.add("show"); });
      dr.appendChild(btn); dr.appendChild(ans);
      root.appendChild(dr);
    });
    root.appendChild(el("div", { class: "callout", style: "margin-top:20px", html: "Finished? Run the full <a href='#/quiz'>Quiz Arena</a> across all lanes and aim for 90%+." }));
    mount(root);
  }

  /* ---------------- Search ---------------- */
  function viewSearch(q) {
    setTitle("Search: " + q);
    var ql = q.toLowerCase();
    var results = [];
    allConcepts.forEach(function (x) {
      var c = x.c;
      var hay = [c.title, c.term, c.definition, c.firstPrinciples, c.analogy, c.mentalModel, c.teachBack, (c.tags || []).join(" "), (c.code && c.code.content) || "", (c.glossary || []).map(function (g) { return g.term + " " + g.definition; }).join(" ")].join("  ").toLowerCase();
      var score = 0, pos = hay.indexOf(ql);
      if ((c.title + " " + c.term).toLowerCase().indexOf(ql) >= 0) score += 5;
      if (pos >= 0) score += 1;
      if (score > 0) results.push({ x: x, score: score, snipSource: c.definition || c.firstPrinciples });
    });
    results.sort(function (a, b) { return b.score - a.score; });

    var root = el("div");
    root.appendChild(el("h1", { class: "page-title" }, "Search"));
    root.appendChild(el("p", { class: "page-sub" }, results.length + " result" + (results.length === 1 ? "" : "s") + " for “" + esc(q) + "”."));
    if (!results.length) {
      root.appendChild(el("div", { class: "empty-state" }, "Nothing matched. Try a term like “managed identity”, “KQL”, “tool calling”, or “deployment”."));
    }
    results.slice(0, 60).forEach(function (r) {
      var c = r.x.c;
      var a = el("a", { class: "result", href: "#/concept/" + c.uid }, [
        el("div", { class: "r-lane" }, r.x.lane.icon + " " + r.x.lane.title),
        el("div", { class: "r-title", html: U.highlightTerms(c.title + " · " + (c.term || ""), q) }),
        el("div", { class: "r-snip", html: U.highlightTerms(U.snippet(r.snipSource, q, 180), q) })
      ]);
      root.appendChild(a);
    });
    mount(root);
  }

  function viewNotFound() {
    setTitle("Not found");
    mount(el("div", { class: "empty-state" }, [
      el("h2", null, "Page not found"),
      el("p", null, "That route doesn’t exist. "),
      el("a", { class: "btn primary", href: "#/" }, "Back to home")
    ]));
  }

  /* ---------------- Router ---------------- */
  function route() {
    var h = (location.hash || "#/").replace(/^#/, "");
    var parts = h.split("/").filter(Boolean); // e.g. ['lane','sdk-core']
    closeMobileNav();
    if (parts.length === 0) viewHome();
    else if (parts[0] === "lane") viewLane(decodeURIComponent(parts[1] || ""), parts[2] ? decodeURIComponent(parts[2]) : null);
    else if (parts[0] === "concept") viewConcept(decodeURIComponent(parts.slice(1).join("/")));
    else if (parts[0] === "index") viewIndex();
    else if (parts[0] === "glossary") viewGlossary();
    else if (parts[0] === "quiz") viewQuiz(parts[1] ? decodeURIComponent(parts[1]) : null);
    else if (parts[0] === "flashcards") viewFlashcards();
    else if (parts[0] === "teach") viewTeach();
    else if (parts[0] === "architecture") viewArchitecture();
    else if (parts[0] === "kit") viewKit();
    else if (parts[0] === "capstone") viewCapstone();
    else if (parts[0] === "search") viewSearch(decodeURIComponent(parts.slice(1).join("/")));
    else viewNotFound();
    highlightActiveNav();
    updateProgressUI();
  }

  /* ---------------- Search box + shortcuts ---------------- */
  var searchInput = document.getElementById("searchInput");
  var doSearch = U.debounce(function (v) {
    if (v && v.trim().length >= 2) location.hash = "#/search/" + encodeURIComponent(v.trim());
  }, 250);
  searchInput.addEventListener("input", function () { doSearch(searchInput.value); });
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && searchInput.value.trim()) location.hash = "#/search/" + encodeURIComponent(searchInput.value.trim());
    if (e.key === "Escape") { searchInput.value = ""; searchInput.blur(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchInput && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
      e.preventDefault(); searchInput.focus(); searchInput.select();
    }
  });

  /* ---------------- Theme ---------------- */
  var themeToggle = document.getElementById("themeToggle");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    themeToggle.textContent = t === "light" ? "☀️" : "🌙";
    var hl = document.getElementById("hljs-theme");
    if (hl) hl.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/" + (t === "light" ? "github.min.css" : "github-dark.min.css");
    Store.set("theme", t);
  }
  themeToggle.addEventListener("click", function () {
    applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light");
  });

  /* ---------------- Mobile nav ---------------- */
  var sidebar = document.getElementById("sidebar");
  var navToggle = document.getElementById("navToggle");
  var scrim = document.getElementById("scrim");
  function openMobileNav() { sidebar.classList.add("open"); scrim.hidden = false; navToggle.setAttribute("aria-expanded", "true"); }
  function closeMobileNav() { sidebar.classList.remove("open"); scrim.hidden = true; navToggle.setAttribute("aria-expanded", "false"); }
  navToggle.addEventListener("click", function () { sidebar.classList.contains("open") ? closeMobileNav() : openMobileNav(); });
  scrim.addEventListener("click", closeMobileNav);

  /* ---------------- Boot ---------------- */
  function boot() {
    var savedTheme = Store.get("theme", "dark");
    applyTheme(savedTheme);
    buildSidebar();
    var stamp = document.getElementById("buildStamp");
    if (stamp) stamp.textContent = "Curriculum generated " + (A.DATA.generatedAt || "") + " · " + TOTAL + " concepts across " + LANES.length + " lanes.";
    window.addEventListener("hashchange", route);
    route();
  }
  boot();
})();
