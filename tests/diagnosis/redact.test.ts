import { describe, expect, it } from "vitest";
import { redactSecrets } from "@/lib/diagnosis/redact";

describe("redactSecrets", () => {
  it("redacts env assignments with secret-like names", () => {
    const output = redactSecrets("OPENAI_API_KEY=sk_test_abcdefghijklmnopqrstuvwxyz");

    expect(output).toBe("OPENAI_API_KEY=[REDACTED]");
  });

  it("redacts bearer tokens", () => {
    const output = redactSecrets("Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456");

    expect(output).toBe("Authorization: Bearer [REDACTED]");
  });

  it("redacts secret URL parameters", () => {
    const output = redactSecrets("https://example.com/callback?token=secret-token-123&next=/app");

    expect(output).toBe("https://example.com/callback?token=[REDACTED]&next=/app");
  });

  it("redacts private key blocks", () => {
    const output = redactSecrets(`-----BEGIN PRIVATE KEY-----
abc123
-----END PRIVATE KEY-----`);

    expect(output).toBe("[REDACTED_PRIVATE_KEY]");
  });
});
