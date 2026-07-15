# DeployDoctor Sprint Plan (Finish Plan)

This is a forward-looking plan to take DeployDoctor from "working paste-analyzer +
inert connected foundation" to a finished, honest, demoable product. It complements
`docs/TASKS.md` (which tracks the already-completed Milestones 1–7B) and the
"Not Implemented Yet" list in `README.md`.

## Assumptions (change these and the later sprints shift)

This plan is written for the following default goals. If any is wrong, tell me and I
will re-scope the affected sprints.

1. **North-star: portfolio-grade demo.** Polished, honest, fully working, runs on the
   Vercel free tier. No end-user auth, single-user.
2. **Connected mode: manual pull ("Option B").** Because the free plan cannot create
   webhooks, the stored Vercel OAuth token is exercised by an on-demand
   "Fetch my latest failed deployment" button instead of automatic webhook ingestion.
3. **Big AI-vision features out of scope for now.** GitHub diff inspection and auto-fix
   PRs stay on the honest "not implemented yet" list; captured as optional future sprints.

## Current state (verified July 2026)

- All gates green: `pnpm test` (81 tests), `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- **Working, real product:** paste log → redact → classify → Cerebras/mock → `IncidentReport`
  → sanitized share at `/i/[shareId]`. Legacy `/d/[shareId]` still works.
- **Built but inert:** connected mode. OAuth (`lib/vercel/oauth.ts`) is correctly
  implemented against Vercel's Sign-in-with-Vercel spec, but the webhook route
  (`app/api/webhooks/vercel/route.ts`) is the ONLY code path that consumes the stored
  token. No webhook (free plan) ⇒ the token is never used.
- **DB works:** `POSTGRES_URL` is provisioned by the Neon integration and read by
  `getPostgresUrl()` (`lib/share/shareRepository.ts:145`).
- **Known external blocker:** `VERCEL_CLIENT_ID` env var must equal the integration's real
  `oac_...` id, or Connect Vercel shows "app ID is invalid". (Human task — see below.)

---

## Sprint 0 — Bug fixes & hardening (agent-doable, small)

Goal: clear the known defects before building anything new. Each item ships with tests.

- [ ] **Dead empty-event filter.** `deploymentEventsToSanitizedLog` (`lib/vercel/api.ts:85-93`)
      prefixes every line with `[event N type]` before filtering `line.trim().length > 0`,
      so the filter never drops empty events. Fix: evaluate the event text BEFORE prefixing
      and skip events whose text is empty.
- [ ] **Over-aggressive secret redaction.** `LONG_SECRET` (`lib/diagnosis/redact.ts:8`)
      redacts ANY 32+ char alphanumeric run, which also blanks legitimate evidence (long
      hashes, chunk names, base64 fragments in stack traces). Tighten to reduce false
      positives (require mixed character classes / higher entropy, keep the git-SHA
      exemption) so diagnosis keeps real evidence. Add before/after redaction tests.
- [ ] **Stray file.** Delete the empty `depdoc.txt` at repo root.
- [ ] **Config guard for `VERCEL_CLIENT_ID`.** In `assertVercelOAuthConfig` (or the start
      route), reject a missing or non-`oac_`-prefixed client id with a clear in-app message
      instead of redirecting to Vercel's cryptic "app ID is invalid" page.
- [ ] **(Optional) DB var robustness.** Let `getPostgresUrl()` also fall back to
      `DATABASE_URL` so any standard Postgres/Neon provisioning "just works". Low priority
      since `POSTGRES_URL` already exists.

Exit criteria: all gates green; redaction test proves real evidence survives; Connect Vercel
with a bad client id shows a friendly message.

---

## Sprint 1 — Connected mode via manual pull ("Option B")

Goal: make the stored OAuth token actually useful on the free plan — the missing *trigger*
the webhook would otherwise provide. Reuses `getDeploymentEvents`,
`deploymentEventsToSanitizedLog`, `generateServerDiagnosis`, `generateIncidentReport`.

- [ ] **List deployments helper.** Add `listDeployments()` to `lib/vercel/api.ts`
      (`GET https://api.vercel.com/v6/deployments`, filter `state=ERROR`), authorized with
      the decrypted token + optional `teamId`. Zod-parse the response.
- [ ] **Fetch-latest route.** `POST /api/vercel/deployments/fetch-latest`: load the connected
      connection, decrypt token, list failed deployments, pick the most recent, fetch its
      events, sanitize, diagnose, wrap in `IncidentReport`, store via the incident repository,
      return the report. Reuse the exact pipeline in `lib/vercel/incidentProcessor.ts` so
      webhook and manual paths stay identical.
