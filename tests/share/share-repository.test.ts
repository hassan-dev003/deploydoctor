import { describe, expect, it, vi } from "vitest";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import {
  createShareId,
  getPostgresUrl,
  getDiagnosisShare,
  prepareDiagnosisShareRecord,
  saveDiagnosisShare,
  sanitizeDiagnosisForShare,
  type SqlExecutor
} from "@/lib/share/shareRepository";

describe("share repository helpers", () => {
  it("generates unguessable hex share IDs", () => {
    expect(createShareId()).toMatch(/^[a-f0-9]{32}$/);
  });

  it("recursively redacts strings before saving", () => {
    const diagnosis = {
      ...generateMockDiagnosis("Error: Missing required environment variable STRIPE_SECRET_KEY"),
      title: "OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz",
      evidenceLines: [
        {
          lineNumber: 1,
          text: "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456"
        }
      ],
      fixSteps: ["Set token=ghp_abcdefghijklmnopqrstuvwxyz1234567890"]
    };

    const sanitized = sanitizeDiagnosisForShare(diagnosis);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
    expect(serialized).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
    expect(serialized).toContain("[REDACTED]");
  });

  it("prepares a DB record without raw log fields", () => {
    const diagnosis = generateMockDiagnosis("Module not found: Can't resolve './x'");
    const record = prepareDiagnosisShareRecord(
      diagnosis,
      "0123456789abcdef0123456789abcdef"
    );

    expect(record.shareId).toBe("0123456789abcdef0123456789abcdef");
    expect(record).not.toHaveProperty("rawLog");
    expect(record).not.toHaveProperty("log");
    expect(record).not.toHaveProperty("input");
    expect(record).not.toHaveProperty("prompt");
    expect(record).not.toHaveProperty("pastedText");
  });

  it("supports prefixed Postgres URL env vars", () => {
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("depdoc_POSTGRES_URL", "postgres://prefixed-example");

    expect(getPostgresUrl()).toBe("postgres://prefixed-example");

    vi.unstubAllEnvs();
  });
});

describe("share repository DB calls", () => {
  it("inserts sanitized metadata and diagnosis JSON without raw log fields", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://example");

    const diagnosis = {
      ...generateMockDiagnosis("Error: Missing required environment variable STRIPE_SECRET_KEY"),
      summary: "DATABASE_URL=postgres://user:supersecret@example.com/db"
    };
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor: SqlExecutor = vi.fn(async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });

      if (strings.join("").includes("insert into diagnosis_shares")) {
        const diagnosisJson = JSON.parse(String(values[5]));

        return {
          rows: [
            {
              share_id: values[0],
              created_at: new Date("2026-05-04T00:00:00.000Z"),
              category: values[1],
              generated_by: values[2],
              title: values[3],
              summary: values[4],
              diagnosis_json: diagnosisJson
            }
          ]
        };
      }

      return { rows: [] };
    });

    const saved = await saveDiagnosisShare(diagnosis, executor);
    const insertCall = calls.find((call) => call.sql.includes("insert into diagnosis_shares"));

    expect(saved.shareId).toMatch(/^[a-f0-9]{32}$/);
    expect(insertCall).toBeDefined();
    expect(JSON.stringify(insertCall?.values)).not.toContain("supersecret");
    expect(JSON.stringify(insertCall?.values)).not.toContain("rawLog");
    expect(JSON.stringify(insertCall?.values)).not.toContain("pastedText");

    vi.unstubAllEnvs();
  });

  it("validates diagnosis_json on read", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://example");

    const executor: SqlExecutor = vi.fn(async (strings) => {
      if (strings.join("").includes("select")) {
        return {
          rows: [
            {
              share_id: "0123456789abcdef0123456789abcdef",
              created_at: "2026-05-04T00:00:00.000Z",
              category: "module_not_found",
              generated_by: "mock",
              title: "Invalid",
              summary: "Invalid",
              diagnosis_json: { title: "missing required fields" }
            }
          ]
        };
      }

      return { rows: [] };
    });

    await expect(
      getDiagnosisShare("0123456789abcdef0123456789abcdef", executor)
    ).rejects.toThrow();

    vi.unstubAllEnvs();
  });
});
