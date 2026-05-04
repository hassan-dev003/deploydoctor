import { classifyDeploymentLog } from "./classify";
import { DiagnosisResultSchema, type DiagnosisCategory, type DiagnosisResult } from "./schema";

type DiagnosisTemplate = {
  title: string;
  summary: string;
  rootCause: string;
  reasoning: string;
  fixSteps: string[];
  filesToCheck: string[];
  commands: string[];
  nextDiagnosticCommand: string;
};

const templates: Record<DiagnosisCategory, DiagnosisTemplate> = {
  module_not_found: {
    title: "Import or package resolution failed",
    summary: "Vercel built from a clean checkout and could not find one of the imported modules.",
    rootCause:
      "An import points to a file, package, or path alias that is missing, uncommitted, or named with different casing than the deployed filesystem expects.",
    reasoning:
      "The log contains module resolution language such as module-not-found or cannot-resolve. These failures often appear only in deployment because Vercel does not reuse local files outside the committed repo.",
    fixSteps: [
      "Open the file named in the error and copy the exact import path.",
      "Confirm the target file or package exists with identical casing in the committed repo.",
      "If it is a package, install it and commit the updated manifest and lockfile."
    ],
    filesToCheck: ["package.json", "tsconfig.json", "the file named in the failing import"],
    commands: ["pnpm install", "pnpm build", "pnpm why <package-name>"],
    nextDiagnosticCommand: "pnpm build"
  },
  typescript_error: {
    title: "TypeScript blocked the production build",
    summary: "The app compiled, then the production typecheck stopped on a type mismatch.",
    rootCause:
      "A value, prop, return type, or imported type does not satisfy the TypeScript contract used during the build.",
    reasoning:
      "The log includes TypeScript markers such as Type error, TS error codes, assignability failures, or missing properties. Next.js treats these as deployment-blocking by default.",
    fixSteps: [
      "Open the file and line referenced by the compiler output.",
      "Fix the type mismatch at the source instead of hiding it with a broad cast.",
      "Run the local typecheck command before redeploying."
    ],
    filesToCheck: ["the TypeScript file in the error", "tsconfig.json", "component prop types"],
    commands: ["pnpm typecheck", "pnpm build"],
    nextDiagnosticCommand: "pnpm typecheck"
  },
  lint_error: {
    title: "Linting failed during the build",
    summary: "The deployment stopped because ESLint reported build-blocking issues.",
    rootCause:
      "A lint rule failed in a file that is part of the deployed app, and the configured build treats lint errors as fatal.",
    reasoning:
      "The log includes ESLint rule names or lint-failed language. These often surface in Vercel when the production command runs stricter checks than a local dev server.",
    fixSteps: [
      "Run lint locally and inspect the first reported file.",
      "Fix the rule violation directly when possible.",
      "Only relax a lint rule if the rule is intentionally not useful for this project."
    ],
    filesToCheck: ["the linted file in the error", ".eslintrc.json or eslint.config.*", "next.config.*"],
    commands: ["pnpm lint", "pnpm build"],
    nextDiagnosticCommand: "pnpm lint"
  },
  missing_env_var: {
    title: "Required environment variable is missing",
    summary: "The app expected a required environment variable that was not available in the Vercel environment.",
    rootCause:
      "A required secret or config value likely exists locally but has not been added to the matching Vercel environment.",
    reasoning:
      "The log contains missing-env or process.env language. Local .env files are not automatically available to Vercel preview or production deployments.",
    fixSteps: [
      "Identify the exact variable name from the error or validation schema.",
      "Add the variable in Vercel Project Settings for the exact environment that failed.",
      "Redeploy after confirming preview and production values are set as needed."
    ],
    filesToCheck: [".env.example", "environment validation file", "Vercel Project Settings"],
    commands: ["vercel env ls", "pnpm build"],
    nextDiagnosticCommand: "vercel env ls"
  },
  dependency_install_error: {
    title: "Dependency installation failed",
    summary: "The deployment failed while Vercel was installing packages from the committed manifests.",
    rootCause:
      "The lockfile, package manager, package versions, or peer dependencies are inconsistent with the clean deploy environment.",
    reasoning:
      "The log contains package-manager errors such as frozen-lockfile failures, ERESOLVE, or peer dependency conflicts. Vercel must reproduce installs from committed files only.",
    fixSteps: [
      "Run a clean local install with the same package manager used by the repo.",
      "Commit the updated lockfile if dependency versions changed.",
      "Resolve dependency conflicts instead of relying on an uncommitted local node_modules folder."
    ],
    filesToCheck: ["package.json", "pnpm-lock.yaml or package-lock.json", ".npmrc"],
    commands: ["pnpm install", "pnpm install --frozen-lockfile", "pnpm build"],
    nextDiagnosticCommand: "pnpm install --frozen-lockfile"
  },
  build_command_error: {
    title: "Build command exited unsuccessfully",
    summary: "The configured build command returned a non-zero exit code.",
    rootCause:
      "The build script failed, but the actionable cause is likely a more specific error slightly earlier in the log.",
    reasoning:
      "The log includes command-failed or exited-with-code language. This line is usually the wrapper failure, so the most useful clue is often a few lines above it.",
    fixSteps: [
      "Scroll earlier in the log and locate the first error before the command exit line.",
      "Run the same build command locally from a clean checkout.",
      "Confirm package scripts match the framework and package manager used by the project."
    ],
    filesToCheck: ["package.json scripts", "vercel.json", "framework build configuration"],
    commands: ["pnpm build", "vercel build"],
    nextDiagnosticCommand: "pnpm build"
  },
  node_version_error: {
    title: "Node.js version mismatch",
    summary: "The deployment is using a Node.js version that does not satisfy the app or one of its dependencies.",
    rootCause:
      "The project engines field, Vercel Node setting, or dependency requirement conflicts with the runtime used during install or build.",
    reasoning:
      "The log contains unsupported-engine or Node-version language. Package managers enforce these constraints during Vercel's clean install step.",
    fixSteps: [
      "Check the required Node version in the error and align local and Vercel settings.",
      "Set the engines.node field when the app requires a specific version.",
      "Update dependencies if they no longer support the runtime configured on Vercel."
    ],
    filesToCheck: ["package.json engines", ".nvmrc", "Vercel Project Settings"],
    commands: ["node --version", "pnpm install", "pnpm build"],
    nextDiagnosticCommand: "node --version"
  },
  unknown: {
    title: "Deployment failure needs closer inspection",
    summary: "DeployDoctor could not confidently match the pasted excerpt to a known failure pattern yet.",
    rootCause:
      "The pasted log may not include enough context, or the first actionable error may be above or below the excerpt.",
    reasoning:
      "The excerpt does not include strong markers for module resolution, TypeScript, linting, env vars, dependency install, build command, or Node version failures.",
    fixSteps: [
      "Paste more lines from immediately before the final failure message.",
      "Look for the first line that contains Error, Failed, Cannot, or Exit code.",
      "Run the deployment build command locally and compare the first failing line."
    ],
    filesToCheck: ["package.json", "vercel.json", "the first file mentioned in the log"],
    commands: ["pnpm build", "pnpm lint", "pnpm typecheck"],
    nextDiagnosticCommand: "pnpm build"
  }
};

export function generateMockDiagnosis(rawLog: string): DiagnosisResult {
  const classification = classifyDeploymentLog(rawLog);
  const template = templates[classification.category];

  return DiagnosisResultSchema.parse({
    ...template,
    category: classification.category,
    confidence: classification.confidence,
    evidenceLines: classification.evidenceLines,
    generatedBy: "mock",
    analyzedAt: new Date().toISOString()
  });
}
