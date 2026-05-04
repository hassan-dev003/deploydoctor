import { describe, expect, it, vi } from "vitest";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import { ShareDatabaseUnavailableError, saveDiagnosisShare } from "@/lib/share/shareRepository";
import { POST } from "@/app/api/diagnoses/share/route";

vi.mock("@/lib/share/shareRepository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/share/shareRepository")>(
    "@/lib/share/shareRepository"
  );

  return {
    ...actual,
    saveDiagnosisShare: vi.fn()
  };
});

const mockedSaveDiagnosisShare = vi.mocked(saveDiagnosisShare);

describe("POST /api/diagnoses/share", () => {
  it("rejects missing diagnosis", async () => {
    const response = await POST(jsonRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Share requests may only include a valid diagnosis."
    });
  });

  it.each(["rawLog", "log", "input", "prompt", "pastedText"])(
    "rejects top-level raw-log-like field %s",
    async (field) => {
      const diagnosis = generateMockDiagnosis("Module not found: Can't resolve './x'");
      const response = await POST(
        jsonRequest({
          diagnosis,
          [field]: "SECRET_TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz"
        })
      );

      expect(response.status).toBe(400);
      expect(mockedSaveDiagnosisShare).not.toHaveBeenCalled();
    }
  );

  it("returns shareId and url for a valid diagnosis", async () => {
    const diagnosis = generateMockDiagnosis("Type error: TS2322");

    mockedSaveDiagnosisShare.mockResolvedValueOnce({
      shareId: "0123456789abcdef0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      category: diagnosis.category,
      generatedBy: diagnosis.generatedBy,
      title: diagnosis.title,
      summary: diagnosis.summary,
      diagnosis
    });

    const response = await POST(jsonRequest({ diagnosis }));
    const body = (await response.json()) as { shareId: string; url: string };

    expect(response.status).toBe(200);
    expect(body.shareId).toBe("0123456789abcdef0123456789abcdef");
    expect(body.url).toBe("http://localhost/d/0123456789abcdef0123456789abcdef");
    expect(mockedSaveDiagnosisShare).toHaveBeenCalledWith(diagnosis);
  });

  it("returns 503 when sharing database is not configured", async () => {
    const diagnosis = generateMockDiagnosis("Type error: TS2322");

    mockedSaveDiagnosisShare.mockRejectedValueOnce(new ShareDatabaseUnavailableError());

    const response = await POST(jsonRequest({ diagnosis }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("saved report links");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/diagnoses/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
