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
import { POST } from "@/app/api/agent/investigate/stream/route";

const mockedRun = vi.mocked(runInvestigation);

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

function post(body: unknown): Request {
  return new Request("http://localhost/api/agent/investigate/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let out = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    out += decoder.decode(value);
  }

  return out;
}

describe("POST /api/agent/investigate/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without an access token", async () => {
    const response = await POST(post({}));

    expect(response.status).toBe(400);
  });

  it("streams step events followed by a report event", async () => {
    mockedRun.mockImplementationOnce(async (input) => {
      input.onStep?.({
        tool: "get_deployment_events",
        status: "completed",
        summary: "Read the build log."
      });
      input.onStep?.({
        tool: "list_project_env_keys",
        status: "completed",
        summary: "Checked env keys."
      });

      return {
        diagnosis,
        trace: [
          { tool: "get_deployment_events", status: "completed", summary: "Read the build log." },
          { tool: "list_project_env_keys", status: "completed", summary: "Checked env keys." }
        ]
      };
    });

    const response = await POST(post({ accessToken: "tkn" }));
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");

    const body = await readStream(response);
    expect(body).toContain("event: step");
    expect(body).toContain("get_deployment_events");
    expect(body).toContain("event: report");
    expect(body).toContain("vercel_api");
  });

  it("emits an error event when the agent throws", async () => {
    mockedRun.mockRejectedValueOnce(new Error("boom"));

    const response = await POST(post({ accessToken: "tkn" }));
    const body = await readStream(response);

    expect(body).toContain("event: error");
  });
});
