import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { entitlementsFor, freeLimitMessage, type PlanLimits } from "@/lib/plans";
import { testeAtivo } from "@/lib/trial";

async function loadUserPlan(userId: string) {
  const rows = await sql`
    SELECT plan, bot_enabled, is_admin, trial_ends_at
    FROM app_users WHERE user_id = ${userId}
  `;
  const u = rows[0];
  if (!u) return null;
  return entitlementsFor({
    plan: u.plan as string | null,
    bot_enabled: u.bot_enabled as boolean | null,
    is_admin: u.is_admin as boolean | null,
    trialActive: testeAtivo(u.trial_ends_at as string | Date | null),
  });
}

/** Se o plano tem teto e o usuário já está no limite, devolve 402 com código UPGRADE_REQUIRED. */
export async function enforcePlanLimit(
  userId: string,
  kind: keyof PlanLimits,
  currentCount: number,
): Promise<NextResponse | null> {
  const ent = await loadUserPlan(userId);
  if (!ent) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  const max = ent.limits[kind];
  if (max == null) return null;
  if (currentCount >= max) {
    return NextResponse.json(
      {
        error: freeLimitMessage(kind),
        code: "UPGRADE_REQUIRED",
        limit: max,
        plan: ent.plan,
      },
      { status: 402 },
    );
  }
  return null;
}

export async function requirePaidFeature(
  userId: string,
  feature: "bot" | "marketAi" | "impostos",
): Promise<NextResponse | null> {
  const ent = await loadUserPlan(userId);
  if (!ent) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (ent[feature]) return null;
  const labels = {
    bot: "O MUVO Bot está disponível no plano Completo.",
    marketAi: "Pesquisa de mercado com IA está disponível nos planos pagos.",
    impostos: "O módulo de Imposto de Renda está disponível nos planos pagos.",
  };
  return NextResponse.json(
    { error: labels[feature], code: "UPGRADE_REQUIRED", plan: ent.plan },
    { status: 402 },
  );
}
