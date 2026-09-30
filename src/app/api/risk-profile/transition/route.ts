import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { buildProfileTransition } from "@/lib/profile-transition";
import { isRiskProfile } from "@/lib/rebalance";
import { getCachedSnapshot, planForProfile } from "@/lib/server/portfolio-snapshot";

export const dynamic = "force-dynamic";

/** Caminho da carteira atual até o perfil `to`, sem salvar. `from` padrão: o perfil salvo; `aporte` e `gasto` opcionais substituem os cadastrados. */
export async function GET(request: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const to = params.get("to");
  if (!isRiskProfile(to)) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  try {
    const s = await getCachedSnapshot(auth.userId, true);
    const fromParam = params.get("from");
    const from = isRiskProfile(fromParam) ? fromParam : s.profileDefinido ? s.profile : null;
    const positive = (k: string) => {
      const n = Number(params.get(k));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const over = { aporte: positive("aporte"), gastoMensal: positive("gasto") };
    const transition = buildProfileTransition(planForProfile(s, to, over), from && from !== to ? planForProfile(s, from, over) : null);
    return NextResponse.json({ transition, profileSalvo: s.profileDefinido ? s.profile : null });
  } catch (err) {
    console.error("[GET /api/risk-profile/transition]", err);
    return NextResponse.json({ error: "Não foi possível calcular o caminho agora." }, { status: 500 });
  }
}
