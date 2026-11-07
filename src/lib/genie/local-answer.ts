import { parseGenie, type GenieCommand } from "./parse";
import { parseFinance, type FinanceCommand } from "./finance-parse";
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
export type DayYield = Extract<FinanceCommand, { kind: "dayYield" }>;

/**
 * Responde aplicações por dias. Uma pergunta só de prazo ("e em 30 dias?") reaproveita o valor e o
 * produto da pergunta anterior, quando ela existir.
 */
export function dayYieldReply(text: string, cdi: number, prev?: DayYield | null): { answer: GenieAnswer; cmd: DayYield } | null {
  const t = normalize(text).replace(/[?!.]+$/, "").trim();
  const direct = parseFinance(t);
  const cmd = direct?.kind === "dayYield" ? direct : followUpDays(t, prev);
  return cmd ? { answer: financeAnswer(cmd, cdi, null), cmd } : null;
}

export function dayYieldAnswer(text: string, cdi: number): GenieAnswer | null {
  return dayYieldReply(text, cdi)?.answer ?? null;
}

/**
 * Pergunta de rendimento com valor e CDI (ou produto) mas sem prazo: pede o prazo em vez de
 * cair na resposta genérica "Posso ajudar sem inteligência artificial".
 */
export function missingPeriodReply(text: string): GenieAnswer | null {
  const t = normalize(text);
  if (!/\b(?:rend\w*|ganh\w*)\b/.test(t)) return null;
  if (!(/\bcdi\b/.test(t) || /\b(?:cdbs?|lcis?|lcas?|lc|poupanca|tesouro|rdbs?)\b/.test(t))) return null;
  // Precisa de um valor que não seja porcentagem.
  if (!/\d/.test(t.replace(/\d[\d.,]*\s*%/g, " "))) return null;
  if (/\d+\s*(?:dias?|semanas?|meses|mes|anos?)\b/.test(t)) return null;
  return {
    title: "Falta o prazo para calcular",
    text: "Em quanto tempo? Por exemplo: \"quanto rendem 4 mil com 100% CDI em 30 dias\" ou \"… em 2 anos\".",
  };
}

/**
 * Resposta só com o prazo ("1 semana") depois de uma pergunta sem prazo: junta as duas.
 * Qualquer outra mensagem volta sem mudança.
 */
export function withPendingPeriod(pending: string | null, text: string): string {
  if (!pending) return text;
  const t = normalize(text).replace(/[?!.]+$/, "").trim();
  const prazo = t.replace(/^em\s+/, "");
  return /^\d+\s*(?:dias?|semanas?|meses|mes|anos?)(?:\s+uteis)?$/.test(prazo) ? `${pending} em ${prazo}` : text;
}

/** Só um prazo, sem valor nem produto: herda a aplicação anterior. */
function followUpDays(t: string, prev?: DayYield | null): DayYield | null {
  if (!prev) return null;
  const m = t.match(/\b(\d+)\s*(dias?|semanas?)(\s+uteis)?\b/);
  if (!m) return null;
  const restDigits = t.replace(m[0], " ").replace(/\d+\s*%/g, " ");
  if (/\d/.test(restDigits) || /\b(?:cdb|lci|lca|tesouro|poupanca|cdi)\b/.test(t)) return null;
  const n = Number(m[1]);
  const uteis = !!m[3];
  const days = uteis ? Math.round((n * 7) / 5) : m[2].startsWith("semana") ? n * 7 : n;
  return { ...prev, days, businessDays: uteis ? n : null };
}

/** O assistente de investimentos já responde sozinho: conversa curta, termo do glossário ou conta pronta. */
export function investorAnswersLocally(text: string): boolean {
  return !!chatTopic(text) || findTerms(text).length > 0 || !!financeReply(text, 0.1);
}
