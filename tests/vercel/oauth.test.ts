import { describe, expect, it } from "vitest";
import {
  buildVercelAuthorizationUrl,
  createOAuthSession,
  isConfiguredVercelClientId,
  parseOAuthCookie,
  validateOAuthState
} from "@/lib/vercel/oauth";

describe("Vercel OAuth helpers", () => {
  it("creates a signed OAuth session and authorization URL", () => {
    const session = createOAuthSession("client-secret");
    const parsed = parseOAuthCookie(session.cookieValue, "client-secret");
    const url = buildVercelAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "https://deploydoctor.test/api/vercel/oauth/callback",
      authorizationParams: session.authorizationParams
    });

    expect(parsed.state).toBe(session.payload.state);
    expect(url).toContain("https://vercel.com/oauth/authorize?");
    expect(url).toContain("client_id=client-id");
    expect(url).toContain("code_challenge_method=S256");
  });

  it("rejects invalid state values", () => {
    const session = createOAuthSession("client-secret");
    const parsed = parseOAuthCookie(session.cookieValue, "client-secret");

    expect(() => validateOAuthState("wrong-state", parsed)).toThrow("Invalid OAuth state.");
  });

  it("rejects cookies signed with a different secret", () => {
    const session = createOAuthSession("client-secret");

    expect(() => parseOAuthCookie(session.cookieValue, "other-secret")).toThrow();
  });

  it("recognizes real integration client IDs and rejects placeholders", () => {
    expect(isConfiguredVercelClientId("oac_xurffZSa0MZTj5SARZ5XFg7b")).toBe(true);
    expect(isConfiguredVercelClientId("your_oauth_client_id")).toBe(false);
    expect(isConfiguredVercelClientId("client-id")).toBe(false);
    expect(isConfiguredVercelClientId("")).toBe(false);
    expect(isConfiguredVercelClientId(undefined)).toBe(false);
  });
});
