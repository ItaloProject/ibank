import type { RateIndex } from "@/lib/account-rate";

/**
 * Catálogo de renda fixa da tela de investir.
 * Tesouro Direto: títulos à venda e taxas de compra publicadas em 25/09/2026
 * (Renda+ de 17/09/2026). Renda fixa privada: faixas vistas nas plataformas
 * entre 25 e 28/09/2026 e medianas de emissão de 2026 (debêntures, CRI, CRA).
 * As taxas mudam todo dia: servem de ponto de partida e o usuário informa a
 * taxa que conseguiu na hora de confirmar.
 */
export const FIXED_INCOME_REFERENCE_DATE = "25/09/2026";

export type FixedIncomeKind = "tesouro" | "privada";

export type FixedIncomeEntry = {
  id: string;
  /** Nome exibido na lista. */
  nome: string;
  /** Nome curto usado para batizar a aplicação (renda fixa privada). */
  kind?: string;
  group: string;
  descricao: string;
  rate_index: RateIndex;
  /** Taxa de referência (mesma unidade de AccountRate.rate_value). */
  rate_value: number;
  maturity: string | null;
  tax_exempt: boolean;
  /** Sem data de vencimento (resgate a qualquer hora). */
  noMaturity?: boolean;
  top?: boolean;
};

export const TESOURO_GROUPS = [
  "Selic e reserva",
  "Prefixado",
  "Inflação (IPCA+)",
  "Aposentadoria (Renda+)",
  "Educação (Educa+)",
] as const;

export const RENDA_FIXA_GROUPS = ["Bancos, com garantia até R$ 250 mil", "Isentos de Imposto de Renda", "Empresas (crédito privado)", "Outros"] as const;

function tesouro(
  id: string,
  nome: string,
  group: (typeof TESOURO_GROUPS)[number],
  rate_index: RateIndex,
  rate_value: number,
  maturity: string,
  descricao: string,
  top = false,
): FixedIncomeEntry {
  return { id, nome, group, rate_index, rate_value, maturity, descricao, tax_exempt: false, top };
}

const RENDA_PLUS: [number, number][] = [
  [2030, 7.43], [2035, 7.33], [2040, 7.22], [2045, 7.15], [2050, 7.08], [2055, 7.03], [2060, 7.02], [2065, 7.02],
];

const EDUCA_PLUS: [number, number][] = [
  [2027, 7.51], [2028, 7.61], [2029, 7.64], [2030, 7.65], [2031, 7.62], [2032, 7.61], [2033, 7.57], [2034, 7.53],
  [2035, 7.48], [2036, 7.44], [2037, 7.39], [2038, 7.35], [2039, 7.31], [2040, 7.27], [2041, 7.25], [2042, 7.24],
  [2043, 7.22], [2044, 7.21],
];

