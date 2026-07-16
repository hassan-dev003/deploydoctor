import type { IncidentReport } from "@/lib/incidents/schema";

export type AgentStepStatus = IncidentReport["investigationSteps"][number]["status"];

// One real step the investigation agent took (a tool call and what it observed).
// These become the incident report's investigation timeline, so the UI reflects the
// agent's actual actions rather than canned copy.
export type AgentStep = {
  tool: string;
  status: AgentStepStatus;
  summary: string;
};

export type InvestigationContext = {
  sanitizedLog?: string;
  notes: string[];
  steps: AgentStep[];
  // Called as each step is recorded, so callers can stream the trace live.
  onStep?: (step: AgentStep) => void;
};

export function recordStep(context: InvestigationContext, step: AgentStep): void {
  context.steps.push(step);
  context.onStep?.(step);
}

export function humanizeToolName(toolName: string): string {
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
