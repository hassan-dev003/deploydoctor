import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAgentIncidentReport, runInvestigation } from "@/lib/agent/runInvestigation";

// Bring-your-own-token agent mode: the caller supplies a Vercel personal access token that
// the investigation agent uses to fetch and verify evidence. The token is used transiently
// and is never stored, logged, or returned to the client.
const RequestSchema = z.object({
  accessToken: z.string().min(1),
  teamId: z.string().trim().min(1).optional(),
  deploymentId: z.string().trim().min(1).optional()
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with your Vercel access token." },
      { status: 400 }
    );
  }

  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A Vercel access token is required to run the investigation agent." },
      { status: 400 }
    );
  }

  const { accessToken, teamId, deploymentId } = parsed.data;

  try {
    const result = await runInvestigation({ accessToken, teamId, deploymentId });
    const incident = buildAgentIncidentReport(result);

    return NextResponse.json(incident);
  } catch {
    return NextResponse.json(
      {
        error:
          "The investigation agent could not complete with the provided token. Check the token and try again, or paste the build log instead."
      },
      { status: 502 }
    );
  }
}
