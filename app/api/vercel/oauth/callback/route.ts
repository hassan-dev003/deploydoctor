import { NextRequest, NextResponse } from "next/server";
import { encryptToken, TokenEncryptionKeyError } from "@/lib/security/tokenCrypto";
import { upsertVercelConnection } from "@/lib/vercel/connections/repository";
import {
  assertVercelOAuthConfig,
  exchangeOAuthCode,
  parseOAuthCookie,
  validateOAuthState,
  VERCEL_OAUTH_COOKIE
} from "@/lib/vercel/oauth";

export async function GET(request: NextRequest) {
  const redirectUrl = new URL("/incidents", request.url);

  try {
    const config = assertVercelOAuthConfig();
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Missing Vercel OAuth code." }, { status: 400 });
    }

    const cookieValue = request.cookies.get(VERCEL_OAUTH_COOKIE)?.value;

    if (!cookieValue) {
      return NextResponse.json({ error: "Missing Vercel OAuth state cookie." }, { status: 400 });
    }

    const session = parseOAuthCookie(cookieValue, config.clientSecret);
    validateOAuthState(request.nextUrl.searchParams.get("state"), session);

    const tokenResponse = await exchangeOAuthCode({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      codeVerifier: session.codeVerifier
    });

    await upsertVercelConnection({
      connectionId: session.connectionId,
      teamId: request.nextUrl.searchParams.get("teamId"),
      userId: request.nextUrl.searchParams.get("userId"),
      projectId: request.nextUrl.searchParams.get("projectId"),
      projectName: request.nextUrl.searchParams.get("projectName"),
      accessTokenEncrypted: encryptToken(tokenResponse.access_token),
      refreshTokenEncrypted: tokenResponse.refresh_token
        ? encryptToken(tokenResponse.refresh_token)
        : null,
      status: "connected"
    });

    redirectUrl.searchParams.set("connected", "1");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(VERCEL_OAUTH_COOKIE);

    return response;
  } catch (error) {
    if (error instanceof TokenEncryptionKeyError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "DeployDoctor could not complete Vercel authorization."
      },
      { status: 400 }
    );
  }
}
