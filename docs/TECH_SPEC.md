# DeployDoctor Technical Spec

## Current Milestone

Milestone 1 is a local mocked Next.js App Router app. It does not call OpenAI, store logs, connect to a database, or create share pages.

## Diagnosis Contract

`lib/diagnosis/schema.ts` defines `DiagnosisResult`, the stable contract for:

- current UI rendering,
- current tests,
- future server/API diagnosis,
- future DB-backed saved diagnosis records.

The current `generatedBy` value is `mock`. Future milestones can extend this once OpenAI is integrated.

## Diagnosis Flow

1. User pastes logs into the homepage.
2. Raw logs remain only in React state.
3. UI calls `analyzePastedLog`.
4. Milestone 1 adapter calls `generateMockDiagnosis`.
5. Classifier identifies a likely category.
6. Evidence lines are redacted before display.
7. UI renders a structured diagnosis result.

## Future Seams

- Milestone 2: replace the adapter implementation with a server/API call that returns `DiagnosisResult`.
- Milestone 3: persist sanitized diagnosis data for share pages. Do not store raw logs.
