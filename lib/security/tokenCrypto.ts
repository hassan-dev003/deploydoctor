import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const TOKEN_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class TokenEncryptionKeyError extends Error {
  constructor(message = "TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.") {
    super(message);
    this.name = "TokenEncryptionKeyError";
  }
}

export function encryptToken(plainText: string, key = process.env.TOKEN_ENCRYPTION_KEY): string {
  const normalizedKey = normalizeTokenKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", normalizedKey, iv, {
    authTagLength: TAG_BYTES
  });
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

export function decryptToken(encryptedToken: string, key = process.env.TOKEN_ENCRYPTION_KEY): string {
  const normalizedKey = normalizeTokenKey(key);
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = encryptedToken.split(":");

  if (version !== TOKEN_VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error("Unsupported encrypted token format.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const encrypted = Buffer.from(encryptedEncoded, "base64url");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Invalid encrypted token payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", normalizedKey, iv, {
    authTagLength: TAG_BYTES
  });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function normalizeTokenKey(key: string | undefined): Buffer {
  if (!key) {
    throw new TokenEncryptionKeyError();
  }

  const decoded = Buffer.from(key, "base64");

  if (decoded.length !== KEY_BYTES) {
    throw new TokenEncryptionKeyError();
  }

  return decoded;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
