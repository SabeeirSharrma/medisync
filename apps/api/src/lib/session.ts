import { createHmac, randomBytes, timingSafeEqual, createHash } from "crypto";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { revokedTokens } from "../db/schema.js";
import { eq } from "drizzle-orm";

const SECRET = config.sessionSecret;

export function signSession(payload: Record<string, unknown>): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySession(value: string): Record<string, unknown> | null {
  try {
    const [encoded, sig] = value.split(".");
    if (!encoded || !sig) return null;
    const expected = createHmac("sha256", SECRET).update(encoded).digest("base64url");
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

    // Check if the token has been revoked
    const tokenHash = createHash("sha256").update(value).digest("hex");
    const revoked = db.select().from(revokedTokens).where(eq(revokedTokens.tokenHash, tokenHash)).limit(1);
    // Synchronous check won't work with async DB — we use a sync HMAC check only.
    // Revocation is checked in the auth middleware (async) for the actual request path.

    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    return data;
  } catch {
    return null;
  }
}

/**
 * Hash a session token for storage in the revoked_tokens table.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Revoke a session token by inserting its hash into revoked_tokens.
 * This is called on logout.
 */
export async function revokeToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  try {
    await db.insert(revokedTokens).values({ tokenHash });
  } catch (err) {
    // If the token is already revoked (duplicate insert), that's fine
    console.error("Failed to revoke token:", err);
  }
}

/**
 * Check if a token has been revoked.
 */
export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await db.select().from(revokedTokens).where(eq(revokedTokens.tokenHash, tokenHash)).limit(1);
  return result.length > 0;
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}
