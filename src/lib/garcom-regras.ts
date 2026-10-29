/** Login do garçom: 3 a 30 caracteres, minúsculas, números, ponto, traço e underline. Devolve o login limpo ou null. */
export function loginGarcomValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  return /^[a-z0-9._-]{3,30}$/.test(limpo) ? limpo : null;
}

/** Senha do garçom: 6 a 72 caracteres (72 é o limite do bcrypt) */
export function senhaGarcomValida(valor: unknown): boolean {
  return typeof valor === "string" && valor.length >= 6 && valor.length <= 72;
}

/** Nome do garçom: 1 a 60 caracteres, sem espaços sobrando */
export function nomeGarcomValido(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length >= 1 && limpo.length <= 60 ? limpo : null;
}
