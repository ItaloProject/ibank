import { createHash } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";

/*
 * Google Play Billing: o app compra pela Play Store e manda o token da compra para o servidor.
 * O servidor NUNCA confia no app: confere a compra direto na API do Google e só então libera o acesso.
 * As renovações e cancelamentos chegam por notificações do Google (RTDN, via Pub/Sub).
 */

/** Pacote do app na Play Store. */
export function nomeDoPacote(env: string | undefined = process.env.GOOGLE_PLAY_PACKAGE_NAME): string {
  return (env ?? "com.muvo.app").trim();
}

/** Os planos vendidos e o que cada um libera. Os IDs são os produtos criados no Play Console. */
export const PRODUTOS: Record<string, { plano: "assinante" | "completo"; bot: boolean }> = {
  muvo_assinante: { plano: "assinante", bot: false },
  muvo_completo: { plano: "completo", bot: true },
};

export function planoDoProduto(productId: string): { plano: "assinante" | "completo"; bot: boolean } | null {
  return Object.prototype.hasOwnProperty.call(PRODUTOS, productId) ? PRODUTOS[productId] : null;
}

/**
 * Identificador da conta enviado ao Google junto com a compra (obfuscatedAccountId).
 * É um hash: o Google nunca recebe o nome de usuário, e uma compra feita numa conta não libera outra.
 */
export function identificadorDeConta(userId: string): string {
  return createHash("sha256").update(`play:${userId}`).digest("hex");
}

/** Guarda só o hash do token da compra (o token inteiro vale como senha da compra). */
export function hashDoToken(purchaseToken: string): string {
  return createHash("sha256").update(purchaseToken).digest("hex");
}

/** O que a API do Google devolve para uma assinatura (só os campos que usamos). */
export type AssinaturaGoogle = {
  subscriptionState?: string;
  acknowledgementState?: string;
  testPurchase?: Record<string, unknown>;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  lineItems?: Array<{ productId?: string; expiryTime?: string }>;
};

export type SituacaoDaAssinatura = {
  productId: string | null;
  /** Até quando o acesso vale (fim do período já pago), ou null se não há acesso. */
  acessoAte: Date | null;
  /** Falta confirmar (acknowledge) a compra: o Google devolve o dinheiro se passar de 3 dias. */
  confirmar: boolean;
  /** Identificador de conta que o app mandou na compra. */
  contaId: string | null;
  estado: string;
};

/**
 * Lê a assinatura e diz até quando vale.
 * Dão acesso: ativa, em carência (pagamento falhou, o Google ainda tenta) e cancelada até o fim do período pago.
 * Não dão: expirada, em espera (on hold), pausada e pendente.
 */
export function interpretarAssinatura(a: AssinaturaGoogle, agora: Date = new Date()): SituacaoDaAssinatura {
  const estado = a.subscriptionState ?? "SUBSCRIPTION_STATE_UNSPECIFIED";
  const item = a.lineItems?.[0];
  const fim = item?.expiryTime ? new Date(item.expiryTime) : null;
  const fimValido = fim && Number.isFinite(fim.getTime()) ? fim : null;
  const comAcesso =
    estado === "SUBSCRIPTION_STATE_ACTIVE" ||
    estado === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ||
    estado === "SUBSCRIPTION_STATE_CANCELED";
  return {
    productId: item?.productId ?? null,
    acessoAte: comAcesso && fimValido && fimValido.getTime() > agora.getTime() ? fimValido : null,
    confirmar: a.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    contaId: a.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null,
    estado,
  };
}

/** Data (aaaa-mm-dd) do último dia de acesso, no fuso de Brasília. */
export function diaDoFimDoAcesso(fim: Date): string {
  const brasilia = new Date(fim.getTime() - 3 * 60 * 60 * 1000);
  return brasilia.toISOString().slice(0, 10);
}

/* ---------------- Notificações em tempo real (RTDN) ---------------- */

export type NotificacaoRtdn =
  | { tipo: "teste" }
  | { tipo: "assinatura"; purchaseToken: string; subscriptionId: string; notificationType: number }
  | { tipo: "ignorar" }
  | { tipo: "invalida" };

