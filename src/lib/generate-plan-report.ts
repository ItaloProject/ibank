interface ExpenseGroup {
  id: string;
  name: string;
  color: string;
}

interface ExpenseItem {
  id: string;
  groupId: string;
  name: string;
  type: "fixo" | "variavel";
  planned: number;
  actual: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function diff(planned: number, actual: number) {
  const d = planned - actual;
  if (d > 0) return `<span style="color:#16a34a">-${fmt(d)}</span>`;
  if (d < 0) return `<span style="color:#dc2626">+${fmt(Math.abs(d))}</span>`;
  return `<span style="color:#6b7280">${fmt(0)}</span>`;
}

export function generatePlanReport(
  groups: ExpenseGroup[],
  items: ExpenseItem[],
  monthLabel: string,
  userName: string
) {
  const totalFixoPlanned = items.filter(i => i.type === "fixo").reduce((s, i) => s + i.planned, 0);
  const totalFixoActual  = items.filter(i => i.type === "fixo").reduce((s, i) => s + i.actual, 0);
  const totalVarPlanned  = items.filter(i => i.type === "variavel").reduce((s, i) => s + i.planned, 0);
  const totalVarActual   = items.filter(i => i.type === "variavel").reduce((s, i) => s + i.actual, 0);
  const totalPlanned = totalFixoPlanned + totalVarPlanned;
  const totalActual  = totalFixoActual  + totalVarActual;

  const groupRows = groups.map((group) => {
    const gItems = items.filter(i => i.groupId === group.id);
    if (gItems.length === 0) return "";

    const gPlanned = gItems.reduce((s, i) => s + i.planned, 0);
    const gActual  = gItems.reduce((s, i) => s + i.actual, 0);

    const rows = gItems.map(item => `
      <tr>
        <td>${item.name}</td>
        <td style="text-align:center">
          <span style="
            display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;
            background:${item.type === "fixo" ? "#dbeafe" : "#ffedd5"};
            color:${item.type === "fixo" ? "#1d4ed8" : "#c2410c"};
          ">
            ${item.type === "fixo" ? "Fixo" : "Variável"}
          </span>
        </td>
        <td style="text-align:right">${item.planned > 0 ? fmt(item.planned) : "—"}</td>
        <td style="text-align:right;font-weight:600">${fmt(item.actual)}</td>
        <td style="text-align:right">${item.planned > 0 ? diff(item.planned, item.actual) : "—"}</td>
      </tr>
    `).join("");

    return `
      <div class="group-block">
        <div class="group-header" style="border-left:4px solid ${group.color}">
          <span class="group-dot" style="background:${group.color}"></span>
          <span class="group-name">${group.name}</span>
          <span class="group-count">${gItems.length} ${gItems.length === 1 ? "item" : "itens"}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th style="text-align:center">Tipo</th>
              <th style="text-align:right">Planejado</th>
              <th style="text-align:right">Real</th>
              <th style="text-align:right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="subtotal-row">
              <td colspan="2"><strong>Subtotal</strong></td>
              <td style="text-align:right"><strong>${fmt(gPlanned)}</strong></td>
              <td style="text-align:right"><strong>${fmt(gActual)}</strong></td>
              <td style="text-align:right">${gPlanned > 0 ? diff(gPlanned, gActual) : "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }).join("");

  const overBudget = totalPlanned > 0 && totalActual > totalPlanned;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Planejamento — ${monthLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 40px; height: 40px; background: #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
    .brand-name { font-size: 22px; font-weight: 800; color: #111; }
    .brand-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .header-info { text-align: right; }
    .header-title { font-size: 18px; font-weight: 700; color: #111; }
    .header-month { font-size: 14px; color: #3b82f6; font-weight: 600; text-transform: capitalize; margin-top: 2px; }
    .header-user { font-size: 11px; color: #9ca3af; margin-top: 4px; }

    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
    .summary-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
    .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .summary-value { font-size: 22px; font-weight: 800; color: #111; }
    .summary-value.over { color: #dc2626; }
    .summary-planned { font-size: 11px; color: #9ca3af; margin-top: 4px; }

    .group-block { margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    .group-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f9fafb; }
    .group-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .group-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
    .group-count { font-size: 11px; color: #9ca3af; margin-left: 4px; }

    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; text-align: left; border-bottom: 1px solid #e5e7eb; }
    td { padding: 9px 14px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
    tbody tr:last-child td { border-bottom: none; }
    .subtotal-row td { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 10px 14px; }

    .totals { margin-top: 28px; border: 2px solid #111; border-radius: 10px; overflow: hidden; }
    .totals-header { background: #111; color: white; padding: 12px 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 20px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    .totals-row:last-child { border-bottom: none; }
    .totals-final { display: flex; justify-content: space-between; padding: 14px 20px; background: #f9fafb; border-top: 2px solid #e5e7eb; }
    .totals-final .label { font-size: 15px; font-weight: 800; }
    .totals-final .value { font-size: 18px; font-weight: 800; color: ${overBudget ? "#dc2626" : "#111"}; }

    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }

    @media print {
      body { padding: 16px; }
      @page { margin: 1cm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <div class="brand-icon">₿</div>
      <div>
        <div class="brand-name">IBANK</div>
        <div class="brand-sub">Gestão Financeira</div>
      </div>
    </div>
    <div class="header-info">
      <div class="header-title">Relatório de Planejamento</div>
      <div class="header-month">${monthLabel}</div>
      <div class="header-user">${userName}</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-label"><span class="dot" style="background:#3b82f6"></span>Gastos Fixos</div>
      <div class="summary-value">${fmt(totalFixoActual)}</div>
      <div class="summary-planned">planejado: ${fmt(totalFixoPlanned)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label"><span class="dot" style="background:#f97316"></span>Gastos Variáveis</div>
      <div class="summary-value">${fmt(totalVarActual)}</div>
      <div class="summary-planned">planejado: ${fmt(totalVarPlanned)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Geral</div>
      <div class="summary-value ${overBudget ? "over" : ""}">${fmt(totalActual)}</div>
      <div class="summary-planned">planejado: ${fmt(totalPlanned)}</div>
    </div>
  </div>

  ${groupRows}

  <div class="totals">
    <div class="totals-header">Resumo Geral</div>
    <div class="totals-row">
      <span>Total Fixo — Planejado</span><span>${fmt(totalFixoPlanned)}</span>
    </div>
    <div class="totals-row">
      <span>Total Fixo — Real</span><span><strong>${fmt(totalFixoActual)}</strong></span>
    </div>
    <div class="totals-row">
      <span>Total Variável — Planejado</span><span>${fmt(totalVarPlanned)}</span>
    </div>
    <div class="totals-row">
      <span>Total Variável — Real</span><span><strong>${fmt(totalVarActual)}</strong></span>
    </div>
    <div class="totals-final">
      <span class="label">Total Geral</span>
      <span class="value">${fmt(totalActual)} <span style="font-size:13px;font-weight:400;color:#6b7280">/ ${fmt(totalPlanned)} planejado</span></span>
    </div>
  </div>

  <div class="footer">
    <span>IBANK — Relatório gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
    <span>${userName}</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
