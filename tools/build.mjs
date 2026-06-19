#!/usr/bin/env node
/**
 * build.mjs — validate + bundle content into content/data.json (+ manifest.json).
 * Zero dependencies. Node 18+. Run: `npm run build`.
 *
 * Extensibility: drop a JSON file in content/lessons/<lane>/ and re-run.
 * To add a lane, add an entry to LANES below and create the matching folder.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LESSONS_DIR = join(ROOT, "content", "lessons");
const OUT_DATA = join(ROOT, "content", "data.json");
const OUT_MANIFEST = join(ROOT, "content", "manifest.json");
const CHANGE_CATALOG_LIMIT = 40;
const execFileAsync = promisify(execFile);

// ---- Lane registry: edit here to add a lane ----
const LANES = [
  { id: "architecture",      title: "Agentic Architecture & Patterns", icon: "🧩", order: 1,
    blurb: "The reusable building blocks: ReAct, planner-executor, multi-agent, tools, RAG, memory, reflection, routing, guardrails." },
  { id: "context-awareness", title: "Context & Platform Awareness",    icon: "🛰️", order: 2,
    blurb: "How an agent senses the world — cursor, selection, screen, app state, history, device/OS — and decides where to go and what to search." },
  { id: "uiux",              title: "UI/UX & Engagement",              icon: "✨", order: 3,
    blurb: "What makes AI products feel delightful: streaming, motion, microinteractions, trust, onboarding, and ethical habit-forming design." },
  { id: "teardowns",         title: "Real-World Teardowns",            icon: "🔍", order: 4,
    blurb: "What teams actually ship. Product → context signals → patterns → UX moves → sources." },
  { id: "framework",         title: "System-Design Framework & Blueprint", icon: "📐", order: 5,
    blurb: "A repeatable framework to design context+platform+cursor-aware agents, applied to a real build blueprint." },
  { id: "foundry-core",      title: "Azure AI Foundry & SDK",           icon: "🏗️", order: 6,
    blurb: "Foundry fundamentals and the SDK core: hubs, projects, resources, AIProjectClient, connections, and config." },
  { id: "foundry-auth",      title: "Managed Identity (Keyless Auth)",  icon: "🔐", order: 7,
    blurb: "Authenticate everything with managed identity only: Entra tokens, DefaultAzureCredential, RBAC, zero secrets." },
  { id: "foundry-models",    title: "Model Deployment & Inference",     icon: "🚀", order: 8,
    blurb: "Deploy models from the catalog and call them: deployments, endpoints, chat completions, streaming, tokens, errors." },
  { id: "foundry-mcp",       title: "MCP & Foundry Agents",             icon: "🔌", order: 9,
    blurb: "The Model Context Protocol and the Foundry Agent Service: servers, tools, transports, threads, runs, tool calling." },
  { id: "foundry-connectors",title: "MCP Connectors: ICM, Kusto, ADO",  icon: "🛠️", order: 10,
    blurb: "Wire agents to real systems over MCP with managed identity: ICM incidents, Kusto/ADX KQL, and Azure DevOps." },
  { id: "foundry-capstone",  title: "Reference Architecture & Teaching Kit", icon: "🎖️", order: 11,
    blurb: "The whole stack on one page: end-to-end architecture, a present-it deck, and a teach-it-back capstone self-test." },
];
const LANE_IDS = new Set(LANES.map((l) => l.id));
const TYPES = new Set(["concept", "pattern", "teardown", "framework", "blueprint"]);

const errors = [];
const warnings = [];

function parseRepoSlug(remote = "") {
  const match = String(remote).trim().match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
  return match ? match[1] : null;
}

async function readRepoInfo() {
  let branch = "unknown";
  try {
    const { stdout } = await execFileAsync("git", ["branch", "--show-current"], { cwd: ROOT });
    branch = stdout.trim() || branch;
  } catch {
    // optional outside a git checkout
  }

  let slug = null;
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], { cwd: ROOT });
    slug = parseRepoSlug(stdout);
  } catch {
    // optional outside a git checkout
  }

  if (!slug) return { branch, slug: null, owner: null, name: null };
  const [owner, name] = slug.split("/");
  return { branch, slug, owner, name };
}

function classifyChange(subject = "", isMerge = false) {
  if (isMerge) return "merge";
  const s = String(subject).trim().toLowerCase();
  if (/^feat(\(|:|!)/.test(s) || s.startsWith("feat ")) return "feature";
  if (/^fix(\(|:|!)/.test(s) || s.startsWith("fix ")) return "fix";
  if (/^docs(\(|:|!)/.test(s) || s.startsWith("docs ")) return "docs";
  if (/^build(\(|:|!)/.test(s) || s.startsWith("build ")) return "build";
  if (/^content(\(|:|!)/.test(s) || s.startsWith("content ")) return "content";
  if (/^chore(\(|:|!)/.test(s) || s.startsWith("chore ")) return "chore";
  return "other";
}

function inferMergeDomain(subject = "") {
  const match = String(subject).match(/ from ([^\s]+)/i);
  if (!match) return null;
  const ref = match[1].trim();
  const parts = ref.split("/");
  return parts[parts.length - 1] || ref;
}

function inferAreas(files = []) {
  const out = [];
  const seen = new Set();
  for (const file of files) {
    const top = String(file).split("/")[0];
    if (!top || seen.has(top)) continue;
    seen.add(top);
    out.push(top);
    if (out.length >= 6) break;
  }
  return out;
}

async function resolveCatalogBranch(currentBranch = "") {
  const envBranch = process.env.CHANGE_CATALOG_BRANCH || process.env.GITHUB_REF_NAME || "";
  const candidates = [envBranch, "main", "origin/main", currentBranch, "HEAD"].filter(Boolean);
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate) || candidate === "unknown") continue;
    seen.add(candidate);
    try {
      await execFileAsync("git", ["rev-parse", "--verify", "--quiet", candidate], { cwd: ROOT });
      return candidate;
    } catch {
      // keep trying fallbacks
    }
  }
  return "HEAD";
}

async function buildChangeCatalog(repo) {
  const generatedAt = new Date().toISOString();
  const catalogBranch = await resolveCatalogBranch(repo.branch);
  const catalog = {
    generatedAt,
    source: "git-log",
    branch: catalogBranch,
    limit: CHANGE_CATALOG_LIMIT,
    entries: [],
  };

  try {
    const format = "@@@%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%ad%x1f%s";
    const { stdout } = await execFileAsync(
      "git",
      ["log", catalogBranch, "-n", String(CHANGE_CATALOG_LIMIT), "--date=iso-strict", "--name-only", `--pretty=format:${format}`],
      { cwd: ROOT, maxBuffer: 20 * 1024 * 1024 }
    );

    const lines = stdout.split("\n");
    let current = null;
    const flush = () => {
      if (!current) return;
      const parentCount = current.parents.split(/\s+/).filter(Boolean).length;
      const isMerge = parentCount > 1 || /^merge\b/i.test(current.subject);
      catalog.entries.push({
        sha: current.sha,
        shortSha: current.shortSha,
        subject: current.subject,
        body: "",
        author: { name: current.authorName, email: current.authorEmail },
        committedAt: current.committedAt,
        isMerge,
        mergeDomain: isMerge ? inferMergeDomain(current.subject) : null,
        category: classifyChange(current.subject, isMerge),
        filesChanged: current.files.length,
        areas: inferAreas(current.files),
        files: current.files.slice(0, 25),
        commitUrl: repo.slug ? `https://github.com/${repo.slug}/commit/${current.sha}` : null,
      });
      current = null;
    };

    for (const rawLine of lines) {
      if (rawLine.startsWith("@@@")) {
        flush();
        const [sha, shortSha, parents, authorName, authorEmail, committedAt, subject] = rawLine.slice(3).split("\x1f");
        current = {
          sha,
          shortSha,
          parents,
          authorName,
          authorEmail,
          committedAt,
          subject: (subject || shortSha || "").trim(),
          files: [],
        };
        continue;
      }
      if (!current) continue;
      const file = rawLine.trim();
      if (file) current.files.push(file);
    }
    flush();
  } catch (e) {
    warnings.push(`change catalog not generated from git history — ${e.message}`);
  }

  return catalog;
}

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return []; }
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name.endsWith(".json")) files.push(p);
  }
  return files;
}

function validateLesson(obj, file) {
  const rel = file.replace(ROOT + "/", "");
  const req = ["id", "title", "lane", "type", "summary", "body"];
  for (const k of req) {
    if (obj[k] == null || obj[k] === "") errors.push(`${rel}: missing required field "${k}"`);
  }
  if (obj.id && !/^[a-z0-9][a-z0-9-]*$/.test(obj.id)) errors.push(`${rel}: id "${obj.id}" must be kebab-case`);
  if (obj.lane && !LANE_IDS.has(obj.lane)) errors.push(`${rel}: unknown lane "${obj.lane}"`);
  if (obj.type && !TYPES.has(obj.type)) errors.push(`${rel}: unknown type "${obj.type}"`);
  // lane should match folder
  const folderLane = basename(dirname(file));
  if (obj.lane && folderLane !== "lessons" && obj.lane !== folderLane)
    warnings.push(`${rel}: lane "${obj.lane}" != folder "${folderLane}"`);
  // quiz sanity
  if (Array.isArray(obj.quiz)) {
    obj.quiz.forEach((q, i) => {
      if (!q || !q.q || !Array.isArray(q.choices)) errors.push(`${rel}: quiz[${i}] needs q + choices[]`);
      else if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.choices.length)
        errors.push(`${rel}: quiz[${i}].answer out of range`);
    });
  }
  return obj;
}

async function main() {
  const files = await walk(LESSONS_DIR);
  const lessons = [];
  const ids = new Map();
  const repo = await readRepoInfo();

  for (const file of files) {
    let raw;
    try { raw = await readFile(file, "utf8"); }
    catch (e) { errors.push(`${file}: cannot read (${e.message})`); continue; }
    let obj;
    try { obj = JSON.parse(raw); }
    catch (e) { errors.push(`${file.replace(ROOT + "/", "")}: invalid JSON — ${e.message}`); continue; }
    const list = Array.isArray(obj) ? obj : [obj];
    for (const item of list) {
      validateLesson(item, file);
      if (item.id) {
        if (ids.has(item.id)) errors.push(`duplicate id "${item.id}" in ${file.replace(ROOT + "/", "")} and ${ids.get(item.id)}`);
        else ids.set(item.id, file.replace(ROOT + "/", ""));
      }
      item._file = file.replace(ROOT + "/", "");
      lessons.push(item);
    }
  }

  // sort by lane order then lesson order then title
  const laneOrder = Object.fromEntries(LANES.map((l) => [l.id, l.order]));
  lessons.sort((a, b) =>
    (laneOrder[a.lane] ?? 99) - (laneOrder[b.lane] ?? 99) ||
    (a.order ?? 100) - (b.order ?? 100) ||
    String(a.title).localeCompare(String(b.title)));

  // glossary: central file + per-lesson
  const glossary = [];
  const seen = new Set();
  try {
    const central = JSON.parse(await readFile(join(ROOT, "content", "glossary.json"), "utf8"));
    for (const g of central) if (g.term && !seen.has(g.term.toLowerCase())) { seen.add(g.term.toLowerCase()); glossary.push({ ...g }); }
  } catch { /* optional */ }
  for (const l of lessons) {
    if (Array.isArray(l.glossary)) for (const g of l.glossary) {
      if (g.term && !seen.has(g.term.toLowerCase())) { seen.add(g.term.toLowerCase()); glossary.push({ ...g, lessonId: l.id, lane: l.lane }); }
    }
  }
  glossary.sort((a, b) => a.term.localeCompare(b.term));

  // per-lesson quiz questions (lane-tagged)
  const quiz = [];
  for (const l of lessons) if (Array.isArray(l.quiz)) l.quiz.forEach((q, i) =>
    quiz.push({ id: `${l.id}-q${i}`, lessonId: l.id, lane: l.lane, ...q }));
  // curated quiz banks from content/quizzes/*.json (e.g. the final exam)
  const quizBanks = {};
  const extraQuizFiles = await walk(join(ROOT, "content", "quizzes"));
  for (const f of extraQuizFiles) {
    try {
      const bank = JSON.parse(await readFile(f, "utf8"));
      const qs = Array.isArray(bank) ? bank : bank.questions || [];
      const id = bank.id || basename(f, ".json");
      quizBanks[id] = { id, title: bank.title || id, questions: qs };
    } catch (e) { warnings.push(`${f.replace(ROOT + "/", "")}: bad quiz bank — ${e.message}`); }
  }
  const bankQ = Object.values(quizBanks).reduce((n, b) => n + b.questions.length, 0);
  const changeCatalog = await buildChangeCatalog(repo);

  const laneCounts = Object.fromEntries(LANES.map((l) => [l.id, lessons.filter((x) => x.lane === l.id).length]));
  const data = {
    generatedAt: new Date().toISOString(),
    repo,
    changeCatalog,
    lanes: LANES.map((l) => ({ ...l, count: laneCounts[l.id] || 0 })),
    lessons,
    glossary,
    quiz,
    quizBanks,
    stats: {
      lessons: lessons.length,
      glossaryTerms: glossary.length,
      quizQuestions: quiz.length + bankQ,
      changeEntries: changeCatalog.entries.length,
    },
  };
  const manifest = {
    generatedAt: data.generatedAt,
    stats: data.stats,
    lanes: data.lanes.map(({ id, title, count }) => ({ id, title, count })),
    files: lessons.map((l) => ({ id: l.id, title: l.title, lane: l.lane, type: l.type, file: l._file })),
  };

  if (warnings.length) { console.log("\n⚠️  Warnings:"); warnings.forEach((w) => console.log("   - " + w)); }
  if (errors.length) {
    console.error("\n❌ Build failed with errors:");
    errors.forEach((e) => console.error("   - " + e));
    process.exit(1);
  }

  await writeFile(OUT_DATA, JSON.stringify(data, null, 2));
  await writeFile(OUT_MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Built content/data.json`);
  console.log(`   lanes: ${data.lanes.map((l) => `${l.id}(${l.count})`).join(", ")}`);
  console.log(`   ${data.stats.lessons} lessons · ${data.stats.glossaryTerms} glossary terms · ${data.stats.quizQuestions} quiz questions`);
}

main().catch((e) => { console.error(e); process.exit(1); });