export const TESOURO_CATALOG: FixedIncomeEntry[] = [
  tesouro("reserva-2036", "Tesouro Reserva 2036", "Selic e reserva", "selic", 0, "2036-01-01", "A partir de R$ 1 · feito para reserva de emergência", true),
  tesouro("selic-2031", "Tesouro Selic 2031", "Selic e reserva", "selic", 0.0746, "2031-03-01", "Resgate a qualquer dia sem sustos · bom para reserva", true),

  tesouro("prefixado-2029", "Tesouro Prefixado 2029", "Prefixado", "pre", 13.91, "2029-01-01", "Taxa travada até 2029", true),
  tesouro("prefixado-2032", "Tesouro Prefixado 2032", "Prefixado", "pre", 14.13, "2032-01-01", "Taxa travada até 2032", true),
  tesouro("prefixado-js-2037", "Tesouro Prefixado com Juros Semestrais 2037", "Prefixado", "pre", 14.11, "2037-01-01", "Paga juros a cada seis meses"),

  tesouro("ipca-2032", "Tesouro IPCA+ 2032", "Inflação (IPCA+)", "ipca", 7.65, "2032-08-15", "Protege da inflação · médio prazo", true),
  tesouro("ipca-2040", "Tesouro IPCA+ 2040", "Inflação (IPCA+)", "ipca", 7.27, "2040-08-15", "Protege da inflação · longo prazo", true),
  tesouro("ipca-2050", "Tesouro IPCA+ 2050", "Inflação (IPCA+)", "ipca", 7.14, "2050-08-15", "Protege da inflação · bem longo prazo"),
  tesouro("ipca-js-2037", "Tesouro IPCA+ com Juros Semestrais 2037", "Inflação (IPCA+)", "ipca", 7.5, "2037-05-15", "Paga juros a cada seis meses"),
  tesouro("ipca-js-2045", "Tesouro IPCA+ com Juros Semestrais 2045", "Inflação (IPCA+)", "ipca", 7.31, "2045-05-15", "Paga juros a cada seis meses"),
  tesouro("ipca-js-2060", "Tesouro IPCA+ com Juros Semestrais 2060", "Inflação (IPCA+)", "ipca", 7.2, "2060-08-15", "Paga juros a cada seis meses"),

  ...RENDA_PLUS.map(([ano, taxa]) =>
    tesouro(
      `renda-${ano}`,
      `Tesouro Renda+ ${ano}`,
      "Aposentadoria (Renda+)",
      "ipca",
      taxa,
      `${ano + 19}-12-15`,
      `Renda mensal por 20 anos a partir de ${ano}`,
      ano === 2050,
    ),
  ),

  ...EDUCA_PLUS.map(([ano, taxa]) =>
    tesouro(
      `educa-${ano}`,
      `Tesouro Educa+ ${ano}`,
      "Educação (Educa+)",
      "ipca",
      taxa,
      `${ano + 4}-12-15`,
      `Paga a faculdade em 5 anos a partir de ${ano}`,
    ),
  ),
];

