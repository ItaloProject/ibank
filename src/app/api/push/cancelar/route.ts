import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { deleteUserPushSubscription } from "@/lib/user-push";

export const dynamic = "force-dynamic";

/** Remove o aparelho da lista de notificações. */
export async function DELETE(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = body?.endpoint ?? "";
  if (!endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  }

  await deleteUserPushSubscription(auth.userId, endpoint);
  return NextResponse.json({ ok: true });
}
