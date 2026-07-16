import { createCerebras } from "@ai-sdk/cerebras";
import { generateText, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { redactSecrets } from "@/lib/diagnosis/redact";
import type { DiagnosisResult } from "@/lib/diagnosis/schema";
import { fetchLatestFailedDeploymentLog } from "@/lib/vercel/api";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import type { IncidentReport } from "@/lib/incidents/schema";
import { createInvestigationTools } from "./tools";
import type { AgentStep, InvestigationContext } from "./types";

const DEFAULT_MODEL = "gpt-oss-120b";
const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are DeployDoctor, an autonomous incident investigator for failed Vercel deployments.
Work step by step using the available tools:
1. If you were not given a deployment id, call list_recent_failed_deployments and pick the most recent failure.
2. Call get_deployment_events to read the sanitized build log.
3. Call classify_log on that log to get a category hint.
4. Form a hypothesis about the root cause.
5. VERIFY the hypothesis with a targeted tool before concluding. For a suspected missing
   environment variable, call get_deployment to find the target environment, then
   list_project_env_keys to check whether that variable actually exists in the failing target.
   For build or tooling issues, call get_project_settings.
6. Once the cause is verified, stop and briefly state the confirmed root cause and the fix.
Never guess when a tool can confirm the answer. Do not ask the user questions.`;

type AgentLoopConfig = {
  model?: LanguageModel;
  system: string;
  prompt: string;
  tools: ToolSet;
};

export type AgentLoop = (config: AgentLoopConfig) => Promise<{ text: string }>;

export type RunInvestigationInput = {
  accessToken: string;
  teamId?: string;
  deploymentId?: string;
  log?: string;
  model?: LanguageModel;
  cerebrasApiKey?: string;
  fetcher?: typeof fetch;
  // Injectable for tests: drive the tools without a live model.
  agentLoop?: AgentLoop;
};

export type InvestigationResult = {
  diagnosis: DiagnosisResult;
  trace: AgentStep[];
};

export async function runInvestigation(input: RunInvestigationInput): Promise<InvestigationResult> {
  const context: InvestigationContext = { notes: [], steps: [] };
  const apiKey = input.cerebrasApiKey ?? process.env.CEREBRAS_API_KEY;

  if (input.log) {
    context.sanitizedLog = redactSecrets(input.log);
  }

  try {
    const tools = createInvestigationTools({
      accessToken: input.accessToken,
      teamId: input.teamId,
      fetcher: input.fetcher,
      context
    });

    const config: AgentLoopConfig = {
      model: input.model,
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input, context),
      tools
    };

    const result = input.agentLoop
      ? await input.agentLoop(config)
      : await runCerebrasLoop(config, apiKey);

    const diagnosis = await synthesizeDiagnosis(context, result.text, apiKey);
    return { diagnosis, trace: context.steps };
  } catch {
    // Fall back to a single-shot diagnosis over whatever sanitized evidence we gathered.
    // If the agent loop failed before reading any log (e.g. no model available), fetch the
    // latest failed deployment deterministically so the request still returns a report.
    let fallbackLog = context.sanitizedLog;

    if (!fallbackLog) {
      try {
        fallbackLog =
          (await fetchLatestFailedDeploymentLog({
            accessToken: input.accessToken,
            teamId: input.teamId,
            deploymentId: input.deploymentId,
            fetcher: input.fetcher
          })) ?? undefined;
      } catch {
        // Ignore and fall through to the error below.
      }
    }

    if (!fallbackLog) {
      throw new Error(
        "DeployDoctor could not investigate this deployment with the provided token."
      );
    }

    const diagnosis = await generateServerDiagnosis(fallbackLog, { apiKey });
    return { diagnosis, trace: context.steps };
  }
}

export function buildAgentIncidentReport(
  result: InvestigationResult,
  incidentId?: string
): IncidentReport {
  const investigationSteps =
    result.trace.length > 0
      ? result.trace.map((step) => ({
          title: humanizeTool(step.tool),
          status: step.status,
          summary: step.summary
        }))
      : undefined;

  return generateIncidentReport(result.diagnosis, incidentId, {
    sourceType: "vercel_api",
    investigationSteps
  });
}

async function runCerebrasLoop(
  config: AgentLoopConfig,
  apiKey: string | undefined
): Promise<{ text: string }> {
  const model =
    config.model ?? createCerebras({ apiKey })(process.env.CEREBRAS_MODEL ?? DEFAULT_MODEL);

  const { text } = await generateText({
    model,
    system: config.system,
    prompt: config.prompt,
    tools: config.tools,
    stopWhen: stepCountIs(MAX_STEPS)
  });

  return { text };
}

async function synthesizeDiagnosis(
  context: InvestigationContext,
  agentText: string,
  apiKey: string | undefined
): Promise<DiagnosisResult> {
  const parts: string[] = [];

  if (context.sanitizedLog) {
    parts.push(context.sanitizedLog);
  }

  if (context.notes.length > 0) {
    parts.push(`\nInvestigation notes:\n${context.notes.map((note) => `- ${note}`).join("\n")}`);
  }

  if (agentText.trim()) {
    parts.push(`\nAgent conclusion:\n${agentText.trim()}`);
  }

  const findings = parts.join("\n").trim() || "(no evidence gathered)";
  return generateServerDiagnosis(findings, { apiKey });
}

function buildPrompt(input: RunInvestigationInput, context: InvestigationContext): string {
  if (input.deploymentId) {
    return `Investigate failed Vercel deployment "${input.deploymentId}". Fetch its events, classify the failure, verify the cause with tools, and report.`;
  }

  if (context.sanitizedLog) {
    return `Investigate this failed Vercel deployment. Sanitized build log:\n\n${context.sanitizedLog.slice(
      0,
      8000
    )}\n\nClassify it, verify the likely cause with tools where possible, and report.`;
  }

  return "Find the caller's most recent failed Vercel deployment, investigate it, verify the cause, and report.";
}

function humanizeTool(toolName: string): string {
  const labels: Record<string, string> = {
    list_recent_failed_deployments: "Searched for the failed deployment",
    get_deployment_events: "Read the deployment build log",
    get_deployment: "Inspected deployment metadata",
    get_project_settings: "Checked project settings",
    list_project_env_keys: "Verified environment variables",
    classify_log: "Classified the failure"
  };

  return labels[toolName] ?? toolName.replaceAll("_", " ");
}
