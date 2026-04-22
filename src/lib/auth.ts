import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "boothform_admin";
const COOKIE_MAX_AGE = 60 * 60 * 12;

function getSecret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("hex");
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (password.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected))) {
    return false;
  }
  const token = `${Date.now()}.${sign(String(Date.now()))}`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const age = Date.now() - parseInt(ts, 10);
  if (isNaN(age) || age < 0 || age > COOKIE_MAX_AGE * 1000) return false;
  return sign(ts) === sig;
}
