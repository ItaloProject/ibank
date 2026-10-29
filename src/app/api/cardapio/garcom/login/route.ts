import bcrypt from "bcryptjs";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes } from "@/lib/cardapio-acesso";
import { assinarSessaoGarcom } from "@/lib/garcom-sessao";
import { loginGarcomValido } from "@/lib/garcom-regras";

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Login do garçom: código da pizzaria, login e senha criados pelo dono. Não usa a conta do Muvo. */
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as { slug?: string; login?: unknown; senha?: unknown } | null;
  const slug = (corpo?.slug ?? "").trim().toLowerCase();
  if (!slugValido(slug)) return json({ error: "Código da pizzaria inválido" }, 400);
  const login = loginGarcomValido(corpo?.login);
  if (!login || typeof corpo?.senha !== "string") return json({ error: "Preencha código, login e senha" }, 400);

  const [garcom] = await cardapioSql`
    SELECT id, nome, password_hash, ativo FROM public.garcons WHERE pizzaria_slug = ${slug} AND login = ${login}`;
  if (!garcom || !(await bcrypt.compare(corpo.senha, garcom.password_hash as string))) {
    return json({ error: "Código, login ou senha incorretos" }, 401);
  }
  if (!garcom.ativo) return json({ error: "Acesso desativado. Fale com o dono da pizzaria." }, 403);

  const token = await assinarSessaoGarcom({ garcomId: garcom.id as string, slug, nome: garcom.nome as string });
  return json({ token, nome: garcom.nome, slug, papel: "garcom" });
}
