/**
 * Respostas do Muvo dentro de janelas (ex.: nova caixinha), sem modelo de linguagem.
 */

import {
  BANKS,
  BANK_RATES_CHECKED_LABEL,
  BANK_RATES_STALE_DAYS,
  bankProductRate,
  bankRatesAgeDays,
  findBankByName,
  productsForTipo,
  type BankProductKind,
  type CaixinhaTipo,
} from "@/lib/bank-rates";
import { answerMarkdown } from "@/lib/genie/answer";
import { chatTopic, investorChatText } from "@/lib/genie/chat";
import { financeReply } from "@/lib/genie/local-answer";
import { findTerms, termMarkdown } from "@/lib/glossary";
import { FALLBACK_CDI } from "@/lib/investment-rates";
import { readBotPageContext } from "@/lib/bot-page-context";

/** Formato publicado por `liveBotContext` (nomes em português para o assistente). */
type NovaCaixinhaCtx = {
  tipo?: string | null;
  nome?: string | null;
  banco?: string | null;
  percentualDoCdiTurbo?: string | null;
  indexador?: string | null;
  taxa?: string | null;
  vencimento?: string | null;
  isentoDeImpostoDeRenda?: boolean;
};

function parsePct(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(String(raw).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function tipoFromLabel(label: string | null | undefined): CaixinhaTipo {
  const t = (label ?? "").toLowerCase();
  if (/turbo/.test(t)) return "turbo";
  if (/emergencia|reserva/.test(t)) return "emergencia";
  return "investimentos";
}

function peersFor(tipo: CaixinhaTipo, index: string) {
  const kindsByTipo: Record<CaixinhaTipo, readonly BankProductKind[]> = {
    turbo: ["turbo", "liquidez"],
    emergencia: ["liquidez", "turbo", "poupanca"],
    investimentos: ["cdb", "lca", "lci", "liquidez"],
  };
  const kinds = kindsByTipo[tipo];
  const list: { banco: string; produto: string; taxa: string; value: number; index: string; isento: boolean }[] = [];
  for (const b of BANKS) {
    for (const p of b.products) {
      if (!kinds.includes(p.kind)) continue;
      if (index === "cdi" && p.rate_index !== "cdi") continue;
      if (index === "pre" && p.rate_index !== "pre") continue;
      if (index === "poupanca" && p.rate_index !== "poupanca") continue;
      list.push({
        banco: b.nome,
        produto: p.nome,
        taxa: bankProductRate(p),
        value: p.rate_value,
        index: p.rate_index,
        isento: p.tax_exempt,
      });
    }
  }
  return list.sort((a, b) => b.value - a.value);
}

/** Avalia a taxa da caixinha que está sendo cadastrada, com a tabela local de bancos. */
export function answerNovaCaixinha(page: Record<string, unknown> | null): string | null {
  const live = (page?.live ?? null) as { novaCaixinha?: NovaCaixinhaCtx | null } | null;
  const cx = live?.novaCaixinha;
  if (!cx) return null;

  const tipo = tipoFromLabel(cx.tipo);
  const bank = findBankByName(cx.banco ?? "");
  const index = (cx.indexador || (tipo === "turbo" ? "cdi" : "")) as string;
  const value = tipo === "turbo" ? parsePct(cx.percentualDoCdiTurbo) : parsePct(cx.taxa);

  const lines: string[] = [];
  const age = bankRatesAgeDays();
  const stale = age > BANK_RATES_STALE_DAYS;

  if (!index || value === null) {
    lines.push("Preencha a taxa (e o índice, se não for Turbo) para eu comparar com os outros bancos.");
    if (bank) {
      const prods = productsForTipo(bank, tipo);
      if (prods.length) {
        lines.push(`No **${bank.nome}**, taxas típicas para esse tipo:`);
        for (const p of prods.slice(0, 3)) {
          lines.push(`• ${p.nome}: **${bankProductRate(p)}**${p.tax_exempt ? " · sem Imposto de Renda" : " · paga Imposto de Renda"}`);
        }
      }
    }
    lines.push(`Tabela conferida em ${BANK_RATES_CHECKED_LABEL}${stale ? " (pode ter mudado)" : ""}. Confira no app do banco.`);
    return lines.join("\n");
  }

  const peers = peersFor(tipo, index === "cdi" || index === "pre" || index === "poupanca" ? index : "cdi");
  const label =
    index === "cdi"
      ? `${String(value).replace(".", ",")}% do CDI`
      : index === "pre"
        ? `${String(value).replace(".", ",")}% ao ano (prefixado)`
        : "poupança";

  const nome = (cx.nome ?? "").trim() || "esta aplicação";
  const inst = (cx.banco ?? "").trim();
  lines.push(`**${nome}**${inst ? ` no ${inst}` : ""}: **${label}**.`);

  const exempt = cx.isentoDeImpostoDeRenda === true || index === "poupanca" || /lci|lca/i.test(nome);
  lines.push(exempt ? "Em regra, **isenta de Imposto de Renda** (LCI, LCA ou poupança)." : "Em regra, **paga Imposto de Renda** (tabela regressiva no CDB e similares).");

  if (index === "cdi" && peers.length) {
    const better = peers.filter((p) => p.value > value + 0.05).slice(0, 3);
    const similar = peers.filter((p) => Math.abs(p.value - value) <= 2).slice(0, 3);
    const top = peers[0];
    if (value >= 110) {
      lines.push("Taxa **acima da média** do mercado para liquidez/CDB típico (muitos ficam em 100% do CDI). Boa captura, se a liquidez e o prazo baterem com o seu plano.");
    } else if (value >= 100) {
      lines.push("Taxa **na média** do que os bancos costumam oferecer em CDB/liquidez (por volta de 100% do CDI).");
    } else if (value >= 90) {
      lines.push("Taxa **abaixo de 100% do CDI**. Só faz sentido se for LCI/LCA isenta e a diferença líquida compensar o Imposto de Renda de um CDB a 100%.");
    } else {
      lines.push("Taxa **fraca** frente ao CDI. Vale procurar outro banco ou produto antes de travar esse valor.");
    }
    if (top) lines.push(`Referência alta na tabela: **${top.banco}** · ${top.produto} · ${top.taxa}${top.isento ? " (sem IR)" : ""}.`);
    if (better.length) {
      lines.push("Um pouco acima da sua:");
      for (const p of better) lines.push(`• ${p.banco}: ${p.taxa}${p.isento ? " · sem IR" : ""}`);
    } else if (similar.length) {
      lines.push("Parecidas na tabela:");
      for (const p of similar) lines.push(`• ${p.banco}: ${p.taxa}${p.isento ? " · sem IR" : ""}`);
    }
  } else if (peers.length) {
    lines.push(`Outros do mesmo índice na tabela (conferida em ${BANK_RATES_CHECKED_LABEL}):`);
    for (const p of peers.slice(0, 4)) lines.push(`• ${p.banco}: ${p.taxa}${p.isento ? " · sem IR" : ""}`);
  }

  lines.push(`Fontes locais de ${BANK_RATES_CHECKED_LABEL}${stale ? `; há ${age} dias — confira no app do banco` : ""}. Análise educativa, não é recomendação.`);
  return lines.join("\n");
}

/** Resposta local para o botão inline: caixinha, glossário, conta ou conversa curta. */
export function answerInlineMuvo(question: string): string | null {
  const page = readBotPageContext();
  if (/taxa|banco|imposto|cdi|lci|lca|cdb|aplicacao|caixinha/i.test(question)) {
    const caixinha = answerNovaCaixinha(page);
    if (caixinha) return caixinha;
  }
  const topic = chatTopic(question);
  if (topic) return investorChatText(topic);
  const terms = findTerms(question);
  if (terms.length) return terms.map(termMarkdown).join("\n\n");
  const calc = financeReply(question, FALLBACK_CDI);
  if (calc) return answerMarkdown(calc);
  return null;
}
