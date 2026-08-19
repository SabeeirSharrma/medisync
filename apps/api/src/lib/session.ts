import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { config } from "../config.js";

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
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    return data;
  } catch {
    return null;
  }
}

export function generateSessionId(): string {
  return randomBytes(32).toString("hex");
}
