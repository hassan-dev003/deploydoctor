import { describe, expect, it, vi } from "vitest";
import { getDeployment, getProjectSettings, listProjectEnvKeys } from "@/lib/vercel/api";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe("getProjectSettings", () => {
  it("parses framework and node version", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ framework: "nextjs", nodeVersion: "20.x", buildCommand: null })
    );

    const settings = await getProjectSettings("prj_1", {
      accessToken: "t",
      fetcher: fetcher as unknown as typeof fetch
    });

    expect(settings.framework).toBe("nextjs");
    expect(settings.nodeVersion).toBe("20.x");
  });
});

describe("listProjectEnvKeys", () => {
  it("returns keys and targets but never values", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        envs: [
          { key: "STRIPE_SECRET_KEY", target: ["preview"], value: "sk_live_should_not_leak" },
          { key: "DATABASE_URL", target: "production" }
        ]
      })
    );

    const keys = await listProjectEnvKeys("prj_1", {
      accessToken: "t",
      fetcher: fetcher as unknown as typeof fetch
    });

    expect(keys).toEqual([
      { key: "STRIPE_SECRET_KEY", targets: ["preview"] },
      { key: "DATABASE_URL", targets: ["production"] }
    ]);
    expect(JSON.stringify(keys)).not.toContain("sk_live_should_not_leak");
  });
});

describe("getDeployment", () => {
  it("reads metadata including target and commit ref", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        uid: "dpl_1",
        readyState: "ERROR",
        target: "production",
        projectId: "prj_1",
        meta: { githubCommitRef: "main" }
      })
    );

    const deployment = await getDeployment("dpl_1", {
      accessToken: "t",
      fetcher: fetcher as unknown as typeof fetch
    });

    expect(deployment.projectId).toBe("prj_1");
    expect(deployment.target).toBe("production");
  });
});
