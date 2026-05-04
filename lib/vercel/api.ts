import { z } from "zod";
import { redactSecrets } from "@/lib/diagnosis/redact";

const VercelDeploymentEventSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  created: z.union([z.number(), z.string()]).optional(),
  date: z.union([z.number(), z.string()]).optional(),
  text: z.string().optional(),
  payload: z.unknown().optional()
});

const VercelDeploymentEventsResponseSchema = z.union([
  z.array(VercelDeploymentEventSchema),
  z.object({
    events: z.array(VercelDeploymentEventSchema)
  })
]);

export type VercelDeploymentEvent = z.infer<typeof VercelDeploymentEventSchema>;

type VercelApiOptions = {
  accessToken: string;
  teamId?: string | null;
  fetcher?: typeof fetch;
};

export async function getDeploymentEvents(
  deploymentIdOrUrl: string,
  options: VercelApiOptions
): Promise<VercelDeploymentEvent[]> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(
    `https://api.vercel.com/v3/deployments/${encodeURIComponent(deploymentIdOrUrl)}/events`
  );
  url.searchParams.set("limit", "100");

  if (options.teamId) {
    url.searchParams.set("teamId", options.teamId);
  }

  const response = await fetcher(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Could not fetch Vercel deployment events.");
  }

  const parsed = VercelDeploymentEventsResponseSchema.parse(await response.json());
  return Array.isArray(parsed) ? parsed : parsed.events;
}

export async function listProjects(options: VercelApiOptions): Promise<unknown> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL("https://api.vercel.com/v9/projects");

  if (options.teamId) {
    url.searchParams.set("teamId", options.teamId);
  }

  const response = await fetcher(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Could not list Vercel projects.");
  }

  return response.json();
}

export async function getRuntimeLogs(): Promise<never> {
  throw new Error("Runtime log fetching is not implemented in Milestone 7B.");
}

export async function createWebhook(): Promise<never> {
  throw new Error("Webhook creation is not implemented in Milestone 7B.");
}

export function deploymentEventsToSanitizedLog(events: VercelDeploymentEvent[]): string {
  return events
    .map((event, index) => {
      const text = typeof event.text === "string" ? event.text : eventToText(event);
      return `[event ${index + 1}${event.type ? ` ${event.type}` : ""}] ${redactSecrets(text)}`;
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function eventToText(event: VercelDeploymentEvent): string {
  if (event.payload && typeof event.payload === "object") {
    return JSON.stringify(event.payload);
  }

  return event.type ?? "Vercel deployment event";
}
