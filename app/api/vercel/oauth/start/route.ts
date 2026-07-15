import { NextResponse } from "next/server";
import {
  assertVercelOAuthConfig,
  buildVercelAuthorizationUrl,
  createOAuthSession,
  isConfiguredVercelClientId,
  VERCEL_OAUTH_COOKIE,
  VERCEL_OAUTH_COOKIE_MAX_AGE_SECONDS
} from "@/lib/vercel/oauth";

export async function GET() {
  try {
    const config = assertVercelOAuthConfig();

    if (!isConfiguredVercelClientId(config.clientId)) {
      return NextResponse.json(
        {
          error:
            "VERCEL_CLIENT_ID is not a valid Vercel integration Client ID. Copy the \"oac_...\" value from your integration's Credentials tab into VERCEL_CLIENT_ID and redeploy before connecting."
        },
        { status: 500 }
      );
    }

    const session = createOAuthSession(config.clientSecret);
    const redirectUrl = buildVercelAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      authorizationParams: session.authorizationParams
    });
    const response = NextResponse.redirect(redirectUrl);

    response.cookies.set(VERCEL_OAUTH_COOKIE, session.cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: VERCEL_OAUTH_COOKIE_MAX_AGE_SECONDS,
      path: "/"
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "DeployDoctor could not start Vercel authorization."
      },
      { status: 500 }
    );
  }
}
