---
name: MUVO
description: Smart Control Finances — personal financial management with editorial precision and monochromatic resolve.
colors:
  bg-light: "#F3F0EF"
  bg-dark: "#0D0D0D"
  fg-light: "#0D0D0D"
  fg-dark: "#F5F5F5"
  card-light: "#F7F7F7"
  card-dark: "#141414"
  muted-fg-light: "#706A67"
  muted-fg-dark: "#999999"
  border-light: "#DEDBD8"
  border-dark: "#262626"
  sidebar-bg: "#0D0D0D"
  sidebar-accent: "#1F1F1F"
  bot-surface: "#05050A"
  state-positive: "#19A855"
  state-warning: "#F5C425"
  state-negative: "#E22153"
  state-score: "#7C3AED"
  destructive: "#C81D0A"
typography:
  display:
    fontFamily: "Funnel Display, ui-sans-serif, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "DM Sans, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: "DM Sans, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, ui-sans-serif, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "hsl(var(--primary))"
    textColor: "hsl(var(--primary-foreground))"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "hsl(var(--primary) / 0.9)"
    textColor: "hsl(var(--primary-foreground))"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "hsl(var(--foreground))"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "hsl(var(--foreground))"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-pill-dark:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "rgba(255,255,255,0.70)"
    rounded: "{rounded.full}"
    padding: "6px 14px"
  input-default:
    backgroundColor: "hsl(var(--background))"
    textColor: "hsl(var(--foreground))"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  card-default:
    backgroundColor: "hsl(var(--card))"
    textColor: "hsl(var(--card-foreground))"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: MUVO

## Overview

**Creative North Star: "O Analista Noturno"**

MUVO é a interface que um analista financeiro construiria para si mesmo: densa o suficiente para nunca esconder dados, silenciosa o suficiente para não competir com eles. O sistema visual é construído sobre um único eixo — escuro profundo contra off-white quente — sem cor de marca vibrante, sem gradiente decorativo, sem ornamento que não sirva informação. A identidade é o vazio controlado; o que faz o MUVO ser o MUVO é o que ele recusa, não o que ele acrescenta.

Em modo claro, o MUVO respira como papel de qualidade: `#F3F0EF`, um off-white com temperatura levemente quente (H=15° no espaço HSL) que recusa o branco clínico dos apps bancários. Em modo escuro — o estado primário da maioria das superfícies de análise financeira — o fundo é `#0D0D0D`, grafite tão denso que os números em branco flutuam sem ancoragem visível. A sidebar permanece sempre escura independentemente do tema ativo, criando um frame de ancoragem constante que dá coerência à experiência em qualquer modo. A superfície MUVO BOT aprofunda ainda mais: `#05050A`, quase sem luz, com meshes radiais em `rgba(255,255,255,0.02–0.04)` para textura atmosférica que não compete com os dados.

A cor nunca é identidade. Onde cor aparece — emerald para positivo, amber para atenção, vermelho para crítico — é linguagem diagnóstica funcional, não estética. A tipografia faz o trabalho expressivo: Funnel Display em peso 800 para hierarquias que precisam de presença editorial; DM Sans para leitura densa e eficiente. O peso e o espaçamento de tracking fazem o trabalho que outros sistemas delegam à cor.

**Key Characteristics:**
- Monochrome absoluto como identidade; cor apenas como código semântico de diagnóstico
- Sidebar sempre escura — frame constante independente do tema claro/escuro
- Superfície MUVO BOT: camada mais profunda (`#05050A`), separada do token system principal
- Densidade informacional alta; componentes compactos e sem padding decorativo
- Radius consistente e moderado (10px base); pill apenas em ações contextuais rápidas em superfícies escuras
- Tipografia e tracking trabalham como sistema expressivo — Funnel Display como voz de exibição

## Colors

Paleta construída sobre dois polos extremos e uma camada funcional semântica. Nenhuma cor de marca além do monocrômico.

