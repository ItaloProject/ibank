import { fixedRateLabel } from "@/lib/fixed-income-catalog";

/**
 * Taxas típicas dos principais bancos, pesquisadas em setembro de 2026
 * (sites dos bancos, Valor Investe, InfoMoney/XP, R7, Creditas, Meelion,
 * Boaconta, central de ajuda do PicPay e tabela de captação do Sicoob). Os bancos mudam as taxas com
 * frequência e alguns personalizam por relacionamento e valor aplicado:
 * servem para preencher o formulário, e o usuário pode corrigir.
 */
export const BANK_RATES_REFERENCE = "setembro de 2026";
/** Última conferência da tabela; depois de BANK_RATES_STALE_DAYS o app avisa que pode ter mudado. */
export const BANK_RATES_CHECKED_AT = "2026-09-25";
export const BANK_RATES_STALE_DAYS = 45;

/** Dias desde a conferência da tabela de bancos. `today` em aaaa-mm-dd. */
export function bankRatesAgeDays(today: string = new Date().toISOString().slice(0, 10)): number {
  return Math.max(0, Math.round((Date.parse(today) - Date.parse(BANK_RATES_CHECKED_AT)) / 86_400_000));
}

export const BANK_RATES_CHECKED_LABEL = BANK_RATES_CHECKED_AT.split("-").reverse().join("/");

export type BankProductKind = "liquidez" | "turbo" | "cdb" | "lci" | "lca" | "poupanca";

export type BankProduct = {
  id: string;
  kind: BankProductKind;
  /** Nome do produto no banco ("Caixinha Turbo", "CDB com resgate diário"). */
  nome: string;
  rate_index: "cdi" | "pre" | "poupanca";
  rate_value: number;
  tax_exempt: boolean;
  liquidez: string;
  /** Condição para ter a taxa ou observação importante. */
  condicao?: string;
};

export type Bank = {
  id: string;
  nome: string;
  group: string;
  /** Garantia de até R$ 250 mil por pessoa. */
  garantia: "FGC" | "FGCoop";
  products: BankProduct[];
};

const DIARIA = "Resgate a qualquer dia";
const VENC = "Resgate no vencimento";

function p(
  id: string,
  kind: BankProductKind,
  nome: string,
  rate_value: number,
  liquidez: string,
  extra: Partial<BankProduct> = {},
): BankProduct {
  return {
    id,
    kind,
    nome,
    rate_index: kind === "poupanca" ? "poupanca" : "cdi",
    rate_value: kind === "poupanca" ? 0 : rate_value,
    tax_exempt: kind === "lci" || kind === "lca" || kind === "poupanca",
    liquidez,
    ...extra,
  };
}

const POUPANCA = (id: string) => p(`${id}-poupanca`, "poupanca", "Poupança", 0, DIARIA, { condicao: "Rende no aniversário do depósito" });

