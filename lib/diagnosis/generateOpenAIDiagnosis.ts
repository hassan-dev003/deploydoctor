import OpenAI from "openai";
import { classifyDeploymentLog } from "./classify";
import {
  DiagnosisResultSchema,
  type DiagnosisResult
} from "./schema";

const defaultModel = "gpt-5-mini";

type ResponsesClient = {
  responses: {
    create: (request: Record<string, unknown>) => Promise<unknown>;
  };
};

type GenerateOpenAIDiagnosisOptions = {
  sanitizedLog: string;
  apiKey?: string;
  model?: string;
  client?: ResponsesClient;
};

const diagnosisJsonSchema = {
  type: "object",
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
      enum: ["openai"]
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

export async function generateOpenAIDiagnosis({
  sanitizedLog,
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL ?? defaultModel,
  client
}: GenerateOpenAIDiagnosisOptions): Promise<DiagnosisResult> {
  if (!apiKey && !client) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = client ?? new OpenAI({ apiKey });
  const localClassification = classifyDeploymentLog(sanitizedLog);

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content:
          "You are DeployDoctor, a deployment assistant for Vercel and Next.js failures. Return only the requested structured diagnosis. Be specific, practical, and avoid claiming access to private Vercel logs or external systems."
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
    text: {
      format: {
        type: "json_schema",
        name: "deploydoctor_diagnosis",
        strict: true,
        schema: diagnosisJsonSchema
      }
    }
  });

  const parsed = extractStructuredOutput(response);

  return DiagnosisResultSchema.parse({
    ...parsed,
    generatedBy: "openai",
    analyzedAt: new Date().toISOString()
  });
}

function extractStructuredOutput(response: unknown): Record<string, unknown> {
  if (isRecord(response) && isRecord(response.output_parsed)) {
    return response.output_parsed;
  }

  if (isRecord(response) && typeof response.output_text === "string") {
    const parsed = JSON.parse(response.output_text) as unknown;

    if (isRecord(parsed)) {
      return parsed;
    }
  }

  throw new Error("OpenAI response did not include structured diagnosis output.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
