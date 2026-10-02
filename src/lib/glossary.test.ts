import { describe, expect, it } from "vitest";
import { TERMS, askAbout, findTerms, termById } from "./glossary";
import { parseGenie } from "./genie/parse";

const ids = (s: string, bare?: boolean) => findTerms(s, { bare }).map((t) => t.id);

describe("glossário", () => {
  it("cada termo relacionado existe", () => {
    for (const t of TERMS) for (const r of t.related ?? []) expect(termById(r), `${t.id} → ${r}`).toBeDefined();
  });

  it("entende pedidos de definição", () => {
    expect(ids("O que é CDB?")).toEqual(["cdb"]);
    expect(ids("o que significa FGC")).toEqual(["fgc"]);
    expect(ids("me explica juros compostos")).toEqual(["juros-compostos"]);
    expect(ids("como funciona o Tesouro Direto?")).toEqual(["tesouro-direto"]);
    expect(ids("o que é tesouro ipca+")).toEqual(["tesouro-ipca"]);
    expect(ids("Tesouro Selic é o que?")).toEqual(["tesouro-selic"]);
    expect(ids("o que são FIIs")).toEqual(["fiis"]);
    expect(ids("o que é reserva de emergência?")).toEqual(["reserva-emergencia"]);
    expect(ids("aporte?")).toEqual(["aporte"]);
  });

  it("mostra os dois lados de uma diferença", () => {
    expect(ids("qual a diferença entre LCI e CDB?")).toEqual(["lci-lca", "cdb"]);
    expect(ids("renda ativa vs renda passiva")).toEqual(["renda-ativa", "renda-passiva"]);
  });

  it("prefere o termo mais específico", () => {
    expect(ids("o que é Tesouro Selic")).toEqual(["tesouro-selic"]);
    expect(ids("o que é taxa Selic")).toEqual(["selic"]);
  });

  it("deixa conselhos, contas e pedidos para os outros caminhos", () => {
    expect(ids("o que é melhor, CDB ou LCI?")).toEqual([]);
    expect(ids("vale a pena investir em FIIs")).toEqual([]);
    expect(ids("quanto rende o CDB")).toEqual([]);
    expect(ids("aporte de 500 por mês")).toEqual([]);
    expect(ids("meus FIIs estão rendendo bem")).toEqual([]);
    expect(ids("FIIs", false)).toEqual([]);
  });

  it("o Gênio responde pelo glossário", () => {
    expect(parseGenie("o que é CDB?", [], 13.65)).toEqual({ kind: "term", ids: ["cdb"] });
    expect(parseGenie("juros compostos", [], 13.65)).toEqual({ kind: "term", ids: ["juros-compostos"] });
    expect(parseGenie("500 por mês a 1% ao mês por 2 anos", [], 13.65).kind).toBe("compound");
    expect(parseGenie("dicas para economizar", [], 13.65).kind).toBe("query");
  });

  it("monta as perguntas dos botões sem a sigla por extenso", () => {
    expect(askAbout(termById("cdb")!)).toBe("o que é CDB?");
  });
});
