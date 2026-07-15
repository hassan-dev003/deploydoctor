import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/vercel/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/vercel/api")>("@/lib/vercel/api");

  return {
    ...actual,
    listDeployments: vi.fn(),
    getDeploymentEvents: vi.fn()
  };
});

vi.mock("@/lib/diagnosis/generateServerDiagnosis", () => ({
  generateServerDiagnosis: vi.fn()
}));

import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { getDeploymentEvents, listDeployments } from "@/lib/vercel/api";
import { POST } from "@/app/api/vercel/deployments/analyze-latest/route";

const mockedList = vi.mocked(listDeployments);
const mockedEvents = vi.mocked(getDeploymentEvents);
const mockedDiagnosis = vi.mocked(generateServerDiagnosis);

function post(body: unknown): Request {
  return new Request("http://localhost/api/vercel/deployments/analyze-latest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/vercel/deployments/analyze-latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without an access token", async () => {
    const response = await POST(post({}));

    expect(response.status).toBe(400);
  });

  it("returns 404 when there is no failed deployment", async () => {
    mockedList.mockResolvedValueOnce([{ uid: "a", state: "READY" }]);

    const response = await POST(post({ accessToken: "tkn" }));

    expect(response.status).toBe(404);
    expect(mockedEvents).not.toHaveBeenCalled();
  });

  it("analyzes the latest failed deployment and returns a vercel_api incident", async () => {
    mockedList.mockResolvedValueOnce([
      { uid: "dpl_ok", state: "READY", createdAt: 5 },
      { uid: "dpl_fail", state: "ERROR", createdAt: 9 }
    ]);
    mockedEvents.mockResolvedValueOnce([
      { type: "stderr", text: "Error: Cannot find module 'left-pad'" }
    ]);
    mockedDiagnosis.mockResolvedValueOnce({
      category: "module_not_found",
      confidence: 0.9,
      title: "Module not found",
      summary: "A dependency could not be resolved.",
      rootCause: "left-pad is not installed.",
      reasoning: "The log reports a missing module.",
      evidenceLines: [{ lineNumber: 1, text: "Error: Cannot find module 'left-pad'" }],
      fixSteps: ["Install left-pad."],
      commands: ["pnpm add left-pad"],
      filesToCheck: ["package.json"],
      nextDiagnosticCommand: "pnpm install",
      generatedBy: "mock",
      analyzedAt: "2026-07-15T00:00:00.000Z"
    });

    const response = await POST(post({ accessToken: "tkn" }));
    const incident = await response.json();

    expect(response.status).toBe(200);
    expect(incident.sourceType).toBe("vercel_api");
    expect(mockedEvents).toHaveBeenCalledWith(
      "dpl_fail",
      expect.objectContaining({ accessToken: "tkn" })
    );
  });
});
