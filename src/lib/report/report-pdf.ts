import type { RGB } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "@/lib/report/logo";
import { BUCKET_LABEL, MIN_INVESTIDO_ALOCACAO, RISK_PROFILES, alocacaoRelevante, bucketOf, type Suggestion } from "@/lib/rebalance";
import type { AssetClass } from "@/lib/portfolio-return";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";
import { reportDate } from "@/lib/report/report-text";
import { CONTENT_W, INK, LINE, Layout, MUTED, MX, OK, SOFT, WARN, brandFooter, brandHeader, safe } from "@/lib/report/pdf-layout";

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

export async function renderReportPdf(s: UserSnapshot): Promise<Uint8Array> {
  const plan = s.plan;
  const portfolio = s.portfolio;
  const dataStr = reportDate(s.geradoEm);
  const hora = new Date(s.geradoEm).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const l = await Layout.create(
    (p) => brandHeader(p, "RELATÓRIO DE CARTEIRA", `${dataStr} às ${hora}`, `Relatório de carteira · ${dataStr}`),
    Buffer.from(LOGO_PNG_BASE64, "base64"),
  );

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
    { label: "RENDE EM 12 MESES", value: pct(plan.retorno12m, 2), hint: "esperado, já sem Imposto de Renda" },
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
  const naReserva = rows.filter((r) => ["reserva", "pos"].includes(bucketOf(r))).map((r) => r.nome);
  l.section(
    "Reserva de emergência",
    [
      plan.reserva.baseadaEmGastos
        ? `Meta de ${plan.reserva.meses} meses dos seus gastos médios no Planejamento.`
        : "Sem gastos cadastrados no Planejamento, usamos uma reserva mínima de referência.",
      plan.reserva.atual > 0 && naReserva.length > 0
        ? `Contam como reserva: ${naReserva.join(", ")}.`
        : "Contas de reserva e aplicações pós-fixadas com liquidez diária contam aqui.",
    ].join(" "),
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
    `Fontes: Selic ${pct(s.rates.selicAnual, 2)} e CDI ${pct(s.rates.cdiAnual, 2)} ao ano (Banco Central)${s.rates.ipca12m != null ? `, IPCA ${pct(s.rates.ipca12m, 2)} em 12 meses` : ""}${focus}. A rentabilidade esperada usa as taxas de cada posição, a curva de juros projetada e o Imposto de Renda de longo prazo. Análise educativa, não é recomendação de investimento.`,
    { size: 7.5, color: MUTED },
  );

  return finish(l, s, dataStr);
}

async function finish(l: Layout, s: UserSnapshot, dataStr: string): Promise<Uint8Array> {
  brandFooter(l, `MUVO · Relatório de ${s.nome} · ${dataStr}`);
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
