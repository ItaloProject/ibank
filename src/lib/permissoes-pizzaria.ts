/** Uma linha da lista Acessos do painel-admin, já filtrada pelo e-mail de quem está logado */
export type LinhaAcesso = { papel: string; pizzaria_slug: string | null };

/**
 * Quais pizzarias o usuário pode editar, pela lista Acessos.
 * "admin" global vê todas; "dono" vê só a pizzaria liberada; sem linha, não vê nenhuma.
 */
export function pizzariasDoAcesso(linhas: LinhaAcesso[]): string[] | "todas" {
  if (linhas.some((l) => l.papel === "admin")) return "todas";
  return linhas.filter((l) => l.papel === "dono" && l.pizzaria_slug).map((l) => l.pizzaria_slug as string);
}
