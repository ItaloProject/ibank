/** Nome da mesa: 1 a 20 caracteres, sem espaços sobrando. Devolve o nome limpo ou null se não for válido. */
export function mesaValida(mesa: unknown): string | null {
  if (typeof mesa !== "string") return null;
  const limpa = mesa.trim();
  return limpa.length >= 1 && limpa.length <= 20 ? limpa : null;
}

/** Total da comanda: soma das rodadas que não foram canceladas */
export function totalComanda(rodadas: { total: number | string; status: string }[]): number {
  const soma = rodadas.filter((r) => r.status !== "cancelado").reduce((acc, r) => acc + Number(r.total), 0);
  return Math.round(soma * 100) / 100;
}
