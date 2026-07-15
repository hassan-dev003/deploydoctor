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

const VercelDeploymentSchema = z.object({
  uid: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  state: z.string().optional(),
  readyState: z.string().optional(),
  createdAt: z.union([z.number(), z.string()]).optional()
});

const VercelDeploymentsResponseSchema = z.object({
  deployments: z.array(VercelDeploymentSchema)
});

export type VercelDeployment = z.infer<typeof VercelDeploymentSchema>;

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

export async function listDeployments(
  options: VercelApiOptions & { limit?: number }
): Promise<VercelDeployment[]> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL("https://api.vercel.com/v6/deployments");
  url.searchParams.set("limit", String(options.limit ?? 20));

  if (options.teamId) {
    url.searchParams.set("teamId", options.teamId);
  }

  const response = await fetcher(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error("Could not list Vercel deployments.");
  }

  const parsed = VercelDeploymentsResponseSchema.parse(await response.json());
  return parsed.deployments;
}

export function findLatestFailedDeployment(
  deployments: VercelDeployment[]
): VercelDeployment | null {
  const failed = deployments.filter(
    (deployment) => (deployment.state ?? deployment.readyState) === "ERROR"
  );

  if (failed.length === 0) {
    return null;
  }

  // v6 returns newest first, but sort defensively so we always pick the most recent.
  return (
    failed
      .slice()
      .sort((a, b) => deploymentCreatedMillis(b) - deploymentCreatedMillis(a))[0] ?? null
  );
}

function deploymentCreatedMillis(deployment: VercelDeployment): number {
  const value = deployment.createdAt;

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : Date.parse(value) || 0;
  }

  return 0;
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
