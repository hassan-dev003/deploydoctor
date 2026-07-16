import { tool } from "ai";
import { z } from "zod";
import { getProjectSettings, listProjectEnvKeys } from "@/lib/vercel/api";
import type { AgentStep, InvestigationContext } from "./types";

type ToolContext = {
  accessToken: string;
  teamId?: string;
  fetcher?: typeof fetch;
  context: InvestigationContext;
};

// The agent runs on top of deterministically-gathered evidence (log + classification). Its
// tools are the verification tools: check the real project to confirm or refute the
// hypothesis. Every tool records a real step and returns only value-free data.
export function createVerificationTools({ accessToken, teamId, fetcher, context }: ToolContext) {
  const apiOptions = { accessToken, teamId, fetcher };

  function record(step: AgentStep) {
    context.steps.push(step);
  }

  return {
    list_project_env_keys: tool({
      description:
        "List a project's environment variable KEYS and their targets (production/preview/development). Values are never returned. Use this to verify whether a required variable actually exists in the failing target.",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async ({ projectId }) => {
        const keys = await listProjectEnvKeys(projectId, apiOptions);
        const preview = keys
          .map((entry) => `${entry.key} [${entry.targets.join("/") || "all"}]`)
          .slice(0, 30)
          .join(", ");

        context.notes.push(`Environment variable keys: ${preview}.`);
        record({
          tool: "list_project_env_keys",
          status: "completed",
          summary: `Checked ${keys.length} environment variable key(s) against the failing target.`
        });

        return keys;
      }
    }),

    get_project_settings: tool({
      description:
        "Get a project's framework, Node version, and build/install commands to verify a build or tooling hypothesis.",
      inputSchema: z.object({ projectId: z.string() }),
      execute: async ({ projectId }) => {
        const project = await getProjectSettings(projectId, apiOptions);

        context.notes.push(
          `Project framework ${project.framework ?? "unknown"}, node ${
            project.nodeVersion ?? "default"
          }.`
        );
        record({
          tool: "get_project_settings",
          status: "completed",
          summary: `Checked project settings (framework ${project.framework ?? "unknown"}, node ${
            project.nodeVersion ?? "default"
          }).`
        });

        return project;
      }
    })
  };
}
