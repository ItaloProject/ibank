# Muvo Freemium (Play Store)

## Por que existe

A Google Play precisa de um app utilizável sem pagamento. O teste de 3 dias sozinho não basta: depois dele o usuário pode **continuar grátis com limites** ou assinar.

## Planos

| Plano | Preço | Acesso | Bot / IA | Limites |
|---|---|---|---|---|
| **teste** | R$ 0 (72 h) | Completo | Sim | Sem teto |
| **gratuito** | R$ 0 permanente | Básico | Não | 3 grupos, 20 itens/mês, 2 contas de investimento |
| **assinante** | R$ 30/mês | Completo | Não | Sem teto |
| **completo** | R$ 35/mês | Completo | Sim | Sem teto |

Pierre Pro mensal: R$ 39 — o Completo fica abaixo de propósito.

## Fluxo

1. Entrada com Google → `plan=teste` + `trial_ends_at` (+72 h).
2. Durante o teste: tudo liberado (`subscriptionActive=true`).
3. Teste acaba → tela de bloqueio oferece:
   - **Continuar grátis** → `POST /api/account/continuar-gratis` → `plan=gratuito`
   - Assinar (Play Billing no app / WhatsApp no PWA)
4. Conta `gratuito` **não** entra na limpeza de testes (`cron/limpar-testes` só apaga `plan=teste`).

## Código

- Matriz: `src/lib/plans.ts`
- Limites na API: `src/lib/plan-limits.ts`
- Acesso: `isSubscriptionActive` em `src/lib/subscription.ts` trata `gratuito`
- Sessão: `entitlements` em `dadosDoUsuario`
- UI web: `SubscriptionGate`, `FreePlanBanner`, `/comecar`
- App Android: botão “Continuar grátis” em `AssinaturaExpirada`

## O que o grátis NÃO tem

- MUVO Bot
- Pesquisa de mercado com IA
- Módulo de IR completo (flag `impostos`)
