# Repository Guidelines

## Project Structure & Module Organization

DeployDoctor is a Next.js App Router project using TypeScript, Tailwind CSS, Zod, Vitest, and pnpm.

- `app/`: routes, layout, global styles, and the tool-first homepage.
- `components/diagnosis/`: UI components for the pasted-log workflow, `IncidentReportCard`, and legacy diagnosis result card.
- `app/api/incidents/route.ts`: server incident endpoint that wraps the diagnosis pipeline in `IncidentReport`.
- `app/api/diagnoses/route.ts`: legacy server diagnosis endpoint.
- `app/api/incidents/share/route.ts`: saves sanitized incident reports for public links.
- `app/api/diagnoses/share/route.ts`: saves sanitized diagnosis results for public links.
- `app/api/webhooks/vercel/route.ts`: verifies Vercel webhook signatures and stores/enriches webhook incidents.
- `app/api/vercel/oauth/start/route.ts` and `app/api/vercel/oauth/callback/route.ts`: minimal Vercel OAuth foundation.
- `app/i/[shareId]/page.tsx`: public shared incident report page.
- `app/d/[shareId]/page.tsx`: public shared diagnosis page.
- `app/incidents/`: internal webhook incident inbox and detail pages.
- `lib/incidents/`: incident contract, report generation, client adapter, share schemas, and DB repository.
- `lib/diagnosis/`: shared diagnosis contract, redaction, classifier, Cerebras generator, mock fallback, samples, and adapter seam.
- `lib/share/`: legacy diagnosis share request schemas, DB repository, recursive redaction before save, and client adapter.
- `lib/security/tokenCrypto.ts`: server-only AES-GCM token encryption helpers.
- `lib/vercel/`: OAuth helpers, API client, webhook parsing/signature processing, and connection repository.
- `lib/agent/`: the investigation agent — a tool-calling loop (Vercel AI SDK + Cerebras) whose tools read Vercel deployment/project data (env var keys only, never values) to verify a hypothesis before reporting.
- `tests/diagnosis/`, `tests/incidents/`, and `tests/share/`: Vitest coverage for redaction, classification, incident reports, and share behavior.
- `docs/`: product notes, task tracking, and future technical planning.

Keep raw pasted logs out of persistence. The UI keeps logs in React state, the server redacts before Cerebras calls, and sharing stores only sanitized `IncidentReport` or legacy `DiagnosisResult` JSON plus metadata.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and update `pnpm-lock.yaml`.
- `pnpm dev`: start the local Next.js dev server.
- `pnpm build`: create a production build.
- `pnpm test`: run Vitest tests.
- `pnpm lint`: run ESLint with Next.js rules.
- `pnpm typecheck`: run TypeScript checks without emitting files.

Sharing and connected webhook storage require `POSTGRES_URL` or `depdoc_POSTGRES_URL`. Vercel OAuth/log fetching also requires `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET`, `VERCEL_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, and `VERCEL_WEBHOOK_SECRET`. Incident analysis and legacy diagnosis must continue to work when those env vars are absent.

## Coding Style & Naming Conventions

Use strict TypeScript and small modules. UI should depend on incident/diagnosis adapter functions and shared types, not classifier or provider internals.

- Components: `PascalCase`, for example `IncidentReportCard`.
- Functions and variables: `camelCase`, for example `generateMockDiagnosis`.
- Route and directory names: lowercase or `kebab-case`.
- Shared contracts: define with Zod in `lib/diagnosis/schema.ts` or `lib/incidents/schema.ts` and export inferred TypeScript types.

Use Tailwind utilities for styling. Do not add `shadcn/ui` unless a future task explicitly needs it.

## Testing Guidelines

Add or update Vitest tests when changing incident or diagnosis behavior. Cover:

- secret redaction,
- classifier categories,
- evidence displayed from diagnosis or incident output.

Test files should live under `tests/diagnosis/`, `tests/incidents/`, or `tests/share/` and use `*.test.ts` names.

## Commit & Pull Request Guidelines

This repo has no established commit convention yet. Use short imperative commit messages such as `Add mocked diagnosis flow`.

Pull requests should include a summary, test results, and screenshots for visible UI changes. Call out any privacy-impacting changes, especially anything that stores or transmits pasted logs.

## Future Architecture Notes

`DiagnosisResult` is the stable legacy contract for Cerebras output and mock fallback. `IncidentReport` is the current homepage/share contract and wraps `DiagnosisResult`. Share IDs must be unguessable and public links must never expose pasted raw logs.

The connected path is the bring-your-own-token investigation agent (`lib/agent/`): the token is used transiently and never stored, and the agent verifies its hypothesis against the real project before reporting. Fetched deployment events must always be sanitized, and environment variable values must never be requested or sent to the model (keys and targets only). The OAuth + webhook code remains a parked foundation. Agentic investigation is real and may be described as such, but do not claim GitHub diff inspection, auto-fix PRs, token refresh, or full marketplace integration until those are actually implemented.
