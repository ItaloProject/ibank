export type PlanReportItem = { name: string; type: "fixo" | "variavel"; planned: number; actual: number };
export type PlanReportGroup = { name: string; color: string; items: PlanReportItem[] };

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00A0/g, " ");

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type ItemStatus = "pago" | "pendente" | "acima";

export function itemStatus(i: PlanReportItem): ItemStatus {
  if (i.actual <= 0) return "pendente";
  if (i.planned > 0 && i.actual > i.planned + 0.004) return "acima";
  return "pago";
}

export function groupTotals(items: PlanReportItem[]) {
  const planned = items.reduce((s, i) => s + i.planned, 0);
  const actual = items.reduce((s, i) => s + i.actual, 0);
  return {
    planned,
    actual,
    paid: items.filter((i) => i.actual > 0).length,
    over: items.filter((i) => itemStatus(i) === "acima").length,
  };
}

/** Asterisco, sublinhado, til e crase mudam a formatação no WhatsApp. */
const plain = (text: string) => text.replace(/[*_~`]/g, "").trim();

const EMOJI: Record<ItemStatus, string> = { pago: "✅", pendente: "⏳", acima: "⚠️" };

function itemLine(i: PlanReportItem) {
  const name = plain(i.name);
  const status = itemStatus(i);
  if (status === "pendente") return `${EMOJI.pendente} ${name} · ${brl(i.planned)} planejado`;
  if (status === "acima") return `${EMOJI.acima} ${name} · *${brl(i.actual)}* (${brl(i.actual - i.planned)} acima do planejado)`;
  const of = i.planned > 0 && Math.abs(i.planned - i.actual) >= 0.005 ? ` de ${brl(i.planned)}` : "";
  return `${EMOJI.pago} ${name} · *${brl(i.actual)}*${of}`;
}

/** Mensagem de um grupo pronta para colar no WhatsApp. */
export function groupWhatsAppText(group: PlanReportGroup, monthLabel: string): string {
  const t = groupTotals(group.items);
  const lines = [`*${plain(group.name).toUpperCase()}* · ${capitalize(monthLabel)}`, "_Planejamento do mês_", ""];
  if (group.items.length === 0) lines.push("Nenhum item neste grupo ainda.");
  else lines.push(...group.items.map(itemLine));
  lines.push("", `💰 *Gasto real:* ${brl(t.actual)}`);
  if (t.planned > 0) {
    lines.push(`📋 *Planejado:* ${brl(t.planned)}`);
    const rest = t.planned - t.actual;
    lines.push(rest >= -0.004 ? `✨ *Ainda cabe:* ${brl(Math.max(0, rest))}` : `🔺 *Acima do planejado:* ${brl(-rest)}`);
  }
  if (group.items.length > 0) {
    const n = group.items.length;
    lines.push(`${t.paid} de ${n} ${n === 1 ? "item pago" : "itens pagos"}`);
  }
  lines.push("", "_Organizado no Muvo_");
  return lines.join("\n");
}

export function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
