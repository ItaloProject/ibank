/** E-mail do usuário: vazio vira null; inválido vira false */
export function normalizarEmail(valor: unknown): string | null | false {
  if (valor === undefined || valor === null || valor === "") return null;
  const limpo = String(valor).trim().toLowerCase();
  if (!limpo) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo) ? limpo : false;
}
