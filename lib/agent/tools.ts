import { tool } from "ai";
import { z } from "zod";
import { classifyDeploymentLog } from "@/lib/diagnosis/classify";
import { redactSecrets } from "@/lib/diagnosis/redact";
import {
  deploymentEventsToSanitizedLog,
  getDeployment,
  getDeploymentEvents,
  getProjectSettings,
  listDeployments,
  listProjectEnvKeys
} from "@/lib/vercel/api";
import type { AgentStep, InvestigationContext } from "./types";

type ToolContext = {
  accessToken: string;
  teamId?: string;
  fetcher?: typeof fetch;
  context: InvestigationContext;
};

const MAX_LOG_CHARS_FOR_MODEL = 8000;

// Builds the agent's tool set, bound to the caller's Vercel token. Every tool records a
// real investigation step and returns only redacted, value-free data to the model.
export function createInvestigationTools({ accessToken, teamId, fetcher, context }: ToolContext) {
  const apiOptions = { accessToken, teamId, fetcher };

  function record(step: AgentStep) {
    context.steps.push(step);
  }

  return {
    list_recent_failed_deployments: tool({
      description:
        "List the caller's most recent failed Vercel deployments so you can pick one to investigate.",
      inputSchema: z.object({}),
      execute: async () => {
        const deployments = await listDeployments({ ...apiOptions, limit: 30 });
        const failed = deployments.filter(
          (deployment) => (deployment.state ?? deployment.readyState) === "ERROR"
        );

        record({
          tool: "list_recent_failed_deployments",
          status: "completed",
          summary: `Found ${failed.length} recent failed deployment(s).`
        });

        return failed.slice(0, 10).map((deployment) => ({
          id: deployment.uid ?? deployment.id,
          name: deployment.name,
          url: deployment.url,
          createdAt: deployment.createdAt
        }));
      }
    }),

    get_deployment_events: tool({
      description:
        "Fetch and sanitize the build/log events for a deployment id. Use this to read what actually failed.",
      inputSchema: z.object({ deploymentId: z.string() }),
      execute: async ({ deploymentId }) => {
        const events = await getDeploymentEvents(deploymentId, apiOptions);
        const sanitized = deploymentEventsToSanitizedLog(events);
        context.sanitizedLog = sanitized;

        record({
          tool: "get_deployment_events",
          status: "completed",
          summary: `Fetched ${events.length} deployment event(s) and sanitized the build log.`
        });

        return sanitized.slice(0, MAX_LOG_CHARS_FOR_MODEL) || "(no log text found)";
      }
    }),

    get_deployment: tool({
      description:
        "Get metadata for a deployment: target environment (production/preview), state, project id, and git commit.",
      inputSchema: z.object({ deploymentId: z.string() }),
      execute: async ({ deploymentId }) => {
        const deployment = await getDeployment(deploymentId, apiOptions);
        const commitSha =
          typeof deployment.meta?.githubCommitSha === "string"
            ? deployment.meta.githubCommitSha
            : undefined;
        const commitRef =
          typeof deployment.meta?.githubCommitRef === "string"
            ? deployment.meta.githubCommitRef
            : undefined;
        const summary = `Deployment target=${deployment.target ?? "unknown"}, state=${
          deployment.readyState ?? deployment.state ?? "unknown"
        }${commitRef ? `, branch=${commitRef}` : ""}.`;

        context.notes.push(summary);
        record({ tool: "get_deployment", status: "completed", summary });

        return {
          projectId: deployment.projectId,
          target: deployment.target,
          state: deployment.readyState ?? deployment.state,
          commitSha,
          commitRef
        };
      }
    }),

    get_project_settings: tool({
      description: "Get a project's framework, Node version, and build/install commands.",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async ({ projectId }) => {
        const project = await getProjectSettings(projectId, apiOptions);
        const summary = `Project framework=${project.framework ?? "unknown"}, node=${
          project.nodeVersion ?? "default"
        }, build=${project.buildCommand ?? "default"}.`;

        context.notes.push(summary);
        record({ tool: "get_project_settings", status: "completed", summary });

        return project;
      }
    }),

    list_project_env_keys: tool({
      description:
        "List a project's environment variable KEYS and their targets (production/preview/development). Values are never returned. Use this to verify whether a required variable actually exists in the failing environment.",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async ({ projectId }) => {
        const keys = await listProjectEnvKeys(projectId, apiOptions);
        const preview = keys
          .map((entry) => `${entry.key}[${entry.targets.join("/") || "all"}]`)
          .slice(0, 20)
          .join(", ");

        context.notes.push(`Project environment variable keys: ${preview}.`);
        record({
          tool: "list_project_env_keys",
          status: "completed",
          summary: `Checked ${keys.length} environment variable key(s) against the failing build.`
        });

        return keys;
      }
    }),

    classify_log: tool({
      description:
        "Run the deterministic rule-based classifier on sanitized log text to get a failure-category hint.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const result = classifyDeploymentLog(redactSecrets(text));

        context.notes.push(`Classifier category hint: ${result.category}.`);
        record({
          tool: "classify_log",
          status: "completed",
          summary: `Classifier hint: ${result.category.replaceAll("_", " ")} (${Math.round(
            result.confidence * 100
          )}%).`
        });

        return { category: result.category, confidence: result.confidence };
      }
    })
  };
}
