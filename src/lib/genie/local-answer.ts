import { parseGenie, type GenieCommand } from "./parse";
import { answer, type GenieAnswer, type PlanSnapshot } from "./answer";

const FINANCE: GenieCommand["kind"][] = [
  "netYield", "compareYield", "equivalent", "realReturn", "freedom", "budgetRule",
  "debt", "payOrInvest", "amortization", "compound", "installment",
];

const NO_PLAN: PlanSnapshot = { month: "", monthLabel: "", salary: 0, groups: [], items: [] };

/** Conta de investimento ou dívida que o Gênio sabe fazer, para outros assistentes responderem sem a inteligência artificial. */
export function financeReply(text: string, cdi: number): GenieAnswer | null {
  const cmd = parseGenie(text, [], cdi);
  return FINANCE.includes(cmd.kind) ? answer(cmd, NO_PLAN) : null;
}