export const BANKS: Bank[] = [
  {
    id: "itau", nome: "Itaú Unibanco", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("itau-cofrinho", "liquidez", "Cofrinhos / CDB com resgate diário", 100, DIARIA, { condicao: "A partir de R$ 1" }),
      p("itau-cdb", "cdb", "CDB com prazo", 100, VENC, { condicao: "Pode subir com o relacionamento e o valor" }),
      p("itau-lci", "lci", "LCI", 88, VENC),
      POUPANCA("itau"),
    ],
  },
  {
    id: "bb", nome: "Banco do Brasil", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("bb-cdb-di", "liquidez", "CDB DI com resgate diário", 99, DIARIA, { condicao: "A partir de R$ 500 · pode subir com o relacionamento" }),
      p("bb-cdb", "cdb", "CDB com prazo", 101, VENC),
      p("bb-lca", "lca", "LCA", 90, VENC),
      POUPANCA("bb"),
    ],
  },
  {
    id: "caixa", nome: "Caixa Econômica Federal", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("caixa-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA, { condicao: "A partir de R$ 200 · varia com o relacionamento" }),
      p("caixa-lci", "lci", "LCI", 81.5, VENC),
      POUPANCA("caixa"),
    ],
  },
  {
    id: "bradesco", nome: "Bradesco", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("bradesco-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA, { condicao: "A partir de R$ 100" }),
      p("bradesco-cdb", "cdb", "CDB com prazo", 101, VENC, { condicao: "A partir de R$ 1.000" }),
      p("bradesco-lci", "lci", "LCI / LCA", 89, VENC),
      POUPANCA("bradesco"),
    ],
  },
  {
    id: "santander", nome: "Santander Brasil", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("santander-cdb-di", "liquidez", "CDB DI com resgate diário", 93, DIARIA, { condicao: "Costuma ficar entre 90% e 95% do CDI" }),
      p("santander-cdb", "cdb", "CDB com prazo", 102, VENC, { condicao: "Entre 100% e 105% do CDI conforme prazo e valor" }),
      p("santander-lci", "lci", "LCI / LCA", 92, VENC),
      POUPANCA("santander"),
    ],
  },
  {
    id: "safra", nome: "Banco Safra", group: "Grandes bancos", garantia: "FGC",
    products: [
      p("safra-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA),
      p("safra-cdb", "cdb", "CDB com prazo", 102, VENC),
      p("safra-lca", "lca", "LCA", 90, VENC),
      POUPANCA("safra"),
    ],
  },

  {
    id: "nubank", nome: "Nubank", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("nubank-turbo", "turbo", "Caixinha Turbo", 115, DIARIA, {
        condicao: "Depositar R$ 900 a cada 31 dias · até 120% para clientes NuCel e Ultravioleta",
      }),
      p("nubank-caixinha", "liquidez", "Caixinha", 100, DIARIA),
      p("nubank-rdb", "cdb", "Caixinha Planejada (RDB com prazo)", 106, VENC, { condicao: "Prazos de 3 meses a 2 anos" }),
    ],
  },
  {
    id: "inter", nome: "Banco Inter", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("inter-objetivo", "liquidez", "Meu Porquinho por Objetivo", 100, DIARIA),
      p("inter-dia", "liquidez", "Meu Porquinho Dia a Dia", 80, DIARIA, { condicao: "Produto padrão da conta, rende menos" }),
      p("inter-cdb", "cdb", "CDB com prazo", 102, VENC),
      p("inter-lci", "lci", "LCI", 80.5, VENC),
      POUPANCA("inter"),
    ],
  },
  {
    id: "c6", nome: "C6 Bank", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("c6-cdb-diario", "liquidez", "CDB com resgate diário", 102, DIARIA, { condicao: "Entre 102% e 104% do CDI · a partir de R$ 20" }),
      p("c6-cdb", "cdb", "CDB com prazo", 104, VENC),
    ],
  },
  {
    id: "neon", nome: "Neon", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("neon-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA, { condicao: "Começa em 100% e sobe até 113% do CDI depois de 2 anos" }),
      p("neon-planejado", "cdb", "CDB Planejado", 150, "Resgate após 2 meses", { condicao: "Oferta com carência de 2 meses, confira no app" }),
      POUPANCA("neon"),
    ],
  },
  {
    id: "pan", nome: "Banco Pan", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("pan-dia", "liquidez", "Cofrinho Dia a Dia", 100, DIARIA),
      p("pan-rende-mais", "cdb", "Cofrinho Rende Mais", 105, VENC, { condicao: "Acima do CDI em troca de prazo · confira a taxa no app" }),
      POUPANCA("pan"),
    ],
  },
  {
    id: "picpay", nome: "PicPay", group: "Bancos digitais", garantia: "FGC",
    products: [
      p("picpay-turbinado", "turbo", "Cofrinho Turbinado", 121, DIARIA, {
        condicao: "Até R$ 10 mil · plano PicPay Mais ou Epic, ou receber R$ 999 por mês via Pix",
      }),
      p("picpay-cofrinho", "liquidez", "Cofrinho", 102, DIARIA, { condicao: "Rende todo dia útil desde o depósito" }),
      p("picpay-saldo", "liquidez", "Saldo da conta", 102, DIARIA, { condicao: "Cada depósito só rende depois de 30 dias parado" }),
    ],
  },

  {
    id: "btg", nome: "BTG Pactual", group: "Bancos de investimento", garantia: "FGC",
    products: [
      p("btg-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA),
      p("btg-cdb", "cdb", "CDB com prazo", 102, VENC, { condicao: "A plataforma também tem CDBs de outros bancos" }),
      p("btg-lca", "lca", "LCA", 93, VENC),
    ],
  },
  {
    id: "xp", nome: "Banco XP", group: "Bancos de investimento", garantia: "FGC",
    products: [
      p("xp-cdb-diario", "liquidez", "CDB com resgate diário", 100, DIARIA),
      p("xp-cdb-pre", "cdb", "CDB prefixado até 2032", 14.1, VENC, { rate_index: "pre", condicao: "Taxa travada ao ano" }),
      p("xp-lca", "lca", "LCA na plataforma", 86.5, VENC, { condicao: "Emitida por bancos parceiros" }),
    ],
  },

  {
    id: "sicoob", nome: "Sicoob", group: "Cooperativas", garantia: "FGCoop",
    products: [
      p("sicoob-rdc-diario", "liquidez", "RDC com resgate diário", 100, DIARIA, { condicao: "Até R$ 50 mil; valores maiores rendem mais" }),
      p("sicoob-rdc", "cdb", "RDC com carência", 102, "Resgate após a carência"),
      p("sicoob-lca", "lca", "LCA", 90, VENC),
      POUPANCA("sicoob"),
    ],
  },
  {
    id: "sicredi", nome: "Sicredi", group: "Cooperativas", garantia: "FGCoop",
    products: [
      p("sicredi-rdc", "liquidez", "Sicredinvest (RDC)", 100, "Resgate diário após 30 dias", { condicao: "Carências maiores pagam mais" }),
      p("sicredi-lca", "lca", "LCI / LCA", 90, VENC),
      POUPANCA("sicredi"),
    ],
  },
];

