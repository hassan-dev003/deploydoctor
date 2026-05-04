import { describe, expect, it, vi } from "vitest";
import {
  listStoredIncidents,
  sanitizeWebhookPayload,
  saveStoredIncident
} from "@/lib/incidents/storageRepository";
import type { SqlExecutor } from "@/lib/share/shareRepository";

describe("incident storage repository", () => {
  it("sanitizes webhook payloads and omits raw log-like fields", () => {
    const sanitized = sanitizeWebhookPayload({
      deployment: {
        id: "dpl_123",
        log: "OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz",
        stderr: "private build output",
        url: "deploydoctor-preview.vercel.app"
      }
    });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).toContain("[OMITTED_RAW_LOG_FIELD]");
    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
    expect(serialized).not.toContain("private build output");
  });

  it("inserts sanitized webhook metadata without raw logs", async () => {
    vi.stubEnv("POSTGRES_URL", "postgres://example");

    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const executor: SqlExecutor = vi.fn(async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });

      if (strings.join("").includes("insert into incidents")) {
        const rawPayloadJson = JSON.parse(String(values[9]));

        return {
          rows: [
            {
              incident_id: values[0],
              created_at: new Date("2026-05-04T00:00:00.000Z"),
              source_type: values[1],
              status: values[2],
              project_id: values[3],
              deployment_id: values[4],
              deployment_url: values[5],
              title: values[6],
              summary: values[7],
              incident_json: null,
              raw_payload_json: rawPayloadJson
            }
          ]
        };
      }

      return { rows: [] };
    });

    const saved = await saveStoredIncident(
      {
        incidentId: "inc_0123456789abcdef",
        sourceType: "vercel_webhook",
        status: "needs_more_evidence",
        projectId: "prj_123",
        deploymentId: "dpl_123",
        deploymentUrl: "deploydoctor-preview.vercel.app",
        title: "Vercel deployment failed",
        summary: "Stored metadata only.",
        rawPayloadJson: {
          deployment: {
            id: "dpl_123",
            log: "OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz"
          }
        }
      },
      executor
    );
    const insertCall = calls.find((call) => call.sql.includes("insert into incidents"));

    expect(saved.incidentId).toBe("inc_0123456789abcdef");
    expect(insertCall).toBeDefined();
    expect(JSON.stringify(insertCall?.values)).toContain("[OMITTED_RAW_LOG_FIELD]");
    expect(JSON.stringify(insertCall?.values)).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");

    vi.unstubAllEnvs();
  });

  it("validates rows when listing incidents", async () => {
    const executor: SqlExecutor = vi.fn(async (strings) => {
      if (strings.join("").includes("select")) {
        return {
          rows: [
            {
              incident_id: "inc_0123456789abcdef",
              created_at: "2026-05-04T00:00:00.000Z",
              source_type: "vercel_webhook",
              status: "needs_more_evidence",
              project_id: "prj_123",
              deployment_id: "dpl_123",
              deployment_url: "deploydoctor-preview.vercel.app",
              title: "Vercel deployment failed",
              summary: "Stored metadata only.",
              incident_json: null,
              raw_payload_json: { deployment: { id: "dpl_123" } }
            }
          ]
        };
      }

      return { rows: [] };
    });

    const incidents = await listStoredIncidents(executor);

    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.sourceType).toBe("vercel_webhook");
  });
});
