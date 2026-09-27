import { NextResponse } from "next/server";

export const DEVICE_COOKIE = "arada_device";
const MAX_AGE = 180 * 24 * 60 * 60;

function cookieSecret(): string {
  const secret =
    process.env.ECONOMY_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) throw new Error("missing-economy-secret");
  return secret;
}

function readCookie(header: string, name: string): string | null {
  const parts = header.split(";").map((part) => part.trim());
  const hit = parts.find((part) => part.startsWith(`${name}=`));
  if (!hit) return null;
  return decodeURIComponent(hit.slice(name.length + 1));
}

async function hmacHex(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(id: string, secret: string): Promise<string> {
  return `${id}.${await hmacHex(id, secret)}`;
}

async function verify(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 10) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = await hmacHex(id, secret);
  if (expected.length !== sig.length) return null;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0 ? id : null;
}

export async function resolveDevice(request: Request): Promise<{
  id: string;
  token: string;
  fresh: boolean;
}> {
  const secret = cookieSecret();
  const raw = readCookie(request.headers.get("cookie") ?? "", DEVICE_COOKIE);
  if (raw) {
    const id = await verify(raw, secret);
    if (id) return { id, token: raw, fresh: false };
  }
  const id = crypto.randomUUID();
  return { id, token: await sign(id, secret), fresh: true };
}

export function applyDeviceCookie<T>(
  response: NextResponse<T>,
  token: string,
  fresh: boolean,
): NextResponse<T> {
  if (!fresh) return response;
  response.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
