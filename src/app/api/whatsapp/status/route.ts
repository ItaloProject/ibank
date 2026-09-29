import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { evolutionConfig } from "@/lib/evolution";
import { isWindowOpen, maskPhone, whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  await ensureBotSchema();
  const cfg = whatsappConfig();
  const evo = evolutionConfig() != null;
  const rows = await sql`SELECT whatsapp_phone, whatsapp_last_inbound_at FROM app_users WHERE user_id = ${auth.userId}`;
  const phone: string | null = rows[0]?.whatsapp_phone ?? null;
  return NextResponse.json({
    configured: evo || cfg != null,
    connected: phone != null,
    phone: phone ? maskPhone(phone) : null,
    windowOpen: evo || isWindowOpen(rows[0]?.whatsapp_last_inbound_at),
    templateReady: evo || Boolean(cfg?.reportTemplate),
    autoAvailable: evo || (cfg != null && Boolean(cfg.reportTemplate)),
  });
}
