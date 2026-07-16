# DeployDoctor

DeployDoctor turns failed Vercel deployments into evidence-backed incident reports. Give it a
Vercel access token and an autonomous investigation agent finds your latest failed deployment,
reads the build log, classifies the failure, and **verifies its hypothesis against your real
project** (for example, checking whether a required environment variable actually exists in the
failing environment) before writing an actionable report. You can also paste a build log directly.

Under the hood it is a small data pipeline over noisy, semi-structured build logs: ingest →
redact secrets → classify → tool-grounded LLM extraction → schema-validated `IncidentReport` →
optional Postgres persistence and a sanitized public share link. The agent is a tool-calling loop
built on the Vercel AI SDK with Cerebras (`gpt-oss-120b`), and it degrades gracefully to a
deterministic diagnosis when the model is unavailable.

## How It Works (Architecture)

```
Vercel access token
        │
        ▼
Resolve latest failed deployment ──► Read sanitized build log ──► Classify failure
        │                                    (secrets redacted)         (rule-based)
        ▼
Agent verification loop (Vercel AI SDK + Cerebras)
  tools: list_project_env_keys · get_project_settings   (env var VALUES never sent to the model)
        │
        ▼
Structured-output synthesis ──► IncidentReport (Zod-validated)
        │                         timeline · evidence · repair plan · safe actions
        ▼
Render live trace (SSE)  ·  optional sanitized share link (Postgres)
```

- **Deterministic evidence floor:** resolving the deployment, reading the log, and classifying it
  happen without the model, so the essential evidence is always gathered. The agent runs a focused
  verification loop on top; if it fails, the log-based diagnosis still stands.
- **Privacy by construction:** raw logs are never persisted, secrets are redacted before any model
  call or storage, and environment variable **values** are never requested or sent to the model
  (keys and targets only). The access token is used transiently and never stored.
- **Typed contracts:** `DiagnosisResult` and `IncidentReport` are defined with Zod and validated at
  every boundary. The build gate runs tests, lint, typecheck, and a production build.

## Local Setup

Use pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

To enable AI incident analysis, add:

```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
```

`CEREBRAS_MODEL` is optional and defaults to `gpt-oss-120b`. Other available models include `llama3.1-8b` (fastest) and `qwen-3-235b-a22b-instruct-2507` (preview).

To enable saved share links, add:

```bash
POSTGRES_URL=your_vercel_postgres_or_neon_connection_string
```

Vercel Postgres and Neon integrations may also expose a project-prefixed `depdoc_POSTGRES_URL`; DeployDoctor supports either variable. Incident analysis still works without a Postgres URL; only saving/share links return a friendly configuration error.

To enable connected Vercel authorization and signed webhooks, add:

```bash
VERCEL_CLIENT_ID=your_oauth_client_id
VERCEL_CLIENT_SECRET=your_oauth_client_secret
VERCEL_REDIRECT_URI=http://localhost:3000/api/vercel/oauth/callback
TOKEN_ENCRYPTION_KEY=base64_32_byte_key
VERCEL_WEBHOOK_SECRET=your_webhook_secret
```

Generate `TOKEN_ENCRYPTION_KEY` with:

```bash
openssl rand -base64 32
```

`TOKEN_ENCRYPTION_KEY` is required before OAuth tokens can be stored. Tokens are encrypted server-side and never exposed to the browser.

Connected mode also requires manual Vercel setup for this milestone:

- Configure a Vercel webhook that points to `/api/webhooks/vercel`.
- Use the same webhook secret in Vercel and `VERCEL_WEBHOOK_SECRET`.
- Run a real production smoke test after OAuth setup to confirm the authorized token can fetch deployment events for the target project.
- Keep pasted-log analysis available as the fallback path if OAuth permissions or webhook delivery need adjustment.

## Connected Mode: Investigation Agent (Bring Your Own Vercel Token)

Give DeployDoctor a Vercel access token and its investigation agent works autonomously: it
finds your latest failed deployment, reads the build log, classifies the failure, forms a
hypothesis, and verifies it against your real project — for example checking whether a
required environment variable actually exists in the failing target — before writing the
report. It is a genuine tool-calling agent (Vercel AI SDK + Cerebras), not a single prompt.
This path is fully self-serve: any user can use it with their own token, with no account
setup or owner involvement required.

1. Create a Vercel access token at `https://vercel.com/account/tokens`.
2. On the homepage, paste the token into the **Investigation agent** field. Add a Team ID
   if the project belongs to a Vercel team.
3. Click **Investigate my latest failure**. The agent calls the Vercel API with your token
   to gather and verify evidence, then produces an incident report whose timeline shows the
   real steps it took.

The agent's tools: list recent failed deployments, read sanitized deployment events, read
deployment metadata, read project settings, and list environment variable **keys and targets
only** — values are never requested or sent to the model.

Privacy: the token stays in your browser tab, is sent once to `POST /api/agent/investigate`,
and is never stored, logged, or returned to the client. Use a short-lived token and revoke it
when finished.

