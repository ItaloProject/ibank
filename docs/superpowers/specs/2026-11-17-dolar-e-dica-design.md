# Card do dólar + botão "Dica" (Dashboard)

Data: 2026-11-17 · Escopo: pequeno · Site (Next.js) e app Android (Compose)

## Intenção
No Dashboard, acompanhar o dólar de relance (quanto vale em reais hoje e se subiu ou caiu no dia) e ter uma dica diferente a cada dia. Pedido do dono do app, nas palavras dele: um "quadradinho" com o rato na borda do canto superior direito, e um "botãozinho" no cantinho com o nome "Dica".

## Objetivos
- Card com **só o valor do dólar em R$ e uma seta** (para cima = subiu, para baixo = caiu no dia). Sem mínima, máxima, percentual ou texto extra.
- Rato (`muvo-bot`) sobre a borda do card, canto superior direito, metade para fora.
- Botão "Dica" num canto do Dashboard; abre uma janelinha com a dica do dia.
- Dica muda todo dia, igual para todos os usuários naquele dia.

## Não-objetivos
- Histórico, gráfico, conversão de valores, alertas de cotação.
- Dicas personalizadas por usuário ou geradas por IA.

## Restrições
- Seguir o padrão do projeto: rota `/api/*` com cache (como `market-rates`), `Card` do site e `SiteCard` do Android, cores semânticas (emerald = positivo, destructive = negativo).
- Se a cotação falhar, o card mostra "—" e o resto do Dashboard segue funcionando.

## Abordagens consideradas
1. **AwesomeAPI via rota própria (escolhida).** Valor atual e variação do dia numa chamada; cache de 5 min na rota; site e app usam a mesma.
2. PTAX do Banco Central: oficial, mas só fechamentos de dias úteis e sem valor intradia; variação teria de ser calculada entre dois dias.
3. Cada cliente chamando a API externa direto: duplica código e chamadas, sem cache.

## Decisões
- Seta verde (emerald) para subiu, vermelha (destructive) para caiu. Escolha minha, seguindo a convenção de mercado; a seta só informa a direção. Variação zero: seta omitida.
- Rota `GET /api/dollar` → `{ bid: number, change: number }` (`change` = variação do dia em R$, vem de `varBid`). Erro → HTTP 502 `{ bid: null }`.
- Dica: lista curada de dicas curtas em português, escolhida por `diaDoAno-desde-epoch % tamanho` na data local. Mesma lista no site (`src/lib/daily-tip.ts`, com teste) e no Android (`DailyTip.kt`).
- Site: botão no `actions` do `PageHeader`, janelinha com `Dialog`. Android: botão no cabeçalho do Dashboard (canto superior direito, longe do rato flutuante de baixo), janelinha com `AlertDialog`.
- Card do dólar entra na grade de KPIs do site (que passa de 4 para 5 colunas apenas no layout largo, ou vai para uma nova linha — decisão do construtor) e como card no topo da coluna no Android.
