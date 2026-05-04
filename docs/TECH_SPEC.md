# DeployDoctor Technical Spec

## Current Milestone

Milestone 2 is a Next.js App Router app with server-side diagnosis. It calls OpenAI when `OPENAI_API_KEY` is configured and falls back to deterministic mock diagnosis when the key is missing or the model call fails. It does not store logs, connect to a database, or create share pages.

## Diagnosis Contract

`lib/diagnosis/schema.ts` defines `DiagnosisResult`, the stable contract for:

- current UI rendering,
- current tests,
- future server/API diagnosis,
- future DB-backed saved diagnosis records.

`generatedBy` is `mock` for fallback output and `openai` for successful model output.

## Diagnosis Flow

1. User pastes logs into the homepage.
2. Raw logs remain only in React state until analysis.
3. UI calls `analyzePastedLog`.
4. Adapter posts to `POST /api/diagnoses`.
5. API validates size and shape.
6. Server redacts obvious secrets before any OpenAI call.
7. OpenAI Structured Outputs returns `DiagnosisResult`, or the server falls back to `generateMockDiagnosis`.
8. UI renders the structured diagnosis result.

## Future Seams

- Milestone 3: persist sanitized diagnosis data for share pages. Do not store raw logs.
