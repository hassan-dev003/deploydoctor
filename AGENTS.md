# Repository Guidelines

## Project Structure & Module Organization

DeployDoctor is a Next.js App Router project using TypeScript, Tailwind CSS, Zod, Vitest, and pnpm.

- `app/`: routes, layout, global styles, and the tool-first homepage.
- `components/diagnosis/`: UI components for the pasted-log workflow and diagnosis result card.
- `app/api/diagnoses/route.ts`: server diagnosis endpoint.
- `app/api/diagnoses/share/route.ts`: saves sanitized diagnosis results for public links.
- `app/d/[shareId]/page.tsx`: public shared diagnosis page.
- `lib/diagnosis/`: shared diagnosis contract, redaction, classifier, Cerebras generator, mock fallback, samples, and adapter seam.
- `lib/share/`: share request schemas, DB repository, recursive redaction before save, and client adapter.
- `tests/diagnosis/`: Vitest coverage for redaction and classification.
- `docs/`: product notes, task tracking, and future technical planning.

Keep raw pasted logs out of persistence. The UI keeps logs in React state, the server redacts before Cerebras calls, and sharing stores only sanitized `DiagnosisResult` JSON plus metadata.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and update `pnpm-lock.yaml`.
- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: create a production build.
- `pnpm test`: run Vitest tests.
- `pnpm lint`: run ESLint with Next.js rules.
- `pnpm typecheck`: run TypeScript checks without emitting files.

Sharing requires `POSTGRES_URL`. Diagnosis must continue to work when that env var is absent.

## Coding Style & Naming Conventions

Use strict TypeScript and small modules. UI should depend on diagnosis adapter functions and shared types, not classifier or provider internals.

- Components: `PascalCase`, for example `DiagnosisResultCard`.
- Functions and variables: `camelCase`, for example `generateMockDiagnosis`.
- Route and directory names: lowercase or `kebab-case`.
- Shared contracts: define with Zod in `lib/diagnosis/schema.ts` and export inferred TypeScript types.

Use Tailwind utilities for styling. Do not add `shadcn/ui` unless a future task explicitly needs it.

## Testing Guidelines

Add or update Vitest tests when changing diagnosis behavior. Cover:

- secret redaction,
- classifier categories,
- evidence displayed from diagnosis output.

Test files should live under `tests/diagnosis/` and use `*.test.ts` names.

## Commit & Pull Request Guidelines

This repo has no established commit convention yet. Use short imperative commit messages such as `Add mocked diagnosis flow`.

Pull requests should include a summary, test results, and screenshots for visible UI changes. Call out any privacy-impacting changes, especially anything that stores or transmits pasted logs.

## Future Architecture Notes

`DiagnosisResult` is the stable contract for UI, API routes, Cerebras output, mock fallback, and DB-backed share pages. Share IDs must be unguessable and public links must never expose pasted raw logs.
