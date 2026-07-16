import type { IncidentReport } from "./schema";

export async function analyzePastedIncident(
  rawLog: string,
  sourceType: IncidentReport["sourceType"] = "pasted_log"
): Promise<IncidentReport> {
  const response = await fetch("/api/incidents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ log: rawLog, sourceType })
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new Error(error);
  }

  return (await response.json()) as IncidentReport;
}

export async function analyzeLatestFailedDeployment(
  accessToken: string,
  teamId?: string
): Promise<IncidentReport> {
  const response = await fetch("/api/vercel/deployments/analyze-latest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken, teamId: teamId?.trim() || undefined })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as IncidentReport;
}

export async function investigateWithAgent(
  accessToken: string,
  teamId?: string
): Promise<IncidentReport> {
  const response = await fetch("/api/agent/investigate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken, teamId: teamId?.trim() || undefined })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as IncidentReport;
}

export type AgentStepView = {
  tool: string;
  status: string;
  summary: string;
};

export async function investigateWithAgentStream(
  accessToken: string,
  teamId: string | undefined,
  onStep: (step: AgentStepView) => void
): Promise<IncidentReport> {
  const response = await fetch("/api/agent/investigate/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ accessToken, teamId: teamId?.trim() || undefined })
  });

  if (!response.ok || !response.body) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let incident: IncidentReport | null = null;
  let streamError: string | null = null;

  for (;;) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const parsed = parseSseEvent(rawEvent);

      if (parsed.event === "step" && parsed.data) {
        onStep(parsed.data as AgentStepView);
      } else if (parsed.event === "report" && parsed.data) {
        incident = parsed.data as IncidentReport;
      } else if (parsed.event === "error") {
        streamError =
          (parsed.data as { error?: string } | undefined)?.error ?? "The investigation failed.";
      }

      separator = buffer.indexOf("\n\n");
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  if (!incident) {
    throw new Error("The investigation agent did not return a report.");
  }

  return incident;
}

function parseSseEvent(rawEvent: string): { event?: string; data?: unknown } {
  let event: string | undefined;
  const dataLines: string[] = [];

  for (const line of rawEvent.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  if (dataLines.length === 0) {
    return { event };
  }

  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return { event };
  }
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
