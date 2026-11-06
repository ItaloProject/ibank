/**
 * Respostas do assistente Muvo sem modelo de linguagem: usa só os números
 * da carteira e atalhos conhecidos. Mantém o bot útil sem custo de API.
 */

export type LocalHolding = { ticker: string; kind: string; value: number };
export type LocalSource = { nome: string; tipo: string; capital: number; rendaMensal: number };
export type LocalAlert = { id: string; titulo: string; nivel: string };

export type LocalPortfolio = {
  grandTotal: number;
  totalRendaMensal: number;
  incomeGoal: number;
  holdings: LocalHolding[];
  sources: LocalSource[];
  alerts: LocalAlert[];
  /** Resultado em bolsa (valor atual − investido), quando conhecido. */
  bolsaResultado?: number | null;
  /** Só menciona caixinha Emergência se o usuário já tiver criado uma. */
  hasEmergenciaCaixinha?: boolean;
};

export type LocalHit =
  | { kind: "intent"; intent: "visao" | "rebal" | "meta" | "avisos" | "fiis" | "whatsapp" | "perfil" | "pdf" }
  | { kind: "text"; text: string; followups?: Array<"visao" | "rebal" | "meta" | "avisos" | "fiis"> };

function norm(raw: string): string {
  return raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Detecta pedidos de números da carteira e devolve texto pronto ou um atalho de tela. */
export function matchLocalPortfolio(question: string, ctx: LocalPortfolio): LocalHit | null {
  const t = norm(question);
  const bolsa = ctx.holdings.filter((h) => /^(Ação|FII|ETF)$/i.test(h.kind));
  const totalBolsa = bolsa.reduce((s, h) => s + h.value, 0);
  const fiis = ctx.holdings.filter((h) => /FII/i.test(h.kind));
  const acoes = ctx.holdings.filter((h) => /Ação|Acao/i.test(h.kind));
  const turbo = ctx.sources.find((s) => /turbo/i.test(s.nome) || /turbo/i.test(s.tipo));
  const saldo = ctx.sources.find((s) => /saldo/i.test(s.nome) || /saldo/i.test(s.tipo));
  const rendaFixa = ctx.sources.filter((s) => /renda fixa|prefixad|cdb|tesouro|lci|lca|pos.?fix/i.test(`${s.nome} ${s.tipo}`));

  if (/bolsa (esta|ta) negativ|por ?que .*bolsa|resultado (em )?bolsa|prejuizo (na |em )?bolsa/.test(t)) {
    if (typeof ctx.bolsaResultado === "number") {
      const sinal = ctx.bolsaResultado < 0 ? "negativo" : ctx.bolsaResultado > 0 ? "positivo" : "zerado";
      const text =
        `O resultado em bolsa está **${sinal}: ${brl(ctx.bolsaResultado)}**` +
        (totalBolsa > 0 ? ` sobre ${brl(totalBolsa)} em posições.` : ".") +
        " Queda no preço não realiza prejuízo enquanto você não vende. Vale olhar o plano de rebalanceamento antes de decidir.";
      return { kind: "text", text, followups: ["rebal", "avisos", "visao"] };
    }
    return { kind: "intent", intent: "visao" };
  }

  if (/quanto (eu )?(tenho|esta) (na |em )?bolsa|minha bolsa|posicoes? (em )?bolsa/.test(t)) {
    if (!bolsa.length) {
      return { kind: "text", text: "Você ainda não tem posições em bolsa cadastradas.", followups: ["rebal", "fiis"] };
    }
    const linhas = [...bolsa]
      .sort((a, b) => b.value - a.value)
      .map((h) => `- **${h.ticker}** (${h.kind}): ${brl(h.value)}`);
    return {
      kind: "text",
      text: `Na bolsa você tem **${brl(totalBolsa)}** em ${bolsa.length} ${bolsa.length === 1 ? "posição" : "posições"}.\n\n${linhas.join("\n")}`,
      followups: ["avisos", "rebal"],
    };
  }

  if (/quanto (eu )?(tenho|esta) (na |em )?turbo|minha turbo|teto da turbo|turbo passou/.test(t)) {
    if (turbo) {
      return {
        kind: "text",
        text: `Na TURBO você tem **${brl(turbo.capital)}**, com renda estimada de ${brl(turbo.rendaMensal)}/mês.` +
          (ctx.alerts.some((a) => /turbo|teto/i.test(a.titulo))
            ? " Há um aviso de teto: o que passa do limite rende menos — veja em Avisos."
            : ""),
        followups: ["avisos", "rebal"],
      };
    }
    return { kind: "intent", intent: "visao" };
  }

  if (/quanto (eu )?(tenho|esta) em (renda )?fixa|minha renda fixa|prefixad/.test(t)) {
    if (rendaFixa.length) {
      const total = rendaFixa.reduce((s, x) => s + x.capital, 0);
      const linhas = rendaFixa.map((s) => `- **${s.nome}**: ${brl(s.capital)}`);
      return {
        kind: "text",
        text: `Em renda fixa você tem cerca de **${brl(total)}**.\n\n${linhas.join("\n")}`,
        followups: ["rebal", "visao"],
      };
    }
    return { kind: "intent", intent: "visao" };
  }

  if (/quanto (eu )?(tenho|esta) (em )?fiis?|meus fiis|quais (sao )?os meus fiis/.test(t)) {
    if (!fiis.length) {
      return { kind: "text", text: "Você ainda não tem fundos imobiliários na carteira.", followups: ["fiis", "rebal"] };
    }
    const total = fiis.reduce((s, h) => s + h.value, 0);
    const linhas = fiis.map((h) => `- **${h.ticker}**: ${brl(h.value)}`);
    return {
      kind: "text",
      text: `Em FIIs você tem **${brl(total)}**.\n\n${linhas.join("\n")}`,
      followups: ["fiis", "visao"],
    };
  }

  if (/quanto (eu )?(tenho|esta) (em )?acoes|minhas acoes/.test(t)) {
    if (!acoes.length) {
      return { kind: "text", text: "Você ainda não tem ações cadastradas.", followups: ["rebal", "visao"] };
    }
    const total = acoes.reduce((s, h) => s + h.value, 0);
    const linhas = acoes.map((h) => `- **${h.ticker}**: ${brl(h.value)}`);
    return {
      kind: "text",
      text: `Em ações você tem **${brl(total)}**.\n\n${linhas.join("\n")}`,
      followups: ["avisos", "rebal"],
    };
  }

  if (/saldo em conta|dinheiro parado|quanto (tem|ha|tenho) (na )?conta\b/.test(t)) {
    const text = saldo
      ? `Você tem **${brl(saldo.capital)}** em saldo em conta. Esse valor não rende: o plano sugere aplicar pelo rebalanceamento.`
      : `Patrimônio total **${brl(ctx.grandTotal)}**. Para ver o saldo em conta e onde aportar, abra a visão da carteira.`;
    return { kind: "text", text, followups: ["rebal", "visao"] };
  }

  if (/renda (passiva|mensal)|quanto (eu )?recebo|proventos?|dividendos?/.test(t) && !/falta|meta/.test(t)) {
    const linhas = ctx.sources
      .filter((s) => s.rendaMensal > 0)
      .map((s) => `- **${s.nome}** (${s.tipo}): +${brl(s.rendaMensal)}/mês`);
    const text = linhas.length
      ? `Renda passiva estimada: **${brl(ctx.totalRendaMensal)}** por mês.\n\n${linhas.join("\n")}`
      : "Ainda não identifiquei fontes de renda passiva na carteira.";
    return { kind: "text", text, followups: ["meta", "visao"] };
  }

  if (/patrimon|total (da|da minha)? carteira|meu total|quanto esta (a|a minha) carteira|quanto (eu )?tenho\??$|quanto (eu )?tenho no total/.test(t)) {
    const text =
      `Seu patrimônio está em **${brl(ctx.grandTotal)}**.` +
      (totalBolsa > 0 ? ` Na bolsa: ${brl(totalBolsa)} em ${bolsa.length} ${bolsa.length === 1 ? "posição" : "posições"}.` : "") +
      (ctx.totalRendaMensal > 0 ? ` Renda passiva estimada: **${brl(ctx.totalRendaMensal)}** por mês.` : "");
    return { kind: "text", text, followups: ["visao", "rebal"] };
  }

  // Ticker específico na carteira
  const tick = t.toUpperCase().match(/\b([A-Z]{4}\d{1,2})\b/);
  if (tick) {
    const h = ctx.holdings.find((x) => x.ticker.toUpperCase() === tick[1]);
    if (h) {
      return {
        kind: "text",
        text: `Você tem **${h.ticker}** (${h.kind}) avaliado em **${brl(h.value)}** na carteira.`,
        followups: ["avisos", "rebal"],
      };
    }
  }

  if (/o que fazer (agora|com (o )?saldo)|proxima acao|por onde comeco|me ajuda|nao sei o que fazer/.test(t)) {
    if (ctx.alerts.length) return { kind: "intent", intent: "avisos" };
    return { kind: "intent", intent: "rebal" };
  }

  if (/vender|devo vender|vale vender/.test(t) && tick) {
    return {
      kind: "text",
      text:
        "Eu não indico compra ou venda de um papel isolado. Olhe o aviso de preço (se houver), o seu perfil e o rebalanceamento: vender só para 'estancar' uma queda costuma realizar o prejuízo.",
      followups: ["avisos", "rebal"],
    };
  }

  // Reserva: Tesouro Selic vs CDB diário (e “não use poupança”) — resposta pronta, sem IA.
  const reservaChoice = matchReservaProductChoice(t, Boolean(ctx.hasEmergenciaCaixinha));
  if (reservaChoice) return reservaChoice;

  return null;
}

function emeRegisterHint(hasEme: boolean): string {
  return hasEme
    ? " Como você já tem caixinha **Emergência**, atualize o saldo nela depois de aplicar."
    : "";
}

/** Escolha objetiva para a reserva de emergência: Selic, CDB diário ou poupança. */
export function matchReservaProductChoice(
  normalizedQuestion: string,
  hasEmergenciaCaixinha = false,
): LocalHit | null {
  const t = normalizedQuestion;
  const mentionsSelic = /tesouro selic|\bselic\b/.test(t);
  const mentionsCdb = /\bcdb\b/.test(t);
  const mentionsPoupanca = /poupanca|caderneta/.test(t);
  const asksChoice =
    /qual|o que (eu )?(uso|utilizo|escolho|pego)|melhor|ou |vs|versus|em vez|no lugar|reserv/.test(t) ||
    /liquidez diari/.test(t);

  if (!asksChoice) return null;
  if (!(mentionsSelic || mentionsCdb || mentionsPoupanca)) return null;
  // Evita engolir perguntas só de definição (“o que é CDB?”).
  if (/^o que e\b|^o que sao\b|^o que significa\b|^explica\b|^me explica\b/.test(t) && !/ou |melhor|qual /.test(t)) {
    return null;
  }

  const hint = emeRegisterHint(hasEmergenciaCaixinha);

  if (mentionsPoupanca && !(mentionsSelic || mentionsCdb)) {
    return {
      kind: "text",
      text:
        "**Não use poupança na reserva.** Com a Selic alta ela rende menos que **Tesouro Selic** ou **CDB 100% do CDI com liquidez diária**, mesmo depois do Imposto de Renda.\n\n" +
        `Aplique no Selic ou no CDB diário.${hint}`,
      followups: ["rebal", "visao"],
    };
  }

  if (mentionsSelic && mentionsCdb) {
    return {
      kind: "text",
      text:
        "Para a **reserva de emergência**, os dois servem — desde que o CDB tenha **liquidez diária** (ou D+1) e pague cerca de **100% do CDI**.\n\n" +
        "- **Tesouro Selic:** mais seguro (Tesouro Nacional), resgate em dia útil. Escolha padrão do MUVO se o banco não tiver CDB diário bom.\n" +
        "- **CDB 100% CDI liquidez diária:** rendimento parecido; use se for o mais fácil de sacar no seu banco (até R$ 250 mil pelo Fundo Garantidor de Créditos).\n\n" +
        `**Não use poupança.**${hint}`,
      followups: ["rebal", "visao"],
    };
  }

  if (mentionsSelic) {
    return {
      kind: "text",
      text:
        `**Tesouro Selic** é a escolha padrão do MUVO para a reserva: acompanha a Selic, resgata rápido e é garantia do Tesouro. Alternativa equivalente: **CDB 100% do CDI com liquidez diária**. Evite poupança.${hint}`,
      followups: ["rebal", "visao"],
    };
  }

  if (mentionsCdb) {
    return {
      kind: "text",
      text:
        `Para a reserva, o CDB precisa ter **liquidez diária** (ou D+1) e preferencialmente **100% do CDI**. Se o seu banco não tiver isso, use **Tesouro Selic**. Poupança não é indicada.${hint}`,
      followups: ["rebal", "visao"],
    };
  }

  return null;
}
