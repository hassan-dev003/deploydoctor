# DeployDoctor

DeployDoctor helps developers understand why a Vercel deployment failed and what to try next.

This repository is currently at **Milestone 2**: a Next.js App Router demo with server-side diagnosis. The app calls OpenAI when `OPENAI_API_KEY` is configured and falls back to deterministic mocked diagnosis when the key is missing or the model call fails. There is no database, auth, or share-page persistence yet. The MVP input is pasted logs only.

## Local Setup

Use pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

To enable OpenAI diagnosis, add:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_MODEL` is optional and defaults to `gpt-5-mini`.

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

## Current Scope

- Paste raw Vercel logs into the homepage tool.
- Keep raw logs only in React state.
- Send logs to `POST /api/diagnoses` for server-side diagnosis.
- Redact obvious secrets before model calls or evidence display.
- Return the stable `DiagnosisResult` shape from OpenAI or mock fallback.
- Show a structured diagnosis with root cause, evidence, next steps, files to check, and commands to try.
- Keep a disabled share affordance for future DB-backed share pages.

## Not Implemented Yet

- Vercel deployment import.
- Database persistence.
- Share pages.
- Auth.
