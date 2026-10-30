import { NextResponse } from "next/server";
import cardapioSql, { slugValido } from "@/lib/cardapio-db";
import { json, opcoes, podeEditarPizzaria, usuarioCardapio, bloqueadoNoNormal } from "@/lib/cardapio-acesso";

const VEICULOS = ["moto", "bike", "carro"];
const ID = /^[0-9a-f-]{36}$/i;

export async function OPTIONS(request: Request) {
  return opcoes(request);
}

/** Lista os entregadores da pizzaria, inclusive os desativados */
export async function GET(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const entregadores = await cardapioSql`
    SELECT id, nome, telefone, veiculo, ativo FROM public.entregadores
    WHERE pizzaria_slug = ${slug} ORDER BY ativo DESC, nome`;
  return json({ entregadores });
}

/** Lê os campos de um entregador. Devolve uma mensagem de erro se algum estiver inválido. */
function lerCampos(corpo: { nome?: unknown; telefone?: unknown; veiculo?: unknown }) {
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  if (!nome || nome.length > 60) return "Informe o nome do entregador (até 60 caracteres)";
  const telefone = typeof corpo.telefone === "string" ? corpo.telefone.replace(/\D/g, "") : "";
  if (telefone && (telefone.length < 10 || telefone.length > 13)) return "Telefone inválido";
  const veiculo = typeof corpo.veiculo === "string" && corpo.veiculo !== "" ? corpo.veiculo : null;
  if (veiculo && !VEICULOS.includes(veiculo)) return "Veículo inválido";
  return { nome, telefone: telefone || null, veiculo };
}

/** Cadastra um entregador na pizzaria */
export async function POST(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; nome?: unknown; telefone?: unknown; veiculo?: unknown } | null;
  const slug = corpo?.slug ?? "";
  if (!slugValido(slug)) return json({ error: "Código inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const campos = lerCampos(corpo ?? {});
  if (typeof campos === "string") return json({ error: campos }, 400);

  const [novo] = await cardapioSql`
    INSERT INTO public.entregadores (pizzaria_slug, nome, telefone, veiculo)
    VALUES (${slug}, ${campos.nome}, ${campos.telefone}, ${campos.veiculo})
    RETURNING id, nome, telefone, veiculo, ativo`;
  return json({ entregador: novo });
}

/** Edita um entregador ou ativa/desativa. Entregador desativado não aparece para novos pedidos. */
export async function PATCH(request: Request) {
  const usuario = await usuarioCardapio(request);
  if (usuario instanceof NextResponse) return usuario;
  const corpo = (await request.json().catch(() => null)) as { slug?: string; id?: string; ativo?: unknown; nome?: unknown; telefone?: unknown; veiculo?: unknown } | null;
  const slug = corpo?.slug ?? "";
  const id = corpo?.id ?? "";
  if (!slugValido(slug) || !ID.test(id)) return json({ error: "Pedido inválido" }, 400);
  if (!(await podeEditarPizzaria(usuario, slug))) return json({ error: "Sem permissão" }, 403);
  const semPremium = await bloqueadoNoNormal(slug);
  if (semPremium) return semPremium;

  const [atual] = await cardapioSql`
    SELECT nome, telefone, veiculo, ativo FROM public.entregadores WHERE id = ${id} AND pizzaria_slug = ${slug}`;
  if (!atual) return json({ error: "Entregador não encontrado" }, 404);

  const campos = lerCampos({
    nome: corpo?.nome ?? atual.nome,
    telefone: corpo?.telefone ?? atual.telefone ?? "",
    veiculo: corpo?.veiculo ?? atual.veiculo ?? "",
  });
  if (typeof campos === "string") return json({ error: campos }, 400);
  const ativo = typeof corpo?.ativo === "boolean" ? corpo.ativo : atual.ativo;

  await cardapioSql`
    UPDATE public.entregadores SET nome = ${campos.nome}, telefone = ${campos.telefone}, veiculo = ${campos.veiculo}, ativo = ${ativo}
    WHERE id = ${id} AND pizzaria_slug = ${slug}`;
  return json({ ok: true });
}
