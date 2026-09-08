import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "ibank-dev-secret-change-in-production"
);

export async function signToken(payload: { userId: string; name: string; color: string; isAdmin?: boolean }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; name: string; color: string; isAdmin?: boolean };
  } catch {
    return null;
  }
}
