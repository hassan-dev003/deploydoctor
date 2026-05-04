# DeployDoctor Tasks

## Milestone 1: App Foundation + Local Mocked Diagnosis

Status: implemented in this repository.

- [x] Scaffold Next.js App Router with TypeScript, Tailwind CSS, pnpm, ESLint, and Vitest.
- [x] Build the first-screen pasted-log tool.
- [x] Keep raw logs only in React state.
- [x] Add visible privacy note near the textarea.
- [x] Define the stable `DiagnosisResult` Zod contract.
- [x] Add secret redaction utilities.
- [x] Add rule-based classification for common Vercel/Next.js failures.
- [x] Add `generateMockDiagnosis` as the replaceable Milestone 1 diagnosis seam.
- [x] Show mocked diagnosis output with root cause, reasoning, evidence, next steps, files, and commands.
- [x] Add disabled future share affordance without implementing persistence.
- [x] Add Vitest coverage for redaction, classifier basics, and evidence redaction.

## Milestone 2: AI Server-Side Diagnosis (Cerebras)

Status: implemented in this repository.

- [x] Future-proof `generatedBy` for `mock` and `cerebras`.
- [x] Add input size guard with excerpt guidance.
- [x] Add `POST /api/diagnoses`.
- [x] Replace the local mock adapter body with a server call.
- [x] Use Cerebras structured output that returns the existing `DiagnosisResult` shape.
- [x] Keep redaction before any model request.
- [x] Add mock fallback when `CEREBRAS_API_KEY` is missing or the model call fails.
- [x] Add tests for API validation, redaction-before-model, Cerebras output, and fallback behavior.

### Milestone 3: DB-Backed Saved/Share Pages

Status: implemented in this repository.

- [x] Add database schema for saved diagnoses.
- [x] Save sanitized diagnosis data, not raw logs.
- [x] Add public unguessable share pages.
- [x] Enable the current disabled share affordance.
- [x] Add strict save endpoint validation.
- [x] Recursively redact diagnosis strings before DB writes.
- [x] Keep diagnosis working without `POSTGRES_URL`.
- [x] Add tests for validation, redaction, payload shape, and read validation.

### Milestone 4: Deployment On Vercel

Status: implemented in this repository.

- [x] Configure production environment variables.
- [x] Link and deploy the app on Vercel.
- [x] Verify build, lint, tests, and typecheck in the deployment workflow.

## Next Milestones

### Milestone 5: Demo Polish

- [x] Add more realistic sample logs.
- [x] Improve result copy and empty/error states.
- [x] Add screenshots or a short demo recording.

### Milestone 6: Incident Analyst Layer

- [x] Add `IncidentReport` wrapper around `DiagnosisResult`.
- [x] Add `POST /api/incidents` while keeping `POST /api/diagnoses`.
- [x] Upgrade homepage to timeline, evidence cards, repair plan, and safe actions.
- [x] Add honest current/future capability copy.
- [x] Add incident sharing at `/api/incidents/share` and `/i/[shareId]`.
- [x] Preserve legacy diagnosis sharing at `/d/[shareId]`.
- [x] Add tests for incident schema, API validation, redaction, sharing, and legacy diagnosis API.
