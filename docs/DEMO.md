# DeployDoctor Demo Checklist

## 60-90 Second Walkthrough

1. Open `https://deploydoctor.vercel.app`.
2. Say: "DeployDoctor turns failed Vercel build logs into a concrete repair checklist."
3. Click the `Missing env` sample and point out that the log is fake and sanitized.
4. Click `Analyze pasted log`.
5. Show the result card: category, generated source, confidence, root cause, evidence, repair checklist, files/settings, and first command.
6. Click `Share diagnosis`.
7. Open the generated `/d/[shareId]` page.
8. Say: "The share page stores sanitized diagnosis data only. The raw pasted log is not persisted."
9. Close by mentioning the same UI works with Cerebras output or deterministic mock fallback.

## Quick Talking Points

- Built for developers debugging failed Vercel or Next.js deployments.
- Pasted logs stay client-side until analysis.
- Server redacts obvious secrets before AI calls and before share persistence.
- Public links are backed by unguessable share IDs.
- The demo covers AI diagnosis, fallback behavior, and DB-backed sharing without auth or dashboards.

## Pre-Recording Checks

- Homepage loads.
- At least one sample returns `generatedBy: cerebras` in production.
- Share link creation succeeds.
- Shared diagnosis page renders.
- Invalid share IDs show not-found behavior.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass locally before recording.
