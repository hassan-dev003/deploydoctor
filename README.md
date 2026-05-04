# DeployDoctor

DeployDoctor helps developers understand why a Vercel deployment failed and what to try next.

This repository is currently at **Milestone 1**: a local Next.js App Router demo with deterministic mocked diagnosis. There is no OpenAI integration, database, auth, or share-page persistence yet. The MVP input is pasted logs only.

## Local Setup

Use pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Available Commands

```bash
pnpm dev
```

Starts the local Next.js development server.

```bash
pnpm test
```

Runs Vitest tests for redaction and rule-based classification.

```bash
pnpm lint
```

Runs ESLint with Next.js rules.

```bash
pnpm typecheck
```

Runs TypeScript without emitting build output.

```bash
pnpm build
```

Creates a production Next.js build.

## Milestone 1 Scope

- Paste raw Vercel logs into the homepage tool.
- Keep raw logs only in React state.
- Redact obvious secrets before showing evidence.
- Classify common deployment failures with deterministic rules.
- Show a mocked, structured diagnosis with root cause, evidence, next steps, files to check, and commands to try.
- Keep a disabled share affordance for future DB-backed share pages.

## Not Implemented Yet

- OpenAI diagnosis.
- Vercel deployment import.
- Database persistence.
- Share pages.
- Auth.
