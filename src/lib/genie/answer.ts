import { normalize } from "./calc";
import { similar } from "./fuzzy";
import { findGroup, type GenieCommand, type ItemType } from "./parse";
import { chatReply } from "./chat";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { askAbout, termById, type Term } from "@/lib/glossary";
import { financeAnswer } from "./finance-answer";

export type PlanItem = { id: string; name: string; groupId: string; type: ItemType; planned: number; actual: number };
export type PlanGroup = { id: string; name: string };
export type PlanSnapshot = {
  month: string;
  monthLabel: string;
  salary: number;
  groups: PlanGroup[];
  items: PlanItem[];
  today?: Date;
};

export type Tone = "good" | "bad";
export type GenieLine = { label: string; value: string; tone?: Tone };
export type GenieAnswer = {
  /** Frase curta acima do número. */
  title: string;
  /** Número principal, já formatado. */
  value?: string;
  tone?: Tone;
  lines?: GenieLine[];
  note?: string;
  /** Valor numérico do resultado, reaproveitado em contas seguintes. */
  raw?: number;
  /** Próximos pedidos sugeridos, mostrados como botões na última resposta. */
  chips?: string[];
  /** Explicação em texto corrido, como a definição de um termo. */
  text?: string;
};

/** Resposta pronta em Markdown simples, para o assistente de investimentos. */
export function answerMarkdown(a: GenieAnswer): string {
  const parts = [a.value ? `${a.title}: **${a.value}**` : `**${a.title}**`];
  if (a.text) parts.push(a.text);
  if (a.lines?.length) parts.push(a.lines.map((l) => `- ${l.label}: **${l.value}**`).join("\n"));
  if (a.note) parts.push(a.note);
  return parts.join("\n\n");
}

/** Definição do glossário no formato do Gênio; os botões levam aos termos relacionados. */
export function termAnswer(term: Term): GenieAnswer {
  return {
    title: term.category,
    value: term.name,
    text: term.text,
    lines: term.points?.map((p) => ({ label: p.label, value: p.value })),
    chips: (term.related ?? []).map(termById).filter((x): x is Term => !!x).slice(0, 3).map(askAbout),
  };
}

export const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const plain = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const months = (n: number) => (n === 1 ? "1 mês" : n < 24 || n % 12 ? `${n} meses` : `${n / 12} anos`);
const round2 = (v: number) => Math.round(v * 100) / 100;

const FIXED_HINT = /\b(aluguel|condominio|internet|netflix|spotify|disney|hbo|prime|youtube|assinatura|plano|seguro|financiamento|parcela|escola|faculdade|curso|academia|mensalidade|iptu|ipva|consorcio|celular|telefone)\b/;

/** Tipo de um item novo: o que a pessoa disse; sem isso, palpite pelo nome. */
export function guessType(name: string, said: ItemType | null): ItemType {
  return said ?? (FIXED_HINT.test(normalize(name)) ? "fixo" : "variavel");
}

/** Item do mês com nome parecido, de preferência dentro do grupo indicado. */
export function findItem(name: string, items: PlanItem[], groupId?: string | null): PlanItem | null {
  const n = normalize(name);
  if (!n) return null;
  const pool = groupId ? items.filter((i) => i.groupId === groupId) : items;
  const norm = pool.map((i) => [i, normalize(i.name)] as const);
  return norm.find(([, x]) => x === n)?.[0]
    ?? norm.find(([, x]) => x.startsWith(n) || n.startsWith(x))?.[0]
    ?? norm.find(([, x]) => x.includes(n) || (n.length >= 4 && n.includes(x)))?.[0]
    ?? norm.find(([, x]) => similar(n, x))?.[0]
    ?? null;
}

function totals(s: PlanSnapshot) {
  const sum = (xs: PlanItem[], k: "planned" | "actual") => xs.reduce((t, i) => t + i[k], 0);
  const fixos = s.items.filter((i) => i.type === "fixo");
  const vars = s.items.filter((i) => i.type === "variavel");
  const planned = sum(s.items, "planned");
  const actual = sum(s.items, "actual");
  return {
    planned, actual,
    fixoPlanned: sum(fixos, "planned"), fixoActual: sum(fixos, "actual"),
    varPlanned: sum(vars, "planned"), varActual: sum(vars, "actual"),
    sobra: s.salary - actual,
    sobraPlanned: s.salary - planned,
  };
}

