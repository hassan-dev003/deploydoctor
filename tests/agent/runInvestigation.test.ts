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
    if (url.includes("/v6/deployments")) {
      return jsonResponse({ deployments: [{ uid: "dpl_fail", state: "ERROR", createdAt: 9 }] });
    }
    if (url.includes("/v13/deployments/")) {
      return jsonResponse({
        uid: "dpl_fail",
        readyState: "ERROR",
        target: "production",
        projectId: "prj_1",
        meta: { githubCommitRef: "main" }
      });
    }
    if (url.includes("/env")) {
      return jsonResponse({ envs: [{ key: "STRIPE_SECRET_KEY", target: ["preview"] }] });
    }
    if (url.includes("/v9/projects/")) {
      return jsonResponse({ framework: "nextjs", nodeVersion: "20.x" });
    }

    return jsonResponse({}, false);
  });
}

// Simulates the model's decisions: it drives the real tools (which hit the mock fetcher
// and record the trace), then concludes.
const investigatingLoop: AgentLoop = async ({ tools }) => {
  const list = (await (tools.list_recent_failed_deployments.execute as (args: unknown) => Promise<
    Array<{ id: string }>
  >)({})) as Array<{ id: string }>;
  const deploymentId = list[0].id;
  const log = await (tools.get_deployment_events.execute as (args: unknown) => Promise<string>)({
    deploymentId
  });
  await (tools.classify_log.execute as (args: unknown) => Promise<unknown>)({ text: log });
  const meta = (await (tools.get_deployment.execute as (args: unknown) => Promise<{
    projectId: string;
  }>)({ deploymentId })) as { projectId: string };
  await (tools.list_project_env_keys.execute as (args: unknown) => Promise<unknown>)({
    projectId: meta.projectId
  });

  return { text: "Confirmed: STRIPE_SECRET_KEY exists in Preview but is missing in Production." };
};

describe("runInvestigation", () => {
  it("runs a tool-driven investigation and builds a report from the real trace", async () => {
    const fetcher = vercelFetcher();

    const result = await runInvestigation({
      accessToken: "tkn",
      fetcher: fetcher as unknown as typeof fetch,
      agentLoop: investigatingLoop
    });

    const toolsUsed = result.trace.map((step) => step.tool);
    expect(toolsUsed).toContain("get_deployment_events");
    expect(toolsUsed).toContain("list_project_env_keys");
    expect(result.diagnosis.category).toBe("missing_env_var");

    const report = buildAgentIncidentReport(result);
    expect(report.sourceType).toBe("vercel_api");
    expect(report.investigationSteps).toHaveLength(result.trace.length);
    expect(
      report.investigationSteps.some((step) => step.title === "Verified environment variables")
    ).toBe(true);
  });

  it("falls back to a single-shot diagnosis when the agent loop fails", async () => {
    const failingLoop: AgentLoop = async () => {
      throw new Error("model unavailable");
    };

    const result = await runInvestigation({
      accessToken: "tkn",
      log: "Error: Cannot find module 'left-pad'",
      agentLoop: failingLoop
    });

    expect(result.diagnosis.category).toBe("module_not_found");
    expect(result.trace).toHaveLength(0);
  });
});
