# DeployDoctor Technical Spec

## Current Milestone

Milestone 7A is a paste-first Vercel deployment incident analyst with a webhook ingestion foundation. Milestone 6 added `IncidentReport` for pasted logs; Milestone 7A adds metadata-only Vercel deployment failure webhook storage. Diagnosis calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mock diagnosis when the key is missing or the model call fails. Sharing and the webhook inbox require `POSTGRES_URL` or `depdoc_POSTGRES_URL`; paste analysis still works without either variable.

## Diagnosis Contract

`lib/diagnosis/schema.ts` defines `DiagnosisResult`, the stable contract for:

- current UI rendering,
- current tests,
- future server/API diagnosis,
- future DB-backed saved diagnosis records.

`generatedBy` is `mock` for fallback output and `cerebras` for successful model output.

## Incident Flow

1. User pastes logs into the homepage.
2. Raw logs remain only in React state until analysis.
3. UI calls `analyzePastedIncident`.
4. Adapter posts to `POST /api/incidents`.
5. API validates size and shape.
6. Server redacts obvious secrets before any Cerebras call.
7. Cerebras Structured Outputs returns `DiagnosisResult`, or the server falls back to `generateMockDiagnosis`.
8. Server wraps the diagnosis in `IncidentReport`.
9. UI renders timeline, evidence cards, repair plan, safe actions, and legacy diagnosis details.

`sourceType` is `pasted_log` for manually entered logs, `sample_log` when the homepage sample buttons populate the textarea, and `vercel_webhook` for metadata-only webhook-created incidents. `POST /api/diagnoses` remains available for legacy clients and still returns `DiagnosisResult`.

## Vercel Webhook Foundation

1. Vercel sends webhook-shaped JSON to `POST /api/webhooks/vercel`.
2. The route validates the base webhook shape: `type`, `id`, `createdAt`, optional `region`, and `payload`.
3. `deployment.error` and legacy `deployment-error` create placeholder stored incidents.
4. Unrelated events return `202` with `ignored` status.
5. Stored webhook incidents use `sourceType: vercel_webhook` and contain sanitized webhook metadata only.

`vercel_connections` stores future connection metadata, including nullable encrypted-token columns for later OAuth work. Milestone 7A does not implement OAuth, token encryption, token refresh, webhook signature verification, or automatic log fetching.

## Share Flow

1. User clicks Share incident after analysis.
2. UI posts `{ incident }` to `POST /api/incidents/share`.
3. The route uses a strict request schema and rejects top-level extras such as raw logs.
4. Server recursively redacts every string field in the incident.
5. Server lazily ensures the `incident_shares` table exists at request time.
6. Server stores metadata plus sanitized `IncidentReport` JSON.
7. UI receives `/i/[shareId]` and shows a copyable link.
8. Public page loads the saved incident and renders `IncidentReportCard`.

Legacy diagnosis sharing still uses `POST /api/diagnoses/share`, `diagnosis_shares`, and `/d/[shareId]`. Neither share flow stores raw logs, pasted input, prompts, or analytics.

## Explicit Non-Claims

- DeployDoctor does not read private Vercel logs from public deployment URLs.
- DeployDoctor does not connect Vercel accounts yet.
- DeployDoctor does not refresh tokens or fetch private logs automatically yet.
- DeployDoctor does not inspect GitHub diffs or open PRs.
- DeployDoctor does not auto-push fixes.

## Deployment Flow

1. Vercel installs dependencies with pnpm.
2. `vercel.json` runs `pnpm test && pnpm lint && pnpm typecheck && pnpm build`.
3. The deployment fails if tests, lint, typecheck, or the production Next.js build fail.
4. Production should define `CEREBRAS_API_KEY`, optional `CEREBRAS_MODEL`, and either `POSTGRES_URL` or `depdoc_POSTGRES_URL`.
5. The production deployment is aliased at `https://deploydoctor.vercel.app`.
