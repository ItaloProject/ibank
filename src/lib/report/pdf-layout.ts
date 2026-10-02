import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

/** Base visual dos relatórios em PDF do MUVO: página A4, logo, textos com quebra e tabelas. */

export const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
export const INK = hex("#0A0A0A");
export const MUTED = hex("#6B6B6B");
export const LINE = hex("#E4E4E7");
export const SOFT = hex("#F4F4F5");
export const WARN = hex("#B45309");
export const OK = hex("#047857");

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MX = 44;
const TOP = 40;
const BOTTOM = 50;
export const CONTENT_W = PAGE_W - MX * 2;

/** As fontes padrão do PDF só codificam WinAnsi; o resto viraria erro na geração. */
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);
export function safe(text: string): string {
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

export type TextOpts = { size?: number; bold?: boolean; color?: RGB; width?: number; lineHeight?: number; align?: "left" | "right" };
export type Cell = { text: string; bold?: boolean; color?: RGB; sub?: string };
export type Column = { label: string; width: number; align?: "left" | "right" };

export class Layout {
  page!: PDFPage;
  y = 0;
  private constructor(
    readonly pdf: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    readonly logo: PDFImage,
    readonly onPage: (l: Layout) => void,
  ) {}

  static async create(onPage: (l: Layout) => void, logoPng: Uint8Array) {
    const pdf = await PDFDocument.create();
    const [regular, bold, logo] = await Promise.all([
      pdf.embedFont(StandardFonts.Helvetica),
      pdf.embedFont(StandardFonts.HelveticaBold),
      pdf.embedPng(logoPng),
    ]);
    const l = new Layout(pdf, regular, bold, logo, onPage);
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
    if (this.y - h >= BOTTOM) return false;
    this.addPage();
    return true;
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
    if (this.ensure(30 + keepWith)) this.y -= 12;
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

/**
 * Cabeçalho de marca: grande na primeira página, compacto nas outras.
 * Com `lockup`, o logo já traz o nome Muvo e o texto MUVO não é repetido.
 */
export function brandHeader(p: Layout, kicker: string, line: string, compact: string, lockup = false) {
  const first = p.pdf.getPageCount() === 1;
  const logoH = lockup ? (first ? 34 : 18) : first ? 40 : 22;
  const logoW = (p.logo.width / p.logo.height) * logoH;
  p.page.drawImage(p.logo, { x: MX, y: p.y - logoH, width: logoW, height: logoH });
  if (lockup) {
    p.drawAt(first ? kicker : compact, MX, p.y - (first ? 6 : 4), { size: first ? 7 : 7.5, bold: first, color: MUTED, align: "right", lineHeight: 1.2 });
    if (first) p.drawAt(line, MX, p.y - 16, { size: 9, align: "right", lineHeight: 1.2 });
  } else if (first) {
    p.drawAt("MUVO", MX + logoW + 8, p.y - 9, { size: 20, bold: true, lineHeight: 1.2 });
    p.drawAt(kicker, MX, p.y - 8, { size: 7, bold: true, color: MUTED, align: "right", lineHeight: 1.2 });
    p.drawAt(line, MX, p.y - 18, { size: 9, align: "right", lineHeight: 1.2 });
  } else {
    p.drawAt("MUVO", MX + logoW + 6, p.y - 5, { size: 11, bold: true, lineHeight: 1.2 });
    p.drawAt(compact, MX, p.y - 6, { size: 7.5, color: MUTED, align: "right", lineHeight: 1.2 });
  }
  p.y -= logoH + 6;
  p.rule(INK, 1.5);
  p.y -= 4;
}

/** Rodapé com linha, texto e número da página em todas as páginas. */
export function brandFooter(l: Layout, text: string) {
  const pages = l.pdf.getPages();
  pages.forEach((page, i) => {
    l.page = page;
    page.drawLine({ start: { x: MX, y: 40 }, end: { x: PAGE_W - MX, y: 40 }, thickness: 0.75, color: LINE });
    l.drawAt(text, MX, 36, { size: 7, color: MUTED, width: CONTENT_W * 0.75, lineHeight: 1.2 });
    l.drawAt(`Página ${i + 1} de ${pages.length}`, MX, 36, { size: 7, color: MUTED, align: "right", lineHeight: 1.2 });
  });
}
