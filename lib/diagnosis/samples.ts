export type SampleLog = {
  label: string;
  description: string;
  log: string;
};

export const sampleLogs: SampleLog[] = [
  {
    label: "Module missing",
    description: "Clean checkout cannot resolve an imported component.",
    log: `Vercel CLI 51.6.1
Installing dependencies...
Detected Next.js version: 15.5.15
Running "pnpm build"

> deploydoctor-demo@0.1.0 build /vercel/path0
> next build

Failed to compile.

./app/dashboard/page.tsx
Module not found: Can't resolve '@/components/charts/UsageSparkline'

https://nextjs.org/docs/messages/module-not-found
Error: Command "pnpm build" exited with 1`
  },
  {
    label: "Missing env",
    description: "Production validation expects an unset variable.",
    log: `Vercel CLI 51.6.1
Running "pnpm build"

> shop-demo@0.1.0 build /vercel/path0
> next build

Loaded env from .env.production
Error: Missing required environment variable STRIPE_SECRET_KEY
Build failed because process.env.STRIPE_SECRET_KEY is not set
Tip: add this value in Vercel Project Settings for Production.
Error: Command "pnpm build" exited with 1`
  },
  {
    label: "TypeScript",
    description: "Production typecheck catches an unsafe prop value.",
    log: `Running "pnpm build"
Creating an optimized production build...
Compiled successfully
Linting and checking validity of types...

Failed to compile.

./components/CheckoutButton.tsx:42:7
Type error: Type 'string | undefined' is not assignable to type 'string'.

  40 |   return (
  41 |     <form action={checkoutAction}>
> 42 |       <input name="priceId" value={selectedPriceId} />
     |       ^
  43 |     </form>

Next.js build worker exited with code: 1 and signal: null`
  },
  {
    label: "Node version",
    description: "Dependency requires a newer Node runtime.",
    log: `Vercel CLI 51.6.1
Installing dependencies...
pnpm install --frozen-lockfile

WARN Unsupported engine: wanted: {"node":">=20"} (current: {"node":"18.19.0"})
error next-auth@5.0.0-beta.25: The engine "node" is incompatible with this module. Expected version ">=20".
Error: Found incompatible module during dependency installation`
  },
  {
    label: "Lint rule",
    description: "ESLint blocks the deployment before build output is created.",
    log: `Running "pnpm build"

> marketing-site@0.1.0 build /vercel/path0
> next build

Failed to compile.

./app/pricing/page.tsx
12:9  Error: 'plans' is assigned a value but never used.  @typescript-eslint/no-unused-vars
18:6  Warning: React Hook useEffect has a missing dependency: 'trackView'.  react-hooks/exhaustive-deps

info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint
Error: Command "pnpm build" exited with 1`
  },
  {
    label: "Install fail",
    description: "Lockfile or dependency conflict prevents install.",
    log: `Installing dependencies...
pnpm install --frozen-lockfile

ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json

Failure reason:
specifier in the lockfile (zod@^3.23.8) does not match package.json (zod@^3.24.1)

Error: Command "pnpm install --frozen-lockfile" exited with 1`
  }
];
