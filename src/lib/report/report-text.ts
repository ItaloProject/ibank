import { RISK_PROFILES } from "@/lib/rebalance";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number, d = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d })}%`;

export function reportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function firstName(nome: string): string {
  const n = nome.trim().split(/\s+/)[0] ?? "";
  return n ? n[0].toUpperCase() + n.slice(1) : "";
}

const APORTE_ORIGEM: Record<UserSnapshot["aporteOrigem"], string> = {
  meta: "definido na sua meta",
  media: "sua média dos últimos 6 meses",
  padrao: "valor de referência",
};

/** Relatório em texto, com a formatação do WhatsApp (*negrito*, _itálico_). */
export function buildReportText(s: UserSnapshot): string {
  const nome = firstName(s.nome);
  const lines: string[] = [`*Relatório MUVO · ${reportDate(s.geradoEm)}*`, `Olá${nome ? `, ${nome}` : ""}! Aqui está o raio-x da sua carteira.`, ""];
  const plan = s.plan;
  if (!plan || !s.portfolio) {
    lines.push("Ainda não encontrei investimentos cadastrados. Registre suas contas e ativos no MUVO LIVE para receber a análise completa.");
    return lines.join("\n");
  }

  lines.push(
    `*Patrimônio:* ${brl(plan.total)}`,
    `*Rentabilidade esperada:* ${pct(plan.retorno12m, 2)} ao ano nos próximos 12 meses, já sem IR`,
    `*Perfil:* ${RISK_PROFILES[plan.profile].label}${s.profileDefinido ? "" : " (padrão; defina o seu no app)"}`,
    "",
    "*Alocação: atual → alvo*",
    ...plan.buckets.map((b) => `• ${b.label}: ${pct(b.pct, 0)} → ${pct(b.alvoPct, 0)}`),
    `• Reserva de emergência: ${brl(plan.reserva.atual)} de ${brl(plan.reserva.alvo)}${plan.reserva.baseadaEmGastos ? ` (${plan.reserva.meses} meses de gastos)` : ""}`,
  );
  if (plan.caixa > 0) lines.push(`• Saldo parado: ${brl(plan.caixa)}`);
  lines.push(plan.desvio < 5 ? "_Carteira alinhada ao perfil._" : `_${pct(plan.desvio, 0)} da carteira está fora do alvo._`, "");

  if (plan.plano.length > 0) {
    lines.push(`*Plano para o aporte de ${brl(plan.aporte)}* _(${APORTE_ORIGEM[s.aporteOrigem]})_`);
    plan.plano.forEach((a, i) => lines.push(`${i + 1}. ${a.label}: *${brl(a.valor)}*`));
    lines.push("");
  }

  if (plan.sugestoes.length > 0) {
    lines.push("*Sugestões*");
    plan.sugestoes.slice(0, 6).forEach((sug, i) => {
      lines.push(`${i + 1}. *${sug.titulo}*`, `   ${sug.detalhe}`);
    });
    lines.push("");
  }

  const focus = s.rates.focus?.data ? ` e Boletim Focus de ${s.rates.focus.data.split("-").reverse().join("/")}` : "";
  lines.push(`_Taxas do Banco Central${focus}. Análise educativa, não é recomendação de investimento._`);
  return lines.join("\n").slice(0, 4000);
}
