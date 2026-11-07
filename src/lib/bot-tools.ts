/**
 * Ferramentas do assistente com IA: cálculos de aplicação feitos pelo próprio app, para que o modelo
 * explique o número em vez de fazer a conta de cabeça. Mesmo motor das respostas locais.
 */
import type { ToolDef } from "@/lib/server/llm";
import { financeAnswer } from "@/lib/genie/finance-answer";
import type { FinanceCommand } from "@/lib/genie/finance-parse";
import type { Product } from "@/lib/finance-calc";

const PRODUTOS: Product[] = ["cdb", "lci", "lca", "tesouro", "poupanca", "lc", "rdb", "debenture"];

const COMUM = {
  valor: { type: "number", description: "Valor aplicado em reais, por exemplo 4000." },
  produto: { type: "string", enum: PRODUTOS, description: "Tipo de aplicação. Use cdb se o usuário não disser." },
  percentual_cdi: { type: "number", description: "Percentual do CDI, por exemplo 100 para 100% do CDI. Omita se usar taxa_anual." },
  taxa_anual: { type: "number", description: "Taxa prefixada ao ano em %, por exemplo 12. Omita se usar percentual_cdi." },
};

export const BOT_TOOLS: ToolDef[] = [
  {
    name: "calcular_aplicacao_dias",
    description:
      "Calcula quanto sobra ao resgatar uma aplicação em poucos dias, já com IOF do resgate e Imposto de Renda. Use para perguntas do tipo 'deixo X por N dias'.",
    input_schema: {
      type: "object",
      properties: {
        ...COMUM,
        dias: { type: "integer", minimum: 1, maximum: 720, description: "Prazo em dias corridos." },
        dias_uteis: { type: "integer", minimum: 1, maximum: 500, description: "Use só se o usuário disser 'dias úteis'." },
      },
      required: ["valor", "dias"],
    },
  },
  {
    name: "calcular_aplicacao_meses",
    description: "Calcula o rendimento líquido de uma aplicação por meses ou anos, com Imposto de Renda. Use para perguntas do tipo 'quanto rende X em N meses/anos'.",
    input_schema: {
      type: "object",
      properties: {
        ...COMUM,
        meses: { type: "integer", minimum: 1, maximum: 600, description: "Prazo em meses. Converta anos multiplicando por 12." },
      },
      required: ["valor", "meses"],
    },
  },
  {
    name: "consultar_cdi",
    description: "Mostra o CDI e a Selic anuais atuais, para explicar a taxa usada nas contas.",
    input_schema: { type: "object", properties: {} },
  },
];

type Args = Record<string, unknown>;

function numero(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function produto(v: unknown): Product {
  return PRODUTOS.includes(v as Product) ? (v as Product) : "cdb";
}

function taxas(args: Args): { pct: number | null; rateYear: number | null } | string {
  const taxaAno = numero(args.taxa_anual, 0, 100);
  if (taxaAno !== null) return { pct: null, rateYear: taxaAno };
  const pctCdi = numero(args.percentual_cdi, 0, 300);
  return { pct: pctCdi ?? 100, rateYear: null };
}

function resposta(a: { title: string; value?: string; lines?: { label: string; value: string }[]; note?: string }): string {
  return JSON.stringify({
    titulo: a.title,
    valor_final: a.value ?? null,
    linhas: (a.lines ?? []).map((l) => `${l.label}: ${l.value}`),
    observacao: a.note ?? null,
  });
}

/** Executa uma ferramenta; devolve texto para o modelo. Entrada inválida vira erro explicado, não cálculo. */
export function runBotTool(name: string, rawArgs: unknown, cdi: number): string {
  const args = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Args;

  if (name === "consultar_cdi") {
    return JSON.stringify({ cdi_anual_percent: cdi, observacao: "Taxa oficial do Banco Central, usada nas contas de CDI." });
  }

  const valor = numero(args.valor, 1, 1_000_000_000);
  if (valor === null) return "Erro: informe um valor em reais maior que zero.";
  const t = taxas(args);
  if (typeof t === "string") return t;

  if (name === "calcular_aplicacao_dias") {
    const dias = numero(args.dias, 1, 720);
    if (dias === null) return "Erro: o prazo em dias deve estar entre 1 e 720.";
    const diasUteis = numero(args.dias_uteis, 1, 500);
    const cmd: Extract<FinanceCommand, { kind: "dayYield" }> = {
      kind: "dayYield",
      amount: valor,
      product: produto(args.produto),
      pct: t.pct,
      rateYear: t.rateYear,
      days: dias,
      businessDays: diasUteis,
      mil: false,
    };
    return resposta(financeAnswer(cmd, cdi, null));
  }

  if (name === "calcular_aplicacao_meses") {
    const meses = numero(args.meses, 1, 600);
    if (meses === null) return "Erro: o prazo em meses deve estar entre 1 e 600.";
    const cmd: Extract<FinanceCommand, { kind: "netYield" }> = {
      kind: "netYield",
      amount: valor,
      product: produto(args.produto),
      pct: t.pct,
      rateYear: t.rateYear,
      months: meses,
    };
    return resposta(financeAnswer(cmd, cdi, null));
  }

  return `Erro: ferramenta desconhecida (${name}).`;
}
