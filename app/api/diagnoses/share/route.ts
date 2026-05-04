import { NextResponse } from "next/server";
import { saveDiagnosisShare, ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";
import { ShareDiagnosisRequestSchema } from "@/lib/share/shareSchema";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with a diagnosis field." },
      { status: 400 }
    );
  }

  const parsed = ShareDiagnosisRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Share requests may only include a valid diagnosis." },
      { status: 400 }
    );
  }

  try {
    const saved = await saveDiagnosisShare(parsed.data.diagnosis);
    const url = new URL(`/d/${saved.shareId}`, request.url).toString();

    return NextResponse.json({
      shareId: saved.shareId,
      url
    });
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json(
      { error: "DeployDoctor could not save this diagnosis right now." },
      { status: 500 }
    );
  }
}
