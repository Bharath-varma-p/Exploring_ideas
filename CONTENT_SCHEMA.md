# Content Schema & Extensibility Contract

This site is **content-driven**. You grow it by adding small JSON files — no code changes.

## TL;DR — add a lesson in 3 steps
1. Create a file: `content/lessons/<lane>/<your-id>.json`
2. Fill it using the schema below (only 6 fields are required).
3. Run `npm run build` (or just push — CI rebuilds). Done. The site picks it up.

`npm run build` validates every file, then bundles them into `content/data.json`
(what the site actually loads) and `content/manifest.json` (a human-readable index).

---

## Lanes
Lessons live under one of five lanes (the folder name = the `lane` value):

| folder / lane         | what belongs here |
|-----------------------|-------------------|
| `architecture`        | agentic patterns & components (ReAct, planner-executor, RAG, memory, guardrails…) |
| `context-awareness`   | context- & platform-awareness, sensing signals, decision-making |
| `uiux`                | conversational UX, motion, microinteractions, ethical engagement |
| `teardowns`           | real-product teardown cards |
| `framework`           | system-design framework, reference, build blueprint |

To add a **new lane**: create `content/lessons/<lane>/`, then add one entry to the
`LANES` array in `tools/build.mjs` (`id`, `title`, `blurb`, `icon`, `order`).

---

## Lesson schema

```jsonc
{
  // ---- REQUIRED ----
  "id": "react",                       // unique, kebab-case, stable (used in URLs)
  "title": "ReAct — Reason + Act",
  "lane": "architecture",              // must match the folder it lives in
  "type": "pattern",                   // concept | pattern | teardown | framework | blueprint
  "summary": "One–two sentence hook shown in cards and search.",
  "body": "## First principles\nMarkdown. Use ## headings...",

  // ---- RECOMMENDED (follow the teaching methodology) ----
  "order": 20,                          // sort order within the lane (ascending)
  "tags": ["reasoning", "tool-use"],
  "analogy": "Vivid one-liner analogy.",
  "diagram": "flowchart TD\n  A[Think] --> B[Act] --> C[Observe] --> A",  // Mermaid, NO ``` fence
  "examples": [
    { "product": "Cursor", "what": "How they use it, concretely.", "source": "https://..." }
  ],
  "drills": [
    { "q": "Practice question?", "a": "Crisp answer." }
  ],
  "teachItBack": "A 3-sentence script the learner can say to a peer.",
  "sources": [
    { "title": "ReAct (Yao et al., 2022)", "url": "https://arxiv.org/abs/2210.03629", "verified": true }
  ],
  "related": ["planner-executor", "reflection"],   // ids of related lessons
  "glossary": [
    { "term": "ReAct", "definition": "Interleaving reasoning traces with tool actions in a loop." }
  ],
  "quiz": [
    {
      "q": "Question?",
      "choices": ["A", "B", "C", "D"],
      "answer": 1,                      // index of the correct choice (0-based)
      "explanation": "Why B is right."
    }
  ],

  // ---- PATTERN-ONLY (type=="pattern") ----
  "problem": "The recurring problem this pattern addresses.",
  "forces": ["competing concern", "constraint"],
  "solution": "The core idea in 1–3 sentences.",
  "tradeoffs": ["cost/latency", "failure mode"],

  // ---- TEARDOWN-ONLY (type=="teardown") ----
  "product": "Whoop",
  "contextSignals": ["sleep", "HRV", "strain", "time-of-day"],
  "patterns": ["proactive nudge", "summarize-then-recommend"],
  "uxMoves": ["daily ritual", "single headline metric"]
}
```

### Field rules
- `id` must be globally unique across all lessons and kebab-case (`[a-z0-9-]`).
- `lane` must equal the folder name the file lives in.
- `type` must be one of the enum values.
- `diagram` holds raw Mermaid (no triple-backtick fence; the site renders it).
- `quiz[].answer` is a 0-based index into `choices`.
- `sources[].verified`: set `false` if you could not confirm the link is live/correct.
- Everything except the 6 required fields is optional, but lessons are richer (and the
  quiz/flashcards/glossary fill out) when you include `drills`, `quiz`, `glossary`,
  `examples`, `sources`, and a `diagram`.

### How optional content powers features
- **Flashcards** are generated from every lesson's `drills` (front = `q`, back = `a`).
- **Quiz / final exam** aggregates every lesson's `quiz` questions.
- **Glossary / A–Z index** merges every lesson's `glossary` entries (+ `content/glossary.json`).
- **Teardown gallery** shows every `type:"teardown"` lesson, filterable by `product`/`patterns`.
- **Search** indexes `title`, `summary`, `tags`, `body`, and glossary terms.
- **Progress** is tracked per lesson id in `localStorage`.

---

## Other content files
- `content/glossary.json` — optional array of `{ term, definition, related?, lane? }`
  for terms that don't belong to a single lesson.
- `content/quizzes/*.json` — optional extra quiz banks: `{ id, title, questions:[ {q,choices,answer,explanation} ] }`.

## Generated files (do not hand-edit)
- `content/data.json` — the bundle the site loads.
- `content/manifest.json` — index of files/lanes/counts.

Run `npm run build` after any content change. CI runs it automatically on push.
