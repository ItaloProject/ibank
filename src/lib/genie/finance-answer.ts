import type { FinanceCommand } from "./finance-parse";
import type { GenieAnswer, GenieLine } from "./answer";
import {
  CHEQUE_ESPECIAL_MONTH, FREEDOM_MULTIPLE, POUPANCA_YEAR, PRODUCT_LABEL, REAL_RATE_YEAR, ROTATIVO_MONTH,
  amortization, debtGrowth, incomeTaxRate, isTaxFree, monthToYear, monthsToTarget, netYield, realRate,
  taxFreeEquivalent, taxedEquivalent, yearToMonth, type Product,
} from "@/lib/finance-calc";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number, digits = 2) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
const period = (n: number) => (n % 12 === 0 ? (n === 12 ? "1 ano" : `${n / 12} anos`) : n === 1 ? "1 mês" : `${n} meses`);
const longPeriod = (n: number) => {
  const y = Math.floor(n / 12);
  const m = n % 12;
  if (!y) return period(n);
  return m ? `${y} ${y === 1 ? "ano" : "anos"} e ${m} ${m === 1 ? "mês" : "meses"}` : `${y} ${y === 1 ? "ano" : "anos"}`;
};

/** Números do planejamento que algumas contas usam; null fora do Gênio. */
export type PlanNumbers = { salary: number; planned: number; actual: number; fixo: number; variavel: number; sobraPlanned: number };

function annualRateOf(product: Product, pctCdi: number | null, rateYear: number | null, cdi: number): { rate: number; label: string } {
  if (product === "poupanca") return { rate: POUPANCA_YEAR, label: "poupança (0,5% ao mês, sem a TR)" };
  if (rateYear !== null) return { rate: rateYear / 100, label: `${PRODUCT_LABEL[product]} a ${pct(rateYear)} ao ano` };
  const p = pctCdi ?? 100;
  return { rate: (cdi / 100) * (p / 100), label: `${PRODUCT_LABEL[product]} a ${pct(p)} do CDI` };
}

