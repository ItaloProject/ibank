import { describe, expect, it } from "vitest";
import { detectIntent, keywordIntent, profileTarget } from "./bot-intent";

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
    expect(detectIntent("Onde devo investir esse mês?")).toBe("rebal");
    expect(detectIntent("onde investir hoje?")).toBe("rebal");
    expect(detectIntent("o que posso aplicar agora?")).toBe("rebal");
    expect(detectIntent("como investir em ações?")).toBe("help");
  });

  it("mudar para um perfil citado abre o caminho de transição", () => {
    expect(detectIntent("quero mudar para arrojado")).toBe("transicao");
    expect(detectIntent("Perfil agressivo")).toBe("transicao");
    expect(detectIntent("e se eu fosse conservador?")).toBe("transicao");
    expect(detectIntent("como fica minha carteira no perfil agressivo?")).toBe("transicao");
    expect(detectIntent("mudei de ideia, quero passar para o perfil moderado agora")).toBe("transicao");
    expect(detectIntent("o que é perfil arrojado?")).toBe("help");
    expect(profileTarget("agressivo")).toBe("arrojado");
    expect(profileTarget("rebalancear")).toBeNull();
  });

  it("visão da carteira abre a visão, mesmo com frase completa ou pergunta", () => {
    expect(detectIntent("Quero a visão completa da carteira")).toBe("visao");
    expect(detectIntent("quero ver a visão da carteira")).toBe("visao");
    expect(detectIntent("qual a visão da carteira?")).toBe("visao");
    expect(detectIntent("visão da carteira")).toBe("visao");
    expect(detectIntent("rebalancear a visão da carteira")).toBe("rebal");
  });

  it("perguntas sobre reserva, Turbo, renda e perfil caem na tela certa", () => {
    expect(detectIntent("meta")).toBe("meta");
    expect(detectIntent("meu perfil")).toBe("perfil");
    expect(detectIntent("qual meu perfil?")).toBe("perfil");
    expect(keywordIntent("quanto tenho na reserva?")).toBe("visao");
    expect(keywordIntent("quanto tenho na turbo")).toBe("visao");
    expect(keywordIntent("quanto recebo por mês")).toBe("visao");
    expect(keywordIntent("minhas ações")).toBe("visao");
    expect(keywordIntent("como investir em ações?")).toBeNull();
  });

  it("palavra-chave serve de reserva sem inteligência artificial", () => {
    expect(keywordIntent("o que é perfil de risco?")).toBe("perfil");
    expect(keywordIntent("LCA ou CDB")).toBeNull();
  });
});
