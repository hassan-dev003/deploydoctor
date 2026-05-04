# Repository Guidelines

## Project Structure & Module Organization

DeployDoctor is a Next.js App Router project using TypeScript, Tailwind CSS, Zod, Vitest, and pnpm.

- `app/`: routes, layout, global styles, and the tool-first homepage.
- `components/diagnosis/`: UI components for the pasted-log workflow and diagnosis result card.
- `lib/diagnosis/`: shared diagnosis contract, redaction, classifier, mock generator, samples, and adapter seam.
- `tests/diagnosis/`: Vitest coverage for redaction and classification.
- `docs/`: product notes, task tracking, and future technical planning.

Keep raw pasted logs out of persistence. Milestone 1 stores logs only in React state and displays only redacted evidence.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and update `pnpm-lock.yaml`.
- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: create a production build.
- `pnpm test`: run Vitest tests.
- `pnpm lint`: run ESLint with Next.js rules.
- `pnpm typecheck`: run TypeScript checks without emitting files.

## Coding Style & Naming Conventions

Use strict TypeScript and small modules. UI should depend on diagnosis adapter functions and shared types, not regex internals.

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

`DiagnosisResult` is the stable contract for UI, future API routes, and future DB persistence. Milestone 2 should replace the mock adapter with server-side OpenAI diagnosis returning the same shape. Milestone 3 should add DB-backed saved/share pages without storing raw logs.
