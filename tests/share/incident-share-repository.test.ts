import { describe, expect, it, vi } from "vitest";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import {
  getIncidentShare,
  prepareIncidentShareRecord,
  sanitizeIncidentForShare,
  saveIncidentShare
} from "@/lib/incidents/shareRepository";
import type { SqlExecutor } from "@/lib/share/shareRepository";

describe("incident share repository helpers", () => {
  it("recursively redacts incident strings before saving", () => {
    const incident = generateIncidentReport(
      {
        ...generateMockDiagnosis("Error: Missing required environment variable STRIPE_SECRET_KEY"),
        summary: "OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz"
      },
      "inc_0123456789abcdef"
    );

    const sanitized = sanitizeIncidentForShare(incident);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).toContain("[REDACTED]");
    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
  });

  it("prepares a DB record without raw log fields", () => {
    const incident = generateIncidentReport(
      generateMockDiagnosis("Module not found: Can't resolve './x'"),
      "inc_0123456789abcdef"
    );
    const record = prepareIncidentShareRecord(
      incident,
      "0123456789abcdef0123456789abcdef"
    );

    expect(record.shareId).toBe("0123456789abcdef0123456789abcdef");
    expect(record).not.toHaveProperty("rawLog");
    expect(record).not.toHaveProperty("log");
    expect(record).not.toHaveProperty("input");
    expect(record).not.toHaveProperty("prompt");
    expect(record).not.toHaveProperty("pastedText");
  });
});

describe("incident share repository DB calls", () => {
  it("inserts sanitized incident JSON without raw log fields", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://example");

    const incident = generateIncidentReport(
      {
        ...generateMockDiagnosis("Error: Missing required environment variable STRIPE_SECRET_KEY"),
        summary: "DATABASE_URL=postgres://user:supersecret@example.com/db"
      },
      "inc_0123456789abcdef"
    );
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor: SqlExecutor = vi.fn(async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });

      if (strings.join("").includes("insert into incident_shares")) {
        const incidentJson = JSON.parse(String(values[4]));

        return {
          rows: [
            {
              share_id: values[0],
              created_at: new Date("2026-05-04T00:00:00.000Z"),
              status: values[1],
              title: values[2],
              summary: values[3],
              incident_json: incidentJson
            }
          ]
        };
      }

      return { rows: [] };
    });

    const saved = await saveIncidentShare(incident, executor);
    const insertCall = calls.find((call) => call.sql.includes("insert into incident_shares"));

    expect(saved.shareId).toMatch(/^[a-f0-9]{32}$/);
    expect(insertCall).toBeDefined();
    expect(JSON.stringify(insertCall?.values)).not.toContain("supersecret");
    expect(JSON.stringify(insertCall?.values)).not.toContain("rawLog");
    expect(JSON.stringify(insertCall?.values)).not.toContain("pastedText");

    vi.unstubAllEnvs();
  });

  it("validates incident_json on read", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://example");

    const executor: SqlExecutor = vi.fn(async (strings) => {
      if (strings.join("").includes("select")) {
        return {
          rows: [
            {
              share_id: "0123456789abcdef0123456789abcdef",
              created_at: "2026-05-04T00:00:00.000Z",
              status: "needs_action",
              title: "Invalid",
              summary: "Invalid",
              incident_json: { title: "missing required fields" }
            }
          ]
        };
      }

      return { rows: [] };
    });

    await expect(
      getIncidentShare("0123456789abcdef0123456789abcdef", executor)
    ).rejects.toThrow();

    vi.unstubAllEnvs();
  });
});
