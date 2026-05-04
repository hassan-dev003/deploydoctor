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
