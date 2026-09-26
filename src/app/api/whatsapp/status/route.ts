import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { isWindowOpen, maskPhone, whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  await ensureBotSchema();
  const cfg = whatsappConfig();
  const rows = await sql`SELECT whatsapp_phone, whatsapp_last_inbound_at FROM app_users WHERE user_id = ${auth.userId}`;
  const phone: string | null = rows[0]?.whatsapp_phone ?? null;
  return NextResponse.json({
    configured: cfg != null,
    connected: phone != null,
    phone: phone ? maskPhone(phone) : null,
    windowOpen: isWindowOpen(rows[0]?.whatsapp_last_inbound_at),
    templateReady: Boolean(cfg?.reportTemplate),
  });
}
