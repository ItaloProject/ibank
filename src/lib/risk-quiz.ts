import type { RiskProfile } from "@/lib/rebalance";

export type Objetivo = "aposentadoria" | "renda_mensal" | "objetivo" | "protecao";

export type QuizQuestionId = "objetivo" | "prazo" | "queda" | "experiencia" | "reserva";

export type QuizOption = { id: string; label: string; detalhe?: string; pontos: number };

export type QuizQuestion = { id: QuizQuestionId; titulo: string; ajuda: string; opcoes: QuizOption[] };

export const OBJETIVO_LABEL: Record<Objetivo, string> = {
  aposentadoria: "Aposentadoria",
  renda_mensal: "Renda mensal",
  objetivo: "Realizar um objetivo",
  protecao: "Proteger meu dinheiro",
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "objetivo",
    titulo: "O que você quer conquistar investindo?",
    ajuda: "Escolha o principal. Os outros continuam valendo.",
    opcoes: [
      { id: "aposentadoria", label: OBJETIVO_LABEL.aposentadoria, detalhe: "Construir patrimônio para o futuro", pontos: 2 },
      { id: "renda_mensal", label: OBJETIVO_LABEL.renda_mensal, detalhe: "Receber rendimentos todo mês", pontos: 1 },
      { id: "objetivo", label: OBJETIVO_LABEL.objetivo, detalhe: "Casa, carro, viagem, estudos", pontos: 1 },
      { id: "protecao", label: OBJETIVO_LABEL.protecao, detalhe: "Render mais que a poupança sem sustos", pontos: 0 },
    ],
  },
  {
    id: "prazo",
    titulo: "Quando você pretende usar a maior parte desse dinheiro?",
    ajuda: "Quanto mais tempo, mais dá para esperar os altos e baixos passarem.",
    opcoes: [
      { id: "ate1", label: "Em menos de 1 ano", pontos: 0 },
      { id: "1a3", label: "Entre 1 e 3 anos", pontos: 1 },
      { id: "3a10", label: "Entre 3 e 10 anos", pontos: 2 },
      { id: "mais10", label: "Daqui a mais de 10 anos", pontos: 3 },
    ],
  },
  {
    id: "queda",
    titulo: "Seus investimentos caíram 20% em um mês. O que você faz?",
    ajuda: "Não existe resposta certa. Vale o que você faria de verdade.",
    opcoes: [
      { id: "vende_tudo", label: "Vendo tudo para não perder mais", pontos: 0 },
      { id: "vende_parte", label: "Vendo uma parte e fico mais tranquilo", pontos: 1 },
      { id: "espera", label: "Espero, porque costuma recuperar", pontos: 2 },
      { id: "compra", label: "Aproveito para comprar mais barato", pontos: 3 },
    ],
  },
  {
    id: "experiencia",
    titulo: "Onde você já investiu?",
    ajuda: "Marque a opção mais arriscada que você já teve.",
    opcoes: [
      { id: "nunca", label: "Nunca investi", pontos: 0 },
      { id: "basico", label: "Poupança, CDB ou caixinhas de banco", pontos: 1 },
      { id: "intermediario", label: "Tesouro Direto, fundos ou fundos imobiliários", pontos: 2 },
      { id: "avancado", label: "Ações, há mais de um ano", pontos: 3 },
    ],
  },
  {
    id: "reserva",
    titulo: "Se sua renda parasse hoje, por quanto tempo você se manteria?",
    ajuda: "É a sua reserva de emergência: dinheiro que dá para sacar a qualquer dia.",
    opcoes: [
      { id: "nenhuma", label: "Não tenho reserva", pontos: 0 },
      { id: "ate3", label: "Menos de 3 meses", pontos: 1 },
      { id: "3a6", label: "Entre 3 e 6 meses", pontos: 2 },
      { id: "mais6", label: "Mais de 6 meses", pontos: 3 },
    ],
  },
];

export type QuizAnswers = Partial<Record<QuizQuestionId, string>>;

export type QuizResult = {
  profile: RiskProfile;
  objetivo: Objetivo;
  pontos: number;
  /** Frases curtas que explicam o resultado, na ordem de importância. */
  motivos: string[];
};

const MAX_PONTOS = QUIZ_QUESTIONS.reduce((s, q) => s + Math.max(...q.opcoes.map((o) => o.pontos)), 0);

export function isQuizComplete(a: QuizAnswers): boolean {
  return QUIZ_QUESTIONS.every((q) => q.opcoes.some((o) => o.id === a[q.id]));
}

/** Pontuação somada com duas travas: dinheiro para já é conservador; quem venderia tudo na queda não vai além de moderado. */
export function scoreQuiz(a: QuizAnswers): QuizResult | null {
  if (!isQuizComplete(a)) return null;
  const pontos = QUIZ_QUESTIONS.reduce((s, q) => s + q.opcoes.find((o) => o.id === a[q.id])!.pontos, 0);
  let profile: RiskProfile = pontos <= 5 ? "conservador" : pontos <= 10 ? "moderado" : "arrojado";
  const motivos: string[] = [];

  if (a.prazo === "ate1") {
    profile = "conservador";
    motivos.push("Você vai usar o dinheiro em menos de 1 ano: ele precisa estar seguro e disponível.");
  }
  if (a.queda === "vende_tudo" && profile === "arrojado") profile = "moderado";

  if (a.queda === "vende_tudo" || a.queda === "vende_parte") motivos.push("Quedas fortes te incomodam, então a carteira tem menos oscilação.");
  else motivos.push("Você aguenta quedas passageiras, o que abre espaço para ações e fundos imobiliários.");
  if (a.prazo === "mais10" || a.prazo === "3a10") motivos.push("Seu prazo é longo: o tempo ajuda a recuperar as oscilações.");
  if (a.reserva === "nenhuma" || a.reserva === "ate3") motivos.push("Antes de arriscar, o primeiro passo é completar a reserva de emergência.");
  if (a.experiencia === "nunca") motivos.push("Como você está começando, a carteira prioriza aplicações simples.");

  return { profile, objetivo: a.objetivo as Objetivo, pontos, motivos: motivos.slice(0, 3) };
}

export const QUIZ_MAX_PONTOS = MAX_PONTOS;
