import { NextResponse } from "next/server";
import { saveIncidentShare } from "@/lib/incidents/shareRepository";
import { ShareIncidentRequestSchema } from "@/lib/incidents/shareSchema";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with an incident field." },
      { status: 400 }
    );
  }

  const parsed = ShareIncidentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Share requests may only include a valid incident." },
      { status: 400 }
    );
  }

  try {
    const saved = await saveIncidentShare(parsed.data.incident);
    const url = new URL(`/i/${saved.shareId}`, request.url).toString();

    return NextResponse.json({
      shareId: saved.shareId,
      url
    });
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { error: "DeployDoctor could not save this incident right now." },
      { status: 500 }
    );
  }
}
