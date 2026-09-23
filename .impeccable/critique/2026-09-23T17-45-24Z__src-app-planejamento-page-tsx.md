---
target: src/app/planejamento/page.tsx
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\Italo\\IBANK\\src\\app\\planejamento\\page.tsx"
target_fingerprint: "sha256:a3b6dea1acbc3e6b745f857f75fe0fcf201ada752cb3f7fb13e391923b0f4801"
target_path: "C:\\Users\\Italo\\IBANK\\src\\app\\planejamento\\page.tsx"
timestamp: 2026-09-23T17-45-24Z
slug: src-app-planejamento-page-tsx
---
## MUVO — Critique Report (Planejamento + App Shell)
Method: dual-agent

### Design Health Score
| # | Heuristica | Score | Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | CRUD muda estado silenciosamente |
| 2 | Match System / Real World | 3 | Linguagem natural; Salario estreito |
| 3 | User Control and Freedom | 2 | Sem undo; confirm() nativo; grupos colapsados |
| 4 | Consistency and Standards | 2 | confirm() + dialogs; button vs Button |
| 5 | Error Prevention | 2 | Aviso ao deletar grupo; resto falha silenciosamente |
| 6 | Recognition Rather Than Recall | 2 | Barras otimas; dots sem legenda; plan. 10px |
| 7 | Flexibility and Efficiency | 2 | Inline edit otimo; copiar mes desaparece |
| 8 | Aesthetic and Minimalist | 2 | Rows limpos; overview 6 metricas simultaneas |
| 9 | Error Recovery | 1 | Apenas loadError tem retry; CRUD silencioso |
| 10 | Help and Documentation | 2 | Placeholders bons; zero onboarding |
| Total | | 20/40 | Acceptable |

### Design Specificity
Moderado. Sidebar e login sao distintamente MUVO. Planejamento e ShadCN com tema escuro.
Detector confirmou: 11 verdadeiros positivos de 15 findings.

### Priority Issues
P0: CRUD silencioso - implementar toast (Sonner)
P0: confirm() nativo - substituir por AlertDialog
P1: Grupos colapsados por padrao - inverter default
P1: side-tab border em grupos - substituir por marcador mais distinto
P2: Exceder orcamento sem caminho de saida

### Detector Findings (11 true positives)
- side-tab: planejamento/page.tsx:489 (confirmed visually)
- gradient-text: investor-live-view.tsx (5x), investor-mode-view.tsx (1x)
- ai-color-palette (violet): investor-live-view.tsx (2x), investor-bot.tsx (2x)

### False Positives (4)
- side-tab in PDF report generators (print context)
- side-tab planejamento:540 (3px @ 18.8% opacity - structural connector)
- gray-on-color nubank-import:29 (parsing error)
