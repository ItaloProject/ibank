import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireBotUser } from "@/lib/server/bot-auth";
import { applyDigestMode, ensureOutboxSchema } from "@/lib/server/whatsapp-outbox";
import { evolutionConfig } from "@/lib/evolution";

export const dynamic = "force-dynamic";

const MODES = ["weekly", "daily", "off"] as const;

/** Escolha do resumo da carteira no WhatsApp: semanal, só avisos ou desligado. */
export async function POST(request: Request) {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  if (!evolutionConfig()) return NextResponse.json({ error: "O resumo pelo WhatsApp ainda não foi ativado." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode = MODES.find((m) => m === body?.mode);
  if (!mode) return NextResponse.json({ error: "Opção inválida." }, { status: 400 });

  await ensureOutboxSchema();
  const rows = await sql`SELECT whatsapp_phone, whatsapp_consent_at FROM app_users WHERE user_id = ${auth.userId}`;
  if (!rows[0]?.whatsapp_phone || !rows[0]?.whatsapp_consent_at) {
    return NextResponse.json({ error: "Informe seu número de WhatsApp primeiro.", code: "not_connected" }, { status: 409 });
  }
  await applyDigestMode(auth.userId, mode);
  return NextResponse.json({ ok: true, mode });
}
