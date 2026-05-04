import type { IncidentReport } from "./schema";

export async function analyzePastedIncident(rawLog: string): Promise<IncidentReport> {
  const response = await fetch("/api/incidents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ log: rawLog })
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new Error(error);
  }

  return (await response.json()) as IncidentReport;
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
    // Fall through to the generic message.
  }

  return "DeployDoctor could not analyze this incident.";
}
