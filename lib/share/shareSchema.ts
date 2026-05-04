import { z } from "zod";
import { DiagnosisResultSchema } from "@/lib/diagnosis/schema";

export const ShareIdSchema = z.string().regex(/^[a-f0-9]{32}$/);

export const ShareDiagnosisRequestSchema = z
  .object({
    diagnosis: DiagnosisResultSchema
  })
  .strict();

export const SavedDiagnosisShareSchema = z.object({
  shareId: ShareIdSchema,
  createdAt: z.string().datetime(),
  category: DiagnosisResultSchema.shape.category,
  generatedBy: DiagnosisResultSchema.shape.generatedBy,
  title: z.string().min(1),
  summary: z.string().min(1),
  diagnosis: DiagnosisResultSchema
});

export type SavedDiagnosisShare = z.infer<typeof SavedDiagnosisShareSchema>;
