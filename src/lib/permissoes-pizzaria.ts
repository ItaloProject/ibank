/** Uma linha da lista Acessos, já filtrada pelo e-mail de quem está logado */
export type LinhaAcesso = { papel: string; pizzaria_slug: string | null };

export type PapelNaPizzaria = "admin" | "dono" | "garcom";

/**
 * Quais pizzarias o usuário pode operar, pela lista Acessos.
 * "admin" global vê todas; "dono" e "garcom" veem só a pizzaria liberada; sem linha, nenhuma.
 */
export function pizzariasDoAcesso(linhas: LinhaAcesso[]): string[] | "todas" {
  if (linhas.some((l) => l.papel === "admin")) return "todas";
  return linhas.filter((l) => (l.papel === "dono" || l.papel === "garcom") && l.pizzaria_slug).map((l) => l.pizzaria_slug as string);
}

/** Papel de quem está logado nesta pizzaria. Admin global vale em todas. */
export function papelNaPizzaria(linhas: LinhaAcesso[], slug: string): PapelNaPizzaria | null {
  if (linhas.some((l) => l.papel === "admin")) return "admin";
  const linha = linhas.find((l) => l.pizzaria_slug === slug && (l.papel === "dono" || l.papel === "garcom"));
  return linha ? (linha.papel as PapelNaPizzaria) : null;
}
