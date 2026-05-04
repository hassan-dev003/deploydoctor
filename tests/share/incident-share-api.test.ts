import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/incidents/share/route";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import { saveIncidentShare } from "@/lib/incidents/shareRepository";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";

vi.mock("@/lib/incidents/shareRepository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/incidents/shareRepository")>(
    "@/lib/incidents/shareRepository"
  );

  return {
    ...actual,
    saveIncidentShare: vi.fn()
  };
});

const mockedSaveIncidentShare = vi.mocked(saveIncidentShare);

describe("POST /api/incidents/share", () => {
  it("rejects missing incident", async () => {
    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Share requests may only include a valid incident."
    });
  });

  it.each(["rawLog", "log", "input", "prompt", "pastedText"])(
    "rejects top-level raw-log-like field %s",
    async (field) => {
      const incident = generateIncidentReport(
        generateMockDiagnosis("Module not found: Can't resolve './x'"),
        "inc_0123456789abcdef"
      );
      const response = await POST(
        jsonRequest({
          incident,
          [field]: "SECRET_TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz"
        })
      );

      expect(response.status).toBe(400);
      expect(mockedSaveIncidentShare).not.toHaveBeenCalled();
    }
  );

  it("returns shareId and url for a valid incident", async () => {
    const incident = generateIncidentReport(
      generateMockDiagnosis("Type error: TS2322"),
      "inc_0123456789abcdef"
    );

    mockedSaveIncidentShare.mockResolvedValueOnce({
      shareId: "0123456789abcdef0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      status: incident.status,
      title: incident.diagnosis.title,
      summary: incident.diagnosis.summary,
      incident
    });

    const response = await POST(jsonRequest({ incident }));
    const body = (await response.json()) as { shareId: string; url: string };

    expect(response.status).toBe(200);
    expect(body.shareId).toBe("0123456789abcdef0123456789abcdef");
    expect(body.url).toBe("http://localhost/i/0123456789abcdef0123456789abcdef");
    expect(mockedSaveIncidentShare).toHaveBeenCalledWith(incident);
  });

  it("returns 503 when sharing database is not configured", async () => {
    const incident = generateIncidentReport(
      generateMockDiagnosis("Type error: TS2322"),
      "inc_0123456789abcdef"
    );

    mockedSaveIncidentShare.mockRejectedValueOnce(new ShareDatabaseUnavailableError());

    const response = await POST(jsonRequest({ incident }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("POSTGRES_URL");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/incidents/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
