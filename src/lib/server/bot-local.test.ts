import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/genie-knowledge", () => ({
  recall: vi.fn(async () => null),
}));

import { localBotReply } from "./bot-local";

const user = (content: string) => ({ role: "user" as const, content });

describe("localBotReply (sem inteligência artificial)", () => {
  it("responde conversa curta sem chave de IA", async () => {
    const r = await localBotReply([user("oi")], 13.65);
    expect(r.answered).toBe(true);
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("explica um termo do glossário", async () => {
    const r = await localBotReply([user("o que é CDB?")], 13.65);
    expect(r.answered).toBe(true);
  });

  it("calcula uma aplicação por dias", async () => {
    const r = await localBotReply([user("quanto rendem 4 mil com 100% CDI em 30 dias?")], 13.65);
    expect(r.answered).toBe(true);
    expect(r.text).toMatch(/\d/);
  });

  it("completa o prazo que vem na mensagem seguinte", async () => {
    const r = await localBotReply(
      [user("quanto rendem 4 mil com 100% CDI?"), { role: "assistant", content: "Em quanto tempo?" }, user("30 dias")],
      13.65,
    );
    expect(r.answered).toBe(true);
    expect(r.text).toMatch(/\d/);
  });

  it("cai na ajuda quando não sabe responder", async () => {
    const r = await localBotReply([user("devo vender minhas ações da Petrobras amanhã?")], 13.65);
    expect(r.answered).toBe(false);
    expect(r.text).toContain("Posso ajudar sem inteligência artificial");
  });

  it("não aponta tela para pergunta de compra ou venda", async () => {
    const r = await localBotReply([user("devo vender minhas ações da Petrobras amanhã?")], 13.65);
    expect(r.answered).toBe(false);
  });
});