Requires `CEREBRAS_API_KEY` for the agent (it falls back to a deterministic single-shot
diagnosis otherwise). No Postgres, OAuth app, webhook, or paid Vercel plan is needed.

## Vercel Deployment

The project is linked to Vercel as `deploydoctor` and deployed at:

```bash
https://deploydoctor.vercel.app
```

Configure these production environment variables in Vercel:

```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
POSTGRES_URL=your_vercel_postgres_or_neon_connection_string
VERCEL_CLIENT_ID=your_oauth_client_id
VERCEL_CLIENT_SECRET=your_oauth_client_secret
VERCEL_REDIRECT_URI=https://deploydoctor.vercel.app/api/vercel/oauth/callback
TOKEN_ENCRYPTION_KEY=base64_32_byte_key
VERCEL_WEBHOOK_SECRET=your_webhook_secret
```

`POSTGRES_URL` can be replaced by `depdoc_POSTGRES_URL` when using the current prefixed integration variables.

Vercel uses `vercel.json` to run:

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

This keeps tests, lint, typecheck, and the production Next.js build in the deployment workflow. The current production deployment has passed those checks.

## Available Commands

```bash
pnpm dev
```

Starts the local Next.js development server.

```bash
pnpm test
```

Runs Vitest tests for incident reports, diagnosis, redaction, classification, and sharing behavior.

```bash
pnpm lint
```

Runs ESLint with Next.js rules.

```bash
pnpm typecheck
```

Runs TypeScript without emitting build output.

```bash
pnpm build
```

Creates a production Next.js build.

## Walkthrough

Use the production app or a local dev server (`https://deploydoctor.vercel.app`):

- **Agent path:** paste a Vercel access token into the **Investigation agent** field and click
  **Investigate my latest failure**. Watch the live trace stream in (searched → read log →
  classified → verified against the project), then review the incident report.
- **Paste path:** choose a sample log (for example `Missing Production env var` or
  `Case-sensitive import failure`), click `Analyze incident`, and review the timeline, evidence
  cards, repair plan, and safe actions.
- **Share:** click `Share incident` to open the generated `/i/[shareId]` page. It stores only
  sanitized incident JSON, never the raw log.
- **Graceful fallback:** without `CEREBRAS_API_KEY` the same flow returns a deterministic
  diagnosis (`generatedBy: mock`).

## Connected Vercel Foundation (Experimental / Parked)

> The recommended connected path is the token-based **Connected Mode** above. The
> OAuth + webhook foundation below is experimental and parked: the OAuth flow targets
> Vercel's "Sign in with Vercel" identity product, and automatic webhook ingestion
> requires a paid Vercel plan. Neither is required to fetch and analyze deployments.

Milestone 7B adds the connected-mode authorization foundation:

- `POST /api/webhooks/vercel` accepts Vercel deployment webhook-shaped JSON.
- `x-vercel-signature` is verified when `VERCEL_WEBHOOK_SECRET` is configured.
- `deployment.error` and legacy `deployment-error` events create stored incidents.
- `/api/vercel/oauth/start` and `/api/vercel/oauth/callback` provide minimal OAuth authorization.
- OAuth access and refresh tokens are stored encrypted in `vercel_connections`.
- Connected webhook incidents can fetch Vercel deployment events and convert them into sanitized `IncidentReport` data.
- `/incidents` lists webhook-created incidents and marks metadata-only incidents that still need a connection.
- Webhooks must be configured manually in Vercel for this milestone.

Not implemented yet:

- Full Vercel marketplace install polish.
- Token refresh.
- Automatic Vercel webhook creation.
- Reading private deployment logs from public deployment URLs.
- GitHub diff inspection, MCP, or auto-fixes.

## Current Scope

- Paste raw Vercel logs into the homepage incident analyst.
- Or paste a Vercel access token to fetch and analyze your latest failed deployment; the token is never stored.
- Keep raw logs only in React state.
- Send logs to `POST /api/incidents` for incident reports; keep `POST /api/diagnoses` for legacy diagnosis clients.
- Receive Vercel deployment failure webhook metadata at `POST /api/webhooks/vercel`.
- Authorize Vercel via OAuth before private deployment events can be fetched.
- Redact obvious secrets before model calls or evidence display.
- Return the stable `DiagnosisResult` shape from Cerebras or mock fallback.
- Wrap diagnoses in `IncidentReport` output with investigation steps, evidence cards, repair plans, and safe actions.
- Save sanitized incident reports to Postgres and share them at `/i/[shareId]`.
- Keep legacy sanitized diagnosis shares working at `/d/[shareId]`.
- Store only sanitized report data, never the pasted raw log.

## Not Implemented Yet

- Auth.
- Dashboard or saved-report editing.
- Reading private Vercel logs from public deployment URLs.
- Token refresh.
- Full Vercel marketplace integration polish.
- GitHub diff inspection or PR generation.
- Auto-pushing fixes.
- Analytics.
