import { NextResponse } from "next/server";
import { saveStoredIncident } from "@/lib/incidents/storageRepository";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";
import {
  isVercelDeploymentFailure,
  VercelWebhookPayloadSchema,
  webhookToStoredIncidentInput
} from "@/lib/vercel/webhook";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid Vercel webhook JSON payload." }, { status: 400 });
  }

  const parsed = VercelWebhookPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Vercel webhook payload." }, { status: 400 });
  }

  if (!isVercelDeploymentFailure(parsed.data)) {
    return NextResponse.json({ status: "ignored" }, { status: 202 });
  }

  try {
    const incident = await saveStoredIncident(webhookToStoredIncidentInput(parsed.data));

    return NextResponse.json({
      status: "stored",
      incidentId: incident.incidentId
    });
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { error: "DeployDoctor could not store this Vercel incident." },
      { status: 500 }
    );
  }
}
