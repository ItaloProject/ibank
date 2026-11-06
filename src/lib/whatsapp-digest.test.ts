import { describe, expect, it } from "vitest";
import type { BotAlert } from "@/lib/alerts";
import {
  STEADY_DAILY_CAP,
  composeAlert,
  composeConfirmation,
  composeDigest,
  composeOptin,
  dailyCap,
  digestMode,
  isDigestDue,
  isSendWindow,
  nextGapSeconds,
  parseReply,
  weeklyWeekday,
} from "@/lib/whatsapp-digest";

/** 2026-11-04 é quarta-feira; 12:00 UTC = 09:00 em Brasília. */
const QUARTA_9H = new Date("2026-11-04T12:00:00Z");
const alerta = (titulo: string, nivel: BotAlert["nivel"] = "media"): BotAlert => ({ id: titulo, nivel, titulo, detalhe: "detalhe longo" });

describe("isSendWindow", () => {
  it("abre em dia útil das 9h às 19h, horário de Brasília", () => {
    expect(isSendWindow(QUARTA_9H)).toBe(true);
    expect(isSendWindow(new Date("2026-11-04T21:59:00Z"))).toBe(true); // 18:59
    expect(isSendWindow(new Date("2026-11-04T22:00:00Z"))).toBe(false); // 19:00
    expect(isSendWindow(new Date("2026-11-04T11:59:00Z"))).toBe(false); // 08:59
  });

  it("fica fechada no fim de semana", () => {
    expect(isSendWindow(new Date("2026-11-07T15:00:00Z"))).toBe(false); // sábado
    expect(isSendWindow(new Date("2026-11-08T15:00:00Z"))).toBe(false); // domingo
  });
});

describe("dailyCap e nextGapSeconds", () => {
  it("cresce nos 7 primeiros dias e depois fica fixo", () => {
    expect(dailyCap(null)).toBe(20);
    expect(dailyCap(0)).toBe(20);
    expect(dailyCap(3)).toBe(60);
    expect(dailyCap(6)).toBe(120);
    expect(dailyCap(7)).toBe(STEADY_DAILY_CAP);
    expect(dailyCap(90)).toBe(STEADY_DAILY_CAP);
  });

  it("sorteia a pausa entre 30 e 120 segundos", () => {
    expect(nextGapSeconds(0)).toBe(30);
    expect(nextGapSeconds(1)).toBe(120);
    expect(nextGapSeconds(0.5)).toBe(75);
  });
});

