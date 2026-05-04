# DeployDoctor Technical Spec

## Current Milestone

Milestone 7B is a paste-first Vercel deployment incident analyst with a Vercel authorization and authenticated log-fetching foundation. Milestone 6 added `IncidentReport` for pasted logs; Milestone 7A added metadata-only Vercel deployment failure webhook storage; Milestone 7B adds OAuth token storage, webhook signature verification, and authorized deployment-event fetching. Diagnosis calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mock diagnosis when the key is missing or the model call fails. Sharing and the webhook inbox require `POSTGRES_URL` or `depdoc_POSTGRES_URL`; paste analysis still works without either variable.

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

## Vercel Connected Foundation

1. User starts Vercel authorization at `GET /api/vercel/oauth/start`.
2. The route creates signed state, nonce, and PKCE verifier data in an httpOnly cookie.
3. Vercel redirects to `GET /api/vercel/oauth/callback`.
4. The callback validates state, exchanges the code for tokens, encrypts tokens with `TOKEN_ENCRYPTION_KEY`, and upserts `vercel_connections`.
5. Vercel sends webhook-shaped JSON to `POST /api/webhooks/vercel`.
6. The route reads the raw body and verifies `x-vercel-signature` when `VERCEL_WEBHOOK_SECRET` is configured.
7. `deployment.error` and legacy `deployment-error` create stored incidents.
8. If a matching connected token exists, DeployDoctor fetches Vercel deployment events, sanitizes event text, generates `IncidentReport`, and updates the stored incident.
9. If no connection exists, the incident remains metadata-only and says authorization is required.
10. Unrelated events return `202` with `ignored` status.

`vercel_connections` stores encrypted OAuth tokens only. Plaintext access and refresh tokens must never be written to the database or returned to the client. Fetched deployment logs are not stored directly; only sanitized evidence inside `IncidentReport` may be persisted.

Required connected-mode environment variables:

- `VERCEL_CLIENT_ID`
- `VERCEL_CLIENT_SECRET`
- `VERCEL_REDIRECT_URI`
- `TOKEN_ENCRYPTION_KEY`
- `VERCEL_WEBHOOK_SECRET`

Connected mode also requires manual Vercel setup in Milestone 7B:

- A Vercel webhook must be configured manually to call `/api/webhooks/vercel`.
- The Vercel webhook secret must match `VERCEL_WEBHOOK_SECRET`.
- A production smoke test should verify that the OAuth token has permission to fetch deployment events for the connected project.
- Pasted-log analysis remains the fallback path when OAuth permissions or webhook delivery are not ready.

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
- DeployDoctor fetches private Vercel deployment events only after OAuth authorization.
- DeployDoctor does not refresh tokens yet.
- DeployDoctor does not provide full marketplace polish yet.
- DeployDoctor does not create Vercel webhooks automatically yet.
- DeployDoctor does not inspect GitHub diffs or open PRs.
- DeployDoctor does not auto-push fixes.

## Deployment Flow

1. Vercel installs dependencies with pnpm.
2. `vercel.json` runs `pnpm test && pnpm lint && pnpm typecheck && pnpm build`.
3. The deployment fails if tests, lint, typecheck, or the production Next.js build fail.
4. Production should define `CEREBRAS_API_KEY`, optional `CEREBRAS_MODEL`, either `POSTGRES_URL` or `depdoc_POSTGRES_URL`, and connected-mode vars when OAuth/webhooks are enabled.
5. The production deployment is aliased at `https://deploydoctor.vercel.app`.
