/**
 * JWT signing key.
 *
 * Deliberately fails closed: with no `JWT_SECRET` configured the POS refuses to issue
 * or accept sessions rather than falling back to a key that is published in this
 * repository, which would let anyone forge an ADMIN token against any installation.
 *
 * Edge-safe - imported by middleware, so it must not touch Node-only APIs.
 */

const MIN_SECRET_LENGTH = 32;

let cached: Uint8Array | null = null;

export class MissingSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingSecretError";
  }
}

export function getSecretKey(): Uint8Array {
  if (cached) return cached;

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new MissingSecretError(
      "JWT_SECRET is not set. Copy .env.example to .env and set a unique random value " +
        "(generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")."
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new MissingSecretError(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: ` +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"."
    );
  }

  cached = new TextEncoder().encode(secret);
  return cached;
}

export const SESSION_COOKIE_NAME = "fork_fire_session";