export const RENDA_FIXA_CATALOG: FixedIncomeEntry[] = [
  {
    id: "cdb-pos", nome: "CDB pós-fixado", kind: "CDB", group: "Bancos, com garantia até R$ 250 mil",
    descricao: "Rende um percentual do CDI · bancos grandes pagam perto de 100%, médios até 118%",
    rate_index: "cdi", rate_value: 105, maturity: null, tax_exempt: false, top: true,
  },
  {
    id: "cdb-pre", nome: "CDB prefixado", kind: "CDB", group: "Bancos, com garantia até R$ 250 mil",
    descricao: "Taxa travada · até 14,9% ao ano em prazos acima de um ano",
    rate_index: "pre", rate_value: 14.5, maturity: null, tax_exempt: false, top: true,
  },
  {
    id: "cdb-ipca", nome: "CDB atrelado à inflação", kind: "CDB", group: "Bancos, com garantia até R$ 250 mil",
    descricao: "Inflação mais uma taxa fixa · até 8,2% acima da inflação",
    rate_index: "ipca", rate_value: 8, maturity: null, tax_exempt: false,
  },
  {
    id: "liquidez", nome: "Conta ou caixinha com resgate diário", kind: "Caixinha", group: "Bancos, com garantia até R$ 250 mil",
    descricao: "Dinheiro disponível a qualquer hora · costuma render 100% do CDI",
    rate_index: "cdi", rate_value: 100, maturity: null, tax_exempt: false, noMaturity: true,
  },
  {
    id: "lc", nome: "Letra de Câmbio", kind: "Letra de Câmbio", group: "Bancos, com garantia até R$ 250 mil",
    descricao: "Emitida por financeiras · costuma pagar um pouco mais que o CDB",
    rate_index: "cdi", rate_value: 110, maturity: null, tax_exempt: false,
  },

  {
    id: "lca-pos", nome: "LCA pós-fixada", kind: "LCA", group: "Isentos de Imposto de Renda",
    descricao: "Letra do agronegócio · sem Imposto de Renda · até 93% do CDI",
    rate_index: "cdi", rate_value: 92, maturity: null, tax_exempt: true, top: true,
  },
  {
    id: "lci-pos", nome: "LCI pós-fixada", kind: "LCI", group: "Isentos de Imposto de Renda",
    descricao: "Letra imobiliária · sem Imposto de Renda · perto de 81% do CDI",
    rate_index: "cdi", rate_value: 81.5, maturity: null, tax_exempt: true, top: true,
  },
  {
    id: "lca-pre", nome: "LCA prefixada", kind: "LCA", group: "Isentos de Imposto de Renda",
    descricao: "Taxa travada e sem Imposto de Renda · até 11,6% ao ano",
    rate_index: "pre", rate_value: 11.5, maturity: null, tax_exempt: true,
  },
  {
    id: "lci-pre", nome: "LCI prefixada", kind: "LCI", group: "Isentos de Imposto de Renda",
    descricao: "Taxa travada e sem Imposto de Renda · até 11,2% ao ano",
    rate_index: "pre", rate_value: 11.2, maturity: null, tax_exempt: true,
  },
  {
    id: "lca-ipca", nome: "LCA atrelada à inflação", kind: "LCA", group: "Isentos de Imposto de Renda",
    descricao: "Inflação mais taxa fixa, sem Imposto de Renda · perto de 5,2% acima da inflação",
    rate_index: "ipca", rate_value: 5.2, maturity: null, tax_exempt: true,
  },

  {
    id: "deb-incentivada", nome: "Debênture incentivada", kind: "Debênture incentivada", group: "Empresas (crédito privado)",
    descricao: "Dívida de empresas de infraestrutura · sem Imposto de Renda · sem a garantia de R$ 250 mil",
    rate_index: "ipca", rate_value: 7.4, maturity: null, tax_exempt: true, top: true,
  },
  {
    id: "cri", nome: "CRI (recebíveis imobiliários)", kind: "CRI", group: "Empresas (crédito privado)",
    descricao: "Sem Imposto de Renda · sem a garantia de R$ 250 mil · os de boa nota pagam perto de 8,9% acima da inflação",
    rate_index: "ipca", rate_value: 8.9, maturity: null, tax_exempt: true,
  },
  {
    id: "cra", nome: "CRA (recebíveis do agronegócio)", kind: "CRA", group: "Empresas (crédito privado)",
    descricao: "Sem Imposto de Renda · sem a garantia de R$ 250 mil · perto de 8,7% acima da inflação",
    rate_index: "ipca", rate_value: 8.7, maturity: null, tax_exempt: true,
  },
  {
    id: "deb-comum", nome: "Debênture comum", kind: "Debênture", group: "Empresas (crédito privado)",
    descricao: "Dívida de empresas · com Imposto de Renda · sem a garantia de R$ 250 mil",
    rate_index: "ipca", rate_value: 8.3, maturity: null, tax_exempt: false,
  },

  {
    id: "poupanca", nome: "Poupança", kind: "Poupança", group: "Outros",
    descricao: "Sem Imposto de Renda e resgate a qualquer hora · rende menos que o CDI",
    rate_index: "poupanca", rate_value: 0, maturity: null, tax_exempt: true, noMaturity: true,
  },
  {
    id: "fundo-di", nome: "Fundo de renda fixa (DI)", kind: "Fundo DI", group: "Outros",
    descricao: "Fundo que acompanha o CDI · confira a taxa de administração",
    rate_index: "cdi", rate_value: 98, maturity: null, tax_exempt: false, noMaturity: true,
  },
];

function pct(n: number, digits = 2) {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

/** Taxa em texto para o usuário, sem abreviações. */
export function fixedRateLabel(index: RateIndex, value: number): string {
  switch (index) {
    case "selic": return value > 0 ? `Selic + ${pct(value, 4)}` : "Selic";
    case "pre": return `${pct(value)} ao ano`;
    case "ipca": return `Inflação + ${pct(value)}`;
    case "cdi": return `${pct(value, 1)} do CDI`;
    case "poupanca": return "Regra da poupança";
  }
}

export function isTesouroName(name: string): boolean {
  return /tesouro/i.test(name);
}
