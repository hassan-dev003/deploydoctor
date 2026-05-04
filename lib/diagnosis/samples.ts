export type SampleLog = {
  label: string;
  description: string;
  log: string;
};

export const sampleLogs: SampleLog[] = [
  {
    label: "Module missing",
    description: "Import path or package cannot be resolved.",
    log: `Running "pnpm build"
./app/page.tsx
Module not found: Can't resolve '@/components/MissingWidget'
https://nextjs.org/docs/messages/module-not-found
Error: Command "pnpm build" exited with 1`
  },
  {
    label: "Missing env",
    description: "Required deployment variable is absent.",
    log: `Running "pnpm build"
DATABASE_URL=postgres://user:supersecret@example.com/db
Error: Missing required environment variable STRIPE_SECRET_KEY
Build failed because process.env.STRIPE_SECRET_KEY is not set
Error: Command "pnpm build" exited with 1`
  },
  {
    label: "TypeScript",
    description: "Type checking fails in production build.",
    log: `Failed to compile.
./components/CheckoutButton.tsx:42:7
Type error: Type 'string | undefined' is not assignable to type 'string'.
Next.js build worker exited with code: 1 and signal: null`
  },
  {
    label: "Node version",
    description: "Dependency requires a newer Node runtime.",
    log: `pnpm install
 WARN  Unsupported engine: wanted: {"node":">=20"} (current: {"node":"18.19.0"})
Error: Found incompatible module during dependency installation`
  }
];
