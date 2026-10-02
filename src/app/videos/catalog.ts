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

// Vídeos públicos do YouTube, sempre pelo player oficial: nunca baixar nem hospedar cópias.
// Antes de incluir um vídeo, confira em youtube.com/oembed?url=... que ele aceita incorporação e copie o canal de lá.
// youtubeId = código depois de "v=" no link do vídeo.

const BC = { channel: "Banco Central do Brasil", channelUrl: "https://www.youtube.com/@BancoCentralBR" };
const ME_POUPE = { channel: "Me Poupe!", channelUrl: "https://www.youtube.com/@MePoupe" };
const PRIMO_POBRE = { channel: "Primo Pobre", channelUrl: "https://www.youtube.com/@PrimoPobre" };
const MANUAL_EVOLUCAO = { channel: "Manual da Evolução", channelUrl: "https://www.youtube.com/@manualdaevolucao" };
const PERINI = { channel: "Bruno Perini - Você MAIS Rico", channelUrl: "https://www.youtube.com/@brunoperini" };

export const TRACKS: Track[] = [
  {
    id: "comece",
    title: "Comece por aqui",
    subtitle: "O básico para dar o primeiro passo",
    icon: GraduationCap,
    videos: [
      {
        title: "Aula completa para quem não sabe por onde começar a investir",
        description: "Do zero: reserva, renda fixa, renda variável e a ordem certa para começar.",
        youtubeId: "Q6x0xnI0uCg",
        duration: "20:21",
        ...PRIMO_POBRE,
      },
      {
        title: "Guia básico para começar a investir com pouco dinheiro",
        description: "Em 10 minutos, o caminho para sair da poupança mesmo com valores pequenos.",
        youtubeId: "JtDrb2BPBf4",
        duration: "10:08",
        ...ME_POUPE,
      },
      {
        title: "Como funcionam os juros compostos",
        description: "Por que o tempo é o maior aliado de quem investe.",
        youtubeId: "SpyWH9U15Ek",
        duration: "7:32",
        channel: "Investidor Sardinha l Raul Sena",
        channelUrl: "https://www.youtube.com/@investidorsardinha",
      },
      {
        title: "Como montar uma carteira de investimentos para iniciantes",
        description: "Diversificação na prática: quanto colocar em cada tipo de investimento.",
        youtubeId: "eMDgWLWOX84",
        duration: "24:08",
        channel: "O Primo Rico",
        channelUrl: "https://www.youtube.com/@primorico",
      },
    ],
  },
  {
    id: "organize",
    title: "Organize seu dinheiro",
    subtitle: "Orçamento e reserva antes de investir",
    icon: Wallet,
    videos: [
      {
        title: "Educação financeira para iniciantes: o que é e como começar",
        description: "Pilares básicos: receitas, despesas, reserva e uso consciente do crédito.",
        youtubeId: "7NNsg7N6__Q",
        duration: "3:51",
        channel: "Alfa | Safra Financeira",
        channelUrl: "https://www.youtube.com/@AlfaConsignado",
      },
      {
        title: "Como organizar sua vida financeira em 30 dias",
        description: "Um método simples para mapear para onde o dinheiro vai.",
        youtubeId: "85NKII6eLmE",
        duration: "1:39",
        ...ME_POUPE,
      },
      {
        title: "Orçamento familiar de forma simples",
        description: "Como montar um orçamento e comparar o planejado com o realizado.",
        youtubeId: "_LetMq26HJU",
        duration: "10:10",
        channel: "Taí Souza",
        channelUrl: "https://www.youtube.com/@Taisouzaaaa",
      },
      {
        title: "Onde investir a reserva de emergência",
        description: "Tesouro Selic, CDB de liquidez diária ou fundo DI: qual rende mais.",
        youtubeId: "HgubixK-zbI",
        duration: "19:54",
        ...PERINI,
      },
    ],
  },
  {
    id: "juros",
    title: "Selic, CDI e inflação",
    subtitle: "As taxas que movem todos os investimentos",
    icon: Percent,
    videos: [
      {
        title: "O que é a taxa Selic",
        description: "A explicação oficial do Banco Central sobre a taxa básica de juros.",
        youtubeId: "00DbSCX96wU",
        duration: "4:22",
        ...BC,
      },
      {
        title: "O que é a taxa Selic e como ela funciona",
        description: "Como a Selic afeta o crédito, a inflação e o seu bolso.",
        youtubeId: "WBNkhIaY7gc",
        duration: "4:32",
        channel: "Nexo Jornal",
        channelUrl: "https://www.youtube.com/@NexojornalBr",
      },
      {
        title: "O que é a taxa CDI",
        description: "A taxa que serve de referência para CDB, LCI, LCA e fundos.",
        youtubeId: "P592XSCOmRQ",
        duration: "6:51",
        ...PRIMO_POBRE,
      },
      {
        title: "Selic e CDI: entenda e pare de perder dinheiro",
        description: "A diferença entre as duas taxas e o que significa render 100% do CDI.",
        youtubeId: "R0AQyTIvcvI",
        duration: "8:24",
        ...ME_POUPE,
      },
      {
        title: "O que é inflação",
        description: "O Banco Central explica por que os preços sobem e como isso é controlado.",
        youtubeId: "l7znThOnfOM",
        duration: "2:51",
        ...BC,
      },
      {
        title: "IPCA e INPC: como a inflação é medida",
        description: "O IBGE mostra como calcula o índice oficial de inflação do país.",
        youtubeId: "JVcDZOlIMBk",
        duration: "5:39",
        channel: "IBGE",
        channelUrl: "https://www.youtube.com/@ibgeoficial",
      },
    ],
  },
  {
    id: "renda-fixa",
    title: "Renda fixa",
    subtitle: "CDB, LCI, LCA, Tesouro Direto e FGC",
    icon: Landmark,
    videos: [
      {
        title: "Guia da renda fixa: CDB, CDI, Selic, LCI e LCA",
        description: "Entenda as siglas que aparecem nos investimentos de renda fixa.",
        youtubeId: "LLG2RrpMwkA",
        duration: "17:54",
        ...PERINI,
      },
      {
        title: "O que é CDB e quais são os riscos da renda fixa",
        description: "Como o CDB funciona, quanto rende e o que pode dar errado.",
        youtubeId: "zkcpFhsgOaY",
        duration: "15:50",
        ...MANUAL_EVOLUCAO,
      },
      {
        title: "O que são LCI e LCA",
        description: "Os títulos isentos de imposto de renda e quando valem mais que o CDB.",
        youtubeId: "pW6IHuR5Ugw",
        duration: "15:24",
        ...MANUAL_EVOLUCAO,
      },
      {
        title: "O que é o FGC e quais investimentos ele protege",
        description: "A garantia do Fundo Garantidor de Créditos, os limites e o que fica de fora.",
        youtubeId: "6bc5vM_XwfA",
        duration: "4:57",
        ...PRIMO_POBRE,
      },
      {
        title: "Tesouro Direto: guia completo para iniciantes",
        description: "Como funciona o Tesouro e por onde começar com segurança.",
        youtubeId: "bolG9pgxEAU",
        duration: "18:08",
        ...ME_POUPE,
      },
      {
        title: "Tesouro Selic e Tesouro IPCA+ para iniciantes",
        description: "Para que serve cada título e qual escolher para cada objetivo.",
        youtubeId: "Dugg9Eb_mhw",
        duration: "15:54",
        ...MANUAL_EVOLUCAO,
      },
      {
        title: "Tesouro Selic: passo a passo para investir",
        description: "Ideal para reserva de emergência, com liquidez e baixo risco.",
        youtubeId: "9q8fWrCR2ZI",
        duration: "10:07",
        channel: "Luciana Fiaux | dominesuasfinancas",
        channelUrl: "https://www.youtube.com/@lucianafiauxdomine",
      },
    ],
  },
  {
    id: "taxas",
    title: "Taxas e impostos",
    subtitle: "O que é descontado do seu rendimento",
    icon: Receipt,
    videos: [
      {
        title: "Impostos na renda fixa: IOF e imposto de renda",
        description: "A tabela regressiva, o IOF nos primeiros 30 dias e o que é isento.",
        youtubeId: "LZp0FjamLRo",
        duration: "14:17",
        ...PRIMO_POBRE,
      },
      {
        title: "Taxa de administração e taxa de performance",
        description: "Quanto os fundos cobram e como isso pesa no resultado ao longo dos anos.",
        youtubeId: "xBg1GwdYkl0",
        duration: "7:55",
        channel: "Tiago Reis",
        channelUrl: "https://www.youtube.com/@TiagoReisYT",
      },
      {
        title: "Taxa de custódia: o que é e por que é cobrada",
        description: "A taxa da guarda dos seus títulos, como no Tesouro Direto.",
        youtubeId: "Kn5terf8wa8",
        duration: "2:41",
        channel: "Mais Retorno",
        channelUrl: "https://www.youtube.com/@MaisRetorno",
      },
    ],
  },
  {
    id: "renda-variavel",
    title: "Ações, fundos imobiliários e ETFs",
    subtitle: "Os primeiros passos na renda variável",
    icon: TrendingUp,
    videos: [
      {
        title: "Como funciona a bolsa de valores",
        description: "O que é uma ação e por que o preço sobe e desce, de forma visual.",
        youtubeId: "zE3MhwFUpnA",
        duration: "4:44",
        channel: "Manual do Mundo",
        channelUrl: "https://www.youtube.com/@manualdomundo",
      },
      {
        title: "Como funciona o mercado de ações em 5 minutos",
        description: "Empresas, investidores e a bolsa explicados de forma simples.",
        youtubeId: "QYNrr3Di-D0",
        duration: "4:53",
        channel: "EconoFácil",
        channelUrl: "https://www.youtube.com/@_EconoFacil",
      },
      {
        title: "Guia do ETF: o que são e como escolher",
        description: "Fundos que seguem um índice e dicas para escolher na B3.",
        youtubeId: "z2_3yV3nqgY",
        duration: "10:40",
        channel: "Professor Mira",
        channelUrl: "https://www.youtube.com/@ProfessorMira",
      },
      {
        title: "Aula sobre fundos imobiliários (FIIs)",
        description: "Tijolo, papel e o essencial para começar.",
        youtubeId: "xQOWiQMzq3M",
        duration: "1:05:34",
        channel: "POP SHOW TV",
        channelUrl: "https://www.youtube.com/@pobreshow",
      },
      {
        title: "10 anos investindo em FIIs: o que aprendi",
        description: "Lições práticas sobre carteira, vacância e tese de longo prazo.",
        youtubeId: "xOWMQloIlGM",
        duration: "21:49",
        channel: "Finclass - Aprenda a investir do zero",
        channelUrl: "https://www.youtube.com/@Finclass",
      },
    ],
  },
];
