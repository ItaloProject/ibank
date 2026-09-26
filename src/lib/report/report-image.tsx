import { ImageResponse } from "next/og";
import { RISK_PROFILES, type Suggestion } from "@/lib/rebalance";
import type { UserSnapshot } from "@/lib/server/portfolio-snapshot";
import { firstName, reportDate } from "@/lib/report/report-text";

export const REPORT_IMAGE_SIZE = { width: 1080, height: 1350 };

const BG = "#0A0A0A";
const FG = "#FAFAFA";
const MUTED = "rgba(250,250,250,0.55)";
const FAINT = "rgba(250,250,250,0.12)";
const PRIORITY_COLOR: Record<Suggestion["prioridade"], string> = { alta: "#F59E0B", media: "rgba(250,250,250,0.7)", baixa: "rgba(250,250,250,0.35)" };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number, d = 0) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: d })}%`;

function Label({ children }: { children: string }) {
  return <div style={{ fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>{children}</div>;
}

function Bar({ label, atual, alvo, valor }: { label: string; atual: number; alvo: number; valor: string }) {
  const off = Math.abs(atual - alvo) >= 10;
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
        <div style={{ display: "flex", color: FG }}>{label}</div>
        <div style={{ display: "flex", color: MUTED }}>
          <span style={{ color: off ? "#F59E0B" : FG, fontWeight: 700, marginRight: 10 }}>{pct(atual)}</span>
          {`alvo ${pct(alvo)} · ${valor}`}
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", marginTop: 8, height: 12, borderRadius: 6, background: FAINT }}>
        <div style={{ display: "flex", width: `${Math.max(1, Math.min(100, atual))}%`, height: 12, borderRadius: 6, background: FG }} />
        <div style={{ display: "flex", position: "absolute", left: `${Math.min(99.5, alvo)}%`, top: -6, width: 3, height: 24, background: "#F59E0B" }} />
      </div>
    </div>
  );
}

function ReportCard({ s, display }: { s: UserSnapshot; display: boolean }) {
  const plan = s.plan!;
  const nome = firstName(s.nome);
  const reservaOk = plan.reserva.atual >= plan.reserva.alvo - 1;
  const num = display ? { fontFamily: "Funnel Display", fontWeight: 800 } : { fontWeight: 700 };
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BG, color: FG, padding: "56px 72px", fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 40, letterSpacing: 2, ...num }}>MUVO</div>
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{`Relatório da carteira · ${reportDate(s.geradoEm)}`}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
        <Label>{nome ? `Patrimônio de ${nome}` : "Patrimônio"}</Label>
        <div style={{ display: "flex", fontSize: 88, letterSpacing: -2, marginTop: 4, ...num }}>{brl(plan.total)}</div>
        <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 4 }}>
          {`${pct(plan.retorno12m, 2)} ao ano esperado, sem IR · Perfil ${RISK_PROFILES[plan.profile].label.toLowerCase()}`}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
        <Label>Alocação atual e alvo</Label>
        {plan.buckets.map((b) => (
          <Bar key={b.id} label={b.label} atual={b.pct} alvo={b.alvoPct} valor={brl(b.valor)} />
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${FAINT}` }}>
          <div style={{ display: "flex" }}>Reserva de emergência</div>
          <div style={{ display: "flex", color: reservaOk ? FG : "#F59E0B", fontWeight: 700 }}>{`${brl(plan.reserva.atual)} de ${brl(plan.reserva.alvo)}`}</div>
        </div>
        {plan.caixa >= 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, marginTop: 10 }}>
            <div style={{ display: "flex" }}>Saldo parado, sem render</div>
            <div style={{ display: "flex", color: "#F59E0B", fontWeight: 700 }}>{brl(plan.caixa)}</div>
          </div>
        )}
      </div>

      {plan.plano.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          <Label>{`Onde aportar ${brl(plan.aporte)} este mês`}</Label>
          <div style={{ display: "flex", marginTop: 12 }}>
            {plan.plano.slice(0, 4).map((a) => (
              <div key={a.bucket} style={{ display: "flex", flexDirection: "column", width: plan.plano.length > 2 ? "25%" : "50%", paddingRight: 20 }}>
                <div style={{ display: "flex", fontSize: plan.plano.length > 2 ? 36 : 44, ...num }}>{brl(a.valor)}</div>
                <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.sugestoes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: 34 }}>
          <Label>Sugestões</Label>
          {plan.sugestoes.slice(0, 3).map((sug) => (
            <div key={sug.id} style={{ display: "flex", alignItems: "center", marginTop: 12, fontSize: 26 }}>
              <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: PRIORITY_COLOR[sug.prioridade], marginRight: 18, flexShrink: 0 }} />
              <div style={{ display: "flex" }}>{sug.titulo}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", marginTop: "auto", paddingTop: 28, fontSize: 20, color: MUTED }}>
        Taxas do Banco Central e Boletim Focus. Análise educativa, não é recomendação de investimento.
      </div>
    </div>
  );
}

type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: "normal" };

/** Com um user agent antigo, o Google Fonts serve WOFF em vez de WOFF2, que o gerador de imagem não lê. */
const LEGACY_UA = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30";

async function googleFont(family: string, weight: OgFont["weight"], name: string): Promise<OgFont | null> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
    headers: { "User-Agent": LEGACY_UA },
    next: { revalidate: 60 * 60 * 24 * 7 },
  }).then((r) => (r.ok ? r.text() : ""));
  const block = css.split("/* latin */")[1] ?? css;
  const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/.exec(block)?.[1];
  if (!url) return null;
  const data = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } }).then((r) => (r.ok ? r.arrayBuffer() : null));
  return data ? { name, data, weight, style: "normal" } : null;
}

let fonts: Promise<OgFont[]> | null = null;

function loadFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all([
    googleFont("DM Sans", 400, "DM Sans"),
    googleFont("DM Sans", 700, "DM Sans"),
    googleFont("Funnel Display", 800, "Funnel Display"),
  ])
    .then((list) => list.filter((f): f is OgFont => f != null))
    .catch(() => {
      fonts = null;
      return [];
    });
  return fonts;
}

export async function renderReportImage(s: UserSnapshot): Promise<ArrayBuffer> {
  const loaded = await loadFonts();
  const img = new ImageResponse(<ReportCard s={s} display={loaded.some((f) => f.name === "Funnel Display")} />, {
    ...REPORT_IMAGE_SIZE,
    ...(loaded.length ? { fonts: loaded } : {}),
  });
  return img.arrayBuffer();
}
