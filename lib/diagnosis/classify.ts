import type { DiagnosisCategory, EvidenceLine } from "./schema";
import { firstSanitizedLines, toSanitizedEvidenceLines } from "./redact";

export type ClassificationResult = {
  category: DiagnosisCategory;
  confidence: number;
  evidenceLines: EvidenceLine[];
};

type Rule = {
  category: DiagnosisCategory;
  confidence: number;
  pattern: RegExp;
};

const rules: Rule[] = [
  {
    category: "node_version_error",
    confidence: 0.89,
    pattern:
      /(unsupported engine|engine "node"|requires node|node\.js version|node version|error found incompatible module)/i
  },
  {
    category: "missing_env_var",
    confidence: 0.88,
    pattern:
      /(missing.*env|environment variable .* is not set|process\.env\.[A-Z0-9_]+|env var|invalid environment variables|without `?[A-Z0-9_]+`?)/i
  },
  {
    category: "module_not_found",
    confidence: 0.9,
    pattern:
      /(module not found|can't resolve|cannot find module|failed to resolve import|package path .* is not exported)/i
  },
  {
    category: "typescript_error",
    confidence: 0.86,
    pattern:
      /(typescript|type error|ts\d{4}|type '.*' is not assignable|property '.*' does not exist|next\.js build worker exited with code.*typescript)/i
  },
  {
    category: "lint_error",
    confidence: 0.82,
    pattern:
      /(eslint|lint failed|react-hooks\/|no-unused-vars|no-explicit-any|failed to compile.*lint)/i
  },
  {
    category: "dependency_install_error",
    confidence: 0.84,
    pattern:
      /(npm err!|pnpm err!|yarn error|failed to install|dependency conflict|eresolve|enoent.*package\.json|lockfile|peer dependency)/i
  },
  {
    category: "build_command_error",
    confidence: 0.75,
    pattern:
      /(command "(?:npm|pnpm|yarn|next).*" exited|command failed|build command failed|error command failed|exited with \d+|script "?build"? failed)/i
  }
];

export function classifyDeploymentLog(rawLog: string): ClassificationResult {
  for (const rule of rules) {
    if (rule.pattern.test(rawLog)) {
      const evidenceLines = toSanitizedEvidenceLines(rawLog, (line) => rule.pattern.test(line));

      return {
        category: rule.category,
        confidence: rule.confidence,
        evidenceLines:
          evidenceLines.length > 0 ? evidenceLines : firstSanitizedLines(rawLog)
      };
    }
  }

  return {
    category: "unknown",
    confidence: 0.35,
    evidenceLines: firstSanitizedLines(rawLog)
  };
}
