/*
 * Teste grátis: quem entra com o Google ganha 3 dias (72 horas) de uso completo.
 * O fim do teste é um instante (trial_ends_at), não uma data: "3 dias" são 72 horas contadas do cadastro.
 */

export const TESTE_HORAS = 72;
export const PLANO_TESTE = "teste";

const HORA_MS = 60 * 60 * 1000;

/** Quando o teste de quem se cadastra agora termina. */
export function fimDoTeste(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + TESTE_HORAS * HORA_MS);
}

/** O teste ainda vale? Sem data de fim, não há teste. */
export function testeAtivo(fim: string | Date | null | undefined, agora: Date = new Date()): boolean {
  if (!fim) return false;
  const t = new Date(fim).getTime();
  return Number.isFinite(t) && t > agora.getTime();
}

/** Dias que faltam, arredondando para cima (23 horas contam como 1 dia). Zero quando acabou. */
export function diasDeTesteRestantes(fim: string | Date | null | undefined, agora: Date = new Date()): number {
  if (!testeAtivo(fim, agora)) return 0;
  const faltam = new Date(fim as string | Date).getTime() - agora.getTime();
  return Math.ceil(faltam / (24 * HORA_MS));
}

/**
 * Quem fez o teste e não assinou tem os dados apagados 10 dias depois do fim do teste
 * ("uma semana e meia"). Quem assinou algum dia nunca entra nessa limpeza.
 */
export const RETENCAO_DIAS = 10;

/** Quando os dados de uma conta de teste que não assinou são apagados. */
export function dataDeExclusao(fimDoTesteEm: string | Date | null | undefined): Date | null {
  if (!fimDoTesteEm) return null;
  const t = new Date(fimDoTesteEm).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + RETENCAO_DIAS * 24 * HORA_MS);
}

/** Já passou o prazo de guarda? */
export function prazoDeGuardaVencido(fimDoTesteEm: string | Date | null | undefined, agora: Date = new Date()): boolean {
  const limite = dataDeExclusao(fimDoTesteEm);
  return limite !== null && limite.getTime() <= agora.getTime();
}
