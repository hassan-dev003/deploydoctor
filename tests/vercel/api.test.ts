import { describe, expect, it, vi } from "vitest";
import {
  deploymentEventsToSanitizedLog,
  findLatestFailedDeployment,
  listDeployments
} from "@/lib/vercel/api";

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe("deploymentEventsToSanitizedLog", () => {
  it("formats events with text and drops empty ones while keeping original indexes", () => {
    const output = deploymentEventsToSanitizedLog([
      { type: "stdout", text: "Building..." },
      { type: "stderr", text: "   " },
      { type: "stdout", text: "" },
      { type: "stdout", text: "Error: build failed" }
    ]);

    expect(output).toBe("[event 1 stdout] Building...\n[event 4 stdout] Error: build failed");
  });

  it("falls back to sanitized payload when text is absent", () => {
    const output = deploymentEventsToSanitizedLog([
      { type: "deployment-state", payload: { state: "ERROR" } }
    ]);

    expect(output).toBe('[event 1 deployment-state] {"state":"ERROR"}');
  });

  it("drops events that carry neither text nor payload", () => {
    const output = deploymentEventsToSanitizedLog([{ type: "heartbeat" }]);

    expect(output).toBe("");
  });

  it("redacts secrets inside event text", () => {
    const output = deploymentEventsToSanitizedLog([
      { type: "stdout", text: "TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz" }
    ]);

    expect(output).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
    expect(output).toContain("[event 1 stdout]");
  });
});

describe("listDeployments", () => {
  it("calls the v6 endpoint with a bearer token and parses deployments", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ deployments: [{ uid: "dpl_1", state: "ERROR" }] })
    );

    const result = await listDeployments({
      accessToken: "tkn",
      fetcher: fetcher as unknown as typeof fetch
    });

    expect(result).toHaveLength(1);
    const [calledUrl, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(calledUrl.toString()).toContain("https://api.vercel.com/v6/deployments");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tkn");
  });

  it("throws a friendly error when the token is rejected", async () => {
    const fetcher = vi.fn(async () => jsonResponse({}, false));

    await expect(
      listDeployments({ accessToken: "bad", fetcher: fetcher as unknown as typeof fetch })
    ).rejects.toThrow("Could not list Vercel deployments.");
  });
});

describe("findLatestFailedDeployment", () => {
  it("returns the most recent failed deployment across state and readyState", () => {
    const result = findLatestFailedDeployment([
      { uid: "a", state: "READY", createdAt: 3 },
      { uid: "b", state: "ERROR", createdAt: 1 },
      { uid: "c", readyState: "ERROR", createdAt: 2 }
    ]);

    expect(result?.uid).toBe("c");
  });

  it("returns null when no deployment failed", () => {
    expect(findLatestFailedDeployment([{ uid: "a", state: "READY" }])).toBeNull();
  });
});
