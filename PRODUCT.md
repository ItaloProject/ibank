# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profissionais e pessoas que buscam controle financeiro pessoal detalhado, inicialmente o fundador e early adopters próximos. O produto é construído para uso pessoal com intenção de abertura pública futura. O usuário principal acessa diariamente ou semanalmente para registrar gastos no cartão de crédito, acompanhar investimentos e planejar o orçamento mensal.

## Product Purpose

MUVO é um app de gestão financeira pessoal que unifica cartão de crédito, planejamento de orçamento mensal e acompanhamento de investimentos em uma única interface. O sucesso é: o usuário sabe exatamente quanto gastou, quanto tem investido e quanto vai sobrar no mês — sem precisar abrir planilha.

## Positioning

MUVO é o único app de finanças pessoais onde seus dados ficam no seu próprio banco (Neon/PostgreSQL), com design editorial premium e integração real entre gastos no cartão, orçamento mensal e carteira de investimentos. Nenhum app concorrente oferece os três juntos com controle total dos dados.

## Operating Context

- Acesso via PWA no celular (uso principal) e desktop (análise e planejamento)
- Usuário registra gastos após compras ou no fechamento do cartão
- Consulta investimentos e rentabilidade mensalmente
- Planeja orçamento no início de cada mês copiando o mês anterior
- Gera PDF do planejamento para referência offline

## Capabilities and Constraints

- Cartão de crédito: lançamentos, parcelamentos, relatório mensal imprimível
- Planejamento orçamentário: grupos de gastos customizáveis, fixos vs variáveis, barra de progresso vs renda
- Investimentos: ações, proventos, rebalanceamento de carteira, rentabilidade
- Metas financeiras
- Impostos sobre investimentos
- Multi-usuário com admin panel (escopo futuro público)
- PWA com offline support (serwist)
- Stack: Next.js 16, React 18, Tailwind CSS + shadcn/ui, Neon PostgreSQL, TypeScript
- Autenticação por sessão JWT (sem OAuth externo)

## Brand Commitments

- Nome: **MUVO** (marca), codebase: IBANK
- Mascote: rato busto com óculos e braços cruzados — logotipo principal
- Tipografia editorial: Playfair Display (display/italic para MUVO) + Sora (corpo)
- Paleta: âmbar (`hsl(38 88% 57%)`) como cor primária, fundo escuro quente `hsl(28 15% 5%)`
- Tom: confiante, direto, premium sem ser bancário corporativo
- Identidade visual: editorial/magazine com toques de luxo refinado

## Evidence on Hand

- Implementação visual existente em produção (Next.js app em `src/app/`)
- Logo e ícones PWA: `/public/logo.png`, `/public/icons/`
- Sidebar redesenhada com paleta âmbar coesa
- Tela de login com entrada de marca editorial
- Página de planejamento com hierarquia UX e barras de progresso por grupo

## Product Principles

1. **Clareza antes de completude** — uma tela legível e rápida supera um painel completo e confuso.
2. **Dados do usuário, domínio do usuário** — nenhuma analítica de terceiro, nenhum dado compartilhado; privacidade é postura, não feature.
3. **Design como diferencial** — a interface é o produto; cada tela deve surpreender quem vem de concorrentes.
4. **Progressivo, não bloqueante** — funciona com dados incompletos; nunca exige contexto antes de dar valor.
5. **Móvel em primeiro lugar** — toda decisão de layout começa pelo celular, desktop é aprimoramento.

## Accessibility & Inclusion

- Textos em português brasileiro (pt-BR) em toda a interface
- Mínimo de 44px em alvos de toque (touch targets)
- Contraste âmbar sobre fundo escuro mantido acima de 4.5:1 sempre que possível
