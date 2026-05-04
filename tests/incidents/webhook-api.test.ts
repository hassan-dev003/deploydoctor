import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/vercel/route";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";
import { processVercelDeploymentFailureWebhook } from "@/lib/vercel/incidentProcessor";
import { createVercelWebhookSignature } from "@/lib/vercel/signature";

vi.mock("@/lib/vercel/incidentProcessor", () => {
  return {
    processVercelDeploymentFailureWebhook: vi.fn()
  };
});

const mockedProcessWebhook = vi.mocked(processVercelDeploymentFailureWebhook);

describe("POST /api/webhooks/vercel", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockedProcessWebhook.mockReset();
  });

  it("stores deployment.error webhook metadata as a placeholder incident", async () => {
    mockedProcessWebhook.mockResolvedValueOnce({
      incidentId: "inc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: "needs_more_evidence",
      projectId: "prj_123",
      deploymentId: "dpl_123",
      deploymentUrl: "deploydoctor-preview.vercel.app",
      title: "Vercel deployment failed for deploydoctor",
      summary: "Stored metadata only.",
      incident: null,
      rawPayloadJson: null
    });

    const response = await POST(jsonRequest(vercelDeploymentErrorPayload()));
    const body = (await response.json()) as { status: string; incidentId: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "stored",
      incidentId: "inc_0123456789abcdef"
    });
    expect(mockedProcessWebhook).toHaveBeenCalledOnce();
    expect(mockedProcessWebhook.mock.calls[0]?.[0]).toMatchObject({
      type: "deployment.error",
      payload: {
        deployment: expect.objectContaining({
          id: "dpl_123",
          projectId: "prj_123"
        })
      }
    });
  });

  it("stores legacy deployment-error events", async () => {
    mockedProcessWebhook.mockResolvedValueOnce({
      incidentId: "inc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: "needs_more_evidence",
      projectId: null,
      deploymentId: null,
      deploymentUrl: null,
      title: "Vercel deployment failed",
      summary: "Stored metadata only.",
      incident: null,
      rawPayloadJson: null
    });

    const response = await POST(
      jsonRequest({
        ...vercelDeploymentErrorPayload(),
        type: "deployment-error"
      })
    );

    expect(response.status).toBe(200);
    expect(mockedProcessWebhook).toHaveBeenCalledOnce();
  });

  it("ignores unrelated webhook events", async () => {
    const response = await POST(
      jsonRequest({
        ...vercelDeploymentErrorPayload(),
        type: "deployment.ready"
      })
    );
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ status: "ignored" });
    expect(mockedProcessWebhook).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(jsonRequest({ type: "deployment.error" }));

    expect(response.status).toBe(400);
    expect(mockedProcessWebhook).not.toHaveBeenCalled();
  });

  it("does not require raw log fields", async () => {
    mockedProcessWebhook.mockResolvedValueOnce({
      incidentId: "inc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: "needs_more_evidence",
      projectId: "prj_123",
      deploymentId: "dpl_123",
      deploymentUrl: null,
      title: "Vercel deployment failed",
      summary: "Stored metadata only.",
      incident: null,
      rawPayloadJson: null
    });

    const payload = vercelDeploymentErrorPayload();
    delete (payload.payload.deployment as { log?: string }).log;

    const response = await POST(jsonRequest(payload));

    expect(response.status).toBe(200);
    expect(mockedProcessWebhook).toHaveBeenCalledOnce();
  });

  it("rejects invalid signatures when a webhook secret is configured", async () => {
    vi.stubEnv("VERCEL_WEBHOOK_SECRET", "webhook-secret");

    const response = await POST(
      jsonRequest(vercelDeploymentErrorPayload(), {
        "x-vercel-signature": "invalid"
      })
    );

    expect(response.status).toBe(401);
    expect(mockedProcessWebhook).not.toHaveBeenCalled();
  });

  it("accepts valid signatures when a webhook secret is configured", async () => {
    vi.stubEnv("VERCEL_WEBHOOK_SECRET", "webhook-secret");
    mockedProcessWebhook.mockResolvedValueOnce({
      incidentId: "inc_0123456789abcdef",
      createdAt: "2026-05-04T00:00:00.000Z",
      sourceType: "vercel_webhook",
      status: "needs_more_evidence",
      projectId: "prj_123",
      deploymentId: "dpl_123",
      deploymentUrl: null,
      title: "Vercel deployment failed",
      summary: "Stored metadata only.",
      incident: null,
      rawPayloadJson: null
    });
    const body = JSON.stringify(vercelDeploymentErrorPayload());

    const response = await POST(
      new Request("http://localhost/api/webhooks/vercel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-vercel-signature": createVercelWebhookSignature(body, "webhook-secret")
        },
        body
      })
    );

    expect(response.status).toBe(200);
    expect(mockedProcessWebhook).toHaveBeenCalledOnce();
  });

  it("returns 503 when storage is unavailable for recognized failures", async () => {
    mockedProcessWebhook.mockRejectedValueOnce(new ShareDatabaseUnavailableError());

    const response = await POST(jsonRequest(vercelDeploymentErrorPayload()));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(503);
    expect(body.error).toContain("saved report links");
  });
});

function vercelDeploymentErrorPayload() {
  return {
    id: "evt_123",
    type: "deployment.error",
    createdAt: "2026-05-04T00:00:00.000Z",
    region: "iad1",
    payload: {
      deployment: {
        id: "dpl_123",
        url: "deploydoctor-preview.vercel.app",
        projectId: "prj_123",
        log: "SECRET_TOKEN=sk_test_abcdefghijklmnopqrstuvwxyz"
      },
      project: {
        id: "prj_123",
        name: "deploydoctor"
      }
    }
  };
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/webhooks/vercel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}
