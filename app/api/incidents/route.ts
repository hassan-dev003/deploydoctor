import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";
import { generateIncidentReport } from "@/lib/incidents/generateIncidentReport";

const IncidentRequestSchema = z.object({
  log: z
    .string()
    .trim()
    .min(1, "Paste deployment logs before running an incident analysis.")
    .max(MAX_LOG_CHARS, oversizedLogMessage)
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a log field." }, { status: 400 });
  }

  const parsed = IncidentRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid incident request." },
      { status: 400 }
    );
  }

  const diagnosis = await generateServerDiagnosis(parsed.data.log);
  const incident = generateIncidentReport(diagnosis);

  return NextResponse.json(incident);
}
