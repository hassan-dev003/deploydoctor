# DeployDoctor

DeployDoctor helps developers turn failed Vercel deployments into evidence-backed incident reports.

This repository is currently at **Milestone 6**: a paste-first incident analyst for Vercel and Next.js deployment failures. The app calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mocked diagnosis when the key is missing or the model call fails. The MVP input is pasted logs only.

## Local Setup

Use pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

To enable AI diagnosis, add:

```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
```

`CEREBRAS_MODEL` is optional and defaults to `gpt-oss-120b`. Other available models include `llama3.1-8b` (fastest) and `qwen-3-235b-a22b-instruct-2507` (preview).

To enable saved share links, add:

```bash
POSTGRES_URL=your_vercel_postgres_or_neon_connection_string
```

Vercel Postgres and Neon integrations may also expose a project-prefixed `depdoc_POSTGRES_URL`; DeployDoctor supports either variable. Diagnosis still works without a Postgres URL; only saving/share links return a friendly configuration error.

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

Runs Vitest tests for diagnosis, redaction, classification, and sharing behavior.

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
2. Click `Analyze pasted log` and point out the investigation timeline, evidence cards, repair plan, safe actions, and legacy diagnosis details.
3. Click `Share incident` and open the generated `/i/[shareId]` page.
4. Explain that the shared page stores only sanitized incident report JSON, not the pasted raw log.
5. For a fallback demo, run without `CEREBRAS_API_KEY` locally and repeat the same flow; the UI shape stays the same with `generatedBy: mock`.

See `docs/DEMO.md` for a 60-90 second hackathon video checklist.

## Current Scope

- Paste raw Vercel logs into the homepage incident analyst.
- Keep raw logs only in React state.
- Send logs to `POST /api/incidents` for incident reports; keep `POST /api/diagnoses` for legacy diagnosis clients.
- Redact obvious secrets before model calls or evidence display.
- Return the stable `DiagnosisResult` shape from Cerebras or mock fallback.
- Wrap diagnoses in `IncidentReport` output with investigation steps, evidence cards, repair plans, and safe actions.
- Save sanitized incident reports to Postgres and share them at `/i/[shareId]`.
- Keep legacy sanitized diagnosis shares working at `/d/[shareId]`.
- Store only sanitized report data, never the pasted raw log.

## Not Implemented Yet

- Auth.
- Dashboard or saved-diagnosis editing.
- Reading private Vercel logs from public deployment URLs.
- Vercel account connection or OAuth.
- GitHub diff inspection or PR generation.
- Auto-pushing fixes.
- Analytics.