export function findBankByName(name: string): Bank | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return BANKS.find((b) => b.nome.toLowerCase() === n || b.id === n);
}

export type CaixinhaTipo = "turbo" | "emergencia" | "investimentos";

/** Produtos do banco que fazem sentido para o tipo de caixinha, na ordem de relevância. */
export function productsForTipo(bank: Bank, tipo: CaixinhaTipo): BankProduct[] {
  const order: Record<CaixinhaTipo, BankProductKind[]> = {
    turbo: ["turbo", "liquidez"],
    emergencia: ["liquidez", "turbo", "poupanca"],
    investimentos: ["cdb", "lca", "lci", "liquidez"],
  };
  return order[tipo].flatMap((k) => bank.products.filter((x) => x.kind === k));
}

export function bankProductRate(prod: BankProduct): string {
  return fixedRateLabel(prod.rate_index, prod.rate_value);
}

/** Resumo compacto para o assistente com IA. */
export function bankRatesForBot(today?: string) {
  const dias = bankRatesAgeDays(today);
  return {
    referencia: BANK_RATES_REFERENCE,
    conferidasEm: BANK_RATES_CHECKED_LABEL,
    diasDesdeConferencia: dias,
    desatualizadas: dias > BANK_RATES_STALE_DAYS,
    aviso: "Taxas típicas; bancos grandes personalizam por relacionamento e valor. Confirmar no app do banco.",
    bancos: BANKS.map((b) => ({
      banco: b.nome,
      grupo: b.group,
      garantia: b.garantia === "FGC" ? "Fundo Garantidor de Créditos, até R$ 250 mil" : "Fundo Garantidor do Cooperativismo de Crédito, até R$ 250 mil",
      produtos: b.products.map((x) => ({
        produto: x.nome,
        taxa: bankProductRate(x),
        isentoIR: x.tax_exempt,
        liquidez: x.liquidez,
        ...(x.condicao ? { condicao: x.condicao } : {}),
      })),
    })),
  };
}