### Primary
- **Off-White Quente** (#F3F0EF, `hsl(15 14% 95%)`): background do modo claro. A temperatura quente (H=15) distingue o MUVO do branco clínico de apps bancários tradicionais. Toda superfície principal no tema claro parte daqui.
- **Grafite Profundo** (#0D0D0D, `hsl(0 0% 5%)`): primary no modo claro, background no modo escuro, e base permanente da sidebar. Near-black sem viés azulado ou marrom — grafite puro.
- **Off-White Display** (#F5F5F5, `hsl(0 0% 96%)`): primary no modo escuro; texto principal sobre Grafite Profundo. O par Off-White Quente / Grafite Profundo define o eixo visual completo do sistema.

### Neutral
- **Card Claro** (#F7F7F7, `hsl(0 0% 97%)`): superfície de card no modo claro — 2% acima do background, diferença tonal mínima mas perceptível.
- **Card Escuro** (#141414, `hsl(0 0% 8%)`): superfície de card no modo escuro — +3% lightness sobre o background, separação tonal sem shadow.
- **Mid-Gray Quente** (#706A67, `hsl(20 6% 42%)`): `muted-foreground` no modo claro — texto de suporte, labels, placeholders, metadata.
- **Mid-Gray Neutro** (#999999, `hsl(0 0% 60%)`): `muted-foreground` no modo escuro — mesma função.
- **Border Quente** (#DEDBD8, `hsl(15 10% 87%)`): bordas no modo claro — temperatura quente consistente com o background.
- **Border Escura** (#262626, `hsl(0 0% 15%)`): bordas no modo escuro — sutil, apenas divide sem peso.
- **Bot Surface** (#05050A): background exclusivo da superfície MUVO BOT — mais escuro e com leve viés de hue 270° (quase imperceptível), criando profundidade de camada perceptível mas não anunciada.

### Secondary (Sidebar — always dark)
- **Sidebar Background** (#0D0D0D, `hsl(0 0% 5%)`): a sidebar é sempre escura, qualquer que seja o tema.
- **Sidebar Accent** (#1F1F1F, `hsl(0 0% 12%)`): hover e active background em nav items da sidebar.

### Functional (Semantic — diagnostic, never decorative)
- **State Positive / Emerald** (#19A855, `hsl(142 76% 36%)`): ganhos, metas atingidas, saúde de carteira, score alto. Só aparece como resposta a dados — nunca como cor de seção ou CTA.
- **State Warning / Amber** (#F5C425, `hsl(47 96% 53%)`): atenção, variação neutra, insights de cuidado.
- **State Negative / Red-Pink** (#E22153, `hsl(346 77% 50%)`): perdas, alertas críticos, metas não atingidas.
- **Score Violet** (#7C3AED, `hsl(262 83% 58%)`): exclusivo para gráfico de evolução de score na superfície MUVO BOT.
- **Destructive** (#C81D0A, `hsl(4 86% 42%)`): ações destrutivas irreversíveis. Nunca decorativo.

**The No-Brand-Color Rule.** MUVO não tem cor primária vibrante. `--primary` resolve para o extremo oposto do background em cada tema (near-black no claro, near-white no escuro). Qualquer outra cor é semântica, contextual, e reflete o estado dos dados — não a marca.

**The Diagnostic-Only Rule.** Emerald, amber, red-pink e violet existem apenas quando carregam informação semântica (positivo/negativo/atenção/score). Nunca para diferenciar seções, categorias de UI, ou elementos decorativos. Se um elemento usa cor e você remove a cor sem perder informação, a cor não deveria estar lá.

## Typography

**Display Font (fonte principal + texture):** Funnel Display (Google Fonts, `--font-display`, weights 400–800)
**Body Font (fonte secundária):** DM Sans (Google Fonts, `--font-sans`, weights 400–800)

Definição de marca vinda do Figma: Funnel Display é a fonte principal e também a fonte usada como textura tipográfica; DM Sans é a fonte secundária.

**Character:** Funnel Display é moderno sem ser decorativo — suas proporções abertas e variação de espessura criam autoridade editorial sem rigidez. DM Sans é o parceiro funcional: altamente legível em densidades altas, neutro o suficiente para desaparecer na leitura de dados numéricos. O par opera por contraste de propósito: Funnel Display domina momentos de comunicação; DM Sans domina momentos de uso.

### Hierarchy
- **Display** (Funnel Display 700–800, clamp(1.5rem–2.25rem), line-height 1.1, letter-spacing -0.02em): títulos de página, valores monetários em destaque, heroes de seção. A classe `font-display` aplica Funnel Display; `font-black` (weight 800) é o padrão para valores financeiros principais.
- **Headline** (DM Sans 700, 1.125rem, line-height 1.3): cabeçalhos de seção, títulos de card, headings de modal. `font-bold` em DM Sans.
- **Title** (DM Sans 600, 1rem, line-height 1.4): subsection labels, primários de list item, headers de coluna.
- **Body** (DM Sans 400, 0.875rem/14px, line-height 1.5): texto narrativo, descrições, mensagens de erro. Máximo 65–75ch para blocos de leitura.
- **Label** (DM Sans 800, 0.625rem/10px, line-height 1, tracking 0.18–0.22em, UPPERCASE): kickers de categoria, badges de metadata, indicadores de modo. Nunca acima de um heading; apenas como metadata inline, chip ou stamp.

**The Display-on-Numbers Rule.** Valores monetários em destaque sempre recebem `font-display font-black` (Funnel Display 800). É a assinatura tipográfica do MUVO — distingue "o número que importa" do contexto ao redor sem recorrer à cor.

**The Tracking Doctrine.** Labels em caps usam tracking entre `0.18em` e `0.22em` com weight 700–800 — o espaçamento generoso + peso criam hierarquia sem precisar de cor. Body e display nunca recebem tracking positivo explícito; display recebe tracking negativo (-0.02em) para compactação editorial.

## Layout

**Estrutura de duas zonas:** sidebar fixa à esquerda (240px expandida / 68px colapsada, via `transition-[width]`) + área de conteúdo `flex-1 overflow-y-auto`. Mobile elimina a sidebar e usa bottom navigation (altura `--bottom-nav-h: 3.5rem` + `var(--safe-bottom)` de safe area inset). A sidebar é sempre `fixed left-0` e `z-40`.

**Safe area awareness:** Todos os insets são respeitados via `env(safe-area-inset-*)` — aplicados no sidebar (`pt-[var(--safe-top)] pb-[var(--safe-bottom)]`), no header mobile, e no padding-bottom do conteúdo principal (`pb-bottom-nav`).

**Container behavior:** Páginas de análise densa (MUVO LIVE, MUVO BOT) usam `max-w-5xl mx-auto` com `px-5 sm:px-8`. Páginas de gestão transacional preenchem o espaço disponível com `px-5 md:px-8`. Sem max-width global — a grade se adapta ao espaço.

**Density:** Alta. Touch targets mínimos `h-11` (44px) no mobile, reduzem para `md:h-10` (40px) no desktop. Cards e seções têm padding interno 16–24px. Espaço em branco serve separação funcional — não decoração.

**Responsive behavior:**
- `< 768px`: mobile-first — sem sidebar, bottom nav visible, header com logo/hambúrguer, `safe-pt` aplicado
- `≥ 768px (md)`: sidebar visível, bottom nav oculto, layout de duas ou três colunas disponível, conteúdo com margem de sidebar
- `≥ 1024px (lg)`: grids de investimento expandem para mais colunas; densidade aumenta

**Sticky headers:** Subseções que precisam de acesso persistente durante scroll usam `sticky top-0 z-[n] bg-[surface]/85 backdrop-blur-xl border-b border-[divider]`. O blur é funcional — legibilidade sobre conteúdo em scroll — nunca decorativo.

## Elevation & Depth

O sistema é **plano por padrão, com profundidade tonal.** Hierarquia de profundidade é comunicada pela diferença de lightness entre camadas adjacentes, não por sombras.

| Camada | Claro | Escuro |
|---|---|---|
| Background | #F3F0EF (L=95%) | #0D0D0D (L=5%) |
| Card | #F7F7F7 (L=97%) | #141414 (L=8%) |
| Popover | #F7F7F7 + border | #111111 + border |
| Bot Surface | — | #05050A (L=2%) |
| Sidebar | #0D0D0D (sempre) | #0D0D0D (sempre) |

**Shadow vocabulary:**
- `shadow-sm` (`0 1px 2px rgba(0,0,0,0.05)`): apenas em cards da camada principal no tema claro. Ausência total no escuro — separação por `border` e diferença tonal.
- Ambient mesh (MUVO BOT): radiais `bg-white/[0.02–0.04] blur-[130–140px]` posicionados em `absolute` — textura atmosférica que cria profundidade sem peso visual.
- Sticky blur: `backdrop-filter: blur(24px)` em headers que flutuam sobre conteúdo scrollável. Semântico, não decorativo.

**The Flat-By-Default Rule.** Sombras aparecem somente como `shadow-sm` em cards do tema claro. Escuro usa profundidade tonal pura: nenhuma sombra, nenhum glow. Se um elemento precisa de sombra colorida ou offset no tema escuro, a sombra é o problema — a hierarquia tonal deve ser resolvida no token de background.

## Shapes

**Radius base:** `--radius: 0.625rem` (10px). A escala cresce em uso:
- `rounded-sm` (6px): chips internos, badges de categoria, tags de status
- `rounded-md` (8px): inputs, botões padrão, dropdowns
- `rounded-lg` (10px): cards padrão, dialogs, drawers — o radius mais recorrente
- `rounded-xl` (12px): cards de seção de investimentos, highlights de análise
- `rounded-2xl` (16px): cards premium de superfície escura (MUVO BOT, MUVO LIVE desktop)
- `rounded-full` (9999px): pill buttons contextuais, dots indicadores, avatares

**The Pill Exception Rule.** `rounded-full` é exclusivo de ações rápidas contextuais em superfícies escuras (Live, PDF, Sair no MUVO BOT; chips de filtro inline; dots de status). Nunca em CTAs primários de formulários, botões de submit, ou ações principais de flow.

**Border economy:** Bordas são sempre `1px solid` no token de border do tema. Nunca bordas coloridas, nunca width > 1px em cards ou list items. Sobre superfícies escuras, bordas usam `border-white/[0.07–0.15]` em vez de cores sólidas — transparência que escala com a camada.

## Components

### Buttons
- **Shape:** `rounded-md` (8px) para primário, outline e ghost; `rounded-full` para pill contextual
- **Primary:** `bg-primary text-primary-foreground hover:bg-primary/90 transition-colors`; altura `h-11 md:h-10`; padding `px-4`
- **Outline:** `border border-input bg-background hover:bg-accent hover:text-accent-foreground`; mesma altura e padding
- **Ghost:** sem border, sem background; hover `bg-accent text-accent-foreground`; sem transição de cor visível em repouso
- **Pill (superfícies escuras):** `rounded-full border border-white/15 bg-white/[0.06] px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white`
- **Focus:** `ring-2 ring-ring ring-offset-2` — ring adota o primary do tema (near-black/near-white); sem glow colorido
- **Disabled:** `opacity-50 pointer-events-none`

### Cards
- **Corner:** `rounded-lg` (10px) padrão; `rounded-xl/2xl` em superfícies de análise
- **Background:** `bg-card` — tonal acima do background (ver Elevation)
- **Shadow:** `shadow-sm` no tema claro; ausente no escuro
- **Border:** `border border-border` — 1px, neutro, nunca colorida; sobre escuro `border-white/[0.08]`
- **Padding:** `p-6` padrão via shadcn CardContent; cards de investimento `p-4–5` para densidade

### Inputs
- **Style:** `rounded-md border border-input bg-background h-11 md:h-10 px-3`
- **Focus:** `ring-2 ring-ring ring-offset-2` — sem glow colorido
- **Placeholder:** `text-muted-foreground` (mid-gray warm)
- **Error:** `border-destructive` + mensagem `text-destructive text-sm` abaixo

### Navigation — Sidebar
- **Item shape:** `rounded-xl px-2.5 py-2.5`
- **Type:** `text-[13px] font-medium`
- **Default:** `text-sidebar-foreground/65`
- **Hover:** `bg-sidebar-accent/50 text-sidebar-foreground`; `transition-all duration-100 ease-out`
- **Active:** `bg-sidebar-primary/15 text-sidebar-primary` — ênfase tonal sem sublinhado, sem borda colorida
- **Group label:** `text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30`

### MUVO Signal Chip (componente assinatura)
Chip de dois elementos: dot pulsante (`animate-ping` sobre dot sólido) + label em caps com tracking wide. Indica o estado em tempo real de um modo ativo (MUVO BOT, MUVO LIVE). Dot emerald = modo ativo. Nunca decorativo — sempre indica estado funcional. Não é um badge; não tem hover; não é clicável.

Markup padrão:
```html
<div class="flex items-center gap-2">
  <span class="relative flex h-2 w-2">
    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
    <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
  </span>
  <span class="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">MUVO · BOT</span>
</div>
```

## Do's and Don'ts

### Do:
- **Do** usar `font-display font-black` (Funnel Display 800) em qualquer valor monetário em destaque — é a assinatura tipográfica do MUVO e o sinal mais reconhecível do sistema.
- **Do** usar `rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl` em cards sobre superfícies escuras (MUVO BOT, MUVO LIVE) — a transparência cria a camada sem adicionar peso.
- **Do** reservar emerald, amber e red-pink para diagnóstico e estado financeiro — ganho/perda, OK/warning/crítico. Nunca para categorizar seções de UI.
- **Do** manter a sidebar sempre com `bg-sidebar` (near-black `hsl(0 0% 5%)`) independente do tema — é o frame de ancoragem constante da experiência.
- **Do** usar `sticky top-0 backdrop-blur-xl bg-[surface]/85 border-b` para headers de subseções que precisam persistir durante scroll — blur com função real.
- **Do** usar `tracking-[0.18–0.22em]` com `font-black uppercase` em labels de categoria e badges de modo — tracking e peso fazem o trabalho da cor.

### Don't:
- **Don't** usar gradientes coloridos decorativos (purple-to-blue, amber-to-orange, qualquer hue→hue transition). Gradientes existem apenas como transparência neutra (`bg-white/[0.02–0.04] blur-[130px]`) para mesh atmosférico.
- **Don't** usar `backdrop-blur` como estética de "glass morphism" com borda colorida luminosa. Blur só quando serve legibilidade real (header sobre scroll, modal sobre conteúdo denso).
- **Don't** introduzir cor como identidade de marca — nenhum verde MUVO, nenhum azul MUVO, nenhum roxo MUVO. A identidade é o contraste extremo entre background e foreground, ampliado pelo Display font.
- **Don't** usar `border-left` ou `border-right` colorida em cards, alerts ou list items — ênfase é tonal e tipográfica.
- **Don't** usar emoji ou unicode decorativo como sistema de ícones. Lucide React é o sistema; stroke-width e size consistentes (`h-4 w-4` padrão, `h-5 w-5` em ações primárias).
- **Don't** colocar kicker/eyebrow acima de headings. O heading carrega seu próprio peso; metadata vai abaixo ou inline como label chip à esquerda ou direita — nunca acima como pré-título.
