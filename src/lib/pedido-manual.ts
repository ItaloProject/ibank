/**
 * Monta um pedido lançado pelo painel (telefone, balcão, mesa) com os preços do cardápio salvo.
 * O preço é calculado aqui, no servidor, e não o que a tela envia. Mesmas regras da janela do item no cardápio:
 * tamanho define o preço; meio a meio usa o sabor mais caro; borda e adicionais somam (só pizza).
 */

export type Opcao = { nome: string; preco: number };
export type Tamanho = { id: string; nome: string; detalhe?: string };
export type ItemSalvo = { id: string; nome: string; preco: number | Record<string, number>; indisponivel?: boolean };
export type CategoriaSalva = { id: string; nome: string; pizza?: boolean; itens: ItemSalvo[] };

export type CardapioSalvo = {
  tamanhos?: Tamanho[];
  bordas?: Opcao[];
  adicionais?: Opcao[];
  categorias?: CategoriaSalva[];
};

export type ConfigPedidos = {
  ativo?: boolean;
  modos: string[];
  taxaEntrega: number;
  pagamentos: string[];
  chavePix?: string;
};

export type EscolhaItem = {
  categoriaId: string;
  itemId: string;
  /** Tamanho escolhido ("unico" para item de preço fixo) */
  varKey: string;
  qtd: number;
  /** Id do outro sabor (só pizza, no mesmo tamanho) */
  meioItemId?: string | null;
  /** Índice em bordas; 0 = sem borda */
  borda?: number | null;
  /** Índices em adicionais */
  adicionais?: number[];
  obs?: string | null;
};

export type LinhaPedido = {
  nome: string;
  variante: string | null;
  qtd: number;
  preco: number;
  detalhes: string[];
  obs: string | null;
};

export type Cliente = { nome: string; telefone: string | null; endereco: string | null; referencia: string | null; mesa: string | null };

export class ErroPedido extends Error {}

const centavos = (valor: number) => Math.round(valor * 100) / 100;

function categoriaDe(cardapio: CardapioSalvo, id: string): CategoriaSalva {
  const cat = cardapio.categorias?.find((c) => c.id === id);
  if (!cat) throw new ErroPedido("Categoria não encontrada no cardápio");
  return cat;
}

function itemDe(categoria: CategoriaSalva, id: string): ItemSalvo {
  const item = categoria.itens.find((i) => i.id === id);
  if (!item) throw new ErroPedido("Item não encontrado no cardápio");
  if (item.indisponivel) throw new ErroPedido(`${item.nome} está indisponível`);
  return item;
}

/** Calcula uma linha do pedido: preço unitário com borda, adicionais e meio a meio, e os detalhes que aparecem na comanda */
export function calcularLinha(cardapio: CardapioSalvo, e: EscolhaItem): LinhaPedido {
  if (!Number.isInteger(e.qtd) || e.qtd < 1 || e.qtd > 50) throw new ErroPedido("Quantidade inválida");
  const categoria = categoriaDe(cardapio, e.categoriaId);
  const item = itemDe(categoria, e.itemId);
  const pizza = !!categoria.pizza;

  // Preço do tamanho escolhido
  let precoBase: number;
  let variante: string | null = null;
  if (typeof item.preco === "number") {
    precoBase = item.preco;
  } else {
    if (!(e.varKey in item.preco)) throw new ErroPedido(`${item.nome} não tem o tamanho escolhido`);
    precoBase = item.preco[e.varKey];
    const tamanho = pizza ? cardapio.tamanhos?.find((t) => t.id === e.varKey) : undefined;
    const rotulo = tamanho?.nome ?? e.varKey;
    variante = `${rotulo}${tamanho?.detalhe && pizza ? ` · ${tamanho.detalhe}` : ""}`;
  }

  // Meio a meio: o sabor mais caro define o preço, no mesmo tamanho
  let nome = item.nome;
  if (e.meioItemId) {
    if (!pizza) throw new ErroPedido("Meio a meio só vale para pizza");
    const outro = (cardapio.categorias ?? [])
      .filter((c) => c.pizza)
      .flatMap((c) => c.itens)
      .find((i) => i.id === e.meioItemId && i.id !== item.id && !i.indisponivel && typeof i.preco !== "number" && e.varKey in i.preco);
    if (!outro || typeof outro.preco === "number") throw new ErroPedido("Sabor do meio a meio indisponível neste tamanho");
    precoBase = Math.max(precoBase, outro.preco[e.varKey]);
    nome = `Meia ${item.nome} / Meia ${outro.nome}`;
  }

  // Borda e adicionais: só pizza
  const detalhes: string[] = [];
  let extra = 0;
  if (pizza) {
    const indiceBorda = e.borda ?? 0;
    const borda = cardapio.bordas?.[indiceBorda];
    extra += borda?.preco ?? 0;
    if (indiceBorda > 0 && borda) detalhes.push(`Borda: ${borda.nome}`);

    for (const i of [...(e.adicionais ?? [])].sort()) {
      const adicional = cardapio.adicionais?.[i];
      if (!adicional) throw new ErroPedido("Adicional não encontrado no cardápio");
      extra += adicional.preco;
      detalhes.push(`+ ${adicional.nome}`);
    }
  }

  const obs = e.obs?.trim() ? e.obs.trim().slice(0, 300) : null;
  return {
    nome,
    variante,
    qtd: e.qtd,
    preco: centavos(precoBase + extra),
    detalhes,
    obs,
  };
}

