export type GoalProjection = {
  /** Capital que gera a renda mensal desejada no rendimento real esperado. */
  capitalNecessario: number;
  rendimentoRealAnualPct: number;
  /** Meses até a meta no ritmo atual; null se passar de 100 anos. */
  meses: number | null;
  anoPrevisto: number | null;
  prazoAno: number | null;
  /** Aporte mensal que chega à meta no prazo desejado; null sem prazo ou prazo vencido. */
  aporteParaPrazo: number | null;
  noPrazo: boolean | null;
};

const MAX_MESES = 1200;

function futureValue(capital: number, aporte: number, r: number, n: number): number {
  const g = Math.pow(1 + r, n);
  return r === 0 ? capital + aporte * n : capital * g + aporte * ((g - 1) / r);
}

/**
 * Em valores de hoje: o rendimento é descontado da inflação, então a renda da meta mantém o poder de compra.
 * `retornoAnualPct` é o retorno líquido esperado da carteira; `ipcaAnualPct`, a inflação esperada.
 */
export function projectGoal(input: {
  metaRendaMensal: number;
  patrimonio: number;
  aporteMensal: number;
  retornoAnualPct: number;
  ipcaAnualPct: number;
  prazoAno?: number | null;
  today?: Date;
}): GoalProjection | null {
  const { metaRendaMensal, patrimonio, aporteMensal } = input;
  if (!(metaRendaMensal > 0)) return null;
  const realAnual = Math.max(0.005, (1 + input.retornoAnualPct / 100) / (1 + input.ipcaAnualPct / 100) - 1);
  const r = Math.pow(1 + realAnual, 1 / 12) - 1;
  const capitalNecessario = metaRendaMensal / r;
  const today = input.today ?? new Date();

  let meses: number | null = null;
  if (patrimonio >= capitalNecessario) meses = 0;
  else if (aporteMensal > 0 || patrimonio > 0) {
    for (let n = 1; n <= MAX_MESES; n++) {
      if (futureValue(patrimonio, aporteMensal, r, n) >= capitalNecessario) {
        meses = n;
        break;
      }
    }
  }
  const anoPrevisto = meses === null ? null : new Date(today.getFullYear(), today.getMonth() + meses, 1).getFullYear();

  const prazoAno = input.prazoAno && input.prazoAno > 0 ? input.prazoAno : null;
  let aporteParaPrazo: number | null = null;
  if (prazoAno) {
    const n = (prazoAno - today.getFullYear()) * 12 + (11 - today.getMonth());
    if (n > 0) {
      const g = Math.pow(1 + r, n);
      aporteParaPrazo = Math.max(0, Math.ceil(((capitalNecessario - patrimonio * g) * r) / (g - 1)));
    }
  }

  return {
    capitalNecessario: Math.round(capitalNecessario),
    rendimentoRealAnualPct: Math.round(realAnual * 10000) / 100,
    meses,
    anoPrevisto,
    prazoAno,
    aporteParaPrazo,
    noPrazo: prazoAno && anoPrevisto !== null ? anoPrevisto <= prazoAno : prazoAno ? false : null,
  };
}
