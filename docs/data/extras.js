/* ============================================================
   extras.js — synthesized capstone material (not from a single lane).
   Reference architecture · Teaching kit · Capstone self-test.
   Managed-identity-only, end to end across ICM / Kusto / ADO MCP.
   ============================================================ */
window.EXTRAS = {
  architecture: {
    intro:
      "This is the whole stack on one page. A client app or Foundry Agent runs with a managed identity. " +
      "It calls a model you deployed in Azure AI Foundry, and reaches three MCP servers — ICM (incidents), " +
      "Kusto/Azure Data Explorer (telemetry), and Azure DevOps (work items, pipelines, repos). Every arrow " +
      "is authenticated with a Microsoft Entra token fetched for that target's audience — no API keys, no " +
      "connection-string secrets, no service-principal passwords anywhere.",
    diagram:
      "graph TD\n" +
      "  subgraph Identity[Microsoft Entra ID]\n" +
      "    MI[Managed Identity]\n" +
      "  end\n" +
      "  App[Client app or Foundry Agent] -->|1 get token via IMDS| MI\n" +
      "  MI -->|2 Entra access tokens| App\n" +
      "  subgraph Foundry[Azure AI Foundry project]\n" +
      "    Model[Deployed model]\n" +
      "    Agent[Agent Service]\n" +
      "  end\n" +
      "  App -->|3 inference| Model\n" +
      "  App -->|create thread and run| Agent\n" +
      "  Agent -->|reasons over| Model\n" +
      "  Agent -->|tool call| ICM[ICM MCP server]\n" +
      "  Agent -->|tool call| Kusto[Kusto MCP server]\n" +
      "  Agent -->|tool call| ADO[Azure DevOps MCP server]\n" +
      "  ICM -->|MI token for ICM audience| IcMBack[Incident management backend]\n" +
      "  Kusto -->|MI token Database Viewer| ADX[Azure Data Explorer cluster]\n" +
      "  ADO -->|Entra token ADO audience| ADOorg[Azure DevOps organization]\n" +
      "  RBAC[RBAC role assignments] -.grants.-> Model\n" +
      "  RBAC -.grants.-> ADX\n" +
      "  RBAC -.grants.-> ADOorg",
    steps: [
      { title: "Provision identity, not secrets", body: "Give the compute (App Service, Container App, AKS pod, VM, or Function) a **managed identity** — system-assigned for one-to-one, or a user-assigned identity you can reuse. Nothing is stored in code or config. The identity is a first-class principal in Microsoft Entra ID." },
      { title: "Grant least-privilege RBAC", body: "Assign the identity exactly the roles it needs: an Azure AI / Foundry data-plane role to call the project and model, **Database Viewer** (read) on the Kusto database, a member seat with read/write scopes in the Azure DevOps org, and the appropriate access on the incident backend. Scope each assignment as narrowly as possible." },
      { title: "Authenticate with one line of code", body: "Use `DefaultAzureCredential()` everywhere. Locally it uses your `az login`; in Azure it transparently uses the managed identity. **Same code, no branching, zero secrets.** For a user-assigned identity, pass its `client_id`." },
      { title: "Deploy and call the model", body: "Create a deployment in the Foundry model catalog (an alias like `gpt-4o-prod`). Get an inference/chat client from the project client and send chat completions — streaming or not. The deployment name is what you call, decoupled from the underlying model version." },
      { title: "Stand up the MCP servers", body: "Each capability is an **MCP server** exposing tools over JSON-RPC. The Azure MCP server ships Kusto/ADX tools; the official Azure DevOps MCP server exposes Boards/Repos/Pipelines tools; an incident-management MCP server exposes query/get/create/ack incident tools. The model never talks to a backend directly — only to tools." },
      { title: "Attach tools to the agent", body: "Register each MCP server with the Foundry Agent (server label, URL, allowed tools). When a user asks a question, the model emits a tool call, the agent invokes the MCP tool **carrying the managed-identity token for that target**, and feeds the structured result back into the conversation." },
      { title: "Gate write actions", body: "Reads (query incidents, run KQL, list work items) can flow automatically. **Writes** (acknowledge an incident, create a work item, queue a pipeline) should require human-in-the-loop approval and be audited. Least privilege plus approval keeps the agent safe." },
      { title: "Observe everything", body: "Wire OpenTelemetry / Azure Monitor so every model call, agent run, tool call, and token acquisition is traced. When something 403s, the trace tells you which identity, which audience, and which scope was missing." }
    ],
    code: {
      language: "python",
      caption: "End-to-end skeleton: managed identity → Foundry model + agent → ICM/Kusto/ADO MCP tools (no secrets)",
      content:
"import os\n" +
"# ONE credential to rule them all. Locally -> az login; in Azure -> managed identity.\n" +
"# For a USER-ASSIGNED identity, set AZURE_CLIENT_ID and DefaultAzureCredential picks it up.\n" +
"from azure.identity import DefaultAzureCredential\n" +
"from azure.ai.projects import AIProjectClient\n" +
"\n" +
"credential = DefaultAzureCredential()  # never a key, never a secret\n" +
"\n" +
"# The project endpoint is non-secret config (an URL), e.g. set via env var.\n" +
"project = AIProjectClient(\n" +
"    endpoint=os.environ['FOUNDRY_PROJECT_ENDPOINT'],\n" +
"    credential=credential,\n" +
")\n" +
"\n" +
"# 1) DIRECT INFERENCE -------------------------------------------------\n" +
"# Auth flows through the project; 'model' is your DEPLOYMENT name (an alias).\n" +
"chat = project.inference.get_chat_completions_client()\n" +
"reply = chat.complete(\n" +
"    model=os.environ['MODEL_DEPLOYMENT'],          # e.g. 'gpt-4o-prod'\n" +
"    messages=[{'role': 'user', 'content': 'Summarize Sev2 incidents from today.'}],\n" +
")\n" +
"print(reply.choices[0].message.content)\n" +
"\n" +
"# 2) AGENT + MCP TOOLS -----------------------------------------------\n" +
"# Attach each MCP server as a tool. The agent reasons with the model and calls tools.\n" +
"# NOTE: MCP tools in Foundry Agents are preview - confirm the exact tool shape in the\n" +
"# 'Agents + MCP' lane against current docs. Pattern shown for clarity.\n" +
"mcp_servers = [\n" +
"    {'server_label': 'icm',   'server_url': os.environ['ICM_MCP_URL']},    # incidents\n" +
"    {'server_label': 'kusto', 'server_url': os.environ['KUSTO_MCP_URL']},  # ADX / KQL\n" +
"    {'server_label': 'ado',   'server_url': os.environ['ADO_MCP_URL']},    # work items / pipelines\n" +
"]\n" +
"\n" +
"agent = project.agents.create_agent(\n" +
"    model=os.environ['MODEL_DEPLOYMENT'],\n" +
"    name='sre-copilot',\n" +
"    instructions=(\n" +
"        'You are an SRE copilot. Use ICM to read incidents, Kusto to query telemetry, '\n" +
"        'and Azure DevOps to file follow-up work items. Ask for approval before any write.'\n" +
"    ),\n" +
"    # tools=[...mcp tool definitions built from mcp_servers...],  # see Agents+MCP lane\n" +
")\n" +
"\n" +
"thread = project.agents.threads.create()\n" +
"project.agents.messages.create(\n" +
"    thread_id=thread.id, role='user',\n" +
"    content='Find Sev2 incidents in the last 6h, pull error rates from Kusto, and draft an ADO bug.',\n" +
")\n" +
"run = project.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent.id)\n" +
"\n" +
"# The agent emits tool calls -> MCP tools execute WITH the managed-identity token for\n" +
"# each target's audience -> results flow back into the model. Zero keys touched.\n" +
"for msg in project.agents.messages.list(thread_id=thread.id):\n" +
"    print(msg.role, ':', msg)\n"
    },
    note:
      "<b>Why this is the whole game:</b> one identity, many audiences. The managed identity proves <i>who</i> the " +
      "workload is; RBAC decides <i>what</i> it may do on each resource; MCP standardizes <i>how</i> the model reaches " +
      "tools. Master those three sentences and you can explain the entire architecture without a single secret."
  },

  kit: {
    intro:
      "A ready-to-present deck outline. Each slide has talking points and a one-line script you can read aloud. " +
      "Move top to bottom and you will have taught the entire Foundry + MCP + managed-identity stack in ~20 minutes.",
    slides: [
      { title: "The problem", points: ["AI apps need a model **plus** identity, governance, tools, and observability", "Wiring each tool to each model by hand is an N×M mess", "Secrets sprawl is the #1 way these systems get breached"], script: "We want an AI agent that can act on our real systems — safely, with no secrets, and without bespoke glue for every integration." },
      { title: "Azure AI Foundry", points: ["A governed Azure platform for building and operating AI apps", "Hierarchy: subscription → resource group → Foundry resource → project", "Portal for humans, SDK/CLI/REST for automation"], script: "Foundry is the aircraft carrier: models are the aircraft, projects are the mission bays, and Azure governance is the command structure." },
      { title: "Deploy & inference", points: ["Pick a model from the catalog and create a **deployment** (an alias)", "Call chat completions through the project client", "Tokens in, tokens out; watch context window and usage"], script: "A deployment is a named phone line to a model; we dial the deployment name, not the raw model version." },
      { title: "Managed identity (the core)", points: ["The workload gets an Entra identity with **no password**", "`DefaultAzureCredential` uses az login locally, managed identity in Azure", "RBAC grants least-privilege access per resource"], script: "Managed identity is a building badge the platform issues and rotates for us — we never carry a key, and the badge only opens the doors RBAC allows." },
      { title: "MCP in one breath", points: ["MCP is the USB-C port for AI tools", "Host embeds Clients; each Client talks to one Server over JSON-RPC", "Servers expose Tools (actions), Resources (data), Prompts (templates)"], script: "MCP standardizes how a model discovers and calls tools, so any compliant server plugs into any compliant host." },
      { title: "Agents + MCP", points: ["An agent = model + instructions + tools + state (threads/runs)", "Attach MCP servers as tools with a label, URL, and allowed tool list", "The agent carries the managed-identity token on every tool call"], script: "The agent is the on-call engineer; MCP servers are its tools; managed identity is the badge it taps to use each one." },
      { title: "ICM · Kusto · ADO", points: ["**ICM**: query/ack/create incidents (writes need approval)", "**Kusto/ADX**: run KQL over telemetry — read-only mindset", "**ADO**: work items via WIQL, pipelines, repos/PRs"], script: "Same pattern three times: an MCP server fronts the system, the agent calls tools, and a managed-identity token authorizes each call." },
      { title: "Safety & observability", points: ["Least privilege + human-in-the-loop on writes + full audit", "OpenTelemetry traces every call, tool, and token", "Preview features: verify against current Microsoft docs"], script: "We let reads flow, gate writes behind approval, and trace everything — so the agent is powerful but never reckless." }
    ]
  },

  capstone: {
    intro:
      "The final exam. For each prompt, explain it OUT LOUD from memory as if teaching a peer, then reveal the model " +
      "answer to check yourself. If you can do all 10 cleanly, you have hit the mission bar.",
    challenges: [
      { q: "Explain what Azure AI Foundry is and how subscription → resource group → Foundry resource → project fit together.", a: "Foundry is a **governed Azure platform** for building and operating AI apps — models, agents, evaluations, tracing, and safety in one managed workspace. A **subscription** is the billing/isolation boundary; a **resource group** holds related resources; a **Foundry resource** provides shared security, connections, and compute; a **project** is the actual workspace where deployments, agents, and connections live. You scope work to a project and let Foundry handle governance." },
      { q: "Deploy a model and call it from code — name every moving part.", a: "Pick a model from the **catalog**, create a **deployment** (a named alias, e.g. `gpt-4o-prod`, decoupled from the model version). Construct an `AIProjectClient(endpoint, credential)`, get a chat client via `project.inference.get_chat_completions_client()`, and call `.complete(model='gpt-4o-prod', messages=[...])`. You read `choices[0].message.content` and watch `usage` for token counts. The endpoint is non-secret config; the credential is a managed identity." },
      { q: "Why managed identity only — and how does DefaultAzureCredential make it seamless?", a: "Keys and service-principal secrets must be stored, rotated, and inevitably leak; a **managed identity has no secret** — the platform issues and rotates Entra tokens for it via the IMDS endpoint. `DefaultAzureCredential` walks a chain: in Azure it finds the managed identity; on your laptop it falls back to `az login`. **Same code, no secrets, prod and dev.** For a user-assigned identity you pass its `client_id`." },
      { q: "Walk the token flow from workload to a protected Azure resource.", a: "The workload calls `credential.get_token(scope)`; azure-identity hits the **IMDS** endpoint, which returns a short-lived **Entra access token** minted for that resource's **audience**. The SDK attaches it as a Bearer token on the request. The resource validates the token's issuer, audience, and the identity's **RBAC role assignments**, then allows or denies. No password ever exists." },
      { q: "What is MCP, and what are its three server primitives?", a: "**MCP (Model Context Protocol)** is an open standard — the 'USB-C for AI' — that standardizes how apps give models tools and context over **JSON-RPC**. A **Host** embeds **Clients**; each Client connects to one **Server**. Servers expose **Tools** (model-controlled actions), **Resources** (app-controlled data), and **Prompts** (user-controlled templates). This kills the N×M integration problem." },
      { q: "How does a Foundry agent use an attached MCP server during a run?", a: "An **agent** = model + instructions + tools + state. You create a **thread**, add a **message**, and start a **run**. The model reasons and emits a **tool call**; the agent invokes the matching **MCP tool** — carrying the **managed-identity token** for that target — gets a structured result, and feeds it back to the model until the run completes. Writes are gated behind human approval." },
      { q: "Connect to ICM via MCP with managed identity — describe the flow and safety model.", a: "An **ICM MCP server** exposes tools like `query_incidents`, `get_incident`, `acknowledge`, `create_incident`. The agent's managed identity presents an **Entra token for the incident backend's audience**; RBAC grants read vs write. Natural-language request → model picks a tool → MCP call with the token → result. **Reads flow automatically; acks/creates/updates require approval and are audited.** (ICM specifics are internal — verify with your tenant owner.)" },
      { q: "Query Kusto through MCP — what access does the identity need and what's the safety posture?", a: "Kusto/**Azure Data Explorer** is a read-optimized analytics store queried with **KQL** (`Table | where ... | summarize ... | project ...`). The Azure MCP server exposes ADX tools (list clusters/databases/tables, run query, get schema). Grant the managed identity **Database Viewer** (read) on the database — via `.add database viewers` or RBAC — and Reader on the cluster. Posture is **read-only**: queries, not control commands, mindful of result size and timeouts." },
      { q: "Reach Azure DevOps via MCP — what's the auth reality vs the managed-identity target?", a: "**Azure DevOps** = orgs/projects with Boards, Repos, Pipelines, Test Plans, Artifacts; work items are queried with **WIQL**. The official ADO MCP server exposes those tool groups. ADO supports **Microsoft Entra tokens** (resource GUID `499b84ac-1321-427f-aa17-267ca6975798/.default`), and a managed identity/service principal can be **added as an org member** with least-privilege scopes. If current tooling still expects a PAT or `az login`, that's a **gap/anti-pattern** — the target is the Entra/managed-identity token, never a stored PAT." },
      { q: "Draw the end-to-end architecture in three sentences anyone could follow.", a: "A workload runs with **one managed identity** and fetches **Entra tokens** for whatever it needs to reach. It calls a **deployed Foundry model** directly, or drives a **Foundry agent** that reaches **ICM, Kusto, and ADO** through **MCP servers** — each tool call carrying the right token for that target's audience. **Managed identity proves who, RBAC decides what, MCP standardizes how** — and not one secret exists anywhere in the system." }
    ]
  }
};
