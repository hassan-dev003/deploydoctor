import OpenAI from "openai";
import { classifyDeploymentLog } from "./classify";
import {
  DiagnosisResultSchema,
  type DiagnosisResult
} from "./schema";

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const defaultModel = "gpt-oss-120b";

type ChatCompletionsClient = {
  chat: {
    completions: {
      create: (request: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

type GenerateCerebrasDiagnosisOptions = {
  sanitizedLog: string;
  apiKey?: string;
  model?: string;
  client?: ChatCompletionsClient;
};

const diagnosisJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    category: {
      type: "string",
      enum: [
        "module_not_found",
        "typescript_error",
        "lint_error",
        "missing_env_var",
        "dependency_install_error",
        "build_command_error",
        "node_version_error",
        "unknown"
      ]
    },
    title: { type: "string" },
    summary: { type: "string" },
    rootCause: { type: "string" },
    reasoning: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    evidenceLines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          lineNumber: { type: "integer", minimum: 1 },
          text: { type: "string" }
        },
        required: ["lineNumber", "text"]
      }
    },
    fixSteps: {
      type: "array",
      items: { type: "string" }
    },
    filesToCheck: {
      type: "array",
      items: { type: "string" }
    },
    commands: {
      type: "array",
      items: { type: "string" }
    },
    nextDiagnosticCommand: { type: "string" },
    generatedBy: {
      type: "string",
      enum: ["cerebras"]
    }
  },
  required: [
    "category",
    "title",
    "summary",
    "rootCause",
    "reasoning",
    "confidence",
    "evidenceLines",
    "fixSteps",
    "filesToCheck",
    "commands",
    "nextDiagnosticCommand",
    "generatedBy"
  ]
};

export async function generateCerebrasDiagnosis({
  sanitizedLog,
  apiKey = process.env.CEREBRAS_API_KEY,
  model = process.env.CEREBRAS_MODEL ?? defaultModel,
  client
}: GenerateCerebrasDiagnosisOptions): Promise<DiagnosisResult> {
  if (!apiKey && !client) {
    throw new Error("CEREBRAS_API_KEY is not configured.");
  }

  const cerebras = client ?? new OpenAI({
    apiKey,
    baseURL: CEREBRAS_BASE_URL
  });
  const localClassification = classifyDeploymentLog(sanitizedLog);

  const response = await cerebras.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are DeployDoctor, a deployment assistant for Vercel and Next.js failures. Return only the requested structured diagnosis JSON. Be specific, practical, and avoid claiming access to private Vercel logs or external systems."
      },
      {
        role: "user",
        content: [
          "Analyze this sanitized Vercel deployment log.",
          `Local classifier category hint: ${localClassification.category}.`,
          "Explain the likely root cause, why you think so, exact next steps, files/settings to check, commands to try, and the next diagnostic command.",
          "Use only evidence visible in the sanitized log.",
          "",
          sanitizedLog
        ].join("\n")
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "deploydoctor_diagnosis",
        strict: true,
        schema: diagnosisJsonSchema
      }
    }
  });

  const parsed = extractStructuredOutput(response);

  return DiagnosisResultSchema.parse({
    ...parsed,
    generatedBy: "cerebras",
    analyzedAt: new Date().toISOString()
  });
}

function extractStructuredOutput(response: unknown): Record<string, unknown> {
  // Chat Completions API: response.choices[0].message.content contains the JSON string
  if (isRecord(response) && Array.isArray(response.choices)) {
    const choice = response.choices[0] as unknown;

    if (isRecord(choice) && isRecord(choice.message)) {
      // Try parsed field first (some OpenAI-compatible clients populate it)
      if (isRecord(choice.message.parsed)) {
        return choice.message.parsed;
      }

      if (typeof choice.message.content === "string") {
        const parsed = JSON.parse(choice.message.content) as unknown;

        if (isRecord(parsed)) {
          return parsed;
        }
      }
    }
  }

  throw new Error("Cerebras response did not include structured diagnosis output.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
