import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";

export const dynamic = "force-dynamic";

/** Lista os avisos da carteira (queda, dinheiro parado, vencimentos, Imposto de Renda). */
export async function GET() {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  try {
    const s = await getCachedSnapshot(auth.userId);
    return NextResponse.json({
      alerts: s.alerts,
      geradoEm: s.geradoEm,
    });
  } catch (err) {
    console.error("[GET /api/alerts]", err);
    return NextResponse.json({ error: "Não foi possível carregar os avisos agora." }, { status: 500 });
  }
}
