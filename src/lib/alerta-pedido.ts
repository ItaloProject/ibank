/** Texto do alerta de pedido novo enviado ao Telegram (formato HTML). */

export type PedidoAlerta = {
  numero: number;
  modo: "entrega" | "retirada" | "mesa";
  cliente: { nome?: string; telefone?: string; endereco?: string; referencia?: string; mesa?: string };
  itens: { nome: string; variante: string | null; qtd: number; obs: string | null }[];
  total: number | string;
  pagamento: string;
  troco: string;
  centavos_pix: number | null;
  criado_em: string;
};

const escapar = (texto: string) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function montarAlertaTelegram(p: PedidoAlerta, pizzaria: string, painel: string): string {
  const total = Number(p.total);
  const linhas: string[] = [];

  const modo =
    p.modo === "entrega" ? "🛵 Entrega" : p.modo === "retirada" ? "🏪 Retirada" : `🍽 Mesa ${escapar(p.cliente.mesa ?? "")}`.trim();
  linhas.push(`🍕 <b>Novo pedido #${p.numero}</b> · ${escapar(pizzaria)}`);
  linhas.push(`${modo} · ${hora(p.criado_em)}`);
  linhas.push("");

  if (p.cliente.nome) {
    const fone = p.cliente.telefone ? ` · ${escapar(p.cliente.telefone)}` : "";
    linhas.push(`👤 ${escapar(p.cliente.nome)}${fone}`);
  }
  if (p.modo === "entrega" && p.cliente.endereco) {
    linhas.push(`📍 ${escapar(p.cliente.endereco)}`);
    if (p.cliente.referencia) linhas.push(`   Ref.: ${escapar(p.cliente.referencia)}`);
  }
  if (p.cliente.nome || (p.modo === "entrega" && p.cliente.endereco)) linhas.push("");

  for (const i of p.itens) {
    linhas.push(`🧾 ${i.qtd}× ${escapar(i.nome)}${i.variante ? ` (${escapar(i.variante)})` : ""}`);
    if (i.obs) linhas.push(`   <i>Obs.: ${escapar(i.obs)}</i>`);
  }
  linhas.push("");

  linhas.push(`Total: <b>${moeda(total)}</b> (${escapar(p.pagamento)})`);
  if (p.pagamento === "Dinheiro" && p.troco) linhas.push(`Troco para ${escapar(p.troco)}`);
  if (p.pagamento === "Pix" && p.centavos_pix !== null) {
    const esperado = Math.round(total * 100 + p.centavos_pix) / 100;
    linhas.push(`💰 Pix esperado: <b>${moeda(esperado)}</b>. Confira no extrato.`);
  }
  linhas.push("");
  linhas.push(`👉 Atender: ${painel}`);

  return linhas.join("\n");
}
