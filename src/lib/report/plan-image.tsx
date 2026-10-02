import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { loadFonts } from "@/lib/report/report-image";
import { brl, capitalize, groupTotals, itemStatus, type ItemStatus, type PlanReportGroup } from "@/lib/report/plan-share";

export const PLAN_IMAGE_SIZE = { width: 1080, height: 1350 };

const BG = "#0A0A0A";
const FG = "#FAFAFA";
const MUTED = "rgba(250,250,250,0.55)";
const FAINT = "rgba(250,250,250,0.12)";
const AMBER = "#F59E0B";
const GREEN = "#34D399";
const STATUS_COLOR: Record<ItemStatus, string> = { pago: GREEN, pendente: "rgba(250,250,250,0.3)", acima: AMBER };
const MAX_ROWS = 11;

let logo: Promise<string | null> | null = null;

function loadLogo() {
  logo ??= readFile(path.join(process.cwd(), "public", "brand", "muvo-lockup-dark.png"))
    .then((buf) => `data:image/png;base64,${buf.toString("base64")}`)
    .catch(() => {
      logo = null;
      return null;
    });
  return logo;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function GroupCard({ group, monthLabel, logoSrc, display }: { group: PlanReportGroup; monthLabel: string; logoSrc: string | null; display: boolean }) {
  const t = groupTotals(group.items);
  const over = t.planned > 0 && t.actual > t.planned;
  const rest = t.planned - t.actual;
  const pct = t.planned > 0 ? Math.min(100, (t.actual / t.planned) * 100) : 0;
  const num = display ? { fontFamily: "Funnel Display", fontWeight: 800 } : { fontWeight: 700 };
  const dot = /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : FG;
  const tooMany = group.items.length > MAX_ROWS;
  const shown = tooMany ? group.items.slice(0, MAX_ROWS - 1) : group.items;
  const compact = shown.length > 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: BG, color: FG, padding: "60px 72px", fontFamily: "DM Sans" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc} width={252} height={70} alt="" />
        ) : (
          <div style={{ display: "flex", fontSize: 44, ...num }}>Muvo</div>
        )}
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{`Planejamento · ${capitalize(monthLabel)}`}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 52 }}>
        <div style={{ display: "flex", width: 18, height: 18, borderRadius: 9, background: dot, marginRight: 16 }} />
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, fontWeight: 700 }}>{clip(group.name.toUpperCase(), 30)}</div>
      </div>
      <div style={{ display: "flex", fontSize: 104, letterSpacing: -2, marginTop: 8, color: over ? AMBER : FG, ...num }}>{brl(t.actual)}</div>
      <div style={{ display: "flex", fontSize: 28, color: MUTED }}>
        {t.planned > 0 ? `gasto real de ${brl(t.planned)} planejado` : "gasto real no mês"}
      </div>

      {t.planned > 0 && (
        <div style={{ display: "flex", marginTop: 26, height: 14, borderRadius: 7, background: FAINT }}>
          <div style={{ display: "flex", width: `${Math.max(1, pct)}%`, height: 14, borderRadius: 7, background: over ? AMBER : dot }} />
        </div>
      )}

      <div style={{ display: "flex", marginTop: 30 }}>
        {[
          t.planned > 0
            ? rest >= 0
              ? { label: "Sobra do planejado", value: brl(rest), color: FG }
              : { label: "Acima do planejado", value: brl(-rest), color: AMBER }
            : null,
          { label: "Itens pagos", value: `${t.paid} de ${group.items.length}`, color: FG },
          t.over > 0 ? { label: "Passaram do planejado", value: String(t.over), color: AMBER } : null,
        ]
          .filter((s): s is { label: string; value: string; color: string } => s != null)
          .map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", width: "33%", paddingRight: 20 }}>
              <div style={{ display: "flex", fontSize: 40, color: s.color, ...num }}>{s.value}</div>
              <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{s.label}</div>
            </div>
          ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 34, paddingTop: 10, borderTop: `1px solid ${FAINT}` }}>
        {shown.map((i, idx) => {
          const status = itemStatus(i);
          return (
            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: compact ? 12 : 18, fontSize: compact ? 26 : 30 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: STATUS_COLOR[status], marginRight: 18 }} />
                <div style={{ display: "flex" }}>{clip(i.name, 30)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center" }}>
                {status === "pendente" ? (
                  <div style={{ display: "flex", color: MUTED }}>{`${brl(i.planned)} planejado`}</div>
                ) : (
                  <>
                    <div style={{ display: "flex", fontWeight: 700, color: status === "acima" ? AMBER : FG }}>{brl(i.actual)}</div>
                    {i.planned > 0 && Math.abs(i.planned - i.actual) >= 0.005 && (
                      <div style={{ display: "flex", fontSize: compact ? 20 : 22, color: MUTED, marginLeft: 10 }}>{`de ${brl(i.planned)}`}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {tooMany && (
          <div style={{ display: "flex", marginTop: 12, fontSize: 24, color: MUTED }}>{`+ ${group.items.length - shown.length} itens`}</div>
        )}
        {group.items.length === 0 && <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: MUTED }}>Nenhum item neste grupo ainda.</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 24, fontSize: 22, color: MUTED }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: GREEN, marginRight: 10 }} />
          <div style={{ display: "flex", marginRight: 26 }}>pago</div>
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: STATUS_COLOR.pendente, marginRight: 10 }} />
          <div style={{ display: "flex", marginRight: 26 }}>pendente</div>
          <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: AMBER, marginRight: 10 }} />
          <div style={{ display: "flex" }}>acima</div>
        </div>
        <div style={{ display: "flex" }}>Organizado no Muvo</div>
      </div>
    </div>
  );
}

export async function renderPlanGroupImage(group: PlanReportGroup, monthLabel: string): Promise<ArrayBuffer> {
  const [fonts, logoSrc] = await Promise.all([loadFonts(), loadLogo()]);
  const img = new ImageResponse(
    <GroupCard group={group} monthLabel={monthLabel} logoSrc={logoSrc} display={fonts.some((f) => f.name === "Funnel Display")} />,
    { ...PLAN_IMAGE_SIZE, ...(fonts.length ? { fonts } : {}) },
  );
  return img.arrayBuffer();
}
