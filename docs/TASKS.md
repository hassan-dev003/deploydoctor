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

- [ ] Add database schema for saved diagnoses.
- [ ] Save sanitized diagnosis data, not raw logs.
- [ ] Add public unguessable share pages.
- [ ] Enable the current disabled share affordance.

### Milestone 4: Deployment On Vercel

- [ ] Configure production environment variables.
- [ ] Deploy the app on Vercel.
- [ ] Verify build, lint, tests, and typecheck in the deployment workflow.

### Milestone 5: Demo Polish

- [ ] Add more realistic sample logs.
- [ ] Improve result copy and empty/error states.
- [ ] Add screenshots or a short demo recording.
