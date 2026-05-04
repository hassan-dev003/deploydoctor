import { NextResponse } from "next/server";
import {
  assertVercelOAuthConfig,
  buildVercelAuthorizationUrl,
  createOAuthSession,
  VERCEL_OAUTH_COOKIE,
  VERCEL_OAUTH_COOKIE_MAX_AGE_SECONDS
} from "@/lib/vercel/oauth";

export async function GET() {
  try {
    const config = assertVercelOAuthConfig();
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
