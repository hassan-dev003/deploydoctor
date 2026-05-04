import { generateMockDiagnosis } from "./generateMockDiagnosis";
import type { DiagnosisResult } from "./schema";

export async function analyzePastedLog(rawLog: string): Promise<DiagnosisResult> {
  // Milestone 1 deliberately stays local. Milestone 2 can replace this body
  // with a server/API call that returns the same DiagnosisResult contract.
  return generateMockDiagnosis(rawLog);
}
