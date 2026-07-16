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
};
