import { z } from "zod";

export const DiagnosisCategorySchema = z.enum([
  "module_not_found",
  "typescript_error",
  "lint_error",
  "missing_env_var",
  "dependency_install_error",
  "build_command_error",
  "node_version_error",
  "unknown"
]);

export type DiagnosisCategory = z.infer<typeof DiagnosisCategorySchema>;

export const EvidenceLineSchema = z.object({
  lineNumber: z.number().int().positive().optional(),
  text: z.string().min(1)
});

export const DiagnosisResultSchema = z.object({
  category: DiagnosisCategorySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  rootCause: z.string().min(1),
  reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceLines: z.array(EvidenceLineSchema),
  fixSteps: z.array(z.string().min(1)),
  filesToCheck: z.array(z.string().min(1)),
  commands: z.array(z.string().min(1)),
  nextDiagnosticCommand: z.string().min(1),
  generatedBy: z.literal("mock"),
  analyzedAt: z.string().datetime()
});

export type EvidenceLine = z.infer<typeof EvidenceLineSchema>;
export type DiagnosisResult = z.infer<typeof DiagnosisResultSchema>;