describe("isDigestDue", () => {
  const base = { userId: "u1", now: QUARTA_9H, lastDigestDay: null as string | null };

  it("distribui os usuários de segunda a sexta de forma estável", () => {
    const dias = new Set(Array.from({ length: 200 }, (_, i) => weeklyWeekday(`user-${i}`)));
    expect([...dias].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(weeklyWeekday("user-7")).toBe(weeklyWeekday("user-7"));
  });

  it("semanal sai a partir do dia fixo do usuário, uma vez por semana", () => {
    const meu = weeklyWeekday("u1");
    // quarta = 3: só dispara se o dia fixo já chegou
    expect(isDigestDue({ ...base, frequency: "weekly" })).toBe(meu <= 3);
    expect(isDigestDue({ ...base, frequency: "weekly", lastDigestDay: "2026-11-04" })).toBe(false);
    expect(isDigestDue({ ...base, frequency: "weekly", lastDigestDay: "2026-10-30" })).toBe(false);
  });

  it("semanal volta depois de 6 dias ou mais", () => {
    const usuarioSegunda = Array.from({ length: 50 }, (_, i) => `x${i}`).find((u) => weeklyWeekday(u) === 1)!;
    expect(isDigestDue({ frequency: "weekly", userId: usuarioSegunda, now: QUARTA_9H, lastDigestDay: "2026-10-28" })).toBe(true);
    expect(isDigestDue({ frequency: "weekly", userId: usuarioSegunda, now: QUARTA_9H, lastDigestDay: "2026-10-30" })).toBe(false);
  });

  it("diário vale todo dia útil e nunca no fim de semana", () => {
    expect(isDigestDue({ ...base, frequency: "daily", lastDigestDay: "2026-11-03" })).toBe(true);
    expect(isDigestDue({ ...base, frequency: "daily", lastDigestDay: "2026-11-04" })).toBe(false);
    expect(isDigestDue({ ...base, frequency: "daily", now: new Date("2026-11-07T15:00:00Z") })).toBe(false);
  });
});

describe("parseReply", () => {
  it("entende as respostas, sem diferenciar caixa, acento ou pontuação", () => {
    expect(parseReply("SIM")).toBe("sim");
    expect(parseReply(" sim! ")).toBe("sim");
    expect(parseReply("Sair.")).toBe("sair");
    expect(parseReply("PARAR")).toBe("sair");
    expect(parseReply("Não")).toBe("sair");
    expect(parseReply("diário")).toBe("avisos");
    expect(parseReply("Avisos")).toBe("avisos");
    expect(parseReply("semanal")).toBe("semanal");
  });

  it("ignora conversa comum", () => {
    expect(parseReply("")).toBeNull();
    expect(parseReply("quanto está o meu patrimônio?")).toBeNull();
    expect(parseReply("sim, mas quando chega?")).toBeNull();
  });
});

describe("composeDigest", () => {
  const bolsa = { valorAtual: 12_340, investido: 12_000 };

  it("semanal leva o panorama da bolsa, os 3 avisos mais graves e o rodapé de saída", () => {
    const texto = composeDigest({
      nome: "Ítalo",
      frequency: "weekly",
      bolsa,
      alerts: [alerta("A"), alerta("B", "alta"), alerta("C"), alerta("D")],
      seed: "u1-2026-11-04",
    })!;
    expect(texto).toContain("Ítalo");
    expect(texto).toContain("• Ações e fundos: R$ 12.340 (+R$ 340, +2,8% sobre o que você investiu)");
    expect(texto.split("\n").filter((l) => ["• A", "• B", "• C", "• D"].includes(l))).toEqual(["• B", "• A", "• C"]);
    expect(texto).toContain("*SAIR*");
    expect(texto).not.toContain("detalhe longo");
    expect(texto).not.toMatch(/https?:\/\//);
  });

  it("mostra perda com sinal de menos", () => {
    const texto = composeDigest({ nome: "Ana", frequency: "weekly", bolsa: { valorAtual: 9_000, investido: 10_000 }, alerts: [], seed: "s" })!;
    expect(texto).toContain("(−R$ 1.000, −10,0% sobre o que você investiu)");
  });

  it("diário só sai quando há aviso e não repete o panorama", () => {
    expect(composeDigest({ nome: "Ana", frequency: "daily", bolsa, alerts: [], seed: "s" })).toBeNull();
    const texto = composeDigest({ nome: "Ana", frequency: "daily", bolsa, alerts: [alerta("PETR4 caiu 6,0% hoje", "alta")], seed: "s" })!;
    expect(texto).toContain("• PETR4 caiu 6,0% hoje");
    expect(texto).not.toContain("Ações e fundos");
    expect(texto).toContain("*SEMANAL*");
  });

  it("não envia semanal sem posições e sem avisos", () => {
    expect(composeDigest({ nome: "Ana", frequency: "weekly", bolsa: null, alerts: [], seed: "s" })).toBeNull();
  });

  it("varia a abertura entre usuários", () => {
    const aberturas = new Set(
      Array.from({ length: 40 }, (_, i) => composeDigest({ nome: "Ana", frequency: "weekly", bolsa, alerts: [], seed: `u${i}` })!.split("\n")[0]),
    );
    expect(aberturas.size).toBeGreaterThan(1);
  });

  it("funciona sem nome", () => {
    expect(composeDigest({ nome: "", frequency: "weekly", bolsa, alerts: [], seed: "s" })!.split("\n")[0]).not.toMatch(/,\s*!/);
  });
});

describe("digestMode", () => {
  const agora = new Date();
  it("começa aguardando a escolha do usuário", () => {
    expect(digestMode({ optinAt: null, optoutAt: null, frequency: "weekly" })).toBe("pending");
  });

  it("segue a frequência escolhida depois do aceite", () => {
    expect(digestMode({ optinAt: agora, optoutAt: null, frequency: "weekly" })).toBe("weekly");
    expect(digestMode({ optinAt: agora, optoutAt: null, frequency: "daily" })).toBe("daily");
    expect(digestMode({ optinAt: agora, optoutAt: null, frequency: null })).toBe("weekly");
  });

  it("SAIR desliga, mesmo com aceite anterior", () => {
    expect(digestMode({ optinAt: agora, optoutAt: agora, frequency: "daily" })).toBe("off");
    expect(digestMode({ optinAt: null, optoutAt: agora, frequency: "weekly" })).toBe("off");
  });
});

describe("composeAlert", () => {
  it("lista só os títulos, sem links, e oferece SAIR", () => {
    const texto = composeAlert({ nome: "Ana", alerts: [alerta("ITUB4 caiu 8,5% hoje", "alta")], seed: "s" })!;
    expect(texto).toContain("• ITUB4 caiu 8,5% hoje");
    expect(texto).toContain("*SAIR*");
    expect(texto).not.toContain("detalhe longo");
    expect(texto).not.toMatch(/https?:\/\//);
  });

  it("não envia nada sem avisos e limita a 3", () => {
    expect(composeAlert({ nome: "Ana", alerts: [], seed: "s" })).toBeNull();
    const muitos = ["a", "b", "c", "d", "e"].map((t) => alerta(t, "alta"));
    expect(composeAlert({ nome: "", alerts: muitos, seed: "s" })!.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
  });
});

describe("textos fixos", () => {
  it("o convite pede SIM e oferece SAIR", () => {
    const t = composeOptin("Ana", "s");
    expect(t).toContain("*SIM*");
    expect(t).toContain("*SAIR*");
  });

  it("confirma cada resposta", () => {
    expect(composeConfirmation("sim", "Ana")).toContain("um resumo por semana");
    expect(composeConfirmation("avisos", "Ana")).toContain("Só aviso quando algo importante");
    expect(composeConfirmation("sair", "Ana")).toContain("não vou mais enviar");
  });
});
