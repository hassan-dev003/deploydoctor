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
    summary: "The deployment could not resolve a module that the build expected to import.",
    rootCause:
      "A dependency, local file path, or path alias referenced by the app is missing or named differently in the deployed environment.",
    reasoning:
      "DeployDoctor found resolver language such as module-not-found or cannot-resolve in the build output. Vercel builds from a clean checkout, so undeclared packages and case-sensitive path mismatches surface here.",
    fixSteps: [
      "Confirm the imported file exists with the exact same casing as the import statement.",
      "If it is an npm package, add it to dependencies rather than devDependencies when used at build/runtime.",
      "Check path aliases in tsconfig.json and make sure they match the folder structure."
    ],
    filesToCheck: ["package.json", "tsconfig.json", "the file named in the failing import"],
    commands: ["pnpm install", "pnpm build", "pnpm why <package-name>"],
    nextDiagnosticCommand: "pnpm build"
  },
  typescript_error: {
    title: "TypeScript blocked the production build",
    summary: "The app compiled far enough to run type checks, then failed on a TypeScript error.",
    rootCause:
      "A value, prop, return type, or imported type does not match what the compiler expects.",
    reasoning:
      "DeployDoctor found TypeScript compiler markers such as TS error codes, assignability failures, or missing properties. Next.js treats these as build-blocking by default.",
    fixSteps: [
      "Open the file and line referenced by the compiler output.",
      "Fix the type mismatch rather than suppressing it unless the demo timeline requires a temporary unblock.",
      "Run the local typecheck command before redeploying."
    ],
    filesToCheck: ["the TypeScript file in the error", "tsconfig.json", "component prop types"],
    commands: ["pnpm typecheck", "pnpm build"],
    nextDiagnosticCommand: "pnpm typecheck"
  },
  lint_error: {
    title: "Linting failed during the build",
    summary: "The deployment stopped because lint rules reported build-blocking issues.",
    rootCause:
      "The project has an ESLint violation that Next.js or the configured build script treats as fatal.",
    reasoning:
      "DeployDoctor found ESLint rule names or lint-failed language in the log. These often pass unnoticed until CI or Vercel runs the production checks.",
    fixSteps: [
      "Run lint locally and inspect the first reported file.",
      "Fix the rule violation directly when possible.",
      "Only relax a lint rule if the rule is not useful for this project."
    ],
    filesToCheck: ["the linted file in the error", ".eslintrc.json or eslint.config.*", "next.config.*"],
    commands: ["pnpm lint", "pnpm build"],
    nextDiagnosticCommand: "pnpm lint"
  },
  missing_env_var: {
    title: "Required environment variable is missing",
    summary: "The build or runtime validation expected an environment variable that Vercel did not provide.",
    rootCause:
      "A required secret or config value exists locally but has not been added to the Vercel project environment.",
    reasoning:
      "DeployDoctor found environment-variable language in the failure. Local .env files are not automatically available in Vercel deployments.",
    fixSteps: [
      "Identify the exact variable name from the error or validation schema.",
      "Add the variable in Vercel Project Settings for the correct environment.",
      "Redeploy after confirming preview and production values are set as needed."
    ],
    filesToCheck: [".env.example", "environment validation file", "Vercel Project Settings"],
    commands: ["vercel env ls", "pnpm build"],
    nextDiagnosticCommand: "vercel env ls"
  },
  dependency_install_error: {
    title: "Dependency installation failed",
    summary: "The deployment failed before or during dependency installation.",
    rootCause:
      "The lockfile, package manager, package versions, or peer dependencies are inconsistent with the deploy environment.",
    reasoning:
      "DeployDoctor found package-manager errors such as ERESOLVE, lockfile failures, or peer dependency conflicts. Vercel must reproduce installs from the committed manifest and lockfile.",
    fixSteps: [
      "Run a clean local install with the same package manager used by the repo.",
      "Commit the updated lockfile if dependency versions changed.",
      "Resolve peer dependency conflicts instead of relying on an uncommitted local node_modules folder."
    ],
    filesToCheck: ["package.json", "pnpm-lock.yaml or package-lock.json", ".npmrc"],
    commands: ["pnpm install", "pnpm install --frozen-lockfile", "pnpm build"],
    nextDiagnosticCommand: "pnpm install --frozen-lockfile"
  },
  build_command_error: {
    title: "Build command exited unsuccessfully",
    summary: "The configured build command returned a non-zero exit code.",
    rootCause:
      "The build script failed, but the underlying cause is likely a more specific error slightly earlier in the log.",
    reasoning:
      "DeployDoctor found command-failed or exited-with-code language. This line is usually the wrapper failure, so inspect the lines above it for the first actionable error.",
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
    summary: "The deployment is using a Node.js version that does not satisfy the project or a dependency.",
    rootCause:
      "The project engines field, Vercel Node setting, or dependency requirement conflicts with the deploy runtime.",
    reasoning:
      "DeployDoctor found unsupported-engine or Node-version language. Package managers enforce these constraints more strictly in clean deploys.",
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
    summary: "DeployDoctor could not confidently match the log to a known failure pattern yet.",
    rootCause:
      "The pasted log does not include enough recognizable error context, or the first actionable error is outside the pasted excerpt.",
    reasoning:
      "DeployDoctor did not find strong markers for module resolution, TypeScript, linting, env vars, dependency install, build command, or Node version failures.",
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
