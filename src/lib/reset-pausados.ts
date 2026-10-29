type ItemCardapio = { indisponivel?: boolean; [campo: string]: unknown };

/** Tira a pausa de todos os itens do cardápio. Devolve o cardápio novo e quantos itens estavam pausados. */
export function zerarPausados<T extends { categorias?: { itens: ItemCardapio[] }[] }>(cardapio: T): { cardapio: T; quantidade: number } {
  let quantidade = 0;
  const categorias = (cardapio.categorias ?? []).map((cat) => ({
    ...cat,
    itens: cat.itens.map((item) => {
      if (!item.indisponivel) return item;
      quantidade += 1;
      const { indisponivel: _pausado, ...semPausa } = item;
      return semPausa;
    }),
  }));
  return { cardapio: { ...cardapio, categorias }, quantidade };
}
