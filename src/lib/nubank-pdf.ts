/** Parses the Nubank invoice PDF and extracts the RESUMO DA FATURA ATUAL values. */

export interface NubankPDFSummary {
  faturaAnterior: number;
  pagamentosRecebidos: number;
  totalCompras: number;
  iofInternacional: number;
  outrosLancamentos: number;
  totalAPagar: number;
  /** "YYYY-MM" extracted from the due date (e.g. "08 SET 2026" → "2026-09") */
  billingCycle: string | null;
}

const PT_MONTHS: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

function parseBRL(text: string): number {
  const clean = text.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

function extractAfterLabel(text: string, label: RegExp): number | null {
  const m = text.match(new RegExp(label.source + "[\\s\\S]{0,20}?R\\$\\s*([\\d.,]+)", "i"));
  if (!m) return null;
  return parseBRL(m[1]);
}

export async function parseNubankPDF(file: File): Promise<NubankPDFSummary> {
  // Dynamically import pdfjs to avoid SSR issues
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    fullText += pageText + "\n";
  }

  // Extract billing cycle from due date line e.g. "08 SET 2026"
  let billingCycle: string | null = null;
  const dateMatch = fullText.match(/FATURA\s+(\d{2})\s+([A-Z]{3})\s+(\d{4})/i);
  if (dateMatch) {
    const month = PT_MONTHS[dateMatch[2].toUpperCase()];
    if (month) billingCycle = `${dateMatch[3]}-${month}`;
  }

  // Extract RESUMO values
  const faturaAnterior = extractAfterLabel(fullText, /fatura\s+anterior/) ?? 0;
  const pagamentosRecebidos = (() => {
    const m = fullText.match(/pagamento\s+recebido[\s\S]{0,20}?[−\-]R\$\s*([\d.,]+)/i);
    return m ? parseBRL(m[1]) : 0;
  })();
  const totalCompras = extractAfterLabel(fullText, /total\s+de\s+compras\s+de\s+todos\s+os\s+cart/) ?? 0;
  const iofInternacional = extractAfterLabel(fullText, /IOF\s+de\s+compras\s+internacionais/) ?? 0;
  const outrosLancamentos = (() => {
    const m = fullText.match(/outros\s+lan[çc]amentos[\s\S]{0,20}?[−\-]?R\$\s*([\d.,]+)/i);
    return m ? parseBRL(m[1]) : 0;
  })();
  const totalAPagar = extractAfterLabel(fullText, /total\s+a\s+pagar/) ?? 0;

  return {
    faturaAnterior,
    pagamentosRecebidos,
    totalCompras,
    iofInternacional,
    outrosLancamentos,
    totalAPagar,
    billingCycle,
  };
}
