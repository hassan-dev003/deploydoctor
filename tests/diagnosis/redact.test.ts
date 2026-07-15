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

  it("still redacts long high-entropy mixed tokens", () => {
    const output = redactSecrets("blob a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0 end");

    expect(output).toBe("blob [REDACTED_SECRET] end");
  });

  it("preserves git commit SHAs and content hashes as evidence", () => {
    const sha1 = "9f2c3a1b4d5e6f708192a3b4c5d6e7f8091a2b3c";
    const sha256 = "a".repeat(64);

    expect(redactSecrets(`Deploying commit ${sha1}`)).toBe(`Deploying commit ${sha1}`);
    expect(redactSecrets(`integrity ${sha256}`)).toBe(`integrity ${sha256}`);
  });

  it("preserves long identifiers that are not high-entropy secrets", () => {
    const moduleName = "abcdefghijklmnopqrstuvwxyzabcdefghijklmn";

    expect(redactSecrets(`Cannot find module ${moduleName}`)).toBe(
      `Cannot find module ${moduleName}`
    );
  });
});
