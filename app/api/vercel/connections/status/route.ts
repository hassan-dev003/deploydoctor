import { NextResponse } from "next/server";
import { ShareDatabaseUnavailableError } from "@/lib/share/shareRepository";
import { listVercelConnections } from "@/lib/vercel/connections/repository";

export async function GET() {
  try {
    const connections = await listVercelConnections();
    const connected = connections.find((connection) => connection.status === "connected");
    const demo = connections.find((connection) => connection.status === "demo");
    const current = connected ?? demo ?? null;

    return NextResponse.json({
      configured: true,
      status: current?.status ?? "not_connected",
      projectName: current?.projectName,
      projectId: current?.projectId,
      hasToken: Boolean(current?.accessTokenEncrypted)
    });
  } catch (error) {
    if (error instanceof ShareDatabaseUnavailableError) {
      return NextResponse.json({
        configured: false,
        status: "not_connected",
        hasToken: false
      });
    }

    return NextResponse.json(
      { error: "DeployDoctor could not read Vercel connection status." },
      { status: 500 }
    );
  }
}
