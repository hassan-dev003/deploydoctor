# DeployDoctor Demo Checklist

## 60-90 Second Walkthrough

1. Open `https://deploydoctor.vercel.app`.
2. Say: "DeployDoctor turns failed Vercel build logs into evidence-backed incident reports."
3. Click the `Missing Production env var` sample and point out that the log is fake and sanitized.
4. Click `Analyze incident`.
5. Show the incident report: timeline, evidence cards, repair plan, safe actions, and legacy diagnosis details.
6. Click `Share incident`.
7. Open the generated `/i/[shareId]` page.
8. Say: "The share page stores sanitized incident data only. The raw pasted log is not persisted."
9. Close by mentioning the same UI works with Cerebras output or deterministic mock fallback.

## Quick Talking Points

- Built for developers debugging failed Vercel or Next.js deployments.
- Pasted logs stay client-side until analysis.
- Server redacts obvious secrets before AI calls and before share persistence.
- Public links are backed by unguessable share IDs.
- Current scope is pasted log analysis. It does not read private Vercel logs from public URLs, connect Vercel accounts, inspect GitHub diffs, or push fixes.
- The demo covers incident reports, fallback behavior, and DB-backed sharing without auth or dashboards.

## Pre-Recording Checks

- Homepage loads.
- At least one sample returns `generatedBy: cerebras` in production.
- Share link creation succeeds.
- Shared incident page renders.
- Invalid share IDs show not-found behavior.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass locally before recording.
