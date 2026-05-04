import { createHmac } from "node:crypto";
import { constantTimeEqual } from "@/lib/security/tokenCrypto";

export function createVercelWebhookSignature(rawBody: string, secret: string): string {
  return createHmac("sha1", secret).update(rawBody).digest("hex");
}

export function verifyVercelWebhookSignature(options: {
  rawBody: string;
  signature: string | null;
  secret?: string;
  nodeEnv?: string;
}): boolean {
  const secret = options.secret ?? process.env.VERCEL_WEBHOOK_SECRET;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (!secret) {
    return nodeEnv === "development" || nodeEnv === "test";
  }

  if (!options.signature) {
    return false;
  }

  return constantTimeEqual(options.signature, createVercelWebhookSignature(options.rawBody, secret));
}
