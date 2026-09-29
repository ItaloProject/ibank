import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";

/** Remove o número salvo para envio automático. */
export async function DELETE() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  await ensureBotSchema();
  await sql`
    UPDATE app_users
    SET whatsapp_phone = NULL, whatsapp_verified_at = NULL, whatsapp_last_inbound_at = NULL,
        whatsapp_consent_at = NULL, whatsapp_pending_report_at = NULL
    WHERE user_id = ${auth.userId}
  `;
  return NextResponse.json({ ok: true });
}
