import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { upsertUserPushSubscription } from "@/lib/user-push";

export const dynamic = "force-dynamic";

/** Guarda o aparelho do assinante para receber avisos de queda e da carteira. */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  } | null;

  const endpoint = body?.subscription?.endpoint ?? "";
  const p256dh = body?.subscription?.keys?.p256dh ?? "";
  const authKey = body?.subscription?.keys?.auth ?? "";
  if (!endpoint.startsWith("https://") || !p256dh || !authKey) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  }

  await upsertUserPushSubscription({
    userId: auth.userId,
    endpoint,
    p256dh,
    auth: authKey,
  });
  return NextResponse.json({ ok: true });
}
