import { randomBytes } from "node:crypto";
import { sql } from "@vercel/postgres";
import { redactSecrets } from "@/lib/diagnosis/redact";
import { DiagnosisResultSchema, type DiagnosisResult } from "@/lib/diagnosis/schema";
import { SavedDiagnosisShareSchema, type SavedDiagnosisShare } from "./shareSchema";

export class ShareDatabaseUnavailableError extends Error {
  constructor(message = "Sharing is not configured yet. Set POSTGRES_URL to enable saved diagnosis links.") {
    super(message);
    this.name = "ShareDatabaseUnavailableError";
  }
}

type SqlResult = {
  rows: Record<string, unknown>[];
};

type SqlPrimitive = string | number | boolean | undefined | null;

export type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: SqlPrimitive[]
) => Promise<SqlResult>;

export type DiagnosisShareRecord = {
  shareId: string;
  category: DiagnosisResult["category"];
  generatedBy: DiagnosisResult["generatedBy"];
  title: string;
  summary: string;
  diagnosisJson: DiagnosisResult;
};

export function createShareId(): string {
  return randomBytes(16).toString("hex");
}

export function sanitizeDiagnosisForShare(diagnosis: DiagnosisResult): DiagnosisResult {
  return DiagnosisResultSchema.parse(redactStrings(diagnosis));
}

export function prepareDiagnosisShareRecord(
  diagnosis: DiagnosisResult,
  shareId = createShareId()
): DiagnosisShareRecord {
  const sanitizedDiagnosis = sanitizeDiagnosisForShare(diagnosis);

  return {
    shareId,
    category: sanitizedDiagnosis.category,
    generatedBy: sanitizedDiagnosis.generatedBy,
    title: sanitizedDiagnosis.title,
    summary: sanitizedDiagnosis.summary,
    diagnosisJson: sanitizedDiagnosis
  };
}

export async function saveDiagnosisShare(
  diagnosis: DiagnosisResult,
  executor: SqlExecutor = sql
): Promise<SavedDiagnosisShare> {
  assertPostgresConfigured();
  await ensureShareSchema(executor);

  const record = prepareDiagnosisShareRecord(diagnosis);
  const result = await executor`
    insert into diagnosis_shares (
      share_id,
      category,
      generated_by,
      title,
      summary,
      diagnosis_json
    )
    values (
      ${record.shareId},
      ${record.category},
      ${record.generatedBy},
      ${record.title},
      ${record.summary},
      ${JSON.stringify(record.diagnosisJson)}::jsonb
    )
    returning
      share_id,
      created_at,
      category,
      generated_by,
      title,
      summary,
      diagnosis_json
  `;

  return shareFromRow(result.rows[0]);
}

export async function getDiagnosisShare(
  shareId: string,
  executor: SqlExecutor = sql
): Promise<SavedDiagnosisShare | null> {
  assertPostgresConfigured();
  await ensureShareSchema(executor);

  const result = await executor`
    select
      share_id,
      created_at,
      category,
      generated_by,
      title,
      summary,
      diagnosis_json
    from diagnosis_shares
    where share_id = ${shareId}
    limit 1
  `;

  if (!result.rows[0]) {
    return null;
  }

  return shareFromRow(result.rows[0]);
}

export async function ensureShareSchema(executor: SqlExecutor = sql): Promise<void> {
  await executor`
    create table if not exists diagnosis_shares (
      id bigserial primary key,
      share_id text not null unique,
      created_at timestamptz not null default now(),
      category text not null,
      generated_by text not null,
      title text not null,
      summary text not null,
      diagnosis_json jsonb not null
    )
  `;
}

function assertPostgresConfigured(): void {
  if (!process.env.POSTGRES_URL) {
    throw new ShareDatabaseUnavailableError();
  }
}

function shareFromRow(row: Record<string, unknown> | undefined): SavedDiagnosisShare {
  if (!row) {
    throw new Error("No diagnosis share row returned.");
  }

  const diagnosisJson =
    typeof row.diagnosis_json === "string"
      ? JSON.parse(row.diagnosis_json)
      : row.diagnosis_json;
  const diagnosis = DiagnosisResultSchema.parse(diagnosisJson);
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at);

  return SavedDiagnosisShareSchema.parse({
    shareId: row.share_id,
    createdAt,
    category: row.category,
    generatedBy: row.generated_by,
    title: row.title,
    summary: row.summary,
    diagnosis
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
