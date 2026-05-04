import type { DiagnosisResult } from "@/lib/diagnosis/schema";

export type ShareDiagnosisResponse = {
  shareId: string;
  url: string;
};

export async function saveDiagnosisForSharing(
  diagnosis: DiagnosisResult
): Promise<ShareDiagnosisResponse> {
  const response = await fetch("/api/diagnoses/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ diagnosis })
  });

  if (!response.ok) {
    const error = await readErrorMessage(response);
    throw new Error(error);
  }

  return (await response.json()) as ShareDiagnosisResponse;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Fall through to generic message.
  }

  return "DeployDoctor could not create a share link.";
}
