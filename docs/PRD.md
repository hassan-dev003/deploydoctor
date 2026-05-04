# DeployDoctor PRD

## One-liner
DeployDoctor helps developers understand why a Vercel deployment failed and gives clear, actionable fixes.

## Target user
Indie hackers, students, and frontend developers deploying Next.js/Vercel projects.

## Problem
Vercel deployment logs can be noisy. Users often do not know which line matters, what caused the failure, or what exact file/code change to make.

## Core flow
1. User pastes deployment logs or connects/imports a deployment.
2. App analyzes the failure.
3. App identifies likely root cause.
4. App explains it in plain English.
5. App suggests exact fixes.
6. Optional: generate a patch or checklist.

## MVP
- Paste raw Vercel logs.
- Parse and classify error type.
- AI-generated diagnosis.
- Suggested fix steps.
- Example commands.
- Save/share diagnosis page.

## Non-goals for MVP
- No need to access private Vercel logs via link only.
- No automatic credential-based Vercel integration at first.
- No auto-pushing fixes to GitHub at first.

## Differentiator
Not just “show logs.” It explains:
- the actual failing line,
- likely root cause,
- why it failed,
- how to fix,
- confidence level,
- next diagnostic command.

## Success criteria
A user can paste a failed deployment log and understand what to do next within 30 seconds.
