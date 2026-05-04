import { z } from "zod";
import { IncidentReportSchema } from "./schema";

export const StoredIncidentSchema = z.object({
  incidentId: IncidentReportSchema.shape.incidentId,
  createdAt: z.string().datetime(),
  sourceType: IncidentReportSchema.shape.sourceType,
  status: IncidentReportSchema.shape.status,
  projectId: z.string().min(1).nullable(),
  deploymentId: z.string().min(1).nullable(),
  deploymentUrl: z.string().min(1).nullable(),
  title: z.string().min(1),
  summary: z.string().min(1),
  incident: IncidentReportSchema.nullable(),
  rawPayloadJson: z.unknown().nullable()
});

export type StoredIncident = z.infer<typeof StoredIncidentSchema>;
