import type { IncidentReport } from "./schema";

export type ShareIncidentResponse = {
  shareId: string;
  url: string;
};

export async function saveIncidentForSharing(
  incident: IncidentReport
): Promise<ShareIncidentResponse> {
  const response = await fetch("/api/incidents/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ incident })
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new Error(error);
  }

  return (await response.json()) as ShareIncidentResponse;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Fall through to generic message.
  }

  return "DeployDoctor could not create an incident link.";
}
