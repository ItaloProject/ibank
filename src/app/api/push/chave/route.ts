import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Chave pública VAPID para o aparelho se inscrever nas notificações. */
export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json({ error: "Notificações não configuradas neste ambiente." }, { status: 503 });
  }
  return NextResponse.json({ publicKey });
}