- [ ] **UI trigger.** In the "Connected Vercel mode" card (`DiagnosisWorkspace.tsx`), add a
      "Fetch my latest failed deployment" button, enabled only when status is `connected`.
      Render the returned `IncidentReport` in the existing `IncidentReportCard`.
- [ ] **Graceful states.** Handle: not connected, no failed deployments found, token
      expired/invalid (fall back with a "reconnect Vercel or paste the log" message — mirror
      the existing catch in `incidentProcessor.ts`).
- [ ] Tests for the route (happy path, no-connection, no-failures, fetch error) and the API
      helper.

Human prerequisite: `VERCEL_CLIENT_ID` fixed + Connect Vercel completed once (see task list).

Exit criteria: with a valid connection, clicking the button produces a real incident report
from your own latest failed Vercel deployment — connected mode proven end-to-end, no webhook.

---

## Sprint 2 — Connected-mode robustness (only if goal ≥ shippable single-user)

Goal: stop connected mode silently degrading. Skippable for a pure demo.

- [ ] **Token refresh.** Use the already-stored encrypted `refresh_token` with
      `grant_type=refresh_token` at the Vercel token endpoint. On a 401 from any Vercel API
      call, refresh once and retry; persist the new encrypted tokens.
- [ ] **Connection status accuracy.** Surface "expired / needs reconnect" in
      `/api/vercel/connections/status` and the homepage badge.
- [ ] Tests for refresh success, refresh failure, and retry-once behavior.

---

## Sprint 3 — Product polish & trust

Goal: make the finished product feel finished.

- [ ] **Redaction precision** follow-through from Sprint 0 (add fixtures from real-world logs).
- [ ] **Report UX:** copy-to-clipboard on each command/`nextDiagnosticCommand`; tighten
      empty/loading/error states across homepage, `/incidents`, and share pages.
- [ ] **API hardening:** basic per-IP rate limit + consistent input guards on the POST routes.
- [ ] **Migrations:** replace the per-request `create table if not exists`
      (`storageRepository.ts`, `connections/repository.ts`) with a one-time
      `scripts/migrate.ts` run at deploy, to drop a round-trip per request. (Optional.)
- [ ] **Accessibility pass** (labels, focus states, contrast) on the workspace.
- [ ] **README screenshots** (human task — capture real ones).

---

## Sprint 4 — GitHub diff inspection, read-only (OPTIONAL / future)

Only if you opt the AI-vision features into scope. Read-only, no pushing.

- [ ] GitHub read-only access (App or fine-grained PAT) to fetch the failing commit's diff.
- [ ] Feed a sanitized diff excerpt into the diagnosis prompt as extra evidence.
- [ ] Keep behind a feature flag and honest copy; never auto-push.

## Sprint 5 — Auth & multi-tenancy (OPTIONAL / future)

Only if the goal becomes a real multi-user product.

- [ ] Wire login (you already have `AUTH0_*` env vars present, or use NextAuth).
- [ ] Scope `vercel_connections`, `incidents`, and shares per user.
- [ ] Fix multi-tenant matching: `findConnectedVercelConnectionForProject`
      (`connections/repository.ts:151`) currently matches a null-`project_id` connection to
      ANY incoming webhook — correct for single-user, wrong once there are multiple users.

---

## Human task list (things an agent cannot do)

These require your accounts / browser / decisions and block the sprints noted.

1. **Fix `VERCEL_CLIENT_ID`** in Vercel project env to the integration's real
   `oac_...` id (Credentials tab), confirm `VERCEL_CLIENT_SECRET`/`VERCEL_REDIRECT_URI`,
   then **redeploy**. *(Unblocks Connect Vercel and Sprint 1.)*
2. **Confirm `TOKEN_ENCRYPTION_KEY`** is a valid base64 32-byte key
   (`echo -n "<val>" | base64 -d | wc -c` → 32); regenerate with `openssl rand -base64 32`
   if not. Lock it in BEFORE connecting Vercel. *(Safe to change now — nothing depends on
   it yet.)*
3. **Connect Vercel once** in the browser to store a token. *(Gives Sprint 1 something to
   pull.)*
4. **(Only for webhook/marketplace path)** upgrade to a paid Vercel plan. *(Not needed for
   the manual-pull default.)*
5. **(Only for Sprint 4)** create a GitHub App / provide a read-only token.
6. **Capture README/demo screenshots.**
7. **(Optional cleanup)** remove unused env vars — `AUTH0_*`, `NEON_AUTH_BASE_URL`,
   `VITE_NEON_AUTH_URL` — unless you pursue the auth sprint. They are inert; the app reads
   none of them.

## Sequencing

Sprint 0 → Sprint 1 are the core path to a finished demo and can start immediately
(Sprint 0 needs nothing from you; Sprint 1's verification needs human tasks 1–3).
Sprints 2–5 are opt-in based on how far past "demo" you want to take it.