export function financeAnswer(cmd: FinanceCommand, cdi: number, plan: PlanNumbers | null): GenieAnswer {
  switch (cmd.kind) {
    case "netYield": {
      const { rate, label } = annualRateOf(cmd.product, cmd.pct, cmd.rateYear, cdi);
      const free = isTaxFree(cmd.product);
      const r = netYield(cmd.amount, rate, cmd.months, free);
      const lines: GenieLine[] = [
        { label: "Valor aplicado", value: money(cmd.amount) },
        { label: "Rendimento bruto", value: money(r.gross) },
        free
          ? { label: "Imposto de Renda", value: "isento", tone: "good" }
          : { label: `Imposto de Renda (${pct(r.taxRate * 100, 1)})`, value: `− ${money(r.tax)}`, tone: "bad" },
        { label: "Rendimento líquido", value: money(r.net), tone: "good" },
      ];
      return {
        title: `${label}, em ${period(cmd.months)}`,
        value: money(r.final),
        raw: r.final,
        tone: "good",
        lines,
        note: `Com CDI de ${pct(cdi)} ao ano mantido no período.${cmd.pct === null && cmd.rateYear === null && cmd.product !== "poupanca" ? " Considerei 100% do CDI; diga a taxa para um cálculo exato." : ""}${cmd.product === "tesouro" ? " O Tesouro também cobra 0,20% ao ano de custódia acima de R$ 10 mil." : ""}`,
        chips: free ? ["o que é FGC?"] : [`quanto rendem ${money(cmd.amount).replace("R$", "").trim()} na LCI a 90% do CDI em ${period(cmd.months)}`],
      };
    }

    case "compareYield": {
      const months = cmd.months ?? 12;
      const rows = cmd.options.map((o) => {
        const gross = (cdi / 100) * (o.pct / 100);
        const free = isTaxFree(o.product);
        const net = free ? gross : gross * (1 - incomeTaxRate(months));
        const asTaxFreePct = free ? o.pct : taxFreeEquivalent(o.pct, months);
        return { ...o, net, asTaxFreePct, free };
      });
      const best = [...rows].sort((a, b) => b.net - a.net)[0];
      const tie = rows.every((r) => Math.abs(r.net - best.net) < 0.0005);
      return {
        title: `Comparando em ${period(months)}, já sem Imposto de Renda`,
        value: tie ? "Empate" : `${PRODUCT_LABEL[best.product]} a ${pct(best.pct)}`,
        tone: "good",
        lines: rows.map((r) => ({
          label: `${PRODUCT_LABEL[r.product]} a ${pct(r.pct)} do CDI`,
          value: `${pct(r.net * 100)} ao ano líquido${r.free ? " · isento" : ` · igual a ${pct(r.asTaxFreePct)} isento`}`,
          tone: r === best && !tie ? ("good" as const) : undefined,
        })),
        note: `Imposto de Renda de ${pct(incomeTaxRate(months) * 100, 1)} para ${period(months)}; quanto mais tempo aplicado, menor o imposto. Compare também liquidez e a garantia do FGC.${cmd.months === null ? " Diga o prazo para um cálculo exato." : ""}`,
      };
    }

    case "equivalent": {
      const months = cmd.months ?? 12;
      const free = isTaxFree(cmd.product);
      const other = free ? taxedEquivalent(cmd.pct, months) : taxFreeEquivalent(cmd.pct, months);
      return {
        title: free
          ? `${PRODUCT_LABEL[cmd.product]} a ${pct(cmd.pct)} do CDI empata com um CDB a`
          : `${PRODUCT_LABEL[cmd.product]} a ${pct(cmd.pct)} do CDI empata com uma LCI ou LCA a`,
        value: `${pct(other)} do CDI`,
        lines: [12, 24, 36].filter((m) => m !== months).slice(0, 2).map((m) => ({
          label: `Em ${period(m)}`,
          value: `${pct(free ? taxedEquivalent(cmd.pct, m) : taxFreeEquivalent(cmd.pct, m))} do CDI`,
        })),
        note: `Para ${period(months)}, com Imposto de Renda de ${pct(incomeTaxRate(months) * 100, 1)} no produto tributado.`,
      };
    }

    case "realReturn": {
      if (cmd.inflation === null) {
        return { title: "Para o ganho real, preciso também da inflação", note: `Exemplo: "rendimento real de ${pct(cmd.nominal)} com inflação de 4,5%".` };
      }
      const real = realRate(cmd.nominal / 100, cmd.inflation / 100) * 100;
      return {
        title: `Rendendo ${pct(cmd.nominal)} com inflação de ${pct(cmd.inflation)}`,
        value: `${pct(real)} de ganho real`,
        tone: real >= 0 ? "good" : "bad",
        note: real >= 0
          ? "É quanto o seu poder de compra cresceu de verdade. A conta divide, não subtrai: (1 + rendimento) ÷ (1 + inflação) − 1."
          : "O investimento rendeu menos que a inflação: o dinheiro perdeu poder de compra.",
        chips: ["o que é inflação?", "o que é Tesouro IPCA+?"],
      };
    }

    case "freedom": {
      const monthly = cmd.monthly ?? (plan ? plan.planned || plan.actual : 0);
      if (!monthly) {
        return { title: "Quanto você precisa por mês para viver?", note: "Diga por exemplo \"viver de renda com 5 mil por mês\", ou lance os gastos do mês no planejamento." };
      }
      const target = monthly * FREEDOM_MULTIPLE;
      const aporte = plan && plan.sobraPlanned > 0 ? plan.sobraPlanned : 0;
      const n = aporte ? monthsToTarget(target, aporte, yearToMonth(REAL_RATE_YEAR)) : null;
      const lines: GenieLine[] = [
        { label: "Custo de vida por mês", value: money(monthly) },
        { label: "Rende por mês a 4% ao ano acima da inflação", value: money(target * 0.04 / 12) },
      ];
      if (aporte) lines.push({ label: `Investindo a sobra planejada (${money(aporte)})`, value: n ? longPeriod(n) : "mais de 100 anos", tone: n && n <= 360 ? "good" : "bad" });
      return {
        title: "Para viver de renda você precisa de cerca de",
        value: money(target),
        raw: target,
        lines,
        note: `Regra dos 4%: ${FREEDOM_MULTIPLE} vezes o custo mensal. Projeção em valores de hoje, com rendimento de 4% ao ano acima da inflação.${cmd.monthly === null && plan ? " Usei o planejado do mês como custo de vida." : ""}`,
        chips: ["o que é renda passiva?", "o que é juros compostos?"],
      };
    }

    case "budgetRule": {
      if (!plan || !plan.salary) {
        return {
          title: "Regra 50/30/20",
          text: "Divida a renda em 50% para necessidades (moradia, contas, mercado), 30% para desejos (lazer, assinaturas, compras) e 20% para investir e quitar dívidas.",
          note: "Informe a renda do mês e eu comparo com o seu planejamento.",
        };
      }
      const s = plan.salary;
      const invest = Math.max(0, s - plan.planned);
      const row = (label: string, value: number, ideal: number, overBad: boolean): GenieLine => ({
        label: `${label} (ideal ${ideal}%)`,
        value: `${money(value)} · ${pct((value / s) * 100, 0)}`,
        tone: overBad ? ((value / s) * 100 > ideal + 2 ? "bad" : "good") : ((value / s) * 100 >= ideal - 2 ? "good" : "bad"),
      });
      return {
        title: "Regra 50/30/20 no seu mês",
        lines: [
          row("Necessidades: gastos fixos", plan.fixo, 50, true),
          row("Desejos: gastos variáveis", plan.variavel, 30, true),
          row("Investir: o que sobra do planejado", invest, 20, false),
        ],
        note: "Considerei os gastos fixos como necessidades e os variáveis como desejos; alguns variáveis, como mercado, são necessidade. Use como referência, não como regra rígida.",
        chips: ["dicas para economizar", "se eu cortar 10% dos variáveis?"],
      };
    }

    case "debt": {
      const rotativo = cmd.type === "rotativo";
      const rate = cmd.rateMonth ?? (rotativo ? ROTATIVO_MONTH : CHEQUE_ESPECIAL_MONTH);
      const name = rotativo ? "rotativo do cartão" : "cheque especial";
      const advice = rotativo
        ? "Saia do rotativo o quanto antes: parcelar a fatura ou trocar por um empréstimo pessoal ou consignado costuma custar bem menos."
        : "Troque o saldo negativo por um empréstimo pessoal ou consignado mais barato e use a reserva de emergência, se tiver.";
      const lines: GenieLine[] = [{ label: "Juros", value: `${pct(rate * 100)} ao mês · ${pct(monthToYear(rate) * 100, 0)} ao ano`, tone: "bad" }];
      if (cmd.amount) {
        for (const n of [1, 3, 6, 12]) lines.push({ label: `Sem pagar, em ${period(n)}`, value: money(debtGrowth(cmd.amount, rate, n, rotativo)), tone: "bad" });
      }
      return {
        title: cmd.amount ? `${money(cmd.amount)} no ${name}` : `Juros do ${name}`,
        value: cmd.amount ? undefined : `${pct(rate * 100)} ao mês`,
        tone: "bad",
        lines,
        text: advice,
        note: rotativo
          ? `${cmd.rateMonth === null ? "Usei 14% ao mês, perto da média do mercado; confira a taxa na sua fatura. " : ""}Por lei, os juros e encargos do rotativo não podem passar do valor original da dívida.`
          : `${cmd.rateMonth === null ? "Usei 8% ao mês, o teto permitido por lei; confira a taxa do seu banco. " : ""}`,
        chips: ["quitar dívida ou investir?", "o que é CET?"],
      };
    }

    case "payOrInvest": {
      const investNet = (cdi / 100) * (1 - 0.15);
      const investMonth = yearToMonth(investNet) * 100;
      if (cmd.rateMonth === null) {
        return {
          title: "Quitar a dívida ou investir?",
          text: `Compare os juros da dívida com o rendimento líquido do investimento. Hoje um investimento a 100% do CDI rende cerca de ${pct(investMonth)} ao mês já sem Imposto de Renda: quase toda dívida cobra mais que isso, então quitar costuma ganhar.`,
          lines: [
            { label: "Primeiro", value: "Monte uma reserva de emergência pequena, para não voltar a se endividar." },
            { label: "Depois", value: "Quite as dívidas de juros mais altos primeiro: rotativo, cheque especial, empréstimo pessoal." },
            { label: "Exceção", value: "Dívidas com juros abaixo do rendimento, como alguns financiamentos imobiliários, podem continuar." },
          ],
          note: "Diga a taxa da dívida para eu comparar, por exemplo \"quitar dívida de 3% ao mês ou investir?\".",
        };
      }
      const debtMonth = cmd.rateMonth * 100;
      const pay = debtMonth > investMonth;
      return {
        title: `Dívida a ${pct(debtMonth)} ao mês contra investimento a ${pct(investMonth)} ao mês líquido`,
        value: pay ? "Quite a dívida" : "Pode investir",
        tone: pay ? "good" : undefined,
        lines: [
          { label: "Juros da dívida em 1 ano", value: `${pct(monthToYear(cmd.rateMonth) * 100, 1)}`, tone: "bad" },
          { label: "Investimento em 1 ano, líquido", value: `${pct(investNet * 100, 1)}`, tone: "good" },
        ],
        note: pay
          ? "Cada real usado para quitar \"rende\" os juros que você deixa de pagar, sem risco e sem imposto. Mantenha só uma reserva pequena."
          : "A dívida custa menos que o investimento rende. Mesmo assim, avalie o risco e mantenha as parcelas em dia.",
      };
    }

    case "amortization": {
      const r = amortization(cmd.principal, cmd.months, cmd.rateMonth);
      const saves = r.price.interest - r.sac.interest;
      return {
        title: `${money(cmd.principal)} em ${cmd.months} meses a ${pct(cmd.rateMonth * 100)} ao mês`,
        value: `SAC economiza ${money(saves)}`,
        tone: "good",
        lines: [
          { label: "Price: parcela fixa", value: money(r.price.pmt) },
          { label: "Price: juros no total", value: money(r.price.interest), tone: "bad" },
          { label: "SAC: primeira parcela", value: money(r.sac.first) },
          { label: "SAC: última parcela", value: money(r.sac.last) },
          { label: "SAC: juros no total", value: money(r.sac.interest), tone: "bad" },
        ],
        note: "No SAC as parcelas começam maiores e caem todo mês; na Price são iguais do começo ao fim, mas o total de juros é maior. Sem seguros e taxas do contrato.",
        chips: ["o que é CET?"],
      };
    }
  }
}