/** Lê o corpo que o Pub/Sub entrega: { message: { data: base64 do JSON do Google } }. */
export function decodificarRtdn(corpo: unknown, pacoteEsperado: string): NotificacaoRtdn {
  try {
    const data = (corpo as { message?: { data?: string } })?.message?.data;
    if (typeof data !== "string" || !data) return { tipo: "invalida" };
    const json = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
      packageName?: string;
      testNotification?: unknown;
      subscriptionNotification?: { purchaseToken?: string; subscriptionId?: string; notificationType?: number };
    };
    if (json.packageName !== pacoteEsperado) return { tipo: "invalida" };
    if (json.testNotification) return { tipo: "teste" };
    const s = json.subscriptionNotification;
    if (s?.purchaseToken && s.subscriptionId && typeof s.notificationType === "number") {
      return { tipo: "assinatura", purchaseToken: s.purchaseToken, subscriptionId: s.subscriptionId, notificationType: s.notificationType };
    }
    // Compras avulsas, produtos digitais e outros avisos: não vendemos, então ignora.
    return { tipo: "ignorar" };
  } catch {
    return { tipo: "invalida" };
  }
}

const JWKS_GOOGLE = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/**
 * Confere que a chamada veio mesmo do Pub/Sub do Google: o cabeçalho Authorization traz um token assinado
 * pelo Google, emitido para a nossa URL e para a conta de serviço que configuramos na assinatura push.
 */
export async function verificarChamadaPubSub(
  authorization: string | null,
  opcoes: { audiencia: string; email: string },
  chaves: JWTVerifyGetKey = JWKS_GOOGLE,
): Promise<boolean> {
  if (!opcoes.audiencia || !opcoes.email) return false;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, chaves, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: opcoes.audiencia,
      clockTolerance: 5,
    });
    const verificado = payload.email_verified === true || payload.email_verified === "true";
    return verificado && payload.email === opcoes.email;
  } catch {
    return false;
  }
}

/* ---------------- Chamadas à API do Google Play ---------------- */

type ContaDeServico = { client_email: string; private_key: string };

function contaDeServico(): ContaDeServico | null {
  const bruto = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!bruto) return null;
  try {
    const json = JSON.parse(bruto.trim().startsWith("{") ? bruto : Buffer.from(bruto, "base64").toString("utf8"));
    return json.client_email && json.private_key ? { client_email: json.client_email, private_key: json.private_key } : null;
  } catch {
    return null;
  }
}

export function billingConfigurado(): boolean {
  return contaDeServico() !== null;
}

let cacheToken: { valor: string; expira: number } | null = null;

async function tokenDeAcesso(): Promise<string> {
  if (cacheToken && cacheToken.expira > Date.now() + 60_000) return cacheToken.valor;
  const conta = contaDeServico();
  if (!conta) throw new Error("Play Billing não configurado");
  const chave = await importPKCS8(conta.private_key, "RS256");
  const agora = Math.floor(Date.now() / 1000);
  const assertiva = await new SignJWT({ scope: "https://www.googleapis.com/auth/androidpublisher" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(conta.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(agora)
    .setExpirationTime(agora + 3600)
    .sign(chave);
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertiva }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) throw new Error(`Google recusou a conta de serviço (${resposta.status})`);
  const dados = (await resposta.json()) as { access_token: string; expires_in: number };
  cacheToken = { valor: dados.access_token, expira: Date.now() + dados.expires_in * 1000 };
  return dados.access_token;
}

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

/** Consulta a assinatura no Google. Devolve null se o token não existir ou não for dessa conta/app. */
export async function consultarAssinatura(purchaseToken: string): Promise<AssinaturaGoogle | null> {
  const resposta = await fetch(
    `${API}/${encodeURIComponent(nomeDoPacote())}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${await tokenDeAcesso()}` }, signal: AbortSignal.timeout(15_000) },
  );
  if (resposta.status === 404 || resposta.status === 400 || resposta.status === 410) return null;
  if (!resposta.ok) throw new Error(`API do Google Play respondeu ${resposta.status}`);
  return (await resposta.json()) as AssinaturaGoogle;
}

/** Confirma a compra (acknowledge). Sem isso o Google cancela e devolve o dinheiro em 3 dias. */
export async function confirmarAssinatura(productId: string, purchaseToken: string): Promise<void> {
  const resposta = await fetch(
    `${API}/${encodeURIComponent(nomeDoPacote())}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${await tokenDeAcesso()}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    },
  );
  // 400 aqui costuma ser "já confirmada": não é erro.
  if (!resposta.ok && resposta.status !== 400) throw new Error(`Falha ao confirmar a compra (${resposta.status})`);
}
