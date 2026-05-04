import { randomBytes } from "node:crypto";
import { createPool } from "@vercel/postgres";
import { getPostgresUrl, ShareDatabaseUnavailableError, type SqlExecutor } from "@/lib/share/shareRepository";
import { VercelConnectionSchema, type VercelConnection } from "./schema";

type VercelConnectionInput = {
  connectionId?: string;
  teamId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  webhookId?: string | null;
  status?: VercelConnection["status"];
};

let cachedSqlUrl: string | undefined;
let cachedSqlExecutor: SqlExecutor | undefined;

export function createVercelConnectionId(): string {
  return `vc_${randomBytes(8).toString("hex")}`;
}

export async function saveVercelConnection(
  input: VercelConnectionInput,
  executor: SqlExecutor = getConnectionSqlExecutor()
): Promise<VercelConnection> {
  await ensureVercelConnectionSchema(executor);

  const result = await executor`
    insert into vercel_connections (
      connection_id,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
    )
    values (
      ${input.connectionId ?? createVercelConnectionId()},
      ${input.teamId ?? null},
      ${input.userId ?? null},
      ${input.projectId ?? null},
      ${input.projectName ?? null},
      ${input.accessTokenEncrypted ?? null},
      ${input.refreshTokenEncrypted ?? null},
      ${input.webhookId ?? null},
      ${input.status ?? "demo"}
    )
    returning
      connection_id,
      created_at,
      updated_at,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
  `;

  return connectionFromRow(result.rows[0]);
}

export async function upsertVercelConnection(
  input: VercelConnectionInput,
  executor: SqlExecutor = getConnectionSqlExecutor()
): Promise<VercelConnection> {
  await ensureVercelConnectionSchema(executor);

  const connectionId = input.connectionId ?? createVercelConnectionId();
  const result = await executor`
    insert into vercel_connections (
      connection_id,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
    )
    values (
      ${connectionId},
      ${input.teamId ?? null},
      ${input.userId ?? null},
      ${input.projectId ?? null},
      ${input.projectName ?? null},
      ${input.accessTokenEncrypted ?? null},
      ${input.refreshTokenEncrypted ?? null},
      ${input.webhookId ?? null},
      ${input.status ?? "connected"}
    )
    on conflict (connection_id)
    do update set
      updated_at = now(),
      team_id = excluded.team_id,
      user_id = excluded.user_id,
      project_id = excluded.project_id,
      project_name = excluded.project_name,
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      webhook_id = excluded.webhook_id,
      status = excluded.status
    returning
      connection_id,
      created_at,
      updated_at,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
  `;

  return connectionFromRow(result.rows[0]);
}

export async function findConnectedVercelConnectionForProject(
  input: { projectId?: string | null; teamId?: string | null },
  executor: SqlExecutor = getConnectionSqlExecutor()
): Promise<VercelConnection | null> {
  await ensureVercelConnectionSchema(executor);

  const result = await executor`
    select
      connection_id,
      created_at,
      updated_at,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
    from vercel_connections
    where status = 'connected'
      and access_token_encrypted is not null
      and (${input.projectId ?? null}::text is null or project_id = ${input.projectId ?? null} or project_id is null)
      and (${input.teamId ?? null}::text is null or team_id = ${input.teamId ?? null} or team_id is null)
    order by
      case when project_id = ${input.projectId ?? null} then 0 else 1 end,
      updated_at desc
    limit 1
  `;

  return result.rows[0] ? connectionFromRow(result.rows[0]) : null;
}

export async function listVercelConnections(
  executor: SqlExecutor = getConnectionSqlExecutor()
): Promise<VercelConnection[]> {
  await ensureVercelConnectionSchema(executor);

  const result = await executor`
    select
      connection_id,
      created_at,
      updated_at,
      team_id,
      user_id,
      project_id,
      project_name,
      access_token_encrypted,
      refresh_token_encrypted,
      webhook_id,
      status
    from vercel_connections
    order by updated_at desc
    limit 20
  `;

  return result.rows.map((row) => connectionFromRow(row));
}

export async function ensureVercelConnectionSchema(
  executor: SqlExecutor = getConnectionSqlExecutor()
): Promise<void> {
  await executor`
    create table if not exists vercel_connections (
      id bigserial primary key,
      connection_id text not null unique,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      team_id text,
      user_id text,
      project_id text,
      project_name text,
      access_token_encrypted text,
      refresh_token_encrypted text,
      webhook_id text,
      status text not null
    )
  `;
}

function getConnectionSqlExecutor(): SqlExecutor {
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

function connectionFromRow(row: Record<string, unknown> | undefined): VercelConnection {
  if (!row) {
    throw new Error("No Vercel connection row returned.");
  }

  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);
  const updatedAt =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : String(row.updated_at);

  return VercelConnectionSchema.parse({
    connectionId: row.connection_id,
    createdAt,
    updatedAt,
    teamId: row.team_id ?? null,
    userId: row.user_id ?? null,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    accessTokenEncrypted: row.access_token_encrypted ?? null,
    refreshTokenEncrypted: row.refresh_token_encrypted ?? null,
    webhookId: row.webhook_id ?? null,
    status: row.status
  });
}
