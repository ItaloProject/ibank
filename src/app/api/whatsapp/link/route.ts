import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { waLink, whatsappConfig } from "@/lib/whatsapp";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

/** Gera um código de vínculo; o usuário o envia ao MUVO pelo WhatsApp, o que prova que o número é dele. */
export async function POST() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const cfg = whatsappConfig();
  if (!cfg) return NextResponse.json({ error: "O WhatsApp do MUVO ainda não foi configurado." }, { status: 503 });
  await ensureBotSchema();
  const code = newCode();
  await sql`
    UPDATE app_users
    SET whatsapp_link_code = ${code}, whatsapp_link_expires = NOW() + INTERVAL '15 minutes'
    WHERE user_id = ${auth.userId}
  `;
  return NextResponse.json({ code, url: waLink(cfg.businessNumber, `MUVO-${code} Quero receber meus relatórios aqui.`) });
}

export async function DELETE() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  await ensureBotSchema();
  await sql`
    UPDATE app_users
    SET whatsapp_phone = NULL, whatsapp_verified_at = NULL, whatsapp_last_inbound_at = NULL,
        whatsapp_link_code = NULL, whatsapp_link_expires = NULL
    WHERE user_id = ${auth.userId}
  `;
  return NextResponse.json({ ok: true });
}
