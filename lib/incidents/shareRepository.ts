import { createPool } from "@vercel/postgres";
import { redactSecrets } from "@/lib/diagnosis/redact";
import { createShareId, getPostgresUrl, ShareDatabaseUnavailableError, type SqlExecutor } from "@/lib/share/shareRepository";
import { IncidentReportSchema, type IncidentReport } from "./schema";
import { SavedIncidentShareSchema, type SavedIncidentShare } from "./shareSchema";

export type IncidentShareRecord = {
  shareId: string;
  status: IncidentReport["status"];
  title: string;
  summary: string;
  incidentJson: IncidentReport;
};

let cachedSqlUrl: string | undefined;
let cachedSqlExecutor: SqlExecutor | undefined;

export function sanitizeIncidentForShare(incident: IncidentReport): IncidentReport {
  return IncidentReportSchema.parse(redactStrings(incident));
}

export function prepareIncidentShareRecord(
  incident: IncidentReport,
  shareId = createShareId()
): IncidentShareRecord {
  const sanitizedIncident = sanitizeIncidentForShare(incident);

  return {
    shareId,
    status: sanitizedIncident.status,
    title: sanitizedIncident.diagnosis.title,
    summary: sanitizedIncident.diagnosis.summary,
    incidentJson: sanitizedIncident
  };
}

export async function saveIncidentShare(
  incident: IncidentReport,
  executor: SqlExecutor = getIncidentSqlExecutor()
): Promise<SavedIncidentShare> {
  await ensureIncidentShareSchema(executor);

  const record = prepareIncidentShareRecord(incident);
  const result = await executor`
    insert into incident_shares (
      share_id,
      status,
      title,
      summary,
      incident_json
    )
    values (
      ${record.shareId},
      ${record.status},
      ${record.title},
      ${record.summary},
      ${JSON.stringify(record.incidentJson)}::jsonb
    )
    returning
      share_id,
      created_at,
      status,
      title,
      summary,
      incident_json
  `;

  return shareFromRow(result.rows[0]);
}

export async function getIncidentShare(
  shareId: string,
  executor: SqlExecutor = getIncidentSqlExecutor()
): Promise<SavedIncidentShare | null> {
  await ensureIncidentShareSchema(executor);

  const result = await executor`
    select
      share_id,
      created_at,
      status,
      title,
      summary,
      incident_json
    from incident_shares
    where share_id = ${shareId}
    limit 1
  `;

  if (!result.rows[0]) {
    return null;
  }

  return shareFromRow(result.rows[0]);
}

export async function ensureIncidentShareSchema(
  executor: SqlExecutor = getIncidentSqlExecutor()
): Promise<void> {
  await executor`
    create table if not exists incident_shares (
      id bigserial primary key,
      share_id text not null unique,
      created_at timestamptz not null default now(),
      status text not null,
      title text not null,
      summary text not null,
      incident_json jsonb not null
    )
  `;
}

function getIncidentSqlExecutor(): SqlExecutor {
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

function shareFromRow(row: Record<string, unknown> | undefined): SavedIncidentShare {
  if (!row) {
    throw new Error("No incident share row returned.");
  }

  const incidentJson =
    typeof row.incident_json === "string"
      ? JSON.parse(row.incident_json)
      : row.incident_json;
  const incident = IncidentReportSchema.parse(incidentJson);
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);

  return SavedIncidentShareSchema.parse({
    shareId: row.share_id,
    createdAt,
    status: row.status,
    title: row.title,
    summary: row.summary,
    incident
  });
}

function redactStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSecrets(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, redactStrings(nestedValue)])
    );
  }

  return value;
}
