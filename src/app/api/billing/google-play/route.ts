import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { registrarCompraDoApp } from "@/lib/server/assinatura-play";
import { billingConfigurado } from "@/lib/server/play-billing";

export const dynamic = "force-dynamic";

/**
 * O app Android fez uma compra na Google Play e manda o token para cá.
 * Funciona mesmo com o teste acabado: é justamente quem precisa assinar.
 */
export async function POST(request: Request) {
  const auth = await requireUserId({ permitirAssinaturaExpirada: true });
  if (auth instanceof NextResponse) return auth;
  if (!billingConfigurado()) {
    return NextResponse.json({ error: "Assinatura pela Google Play ainda não está disponível." }, { status: 503 });
  }
  try {
    const { purchaseToken, productId } = await request.json().catch(() => ({}));
    if (typeof purchaseToken !== "string" || !purchaseToken || purchaseToken.length > 2048 || typeof productId !== "string") {
      return NextResponse.json({ error: "Compra inválida." }, { status: 400 });
    }
    const r = await registrarCompraDoApp(auth.userId, purchaseToken, productId);
    if (!r.ok) return NextResponse.json({ error: r.erro, code: r.codigo }, { status: r.status });
    return NextResponse.json({ ok: true, plan: r.plano, paidUntil: r.pagoAte, state: r.estado });
  } catch (err) {
    console.error("[POST /api/billing/google-play]", err);
    return NextResponse.json({ error: "Não foi possível confirmar a compra agora. Tente de novo em instantes." }, { status: 500 });
  }
}
