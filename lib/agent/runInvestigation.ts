import { createCerebras } from "@ai-sdk/cerebras";
import { generateText, stepCountIs, type LanguageModel, type ToolSet } from "ai";
import { classifyDeploymentLog } from "@/lib/diagnosis/classify";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { redactSecrets } from "@/lib/diagnosis/redact";
import type { DiagnosisResult } from "@/lib/diagnosis/schema";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import type { IncidentReport } from "@/lib/incidents/schema";
import {
  deploymentEventsToSanitizedLog,
  findLatestFailedDeployment,
  getDeployment,
  getDeploymentEvents,
  listDeployments
} from "@/lib/vercel/api";
import { createVerificationTools } from "./tools";
import type { InvestigationContext } from "./types";

const DEFAULT_MODEL = "gpt-oss-120b";
const MAX_STEPS = 5;
const MAX_LOG_CHARS = 20000;

const VERIFY_SYSTEM_PROMPT = `You are DeployDoctor, an incident investigator for failed Vercel deployments.
You are given a sanitized build log and a classifier hint. The essential evidence has already
been gathered for you. Your job is to VERIFY the likely cause with tools before concluding:
- If a required environment variable seems missing, call list_project_env_keys with the project
  id and check whether that variable actually exists in the failing target.
- If the failure looks like a build, tooling, or Node-version issue, call get_project_settings.
Call at most a couple of tools, then briefly state the verified root cause and the fix. If the
log already makes the cause obvious and no project data would change it, just say so and stop.
Never ask the user questions. Environment variable values are never available to you.`;

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
  // Injectable for tests: drive the verification tools without a live model.
  agentLoop?: AgentLoop;
};

export type InvestigationResult = {
  diagnosis: DiagnosisResult;
  trace: InvestigationContext["steps"];
};

type BaseEvidence = { projectId?: string; target?: string };

export async function runInvestigation(input: RunInvestigationInput): Promise<InvestigationResult> {
  const context: InvestigationContext = { notes: [], steps: [] };
  const apiKey = input.cerebrasApiKey ?? process.env.CEREBRAS_API_KEY;

  try {
    const base = await gatherBaseEvidence(input, context);

    // Best-effort agent verification layered on top of the deterministic evidence. If the
    // model is unavailable or misbehaves, the log-based diagnosis below still stands.
    if (context.sanitizedLog) {
      try {
        const tools = createVerificationTools({
          accessToken: input.accessToken,
          teamId: input.teamId,
          fetcher: input.fetcher,
          context
        });

        const config: AgentLoopConfig = {
          model: input.model,
          system: VERIFY_SYSTEM_PROMPT,
          prompt: buildVerifyPrompt(context, base),
          tools
        };

        const result = input.agentLoop
          ? await input.agentLoop(config)
          : await runCerebrasLoop(config, apiKey);

        if (result.text.trim()) {
          context.notes.push(`Agent conclusion: ${result.text.trim()}`);
        }
      } catch {
        // Verification is optional; the deterministic evidence still stands.
      }
    }

    const diagnosis = await synthesizeDiagnosis(context, apiKey);
    return { diagnosis, trace: context.steps };
  } catch {
    const fallbackLog = context.sanitizedLog ?? (input.log ? redactSecrets(input.log) : undefined);

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

// Deterministically resolve the failed deployment, read its sanitized log, and classify it.
// This is the evidence floor: it does not depend on the model making the right tool calls.
async function gatherBaseEvidence(
  input: RunInvestigationInput,
  context: InvestigationContext
): Promise<BaseEvidence> {
  if (input.log) {
    context.sanitizedLog = redactSecrets(input.log).slice(0, MAX_LOG_CHARS);
    recordClassification(context);
    return {};
  }

  const apiOptions = { accessToken: input.accessToken, teamId: input.teamId, fetcher: input.fetcher };
  let deploymentId = input.deploymentId;

  if (!deploymentId) {
    const deployments = await listDeployments({ ...apiOptions, limit: 30 });
    const failed = deployments.filter(
      (deployment) => (deployment.state ?? deployment.readyState) === "ERROR"
    );
    const latest = findLatestFailedDeployment(deployments);
    deploymentId = latest?.uid ?? latest?.id;
    context.steps.push({
      tool: "list_recent_failed_deployments",
      status: "completed",
      summary: `Found ${failed.length} recent failed deployment(s).`
    });
  }

  if (!deploymentId) {
    return {};
  }

  let base: BaseEvidence = {};

  try {
    const meta = await getDeployment(deploymentId, apiOptions);
    const shortSha =
      typeof meta.meta?.githubCommitSha === "string" ? meta.meta.githubCommitSha.slice(0, 7) : undefined;
    base = { projectId: meta.projectId, target: meta.target ?? undefined };
    context.steps.push({
      tool: "get_deployment",
      status: "completed",
      summary: `Inspected deployment metadata: target ${meta.target ?? "unknown"}, state ${
        meta.readyState ?? meta.state ?? "unknown"
      }${shortSha ? `, commit ${shortSha}` : ""}.`
    });
  } catch {
    // Metadata is helpful but optional; continue to the log.
  }

  const events = await getDeploymentEvents(deploymentId, apiOptions);
  context.sanitizedLog = deploymentEventsToSanitizedLog(events).slice(0, MAX_LOG_CHARS);
  context.steps.push({
    tool: "get_deployment_events",
    status: "completed",
    summary: `Read the sanitized build log (${events.length} event(s)).`
  });

  recordClassification(context);
  return base;
}

function recordClassification(context: InvestigationContext): void {
  if (!context.sanitizedLog) {
    return;
  }

  const result = classifyDeploymentLog(context.sanitizedLog);
  context.notes.push(`Classifier category hint: ${result.category}.`);
  context.steps.push({
    tool: "classify_log",
    status: "completed",
    summary: `Classifier hint: ${result.category.replaceAll("_", " ")} (${Math.round(
      result.confidence * 100
    )}%).`
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
  apiKey: string | undefined
): Promise<DiagnosisResult> {
  const parts: string[] = [];

  if (context.sanitizedLog) {
    parts.push(context.sanitizedLog);
  }

  if (context.notes.length > 0) {
    parts.push(`\nInvestigation notes:\n${context.notes.map((note) => `- ${note}`).join("\n")}`);
  }

  const findings = parts.join("\n").trim() || "(no evidence gathered)";
  return generateServerDiagnosis(findings, { apiKey });
}

function buildVerifyPrompt(context: InvestigationContext, base: BaseEvidence): string {
  const log = (context.sanitizedLog ?? "").slice(0, 8000);
  const hint =
    context.notes
      .find((note) => note.startsWith("Classifier category hint"))
      ?.replace("Classifier category hint: ", "")
      .replace(/\.$/, "") ?? "unknown";
  const projectLine = base.projectId
    ? `Project id: ${base.projectId}. Failing target: ${base.target ?? "unknown"}.`
    : "No project id is available, so project-level tools cannot be used.";

  return `Sanitized build log:\n\n${log}\n\nClassifier hint: ${hint}. ${projectLine}\nVerify the likely cause with a tool if it helps, then state the confirmed root cause and fix.`;
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
