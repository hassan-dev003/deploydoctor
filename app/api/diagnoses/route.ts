import { NextResponse } from "next/server";
import { z } from "zod";
import { MAX_LOG_CHARS, oversizedLogMessage } from "@/lib/diagnosis/constants";
import { generateServerDiagnosis } from "@/lib/diagnosis/generateServerDiagnosis";

const DiagnoseRequestSchema = z.object({
  log: z
    .string()
    .trim()
    .min(1, "Paste deployment logs before running a diagnosis.")
    .max(MAX_LOG_CHARS, oversizedLogMessage)
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a log field." }, { status: 400 });
  }

  const parsed = DiagnoseRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid diagnosis request." },
      { status: 400 }
    );
  }

  const diagnosis = await generateServerDiagnosis(parsed.data.log);

  return NextResponse.json(diagnosis);
}
