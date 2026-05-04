# DeployDoctor

DeployDoctor helps developers turn failed Vercel deployments into evidence-backed incident reports.

This repository is currently at **Milestone 7B**: a paste-first incident analyst with a Vercel authorization and authenticated log-fetching foundation. The main app still analyzes pasted logs; connected webhook ingestion can store metadata-only placeholder incidents and, when an authorized Vercel connection exists, fetch deployment events to create sanitized incident reports. The app calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mocked diagnosis when the key is missing or the model call fails.

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

## Demo Walkthrough

Use the production app or local dev server:

```bash
https://deploydoctor.vercel.app
```

1. Choose a sample log such as `Missing Production env var`, `Case-sensitive import failure`, or `Lockfile mismatch`.
2. Click `Analyze incident` and point out the investigation timeline, evidence cards, repair plan, safe actions, and legacy diagnosis details.
3. Click `Share incident` and open the generated `/i/[shareId]` page.
4. Explain that the shared page stores only sanitized incident report JSON, not the pasted raw log.
5. For a fallback demo, run without `CEREBRAS_API_KEY` locally and repeat the same flow; the UI shape stays the same with `generatedBy: mock`.

See `docs/DEMO.md` for a 60-90 second hackathon video checklist.

## Connected Vercel Foundation

Milestone 7B adds the connected-mode authorization foundation:

- `POST /api/webhooks/vercel` accepts Vercel deployment webhook-shaped JSON.
- `x-vercel-signature` is verified when `VERCEL_WEBHOOK_SECRET` is configured.
- `deployment.error` and legacy `deployment-error` events create stored incidents.
- `/api/vercel/oauth/start` and `/api/vercel/oauth/callback` provide minimal OAuth authorization.
- OAuth access and refresh tokens are stored encrypted in `vercel_connections`.
- Connected webhook incidents can fetch Vercel deployment events and convert them into sanitized `IncidentReport` data.
- `/incidents` lists webhook-created incidents and marks metadata-only incidents that still need a connection.

Not implemented yet:

- Full Vercel marketplace install polish.
- Token refresh.
- Reading private deployment logs from public deployment URLs.
- GitHub diff inspection, MCP, or auto-fixes.

## Current Scope

- Paste raw Vercel logs into the homepage incident analyst.
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
