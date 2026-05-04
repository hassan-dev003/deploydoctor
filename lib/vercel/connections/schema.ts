import { z } from "zod";

export const VercelConnectionStatusSchema = z.enum(["demo", "connected", "disabled"]);

export const VercelConnectionSchema = z.object({
  connectionId: z.string().regex(/^vc_[a-f0-9]{16}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  teamId: z.string().min(1).nullable(),
  userId: z.string().min(1).nullable(),
  projectId: z.string().min(1).nullable(),
  projectName: z.string().min(1).nullable(),
  accessTokenEncrypted: z.string().min(1).nullable(),
  refreshTokenEncrypted: z.string().min(1).nullable(),
  webhookId: z.string().min(1).nullable(),
  status: VercelConnectionStatusSchema
});

export type VercelConnection = z.infer<typeof VercelConnectionSchema>;
