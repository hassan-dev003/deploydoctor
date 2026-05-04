import { describe, expect, it, vi } from "vitest";
import { POST as diagnosesPost } from "@/app/api/diagnoses/route";
import { POST as incidentsPost } from "@/app/api/incidents/route";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { DiagnosisResultSchema } from "@/lib/diagnosis/schema";
import { IncidentReportSchema } from "@/lib/incidents/schema";

describe("POST /api/incidents", () => {
  it("rejects invalid JSON", async () => {
    const response = await incidentsPost(
      new Request("http://localhost/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{"
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Send a JSON body with a log field." });
  });

  it("rejects empty logs", async () => {
    const response = await incidentsPost(jsonRequest("/api/incidents", { log: "   " }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Paste deployment logs before running an incident analysis.");
  });

  it("rejects oversized logs", async () => {
    const response = await incidentsPost(
      jsonRequest("/api/incidents", { log: "x".repeat(MAX_LOG_CHARS + 1) })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(oversizedLogMessage);
  });

  it("returns an incident report without raw secrets", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "");

    const response = await incidentsPost(
      jsonRequest("/api/incidents", {
        log: "Error: Missing env OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz"
      })
    );
    const body = await response.json();
    const incident = IncidentReportSchema.parse(body);
    const serialized = JSON.stringify(incident);

    expect(response.status).toBe(200);
    expect(incident.diagnosis.generatedBy).toBe("mock");
    expect(serialized).toContain("[REDACTED_SECRET]");
    expect(serialized).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
    expect(serialized).not.toContain("rawLog");
    expect(serialized).not.toContain("pastedText");

    vi.unstubAllEnvs();
  });

  it("accepts sample log source type", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "");

    const response = await incidentsPost(
      jsonRequest("/api/incidents", {
        log: "Type error: TS2322",
        sourceType: "sample_log"
      })
    );
    const incident = IncidentReportSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(incident.sourceType).toBe("sample_log");

    vi.unstubAllEnvs();
  });

  it("rejects unsupported source type", async () => {
    const response = await incidentsPost(
      jsonRequest("/api/incidents", {
        log: "Type error: TS2322",
        sourceType: "deployment_url"
      })
    );

    expect(response.status).toBe(400);
  });

  it("keeps legacy diagnosis API working", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "");

    const response = await diagnosesPost(
      jsonRequest("/api/diagnoses", { log: "Type error: TS2322" })
    );
    const diagnosis = DiagnosisResultSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(diagnosis.category).toBe("typescript_error");
    expect(diagnosis.generatedBy).toBe("mock");

    vi.unstubAllEnvs();
  });
});

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
