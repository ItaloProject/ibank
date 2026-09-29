import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { BUCKET_LABEL, MIN_INVESTIDO_ALOCACAO, RISK_PROFILES, alocacaoRelevante, bucketOf, type Suggestion } from "@/lib/rebalance";
import type { AssetClass } from "@/lib/portfolio-return";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";
import { reportDate } from "@/lib/report/report-text";

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex("#0A0A0A");
const MUTED = hex("#6B6B6B");
const LINE = hex("#E4E4E7");
const SOFT = hex("#F4F4F5");
const WARN = hex("#B45309");
const OK = hex("#047857");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MX = 44;
const TOP = 40;
const BOTTOM = 50;
const CONTENT_W = PAGE_W - MX * 2;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number, d = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d })}%`;

const CLASSE_LABEL: Record<AssetClass, string> = {
  turbo: "Caixinha Turbo",
  emergencia: "Reserva de emergência",
  renda_fixa: "Renda fixa",
  acoes: "Ações",
  fiis: "Fundos imobiliários",
  caixa: "Saldo em conta",
};

const PRIORIDADE: Record<Suggestion["prioridade"], { label: string; color: RGB }> = {
  alta: { label: "PRIORIDADE ALTA", color: WARN },
  media: { label: "PRIORIDADE MÉDIA", color: INK },
  baixa: { label: "PRIORIDADE BAIXA", color: MUTED },
};

const APORTE_ORIGEM: Record<UserSnapshot["aporteOrigem"], string> = {
  meta: "valor definido na sua meta",
  media: "média dos últimos 6 meses",
  padrao: "referência; defina sua meta",
};

/** As fontes padrão do PDF só codificam WinAnsi; o resto viraria erro na geração. */
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
function safe(text: string): string {
  return text
    .replace(/\u00A0|\u202F/g, " ")
    .replace(/→/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[\r\t]/g, " ")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return c === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c);
    })
    .join("");
}

type TextOpts = { size?: number; bold?: boolean; color?: RGB; width?: number; lineHeight?: number; align?: "left" | "right" };
type Cell = { text: string; bold?: boolean; color?: RGB; sub?: string };
type Column = { label: string; width: number; align?: "left" | "right" };

class Layout {
  page!: PDFPage;
  y = 0;
  private constructor(readonly pdf: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly onPage: (l: Layout) => void) {}

  static async create(onPage: (l: Layout) => void) {
    const pdf = await PDFDocument.create();
    const l = new Layout(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold), onPage);
    l.addPage();
    return l;
  }

  addPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - TOP;
    this.onPage(this);
  }

  /** Garante espaço vertical; senão, quebra a página. */
  ensure(h: number) {
    if (this.y - h < BOTTOM) this.addPage();
  }

  font(bold?: boolean) {
    return bold ? this.bold : this.regular;
  }

  width(text: string, size: number, bold?: boolean) {
    return this.font(bold).widthOfTextAtSize(safe(text), size);
  }

  wrap(text: string, size: number, maxW: number, bold?: boolean): string[] {
    const f = this.font(bold);
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) <= maxW || !line) line = next;
        else {
          out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  /** Altura que um texto ocupa, sem desenhar. */
  measure(text: string, o: TextOpts = {}) {
    const size = o.size ?? 9.5;
    return this.wrap(text, size, o.width ?? CONTENT_W, o.bold).length * size * (o.lineHeight ?? 1.4);
  }

  /** Desenha a partir de (x, top) e devolve a altura usada. */
  drawAt(text: string, x: number, top: number, o: TextOpts = {}) {
    const size = o.size ?? 9.5;
    const lh = size * (o.lineHeight ?? 1.4);
    const w = o.width ?? CONTENT_W;
    const f = this.font(o.bold);
    const lines = this.wrap(text, size, w, o.bold);
    lines.forEach((line, i) => {
      const lx = o.align === "right" ? x + w - f.widthOfTextAtSize(line, size) : x;
      this.page.drawText(line, { x: lx, y: top - size - i * lh + (lh - size) / 2 - 1, size, font: f, color: o.color ?? INK });
    });
    return lines.length * lh;
  }

  /** Texto no fluxo, com quebra de página por linha. */
  text(text: string, o: TextOpts & { gap?: number } = {}) {
    const size = o.size ?? 9.5;
    const lh = size * (o.lineHeight ?? 1.4);
    for (const line of this.wrap(text, size, o.width ?? CONTENT_W, o.bold)) {
      this.ensure(lh);
      this.y -= this.drawAt(line, MX, this.y, { ...o, width: o.width ?? CONTENT_W });
    }
    this.y -= o.gap ?? 0;
  }

  rule(color = LINE, thickness = 0.75) {
    this.page.drawLine({ start: { x: MX, y: this.y }, end: { x: PAGE_W - MX, y: this.y }, thickness, color });
  }

  section(title: string, lead?: string, keepWith = 60) {
    this.y -= 20;
    this.ensure(30 + keepWith);
    this.text(title, { size: 12, bold: true, gap: 2 });
    if (lead) this.text(lead, { color: MUTED, gap: 6 });
  }

  table(columns: Column[], rows: Cell[][], total?: Cell[]) {
    const pad = 6;
    const widths = columns.map((c) => c.width * CONTENT_W);
    const header = () => {
      this.ensure(18);
      this.page.drawRectangle({ x: MX, y: this.y - 16, width: CONTENT_W, height: 16, color: SOFT });
      let x = MX;
      columns.forEach((c, i) => {
        this.drawAt(c.label, x + pad, this.y - 3.5, { size: 7, bold: true, color: MUTED, width: widths[i] - pad * 2, align: c.align, lineHeight: 1.2 });
        x += widths[i];
      });
      this.y -= 16;
    };
    const drawRow = (cells: Cell[], isTotal: boolean) => {
      const heights = cells.map((cell, i) => {
        const w = widths[i] - pad * 2;
        return this.measure(cell.text, { width: w, bold: cell.bold || isTotal }) + (cell.sub ? this.measure(cell.sub, { width: w, size: 7.5 }) : 0);
      });
      const h = Math.max(...heights) + 10;
      if (this.y - h < BOTTOM) {
        this.addPage();
        header();
      }
      let x = MX;
      cells.forEach((cell, i) => {
        const w = widths[i] - pad * 2;
        const used = this.drawAt(cell.text, x + pad, this.y - 5, { width: w, bold: cell.bold || isTotal, color: cell.color, align: columns[i].align });
        if (cell.sub) this.drawAt(cell.sub, x + pad, this.y - 5 - used, { width: w, size: 7.5, color: MUTED, align: columns[i].align });
        x += widths[i];
      });
      this.y -= h;
      if (!isTotal) this.rule();
    };
    header();
    rows.forEach((r) => drawRow(r, false));
    if (total) drawRow(total, true);
  }
}

export async function renderReportPdf(s: UserSnapshot): Promise<Uint8Array> {
  const plan = s.plan;
  const portfolio = s.portfolio;
  const dataStr = reportDate(s.geradoEm);
  const hora = new Date(s.geradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const l = await Layout.create((p) => {
    p.drawAt("MUVO", MX, p.y, { size: 20, bold: true });
    p.drawAt("RELATÓRIO DE CARTEIRA", MX, p.y - 1, { size: 7, bold: true, color: MUTED, align: "right", lineHeight: 1.2 });
    p.drawAt(`${dataStr} às ${hora}`, MX, p.y - 11, { size: 9, align: "right", lineHeight: 1.2 });
    p.y -= 32;
    p.rule(INK, 1.5);
    p.y -= 4;
  });

  // Cliente
  l.y -= 14;
  const perfil = plan ? RISK_PROFILES[plan.profile] : RISK_PROFILES.moderado;
  const clientTop = l.y;
  l.drawAt("PREPARADO PARA", MX, clientTop, { size: 7, bold: true, color: MUTED });
  l.drawAt(s.nome, MX, clientTop - 12, { size: 18, bold: true, width: CONTENT_W * 0.6, lineHeight: 1.2 });
  l.drawAt("PERFIL DE RISCO", MX, clientTop, { size: 7, bold: true, color: MUTED, align: "right" });
  l.drawAt(perfil.label, MX, clientTop - 12, { size: 11, bold: true, align: "right" });
  l.drawAt(s.profileDefinido ? perfil.descricao : "Padrão. Defina o seu perfil no app.", MX, clientTop - 28, { size: 7.5, color: MUTED, align: "right" });
  l.y = clientTop - 48;

  if (!plan || !portfolio) {
    l.y -= 10;
    l.text("Ainda não encontramos investimentos cadastrados. Registre suas contas e ativos no MUVO LIVE para receber a análise completa.", { size: 11 });
    return finish(l, s, dataStr);
  }

  const rows = portfolio.rows;
  const total = plan.total;
  const reservaOk = plan.reserva.atual >= plan.reserva.alvo - 1;
  const reservaPct = plan.reserva.alvo > 0 ? Math.min(100, (plan.reserva.atual / plan.reserva.alvo) * 100) : 100;

  // Indicadores
  const kpis: { label: string; value: string; hint: string; color?: RGB }[] = [
    { label: "PATRIMÔNIO", value: brl(total), hint: `${rows.length} ${rows.length === 1 ? "posição" : "posições"}` },
    { label: "RENDE EM 12 MESES", value: pct(plan.retorno12m, 2), hint: "esperado, já sem IR" },
    {
      label: "RESERVA DE EMERGÊNCIA",
      value: brl0(plan.reserva.atual),
      hint: `de ${brl0(plan.reserva.alvo)}${plan.reserva.baseadaEmGastos ? ` (${plan.reserva.meses} meses de gastos)` : " (mínimo)"}`,
      color: reservaOk ? OK : WARN,
    },
    { label: "APORTE DO MÊS", value: brl0(plan.aporte), hint: APORTE_ORIGEM[s.aporteOrigem] },
  ];
  const kw = CONTENT_W / kpis.length;
  const kh = 58;
  l.page.drawRectangle({ x: MX, y: l.y - kh, width: CONTENT_W, height: kh, borderColor: LINE, borderWidth: 1 });
  kpis.forEach((k, i) => {
    const x = MX + i * kw;
    if (i > 0) l.page.drawLine({ start: { x, y: l.y }, end: { x, y: l.y - kh }, thickness: 1, color: LINE });
    l.drawAt(k.label, x + 9, l.y - 9, { size: 6.5, bold: true, color: MUTED, width: kw - 18, lineHeight: 1.2 });
    l.drawAt(k.value, x + 9, l.y - 19, { size: 12.5, bold: true, color: k.color, width: kw - 18, lineHeight: 1.2 });
    l.drawAt(k.hint, x + 9, l.y - 36, { size: 7, color: MUTED, width: kw - 18, lineHeight: 1.25 });
  });
  l.y -= kh;

  // Posições
  const estimadas = rows.some((r) => r.origem === "estimada");
  l.section("Suas posições", "Saldos cadastrados no MUVO e cotações de mercado do dia.");
  l.table(
    [
      { label: "POSIÇÃO", width: 0.3 },
      { label: "RENTABILIDADE CONSIDERADA", width: 0.38 },
      { label: "VALOR", width: 0.19, align: "right" },
      { label: "% DO TOTAL", width: 0.13, align: "right" },
    ],
    rows.map((r) => [
      { text: r.nome, bold: true, sub: CLASSE_LABEL[r.classe] },
      { text: `${r.fonte}${r.origem === "estimada" ? " *" : ""}`, color: r.origem === "estimada" ? WARN : INK },
      { text: brl(r.valor) },
      { text: pct((r.valor / total) * 100) },
    ]),
    [{ text: "Total" }, { text: "" }, { text: brl(total) }, { text: "100%" }],
  );
  if (estimadas) {
    l.y -= 4;
    l.text("* Taxa não cadastrada: estimamos 100% do CDI. Cadastre a rentabilidade da conta no app para um resultado exato.", { size: 7.5, color: MUTED });
  }

  // Ações e FIIs
  const acoes = s.holdings.filter((h) => h.kind === "acao");
  const fiis = s.holdings.filter((h) => h.kind === "fii");
  if (acoes.length + fiis.length > 0) {
    l.section("Ações e fundos imobiliários", "Quantidade da sua carteira multiplicada pela cotação atual.");
    l.table(
      [
        { label: "ATIVO", width: 0.3 },
        { label: "TIPO", width: 0.3 },
        { label: "VALOR", width: 0.2, align: "right" },
        { label: "% DA CLASSE", width: 0.2, align: "right" },
      ],
      [...acoes, ...fiis].map((h) => {
        const soma = (h.kind === "acao" ? acoes : fiis).reduce((acc, x) => acc + x.valor, 0);
        return [
          { text: h.ticker, bold: true },
          { text: h.kind === "acao" ? "Ação" : "Fundo imobiliário" },
          { text: brl(h.valor) },
          { text: pct(soma > 0 ? (h.valor / soma) * 100 : 0, 0) },
        ];
      }),
    );
  }

  // Reserva
  l.section(
    "Reserva de emergência",
    plan.reserva.baseadaEmGastos
      ? `Meta de ${plan.reserva.meses} meses dos seus gastos médios no Planejamento. Contas de reserva e aplicações pós-fixadas com liquidez contam aqui.`
      : "Sem gastos cadastrados no Planejamento, usamos uma reserva mínima de referência.",
    40,
  );
  l.drawAt(`${brl0(plan.reserva.atual)} de ${brl0(plan.reserva.alvo)}`, MX, l.y, { bold: true });
  l.drawAt(
    reservaOk ? "Completa" : `Faltam ${brl0(plan.reserva.alvo - plan.reserva.atual)} (${pct(reservaPct, 0)} concluída)`,
    MX, l.y, { color: reservaOk ? OK : WARN, align: "right" },
  );
  l.y -= 18;
  l.page.drawRectangle({ x: MX, y: l.y - 6, width: CONTENT_W, height: 6, color: SOFT });
  l.page.drawRectangle({ x: MX, y: l.y - 6, width: Math.max(4, (CONTENT_W * reservaPct) / 100), height: 6, color: reservaOk ? OK : WARN });
  l.y -= 6;
  const naReserva = rows.filter((r) => ["reserva", "pos"].includes(bucketOf(r))).map((r) => r.nome);
  if (plan.reserva.atual > 0 && naReserva.length > 0) {
    l.y -= 6;
    l.text(`Contam como reserva: ${naReserva.join(", ")}.`, { size: 7.5, color: MUTED });
  }

  // Alocação
  if (alocacaoRelevante(plan)) {
    l.section(
      `Alocação pelo perfil ${perfil.label.toLowerCase()}`,
      `Comparação do dinheiro fora da reserva (${brl0(plan.investido)}) com a alocação-alvo do perfil.`,
    );
    l.table(
      [
        { label: "CLASSE", width: 0.34 },
        { label: "VALOR", width: 0.17, align: "right" },
        { label: "ATUAL", width: 0.12, align: "right" },
        { label: "ALVO", width: 0.12, align: "right" },
        { label: "PARA O ALVO", width: 0.25, align: "right" },
      ],
      plan.buckets.map((b) => [
        { text: b.label },
        { text: brl0(b.valor) },
        { text: pct(b.pct, 0), color: Math.abs(b.pct - b.alvoPct) >= 10 ? WARN : INK },
        { text: pct(b.alvoPct, 0) },
        { text: Math.abs(b.diff) < 1 ? "no alvo" : b.diff > 0 ? `faltam ${brl0(b.diff)}` : `sobram ${brl0(-b.diff)}`, color: MUTED },
      ]),
    );
    l.y -= 4;
    l.text(
      plan.desvio < 5 ? "Carteira alinhada ao perfil." : `${pct(plan.desvio, 0)} dessa parte está fora do alvo. Os aportes corrigem aos poucos, sem precisar vender.`,
      { size: 7.5, color: MUTED },
    );
  } else {
    l.section(
      `Alocação pelo perfil ${perfil.label.toLowerCase()}`,
      `Fora da reserva há ${brl0(plan.investido)}. Com um valor tão pequeno, os percentuais por classe distorcem mais do que ajudam; a comparação com o perfil aparece quando esse valor passar de ${brl0(MIN_INVESTIDO_ALOCACAO)}.`,
      0,
    );
  }

  // Plano de aporte
  if (plan.plano.length > 0) {
    l.section(`Plano para o aporte de ${brl0(plan.aporte)}`, "Dinheiro novo primeiro completa a reserva e depois reforça as classes abaixo do alvo.");
    l.table(
      [
        { label: "#", width: 0.07 },
        { label: "DESTINO", width: 0.63 },
        { label: "VALOR", width: 0.3, align: "right" },
      ],
      plan.plano.map((a, i) => [{ text: `${i + 1}.`, color: MUTED }, { text: BUCKET_LABEL[a.bucket] }, { text: brl0(a.valor), bold: true }]),
    );
  }

  // Sugestões
  if (plan.sugestoes.length > 0) {
    l.section("Sugestões", "Em ordem de prioridade.", 70);
    const innerW = CONTENT_W - 20;
    for (const sug of plan.sugestoes) {
      const h = 10 + 9 + l.measure(sug.titulo, { size: 10.5, bold: true, width: innerW }) + l.measure(sug.detalhe, { width: innerW }) + 10;
      l.ensure(h + 6);
      l.page.drawRectangle({ x: MX, y: l.y - h, width: CONTENT_W, height: h, borderColor: LINE, borderWidth: 1 });
      let top = l.y - 10;
      top -= l.drawAt(PRIORIDADE[sug.prioridade].label, MX + 10, top, { size: 6.5, bold: true, color: PRIORIDADE[sug.prioridade].color, width: innerW, lineHeight: 1.4 });
      top -= l.drawAt(sug.titulo, MX + 10, top, { size: 10.5, bold: true, width: innerW });
      l.drawAt(sug.detalhe, MX + 10, top, { color: MUTED, width: innerW });
      l.y -= h + 6;
    }
  }

  // Fontes
  const focus = s.rates.focus?.data ? `, Boletim Focus de ${s.rates.focus.data.split("-").reverse().join("/")}` : "";
  l.y -= 10;
  l.text(
    `Fontes: Selic ${pct(s.rates.selicAnual, 2)} e CDI ${pct(s.rates.cdiAnual, 2)} ao ano (Banco Central)${s.rates.ipca12m != null ? `, IPCA ${pct(s.rates.ipca12m, 2)} em 12 meses` : ""}${focus}. A rentabilidade esperada usa as taxas de cada posição, a curva de juros projetada e o IR de longo prazo. Análise educativa, não é recomendação de investimento.`,
    { size: 7.5, color: MUTED },
  );

  return finish(l, s, dataStr);
}

async function finish(l: Layout, s: UserSnapshot, dataStr: string): Promise<Uint8Array> {
  const pages = l.pdf.getPages();
  pages.forEach((page, i) => {
    l.page = page;
    page.drawLine({ start: { x: MX, y: 40 }, end: { x: PAGE_W - MX, y: 40 }, thickness: 0.75, color: LINE });
    l.drawAt(`MUVO · Relatório de ${s.nome} · ${dataStr}`, MX, 36, { size: 7, color: MUTED, width: CONTENT_W * 0.75, lineHeight: 1.2 });
    l.drawAt(`Página ${i + 1} de ${pages.length}`, MX, 36, { size: 7, color: MUTED, align: "right", lineHeight: 1.2 });
  });
  l.pdf.setTitle(safe(`Relatório MUVO · ${s.nome}`));
  l.pdf.setAuthor("MUVO");
  l.pdf.setSubject("Relatório de carteira");
  l.pdf.setLanguage("pt-BR");
  l.pdf.setCreationDate(new Date(s.geradoEm));
  return l.pdf.save();
}

export function reportPdfFilename(s: UserSnapshot): string {
  const nome = s.nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `Relatorio-MUVO-${nome || "carteira"}-${s.geradoEm.slice(0, 10)}.pdf`;
}
