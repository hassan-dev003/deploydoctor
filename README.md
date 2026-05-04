# DeployDoctor

DeployDoctor helps developers understand why a Vercel deployment failed and what to try next.

This repository is currently at **Milestone 4**: a deployed-ready Next.js App Router demo with server-side diagnosis, DB-backed public share pages, and Vercel build verification. The app calls Cerebras when `CEREBRAS_API_KEY` is configured and falls back to deterministic mocked diagnosis when the key is missing or the model call fails. The MVP input is pasted logs only.

## Local Setup

Use pnpm:

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

To enable AI diagnosis, add:

```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
```

`CEREBRAS_MODEL` is optional and defaults to `gpt-oss-120b`. Other available models include `llama3.1-8b` (fastest) and `qwen-3-235b-a22b-instruct-2507` (preview).

To enable saved share links, add:

```bash
POSTGRES_URL=your_vercel_postgres_or_neon_connection_string
```

Vercel Postgres and Neon integrations may also expose a project-prefixed `depdoc_POSTGRES_URL`; DeployDoctor supports either variable. Diagnosis still works without a Postgres URL; only saving/share links return a friendly configuration error.

## Vercel Deployment

The project is linked to Vercel as `deploydoctor` and deployed at:

```bash
https://deploydoctor.vercel.app
```

Configure these production environment variables in Vercel:

```bash
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
POSTGRES_URL=your_vercel_postgres_or_neon_connection_string
```

`POSTGRES_URL` can be replaced by `depdoc_POSTGRES_URL` when using the current prefixed integration variables.

Vercel uses `vercel.json` to run:

```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

This keeps tests, lint, typecheck, and the production Next.js build in the deployment workflow. The current production deployment has passed those checks.

## Available Commands

```bash
pnpm dev
```

Starts the local Next.js development server.

```bash
pnpm test
```

Runs Vitest tests for diagnosis, redaction, classification, and sharing behavior.

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
- Return the stable `DiagnosisResult` shape from Cerebras or mock fallback.
- Show a structured diagnosis with root cause, evidence, next steps, files to check, and commands to try.
- Save sanitized diagnosis results to Postgres and share them at `/d/[shareId]`.
- Store only sanitized diagnosis data, never the pasted raw log.

## Not Implemented Yet

- Auth.
- Dashboard or saved-diagnosis editing.
