import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/vercel/oauth/callback/route";
import { createOAuthSession, VERCEL_OAUTH_COOKIE } from "@/lib/vercel/oauth";

describe("GET /api/vercel/oauth/callback", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_CLIENT_ID", "client-id");
    vi.stubEnv("VERCEL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("VERCEL_REDIRECT_URI", "http://localhost/api/vercel/oauth/callback");
  });

  it("rejects invalid OAuth state", async () => {
    const session = createOAuthSession("client-secret");
    const request = new NextRequest(
      "http://localhost/api/vercel/oauth/callback?code=code-123&state=wrong-state",
      {
        headers: {
          cookie: `${VERCEL_OAUTH_COOKIE}=${session.cookieValue}`
        }
      }
    );

    const response = await GET(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid OAuth state");
  });
});
