import type { RGB } from "pdf-lib";
import { CONTENT_W, INK, LINE, Layout, MUTED, MX, OK, WARN, brandFooter, brandHeader, hex, safe, type Cell } from "@/lib/report/pdf-layout";
import { brl, capitalize, groupTotals, itemStatus, slug, type PlanReportGroup, type PlanReportItem } from "@/lib/report/plan-share";

export type PlanPdfInput = {
  groups: PlanReportGroup[];
  monthLabel: string;
  userName: string;
  incomes: { description: string; amount: number }[];
  /** Logo completo (rato e nome Muvo) em PNG. */
  logo: Uint8Array;
  generatedAt?: Date;
};

const TYPE_LABEL: Record<PlanReportItem["type"], string> = { fixo: "Fixo", variavel: "Variável" };

function diffCell(i: { planned: number; actual: number }, pending: boolean): Cell {
  if (pending) return { text: "ainda não pago", color: MUTED };
  if (i.planned <= 0) return { text: "sem planejado", color: MUTED };
  const d = i.actual - i.planned;
  if (Math.abs(d) < 0.005) return { text: "no planejado", color: MUTED };
  return d > 0 ? { text: `${brl(d)} acima`, color: WARN } : { text: `${brl(-d)} abaixo`, color: OK };
}

