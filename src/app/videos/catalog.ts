import { GraduationCap, Wallet, Percent, Landmark, Receipt, TrendingUp, type LucideIcon } from "lucide-react";

export type Video = {
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  channel: string;
  channelUrl: string;
};

export type Track = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  videos: Video[];
};

/** Até 10 minutos é resumo; acima disso vai para Aulas completas. */
export const QUICK_MAX_SECONDS = 600;

export function seconds(duration: string): number {
  return duration.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

export const isQuick = (v: Video) => seconds(v.duration) <= QUICK_MAX_SECONDS;

// Vídeos públicos do YouTube, sempre pelo player oficial: nunca baixar nem hospedar cópias.
// Antes de incluir um vídeo, confira em youtube.com/oembed?url=... que ele aceita incorporação e copie o canal de lá.
// Prefira resumos de 5 a 10 minutos; a duração precisa ser a real, porque decide a aba do vídeo.

const ANBIMA = { channel: "Anbima", channelUrl: "https://www.youtube.com/@AnbimaBR" };
const B3 = { channel: "B3", channelUrl: "https://www.youtube.com/@bolsadobrasil" };
const BC = { channel: "Banco Central do Brasil", channelUrl: "https://www.youtube.com/@BancoCentralBR" };
const ME_POUPE = { channel: "Me Poupe!", channelUrl: "https://www.youtube.com/@MePoupe" };
const PRIMO_POBRE = { channel: "Primo Pobre", channelUrl: "https://www.youtube.com/@PrimoPobre" };
const PRIMO_RICO = { channel: "O Primo Rico", channelUrl: "https://www.youtube.com/@primorico" };
const MANUAL_EVOLUCAO = { channel: "Manual da Evolução", channelUrl: "https://www.youtube.com/@manualdaevolucao" };
const PERINI = { channel: "Bruno Perini - Você MAIS Rico", channelUrl: "https://www.youtube.com/@brunoperini" };
const FIAUX = { channel: "Luciana Fiaux | dominesuasfinancas", channelUrl: "https://www.youtube.com/@lucianafiauxdomine" };

export const TRACKS: Track[] = [
  {
    id: "comece",
    title: "Comece por aqui",
    subtitle: "O básico para dar o primeiro passo",
    icon: GraduationCap,
    videos: [
      { title: "O que saber antes de começar a investir", description: "Os conceitos que evitam os erros mais comuns de quem está começando.", youtubeId: "NMTmXh4855c", duration: "8:10", ...PRIMO_RICO },
      { title: "Renda fixa e renda variável: qual a diferença?", description: "Os dois grandes grupos de investimento em pouco mais de 2 minutos.", youtubeId: "_2ofTSJX13Y", duration: "2:16", ...B3 },
      { title: "Como funcionam os juros compostos", description: "Por que o tempo é o maior aliado de quem investe.", youtubeId: "SpyWH9U15Ek", duration: "7:32", channel: "Investidor Sardinha l Raul Sena", channelUrl: "https://www.youtube.com/@investidorsardinha" },
      { title: "Descubra o seu perfil de investidor", description: "Conservador, moderado ou arrojado: o que muda na hora de escolher.", youtubeId: "8V71ilZWkVI", duration: "5:29", channel: "Suno", channelUrl: "https://www.youtube.com/@GrupoSuno" },
      { title: "Diversificação de investimentos", description: "Por que não colocar todos os ovos na mesma cesta.", youtubeId: "MvQCrfqMC5c", duration: "6:46", channel: "André Bona", channelUrl: "https://www.youtube.com/@andrebona" },
      { title: "Como reconhecer fraudes em investimentos", description: "Os sinais de pirâmide e de promessas de ganho fácil.", youtubeId: "HQ6OnZZOvhE", duration: "7:22", ...ANBIMA },
      { title: "Aula completa para quem não sabe por onde começar a investir", description: "Do zero: reserva, renda fixa, renda variável e a ordem certa para começar.", youtubeId: "Q6x0xnI0uCg", duration: "20:21", ...PRIMO_POBRE },
      { title: "Guia básico para começar a investir com pouco dinheiro", description: "O caminho para sair da poupança mesmo com valores pequenos.", youtubeId: "JtDrb2BPBf4", duration: "10:08", ...ME_POUPE },
      { title: "Como montar uma carteira de investimentos para iniciantes", description: "Diversificação na prática: quanto colocar em cada tipo de investimento.", youtubeId: "eMDgWLWOX84", duration: "24:08", ...PRIMO_RICO },
    ],
  },
  {
    id: "organize",
    title: "Organize seu dinheiro",
    subtitle: "Orçamento e reserva antes de investir",
    icon: Wallet,
    videos: [
      { title: "Educação financeira para iniciantes: o que é e como começar", description: "Pilares básicos: receitas, despesas, reserva e uso consciente do crédito.", youtubeId: "7NNsg7N6__Q", duration: "3:51", channel: "Alfa | Safra Financeira", channelUrl: "https://www.youtube.com/@AlfaConsignado" },
      { title: "Tudo sobre reserva de emergência", description: "Para que serve, quanto guardar e quando usar.", youtubeId: "shfYMvEXqm4", duration: "6:55", ...ME_POUPE },
      { title: "Quanto ter na reserva de emergência", description: "Uma conta simples para saber o tamanho certo da sua reserva.", youtubeId: "RBpvCwvshnc", duration: "6:38", ...PRIMO_POBRE },
      { title: "Melhor lugar para a reserva de emergência", description: "Segurança e resgate rápido: onde deixar o dinheiro guardado.", youtubeId: "m9tKdU1Vh-g", duration: "8:47", ...PRIMO_POBRE },
      { title: "Orçamento familiar de forma simples", description: "Como montar um orçamento e comparar o planejado com o realizado.", youtubeId: "_LetMq26HJU", duration: "10:10", channel: "Taí Souza", channelUrl: "https://www.youtube.com/@Taisouzaaaa" },
      { title: "Onde investir a reserva de emergência", description: "Tesouro Selic, CDB de liquidez diária ou fundo DI: qual rende mais.", youtubeId: "HgubixK-zbI", duration: "19:54", ...PERINI },
    ],
  },
  {
    id: "juros",
    title: "Selic, CDI e inflação",
    subtitle: "As taxas que movem todos os investimentos",
    icon: Percent,
    videos: [
      { title: "O que é a taxa Selic", description: "A explicação oficial do Banco Central sobre a taxa básica de juros.", youtubeId: "00DbSCX96wU", duration: "4:22", ...BC },
      { title: "O que é a taxa CDI", description: "A taxa que serve de referência para CDB, LCI, LCA e fundos.", youtubeId: "6hDHvr-8Ofo", duration: "5:11", ...ANBIMA },
      { title: "Selic e CDI: entenda e pare de perder dinheiro", description: "A diferença entre as duas taxas e o que significa render 100% do CDI.", youtubeId: "R0AQyTIvcvI", duration: "8:24", ...ME_POUPE },
      { title: "O que é inflação", description: "Por que os preços sobem e como isso corrói o seu dinheiro parado.", youtubeId: "GaE_ZiQ3N50", duration: "8:02", ...ANBIMA },
      { title: "IPCA e INPC: como a inflação é medida", description: "O IBGE mostra como calcula o índice oficial de inflação do país.", youtubeId: "JVcDZOlIMBk", duration: "5:39", channel: "IBGE", channelUrl: "https://www.youtube.com/@ibgeoficial" },
    ],
  },
  {
    id: "renda-fixa",
    title: "Renda fixa",
    subtitle: "CDB, LCI, LCA, Tesouro Direto e FGC",
    icon: Landmark,
    videos: [
      { title: "O que é renda fixa", description: "Como funciona emprestar dinheiro em troca de juros.", youtubeId: "NER6scqNqAc", duration: "5:52", ...ANBIMA },
      { title: "CDB explicado de forma simples", description: "O que é, quanto rende e por que tem a garantia do FGC.", youtubeId: "qskeCTIsias", duration: "3:08", channel: "O Primo Primata", channelUrl: "https://www.youtube.com/@OPrimoPrimata" },
      { title: "Diferença entre CDB e CDI", description: "Um é investimento, o outro é taxa: entenda de uma vez.", youtubeId: "pQg47rASBD4", duration: "6:10", ...FIAUX },
      { title: "Tudo sobre renda fixa: LCI, LCA, CDB e LC", description: "As letras de crédito isentas de imposto e como se comparam ao CDB.", youtubeId: "ysm9ZJ6O67w", duration: "9:34", ...ME_POUPE },
      { title: "O que é o FGC e quais investimentos ele protege", description: "A garantia do Fundo Garantidor de Créditos, os limites e o que fica de fora.", youtubeId: "6bc5vM_XwfA", duration: "4:57", ...PRIMO_POBRE },
      { title: "O que é o Tesouro Direto", description: "Como emprestar dinheiro ao governo e os tipos de título.", youtubeId: "K4sq_lKV8H8", duration: "4:52", ...ANBIMA },
      { title: "Tesouro IPCA+: o que é e como funciona", description: "O título que protege o dinheiro da inflação no longo prazo.", youtubeId: "keLTQioi0WE", duration: "8:48", channel: "Excelência no Bolso", channelUrl: "https://www.youtube.com/@excel%C3%AAncianobolso" },
      { title: "Renda fixa é fixa mesmo?", description: "Marcação a mercado: por que o valor do título oscila antes do vencimento.", youtubeId: "XZlntkdovfc", duration: "4:37", ...ANBIMA },
      { title: "Guia da renda fixa: CDB, CDI, Selic, LCI e LCA", description: "Entenda as siglas que aparecem nos investimentos de renda fixa.", youtubeId: "LLG2RrpMwkA", duration: "17:54", ...PERINI },
      { title: "O que é CDB e quais são os riscos da renda fixa", description: "Como o CDB funciona, quanto rende e o que pode dar errado.", youtubeId: "zkcpFhsgOaY", duration: "15:50", ...MANUAL_EVOLUCAO },
      { title: "O que são LCI e LCA", description: "Os títulos isentos de imposto de renda e quando valem mais que o CDB.", youtubeId: "pW6IHuR5Ugw", duration: "15:24", ...MANUAL_EVOLUCAO },
      { title: "Tesouro Direto: guia completo para iniciantes", description: "Como funciona o Tesouro e por onde começar com segurança.", youtubeId: "bolG9pgxEAU", duration: "18:08", ...ME_POUPE },
      { title: "Tesouro Selic e Tesouro IPCA+ para iniciantes", description: "Para que serve cada título e qual escolher para cada objetivo.", youtubeId: "Dugg9Eb_mhw", duration: "15:54", ...MANUAL_EVOLUCAO },
      { title: "Tesouro Selic: passo a passo para investir", description: "Ideal para reserva de emergência, com liquidez e baixo risco.", youtubeId: "9q8fWrCR2ZI", duration: "10:07", ...FIAUX },
    ],
  },
  {
    id: "taxas",
    title: "Taxas e impostos",
    subtitle: "O que é descontado do seu rendimento",
    icon: Receipt,
    videos: [
      { title: "Imposto de renda e IOF nos investimentos", description: "A tabela regressiva, o IOF nos primeiros 30 dias e o que é isento.", youtubeId: "U2xOmP9w9t8", duration: "6:03", channel: "Douglas Gambim", channelUrl: "https://www.youtube.com/@DouglasGambim" },
      { title: "Taxas e impostos nos fundos de investimento", description: "Taxa de administração, come-cotas e o que sobra para você.", youtubeId: "kjv8XRLDx3U", duration: "7:35", channel: "XP", channelUrl: "https://www.youtube.com/@XP_Oficial" },
      { title: "Taxa de administração e taxa de performance", description: "Quanto os fundos cobram e como isso pesa no resultado ao longo dos anos.", youtubeId: "xBg1GwdYkl0", duration: "7:55", channel: "Tiago Reis", channelUrl: "https://www.youtube.com/@TiagoReisYT" },
      { title: "Taxa de custódia: o que é e por que é cobrada", description: "A taxa da guarda dos seus títulos, como no Tesouro Direto.", youtubeId: "Kn5terf8wa8", duration: "2:41", channel: "Mais Retorno", channelUrl: "https://www.youtube.com/@MaisRetorno" },
      { title: "Impostos na renda fixa: IOF e imposto de renda", description: "Aula completa sobre como cada imposto é calculado e cobrado.", youtubeId: "LZp0FjamLRo", duration: "14:17", ...PRIMO_POBRE },
    ],
  },
  {
    id: "renda-variavel",
    title: "Ações, fundos e ETFs",
    subtitle: "Os primeiros passos na renda variável",
    icon: TrendingUp,
    videos: [
      { title: "O que é renda variável", description: "Por que o retorno não é garantido e como lidar com o risco.", youtubeId: "O9_7uPt3NMI", duration: "4:38", ...ANBIMA },
      { title: "Como funciona a bolsa de valores", description: "O que é uma ação e por que o preço sobe e desce, de forma visual.", youtubeId: "zE3MhwFUpnA", duration: "4:44", channel: "Manual do Mundo", channelUrl: "https://www.youtube.com/@manualdomundo" },
      { title: "Como funciona o mercado de ações em 5 minutos", description: "Empresas, investidores e a bolsa explicados de forma simples.", youtubeId: "QYNrr3Di-D0", duration: "4:53", channel: "EconoFácil", channelUrl: "https://www.youtube.com/@_EconoFacil" },
      { title: "O que é o Ibovespa", description: "O principal índice da bolsa brasileira e o que ele mostra.", youtubeId: "FDwictNaJFs", duration: "2:29", ...B3 },
      { title: "O que são ETFs", description: "Fundos que seguem um índice e permitem diversificar com pouco dinheiro.", youtubeId: "8E7reA8gJcQ", duration: "2:49", ...B3 },
      { title: "O que são fundos imobiliários", description: "Como ganhar com imóveis sem comprar um imóvel inteiro.", youtubeId: "fc8T4qx34W4", duration: "7:45", ...ME_POUPE },
      { title: "Fundos de investimento", description: "Como funcionam, quem cuida do dinheiro e os principais tipos.", youtubeId: "CDkSJv-s1aY", duration: "8:43", ...ANBIMA },
      { title: "Guia do ETF: o que são e como escolher", description: "Fundos que seguem um índice e dicas para escolher na B3.", youtubeId: "z2_3yV3nqgY", duration: "10:40", channel: "Professor Mira", channelUrl: "https://www.youtube.com/@ProfessorMira" },
      { title: "10 anos investindo em FIIs: o que aprendi", description: "Lições práticas sobre carteira, vacância e tese de longo prazo.", youtubeId: "xOWMQloIlGM", duration: "21:49", channel: "Finclass - Aprenda a investir do zero", channelUrl: "https://www.youtube.com/@Finclass" },
      { title: "Aula sobre fundos imobiliários (FIIs)", description: "Tijolo, papel e o essencial para começar.", youtubeId: "xQOWiQMzq3M", duration: "1:05:34", channel: "POP SHOW TV", channelUrl: "https://www.youtube.com/@pobreshow" },
    ],
  },
];
