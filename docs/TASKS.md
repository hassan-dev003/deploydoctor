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

## Milestone 2: OpenAI Server-Side Diagnosis

Status: implemented in this repository.

- [x] Future-proof `generatedBy` for `mock` and `openai`.
- [x] Add input size guard with excerpt guidance.
- [x] Add `POST /api/diagnoses`.
- [x] Replace the local mock adapter body with a server call.
- [x] Use OpenAI structured output that returns the existing `DiagnosisResult` shape.
- [x] Keep redaction before any model request.
- [x] Add mock fallback when `OPENAI_API_KEY` is missing or the model call fails.
- [x] Add tests for API validation, redaction-before-model, OpenAI output, and fallback behavior.

## Next Milestones

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

- [ ] Configure production environment variables.
- [ ] Deploy the app on Vercel.
- [ ] Verify build, lint, tests, and typecheck in the deployment workflow.

### Milestone 5: Demo Polish

- [ ] Add more realistic sample logs.
- [ ] Improve result copy and empty/error states.
- [ ] Add screenshots or a short demo recording.
