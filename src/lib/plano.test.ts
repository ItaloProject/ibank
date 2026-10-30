import { beforeEach, describe, expect, it, vi } from "vitest";

// Linhas que o banco devolve para a consulta de plano
const linhas: Record<string, unknown>[] = [];

vi.mock("@/lib/cardapio-db", () => ({
  default: vi.fn(async () => linhas),
  slugValido: () => true,
}));
vi.mock("@/lib/db", () => ({ default: vi.fn() }));

import { bloqueadoNoNormal, ehPlanoNormal } from "@/lib/cardapio-acesso";

beforeEach(() => {
  linhas.length = 0;
});

describe("plano da pizzaria", () => {
  it("pizzaria no plano normal é normal", async () => {
    linhas.push({ plano: "normal" });
    expect(await ehPlanoNormal("bella-massa")).toBe(true);
  });

  it("pizzaria no plano premium não é normal", async () => {
    linhas.push({ plano: "premium" });
    expect(await ehPlanoNormal("bella-massa")).toBe(false);
  });

  it("pizzaria sem linha não é normal (a rota responde 404 por conta própria)", async () => {
    expect(await ehPlanoNormal("nao-existe")).toBe(false);
  });

  it("recurso premium responde 403 no plano normal", async () => {
    linhas.push({ plano: "normal" });
    const bloqueio = await bloqueadoNoNormal("bella-massa");
    expect(bloqueio?.status).toBe(403);
  });

  it("recurso premium segue no plano premium", async () => {
    linhas.push({ plano: "premium" });
    expect(await bloqueadoNoNormal("bella-massa")).toBeNull();
  });
});
