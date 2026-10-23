import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { findActiveUser, type PublicUser } from "@/lib/users";

const COOKIE = "receipts_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const secretPath = path.join(process.cwd(), "data", "session-secret");

type SessionPayload = {
  uid: string;
  exp: number;
};

let secretCache: string | null = null;

async function secret(): Promise<string> {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (secretCache) {
    return secretCache;
  }
  try {
    secretCache = (await readFile(secretPath, "utf8")).trim();
    return secretCache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  secretCache = randomBytes(32).toString("hex");
  await mkdir(path.dirname(secretPath), { recursive: true });
  await writeFile(secretPath, secretCache, "utf8");
  return secretCache;
}

async function sign(payload: SessionPayload): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", await secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function verify(token: string): Promise<SessionPayload | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }
  const expected = createHmac("sha256", await secret()).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (!payload.uid || payload.exp < Date.now()) {
    return null;
  }
  return payload;
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) {
    return null;
  }
  const payload = await verify(token);
  if (!payload) {
    return null;
  }
  return findActiveUser(payload.uid);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await sign({
    uid: userId,
    exp: Date.now() + MAX_AGE_SECONDS * 1000,
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
