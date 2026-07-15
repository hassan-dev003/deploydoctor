import { describe, expect, it } from "vitest";
import { deploymentEventsToSanitizedLog } from "@/lib/vercel/api";

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
