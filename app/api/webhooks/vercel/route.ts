import { NextResponse } from "next/server";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";
import { processVercelDeploymentFailureWebhook } from "@/lib/vercel/incidentProcessor";
import { verifyVercelWebhookSignature } from "@/lib/vercel/signature";
import {
  isVercelDeploymentFailure,
  VercelWebhookPayloadSchema
} from "@/lib/vercel/webhook";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (
    !verifyVercelWebhookSignature({
      rawBody,
      signature: request.headers.get("x-vercel-signature")
    })
  ) {
    return NextResponse.json({ error: "Invalid Vercel webhook signature." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = JSON.parse(rawBody);
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
    const incident = await processVercelDeploymentFailureWebhook(parsed.data);

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
