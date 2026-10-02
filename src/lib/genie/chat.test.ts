import { describe, expect, it } from "vitest";
import { buildSearchQuery, chatTopic, looksLikeWebQuestion } from "./chat";
import { parseGenie } from "./parse";
import { answer, type PlanSnapshot } from "./answer";

const p = (s: string) => parseGenie(s, ["CASA", "CARTÃO"], 13.65);

describe("conversa simples", () => {
  it("reconhece reações curtas", () => {
    expect(chatTopic("Interessante")).toBe("ack");
    expect(chatTopic("legal!")).toBe("ack");
    expect(chatTopic("ok 👍")).toBe("ack");
    expect(chatTopic("Obrigado, Gênio")).toBe("thanks");
    expect(chatTopic("valeu")).toBe("thanks");
    expect(chatTopic("Oi")).toBe("greet");
    expect(chatTopic("bom dia")).toBe("greet");
    expect(chatTopic("oi, tudo bem?")).toBe("howAreYou");
    expect(chatTopic("quem é você?")).toBe("who");
    expect(chatTopic("kkkk")).toBe("laugh");
    expect(chatTopic("tchau")).toBe("bye");
  });

  it("não confunde pedidos com conversa", () => {
    expect(chatTopic("ok adicionar netflix 55")).toBeNull();
    expect(chatTopic("legal 50")).toBeNull();
    expect(chatTopic("quanto posso gastar por dia")).toBeNull();
    expect(p("adicionar Netflix 55 em casa").kind).toBe("addItems");
  });

  it("vira comando de conversa no parser", () => {
    expect(p("Interessante")).toEqual({ kind: "chat", topic: "ack" });
    expect(p("obrigada!")).toEqual({ kind: "chat", topic: "thanks" });
  });
});

describe("dicas", () => {
  it("entende pedidos de dica", () => {
    for (const s of ["dicas", "me dá dicas", "como economizar?", "o que faço com a sobra?", "dicas para economizar", "me ajuda a economizar"]) {
      expect(p(s), s).toEqual({ kind: "query", topic: "dicas", target: null });
    }
    expect(p("quanto sobra?")).toMatchObject({ kind: "query", topic: "sobra" });
  });

  it("calcula com os números do mês", () => {
    const s: PlanSnapshot = {
      month: "2026-10", monthLabel: "outubro", salary: 5000, today: new Date(2026, 9, 2),
      groups: [{ id: "g", name: "CASA" }],
      items: [
        { id: "1", name: "Aluguel", groupId: "g", type: "fixo", planned: 1800, actual: 1800 },
        { id: "2", name: "Mercado", groupId: "g", type: "variavel", planned: 900, actual: 1000 },
      ],
    };
    const a = answer({ kind: "query", topic: "dicas", target: null }, s)!;
    const text = a.lines!.map((l) => `${l.label}: ${l.value}`).join("\n");
    expect(text).toContain("Mercado");
    expect(text).toContain("Reserva de emergência");
    expect(a.chips?.length).toBeGreaterThan(0);
  });

  it("pede a renda antes", () => {
    const a = answer({ kind: "query", topic: "dicas", target: null }, { month: "2026-10", monthLabel: "outubro", salary: 0, groups: [], items: [] })!;
    expect(a.title).toMatch(/renda/);
  });
});

describe("pesquisa na web", () => {
  it("só pesquisa perguntas gerais", () => {
    expect(looksLikeWebQuestion("vale a pena trocar de plano de celular")).toBe(true);
    expect(looksLikeWebQuestion("o que é CDB?")).toBe(true);
    expect(looksLikeWebQuestion("Tesouro Selic ou poupança?")).toBe(true);
    expect(looksLikeWebQuestion("Interessante")).toBe(false);
    expect(looksLikeWebQuestion("asdf qwer")).toBe(false);
    expect(looksLikeWebQuestion("como adicionar um item no grupo?")).toBe(false);
    expect(looksLikeWebQuestion("o que o Muvo faz?")).toBe(false);
  });

  it("monta a busca com a pergunta anterior quando é continuação", () => {
    expect(buildSearchQuery("Pesquise sobre o que é CDB", null)).toBe("o que é CDB");
    expect(buildSearchQuery("e o LCI?", "o que é CDB")).toBe("o que é CDB e o LCI?");
    expect(buildSearchQuery("quanto rende a poupança?", "o que é CDB")).toBe("quanto rende a poupança?");
  });
});
