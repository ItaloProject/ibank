import { describe, expect, it } from "vitest";
import { detectIntent, keywordIntent } from "./bot-intent";

describe("detectIntent", () => {
  it("pedidos curtos e diretos abrem a resposta pronta", () => {
    expect(detectIntent("rebalancear")).toBe("rebal");
    expect(detectIntent("meu PDF")).toBe("pdf");
    expect(detectIntent("Relatório no WhatsApp")).toBe("whatsapp");
    expect(detectIntent("mudar perfil")).toBe("perfil");
    expect(detectIntent("minha meta")).toBe("meta");
  });

  it("perguntas vão para a inteligência artificial", () => {
    expect(detectIntent("o que é perfil de risco?")).toBe("help");
    expect(detectIntent("como funciona o relatório")).toBe("help");
    expect(detectIntent("por que rebalancear?")).toBe("help");
    expect(detectIntent("vale a pena LCA ou CDB")).toBe("help");
    expect(detectIntent("oi")).toBe("help");
  });

  it("perguntas que a resposta pronta calcula continuam nela", () => {
    expect(detectIntent("quando chego na meta?")).toBe("meta");
    expect(detectIntent("quanto falta pra minha meta?")).toBe("meta");
    expect(detectIntent("onde aportar este mês?")).toBe("rebal");
  });

  it("palavra-chave serve de reserva sem inteligência artificial", () => {
    expect(keywordIntent("o que é perfil de risco?")).toBe("perfil");
    expect(keywordIntent("LCA ou CDB")).toBeNull();
  });
});
