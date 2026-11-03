import { describe, expect, it, vi } from "vitest";
import { answerNovaCaixinha } from "./bot-inline";

vi.mock("@/lib/bot-page-context", () => ({
  readBotPageContext: () => null,
}));

describe("answerNovaCaixinha", () => {
  it("pede a taxa quando a janela está aberta sem valor", () => {
    const text = answerNovaCaixinha({
      live: { novaCaixinha: { tipo: "Renda fixa", nome: "CDB Nubank", banco: "Nubank", indexador: null, taxa: null } },
    });
    expect(text).toMatch(/Preencha a taxa/i);
    expect(text).toMatch(/Nubank/i);
  });

  it("compara CDI 100% como média", () => {
    const text = answerNovaCaixinha({
      live: {
        novaCaixinha: {
          tipo: "Renda fixa",
          nome: "CDB diário",
          banco: "Nubank",
          indexador: "cdi",
          taxa: "100",
          isentoDeImpostoDeRenda: false,
        },
      },
    });
    expect(text).toMatch(/100% do CDI/);
    expect(text).toMatch(/média/i);
    expect(text).toMatch(/Imposto de Renda/);
  });

  it("marca Turbo 115% como acima da média", () => {
    const text = answerNovaCaixinha({
      live: {
        novaCaixinha: {
          tipo: "Caixinha Turbo",
          nome: "Turbo",
          banco: "Nubank",
          percentualDoCdiTurbo: "115",
          indexador: "cdi",
          taxa: null,
        },
      },
    });
    expect(text).toMatch(/115% do CDI/);
    expect(text).toMatch(/acima da média/i);
  });

  it("ignora quando a janela de caixinha não está aberta", () => {
    expect(answerNovaCaixinha({ live: { novaCaixinha: null } })).toBeNull();
    expect(answerNovaCaixinha(null)).toBeNull();
  });
});