export async function renderPlanPdf(input: PlanPdfInput): Promise<Uint8Array> {
  const month = capitalize(input.monthLabel);
  const when = input.generatedAt ?? new Date();
  const dateStr = when.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const l = await Layout.create(
    (p) => brandHeader(p, "RELATÓRIO DE PLANEJAMENTO", month, `Planejamento · ${month}`, true),
    input.logo,
  );

  const all = input.groups.flatMap((g) => g.items);
  const byType = (t: PlanReportItem["type"]) => groupTotals(all.filter((i) => i.type === t));
  const fixo = byType("fixo");
  const variavel = byType("variavel");
  const total = groupTotals(all);
  const renda = input.incomes.reduce((s, i) => s + i.amount, 0);
  const sobra = renda - total.actual;
  const sobraPlanejada = renda - total.planned;

  // Cliente
  l.y -= 14;
  const top = l.y;
  l.drawAt("PREPARADO PARA", MX, top, { size: 7, bold: true, color: MUTED });
  l.drawAt(input.userName, MX, top - 12, { size: 18, bold: true, width: CONTENT_W * 0.6, lineHeight: 1.2 });
  l.drawAt("GERADO EM", MX, top, { size: 7, bold: true, color: MUTED, align: "right" });
  l.drawAt(dateStr, MX, top - 12, { size: 11, bold: true, align: "right" });
  l.y = top - 44;

  // Indicadores
  const kpis: { label: string; value: string; hint: string; color?: RGB }[] = [
    {
      label: "RENDA DO MÊS",
      value: renda > 0 ? brl(renda) : "Não informada",
      hint: renda > 0 ? `${input.incomes.length} ${input.incomes.length === 1 ? "receita" : "receitas"}` : "informe no app",
    },
    { label: "GASTO REAL", value: brl(total.actual), hint: `de ${brl(total.planned)} planejado`, color: total.planned > 0 && total.actual > total.planned ? WARN : INK },
    { label: "FIXOS", value: brl(fixo.actual), hint: `de ${brl(fixo.planned)}` },
    { label: "VARIÁVEIS", value: brl(variavel.actual), hint: `de ${brl(variavel.planned)}` },
  ];
  if (renda > 0) kpis.push({ label: "SOBRA", value: brl(sobra), hint: `planejada: ${brl(sobraPlanejada)}`, color: sobra >= 0 ? OK : WARN });
  const kw = CONTENT_W / kpis.length;
  const kh = 58;
  l.page.drawRectangle({ x: MX, y: l.y - kh, width: CONTENT_W, height: kh, borderColor: LINE, borderWidth: 1 });
  kpis.forEach((k, i) => {
    const x = MX + i * kw;
    if (i > 0) l.page.drawLine({ start: { x, y: l.y }, end: { x, y: l.y - kh }, thickness: 1, color: LINE });
    l.drawAt(k.label, x + 9, l.y - 9, { size: 6.5, bold: true, color: MUTED, width: kw - 18, lineHeight: 1.2 });
    l.drawAt(k.value, x + 9, l.y - 19, { size: kpis.length > 4 ? 11 : 12.5, bold: true, color: k.color, width: kw - 18, lineHeight: 1.2 });
    l.drawAt(k.hint, x + 9, l.y - 37, { size: 7, color: MUTED, width: kw - 18, lineHeight: 1.25 });
  });
  l.y -= kh;

  if (total.planned > 0) {
    l.y -= 10;
    const pct = Math.min(1, total.actual / total.planned);
    l.page.drawRectangle({ x: MX, y: l.y - 5, width: CONTENT_W, height: 5, color: hex("#E4E4E7") });
    l.page.drawRectangle({ x: MX, y: l.y - 5, width: Math.max(1, CONTENT_W * pct), height: 5, color: total.actual > total.planned ? WARN : INK });
    l.y -= 9;
    l.text(`${Math.round((total.actual / total.planned) * 100)}% do planejado já foi gasto · ${total.paid} de ${all.length} itens pagos`, { size: 7.5, color: MUTED });
  }

  // Grupos
  const groups = input.groups.filter((g) => g.items.length > 0);
  if (groups.length === 0) {
    l.y -= 16;
    l.text("Ainda não há itens planejados neste mês. Adicione seus gastos na tela de Planejamento.", { size: 11 });
  }
  groups.forEach((g, gi) => {
    const t = groupTotals(g.items);
    if (gi === 0) l.section("Gastos por grupo", "Planejado é o que você previu gastar; real é o que já saiu do bolso.", 80);
    l.y -= 12;
    l.ensure(70);
    const headTop = l.y;
    l.page.drawCircle({ x: MX + 4, y: headTop - 6.5, size: 3.5, color: hex(/^#[0-9a-f]{6}$/i.test(g.color) ? g.color : "#0A0A0A") });
    l.drawAt(g.name.toUpperCase(), MX + 13, headTop, { size: 10.5, bold: true, width: CONTENT_W * 0.55, lineHeight: 1.2 });
    const over = t.planned > 0 && t.actual > t.planned;
    l.drawAt(`${brl(t.actual)} de ${brl(t.planned)}`, MX, headTop, { size: 10, bold: true, color: over ? WARN : INK, align: "right", lineHeight: 1.2 });
    l.y = headTop - 18;
    l.table(
      [
        { label: "ITEM", width: 0.34 },
        { label: "PLANEJADO", width: 0.2, align: "right" },
        { label: "REAL", width: 0.2, align: "right" },
        { label: "DIFERENÇA", width: 0.26, align: "right" },
      ],
      g.items.map((i) => {
        const pending = itemStatus(i) === "pendente";
        return [
          { text: i.name, bold: true, sub: TYPE_LABEL[i.type] },
          { text: i.planned > 0 ? brl(i.planned) : "-", color: MUTED },
          { text: pending ? "-" : brl(i.actual), color: pending ? MUTED : INK },
          diffCell(i, pending),
        ];
      }),
      [{ text: "Total do grupo" }, { text: brl(t.planned) }, { text: brl(t.actual) }, diffCell(t, t.paid === 0)],
    );
  });

  // Resumo
  l.section("Resumo do mês", renda > 0 ? "A sobra é a renda menos o que você já gastou: é o que fica livre para investir." : undefined, 120);
  const rows: Cell[][] = [];
  if (renda > 0) {
    rows.push([{ text: "Renda do mês", bold: true }, { text: brl(renda) }, { text: brl(renda) }]);
    input.incomes.forEach((inc) => rows.push([{ text: `   ${inc.description}`, color: MUTED }, { text: brl(inc.amount), color: MUTED }, { text: brl(inc.amount), color: MUTED }]));
  }
  rows.push(
    [{ text: "Gastos fixos" }, { text: brl(fixo.planned) }, { text: brl(fixo.actual) }],
    [{ text: "Gastos variáveis" }, { text: brl(variavel.planned) }, { text: brl(variavel.actual) }],
    [{ text: "Total de gastos", bold: true }, { text: brl(total.planned), bold: true }, { text: brl(total.actual), bold: true }],
  );
  l.table(
    [
      { label: "DESCRIÇÃO", width: 0.52 },
      { label: "PLANEJADO", width: 0.24, align: "right" },
      { label: "REAL", width: 0.24, align: "right" },
    ],
    rows,
    renda > 0
      ? [{ text: "Sobra" }, { text: brl(sobraPlanejada), color: sobraPlanejada >= 0 ? OK : WARN }, { text: brl(sobra), color: sobra >= 0 ? OK : WARN }]
      : undefined,
  );

  brandFooter(l, `MUVO · Planejamento de ${input.userName} · ${month}`);
  l.pdf.setTitle(safe(`Planejamento MUVO · ${month}`));
  l.pdf.setAuthor("MUVO");
  l.pdf.setSubject("Relatório de planejamento");
  l.pdf.setLanguage("pt-BR");
  l.pdf.setCreationDate(when);
  return l.pdf.save();
}

export function planPdfFilename(userName: string, monthLabel: string) {
  return `Planejamento-MUVO-${slug(userName) || "usuario"}-${slug(monthLabel)}.pdf`;
}
