import { estaAberto, type Excecao, type Horario } from "@/lib/horario-loja";

/** Antecedência mínima para agendar, em minutos a partir de agora */
export const ANTECEDENCIA_MIN = 30;
/** Intervalo entre os horários que o cliente pode escolher */
export const PASSO_MIN = 30;
/** Quantos dias à frente o cliente pode agendar */
export const DIAS_MAX = 7;

/** Mensagem de erro para o cliente, ou null se o horário pode ser agendado */
export function validarAgendamento(agora: Date, alvo: Date, horarios: Horario[] | undefined, excecoes: Excecao[] | undefined): string | null {
  if (Number.isNaN(alvo.getTime())) return "Horário de agendamento inválido";
  if (alvo.getTime() < agora.getTime() + ANTECEDENCIA_MIN * 60_000) {
    return `Escolha um horário com pelo menos ${ANTECEDENCIA_MIN} minutos de antecedência`;
  }
  if (alvo.getTime() > agora.getTime() + DIAS_MAX * 86_400_000) return `Agendamento só até ${DIAS_MAX} dias à frente`;
  if (alvo.getUTCMinutes() % PASSO_MIN !== 0 || alvo.getUTCSeconds() !== 0) return `Escolha um horário de ${PASSO_MIN} em ${PASSO_MIN} minutos`;
  if (!estaAberto(horarios, excecoes, alvo)) return "A pizzaria estará fechada nesse horário";
  return null;
}
