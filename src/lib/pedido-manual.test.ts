import { describe, expect, it } from "vitest";
import { calcularLinha, ErroPedido, montarPedido, type CardapioSalvo, type ConfigPedidos } from "@/lib/pedido-manual";

const cardapio: CardapioSalvo = {
  tamanhos: [
    { id: "M", nome: "Média", detalhe: "6 fatias" },
    { id: "G", nome: "Grande", detalhe: "8 fatias" },
  ],
  bordas: [
    { nome: "Sem borda", preco: 0 },
    { nome: "Catupiry", preco: 8 },
  ],
  adicionais: [
    { nome: "Bacon", preco: 5 },
    { nome: "Azeitona", preco: 2 },
  ],
  categorias: [
    {
      id: "pizzas",
      nome: "Pizzas",
      pizza: true,
      itens: [
        { id: "mus", nome: "Mussarela", preco: { M: 32, G: 62 } },
        { id: "cal", nome: "Calabresa", preco: { M: 34, G: 66 } },
        { id: "off", nome: "Esgotada", preco: { M: 30, G: 50 }, indisponivel: true },
      ],
    },
    {
      id: "bebidas",
      nome: "Bebidas",
      itens: [
        { id: "ref", nome: "Refrigerante", preco: 6 },
        { id: "suco", nome: "Suco", preco: { P: 5, G: 9 } },
      ],
    },
  ],
};

const config: ConfigPedidos = {
  modos: ["entrega", "retirada", "mesa"],
  taxaEntrega: 6,
  pagamentos: ["Pix", "Dinheiro", "Cartão de crédito"],
  chavePix: "11999999999",
};

const cliente = { nome: "Maria Silva", telefone: "(11) 99999-1234", endereco: "Rua das Flores, 10", referencia: "Portão azul", mesa: null };

describe("calcularLinha", () => {
  it("usa o preço do tamanho escolhido e a quantidade", () => {
    const l = calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 2 });
    expect(l).toEqual({ nome: "Mussarela", variante: "Média · 6 fatias", qtd: 2, preco: 32, detalhes: [], obs: null });
  });

  it("meio a meio cobra o sabor mais caro no mesmo tamanho", () => {
    const l = calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "G", qtd: 1, meioItemId: "cal" });
    expect(l.nome).toBe("Meia Mussarela / Meia Calabresa");
    expect(l.preco).toBe(66);
  });

  it("borda e adicionais somam ao preço e aparecem nos detalhes", () => {
    const l = calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 1, borda: 1, adicionais: [1, 0] });
    expect(l.preco).toBe(32 + 8 + 2 + 5);
    // Mesma ordem do carrinho: os índices dos adicionais são ordenados antes de virar texto
    expect(l.detalhes).toEqual(["Borda: Catupiry", "+ Bacon", "+ Azeitona"]);
  });

  it("borda 0 não aparece nos detalhes e não cobra nada", () => {
    const l = calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 1, borda: 0 });
    expect(l.preco).toBe(32);
    expect(l.detalhes).toEqual([]);
  });

  it("borda e adicionais não valem para bebida", () => {
    const l = calcularLinha(cardapio, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1, borda: 1, adicionais: [0] });
    expect(l.preco).toBe(6);
    expect(l.detalhes).toEqual([]);
  });

  it("item de preço fixo não tem variante", () => {
    expect(calcularLinha(cardapio, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 3 }).variante).toBeNull();
  });

  it("observação vai aparada e vazia vira null", () => {
    expect(calcularLinha(cardapio, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1, obs: "  sem gelo  " }).obs).toBe("sem gelo");
    expect(calcularLinha(cardapio, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1, obs: "   " }).obs).toBeNull();
  });

  it("recusa item indisponível, tamanho inexistente e quantidade inválida", () => {
    expect(() => calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "off", varKey: "M", qtd: 1 })).toThrow(ErroPedido);
    expect(() => calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "P", qtd: 1 })).toThrow(ErroPedido);
    expect(() => calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 0 })).toThrow(ErroPedido);
  });

  it("recusa meio a meio com sabor fora do tamanho ou em bebida", () => {
    expect(() => calcularLinha(cardapio, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1, meioItemId: "cal" })).toThrow(ErroPedido);
    expect(() => calcularLinha(cardapio, { categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 1, meioItemId: "mus" })).toThrow(ErroPedido);
  });
});

describe("montarPedido", () => {
  it("soma subtotal e aplica a taxa só na entrega", () => {
    const escolhas = [{ categoriaId: "pizzas", itemId: "mus", varKey: "M", qtd: 2 }, { categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1 }];
    const entrega = montarPedido(cardapio, config, { modo: "entrega", cliente, escolhas, pagamento: "Pix" });
    expect(entrega.subtotal).toBe(70);
    expect(entrega.taxa).toBe(6);
    expect(entrega.total).toBe(76);
    const retirada = montarPedido(cardapio, config, { modo: "retirada", cliente, escolhas, pagamento: "Pix" });
    expect(retirada.taxa).toBe(0);
    expect(retirada.total).toBe(70);
  });

  it("entrega exige endereço e mesa exige número da mesa", () => {
    const escolhas = [{ categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1 }];
    expect(() => montarPedido(cardapio, config, { modo: "entrega", cliente: { ...cliente, endereco: "" }, escolhas, pagamento: "Pix" })).toThrow("Informe o endereço");
    expect(() => montarPedido(cardapio, config, { modo: "mesa", cliente: { ...cliente, mesa: "" }, escolhas, pagamento: "Pix" })).toThrow("Informe a mesa");
  });

  it("só aceita modo e pagamento que a pizzaria tem ligados", () => {
    const escolhas = [{ categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1 }];
    expect(() => montarPedido({ ...cardapio }, { ...config, modos: ["retirada"] }, { modo: "entrega", cliente, escolhas, pagamento: "Pix" })).toThrow("tipo de atendimento");
    expect(() => montarPedido(cardapio, config, { modo: "retirada", cliente, escolhas, pagamento: "Boleto" })).toThrow("Boleto");
    expect(() => montarPedido(cardapio, { ...config, chavePix: "" }, { modo: "retirada", cliente, escolhas, pagamento: "Pix" })).toThrow("Pix sem chave");
  });

  it("guarda troco só para dinheiro", () => {
    const escolhas = [{ categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1 }];
    expect(montarPedido(cardapio, config, { modo: "retirada", cliente, escolhas, pagamento: "Dinheiro", troco: " 50 " }).troco).toBe("50");
    expect(montarPedido(cardapio, config, { modo: "retirada", cliente, escolhas, pagamento: "Pix", troco: "50" }).troco).toBe("");
  });

  it("limpa o telefone e exige nome", () => {
    const escolhas = [{ categoriaId: "bebidas", itemId: "ref", varKey: "unico", qtd: 1 }];
    expect(montarPedido(cardapio, config, { modo: "retirada", cliente: { ...cliente, telefone: "(11) 99999-1234" }, escolhas, pagamento: "Pix" }).cliente.telefone).toBe("11999991234");
    expect(() => montarPedido(cardapio, config, { modo: "retirada", cliente: { ...cliente, nome: "M" }, escolhas, pagamento: "Pix" })).toThrow("nome");
  });
});
