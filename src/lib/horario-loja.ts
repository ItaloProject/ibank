/**
 * Loja aberta ou fechada agora, pelo horário salvo da pizzaria. Mesma regra do cardápio (src/lib/hours.ts):
 * fuso de Brasília, horário que passa da meia-noite, datas especiais, e sem horário cadastrado = sempre aberto.
 */

export type Horario = { dias: number[]; abre: string; fecha: string };
export type Excecao = { data: string; fechado?: boolean; abre?: string; fecha?: string; motivo?: string };

const FUSO = "America/Sao_Paulo";
const SEMANA = 7 * 1440;
const DIA_INGLES: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Dia da semana e horário no fuso da pizzaria */
export function horarioNoFuso(agora: Date): { dia: number; hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return { dia: DIA_INGLES[valor("weekday")] ?? 0, hora: Number(valor("hour")) % 24, minuto: Number(valor("minute")) };
}

/** Data de hoje no fuso da pizzaria, AAAA-MM-DD */
export function dataNoFuso(agora: Date): string {
  return agora.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/** Horários com a data especial de hoje aplicada: fechado tira o dia; horário próprio substitui o dia */
export function horariosEfetivos(horarios: Horario[], excecoes: Excecao[], agora: Date): Horario[] {
  const excecao = excecoes.find((e) => e.data === dataNoFuso(agora));
  if (!excecao) return horarios;
  const { dia } = horarioNoFuso(agora);
  const semHoje = horarios.map((h) => ({ ...h, dias: h.dias.filter((d) => d !== dia) })).filter((h) => h.dias.length > 0);
  if (excecao.fechado) return semHoje;
  if (!excecao.abre || !excecao.fecha) return horarios;
  return [...semHoje, { abre: excecao.abre, fecha: excecao.fecha, dias: [dia] }];
}

/** A loja está aberta agora? Sem horário cadastrado, está sempre aberta. */
export function estaAberto(horarios: Horario[] | undefined, excecoes: Excecao[] | undefined, agora: Date): boolean {
  const excecao = (excecoes ?? []).find((e) => e.data === dataNoFuso(agora));
  if (excecao?.fechado) return false;
  if (!horarios || horarios.length === 0) return true;

  const { dia, hora, minuto } = horarioNoFuso(agora);
  const t = dia * 1440 + hora * 60 + minuto;
  for (const h of horariosEfetivos(horarios, excecoes ?? [], agora)) {
    const abre = minutos(h.abre);
    let fecha = minutos(h.fecha);
    if (fecha <= abre) fecha += 1440; // passa da meia-noite
    for (const d of h.dias) {
      const inicio = d * 1440 + abre;
      const fim = d * 1440 + fecha;
      // Cobre a janela da semana seguinte, para o domingo à noite que passa de meia-noite
      for (const offset of [0, SEMANA]) {
        if (t + offset >= inicio && t + offset < fim) return true;
      }
    }
  }
  return false;
}
