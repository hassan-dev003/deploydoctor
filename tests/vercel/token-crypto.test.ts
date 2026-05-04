import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/security/tokenCrypto";

describe("token crypto", () => {
  it("encrypts and decrypts tokens", () => {
    const key = randomBytes(32).toString("base64");
    const encrypted = encryptToken("vercel-access-token", key);

    expect(encrypted).not.toContain("vercel-access-token");
    expect(decryptToken(encrypted, key)).toBe("vercel-access-token");
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptToken("vercel-access-token", randomBytes(32).toString("base64"));

    expect(() => decryptToken(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });
});