/** Confere o cliente de acordo com o modo de atendimento */
function clienteValido(modo: string, c: Partial<Cliente>): Cliente {
  const nome = (c.nome ?? "").trim();
  if (nome.length < 2 || nome.length > 60) throw new ErroPedido("Informe o nome do cliente (2 a 60 caracteres)");
  const telefone = (c.telefone ?? "").replace(/\D/g, "") || null;
  if (telefone && (telefone.length < 10 || telefone.length > 13)) throw new ErroPedido("Telefone inválido");
  const endereco = (c.endereco ?? "").trim() || null;
  const referencia = (c.referencia ?? "").trim().slice(0, 120) || null;
  const mesa = (c.mesa ?? "").trim().slice(0, 20) || null;
  if (modo === "entrega" && (!endereco || endereco.length < 5)) throw new ErroPedido("Informe o endereço de entrega");
  if (modo === "mesa" && !mesa) throw new ErroPedido("Informe a mesa");
  return { nome, telefone, endereco: modo === "entrega" ? endereco : null, referencia: modo === "entrega" ? referencia : null, mesa: modo === "mesa" ? mesa : null };
}

export type PedidoMontado = {
  modo: string;
  cliente: Cliente;
  itens: LinhaPedido[];
  subtotal: number;
  taxa: number;
  total: number;
  pagamento: string;
  troco: string;
};

/** Linhas e totais do pedido, sem conferir cliente nem pagamento. A tela usa isso na prévia do valor. */
export function calcularTotais(cardapio: CardapioSalvo, config: ConfigPedidos, modo: string, escolhas: EscolhaItem[]) {
  if (!config.modos.includes(modo)) throw new ErroPedido("Esse tipo de atendimento não está ligado na pizzaria");
  if (escolhas.length === 0) throw new ErroPedido("Adicione pelo menos um item");
  if (escolhas.length > 40) throw new ErroPedido("Pedido com itens demais");

  const itens = escolhas.map((e) => calcularLinha(cardapio, e));
  const subtotal = centavos(itens.reduce((soma, l) => soma + l.preco * l.qtd, 0));
  const taxa = modo === "entrega" ? centavos(config.taxaEntrega) : 0;
  return { itens, subtotal, taxa, total: centavos(subtotal + taxa) };
}

/** Monta o pedido inteiro. Lança ErroPedido com a mensagem para o atendente se algo não puder ser lançado. */
export function montarPedido(
  cardapio: CardapioSalvo,
  config: ConfigPedidos,
  entrada: { modo: string; cliente: Partial<Cliente>; escolhas: EscolhaItem[]; pagamento: string; troco?: string | null },
): PedidoMontado {
  const totais = calcularTotais(cardapio, config, entrada.modo, entrada.escolhas);

  if (!config.pagamentos.includes(entrada.pagamento)) throw new ErroPedido(`${entrada.pagamento} não está nas formas de pagamento da pizzaria`);
  if (entrada.pagamento === "Pix" && !config.chavePix?.trim()) throw new ErroPedido("Pix sem chave cadastrada");

  const troco = entrada.pagamento === "Dinheiro" ? (entrada.troco ?? "").trim().slice(0, 40) : "";

  return {
    modo: entrada.modo,
    cliente: clienteValido(entrada.modo, entrada.cliente),
    itens: totais.itens,
    subtotal: totais.subtotal,
    taxa: totais.taxa,
    total: totais.total,
    pagamento: entrada.pagamento,
    troco,
  };
}
