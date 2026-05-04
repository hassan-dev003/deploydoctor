import type { EvidenceLine } from "./schema";

const PRIVATE_KEY_BLOCK =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi;
const API_KEY_LIKE =
  /\b(?:sk|pk|rk|ghp|gho|ghu|ghs|github_pat|vercel)_[A-Za-z0-9_=-]{12,}\b/g;
const LONG_SECRET = /\b[A-Za-z0-9+/=_-]{32,}\b/g;
const URL_SECRET_PARAM =
  /([?&](?:access_token|auth|code|key|password|secret|token)=)[^&\s]+/gi;
const ENV_SECRET_ASSIGNMENT =
  /^(\s*(?:[A-Z0-9_]*(?:API_KEY|AUTH|DATABASE_URL|KEY|PASSWORD|SECRET|TOKEN|WEBHOOK)[A-Z0-9_]*|JWT|NPM_TOKEN)\s*=\s*)(.+)$/gim;

export function redactSecrets(input: string): string {
  return input
    .replace(PRIVATE_KEY_BLOCK, "[REDACTED_PRIVATE_KEY]")
    .replace(ENV_SECRET_ASSIGNMENT, "$1[REDACTED]")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]")
    .replace(URL_SECRET_PARAM, "$1[REDACTED]")
    .replace(API_KEY_LIKE, "[REDACTED_SECRET]")
    .replace(LONG_SECRET, (match) => {
      if (/^[a-f0-9]{40}$/i.test(match)) {
        return match;
      }

      return "[REDACTED_SECRET]";
    });
}

export function toSanitizedEvidenceLines(
  rawLog: string,
  predicate: (line: string) => boolean,
  limit = 4
): EvidenceLine[] {
  return rawLog
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: redactSecrets(line).trim() }))
    .filter((line) => line.text.length > 0 && predicate(line.text))
    .slice(0, limit);
}

export function firstSanitizedLines(rawLog: string, limit = 4): EvidenceLine[] {
  return rawLog
    .split(/\r?\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: redactSecrets(line).trim() }))
    .filter((line) => line.text.length > 0)
    .slice(0, limit);
}
