import { createHash, createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import { constantTimeEqual } from "@/lib/security/tokenCrypto";
import { createVercelConnectionId } from "./connections/repository";

export const VERCEL_OAUTH_COOKIE = "deploydoctor_vercel_oauth";
export const VERCEL_OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

const OAuthCookiePayloadSchema = z.object({
  state: z.string().min(24),
  nonce: z.string().min(24),
  codeVerifier: z.string().min(43),
  connectionId: z.string().regex(/^vc_[a-f0-9]{16}$/),
  createdAt: z.number()
});

const OAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional()
});

export type VercelOAuthCookiePayload = z.infer<typeof OAuthCookiePayloadSchema>;
export type VercelOAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;

export function getVercelOAuthConfig(env = process.env) {
  return {
    clientId: env.VERCEL_CLIENT_ID,
    clientSecret: env.VERCEL_CLIENT_SECRET,
    redirectUri: env.VERCEL_REDIRECT_URI
  };
}

export function assertVercelOAuthConfig(env = process.env) {
  const config = getVercelOAuthConfig(env);

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(
      "Set VERCEL_CLIENT_ID, VERCEL_CLIENT_SECRET, and VERCEL_REDIRECT_URI before connecting Vercel."
    );
  }

  return config as { clientId: string; clientSecret: string; redirectUri: string };
}

// Vercel integration client IDs are issued as `oac_...` values in the integration's
// Credentials tab. Catch placeholder or wrong values before redirecting the user to
// Vercel, where an invalid id surfaces only as a cryptic "The app ID is invalid" page.
export function isConfiguredVercelClientId(clientId: string | undefined): boolean {
  return typeof clientId === "string" && /^oac_[A-Za-z0-9]+$/.test(clientId);
}

export function createOAuthSession(secret: string): {
  payload: VercelOAuthCookiePayload;
  cookieValue: string;
  authorizationParams: URLSearchParams;
} {
  const payload = {
    state: randomToken(24),
    nonce: randomToken(24),
    codeVerifier: randomToken(64),
    connectionId: createVercelConnectionId(),
    createdAt: Date.now()
  };
  const codeChallenge = createCodeChallenge(payload.codeVerifier);

  return {
    payload,
    cookieValue: signOAuthCookiePayload(payload, secret),
    authorizationParams: new URLSearchParams({
      response_type: "code",
      state: payload.state,
      nonce: payload.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: "openid email profile offline_access"
    })
  };
}

export function buildVercelAuthorizationUrl(options: {
  clientId: string;
  redirectUri: string;
  authorizationParams: URLSearchParams;
}): string {
  const params = new URLSearchParams(options.authorizationParams);
  params.set("client_id", options.clientId);
  params.set("redirect_uri", options.redirectUri);

  return `https://vercel.com/oauth/authorize?${params.toString()}`;
}

export function parseOAuthCookie(value: string, secret: string): VercelOAuthCookiePayload {
  const [payloadEncoded, signature] = value.split(".");

  if (!payloadEncoded || !signature) {
    throw new Error("Invalid OAuth state cookie.");
  }

  const expectedSignature = signPayload(payloadEncoded, secret);

  if (!constantTimeEqual(signature, expectedSignature)) {
    throw new Error("Invalid OAuth state cookie signature.");
  }

  const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
  const parsed = OAuthCookiePayloadSchema.parse(payload);
  const ageMs = Date.now() - parsed.createdAt;

  if (ageMs > VERCEL_OAUTH_COOKIE_MAX_AGE_SECONDS * 1000) {
    throw new Error("OAuth state expired.");
  }

  return parsed;
}

export function validateOAuthState(queryState: string | null, cookiePayload: VercelOAuthCookiePayload) {
  if (!queryState || !constantTimeEqual(queryState, cookiePayload.state)) {
    throw new Error("Invalid OAuth state.");
  }
}

export async function exchangeOAuthCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
  fetcher?: typeof fetch;
}): Promise<VercelOAuthTokenResponse> {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      redirect_uri: options.redirectUri,
      code_verifier: options.codeVerifier
    })
  });

  if (!response.ok) {
    throw new Error("Vercel OAuth token exchange failed.");
  }

  return OAuthTokenResponseSchema.parse(await response.json());
}

function signOAuthCookiePayload(payload: VercelOAuthCookiePayload, secret: string): string {
  const payloadEncoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadEncoded}.${signPayload(payloadEncoded, secret)}`;
}

function signPayload(payloadEncoded: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadEncoded).digest("base64url");
}

function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}
