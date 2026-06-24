import type { Transaction, CreditCard } from "@/types/database";
import { formatCurrency } from "./utils";

const CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "Alimentação", transporte: "Transporte", saude: "Saúde",
  lazer: "Lazer", educacao: "Educação", moradia: "Moradia",
  vestuario: "Vestuário", outros: "Outros",
};

const CATEGORY_COLORS_HEX: Record<string, string> = {
  alimentacao: "#3b82f6", transporte: "#10b981", saude: "#f59e0b",
  lazer: "#8b5cf6", educacao: "#06b6d4", moradia: "#ef4444",
  vestuario: "#f97316", outros: "#6b7280",
};

export function generateMonthReport(
  transactions: Transaction[],
  card: CreditCard,
  monthLabel: string,
) {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const limitPercent = card.limit > 0 ? ((total / card.limit) * 100).toFixed(0) : "0";

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});

  const categoryRows = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amount]) => {
      const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : "0.0";
      const color = CATEGORY_COLORS_HEX[cat] ?? "#6b7280";
      const barWidth = total > 0 ? ((amount / total) * 180).toFixed(0) : "0";
      return `
        <tr>
          <td>
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
              background:${color};margin-right:6px;vertical-align:middle;"></span>
            ${CATEGORY_LABELS[cat] ?? cat}
          </td>
          <td>
            <div style="background:#f3f4f6;border-radius:4px;height:8px;width:200px;overflow:hidden;">
              <div style="background:${color};height:8px;width:${barWidth}px;border-radius:4px;"></div>
            </div>
          </td>
          <td class="right">${pct}%</td>
          <td class="right bold">${formatCurrency(amount)}</td>
        </tr>`;
    }).join("");

  const txRows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t, idx) => {
      const [y, m, d] = t.date.split("-");
      const dateStr = `${d}/${m}/${y}`;
      const parcelaStr = t.installments > 1
        ? `<span class="badge">${t.installment_current}/${t.installments}x</span>`
        : "";
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#f9fafb";
      return `
        <tr style="background:${rowBg}">
          <td class="mono">${dateStr}</td>
          <td>${t.description}${parcelaStr}</td>
          <td>
            <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;
              background:${CATEGORY_COLORS_HEX[t.category] ?? "#6b7280"}22;
              color:${CATEGORY_COLORS_HEX[t.category] ?? "#6b7280"};font-weight:600;">
              ${CATEGORY_LABELS[t.category] ?? t.category}
            </span>
          </td>
          <td class="right red bold">${formatCurrency(t.amount)}</td>
        </tr>`;
    }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório ${monthLabel} – ${card.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 12px; color: #111827; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px 32px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 28px; }
    .header-title h1 { font-size: 24px; font-weight: 800; color: #1e3a5f; }
    .header-title p { color: #6b7280; font-size: 13px; margin-top: 3px; }
    .header-meta { text-align: right; color: #6b7280; font-size: 11px; }
    .header-meta strong { display: block; font-size: 13px; color: #111827; }

    /* Summary cards */
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
    .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .card-label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .card-value { font-size: 18px; font-weight: 800; }
    .red { color: #dc2626; }
    .green { color: #16a34a; }

    /* Sections */
    .section-title {
      font-size: 13px; font-weight: 700; color: #1e3a5f; text-transform: uppercase;
      letter-spacing: .5px; margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 1px solid #e5e7eb;
    }

    /* Tables */
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 10px;
      color: #6b7280; text-transform: uppercase; letter-spacing: .4px; }
    td { padding: 9px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12px; vertical-align: middle; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .mono { font-variant-numeric: tabular-nums; }
    .badge { display: inline-block; margin-left: 6px; padding: 1px 6px;
      border-radius: 99px; background: #e5e7eb; color: #6b7280; font-size: 10px; }
    .total-row td { font-weight: 700; background: #f8fafc; border-top: 2px solid #e5e7eb; }

    /* Footer */
    .footer { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb;
      text-align: center; color: #9ca3af; font-size: 10px; }

    @page { margin: 1.2cm 1.5cm; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; }
    }
  </style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-title">
      <h1>Relatório de Gastos</h1>
      <p>${monthLabel} &nbsp;·&nbsp; ${card.name}</p>
    </div>
    <div class="header-meta">
      <strong>IBANK</strong>
      Gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
    </div>
  </div>

  <div class="summary">
    <div class="card">
      <div class="card-label">Total gasto</div>
      <div class="card-value red">${formatCurrency(total)}</div>
    </div>
    <div class="card">
      <div class="card-label">Limite disponível</div>
      <div class="card-value green">${formatCurrency(card.limit - total)}</div>
    </div>
    <div class="card">
      <div class="card-label">Uso do limite</div>
      <div class="card-value">${limitPercent}%</div>
    </div>
    <div class="card">
      <div class="card-label">Transações</div>
      <div class="card-value">${transactions.length}</div>
    </div>
  </div>

  <div class="section-title">Gastos por categoria</div>
  <table>
    <thead>
      <tr>
        <th>Categoria</th>
        <th>Participação</th>
        <th class="right">%</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows}
      <tr class="total-row">
        <td colspan="2">Total</td>
        <td class="right">100%</td>
        <td class="right">${formatCurrency(total)}</td>
      </tr>
    </tbody>
  </table>

  <div class="section-title">Lista de transações (${transactions.length})</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th>Categoria</th>
        <th class="right">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${txRows}
    </tbody>
  </table>

  <div class="footer">
    IBANK · Relatório gerado automaticamente · ${monthLabel} · ${card.name}
  </div>
</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Permita pop-ups para gerar o PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
