import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";

function hmac(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function signUserId(userId: string): string {
  return `${userId}.${hmac(userId)}`;
}

export function verifySessionCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const userId = value.slice(0, dotIndex);
  const signature = value.slice(dotIndex + 1);
  const expected = hmac(userId);

  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return null;

  return userId;
}
