import { generateMockDiagnosis } from "./generateMockDiagnosis";
import { generateOpenAIDiagnosis } from "./generateOpenAIDiagnosis";
import { redactSecrets } from "./redact";
import type { DiagnosisResult } from "./schema";

type GenerateServerDiagnosisOptions = {
  apiKey?: string;
  openAIDiagnosis?: (sanitizedLog: string) => Promise<DiagnosisResult>;
};

export async function generateServerDiagnosis(
  rawLog: string,
  options: GenerateServerDiagnosisOptions = {}
): Promise<DiagnosisResult> {
  const sanitizedLog = redactSecrets(rawLog);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return generateMockDiagnosis(sanitizedLog);
  }

  try {
    if (options.openAIDiagnosis) {
      return await options.openAIDiagnosis(sanitizedLog);
    }

    return await generateOpenAIDiagnosis({ sanitizedLog, apiKey });
  } catch {
    return generateMockDiagnosis(sanitizedLog);
  }
}
