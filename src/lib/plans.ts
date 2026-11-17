/**
 * Planos comerciais do MUVO.
 *
 * - gratuito: permanente, com limites (Play Store / freemium)
 * - teste: 3 dias com tudo liberado (entrada Google)
 * - assinante: pago, app completo sem bot
 * - completo: pago, app + bot
 */

export const PLANO_GRATUITO = "gratuito";
export const PLANO_TESTE = "teste";
export const PLANO_ASSINANTE = "assinante";
export const PLANO_COMPLETO = "completo";

export type PlanId =
  | typeof PLANO_GRATUITO
  | typeof PLANO_TESTE
  | typeof PLANO_ASSINANTE
  | typeof PLANO_COMPLETO;

export type PlanLimits = {
  /** Grupos de planejamento. null = sem teto. */
  planGroups: number | null;
  /** Itens de planejamento por mês. null = sem teto. */
  planItemsPerMonth: number | null;
  /** Contas de investimento. null = sem teto. */
  investmentAccounts: number | null;
};

export type PlanEntitlements = {
  plan: PlanId;
  /** Acesso ao app (não fica na tela de bloqueio). */
  appAccess: boolean;
  bot: boolean;
  /** Pesquisa de mercado / análise com IA. */
  marketAi: boolean;
  /** Imposto de renda detalhado. */
  impostos: boolean;
  limits: PlanLimits;
  label: string;
};

const UNLIMITED: PlanLimits = {
  planGroups: null,
  planItemsPerMonth: null,
  investmentAccounts: null,
};

const FREE_LIMITS: PlanLimits = {
  planGroups: 3,
  planItemsPerMonth: 20,
  investmentAccounts: 2,
};

const FULL_NO_BOT: PlanEntitlements = {
  plan: PLANO_ASSINANTE,
  appAccess: true,
  bot: false,
  marketAi: false,
  impostos: true,
  limits: UNLIMITED,
  label: "Assinante",
};

const FULL_WITH_BOT: PlanEntitlements = {
  plan: PLANO_COMPLETO,
  appAccess: true,
  bot: true,
  marketAi: true,
  impostos: true,
  limits: UNLIMITED,
  label: "Completo",
};

const FREE: PlanEntitlements = {
  plan: PLANO_GRATUITO,
  appAccess: true,
  bot: false,
  marketAi: false,
  impostos: false,
  limits: FREE_LIMITS,
  label: "Grátis",
};

const TRIAL: PlanEntitlements = {
  plan: PLANO_TESTE,
  appAccess: true,
  bot: true,
  marketAi: true,
  impostos: true,
  limits: UNLIMITED,
  label: "Teste grátis",
};

export function normalizePlan(plan: string | null | undefined): PlanId {
  if (plan === PLANO_GRATUITO) return PLANO_GRATUITO;
  if (plan === PLANO_TESTE) return PLANO_TESTE;
  if (plan === PLANO_COMPLETO) return PLANO_COMPLETO;
  return PLANO_ASSINANTE;
}

/**
 * Direitos efetivos. Teste ativo = tudo liberado.
 * Assinante/completo pagos usam bot_enabled para o bot.
 */
export function entitlementsFor(row: {
  plan?: string | null;
  bot_enabled?: boolean | null;
  is_admin?: boolean | null;
  trialActive?: boolean;
}): PlanEntitlements {
  if (row.is_admin) {
    return { ...FULL_WITH_BOT, plan: PLANO_COMPLETO, label: "Admin" };
  }
  if (row.trialActive) {
    return TRIAL;
  }
  const plan = normalizePlan(row.plan);
  if (plan === PLANO_GRATUITO) return FREE;
  if (plan === PLANO_TESTE) {
    // Teste vencido ainda marcado como teste: sem acesso até Continuar grátis ou assinar.
    return { ...FREE, plan: PLANO_TESTE, appAccess: false, label: "Teste encerrado" };
  }
  if (plan === PLANO_COMPLETO || row.bot_enabled) {
    return FULL_WITH_BOT;
  }
  return FULL_NO_BOT;
}

export function freeLimitMessage(kind: keyof PlanLimits): string {
  const n = FREE_LIMITS[kind];
  const mapa: Record<keyof PlanLimits, string> = {
    planGroups: `No plano grátis você pode ter até ${n} grupos de planejamento. Assine para liberar sem limite.`,
    planItemsPerMonth: `No plano grátis o limite é ${n} itens de planejamento por mês. Assine para liberar sem limite.`,
    investmentAccounts: `No plano grátis você pode ter até ${n} contas de investimento. Assine para liberar sem limite.`,
  };
  return mapa[kind];
}
