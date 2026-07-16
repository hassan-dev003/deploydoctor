import { z } from "zod";
import { buildAgentIncidentReport, runInvestigation } from "@/lib/agent/runInvestigation";
import type { AgentStep } from "@/lib/agent/types";

// Streaming variant of the investigation agent. It emits each investigation step as a
// Server-Sent Event as the agent works, then a final `report` event. The Vercel access
// token is used transiently and never stored, logged, or returned.
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
    return jsonError("Send a JSON body with your Vercel access token.", 400);
  }

  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("A Vercel access token is required to run the investigation agent.", 400);
  }

  const { accessToken, teamId, deploymentId } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await runInvestigation({
          accessToken,
          teamId,
          deploymentId,
          onStep: (step: AgentStep) => send("step", step)
        });

        send("report", buildAgentIncidentReport(result));
      } catch {
        send("error", {
          error:
            "The investigation agent could not complete with the provided token. Check the token and try again, or paste the build log instead."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
