# DeployDoctor PRD

## One-liner
DeployDoctor turns failed Vercel deployments into evidence-backed incident reports.

## Target user
Indie hackers, students, and frontend developers deploying Next.js/Vercel projects.

## Problem
Vercel deployment logs can be noisy. Users often do not know which line matters, what caused the failure, what evidence supports that conclusion, or what safe command/check to run next.

## Core flow
1. User pastes deployment logs.
2. App analyzes the failure.
3. App returns an incident report with timeline, evidence cards, likely root cause, repair plan, and safe actions.
4. User can share a sanitized public incident report.
5. Legacy diagnosis details remain available inside the report.

## MVP
- Paste raw Vercel logs.
- Parse and classify error type.
- AI-generated or mock fallback diagnosis wrapped in an incident report.
- Evidence-backed repair plan.
- Example commands.
- Save/share incident report page.

## Non-goals for MVP
- No need to access private Vercel logs via link only.
- No automatic credential-based Vercel integration at first.
- No auto-pushing fixes to GitHub at first.
- No GitHub diff inspection or PR generation yet.
- No analytics.

## Differentiator
Not just “show logs.” It explains:
- the actual failing line,
- likely root cause,
- why it failed,
- how to fix safely,
- confidence level,
- next diagnostic command.

## Success criteria
A user can paste a failed deployment log and understand what to do next within 30 seconds.
