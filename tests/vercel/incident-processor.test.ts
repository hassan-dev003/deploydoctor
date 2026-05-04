import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import {
  saveStoredIncident,
  updateStoredIncidentAnalysis
} from "@/lib/incidents/storageRepository";
import { encryptToken } from "@/lib/security/tokenCrypto";
import { findConnectedVercelConnectionForProject } from "@/lib/vercel/connections/repository";
import { processVercelDeploymentFailureWebhook } from "@/lib/vercel/incidentProcessor";

vi.mock("@/lib/incidents/storageRepository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/incidents/storageRepository")>(
    "@/lib/incidents/storageRepository"
  );

  return {
    ...actual,
    saveStoredIncident: vi.fn(),
    updateStoredIncidentAnalysis: vi.fn()
  };
});

vi.mock("@/lib/vercel/connections/repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/vercel/connections/repository")>(
    "@/lib/vercel/connections/repository"
  );

  return {
    ...actual,
    findConnectedVercelConnectionForProject: vi.fn()
  };
});

vi.mock("@/lib/diagnosis/generateServerDiagnosis", () => ({
  generateServerDiagnosis: vi.fn()
}));

const mockedSaveStoredIncident = vi.mocked(saveStoredIncident);
const mockedUpdateStoredIncidentAnalysis = vi.mocked(updateStoredIncidentAnalysis);
const mockedFindConnection = vi.mocked(findConnectedVercelConnectionForProject);
const mockedGenerateServerDiagnosis = vi.mocked(generateServerDiagnosis);

describe("Vercel incident processor", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    mockedSaveStoredIncident.mockReset();
    mockedUpdateStoredIncidentAnalysis.mockReset();
    mockedFindConnection.mockReset();
    mockedGenerateServerDiagnosis.mockReset();

    mockedSaveStoredIncident.mockResolvedValue({
      incidentId: "inc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: "needs_more_evidence",
      projectId: "prj_123",
      deploymentId: "dpl_123",
      deploymentUrl: "deploydoctor-preview.vercel.app",
      title: "Vercel deployment failed for deploydoctor",
      summary: "Authorization is required.",
      incident: null,
      rawPayloadJson: null
    });
  });

  it("keeps a metadata-only incident when no matching connection exists", async () => {
    mockedFindConnection.mockResolvedValueOnce(null);

    const incident = await processVercelDeploymentFailureWebhook(vercelDeploymentErrorPayload());

    expect(incident.incident).toBeNull();
    expect(mockedUpdateStoredIncidentAnalysis).not.toHaveBeenCalled();
  });

  it("fetches authorized events and stores a sanitized incident report", async () => {
    mockedFindConnection.mockResolvedValueOnce({
      connectionId: "vc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
      teamId: null,
      userId: null,
      projectId: "prj_123",
      projectName: "deploydoctor",
      accessTokenEncrypted: encryptToken("vercel-access-token"),
      refreshTokenEncrypted: null,
      webhookId: null,
      status: "connected"
    });
    mockedGenerateServerDiagnosis.mockResolvedValueOnce({
      category: "missing_env_var",
      confidence: 0.91,
      title: "Missing environment variable",
      summary: "Production build failed because DATABASE_URL is missing.",
      rootCause: "The deployment could not read a required environment variable.",
      reasoning: "The Vercel event explicitly reports a missing production environment variable.",
      evidenceLines: [
        {
          lineNumber: 1,
          text: "Error: Environment Variable \"DATABASE_URL\" references Secret \"database_url\", which does not exist."
        }
      ],
      fixSteps: ["Add DATABASE_URL in Vercel Production environment variables."],
      commands: ["vercel env ls production"],
      filesToCheck: ["Vercel Project Settings"],
      nextDiagnosticCommand: "vercel env ls production",
      generatedBy: "mock",
      analyzedAt: "2026-05-04T00:00:00.000Z"
    });
    mockedUpdateStoredIncidentAnalysis.mockImplementationOnce(async (input) => ({
      incidentId: input.incidentId,
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: input.status,
      projectId: "prj_123",
      deploymentId: "dpl_123",
      deploymentUrl: "deploydoctor-preview.vercel.app",
      title: input.title,
      summary: input.summary,
      incident: input.incident,
      rawPayloadJson: null
    }));

    const incident = await processVercelDeploymentFailureWebhook(vercelDeploymentErrorPayload(), {
      fetchDeploymentEvents: vi.fn(async () => [
        {
          type: "stdout",
          text: "Error: Environment Variable \"DATABASE_URL\" references Secret \"database_url\", which does not exist. TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz"
        }
      ])
    });
    const updateInput = mockedUpdateStoredIncidentAnalysis.mock.calls[0]?.[0];

    expect(incident.incident?.sourceType).toBe("vercel_webhook");
    expect(mockedGenerateServerDiagnosis.mock.calls[0]?.[0]).not.toContain(
      "sk_test_abcdefghijklmnopqrstuvwxyz"
    );
    expect(JSON.stringify(updateInput)).not.toContain("sk_test_abcdefghijklmnopqrstuvwxyz");
  });
});

function vercelDeploymentErrorPayload() {
  return {
    id: "evt_123",
    type: "deployment.error",
    createdAt: "2026-05-04T00:00:00.000Z",
    payload: {
      deployment: {
        id: "dpl_123",
        url: "deploydoctor-preview.vercel.app",
        projectId: "prj_123"
      },
      project: {
        id: "prj_123",
        name: "deploydoctor"
      }
    }
  };
}
