import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { consumeDailyQuota, ensureBotSchema } from "@/lib/bot-schema";
import { requireBotUser } from "@/lib/server/bot-auth";
import { sendFullReport, sendTemplateReport } from "@/lib/server/send-report";
import { WhatsappError, isWindowOpen, waLink, whatsappConfig } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_LIMIT = 5;

export async function POST() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  const cfg = whatsappConfig();
  if (!cfg) return NextResponse.json({ error: "O WhatsApp do MUVO ainda não foi configurado." }, { status: 503 });
  await ensureBotSchema();

  const rows = await sql`SELECT whatsapp_phone, whatsapp_last_inbound_at FROM app_users WHERE user_id = ${auth.userId}`;
  const phone: string | null = rows[0]?.whatsapp_phone ?? null;
  if (!phone) return NextResponse.json({ error: "Conecte seu WhatsApp primeiro.", code: "not_connected" }, { status: 409 });

  const windowOpen = isWindowOpen(rows[0]?.whatsapp_last_inbound_at);
  if (!windowOpen && !cfg.reportTemplate) {
    return NextResponse.json({
      error: "Mande um “oi” para o MUVO no WhatsApp e tente de novo. O WhatsApp só libera o envio depois de uma mensagem sua.",
      code: "window_closed",
      url: waLink(cfg.businessNumber, "Oi, MUVO!"),
    }, { status: 409 });
  }
  if (!(await consumeDailyQuota(auth.userId, "whatsapp", DAILY_LIMIT))) {
    return NextResponse.json({ error: `Limite de ${DAILY_LIMIT} envios por dia atingido. Tente amanhã.` }, { status: 429 });
  }

  try {
    if (windowOpen) {
      await sendFullReport(cfg, auth.userId, phone);
      return NextResponse.json({ sent: true, mode: "full" });
    }
    await sendTemplateReport(cfg, auth.userId, phone);
    return NextResponse.json({ sent: true, mode: "template" });
  } catch (err) {
    console.error("[POST /api/whatsapp/report]", err);
    const msg = err instanceof WhatsappError ? `O WhatsApp recusou o envio: ${err.message}` : "Não foi possível enviar o relatório agora.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
