import { z } from "zod";
import { ShareIdSchema } from "@/lib/share/shareSchema";
import { IncidentReportSchema } from "./schema";

export const ShareIncidentRequestSchema = z
  .object({
    incident: IncidentReportSchema
  })
  .strict();

export const SavedIncidentShareSchema = z.object({
  shareId: ShareIdSchema,
  createdAt: z.string().datetime(),
  status: IncidentReportSchema.shape.status,
  title: z.string().min(1),
  summary: z.string().min(1),
  incident: IncidentReportSchema
});

export type SavedIncidentShare = z.infer<typeof SavedIncidentShareSchema>;
