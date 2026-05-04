import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import {
  saveStoredIncident,
  updateStoredIncidentAnalysis
} from "@/lib/incidents/storageRepository";
import type { StoredIncident } from "@/lib/incidents/storageSchema";
import { decryptToken } from "@/lib/security/tokenCrypto";
import { deploymentEventsToSanitizedLog, getDeploymentEvents } from "./api";
import { findConnectedVercelConnectionForProject } from "./connections/repository";
import {
  getVercelWebhookDeploymentId,
  getVercelWebhookProjectTeam,
  type VercelWebhookPayload,
  webhookToStoredIncidentInput
} from "./webhook";

type ProcessVercelFailureOptions = {
  fetchDeploymentEvents?: typeof getDeploymentEvents;
};

export async function processVercelDeploymentFailureWebhook(
  webhook: VercelWebhookPayload,
  options: ProcessVercelFailureOptions = {}
): Promise<StoredIncident> {
  const placeholder = await saveStoredIncident(webhookToStoredIncidentInput(webhook));
  const { projectId, teamId } = getVercelWebhookProjectTeam(webhook);
  const deploymentId = getVercelWebhookDeploymentId(webhook);

  if (!deploymentId) {
    return placeholder;
  }

  const connection = await findConnectedVercelConnectionForProject({ projectId, teamId });

  if (!connection?.accessTokenEncrypted) {
    return placeholder;
  }

  try {
    const accessToken = decryptToken(connection.accessTokenEncrypted);
    const fetchDeploymentEvents = options.fetchDeploymentEvents ?? getDeploymentEvents;
    const events = await fetchDeploymentEvents(deploymentId, {
      accessToken,
      teamId: connection.teamId ?? teamId
    });
    const sanitizedLog = deploymentEventsToSanitizedLog(events);

    if (!sanitizedLog.trim()) {
      return updateStoredIncidentAnalysis({
        incidentId: placeholder.incidentId,
        status: "needs_more_evidence",
        title: placeholder.title,
        summary:
          "DeployDoctor found an authorized Vercel connection, but the deployment events did not include enough log text to analyze.",
        incident: null
      });
    }

    const diagnosis = await generateServerDiagnosis(sanitizedLog);
    const incident = generateIncidentReport(diagnosis, placeholder.incidentId, {
      sourceType: "vercel_webhook"
    });

    return updateStoredIncidentAnalysis({
      incidentId: placeholder.incidentId,
      status: incident.status,
      title: incident.diagnosis.title,
      summary: incident.diagnosis.summary,
      incident
    });
  } catch {
    return updateStoredIncidentAnalysis({
      incidentId: placeholder.incidentId,
      status: "needs_more_evidence",
      title: placeholder.title,
      summary:
        "DeployDoctor found a Vercel connection, but could not fetch enough deployment evidence. Reconnect Vercel or paste the failed build log.",
      incident: null
    });
  }
}
