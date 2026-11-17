import { NextResponse } from "next/server";
import { requireBotUser } from "@/lib/server/bot-auth";
import { getCachedSnapshot } from "@/lib/server/portfolio-snapshot";
import { limitar } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireBotUser();
  if (auth instanceof NextResponse) return auth;

  const rajada = await limitar({ chave: `bot-analysis:${auth.userId}`, max: 30, janelaSeg: 60 });
  if (!rajada.ok) {
    return NextResponse.json(
      { error: "Muitas análises em pouco tempo. Espere um instante." },
      { status: 429, headers: { "Retry-After": String(rajada.retryAfter) } },
    );
  }

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
      alerts: s.alerts,
      goal: s.goal,
      rates: { selic: s.rates.selicAnual, cdi: s.rates.cdiAnual, ipca12m: s.rates.ipca12m ?? null, source: s.rates.source, focusData: s.rates.focus?.data ?? null },
      geradoEm: s.geradoEm,
    });
  } catch (err) {
    console.error("[GET /api/bot/analysis]", err);
    return NextResponse.json({ error: "Não foi possível analisar a carteira agora." }, { status: 500 });
  }
}
