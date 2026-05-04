import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/diagnoses/route";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { generateCerebrasDiagnosis } from "@/lib/diagnosis/generateCerebrasDiagnosis";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { generateMockDiagnosis } from "@/lib/diagnosis/generateMockDiagnosis";
import { DiagnosisResultSchema } from "@/lib/diagnosis/schema";

describe("POST /api/diagnoses", () => {
  it("rejects empty logs", async () => {
    const response = await POST(jsonRequest({ log: "   " }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("Paste deployment logs before running a diagnosis.");
  });

  it("rejects oversized logs with friendly excerpt guidance", async () => {
    const response = await POST(jsonRequest({ log: "x".repeat(MAX_LOG_CHARS + 1) }));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe(oversizedLogMessage);
  });

  it("falls back to mock output when CEREBRAS_API_KEY is missing", async () => {
    vi.stubEnv("CEREBRAS_API_KEY", "");

    const response = await POST(jsonRequest({ log: "Module not found: Can't resolve './x'" }));
    const body = (await response.json()) as { generatedBy: string; category: string };

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("mock");
    expect(body.category).toBe("module_not_found");

    vi.unstubAllEnvs();
  });
});

describe("generateServerDiagnosis", () => {
  it("redacts logs before the Cerebras generator receives input", async () => {
    const cerebrasDiagnosis = vi.fn(async (sanitizedLog: string) => ({
      ...generateMockDiagnosis(sanitizedLog),
      generatedBy: "cerebras" as const
    }));

    await generateServerDiagnosis(
      `OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz
Error: Missing required environment variable STRIPE_SECRET_KEY`,
      { apiKey: "test-key", cerebrasDiagnosis }
    );

    expect(cerebrasDiagnosis).toHaveBeenCalledOnce();
    expect(cerebrasDiagnosis.mock.calls[0]?.[0]).toContain("OPENAI_API_KEY=[REDACTED]");
    expect(cerebrasDiagnosis.mock.calls[0]?.[0]).not.toContain(
      "sk_test_abcdefghijklmnopqrstuvwxyz"
    );
  });

  it("falls back to mock output when the model call fails", async () => {
    const result = await generateServerDiagnosis("Type error: TS2322", {
      apiKey: "test-key",
      cerebrasDiagnosis: async () => {
        throw new Error("model unavailable");
      }
    });

    expect(result.generatedBy).toBe("mock");
    expect(result.category).toBe("typescript_error");
  });
});

describe("generateCerebrasDiagnosis", () => {
  it("adds server-owned analyzedAt to valid Cerebras output", async () => {
    const mockDiagnosis = {
      ...generateMockDiagnosis("Module not found: Can't resolve './x'"),
      generatedBy: "cerebras" as const
    };
    const modelOutput = { ...mockDiagnosis } as Partial<typeof mockDiagnosis>;

    delete modelOutput.analyzedAt;

    const create = vi.fn(async (request: Record<string, unknown>) => {
      void request;

      return {
        choices: [
          {
            message: {
              content: JSON.stringify(modelOutput)
            }
          }
        ]
      };
    });
    const client = {
      chat: {
        completions: {
          create
        }
      }
    };

    const result = await generateCerebrasDiagnosis({
      sanitizedLog: "Module not found: Can't resolve './x'",
      apiKey: "test-key",
      client
    });

    expect(result.generatedBy).toBe("cerebras");
    expect(DiagnosisResultSchema.parse(result).analyzedAt).toBe(result.analyzedAt);
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
    expect(create).toHaveBeenCalledOnce();

    const request = create.mock.calls[0]?.[0] as {
      response_format?: {
        json_schema?: {
          schema?: {
            properties?: Record<string, unknown>;
            required?: string[];
          };
        };
      };
    };
    const schema = request.response_format?.json_schema?.schema;

    expect(schema?.properties).not.toHaveProperty("analyzedAt");
    expect(schema?.required).not.toContain("analyzedAt");
  });
});

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/diagnoses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}
