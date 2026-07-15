import { z } from "zod";
import { DiagnosisResultSchema } from "@/lib/diagnosis/schema";

export const IncidentSourceTypeSchema = z.enum([
  "pasted_log",
  "sample_log",
  "vercel_webhook",
  "vercel_api"
]);
export const IncidentStatusSchema = z.enum(["needs_action", "needs_more_evidence"]);
export const InvestigationStepStatusSchema = z.enum(["completed", "needs_action"]);
export const EvidenceSeveritySchema = z.enum(["info", "warning", "critical"]);
export const SafeActionRiskSchema = z.enum(["low", "medium"]);

export const InvestigationStepSchema = z.object({
  title: z.string().min(1),
  status: InvestigationStepStatusSchema,
  summary: z.string().min(1)
});

export const EvidenceCardSchema = z.object({
  title: z.string().min(1),
  severity: EvidenceSeveritySchema,
  lineNumber: z.number().int().positive().optional(),
  quote: z.string().min(1),
  interpretation: z.string().min(1)
});

export const RepairPlanSchema = z.object({
  summary: z.string().min(1),
  prioritySteps: z.array(z.string().min(1)),
  commands: z.array(z.string().min(1)),
  filesToCheck: z.array(z.string().min(1)),
  nextDiagnosticCommand: z.string().min(1)
});

export const SafeActionSchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  risk: SafeActionRiskSchema
});

export const IncidentReportSchema = z.object({
  incidentId: z.string().regex(/^inc_[a-f0-9]{16}$/),
  createdAt: z.string().datetime(),
  sourceType: IncidentSourceTypeSchema,
  status: IncidentStatusSchema,
  diagnosis: DiagnosisResultSchema,
  investigationSteps: z.array(InvestigationStepSchema).min(1),
  evidenceCards: z.array(EvidenceCardSchema),
  repairPlan: RepairPlanSchema,
  safeActions: z.array(SafeActionSchema).min(1)
});

export type IncidentReport = z.infer<typeof IncidentReportSchema>;
export type EvidenceCard = z.infer<typeof EvidenceCardSchema>;
