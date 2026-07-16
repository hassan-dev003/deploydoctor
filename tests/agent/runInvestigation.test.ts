import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAgentIncidentReport,
  runInvestigation,
  type AgentLoop
} from "@/lib/agent/runInvestigation";

// Keep this test hermetic: force the mock diagnosis path so nothing calls the real
// Cerebras API, even when CEREBRAS_API_KEY is present in the environment (e.g. on Vercel).
beforeEach(() => {
  vi.stubEnv("CEREBRAS_API_KEY", "");
});

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

function vercelFetcher() {
  return vi.fn(async (input: URL | string) => {
    const url = input.toString();

    if (url.includes("/events")) {
      return jsonResponse([
        {
          type: "stderr",
          text: "Error: Missing required environment variable STRIPE_SECRET_KEY"
        }
      ]);
    }
    if (url.includes("/env")) {
      return jsonResponse({ envs: [{ key: "STRIPE_SECRET_KEY", target: ["preview"] }] });
    }
    if (url.includes("/v6/deployments")) {
      return jsonResponse({ deployments: [{ uid: "dpl_fail", state: "ERROR", createdAt: 9 }] });
    }
    if (url.includes("/v13/deployments/")) {
      return jsonResponse({
        uid: "dpl_fail",
        readyState: "ERROR",
        target: "production",
        projectId: "prj_1",
        meta: { githubCommitRef: "claude/project-review-xse4ng" }
      });
    }
    if (url.includes("/v9/projects/")) {
      return jsonResponse({ framework: "nextjs", nodeVersion: "20.x" });
    }

    return jsonResponse({}, false);
  });
}

// The verification agent only decides whether to check the real project; the essential
// evidence (log + classification) is gathered deterministically before it runs.
const verifyingLoop: AgentLoop = async ({ tools }) => {
  await (tools.list_project_env_keys.execute as (args: unknown) => Promise<unknown>)({
    projectId: "prj_1"
  });

  return { text: "Confirmed: STRIPE_SECRET_KEY exists in Preview but is missing in Production." };
};

describe("runInvestigation", () => {
  it("gathers evidence deterministically and lets the agent verify", async () => {
    const fetcher = vercelFetcher();

    const result = await runInvestigation({
      accessToken: "tkn",
      fetcher: fetcher as unknown as typeof fetch,
      agentLoop: verifyingLoop
    });

    const toolsUsed = result.trace.map((step) => step.tool);
    // Deterministic evidence floor always runs:
    expect(toolsUsed).toContain("get_deployment_events");
    expect(toolsUsed).toContain("classify_log");
    // Agent verification runs on top:
    expect(toolsUsed).toContain("list_project_env_keys");
    expect(result.diagnosis.category).toBe("missing_env_var");

    const report = buildAgentIncidentReport(result);
    expect(report.sourceType).toBe("vercel_api");
    expect(
      report.investigationSteps.some((step) => step.title === "Read the deployment build log")
    ).toBe(true);
    expect(
      report.investigationSteps.some((step) => step.title === "Verified environment variables")
    ).toBe(true);
  });

  it("does not emit redaction placeholders in the trace step summaries", async () => {
    const fetcher = vercelFetcher();

    const result = await runInvestigation({
      accessToken: "tkn",
      fetcher: fetcher as unknown as typeof fetch,
      agentLoop: async () => ({ text: "" })
    });

    const trace = JSON.stringify(result.trace);
    expect(trace).not.toContain("[REDACTED_SECRET]");
  });

  it("still returns a log-based diagnosis when agent verification fails", async () => {
    const fetcher = vercelFetcher();
    const failingLoop: AgentLoop = async () => {
      throw new Error("model unavailable");
    };

    const result = await runInvestigation({
      accessToken: "tkn",
      fetcher: fetcher as unknown as typeof fetch,
      agentLoop: failingLoop
    });

    // The deterministically-fetched log still drives the diagnosis.
    expect(result.diagnosis.category).toBe("missing_env_var");
    expect(result.trace.map((step) => step.tool)).toContain("get_deployment_events");
  });

  it("throws when no evidence can be gathered at all", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, false));

    await expect(
      runInvestigation({
        accessToken: "tkn",
        fetcher: fetcher as unknown as typeof fetch,
        agentLoop: async () => ({ text: "" })
      })
    ).rejects.toThrow();
  });
});
