import { describe, expect, it } from "vitest";
import { classifyDeploymentLog } from "@/lib/diagnosis/classify";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";

describe("classifyDeploymentLog", () => {
  it.each([
    ["module_not_found", "Module not found: Can't resolve '@/components/Nav'"],
    ["typescript_error", "Type error: Type 'number' is not assignable to type 'string'. TS2322"],
    ["lint_error", "ESLint: React Hook useEffect has a missing dependency"],
    ["missing_env_var", "Error: Missing required environment variable STRIPE_SECRET_KEY"],
    ["dependency_install_error", "npm ERR! ERESOLVE unable to resolve dependency tree"],
    ["build_command_error", "Error: Command \"pnpm build\" exited with 1"],
    ["node_version_error", "Unsupported engine: wanted: {\"node\":\">=20\"}"]
  ] as const)("classifies %s", (category, log) => {
    expect(classifyDeploymentLog(log).category).toBe(category);
  });

  it("returns unknown for unrecognized logs", () => {
    const result = classifyDeploymentLog("Deployment stopped after an unexpected platform message.");

    expect(result.category).toBe("unknown");
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("redacts evidence lines in generated diagnoses", () => {
    const result = generateMockDiagnosis(`Running "pnpm build"
DATABASE_URL=postgres://user:supersecret@example.com/db
Error: Missing required environment variable STRIPE_SECRET_KEY
Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456`);

    expect(result.category).toBe("missing_env_var");
    expect(result.evidenceLines.map((line) => line.text).join("\n")).not.toContain(
      "supersecret"
    );
    expect(result.evidenceLines.map((line) => line.text).join("\n")).not.toContain(
      "abcdefghijklmnopqrstuvwxyz123456"
    );
  });
});
