import { NextResponse } from "next/server";
import { dispatchNext, planOutbox } from "@/lib/server/whatsapp-outbox";
import { secretMatches } from "@/lib/server/secret-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Chamada pelo agendador a cada minuto, com `Authorization: Bearer <WHATSAPP_DISPATCH_SECRET>`.
 * Planeja alguns resumos e envia no máximo uma mensagem, respeitando janela, pausa e limite diário.
 */
async function run(request: Request) {
  const secret = process.env.WHATSAPP_DISPATCH_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "WHATSAPP_DISPATCH_SECRET não configurado" }, { status: 503 });
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretMatches(bearer, secret)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const plan = await planOutbox();
    const send = await dispatchNext();
    return NextResponse.json({ plan, send });
  } catch (err) {
    console.error("[whatsapp dispatch]", err);
    return NextResponse.json({ error: "Falha ao processar a fila" }, { status: 500 });
  }
}

export const POST = run;
export const GET = run;
