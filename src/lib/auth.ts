import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("JWT_SECRET is required in production");
  }
  return new TextEncoder().encode(secret ?? "ibank-dev-secret-change-in-production");
}

export type SessionUser = {
  userId: string;
  name: string;
  color: string;
  isAdmin?: boolean;
  investmentProfile?: string;
  botEnabled?: boolean;
};

export async function signToken(payload: SessionUser) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as SessionUser;
  } catch {
    return null;
  }
}

/** Returns session payload or null if missing/invalid */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("ibank_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Returns userId or null */
export async function getSessionUserId(): Promise<string | null> {
  const s = await getSession();
  return s?.userId ?? null;
}

/** Returns { userId } or a NextResponse 401 — use like:
 *  const auth = await requireUserId();
 *  if (auth instanceof NextResponse) return auth;
 *  const { userId } = auth;
 */
export async function requireUserId(): Promise<{ userId: string } | NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return { userId };
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return session;
}
