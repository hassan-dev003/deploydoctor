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

const VercelDeploymentDetailSchema = z.object({
  uid: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
  readyState: z.string().optional(),
  state: z.string().optional(),
  target: z.string().nullable().optional(),
  projectId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional()
});

export type VercelDeploymentDetail = z.infer<typeof VercelDeploymentDetailSchema>;

const VercelProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  framework: z.string().nullable().optional(),
  nodeVersion: z.string().optional(),
  buildCommand: z.string().nullable().optional(),
  installCommand: z.string().nullable().optional(),
  outputDirectory: z.string().nullable().optional(),
  rootDirectory: z.string().nullable().optional()
});

export type VercelProjectSettings = z.infer<typeof VercelProjectSchema>;

const VercelEnvSchema = z.object({
  key: z.string(),
  target: z.union([z.array(z.string()), z.string()]).optional(),
  type: z.string().optional()
});

const VercelEnvsResponseSchema = z.object({ envs: z.array(VercelEnvSchema) });

export type VercelEnvKey = { key: string; targets: string[] };

async function vercelGet(url: URL, options: VercelApiOptions): Promise<Response> {
  const fetcher = options.fetcher ?? fetch;

  if (options.teamId) {
    url.searchParams.set("teamId", options.teamId);
  }

  return fetcher(url, {
    headers: {
      Authorization: `Bearer ${options.accessToken}`
    }
  });
}

export async function getDeployment(
  deploymentId: string,
  options: VercelApiOptions
): Promise<VercelDeploymentDetail> {
  const url = new URL(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}`
  );
  const response = await vercelGet(url, options);

  if (!response.ok) {
    throw new Error("Could not fetch the Vercel deployment.");
  }

  return VercelDeploymentDetailSchema.parse(await response.json());
}

export async function getProjectSettings(
  projectIdOrName: string,
  options: VercelApiOptions
): Promise<VercelProjectSettings> {
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}`
  );
  const response = await vercelGet(url, options);

  if (!response.ok) {
    throw new Error("Could not fetch the Vercel project settings.");
  }

  return VercelProjectSchema.parse(await response.json());
}

// Returns env var keys and their targets only. Values are never requested or returned,
// so no secret material is exposed to the agent or the model.
export async function listProjectEnvKeys(
  projectIdOrName: string,
  options: VercelApiOptions
): Promise<VercelEnvKey[]> {
  const url = new URL(
    `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}/env`
  );
  const response = await vercelGet(url, options);

  if (!response.ok) {
    throw new Error("Could not list Vercel project environment variables.");
  }

  const parsed = VercelEnvsResponseSchema.parse(await response.json());

  return parsed.envs.map((env) => ({
    key: env.key,
    targets: Array.isArray(env.target) ? env.target : env.target ? [env.target] : []
  }));
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