/** "variáveis", "fixos", nome de grupo ou de item → itens correspondentes. */
export function resolveTarget(target: string, s: PlanSnapshot): { label: string; items: PlanItem[] } | null {
  const t = normalize(target).replace(/^(os|as|meus|minhas|gastos?|itens?)\s+/, "");
  if (/^(variave(l|is)|gastos? variave(l|is))$/.test(t)) return { label: "gastos variáveis", items: s.items.filter((i) => i.type === "variavel") };
  if (/^(fix[oa]s?|gastos? fix[oa]s?)$/.test(t)) return { label: "gastos fixos", items: s.items.filter((i) => i.type === "fixo") };
  if (/^(tudo|todos?|geral|gastos?|despesas?|total|mes)$/.test(t)) return { label: "todos os gastos", items: s.items };
  const g = findGroup(t, s.groups.map((x) => x.name));
  if (g) {
    const group = s.groups.find((x) => x.name === g)!;
    return { label: group.name, items: s.items.filter((i) => i.groupId === group.id) };
  }
  const item = findItem(t, s.items);
  return item ? { label: item.name, items: [item] } : null;
}

/** Dias que faltam no mês, contando hoje; o mês inteiro se não for o mês atual. */
function daysLeft(s: PlanSnapshot): { days: number; current: boolean } {
  const today = s.today ?? new Date();
  const [y, m] = s.month.split("-").map(Number);
  const total = new Date(y, m, 0).getDate();
  const current = today.getFullYear() === y && today.getMonth() + 1 === m;
  return { days: current ? total - today.getDate() + 1 : total, current };
}

export function compound(initial: number, monthly: number, rateMonth: number, n: number) {
  const g = Math.pow(1 + rateMonth, n);
  const fv = initial * g + (rateMonth ? monthly * ((g - 1) / rateMonth) : monthly * n);
  const invested = initial + monthly * n;
  return { fv: round2(fv), invested: round2(invested), interest: round2(fv - invested) };
}

export function installment(principal: number, n: number, rateMonth: number) {
  const pmt = rateMonth ? (principal * rateMonth) / (1 - Math.pow(1 + rateMonth, -n)) : principal / n;
  return { pmt: round2(pmt), total: round2(pmt * n), interest: round2(pmt * n - principal) };
}

