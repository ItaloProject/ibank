import { describe, expect, it } from "vitest";
import { buildRebalancePlan } from "@/lib/rebalance";
import { actionHref, actionLabel, extractActions, planInsights, planMoves, planScore, planAllocation } from "@/lib/plan-view";
import type { PortfolioRow } from "@/lib/portfolio-return";

function row(p: Partial<PortfolioRow> & Pick<PortfolioRow, "id" | "classe" | "valor">): PortfolioRow {
  return { accountId: p.id, nome: p.id, peso: 0, taxa12m: 12, irLongo: 0.15, fonte: "", origem: "cadastrada", rate: null, ...p };
}

function plan(rows: PortfolioRow[], aporte = 1000, gastoMensal: number | null = 2000) {
  const total = rows.reduce((s, r) => s + r.valor, 0);
  return buildRebalancePlan({ rows: rows.map((r) => ({ ...r, peso: r.valor / total })), profile: "moderado", aporte, gastoMensal });
}

describe("plan-view", () => {
  it("reserva vazia vira alerta crítico com atalho para aplicar na reserva", () => {
    const p = plan([row({ id: "acoes", classe: "acoes", valor: 5000, accountId: null })]);
    const reserva = planInsights(p).find((i) => i.title.includes("reserva"));
    expect(reserva).toMatchObject({ level: "critical", section: "eme" });
    expect(planMoves(p)[0]).toMatchObject({ prioridade: 1, section: "eme" });
    expect(planScore(p)).toBeLessThanOrEqual(75);
  });

  it("carteira alinhada tem nota alta e mensagens positivas", () => {
    const p = plan([
      row({ id: "eme", classe: "emergencia", valor: 12000 }),
      row({ id: "cdb", classe: "renda_fixa", valor: 3000 }),
      row({ id: "ipca", classe: "renda_fixa", valor: 2500, rate: { rate_index: "ipca", rate_value: 7, maturity: null, tax_exempt: false } }),
      row({ id: "pre", classe: "renda_fixa", valor: 1000, rate: { rate_index: "pre", rate_value: 14, maturity: null, tax_exempt: false } }),
      row({ id: "fii", classe: "fiis", valor: 1500, accountId: null }),
      row({ id: "acao", classe: "acoes", valor: 2000, accountId: null }),
    ]);
    expect(planScore(p)).toBeGreaterThanOrEqual(90);
    expect(planInsights(p).filter((i) => i.level === "ok").length).toBe(2);
  });

  it("extrai ações da resposta da IA e descarta as inválidas", () => {
    const { text, actions } = extractActions(
      "Aplique na reserva.\n<<investir:eme:500>>\n<<vender:PTR4>>\n<<vender:XPTO3>>\n<<investir:cripto:10>>",
      ["PTR4"],
    );
    expect(text).toBe("Aplique na reserva.");
    expect(actions).toEqual([{ kind: "investir", section: "eme", amount: 500 }, { kind: "vender", ticker: "PTR4" }]);
    expect(actionHref(actions[0])).toBe("/investimentos?investir=eme&valor=500");
    expect(actionLabel(actions[0])).toMatch(/^Aplicar R\$\s?500 em Reserva de emergência$/);
    const perfil = extractActions("Dá para migrar aos poucos.\n<<perfil:agressivo>>\n<<perfil:ousado>>", []);
    expect(perfil.text).toBe("Dá para migrar aos poucos.");
    expect(perfil.actions).toEqual([{ kind: "perfil", to: "arrojado" }]);
    expect(actionLabel(perfil.actions[0])).toBe("Ver o caminho para o perfil arrojado");
  });

  it("alocação usa as classes e os alvos do perfil", () => {
    const p = plan([row({ id: "cdb", classe: "renda_fixa", valor: 30000 })]);
    const alloc = planAllocation(p);
    expect(alloc.map((a) => a.id)).toEqual(["pos", "inflacao", "prefixado", "fiis", "acoes"]);
    expect(alloc.find((a) => a.id === "acoes")?.ideal).toBe(20);
  });
});
