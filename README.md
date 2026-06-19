<div align="center">

# ◆ Agentic Design Academy

### An interactive, extensible curriculum for **context-aware & platform-aware** agentic AI system design — now with a full **Azure AI Foundry SDK + MCP** track.

Learn how the best teams build agents that sense the screen, the app, and even the cursor —
then design your own. Then go deeper: deploy a model in **Azure AI Foundry**, call it from code,
and wire a Foundry agent to **ICM**, **Kusto**, and **Azure DevOps** over **MCP**, authenticated
with **managed identity only — never keys**.

**▶ Live site:** `https://bharath-varma-p.github.io/Exploring_ideas/` *(after you enable Pages — see below)*

</div>

---

## What's inside

| | |
|---|---|
| **189 lessons** across 11 lanes | Every concept taught from first principles → analogy → diagram → real example → drill → "teach it back" |
| **501-term glossary** | Every term defined before it's used; A–Z index of everything |
| **10 product teardowns** | Whoop, Gemini, Claude, Cursor, Perplexity, ChatGPT, Copilot, Arc/Dia, Raycast, Notion AI |
| **182 quiz questions** | Instant-feedback drills, per-lane quizzes, and a final self-test |
| **Flashcard drill mode** | Auto-generated from every lesson's drills, filterable by lane |
| **Progress tracking** | Mark concepts learned; persists in `localStorage` |
| **Change catalog** | One place to see merged updates, with category filters and live GitHub refresh |
| **Command palette** | `⌘K` / `Ctrl+K` global search across patterns, teardowns, terms, and the Foundry track |

### The lanes

**Agentic design (the original 5):**
1. 🧩 **Agentic Architecture & Patterns** — ReAct, planner-executor, multi-agent, tool use, RAG, memory, reflection, routing, guardrails, HITL.
2. 🛰️ **Context & Platform Awareness** — sensing cursor/selection/screen/app/history/OS, accessibility APIs, permissions, and deciding "where to go and what to search."
3. ✨ **UI/UX & Engagement** — streaming, motion, microinteractions, latency masking, trust, onboarding, and the *ethical* Hook model.
4. 🔍 **Real-World Teardowns** — product → context signals → patterns → UX moves → sources.
5. 📐 **System-Design Framework & Blueprint** — a repeatable method, applied to a full cursor/context/platform-aware desktop-agent build blueprint.

**Azure AI Foundry SDK + MCP (the 6 new lanes — managed identity only, never keys):**
6. 🏗️ **Azure AI Foundry & SDK** — hubs, projects, resources, portal vs SDK, `AIProjectClient`, connections, config.
7. 🔐 **Managed Identity (Keyless Auth)** — Entra tokens, IMDS, system- vs user-assigned identity, `DefaultAzureCredential`, RBAC, zero secrets.
8. 🚀 **Model Deployment & Inference** — model catalog, deployments, endpoints, versions, chat completions, streaming, tokens, error handling.
9. 🔌 **MCP & Foundry Agents** — the Model Context Protocol (servers, tools, transports, JSON-RPC) and the Foundry Agent Service (threads, runs, tool calling).
10. 🛠️ **MCP Connectors: ICM, Kusto, ADO** — wire agents to real systems: ICM incidents, Kusto/ADX KQL, and Azure DevOps work items/pipelines/repos.
11. 🎖️ **Reference Architecture & Teaching Kit** — the whole stack on one page (end-to-end diagram), a present-it deck, and a teach-it-back capstone self-test.

> The Foundry track was built by **10 specialized subagents** (one per domain, no overlap), each
> teaching its lane from first principles, then integrated into this academy's shared content schema
> so the sidebar, search, A–Z index, glossary, flashcards, and quizzes all pick it up automatically.

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
│   ├── architecture/         ← agentic pattern/concept lessons
│   ├── context-awareness/
│   ├── uiux/
│   ├── teardowns/
│   ├── framework/
│   ├── foundry-core/         ← Azure AI Foundry & SDK
│   ├── foundry-auth/         ← managed identity (keyless auth)
│   ├── foundry-models/       ← deployment & inference
│   ├── foundry-mcp/          ← MCP & Foundry agents
│   ├── foundry-connectors/   ← ICM · Kusto · ADO over MCP
│   └── foundry-capstone/     ← reference architecture, teaching kit, self-test
├── glossary.json             ← optional standalone terms
├── quizzes/                  ← optional curated quiz banks (e.g. final-exam.json)
├── data.json                 ← GENERATED bundle the site loads (don't hand-edit)
└── manifest.json             ← GENERATED index
```

---

## 🚀 Deploy to GitHub Pages (free, $0)

This repo ships a GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
that builds the content bundle and deploys on every push to `main`.
That same build now regenerates a structured **Change Catalog** from git history, so each merge to `main` updates the catalog automatically.

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
`content/data.json` (the bundle the site loads) and `content/manifest.json`. It also builds a structured
change catalog (recent commits, merge detection, impacted areas) inside `content/data.json`. CI runs it before every deploy.

---

## How this was built

The original 5 agentic-design lanes were written by 5 specialized subagents (one per lane, different models).
The 6 Foundry lanes were written by 10 more subagents — one per domain (Foundry fundamentals, SDK core,
managed identity, model deployment, inference, MCP fundamentals, Foundry agents, and the ICM/Kusto/ADO
connectors) — then converted into this academy's lesson schema so everything lives in one site.

| Lane | Model | Why |
|---|---|---|
| Architecture & patterns | Claude Opus 4.8 | Deepest reasoning for precise pattern trade-offs |
| Context & platform awareness | GPT-5.5 | Strong systems reasoning about OS/sensing/permissions |
| UI/UX & engagement | Gemini 3.1 Pro | Design & motion sensibility, UX breadth |
| Real-world teardowns | GPT-5.5 | Broad, source-grounded research synthesis |
| Framework & blueprint | Claude Opus 4.8 | Synthesis & end-to-end design rigor |
| Azure AI Foundry SDK + MCP (×10 lanes) | Claude Opus 4.8 | First-principles teaching, managed-identity-only, A–Z coverage |

Sources are linked on every lesson and flagged `verified` / `unverified` for honesty. Foundry features that
are preview or internal are called out as such rather than guessed.

## License

[MIT](LICENSE).
