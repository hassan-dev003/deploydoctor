# DeployDoctor Technical Spec

## Current Milestone

Milestone 4 is a Vercel-ready Next.js App Router app with server-side diagnosis, DB-backed public share pages, and deployment-time verification. Diagnosis calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mock diagnosis when the key is missing or the model call fails. Sharing requires `POSTGRES_URL` or `depdoc_POSTGRES_URL`; diagnosis still works without either variable.

## Diagnosis Contract

`lib/diagnosis/schema.ts` defines `DiagnosisResult`, the stable contract for:

- current UI rendering,
- current tests,
- future server/API diagnosis,
- future DB-backed saved diagnosis records.

`generatedBy` is `mock` for fallback output and `cerebras` for successful model output.

## Diagnosis Flow

1. User pastes logs into the homepage.
2. Raw logs remain only in React state until analysis.
3. UI calls `analyzePastedLog`.
4. Adapter posts to `POST /api/diagnoses`.
5. API validates size and shape.
6. Server redacts obvious secrets before any Cerebras call.
7. Cerebras Structured Outputs returns `DiagnosisResult`, or the server falls back to `generateMockDiagnosis`.
8. UI renders the structured diagnosis result.

## Share Flow

1. User clicks Share diagnosis after analysis.
2. UI posts `{ diagnosis }` to `POST /api/diagnoses/share`.
3. The route uses a strict request schema and rejects top-level extras such as raw logs.
4. Server recursively redacts every string field in the diagnosis.
5. Server lazily ensures the `diagnosis_shares` table exists at request time.
6. Server stores metadata plus sanitized `DiagnosisResult` JSON.
7. UI receives `/d/[shareId]` and shows a copyable link.
8. Public page loads the saved diagnosis and renders `DiagnosisResultCard`.

The DB stores `shareId`, `createdAt`, `category`, `generatedBy`, `title`, `summary`, and `diagnosis_json`. It does not store raw logs, pasted input, prompts, or analytics.

## Deployment Flow

1. Vercel installs dependencies with pnpm.
2. `vercel.json` runs `pnpm test && pnpm lint && pnpm typecheck && pnpm build`.
3. The deployment fails if tests, lint, typecheck, or the production Next.js build fail.
4. Production should define `CEREBRAS_API_KEY`, optional `CEREBRAS_MODEL`, and either `POSTGRES_URL` or `depdoc_POSTGRES_URL`.
5. The production deployment is aliased at `https://deploydoctor.vercel.app`.
