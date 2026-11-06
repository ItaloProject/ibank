import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { requireBotUser } from "@/lib/server/bot-auth";
import { ensureOutboxSchema } from "@/lib/server/whatsapp-outbox";
import { evolutionConfig } from "@/lib/evolution";
import { isWindowOpen, maskPhone, whatsappConfig } from "@/lib/whatsapp";
import { digestMode } from "@/lib/whatsapp-digest";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  await ensureOutboxSchema();
  const cfg = whatsappConfig();
  const evo = evolutionConfig() != null;
  const rows = await sql`
    SELECT whatsapp_phone, whatsapp_last_inbound_at, whatsapp_optin_at, whatsapp_optout_at, whatsapp_frequency
    FROM app_users WHERE user_id = ${auth.userId}
  `;
  const row = rows[0];
  const phone: string | null = row?.whatsapp_phone ?? null;
  return NextResponse.json({
    configured: evo || cfg != null,
    connected: phone != null,
    phone: phone ? maskPhone(phone) : null,
    windowOpen: evo || isWindowOpen(row?.whatsapp_last_inbound_at),
    templateReady: evo || Boolean(cfg?.reportTemplate),
    autoAvailable: evo || (cfg != null && Boolean(cfg.reportTemplate)),
    /** O resumo periódico só existe com a Evolution API (sem janela de 24 horas). */
    digestAvailable: evo,
    digest: digestMode({ optinAt: row?.whatsapp_optin_at, optoutAt: row?.whatsapp_optout_at, frequency: row?.whatsapp_frequency }),
  });
}
