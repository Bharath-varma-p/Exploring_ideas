<div align="center">

# ◆ Agentic Design Academy

### An interactive, extensible curriculum for **context-aware & platform-aware** agentic AI system design.

Learn how the best teams build agents that sense the screen, the app, and even the cursor —
then design your own. Patterns · real product teardowns · a system-design framework · quizzes · flashcards.

**▶ Live site:** `https://bharath-varma-p.github.io/Exploring_ideas/` *(after you enable Pages — see below)*

</div>

---

## What's inside

| | |
|---|---|
| **54 lessons** across 5 lanes | Every concept taught from first principles → analogy → diagram → real example → drill → "teach it back" |
| **136-term glossary** | Every term defined before it's used; A–Z index of everything |
| **10 product teardowns** | Whoop, Gemini, Claude, Cursor, Perplexity, ChatGPT, Copilot, Arc/Dia, Raycast, Notion AI |
| **102 quiz questions** | Instant-feedback drills + a 15-question final self-test |
| **Flashcard drill mode** | Auto-generated from every lesson's drills, filterable by lane |
| **Progress tracking** | Mark concepts learned; persists in `localStorage` |
| **Command palette** | `⌘K` / `Ctrl+K` global search across patterns, teardowns, and terms |

### The five lanes
1. 🧩 **Agentic Architecture & Patterns** — ReAct, planner-executor, multi-agent, tool use, RAG, memory, reflection, routing, guardrails, HITL.
2. 🛰️ **Context & Platform Awareness** — sensing cursor/selection/screen/app/history/OS, accessibility APIs, permissions, and deciding "where to go and what to search."
3. ✨ **UI/UX & Engagement** — streaming, motion, microinteractions, latency masking, trust, onboarding, and the *ethical* Hook model.
4. 🔍 **Real-World Teardowns** — product → context signals → patterns → UX moves → sources.
5. 📐 **System-Design Framework & Blueprint** — a repeatable method, applied to a full cursor/context/platform-aware desktop-agent build blueprint.

> Built by **5 specialized AI subagents** (one per lane, different models — see [`CREDITS`](#how-this-was-built)), each researching the real world and writing into one shared schema.

---

## Run it locally

Zero dependencies. You just need Node 18+.

```bash
npm run build     # validate + bundle all lesson JSON into content/data.json
npm run serve     # static server at http://localhost:8080
# or do both:
npm run dev
```

Open <http://localhost:8080>.

---

## 🌱 Extend it in one file (the extensibility contract)

This site is **content-driven**. You grow it for years by dropping in small JSON files — no code changes.

1. Create `content/lessons/<lane>/<your-id>.json`.
2. Fill the **6 required fields** (`id`, `title`, `lane`, `type`, `summary`, `body`) plus any rich extras
   (`diagram`, `examples`, `drills`, `quiz`, `sources`, `glossary`, `teachItBack`, …).
3. Run `npm run build` (or just push — CI rebuilds). **The site picks it up automatically** — sidebar,
   search, A–Z index, glossary, flashcards and quizzes all populate themselves.

The full schema, field rules, and how each field powers a feature live in **[`CONTENT_SCHEMA.md`](CONTENT_SCHEMA.md)**.
To add a whole new **lane**, add one entry to the `LANES` array in `tools/build.mjs` and create the folder.

```
content/
├── lessons/
│   ├── architecture/      ← drop pattern/concept lessons here
│   ├── context-awareness/
│   ├── uiux/
│   ├── teardowns/
│   └── framework/
├── glossary.json          ← optional standalone terms
├── quizzes/               ← optional curated quiz banks (e.g. final-exam.json)
├── data.json              ← GENERATED bundle the site loads (don't hand-edit)
└── manifest.json          ← GENERATED index
```

---

## 🚀 Deploy to GitHub Pages (free, $0)

This repo ships a GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
that builds the content bundle and deploys on every push to `main`.

**One-time setup:**
1. Push this code to GitHub on the **`main`** branch (the repo must be **public** for free Pages).
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. That's it. The next push to `main` builds and deploys automatically.

Your site will be live at:

```
https://<your-username>.github.io/<repo-name>/
```

For this repo that's **`https://bharath-varma-p.github.io/Exploring_ideas/`**.

You can also trigger a deploy manually from the **Actions** tab → *Deploy to GitHub Pages* → **Run workflow**.

> **Cost:** $0. GitHub Pages is free for public repositories. No backend, no database, no server bills.
> **Note:** Pages on the free tier requires a **public** repo (or GitHub Pro/Team/Enterprise for private).

---

## Tech & design

- **Pure static** — vanilla JS (ES modules), no framework, no bundler, no backend.
- **Markdown** via vendored [`marked`](https://github.com/markedjs/marked) (`lib/marked.min.js`).
- **Diagrams** via [Mermaid](https://mermaid.js.org/), lazy-loaded from CDN only on pages that need it (graceful code fallback offline).
- **Syntax highlighting** via a tiny dependency-free regex highlighter.
- **Accessible & responsive** — keyboard-navigable, mobile drawer, dark/light themes, `prefers-reduced-motion` respected.
- The site itself demonstrates the UX patterns it teaches (streaming-style reveals, microinteractions, a `⌘K` palette, flip-card flashcards).

### Build pipeline

`tools/build.mjs` (zero-dep Node) walks `content/lessons/**`, validates every file against the schema
(required fields, unique kebab-case ids, valid enums, in-range quiz answers, lane/folder match), then emits
`content/data.json` (the bundle the site loads) and `content/manifest.json`. CI runs it before every deploy.

---

## How this was built

Five specialized subagents, one per lane, each given the shared content schema and a research+writing brief:

| Lane | Model | Why |
|---|---|---|
| Architecture & patterns | Claude Opus 4.8 | Deepest reasoning for precise pattern trade-offs |
| Context & platform awareness | GPT-5.5 | Strong systems reasoning about OS/sensing/permissions |
| UI/UX & engagement | Gemini 3.1 Pro | Design & motion sensibility, UX breadth |
| Real-world teardowns | GPT-5.5 | Broad, source-grounded research synthesis |
| Framework & blueprint | Claude Opus 4.8 | Synthesis & end-to-end design rigor |

Sources are linked on every lesson and flagged `verified` / `unverified` for honesty.

## License

[MIT](LICENSE).
