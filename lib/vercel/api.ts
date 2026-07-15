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
      const text = redactSecrets(eventContent(event)).trim();

      // Drop events that carry no real log text so they do not add noise to the
      // diagnosis prompt. The prefix is only added after this emptiness check,
      // which is why the previous trailing filter could never remove them.
      if (text.length === 0) {
        return null;
      }

      return `[event ${index + 1}${event.type ? ` ${event.type}` : ""}] ${text}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

function eventContent(event: VercelDeploymentEvent): string {
  if (typeof event.text === "string" && event.text.trim().length > 0) {
    return event.text;
  }

  if (event.payload && typeof event.payload === "object") {
    return JSON.stringify(event.payload);
  }

  return "";
}
