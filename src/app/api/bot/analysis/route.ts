import { NextResponse } from "next/server";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;
  try {
    const s = await getCachedSnapshot(auth.userId, true);
    return NextResponse.json({
      nome: s.nome,
      profile: s.profile,
      profileDefinido: s.profileDefinido,
      aporte: s.aporte,
      aporteOrigem: s.aporteOrigem,
      gastoMensal: s.gastoMensal,
      metaRenda: s.metaRenda,
      plan: s.plan,
      rows: s.portfolio?.rows ?? [],
      rates: { selic: s.rates.selicAnual, cdi: s.rates.cdiAnual, ipca12m: s.rates.ipca12m ?? null, source: s.rates.source, focusData: s.rates.focus?.data ?? null },
      geradoEm: s.geradoEm,
    });
  } catch (err) {
    console.error("[GET /api/bot/analysis]", err);
    return NextResponse.json({ error: "Não foi possível analisar a carteira agora." }, { status: 500 });
  }
}
