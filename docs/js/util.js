/* ============================================================
   util.js — escaping, tiny markdown, storage, clipboard helpers
   No dependencies. Exposed on window.FSA.
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
    });
  }

  // Inline formatting on already-escaped text.
  function inlineMd(s) {
    var out = s.replace(/`([^`]+)`/g, function (_, c) { return "<code>" + c + "</code>"; });
    out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + "</a>";
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
    out = out.replace(/(^|[^_\w])_([^_\n]+)_(?![_\w])/g, "$1<em>$2</em>");
    return out;
  }

  // Minimal, safe markdown: escapes first, then applies block + inline rules.
  function mdToHtml(src) {
    if (!src) return "";
    var lines = String(src).replace(/\r/g, "").split("\n");
    var html = "", i = 0, para = [];
    function flush() { if (para.length) { html += "<p>" + inlineMd(esc(para.join(" "))) + "</p>"; para = []; } }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\s*```/.test(line)) {
        flush();
        var lang = line.replace(/```/, "").trim();
        i++; var buf = [];
        while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        html += '<pre class="code"><code class="language-' + esc(lang) + '">' + esc(buf.join("\n")) + "</code></pre>";
        continue;
      }
      var hm = line.match(/^(#{1,6})\s+(.*)$/);
      if (hm) { flush(); var lvl = Math.min(hm[1].length + 3, 6); html += "<h" + lvl + ">" + inlineMd(esc(hm[2])) + "</h" + lvl + ">"; i++; continue; }
      if (/^\s*[-*]\s+/.test(line)) {
        flush(); var u = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { u.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
        html += "<ul>" + u.map(function (it) { return "<li>" + inlineMd(esc(it)) + "</li>"; }).join("") + "</ul>";
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        flush(); var o = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { o.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
        html += "<ol>" + o.map(function (it) { return "<li>" + inlineMd(esc(it)) + "</li>"; }).join("") + "</ol>";
        continue;
      }
      if (/^\s*$/.test(line)) { flush(); i++; continue; }
      para.push(line.trim()); i++;
    }
    flush();
    return html;
  }

  // Highlight a snippet of plain text by wrapping matches of `q` in <mark>.
  function highlightTerms(text, q) {
    var safe = esc(text);
    if (!q) return safe;
    var terms = q.split(/\s+/).filter(Boolean).map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    if (!terms.length) return safe;
    var re = new RegExp("(" + terms.join("|") + ")", "gi");
    return safe.replace(re, "<mark>$1</mark>");
  }

  function snippet(text, q, len) {
    len = len || 160;
    var t = String(text || "");
    if (q) {
      var idx = t.toLowerCase().indexOf(q.split(/\s+/)[0].toLowerCase());
      if (idx > 40) t = "…" + t.slice(idx - 30);
    }
    if (t.length > len) t = t.slice(0, len) + "…";
    return t;
  }

  var Store = {
    KEY: "fsa.v1",
    data: {},
    init: function () { try { this.data = JSON.parse(localStorage.getItem(this.KEY) || "{}"); } catch (e) { this.data = {}; } return this; },
    save: function () { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) {} },
    isLearned: function (id) { return !!(this.data.learned && this.data.learned[id]); },
    setLearned: function (id, val) {
      this.data.learned = this.data.learned || {};
      if (val) this.data.learned[id] = 1; else delete this.data.learned[id];
      this.save();
    },
    learnedSet: function () { return this.data.learned || {}; },
    learnedCount: function () { return this.data.learned ? Object.keys(this.data.learned).length : 0; },
    get: function (k, d) { return k in this.data ? this.data[k] : d; },
    set: function (k, v) { this.data[k] = v; this.save(); }
  };

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }).catch(function () { return fallbackCopy(t); });
    }
    return Promise.resolve(fallbackCopy(t));
  }
  function fallbackCopy(t) {
    try {
      var ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = document.execCommand("copy"); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return; n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  window.FSA = { esc: esc, mdToHtml: mdToHtml, inlineMd: inlineMd, highlightTerms: highlightTerms, snippet: snippet, Store: Store.init(), copyText: copyText, debounce: debounce, el: el };
})();
