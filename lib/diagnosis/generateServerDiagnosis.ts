import { generateCerebrasDiagnosis } from "./generateCerebrasDiagnosis";
import { generateMockDiagnosis } from "./generateMockDiagnosis";
import { redactSecrets } from "./redact";
import type { DiagnosisResult } from "./schema";

type GenerateServerDiagnosisOptions = {
  apiKey?: string;
  cerebrasDiagnosis?: (sanitizedLog: string) => Promise<DiagnosisResult>;
};

export async function generateServerDiagnosis(
  rawLog: string,
  options: GenerateServerDiagnosisOptions = {}
): Promise<DiagnosisResult> {
  const sanitizedLog = redactSecrets(rawLog);
  const apiKey = options.apiKey ?? process.env.CEREBRAS_API_KEY;

  if (!apiKey) {
    return generateMockDiagnosis(sanitizedLog);
  }

  try {
    if (options.cerebrasDiagnosis) {
      return await options.cerebrasDiagnosis(sanitizedLog);
    }

    return await generateCerebrasDiagnosis({ sanitizedLog, apiKey });
  } catch {
    return generateMockDiagnosis(sanitizedLog);
  }
}
