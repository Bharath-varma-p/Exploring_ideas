// render.js — markdown, mermaid, syntax highlighting, and tiny DOM helpers.

/** Create a DOM element. h('div', {class:'x'}, child, 'text') */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function esc(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Markdown ----------
let markedReady = false;
function configureMarked() {
  if (markedReady || !window.marked) return;
  window.marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false });
  markedReady = true;
}

/** Render markdown string -> HTML string (mermaid fences preserved as divs). */
export function md(src = "") {
  configureMarked();
  if (!window.marked) return `<pre>${esc(src)}</pre>`;
  let html = window.marked.parse(src);
  return html;
}

/** Enhance a container after innerHTML: mermaid, highlight, copy buttons, external links, anchors. */
export function enhance(container) {
  // Mermaid fenced blocks -> .mermaid divs
  container.querySelectorAll('pre > code.language-mermaid').forEach((code) => {
    const div = h("div", { class: "mermaid" });
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });
  // Code blocks: highlight + copy + language label
  container.querySelectorAll("pre > code").forEach((code) => {
    const langMatch = (code.className || "").match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "";
    if (lang && lang !== "mermaid") code.innerHTML = highlight(code.textContent, lang);
    const pre = code.parentElement;
    if (pre.dataset.enhanced) return;
    pre.dataset.enhanced = "1";
    const bar = h("div", { class: "code-bar" },
      h("span", { class: "code-lang" }, lang || "text"),
      h("button", { class: "code-copy", type: "button", title: "Copy",
        onClick: () => copyText(code.textContent) }, "Copy"));
    pre.prepend(bar);
  });
  // External links open in new tab
  container.querySelectorAll('a[href^="http"]').forEach((a) => { a.target = "_blank"; a.rel = "noopener noreferrer"; });
  // Heading anchors
  container.querySelectorAll("h2[id], h3[id]").forEach((hd) => {
    hd.classList.add("anchored");
  });
  renderMermaid(container);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch { toast("Copy failed", true); }
}

// ---------- Mermaid (lazy CDN load with graceful fallback) ----------
let mermaidPromise = null;
function loadMermaid() {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")
    .then((m) => {
      const dark = document.documentElement.dataset.theme !== "light";
      m.default.initialize({ startOnLoad: false, securityLevel: "loose",
        theme: dark ? "dark" : "neutral",
        themeVariables: { fontFamily: "inherit", primaryColor: dark ? "#1b2233" : "#eef2ff" } });
      return m.default;
    })
    .catch((e) => { console.warn("Mermaid load failed", e); return null; });
  return mermaidPromise;
}

export async function renderMermaid(container) {
  const nodes = [...container.querySelectorAll(".mermaid:not([data-rendered])")];
  if (!nodes.length) return;
  const mermaid = await loadMermaid();
  for (const node of nodes) {
    node.dataset.rendered = "1";
    const code = node.textContent.trim();
    try {
      if (!mermaid) throw new Error("no mermaid");
      const id = "mmd-" + Math.random().toString(36).slice(2);
      const { svg } = await mermaid.render(id, code);
      node.innerHTML = svg;
      node.classList.add("rendered");
    } catch (e) {
      node.innerHTML = `<pre class="mermaid-fallback"><code>${esc(code)}</code></pre>`;
    }
  }
}

export function reRenderMermaidTheme() {
  // force reload theme on next render by resetting promise + cached nodes
  mermaidPromise = null;
  document.querySelectorAll(".mermaid[data-rendered]").forEach((n) => {
    const code = n.dataset.src;
    if (code) { n.textContent = code; n.removeAttribute("data-rendered"); n.classList.remove("rendered"); }
  });
}

// ---------- Tiny syntax highlighter (regex-based, dependency-free) ----------
const KEYWORDS = {
  js: "const let var function return if else for while of in new class extends import from export default async await try catch finally throw typeof instanceof null undefined true false this =>",
  ts: "const let var function return if else for while of in new class extends implements interface type import from export default async await try catch finally throw typeof null undefined true false this string number boolean any void =>",
  python: "def return if elif else for while in not and or import from as class try except finally raise with lambda None True False self yield async await print",
  bash: "if then else fi for in do done while case esac function echo export cd ls cat curl sudo npm node git",
  json: "true false null",
};
KEYWORDS.javascript = KEYWORDS.js; KEYWORDS.typescript = KEYWORDS.ts; KEYWORDS.py = KEYWORDS.python; KEYWORDS.sh = KEYWORDS.bash; KEYWORDS.shell = KEYWORDS.bash;

export function highlight(code, lang) {
  const safe = esc(code);
  const kw = (KEYWORDS[lang] || "").split(/\s+/).filter(Boolean);
  const tokens = [];
  const stash = (cls, text) => { tokens.push(`<span class="tok-${cls}">${text}</span>`); return `\u0000${tokens.length - 1}\u0000`; };
  let out = safe;
  // strings
  out = out.replace(/(&quot;|&#39;|`)(?:\\.|(?!\1).)*\1/g, (m) => stash("str", m));
  // comments
  if (lang === "python" || lang === "bash" || lang === "sh" || lang === "shell" || lang === "py")
    out = out.replace(/#.*$/gm, (m) => stash("com", m));
  else out = out.replace(/\/\/.*$/gm, (m) => stash("com", m)).replace(/\/\*[\s\S]*?\*\//g, (m) => stash("com", m));
  // numbers
  out = out.replace(/\b(\d+(\.\d+)?)\b/g, (m) => stash("num", m));
  // keywords
  if (kw.length) {
    const re = new RegExp("\\b(" + kw.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "g");
    out = out.replace(re, (m) => stash("kw", m));
  }
  // restore
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[+i]);
  return out;
}

// ---------- Toast ----------
export function toast(msg, isError = false) {
  let host = document.getElementById("toast-host");
  if (!host) { host = h("div", { id: "toast-host" }); document.body.append(host); }
  const t = h("div", { class: "toast" + (isError ? " toast-error" : "") }, msg);
  host.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}
