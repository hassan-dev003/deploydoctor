import { describe, expect, it } from "vitest";
import { createVercelConnectionId, saveVercelConnection } from "@/lib/vercel/connections/repository";
import type { SqlExecutor } from "@/lib/share/shareRepository";

describe("Vercel connection repository", () => {
  it("generates connection IDs", () => {
    expect(createVercelConnectionId()).toMatch(/^vc_[a-f0-9]{16}$/);
  });

  it("saves demo connection metadata without requiring tokens", async () => {
    const executor: SqlExecutor = async (strings, ...values) => {
      if (strings.join("").includes("insert into vercel_connections")) {
        return {
          rows: [
            {
              connection_id: values[0],
              created_at: new Date("2026-05-04T00:00:00.000Z"),
              updated_at: new Date("2026-05-04T00:00:00.000Z"),
              team_id: values[1],
              user_id: values[2],
              project_id: values[3],
              project_name: values[4],
              access_token_encrypted: values[5],
              refresh_token_encrypted: values[6],
              webhook_id: values[7],
              status: values[8]
            }
          ]
        };
      }

      return { rows: [] };
    };

    const connection = await saveVercelConnection(
      {
        connectionId: "vc_0123456789abcdef",
        projectId: "prj_123",
        projectName: "deploydoctor"
      },
      executor
    );

    expect(connection).toMatchObject({
      connectionId: "vc_0123456789abcdef",
      projectId: "prj_123",
      projectName: "deploydoctor",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      status: "demo"
    });
  });
});
