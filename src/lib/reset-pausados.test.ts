import { describe, expect, it } from "vitest";
import { zerarPausados } from "@/lib/reset-pausados";

const cardapio = {
  tamanhos: [{ id: "M", nome: "Média" }],
  categorias: [
    {
      id: "pizzas",
      itens: [
        { id: "mus", nome: "Mussarela", preco: 32, indisponivel: true },
        { id: "cal", nome: "Calabresa", preco: 34 },
      ],
    },
    { id: "bebidas", itens: [{ id: "ref", nome: "Refrigerante", preco: 6, indisponivel: true }] },
  ],
};

describe("zerarPausados", () => {
  it("tira a pausa de todos os itens pausados e conta quantos eram", () => {
    const r = zerarPausados(cardapio);
    expect(r.quantidade).toBe(2);
    expect(r.cardapio.categorias[0].itens[0]).toEqual({ id: "mus", nome: "Mussarela", preco: 32 });
    expect(r.cardapio.categorias[1].itens[0]).toEqual({ id: "ref", nome: "Refrigerante", preco: 6 });
  });

  it("não mexe no restante do cardápio nem no original", () => {
    const r = zerarPausados(cardapio);
    expect(r.cardapio.tamanhos).toEqual(cardapio.tamanhos);
    expect(r.cardapio.categorias[0].itens[1]).toEqual(cardapio.categorias[0].itens[1]);
    expect(cardapio.categorias[0].itens[0].indisponivel).toBe(true);
  });

  it("sem itens pausados, não muda nada", () => {
    const limpo = { categorias: [{ id: "p", itens: [{ id: "x", nome: "X", preco: 1 }] }] };
    const r = zerarPausados(limpo);
    expect(r.quantidade).toBe(0);
    expect(r.cardapio).toEqual(limpo);
  });
});
