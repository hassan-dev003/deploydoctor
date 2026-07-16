# DeployDoctor Agent Plan (Zero to Agent)

Goal: turn DeployDoctor from a single structured LLM call into a **genuine agent** for
Vercel's "Zero to Agent" hackathon — one that autonomously investigates a failed
deployment with real tools, verifies its hypothesis against the live project, and returns
a fix. This supersedes the "not an agent yet" framing in `docs/SPRINT_PLAN.md`.

## Why this project is a natural agent

Incident investigation is a **hypothesis → verify → refine loop**, and BYO-token already
lets us call the real Vercel API. That is the difference between "LLM guesses from a log"
and "agent checks the actual project and confirms the cause." The agent's real tool calls
become the investigation timeline the UI already renders — honest and compelling.

## Stack (grounded, verified)

- **Vercel AI SDK** (`ai`) + **`@ai-sdk/cerebras`** (`createCerebras`).
- Multi-step tool-calling loop via `stopWhen: stepCountIs(n)` — Vercel's recommended agent
  pattern; GPT-OSS 120B on Cerebras is the exact model in Vercel's agent guide.
- Provider-swappable: `@ai-sdk/anthropic` (Claude) is a one-line change if we want stronger
  tool-use, because the AI SDK abstracts providers.
- Cerebras supports parallel tool calls + strict schema mode (reliable agent arguments).

## The agent: "DeployDoctor Investigator"

Given a failed deployment (BYO-token) or a pasted log, the agent runs a tool loop until it
is confident, then finalizes a verified incident report. All tool outputs are redacted
before returning to the model; env var **values are never sent to the LLM** (keys/targets
only).

### Tools (Vercel API, user token)

1. `list_recent_failed_deployments()` — find candidates (wraps existing `listDeployments`).
2. `get_deployment_events(deploymentId)` — build logs/events (exists).
3. `get_deployment(deploymentId)` — metadata: state, target, commit sha/ref, project id.
4. `get_project_settings(projectIdOrName)` — framework, node version, build/install command, root dir.
5. `list_project_env_keys(projectIdOrName)` — env var **keys + targets only** (Production /
   Preview / Development), values stripped. The star verification tool for missing-env-var cases.
6. `classify_log(text)` — deterministic rule-based classifier exposed as a tool (existing `classify`).
7. `finalize_incident_report({...})` — terminal tool; its arguments are the structured
   `DiagnosisResult`, which we wrap into an `IncidentReport`.
8. (optional, AG-4) `read_repo_file(path)` / `get_repo_tree(path)` — GitHub, to confirm
   case-sensitive imports / missing files.

### The verification moment (why judges will believe it's an agent)

Example trace for a "Missing STRIPE_SECRET_KEY" failure:

1. `get_deployment_events` → build failed at env validation.
2. `classify_log` → `missing_env_var`.
3. `list_project_env_keys` → **STRIPE_SECRET_KEY is set in Preview but absent in Production**.
4. `finalize_incident_report` → verified root cause + targeted fix ("add it to Production;
   it already exists in Preview"), confidence upgraded because it was confirmed against the
   real project.

Step 3 is grounded verification, not guessing — that is the agentic differentiator.

### Safety / honesty

- Redact every tool output before it re-enters the model context.
- Never send env var values to the LLM.
- Deterministic fallback to the current single-shot `generateServerDiagnosis` if the agent
  loop errors or the model misbehaves — the "always works" property is preserved.
- `stepCountIs` cap prevents runaway loops.

---

## Sprints

### Sprint AG-1 — Agent foundation (tools + loop)

- [ ] Add deps: `ai`, `@ai-sdk/cerebras` (optionally `@ai-sdk/anthropic`).
- [ ] Vercel read helpers in `lib/vercel/api.ts`: `getDeployment`, `getProjectSettings`,
      `listProjectEnvKeys` (values stripped).
- [ ] `lib/agent/tools.ts`: tool defs (zod `inputSchema` + `execute` bound to
      `{ accessToken, teamId }`), all outputs redacted.
- [ ] `lib/agent/runInvestigation.ts`: AI SDK multi-step loop, system prompt, step-trace
      collection, `finalize` args → `DiagnosisResult` → `IncidentReport` with real
      investigation steps; deterministic fallback.
- [ ] Tests with a mock model driving a scripted tool sequence: tools execute, trace built,
      report produced, fallback on error.

### Sprint AG-2 — Wire into product + trace UI + honest copy

- [ ] `POST /api/agent/investigate` (BYO-token): `{ accessToken, teamId?, deploymentId? }` or
      `{ log? }`. Runs the agent; token used transiently, never stored.
- [ ] UI: "Investigate with agent" as the primary connected action; render the tool-call
      trace prominently (what it checked and what it found).
- [ ] Extend the report to carry a first-class `agentTrace` (tool, input summary,
      observation, `verified` flag) if `investigationSteps` is not rich enough.
- [ ] Update README / AGENTS.md / UI "Does / Does not" to describe genuine agent behavior
      accurately (retire the "not an agent" caveats; stay honest about the tools it uses).

### Sprint AG-3 — Verification-first behavior + streaming + demo

- [ ] Prompt/tool tuning so the agent always attempts a verification step before finalizing;
      surface a "Verified against your project" badge when a tool confirms the hypothesis.
- [ ] Stream the trace (AI SDK `streamText`) so judges watch the agent work step by step.
- [ ] Hackathon demo script + a short "How the agent works" section/diagram in the README.

### Sprint AG-4 — Action-taking: propose a fix PR (optional, highest "agent" points)

- [ ] GitHub read tool to confirm file-level hypotheses (case-sensitive imports, missing files).
- [ ] Stretch: agent opens a **guardrailed** fix PR (a real action, human-confirmed) — the
      most impressive "agent does things" capability.
- [ ] Needs a GitHub token/App (human task).

---

## Decisions (confirm before AG-1)

1. **Provider:** keep **Cerebras `gpt-oss-120b`** (recommended — tool-calling capable, already
   configured, and Vercel's own agent-guide model). Swap to Claude later is one line if wanted.
2. **Scope:** read-only **investigation agent** (AG-1..3) is a complete, defensible agent for the
   hackathon. **Fix-PR agent** (AG-4) is more impressive but needs GitHub setup + guardrails —
   recommend building AG-1..3 first, AG-4 as stretch.

## Human tasks

1. Keep `CEREBRAS_MODEL` on a tool-calling model (`gpt-oss-120b` works; it is the default).
2. For a killer demo: point the token at a project with a recent **failed** deployment and an
   env var that exists in one environment but not another (shows the verification moment).
3. (AG-4 only) provide a GitHub token/App.
