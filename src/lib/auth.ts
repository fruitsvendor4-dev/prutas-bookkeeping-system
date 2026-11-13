import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "fruit_vendor_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = { vendorId: string; expiresAt: number };

function signingKey() {
  const key = process.env.AUTH_SECRET || process.env.SESSION_SECRET || process.env.DATABASE_URL;
  if (!key) throw new Error("Kailangan ang AUTH_SECRET para sa ligtas na session.");
  return key;
}

function sign(value: string) {
  return createHmac("sha256", signingKey()).update(value).digest("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, savedHash] = stored.split(":");
  if (!salt || !savedHash) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(savedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function setVendorSession(vendorId: string) {
  const payload: SessionPayload = {
    vendorId,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${encoded}.${sign(encoded)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getSessionVendorId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return null;
  const expectedSignature = Buffer.from(sign(encoded));
  const receivedSignature = Buffer.from(suppliedSignature);
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.vendorId || payload.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return payload.vendorId;
  } catch {
    return null;
  }
}

export async function clearVendorSession() {
  (await cookies()).delete(COOKIE_NAME);
}
