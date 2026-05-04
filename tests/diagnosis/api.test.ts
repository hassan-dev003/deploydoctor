import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/diagnoses/route";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { generateOpenAIDiagnosis } from "@/lib/diagnosis/generateOpenAIDiagnosis";
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

  it("falls back to mock output when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(jsonRequest({ log: "Module not found: Can't resolve './x'" }));
    const body = (await response.json()) as { generatedBy: string; category: string };

    expect(response.status).toBe(200);
    expect(body.generatedBy).toBe("mock");
    expect(body.category).toBe("module_not_found");

    vi.unstubAllEnvs();
  });
});

describe("generateServerDiagnosis", () => {
  it("redacts logs before the OpenAI generator receives input", async () => {
    const openAIDiagnosis = vi.fn(async (sanitizedLog: string) => ({
      ...generateMockDiagnosis(sanitizedLog),
      generatedBy: "openai" as const
    }));

    await generateServerDiagnosis(
      `OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz
Error: Missing required environment variable STRIPE_SECRET_KEY`,
      { apiKey: "test-key", openAIDiagnosis }
    );

    expect(openAIDiagnosis).toHaveBeenCalledOnce();
    expect(openAIDiagnosis.mock.calls[0]?.[0]).toContain("OPENAI_API_KEY=[REDACTED]");
    expect(openAIDiagnosis.mock.calls[0]?.[0]).not.toContain(
      "sk_test_abcdefghijklmnopqrstuvwxyz"
    );
  });

  it("falls back to mock output when the model call fails", async () => {
    const result = await generateServerDiagnosis("Type error: TS2322", {
      apiKey: "test-key",
      openAIDiagnosis: async () => {
        throw new Error("model unavailable");
      }
    });

    expect(result.generatedBy).toBe("mock");
    expect(result.category).toBe("typescript_error");
  });
});

describe("generateOpenAIDiagnosis", () => {
  it("adds server-owned analyzedAt to valid OpenAI output", async () => {
    const mockDiagnosis = {
      ...generateMockDiagnosis("Module not found: Can't resolve './x'"),
      generatedBy: "openai" as const
    };
    const modelOutput = { ...mockDiagnosis } as Partial<typeof mockDiagnosis>;

    delete modelOutput.analyzedAt;

    const create = vi.fn(async () => ({
      output_parsed: modelOutput
    }));
    const client = {
      responses: {
        create
      }
    };

    const result = await generateOpenAIDiagnosis({
      sanitizedLog: "Module not found: Can't resolve './x'",
      apiKey: "test-key",
      client
    });

    expect(result.generatedBy).toBe("openai");
    expect(DiagnosisResultSchema.parse(result).analyzedAt).toBe(result.analyzedAt);
    expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt);
    expect(create).toHaveBeenCalledOnce();

    const request = create.mock.calls[0]?.[0] as {
      text?: {
        format?: {
          schema?: {
            properties?: Record<string, unknown>;
            required?: string[];
          };
        };
      };
    };
    const schema = request.text?.format?.schema;

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
