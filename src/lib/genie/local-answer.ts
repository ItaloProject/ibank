import { parseGenie, type GenieCommand } from "./parse";
import { parseFinance } from "./finance-parse";
import { financeAnswer } from "./finance-answer";
import { normalize } from "./calc";
import { answer, type GenieAnswer, type PlanSnapshot } from "./answer";
import { chatTopic } from "./chat";
import { findTerms } from "@/lib/glossary";

const FINANCE: GenieCommand["kind"][] = [
  "netYield", "dayYield", "compareYield", "equivalent", "realReturn", "freedom", "budgetRule",
  "debt", "payOrInvest", "amortization", "compound", "installment",
];

const NO_PLAN: PlanSnapshot = { month: "", monthLabel: "", salary: 0, groups: [], items: [] };

/** Conta de investimento ou dívida que o Gênio sabe fazer, para outros assistentes responderem sem a inteligência artificial. */
export function financeReply(text: string, cdi: number): GenieAnswer | null {
  const cmd = parseGenie(text, [], cdi);
  return FINANCE.includes(cmd.kind) ? answer(cmd, NO_PLAN, cdi) : null;
}

/**
 * Aplicação por dias ("4 dias de 4000 a 100% do CDI"). Usa o parser financeiro direto, sem o glossário,
 * para que um termo como CDI não responda no lugar da conta.
 */
export function dayYieldAnswer(text: string, cdi: number): GenieAnswer | null {
  const cmd = parseFinance(normalize(text).replace(/[?!.]+$/, "").trim());
  return cmd?.kind === "dayYield" ? financeAnswer(cmd, cdi, null) : null;
}

/** O assistente de investimentos já responde sozinho: conversa curta, termo do glossário ou conta pronta. */
export function investorAnswersLocally(text: string): boolean {
  return !!chatTopic(text) || findTerms(text).length > 0 || !!financeReply(text, 0.1);
}
