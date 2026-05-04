import { z } from "zod";
import { createIncidentId } from "@/lib/incidents/generateIncidentReport";
import type { StoredIncident } from "@/lib/incidents/storageSchema";

export const VercelWebhookPayloadSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  createdAt: z.union([z.string().min(1), z.number()]),
  region: z.string().min(1).nullable().optional(),
  payload: z.record(z.unknown())
});

export type VercelWebhookPayload = z.infer<typeof VercelWebhookPayloadSchema>;

export type VercelWebhookIncidentInput = {
  incidentId: string;
  sourceType: "vercel_webhook";
  status: StoredIncident["status"];
  projectId: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  title: string;
  summary: string;
  incident: null;
  rawPayloadJson: VercelWebhookPayload;
};

export function isVercelDeploymentFailure(payload: VercelWebhookPayload): boolean {
  return payload.type === "deployment.error" || payload.type === "deployment-error";
}

export function webhookToStoredIncidentInput(
  webhook: VercelWebhookPayload
): VercelWebhookIncidentInput {
  const deployment = readRecord(webhook.payload.deployment) ?? webhook.payload;
  const project = readRecord(webhook.payload.project);
  const deploymentId = readString(deployment.id) ?? readString(webhook.payload.deploymentId);
  const deploymentUrl =
    readString(deployment.url) ??
    readString(deployment.inspectorUrl) ??
    readString(webhook.payload.url);
  const projectId =
    readString(project?.id) ??
    readString(deployment.projectId) ??
    readString(webhook.payload.projectId);
  const projectName =
    readString(project?.name) ??
    readString(deployment.name) ??
    readString(webhook.payload.projectName);

  return {
    incidentId: createIncidentId(),
    sourceType: "vercel_webhook",
    status: "needs_more_evidence",
    projectId,
    deploymentId,
    deploymentUrl,
    title: projectName
      ? `Vercel deployment failed for ${projectName}`
      : "Vercel deployment failed",
    summary:
      "Vercel reported a failed deployment. DeployDoctor stored webhook metadata only; connected log fetching is not implemented yet.",
    incident: null,
    rawPayloadJson: webhook
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
