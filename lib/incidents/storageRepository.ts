import { createPool } from "@vercel/postgres";
import { redactSecrets } from "@/lib/diagnosis/redact";
import { getPostgresUrl, ShareDatabaseUnavailableError, type SqlExecutor } from "@/lib/share/shareRepository";
import { createIncidentId } from "./generateIncidentReport";
import { IncidentReportSchema, type IncidentReport } from "./schema";
import { StoredIncidentSchema, type StoredIncident } from "./storageSchema";

type StoredIncidentInput = {
  incidentId?: string;
  sourceType: IncidentReport["sourceType"];
  status: IncidentReport["status"];
  projectId?: string | null;
  deploymentId?: string | null;
  deploymentUrl?: string | null;
  title: string;
  summary: string;
  incident?: IncidentReport | null;
  rawPayloadJson?: unknown;
};

let cachedSqlUrl: string | undefined;
let cachedSqlExecutor: SqlExecutor | undefined;

export function sanitizeWebhookPayload(payload: unknown): unknown {
  return sanitizeUnknown(payload);
}

export async function saveStoredIncident(
  input: StoredIncidentInput,
  executor: SqlExecutor = getIncidentStorageSqlExecutor()
): Promise<StoredIncident> {
  await ensureIncidentStorageSchema(executor);

  const incidentJson = input.incident ? IncidentReportSchema.parse(input.incident) : null;
  const sanitizedPayload = sanitizeWebhookPayload(input.rawPayloadJson ?? null);
  const incidentId = input.incidentId ?? createIncidentId();

  const result = await executor`
    insert into incidents (
      incident_id,
      source_type,
      status,
      project_id,
      deployment_id,
      deployment_url,
      title,
      summary,
      incident_json,
      raw_payload_json
    )
    values (
      ${incidentId},
      ${input.sourceType},
      ${input.status},
      ${input.projectId ?? null},
      ${input.deploymentId ?? null},
      ${input.deploymentUrl ?? null},
      ${input.title},
      ${input.summary},
      ${incidentJson ? JSON.stringify(incidentJson) : null}::jsonb,
      ${JSON.stringify(sanitizedPayload)}::jsonb
    )
    returning
      incident_id,
      created_at,
      source_type,
      status,
      project_id,
      deployment_id,
      deployment_url,
      title,
      summary,
      incident_json,
      raw_payload_json
  `;

  return storedIncidentFromRow(result.rows[0]);
}

export async function listStoredIncidents(
  executor: SqlExecutor = getIncidentStorageSqlExecutor()
): Promise<StoredIncident[]> {
  await ensureIncidentStorageSchema(executor);

  const result = await executor`
    select
      incident_id,
      created_at,
      source_type,
      status,
      project_id,
      deployment_id,
      deployment_url,
      title,
      summary,
      incident_json,
      raw_payload_json
    from incidents
    order by created_at desc
    limit 50
  `;

  return result.rows.map((row) => storedIncidentFromRow(row));
}

export async function ensureIncidentStorageSchema(
  executor: SqlExecutor = getIncidentStorageSqlExecutor()
): Promise<void> {
  await executor`
    create table if not exists incidents (
      incident_id text primary key,
      created_at timestamptz not null default now(),
      source_type text not null,
      status text not null,
      project_id text,
      deployment_id text,
      deployment_url text,
      title text not null,
      summary text not null,
      incident_json jsonb,
      raw_payload_json jsonb
    )
  `;
}

function getIncidentStorageSqlExecutor(): SqlExecutor {
  const postgresUrl = getPostgresUrl();

  if (!postgresUrl) {
    throw new ShareDatabaseUnavailableError();
  }

  if (cachedSqlExecutor && cachedSqlUrl === postgresUrl) {
    return cachedSqlExecutor;
  }

  const pool = createPool({
    connectionString: postgresUrl
  });

  cachedSqlUrl = postgresUrl;
  cachedSqlExecutor = (strings, ...values) => pool.sql(strings, ...values);

  return cachedSqlExecutor;
}

function storedIncidentFromRow(row: Record<string, unknown> | undefined): StoredIncident {
  if (!row) {
    throw new Error("No incident row returned.");
  }

  const incidentJson =
    typeof row.incident_json === "string"
      ? JSON.parse(row.incident_json)
      : row.incident_json ?? null;
  const rawPayloadJson =
    typeof row.raw_payload_json === "string"
      ? JSON.parse(row.raw_payload_json)
      : row.raw_payload_json ?? null;
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);

  return StoredIncidentSchema.parse({
    incidentId: row.incident_id,
    createdAt,
    sourceType: row.source_type,
    status: row.status,
    projectId: row.project_id ?? null,
    deploymentId: row.deployment_id ?? null,
    deploymentUrl: row.deployment_url ?? null,
    title: row.title,
    summary: row.summary,
    incident: incidentJson,
    rawPayloadJson
  });
}

function sanitizeUnknown(value: unknown, key = ""): unknown {
  if (isRawLogLikeKey(key)) {
    return "[OMITTED_RAW_LOG_FIELD]";
  }

  if (typeof value === "string") {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [
        nestedKey,
        sanitizeUnknown(nestedValue, nestedKey)
      ])
    );
  }

  return value;
}

function isRawLogLikeKey(key: string): boolean {
  return /^(rawLog|rawLogs|logs?|buildLogs?|stdout|stderr|output|text|pastedText)$/i.test(key);
}
