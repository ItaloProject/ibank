// Dica financeira do dia: a mesma para todos, muda à meia-noite (data local), sem rede.
// Mantenha esta lista igual à do app Android (DailyTip.kt).
export const DAILY_TIPS: readonly string[] = [
  "Pague-se primeiro: separe o valor do aporte assim que o salário cair, antes de gastar.",
  "Reserva de emergência vem antes de qualquer investimento arriscado: 6 meses de gastos fixos.",
  "Antes de parcelar, pergunte: eu compraria à vista por esse preço?",
  "Juros do rotativo do cartão passam de 400% ao ano. Evite pagar só o mínimo da fatura.",
  "Anote todos os gastos por 30 dias. Você vai se surpreender com os pequenos vazamentos.",
  "Compare preços esperando 24 horas antes de compras por impulso.",
  "Dívida com juros altos é prioridade: quitá-la rende mais que qualquer investimento.",
  "Diversifique: não coloque todo o patrimônio em um único ativo.",
  "Aportes pequenos e constantes vencem aportes grandes e raros. Constância é o segredo.",
  "Juros compostos trabalham a seu favor quando você começa cedo.",
  "Revise assinaturas todo mês. Cancele o que você não usou nas últimas semanas.",
  "Defina um objetivo para cada real guardado: viagem, reserva, aposentadoria.",
  "Não invista no que você não entende. Estude antes de aplicar.",
  "Rentabilidade passada não garante rentabilidade futura.",
  "Taxas escondidas corroem o rendimento: confira taxa de administração e de corretagem.",
  "Fixe um teto para lazer e delivery no mês, e respeite.",
  "Comece o mês com um planejamento: quanto entra, quanto sai, quanto sobra.",
  "Aumento de salário? Aumente também o aporte, não só o padrão de vida.",
  "Compre o que precisa, não o que o desconto sugere.",
  "A fatura do cartão não é renda extra. Gaste só o que cabe no seu planejamento.",
  "Tenha uma conta separada para a reserva de emergência, longe do dia a dia.",
  "Renda fixa é boa base para a carteira; renda variável é para o longo prazo.",
  "Dividendos reinvestidos aceleram o crescimento do patrimônio.",
  "Nunca invista dinheiro que você vai precisar nos próximos meses em renda variável.",
  "Cuidado com promessas de ganho fácil e garantido: é o sinal clássico de golpe.",
  "Negocie. Taxas, mensalidades e juros muitas vezes aceitam desconto se você pedir.",
  "Conheça seu custo de vida: é o número que define quanto de reserva você precisa.",
  "Pagar a fatura em dia protege seu score e seu bolso.",
  "Antes de financiar, simule: o total pago ao final costuma ser bem maior que o preço.",
  "Um bom hábito vale mais que uma boa planilha: registre seus gastos todo dia.",
  "Revise sua carteira a cada 6 meses e reequilibre se algum ativo ficou desproporcional.",
  "Não decida investimento pelo medo nem pela euforia. Siga o plano.",
  "Inflação corrói o dinheiro parado. Guardar sem render é perder poder de compra.",
  "Compras grandes pedem planejamento: junte o valor em vez de parcelar sem necessidade.",
  "Tenha metas de curto, médio e longo prazo, cada uma com seu tipo de investimento.",
  "Gaste menos do que ganha. Parece óbvio, e é a base de tudo.",
  "Cartão é meio de pagamento, não extensão do salário.",
  "Automatize o aporte: o que sai sozinho da conta não vira tentação.",
  "Pesquise a reputação da corretora e se ela é regulada pela CVM antes de investir.",
  "Sorteios, rifas e apostas não são investimento.",
  "Pequenos gastos diários, somados no mês, viram um grande gasto.",
  "Faça um 'dia sem gastar' por semana e veja a diferença no fim do mês.",
  "Fundos imobiliários podem gerar renda mensal, mas os preços das cotas oscilam.",
  "Ao comparar investimentos, olhe o rendimento líquido, depois do imposto.",
  "Imposto de Renda: guarde comprovantes de despesas dedutíveis durante o ano todo.",
  "Dólar sobe e desce. Não tente adivinhar: diversifique e pense no longo prazo.",
  "Educação financeira é o investimento com melhor retorno. Leia, estude, pergunte.",
  "Antes de emprestar o cartão ou o nome a alguém, lembre: a dívida fica com você.",
  "Dinheiro guardado com propósito rende mais, porque você resiste a gastá-lo.",
  "Se a parcela cabe no bolso mas não cabe no planejamento, ela não cabe.",
  "Revise o orçamento depois de cada grande mudança: emprego, moradia, família.",
  "Vender no pânico transforma queda temporária em prejuízo permanente.",
  "Ter várias dívidas? Quite primeiro a de maior juros, ou junte todas numa de menor taxa.",
  "Planeje o ano: IPVA, IPTU, matrícula e seguros somam muito se vierem de surpresa.",
  "Comemore as metas batidas. Manter a motivação faz parte do plano financeiro.",
  "Bom investimento é aquele que você consegue manter por anos sem perder o sono.",
  "Saber para onde o dinheiro vai é o primeiro passo para mandá-lo para onde você quer.",
  "Dica do MUVO: lance cada compra no cartão no mesmo dia, enquanto você ainda lembra dela.",
  "Dica do MUVO: confira a aba Plano no começo do mês para ver as parcelas que vêm por aí.",
  "Dica do MUVO: acompanhe a renda passiva mês a mês: ela mostra o patrimônio trabalhando por você.",
];

/** Dias corridos desde 1970 para a data local (muda à meia-noite local). */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function tipOfTheDay(date: Date = new Date()): string {
  const n = DAILY_TIPS.length;
  return DAILY_TIPS[((localDayNumber(date) % n) + n) % n];
}