/** Resposta pronta para contas, simulações e consultas; null para ações e pedidos que vão à inteligência artificial. */
export function answer(cmd: GenieCommand, s: PlanSnapshot): GenieAnswer | null {
  const t = totals(s);
  switch (cmd.kind) {
    case "calc":
      return { title: cmd.expr.replace(/\*/g, "×").replace(/\//g, "÷"), value: plain(cmd.value), raw: cmd.value };

    case "compound": {
      const r = compound(cmd.initial, cmd.monthly, cmd.rateMonth, cmd.months);
      return {
        title: `Em ${months(cmd.months)}, a ${cmd.rateLabel}`,
        value: money(r.fv),
        raw: r.fv,
        tone: "good",
        lines: [
          ...(cmd.initial ? [{ label: "Valor inicial", value: money(cmd.initial) }] : []),
          ...(cmd.monthly ? [{ label: "Por mês", value: money(cmd.monthly) }] : []),
          { label: "Total que você colocou", value: money(r.invested) },
          { label: "Rendimento", value: money(r.interest), tone: "good" as const },
        ],
        note: "Simulação sem Imposto de Renda e com taxa constante no período.",
      };
    }

    case "installment": {
      const r = installment(cmd.principal, cmd.parcelas, cmd.rateMonth);
      const fitsIn = s.salary > 0 ? r.pmt / s.salary : null;
      return {
        title: `${cmd.parcelas}x de`,
        value: money(r.pmt),
        raw: r.pmt,
        lines: [
          { label: "Valor financiado", value: money(cmd.principal) },
          { label: "Total pago", value: money(r.total) },
          ...(r.interest > 0.005 ? [{ label: "Juros no total", value: money(r.interest), tone: "bad" as const }] : []),
          ...(fitsIn !== null ? [{ label: "Parte da sua renda", value: `${plain(fitsIn * 100)}%`, tone: fitsIn > 0.3 ? ("bad" as const) : undefined }] : []),
        ],
        note: cmd.rateMonth ? undefined : "Sem juros: o valor dividido igualmente.",
      };
    }

    case "save": {
      if (cmd.months) {
        const per = round2(cmd.total / cmd.months);
        const gap = round2(per - t.sobraPlanned);
        return {
          title: `Para juntar ${money(cmd.total)} em ${months(cmd.months)}`,
          value: `${money(per)} por mês`,
          raw: per,
          lines: s.salary > 0 ? [
            { label: "Sobra planejada do mês", value: money(t.sobraPlanned) },
            gap > 0
              ? { label: "Falta cortar por mês", value: money(gap), tone: "bad" }
              : { label: "Cabe na sobra, e ainda fica", value: money(-gap), tone: "good" },
          ] : undefined,
        };
      }
      const monthly = cmd.monthly ?? 0;
      const n = Math.ceil(cmd.total / monthly);
      return { title: `Guardando ${money(monthly)} por mês`, value: months(n), raw: n, note: `Para chegar a ${money(cmd.total)}, sem contar rendimento.` };
    }

    case "cut": {
      const target = resolveTarget(cmd.target, s);
      if (!target) return { title: `Não encontrei "${cmd.target}" no seu planejamento.`, note: "Tente o nome de um grupo, de um item, \"fixos\" ou \"variáveis\"." };
      const base = target.items.reduce((sum, i) => sum + (i.planned || i.actual), 0);
      const saving = round2(cmd.pct !== null ? (base * cmd.pct) / 100 : Math.min(cmd.value ?? 0, base));
      return {
        title: `Cortando ${cmd.pct !== null ? `${plain(cmd.pct)}%` : money(cmd.value ?? 0)} de ${target.label}`,
        value: `+ ${money(saving)} por mês`,
        raw: saving,
        tone: "good",
        lines: [
          { label: `Hoje em ${target.label}`, value: money(base) },
          { label: "Em 12 meses", value: money(saving * 12), tone: "good" },
          ...(s.salary > 0 ? [{ label: "Nova sobra planejada", value: money(t.sobraPlanned + saving), tone: t.sobraPlanned + saving >= 0 ? ("good" as const) : ("bad" as const) }] : []),
        ],
      };
    }

    case "query":
      return query(cmd.topic, cmd.target, s, t);

    case "chat":
      return chatReply(cmd.topic);

    case "term": {
      const term = termById(cmd.ids[0]);
      return term ? termAnswer(term) : null;
    }

    case "netYield": case "compareYield": case "equivalent": case "realReturn": case "freedom":
    case "budgetRule": case "debt": case "payOrInvest": case "amortization":
      return financeAnswer(cmd, FALLBACK_CDI, {
        salary: s.salary, planned: t.planned, actual: t.actual,
        fixo: t.fixoPlanned, variavel: t.varPlanned, sobraPlanned: t.sobraPlanned,
      });

    case "help":
      return {
        title: "Eu calculo e organizo seu mês",
        lines: [
          { label: "Contas", value: "15% de 3.000 · 1.200 em 12x" },
          { label: "Itens", value: "adicionar Netflix 55 em Assinaturas" },
          { label: "Gastos", value: "gastei 80 no mercado" },
          { label: "Grupos", value: "novo grupo · criar grupo Lazer" },
          { label: "Ajustes", value: "muda aluguel para 1.900 · apagar Netflix" },
          { label: "Na sequência", value: "e o Spotify 22 · na verdade é 60 · mais 20 nele · coloque como real" },
          { label: "Gasto real", value: "considere os próximos como gasto real · voltar ao planejado" },
          { label: "Um grupo só", value: "considere os próximos itens no cartão (como reais) · sair do cartão" },
          { label: "Renda", value: "recebi 800 de freela" },
          { label: "Planos", value: "quanto posso gastar por dia?" },
          { label: "Simulações", value: "500 por mês a 1% ao mês por 2 anos" },
          { label: "Investimentos", value: "quanto rendem 10 mil no CDB a 110% do CDI em 2 anos · LCI a 90% ou CDB a 110%?" },
          { label: "Metas", value: "viver de renda · regra 50/30/20" },
          { label: "Dívidas", value: "2.000 no rotativo · quitar dívida de 3% ao mês ou investir? · SAC ou Price" },
          { label: "Termos", value: "o que é CDB? · diferença entre LCI e CDB" },
        ],
      };

    default:
      return null;
  }
}

function query(topic: Extract<GenieCommand, { kind: "query" }>["topic"], target: string | null, s: PlanSnapshot, t: ReturnType<typeof totals>): GenieAnswer {
  const noSalary = { title: "Informe a renda do mês primeiro", note: "Toque em \"Renda do mês\" no topo, ou escreva por exemplo \"recebi 5.000 de salário\"." };
  switch (topic) {
    case "sobra":
      if (!s.salary) return noSalary;
      return {
        title: t.sobra >= 0 ? `Sobra de ${s.monthLabel}` : `${s.monthLabel}: passou da renda`,
        value: money(Math.abs(t.sobra)),
        raw: t.sobra,
        tone: t.sobra >= 0 ? "good" : "bad",
        lines: [
          { label: "Renda", value: money(s.salary) },
          { label: "Gasto até agora", value: money(t.actual) },
          { label: "Se gastar o planejado", value: money(t.sobraPlanned), tone: t.sobraPlanned >= 0 ? "good" : "bad" },
        ],
      };

    case "dia": {
      if (!s.salary) return noSalary;
      const { days, current } = daysLeft(s);
      const pending = s.items.reduce((sum, i) => sum + Math.max(0, i.planned - i.actual), 0);
      const free = t.sobra - pending;
      const perDay = round2(Math.max(0, free) / days);
      return {
        title: current ? `Livre por dia nos ${days} dias que faltam` : `Livre por dia em ${s.monthLabel}`,
        value: money(perDay),
        raw: perDay,
        tone: free > 0 ? "good" : "bad",
        lines: [
          { label: "Sobra hoje", value: money(t.sobra) },
          { label: "Contas planejadas ainda a pagar", value: money(pending) },
          { label: "Livre de verdade", value: money(free), tone: free >= 0 ? "good" : "bad" },
          { label: "Por semana", value: money(perDay * 7) },
        ],
        note: free > 0 ? undefined : "O que falta pagar do planejado já consome a sobra.",
      };
    }

    case "gasto": {
      const tg = target ? resolveTarget(target, s) : { label: "o mês", items: s.items };
      if (!tg) return { title: `Não encontrei "${target}" no seu planejamento.` };
      const actual = tg.items.reduce((sum, i) => sum + i.actual, 0);
      const planned = tg.items.reduce((sum, i) => sum + i.planned, 0);
      const over = actual > planned && planned > 0;
      return {
        title: `Gasto em ${tg.label}`,
        value: money(actual),
        raw: actual,
        tone: over ? "bad" : undefined,
        lines: [
          { label: "Planejado", value: money(planned) },
          planned > 0
            ? over
              ? { label: "Passou", value: money(actual - planned), tone: "bad" }
              : { label: "Ainda cabe", value: money(planned - actual), tone: "good" }
            : { label: "Itens", value: String(tg.items.length) },
        ],
      };
    }

    case "renda":
      if (!s.salary) return noSalary;
      return { title: `Renda de ${s.monthLabel}`, value: money(s.salary), raw: s.salary };

    case "fixos": {
      const pct = (v: number) => (s.salary ? ` · ${plain((v / s.salary) * 100)}% da renda` : "");
      return {
        title: "Fixos e variáveis",
        lines: [
          { label: "Fixos planejados", value: money(t.fixoPlanned) + pct(t.fixoPlanned) },
          { label: "Variáveis planejados", value: money(t.varPlanned) + pct(t.varPlanned) },
          { label: "Fixos gastos", value: money(t.fixoActual) },
          { label: "Variáveis gastos", value: money(t.varActual) },
        ],
        note: s.salary && t.fixoPlanned / s.salary > 0.5 ? "Os fixos passam da metade da renda: é onde um corte rende mais todo mês." : undefined,
      };
    }

    case "maiores": {
      const top = [...s.items].sort((a, b) => (b.actual || b.planned) - (a.actual || a.planned)).slice(0, 5);
      if (!top.length) return { title: "Ainda não há itens neste mês." };
      return {
        title: "Onde mais vai dinheiro",
        lines: top.map((i) => ({ label: i.name, value: money(i.actual || i.planned) + (i.actual ? "" : " planejado") })),
      };
    }

    case "estourados": {
      const over = s.items.filter((i) => i.planned > 0 && i.actual > i.planned);
      if (!over.length) return { title: "Nenhum item passou do planejado", tone: "good", value: "Tudo dentro" };
      return {
        title: `${over.length} ${over.length === 1 ? "item passou" : "itens passaram"} do planejado`,
        value: money(over.reduce((sum, i) => sum + i.actual - i.planned, 0)),
        tone: "bad",
        lines: over.map((i) => ({ label: i.name, value: `+ ${money(i.actual - i.planned)}`, tone: "bad" as const })),
      };
    }

    case "dicas":
      return tips(s, t);

    case "resumo":
      return {
        title: `Resumo de ${s.monthLabel}`,
        value: s.salary ? money(t.sobra) : undefined,
        tone: t.sobra >= 0 ? "good" : "bad",
        lines: [
          { label: "Renda", value: s.salary ? money(s.salary) : "não informada" },
          { label: "Planejado", value: money(t.planned) },
          { label: "Gasto", value: money(t.actual) },
          { label: "Grupos e itens", value: `${s.groups.length} grupos · ${s.items.length} itens` },
        ],
        note: s.salary ? (t.sobra >= 0 ? "O número grande é a sobra até agora." : "O número grande é quanto passou da renda.") : undefined,
      };
  }
}

/** Dicas tiradas só do planejamento do mês, calculadas no aparelho. */
function tips(s: PlanSnapshot, t: ReturnType<typeof totals>): GenieAnswer {
  if (!s.salary) {
    return {
      title: "Para dar dicas, preciso da sua renda do mês",
      note: "Toque em \"Renda do mês\" no topo, ou escreva por exemplo \"recebi 5.000 de salário\".",
    };
  }
  const lines: GenieLine[] = [];
  const { days, current } = daysLeft(s);
  const pending = s.items.reduce((sum, i) => sum + Math.max(0, i.planned - i.actual), 0);
  const free = t.sobra - pending;
  if (free > 0) {
    const perDay = round2(free / days);
    lines.push({ label: "Gasto do dia", value: `Até ${money(perDay)} por dia${current ? " até o fim do mês" : ""}. O que não usar num dia vira sobra.` });
  } else if (s.items.length) {
    lines.push({ label: "Atenção", value: `O que falta pagar (${money(pending)}) já consome a sobra. Segure os gastos variáveis até o mês fechar.`, tone: "bad" });
  }

  const over = s.items.filter((i) => i.planned > 0 && i.actual > i.planned).sort((a, b) => (b.actual - b.planned) - (a.actual - a.planned));
  if (over.length) {
    const names = over.slice(0, 2).map((i) => i.name).join(" e ");
    const extra = over.reduce((sum, i) => sum + i.actual - i.planned, 0);
    lines.push({ label: "Passou do planejado", value: `${names}${over.length > 2 ? ` e mais ${over.length - 2}` : ""}: ${money(extra)} acima. Ajuste o planejado ou compense em outro item.`, tone: "bad" });
  }

  if (t.sobraPlanned < 0) {
    lines.push({ label: "Planejado", value: `O planejado passa da renda em ${money(-t.sobraPlanned)}. Comece cortando os gastos variáveis.`, tone: "bad" });
  }

  if (t.fixoPlanned / s.salary > 0.5) {
    lines.push({ label: "Fixos", value: `Os fixos levam ${plain((t.fixoPlanned / s.salary) * 100)}% da renda. Renegociar um plano, seguro ou assinatura rende todo mês.` });
  }

  const topVar = [...s.items].filter((i) => i.type === "variavel").sort((a, b) => (b.planned || b.actual) - (a.planned || a.actual))[0];
  const topBase = topVar ? topVar.planned || topVar.actual : 0;
  if (topVar && topBase >= 50) {
    const cut = round2(topBase * 0.1);
    lines.push({ label: "Corte pequeno", value: `Cortar 10% de ${topVar.name} libera ${money(cut)} por mês, ${money(cut * 12)} em um ano.` });
  }

  if (t.sobraPlanned > 0) {
    const monthlyCost = t.planned || t.actual;
    if (monthlyCost > 0) {
      const reserve = round2(monthlyCost * 6);
      const n = Math.ceil(reserve / t.sobraPlanned);
      lines.push({
        label: "Reserva de emergência",
        value: n <= 120
          ? `Seis meses de gastos dão ${money(reserve)}. Guardando a sobra planejada todo mês, você chega lá em ${months(n)}.`
          : `Seis meses de gastos dão ${money(reserve)}. Com a sobra de hoje levaria mais de 10 anos: vale aumentar a sobra antes.`,
      });
    }
    const rateMonth = Math.pow(1 + FALLBACK_CDI / 100, 1 / 12) - 1;
    const year = compound(0, t.sobraPlanned, rateMonth, 12);
    lines.push({ label: "Investir a sobra", value: `Guardar ${money(t.sobraPlanned)} por mês a 100% do CDI vira cerca de ${money(year.fv)} em um ano, ${money(year.interest)} só de rendimento.`, tone: "good" });
  }

  if (!lines.length) {
    lines.push({ label: "Comece por aqui", value: "Lance os itens do mês, como aluguel, mercado e contas, para eu calcular dicas com os seus números." });
  }

  return {
    title: `Dicas com os seus números de ${s.monthLabel}`,
    lines: lines.slice(0, 5),
    note: "Calculado aqui no aparelho com o seu planejamento. Rendimento estimado sem Imposto de Renda.",
    chips: ["se eu cortar 10% dos variáveis?", "onde mais gasto?", "quanto posso gastar por dia?"],
  };
}
