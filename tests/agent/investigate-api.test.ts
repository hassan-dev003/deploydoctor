import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent/runInvestigation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent/runInvestigation")>(
    "@/lib/agent/runInvestigation"
  );

  return {
    ...actual,
    runInvestigation: vi.fn()
  };
});

import { runInvestigation } from "@/lib/agent/runInvestigation";
import { POST } from "@/app/api/agent/investigate/route";

const mockedRun = vi.mocked(runInvestigation);

function post(body: unknown): Request {
  return new Request("http://localhost/api/agent/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const diagnosis = {
  category: "missing_env_var" as const,
  confidence: 0.9,
  title: "Missing environment variable",
  summary: "STRIPE_SECRET_KEY is missing in Production.",
  rootCause: "The variable exists in Preview but not Production.",
  reasoning: "Verified against the project's environment variable keys.",
  evidenceLines: [
    { lineNumber: 1, text: "Missing required environment variable STRIPE_SECRET_KEY" }
  ],
  fixSteps: ["Add STRIPE_SECRET_KEY to the Production environment."],
  commands: ["vercel env ls production"],
  filesToCheck: ["Vercel Project Settings"],
  nextDiagnosticCommand: "vercel env ls production",
  generatedBy: "mock" as const,
  analyzedAt: "2026-07-16T00:00:00.000Z"
};

describe("POST /api/agent/investigate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without an access token", async () => {
    const response = await POST(post({}));

    expect(response.status).toBe(400);
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it("returns an incident report built from the agent trace", async () => {
    mockedRun.mockResolvedValueOnce({
      diagnosis,
      trace: [
        { tool: "get_deployment_events", status: "completed", summary: "Read the build log." },
        { tool: "list_project_env_keys", status: "completed", summary: "Checked env keys." }
      ]
    });

    const response = await POST(post({ accessToken: "tkn" }));
    const incident = await response.json();

    expect(response.status).toBe(200);
    expect(incident.sourceType).toBe("vercel_api");
    expect(incident.investigationSteps).toHaveLength(2);
    expect(
      incident.investigationSteps.some(
        (step: { title: string }) => step.title === "Verified environment variables"
      )
    ).toBe(true);
  });

  it("returns 502 when the agent cannot complete", async () => {
    mockedRun.mockRejectedValueOnce(new Error("model unavailable"));

    const response = await POST(post({ accessToken: "tkn" }));

    expect(response.status).toBe(502);
  });
});
