import { NextResponse } from "next/server";
import { atualizarPorNotificacao } from "@/lib/server/assinatura-play";
import { decodificarRtdn, nomeDoPacote, verificarChamadaPubSub } from "@/lib/server/play-billing";

export const dynamic = "force-dynamic";

/**
 * Notificações em tempo real do Google Play (RTDN), entregues pelo Pub/Sub:
 * renovação, cancelamento, expiração, falha de pagamento. Mantém `paid_until` certo sem depender do app aberto.
 * A chamada precisa trazer o token do Google (audiência = esta URL, conta de serviço da assinatura push).
 */
export async function POST(request: Request) {
  const autorizado = await verificarChamadaPubSub(request.headers.get("authorization"), {
    audiencia: process.env.GOOGLE_PLAY_RTDN_AUDIENCE ?? "",
    email: process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT ?? "",
  });
  if (!autorizado) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const corpo = await request.json().catch(() => null);
  const aviso = decodificarRtdn(corpo, nomeDoPacote());
  if (aviso.tipo === "invalida") return NextResponse.json({ error: "Aviso inválido" }, { status: 400 });
  if (aviso.tipo !== "assinatura") return NextResponse.json({ ok: true });

  try {
    const r = await atualizarPorNotificacao(aviso.purchaseToken);
    return NextResponse.json({ ok: true, resultado: r });
  } catch (err) {
    // Erro nosso ou do Google: responder 500 faz o Pub/Sub tentar de novo.
    console.error("[POST /api/billing/google-play/rtdn]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
