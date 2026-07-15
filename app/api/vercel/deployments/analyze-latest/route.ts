import { NextResponse } from "next/server";
import { z } from "zod";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";
import {
  deploymentEventsToSanitizedLog,
  findLatestFailedDeployment,
  getDeploymentEvents,
  listDeployments
} from "@/lib/vercel/api";

// Bring-your-own-token connected mode: the caller supplies a Vercel personal
// access token that is used only to fetch their latest failed deployment's events.
// The token is never stored, logged, or returned to the client.
const RequestSchema = z.object({
  accessToken: z.string().min(1),
  teamId: z.string().trim().min(1).optional()
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
      { error: "A Vercel access token is required to fetch your latest failed deployment." },
      { status: 400 }
    );
  }

  const { accessToken, teamId } = parsed.data;

  try {
    const deployments = await listDeployments({ accessToken, teamId, limit: 30 });
    const failed = findLatestFailedDeployment(deployments);

    if (!failed) {
      return NextResponse.json(
        {
          error:
            "No failed deployments were found for this token. Paste a build log instead, or point the token at a project with a recent failed deployment."
        },
        { status: 404 }
      );
    }

    const deploymentId = failed.uid ?? failed.id;

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Vercel did not return a deployment id to inspect." },
        { status: 502 }
      );
    }

    const events = await getDeploymentEvents(deploymentId, { accessToken, teamId });
    const sanitizedLog = deploymentEventsToSanitizedLog(events);

    if (!sanitizedLog.trim()) {
      return NextResponse.json(
        {
          error:
            "The failed deployment did not expose enough log text to analyze. Paste the build log instead."
        },
        { status: 422 }
      );
    }

    const diagnosis = await generateServerDiagnosis(sanitizedLog);
    const incident = generateIncidentReport(diagnosis, undefined, { sourceType: "vercel_api" });

    return NextResponse.json(incident);
  } catch {
    return NextResponse.json(
      {
        error:
          "DeployDoctor could not fetch a deployment with the provided token. Check that the token is valid and try again."
      },
      { status: 502 }
    );
  }
}
