import {
  GraduationCap, Wallet, CreditCard, Percent, Landmark, Receipt, TrendingUp, PiggyBank, Globe, ShieldAlert, Tv, Users,
  type LucideIcon,
} from "lucide-react";

export type Video = {
  title: string;
  description: string;
  youtubeId: string;
  duration: string;
  channel: string;
  channelUrl: string;
};

export type Track = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  videos: Video[];
};

/** Até 10 minutos é resumo; acima disso vai para Aulas completas. */
export const QUICK_MAX_SECONDS = 600;

export function seconds(duration: string): number {
  return duration.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

export const isQuick = (v: Video) => seconds(v.duration) <= QUICK_MAX_SECONDS;

// Vídeos públicos do YouTube, sempre pelo player oficial: nunca baixar nem hospedar cópias.
// Antes de incluir um vídeo, confira em youtube.com/oembed?url=... que ele aceita incorporação e copie o canal de lá.
// Prefira resumos de 5 a 10 minutos e conteúdo atemporal: nada de notícia datada nem indicação de produto ou corretora.
// A duração precisa ser a real, porque decide a aba do vídeo.

const ch = (channel: string, handle: string) => ({ channel, channelUrl: `https://www.youtube.com/@${handle}` });

const ANBIMA = ch("Anbima", "AnbimaBR");
const B3 = ch("B3", "bolsadobrasil");
const BC = ch("Banco Central do Brasil", "BancoCentralBR");
const IBGE = ch("IBGE", "ibgeoficial");
const SERASA = ch("Serasa Ensina", "serasa");
const ME_POUPE = ch("Me Poupe!", "MePoupe");
const PRIMO_POBRE = ch("Primo Pobre", "PrimoPobre");
const PRIMO_RICO = ch("O Primo Rico", "primorico");
const PRIMATA = ch("O Primo Primata", "OPrimoPrimata");
const MANUAL_EVOLUCAO = ch("Manual da Evolução", "manualdaevolucao");
const MANUAL_MUNDO = ch("Manual do Mundo", "manualdomundo");
const PERINI = ch("Bruno Perini - Você MAIS Rico", "brunoperini");
const FIAUX = ch("Luciana Fiaux | dominesuasfinancas", "lucianafiauxdomine");
const BONA = ch("André Bona", "andrebona");
const TIAGO_REIS = ch("Tiago Reis", "TiagoReisYT");
const CERBASI = ch("Gustavo Cerbasi", "GustavocerbasiBr");
const SEJA_MELHOR = ch("SejaUmaPessoaMelhor", "sejaumapessoamelhor");
const BTG = ch("BTG Pactual", "btgpactual");
const C6 = ch("C6 Bank", "C6BankOficial");
const SUNO = ch("Suno", "GrupoSuno");
const RICO = ch("Rico", "Ricocomvc");
const T2 = ch("T2 Educação", "T2educacao");
const INFOMONEY = ch("InfoMoney", "infomoney");
const APP_RENDA_FIXA = ch("App Renda Fixa", "AppRendaFixa");
const SARDINHA = ch("Investidor Sardinha l Raul Sena", "investidorsardinha");
const JOVENS_NA_BOLSA = ch("Jovens na Bolsa | Caroline Francisco", "jovensnabolsa");

export const TRACKS: Track[] = [
  {
    id: "comece",
    title: "Comece por aqui",
    subtitle: "O básico para dar o primeiro passo",
    icon: GraduationCap,
    videos: [
      { title: "O que saber antes de começar a investir", description: "Os conceitos que evitam os erros mais comuns de quem está começando.", youtubeId: "NMTmXh4855c", duration: "8:10", ...PRIMO_RICO },
      { title: "Renda fixa e renda variável: qual a diferença?", description: "Os dois grandes grupos de investimento em pouco mais de 2 minutos.", youtubeId: "_2ofTSJX13Y", duration: "2:16", ...B3 },
      { title: "Como funcionam os juros compostos", description: "Por que o tempo é o maior aliado de quem investe.", youtubeId: "SpyWH9U15Ek", duration: "7:32", ...SARDINHA },
      { title: "Descubra o seu perfil de investidor", description: "Conservador, moderado ou arrojado: o que muda na hora de escolher.", youtubeId: "8V71ilZWkVI", duration: "5:29", ...SUNO },
      { title: "Diversificação de investimentos", description: "Por que não colocar todos os ovos na mesma cesta.", youtubeId: "MvQCrfqMC5c", duration: "6:46", ...BONA },
      { title: "O que é uma corretora e como ela funciona", description: "O papel da corretora entre você e os investimentos.", youtubeId: "fCbjTTqjrUc", duration: "4:55", ...ch("Universidade Financeira", "univfinanceira") },
      { title: "Poupança ou CDB a 100% do CDI?", description: "A comparação de rendimento para o dinheiro que precisa de resgate rápido.", youtubeId: "JlB2MOuheEg", duration: "6:57", ...BONA },
      { title: "Os 3 maiores erros do investidor iniciante", description: "O que evitar nos primeiros meses investindo.", youtubeId: "15-Y6LZ4bPw", duration: "7:04", ...TIAGO_REIS },
      { title: "Como definir objetivos financeiros", description: "Transformar sonhos em metas com valor e prazo.", youtubeId: "CPeQs7CAaZQ", duration: "9:20", ...MANUAL_EVOLUCAO },
      { title: "Dá para investir todo mês no mesmo lugar?", description: "Como funcionam os aportes mensais no CDB, na LCI e no Tesouro Direto.", youtubeId: "Dz-PmIONG6U", duration: "8:57", ...PRIMO_POBRE },
      { title: "Os 8 passos para a independência financeira", description: "O caminho do primeiro orçamento até viver de renda.", youtubeId: "I3PWmziav6E", duration: "7:46", ...SEJA_MELHOR },
      { title: "Como investir com pouco dinheiro", description: "Por onde começar quando o valor disponível é pequeno.", youtubeId: "qBgK1tRAPzA", duration: "9:18", ...PRIMO_RICO },
      { title: "Aula completa para quem não sabe por onde começar a investir", description: "Do zero: reserva, renda fixa, renda variável e a ordem certa para começar.", youtubeId: "Q6x0xnI0uCg", duration: "20:21", ...PRIMO_POBRE },
      { title: "Guia básico para começar a investir com pouco dinheiro", description: "O caminho para sair da poupança mesmo com valores pequenos.", youtubeId: "JtDrb2BPBf4", duration: "10:08", ...ME_POUPE },
      { title: "Como montar uma carteira de investimentos para iniciantes", description: "Diversificação na prática: quanto colocar em cada tipo de investimento.", youtubeId: "eMDgWLWOX84", duration: "24:08", ...PRIMO_RICO },
    ],
  },
  {
    id: "organize",
    title: "Organize seu dinheiro",
    subtitle: "Orçamento, economia e reserva antes de investir",
    icon: Wallet,
    videos: [
      { title: "Educação financeira para iniciantes: o que é e como começar", description: "Pilares básicos: receitas, despesas, reserva e uso consciente do crédito.", youtubeId: "7NNsg7N6__Q", duration: "3:51", ...ch("Alfa | Safra Financeira", "AlfaConsignado") },
      { title: "O que é educação financeira", description: "Uma introdução ilustrada sobre como usar melhor o dinheiro.", youtubeId: "CB5zuxQl5ro", duration: "9:13", ...MANUAL_EVOLUCAO },
      { title: "Como construir um orçamento inteligente", description: "Os passos para saber quanto entra, quanto sai e quanto sobra.", youtubeId: "UxKLoTbskyM", duration: "4:46", ...CERBASI },
      { title: "A regra mais simples para gerenciar seu dinheiro", description: "Um jeito fácil de dividir a renda entre gastos, lazer e investimentos.", youtubeId: "6jPetoI0PLY", duration: "8:09", ...ch("Breno Perrucho - Jovens de Negócios", "jovensdenegocios") },
      { title: "Regra 50/30/20 e outras dicas para sobrar dinheiro", description: "Necessidades, desejos e investimentos em proporções simples.", youtubeId: "gs5sIpCZ1K8", duration: "4:42", ...BTG },
      { title: "Como administrar e organizar o dinheiro", description: "Métodos tirados dos principais livros de finanças pessoais.", youtubeId: "V7z5bC4GOQI", duration: "9:20", ...MANUAL_EVOLUCAO },
      { title: "Controle financeiro pessoal no caderno", description: "Como anotar os gastos sem planilha nem aplicativo.", youtubeId: "vSalOkoX9G8", duration: "5:06", ...ch("Ju Oliveira Finanças", "juoliveirafinancas") },
      { title: "Como economizar mudando a mentalidade", description: "Hábitos que fazem o dinheiro durar até o fim do mês.", youtubeId: "bnMIu5e3H2Q", duration: "5:52", ...SEJA_MELHOR },
      { title: "Uma dica para quem não consegue economizar", description: "Um método prático para começar a poupar todo mês.", youtubeId: "5URGPNVLcT0", duration: "6:17", ...PRIMO_POBRE },
      { title: "Como economizar ganhando pouco", description: "As lições do livro O Homem Mais Rico da Babilônia.", youtubeId: "3OjcYFEhlrQ", duration: "6:09", ...MANUAL_EVOLUCAO },
      { title: "Educação financeira para adolescentes", description: "Conceitos de dinheiro explicados para quem está começando a vida.", youtubeId: "uiUp3DpU8pI", duration: "5:47", ...ch("Moneytoons", "Moneytoons-fi7pq") },
      { title: "Tudo sobre reserva de emergência", description: "Para que serve, quanto guardar e quando usar.", youtubeId: "shfYMvEXqm4", duration: "6:55", ...ME_POUPE },
      { title: "Quanto ter na reserva de emergência", description: "Uma conta simples para saber o tamanho certo da sua reserva.", youtubeId: "RBpvCwvshnc", duration: "6:38", ...PRIMO_POBRE },
      { title: "Melhor lugar para a reserva de emergência", description: "Segurança e resgate rápido: onde deixar o dinheiro guardado.", youtubeId: "m9tKdU1Vh-g", duration: "8:47", ...PRIMO_POBRE },
      { title: "Orçamento familiar de forma simples", description: "Como montar um orçamento e comparar o planejado com o realizado.", youtubeId: "_LetMq26HJU", duration: "10:10", ...ch("Taí Souza", "Taisouzaaaa") },
      { title: "Onde investir a reserva de emergência", description: "Tesouro Selic, CDB de liquidez diária ou fundo DI: qual rende mais.", youtubeId: "HgubixK-zbI", duration: "19:54", ...PERINI },
      { title: "Como formar a reserva de emergência em 3 fases", description: "Do primeiro valor guardado até a reserva completa, com exemplos ilustrados.", youtubeId: "Dnl6Y4jghbo", duration: "12:26", ...MANUAL_EVOLUCAO },
    ],
  },
  {
    id: "dividas",
    title: "Dívidas e crédito",
    subtitle: "Cartão, cheque especial, financiamento e como sair do vermelho",
    icon: CreditCard,
    videos: [
      { title: "Crédito rotativo: o que é e como funciona", description: "O que acontece quando a fatura do cartão não é paga inteira.", youtubeId: "MKNq57ERk1k", duration: "4:59", ...ch("Brayan Souza", "brayansouza6209") },
      { title: "Juros do cartão de crédito: como calcular", description: "Quanto a dívida do cartão cresce mês a mês.", youtubeId: "aMOb6GC5B1U", duration: "3:12", ...ch("Inter", "interbr") },
      { title: "Cheque especial: como funciona e quanto custa", description: "Os juros do limite da conta e quando ele vira armadilha.", youtubeId: "ByiNh1qmM14", duration: "5:30", ...SERASA },
      { title: "Custo Efetivo Total: o que é", description: "O número que mostra o preço real de um empréstimo, além dos juros.", youtubeId: "A7LzmWagNrs", duration: "4:40", ...SERASA },
      { title: "Financiamento: tabela SAC ou Price?", description: "A diferença entre as parcelas e o total pago em cada sistema.", youtubeId: "3Q28IqAsaIU", duration: "6:09", ...ch("100 Conto", "100Conto") },
      { title: "Empréstimo consignado: o que é", description: "Como funciona o desconto direto no salário ou na aposentadoria.", youtubeId: "cZrAedVDTrE", duration: "4:43", ...APP_RENDA_FIXA },
      { title: "Consórcio vale a pena?", description: "Como funciona e quando compensa mais do que financiar ou investir.", youtubeId: "iSzeXoFuxJk", duration: "3:23", ...ch("Irmãos Dias Podcast", "irmaosdiaspodcast") },
      { title: "Análise de crédito: como funciona", description: "O que os bancos olham antes de liberar um empréstimo ou cartão.", youtubeId: "P0yP0M9st2s", duration: "5:09", ...SERASA },
      { title: "Como sair das dívidas", description: "Por onde começar quando as contas não fecham.", youtubeId: "CX_DQKthhig", duration: "6:29", ...CERBASI },
      { title: "Dicas para dar adeus às dívidas", description: "Negociação, prioridades e como não voltar a se endividar.", youtubeId: "Lt_4QDjNDxc", duration: "9:03", ...ME_POUPE },
      { title: "Cartão de crédito sem ser refém da fatura", description: "Seis cuidados para usar o cartão a seu favor.", youtubeId: "GtR7O0vApK4", duration: "9:44", ...ME_POUPE },
      { title: "Comprar à vista ou parcelado?", description: "Quando o desconto à vista vale mais que deixar o dinheiro rendendo.", youtubeId: "QQ4hY6Iup_A", duration: "8:02", ...PRIMATA },
      { title: "Quando comprar à vista e quando parcelar", description: "Uma regra prática para decidir sem se enrolar.", youtubeId: "2HhddMqscd0", duration: "5:41", ...CERBASI },
      { title: "Como sair das dívidas com um plano realista", description: "Cortes, renegociação e a ordem certa para pagar o que deve.", youtubeId: "8zj0GJKTWwE", duration: "13:07", ...PRIMO_RICO },
      { title: "Aula sobre cartão de crédito", description: "Fatura, limite, rotativo e como usar o cartão sem cair em dívida.", youtubeId: "SFVMh69Roas", duration: "17:13", ...PRIMO_POBRE },
    ],
  },
  {
    id: "juros",
    title: "Selic, CDI e inflação",
    subtitle: "As taxas e índices que movem todos os investimentos",
    icon: Percent,
    videos: [
      { title: "O que é a taxa Selic", description: "A explicação oficial do Banco Central sobre a taxa básica de juros.", youtubeId: "00DbSCX96wU", duration: "4:22", ...BC },
      { title: "O que é a taxa Selic e como ela funciona", description: "Como a Selic afeta o crédito, a inflação e o seu bolso.", youtubeId: "WBNkhIaY7gc", duration: "4:32", ...ch("Nexo Jornal", "NexojornalBr") },
      { title: "Como a Selic afeta a economia", description: "Por que a taxa sobe ou desce e o efeito nos investimentos.", youtubeId: "pOLfcwCX30k", duration: "7:19", ...INFOMONEY },
      { title: "O que é a taxa CDI", description: "A taxa que serve de referência para CDB, LCI, LCA e fundos.", youtubeId: "6hDHvr-8Ofo", duration: "5:11", ...ANBIMA },
      { title: "Selic e CDI: entenda e pare de perder dinheiro", description: "A diferença entre as duas taxas e o que significa render 100% do CDI.", youtubeId: "R0AQyTIvcvI", duration: "8:24", ...ME_POUPE },
      { title: "Juros simples e juros compostos", description: "A diferença entre os dois cálculos, com exemplos.", youtubeId: "Uth75BB0ASU", duration: "5:13", ...ch("Descomplica", "descomplica") },
      { title: "Taxa de juros real e nominal", description: "Quanto o dinheiro rende de verdade depois de descontar a inflação.", youtubeId: "d8A0ra-rKiY", duration: "5:30", ...ch("Economia para Iniciantes – com Gabriel Braga", "econotime") },
      { title: "O que é inflação", description: "Por que os preços sobem e como isso corrói o seu dinheiro parado.", youtubeId: "GaE_ZiQ3N50", duration: "8:02", ...ANBIMA },
      { title: "Inflação em menos de 3 minutos", description: "O Banco Central explica o que é inflação.", youtubeId: "l7znThOnfOM", duration: "2:51", ...BC },
      { title: "IPCA e INPC: como a inflação é medida", description: "O IBGE mostra como calcula o índice oficial de inflação do país.", youtubeId: "JVcDZOlIMBk", duration: "5:39", ...IBGE },
      { title: "IPCA, INPC e IGP-M: os índices de inflação", description: "O que cada índice mede e onde cada um aparece no dia a dia.", youtubeId: "s0HNfduCidI", duration: "9:07", ...ch("InvestNews BR", "InvestNewsBR") },
      { title: "Diferença entre IGP-M e IPCA", description: "Por que o aluguel e os investimentos usam índices diferentes.", youtubeId: "o6oZLTouuTQ", duration: "3:52", ...ch("Nord Research", "nordinvestimentos") },
      { title: "O que é a política monetária", description: "Como o Banco Central usa os juros para controlar a inflação.", youtubeId: "0iUuaJr9EdI", duration: "3:24", ...BC },
      { title: "Qual é o papel do Banco Central", description: "As funções do Banco Central e por que ele importa para o seu dinheiro.", youtubeId: "LPGPpj_ZYtI", duration: "3:21", ...BC },
      { title: "PIB: o que é e como é calculado", description: "O IBGE explica o indicador que mede o tamanho da economia.", youtubeId: "lVjPv33T0hk", duration: "4:47", ...IBGE },
      { title: "Aula fácil sobre a taxa Selic", description: "Quem define a Selic, por que ela muda e como chega ao seu bolso.", youtubeId: "GgBfeGdGZdM", duration: "10:42", ...PRIMO_POBRE },
      { title: "IPCA e o poder destruidor da inflação", description: "Como o índice oficial é medido e quanto a inflação corrói o dinheiro parado.", youtubeId: "LLANnZaSdQ0", duration: "10:54", ...ch("Clube do Valor", "ClubedoValor") },
      { title: "Quanto rendem CDI, Selic e IPCA em dinheiro", description: "Como transformar as porcentagens dos investimentos em reais, passo a passo.", youtubeId: "dss4yx6HVl0", duration: "16:54", ...PRIMO_POBRE },
      { title: "Como funciona a economia", description: "Juros, inflação, crédito e crescimento ligados em uma explicação só.", youtubeId: "EA2aFfOXPA8", duration: "14:39", ...PRIMO_RICO },
    ],
  },
  {
    id: "renda-fixa",
    title: "Renda fixa",
    subtitle: "CDB, LCI, LCA, Tesouro Direto, debêntures e FGC",
    icon: Landmark,
    videos: [
      { title: "O que é renda fixa", description: "Como funciona emprestar dinheiro em troca de juros.", youtubeId: "NER6scqNqAc", duration: "5:52", ...ANBIMA },
      { title: "CDB explicado de forma simples", description: "O que é, quanto rende e por que tem a garantia do FGC.", youtubeId: "qskeCTIsias", duration: "3:08", ...PRIMATA },
      { title: "Diferença entre CDB e CDI", description: "Um é investimento, o outro é taxa: entenda de uma vez.", youtubeId: "pQg47rASBD4", duration: "6:10", ...FIAUX },
      { title: "Tudo sobre renda fixa: LCI, LCA, CDB e LC", description: "As letras de crédito isentas de imposto e como se comparam ao CDB.", youtubeId: "ysm9ZJ6O67w", duration: "9:34", ...ME_POUPE },
      { title: "O que é Letra de Câmbio", description: "O título das financeiras, que também tem a garantia do FGC.", youtubeId: "3RcpnVTr2O4", duration: "3:20", ...RICO },
      { title: "O que é o FGC e quais investimentos ele protege", description: "A garantia do Fundo Garantidor de Créditos, os limites e o que fica de fora.", youtubeId: "6bc5vM_XwfA", duration: "4:57", ...PRIMO_POBRE },
      { title: "Liquidez diária ou no vencimento?", description: "A diferença entre poder resgatar a qualquer dia e esperar o prazo.", youtubeId: "BUXrtS10veI", duration: "4:38", ...APP_RENDA_FIXA },
      { title: "Carência e vencimento no CDB", description: "Até quando o dinheiro fica preso e quando o título termina.", youtubeId: "X7pkec-hE-Q", duration: "4:28", ...BONA },
      { title: "Prefixado ou pós-fixado: qual escolher?", description: "Comparação entre CDB, Tesouro e LCI nos dois formatos.", youtubeId: "Pe8o49H13Iw", duration: "9:55", ...PRIMO_POBRE },
      { title: "O que é o Tesouro Direto", description: "Como emprestar dinheiro ao governo e os tipos de título.", youtubeId: "K4sq_lKV8H8", duration: "4:52", ...ANBIMA },
      { title: "Tesouro Selic, Prefixado ou IPCA+?", description: "Para que serve cada título do Tesouro Direto.", youtubeId: "lv1KnBZHQJw", duration: "6:00", ...C6 },
      { title: "Como funciona o Tesouro Prefixado", description: "A taxa combinada na compra e o que acontece no vencimento.", youtubeId: "e5CmRbXFNHI", duration: "6:58", ...ch("De Matos Ensina", "DeMatos") },
      { title: "Tesouro IPCA+: o que é e como funciona", description: "O título que protege o dinheiro da inflação no longo prazo.", youtubeId: "keLTQioi0WE", duration: "8:48", ...ch("Excelência no Bolso", "excel%C3%AAncianobolso") },
      { title: "Tesouro Renda+ para a aposentadoria", description: "O título que paga uma renda mensal depois de aposentado.", youtubeId: "Y1Z7PRvXngE", duration: "6:45", ...ch("Nath Finanças", "nathfinancas") },
      { title: "Renda fixa é fixa mesmo?", description: "Marcação a mercado: por que o valor do título oscila antes do vencimento.", youtubeId: "XZlntkdovfc", duration: "4:37", ...ANBIMA },
      { title: "O que são debêntures", description: "Quando você empresta dinheiro diretamente para uma empresa.", youtubeId: "shj-8dVzU9s", duration: "4:53", ...ANBIMA },
      { title: "CRI e CRA explicados de forma simples", description: "Os títulos ligados a imóveis e ao agronegócio, isentos de imposto.", youtubeId: "hBiDbZUw-Wo", duration: "3:06", ...PRIMATA },
      { title: "Fundos de renda fixa e fundos DI", description: "Como funcionam e o que observar antes de investir.", youtubeId: "uhhpYwp2kL0", duration: "8:55", ...PRIMO_RICO },
      { title: "Tesouro Selic ou fundo DI?", description: "Rentabilidade, taxas e liquidez lado a lado.", youtubeId: "J6eGgajrVpM", duration: "8:15", ...BONA },
      { title: "Como calcular o rendimento da poupança", description: "A regra de rendimento da poupança, passo a passo.", youtubeId: "nXYnifOxSYA", duration: "4:14", ...ch("Prof. Gil Rodrigues", "ProfGilRodrigues") },
      { title: "Tesouro, CDB, LCI, LCA ou CRI: como comparar", description: "Como colocar os títulos lado a lado considerando o imposto.", youtubeId: "xjTvtxQAmiM", duration: "9:49", ...SARDINHA },
      { title: "Guia da renda fixa: CDB, CDI, Selic, LCI e LCA", description: "Entenda as siglas que aparecem nos investimentos de renda fixa.", youtubeId: "LLG2RrpMwkA", duration: "17:54", ...PERINI },
      { title: "O que é CDB e quais são os riscos da renda fixa", description: "Como o CDB funciona, quanto rende e o que pode dar errado.", youtubeId: "zkcpFhsgOaY", duration: "15:50", ...MANUAL_EVOLUCAO },
      { title: "O que são LCI e LCA", description: "Os títulos isentos de imposto de renda e quando valem mais que o CDB.", youtubeId: "pW6IHuR5Ugw", duration: "15:24", ...MANUAL_EVOLUCAO },
      { title: "Tesouro Direto: guia completo para iniciantes", description: "Como funciona o Tesouro e por onde começar com segurança.", youtubeId: "bolG9pgxEAU", duration: "18:08", ...ME_POUPE },
      { title: "Tesouro Selic e Tesouro IPCA+ para iniciantes", description: "Para que serve cada título e qual escolher para cada objetivo.", youtubeId: "Dugg9Eb_mhw", duration: "15:54", ...MANUAL_EVOLUCAO },
      { title: "Tesouro Selic: passo a passo para investir", description: "Ideal para reserva de emergência, com liquidez e baixo risco.", youtubeId: "9q8fWrCR2ZI", duration: "10:07", ...FIAUX },
    ],
  },
  {
    id: "taxas",
    title: "Taxas e impostos",
    subtitle: "O que é descontado do seu rendimento",
    icon: Receipt,
    videos: [
      { title: "Imposto de renda e IOF nos investimentos", description: "A tabela regressiva, o IOF nos primeiros 30 dias e o que é isento.", youtubeId: "U2xOmP9w9t8", duration: "6:03", ...ch("Douglas Gambim", "DouglasGambim") },
      { title: "O que é o IOF", description: "O imposto sobre operações financeiras e quando ele é cobrado.", youtubeId: "5r7kM6ZkYb8", duration: "3:27", ...ch("Cooperativas Ailos", "SistemaAilos") },
      { title: "Come-cotas: o que é e como funciona", description: "O imposto antecipado que os fundos cobram em maio e novembro.", youtubeId: "e0cIV-BKK8g", duration: "6:36", ...T2 },
      { title: "Taxas e impostos nos fundos de investimento", description: "Taxa de administração, come-cotas e o que sobra para você.", youtubeId: "kjv8XRLDx3U", duration: "7:35", ...ch("XP", "XP_Oficial") },
      { title: "Taxa de administração e taxa de performance", description: "Quanto os fundos cobram e como isso pesa no resultado ao longo dos anos.", youtubeId: "xBg1GwdYkl0", duration: "7:55", ...TIAGO_REIS },
      { title: "Taxa de custódia: o que é e por que é cobrada", description: "A taxa da guarda dos seus títulos, como no Tesouro Direto.", youtubeId: "Kn5terf8wa8", duration: "2:41", ...ch("Mais Retorno", "MaisRetorno") },
      { title: "Isenção de 20 mil por mês na venda de ações", description: "Quando a venda de ações fica livre de imposto e quando não fica.", youtubeId: "sTWqJQ5ik44", duration: "8:10", ...ch("Contadora da Bolsa", "ContadoradaBolsa") },
      { title: "DARF: o que é, quando emitir e como pagar", description: "A guia para pagar o imposto sobre lucros na bolsa.", youtubeId: "NTpxyw1FduI", duration: "8:38", ...ch("Investindo com Lacôrte", "InvestindocomLac%C3%B4rte") },
      { title: "Como declarar investimentos no imposto de renda", description: "Onde informar cada investimento na declaração anual.", youtubeId: "_l0Ib5OgTWo", duration: "5:46", ...ch("Bruno OM", "canalbrunoom") },
      { title: "Impostos na renda fixa: IOF e imposto de renda", description: "Aula completa sobre como cada imposto é calculado e cobrado.", youtubeId: "LZp0FjamLRo", duration: "14:17", ...PRIMO_POBRE },
      { title: "Imposto de renda para investidores", description: "O que é tributado, o que é isento e como cada investimento entra na declaração.", youtubeId: "OyMsizSuH_E", duration: "18:02", ...JOVENS_NA_BOLSA },
    ],
  },
  {
    id: "renda-variavel",
    title: "Ações, fundos e ETFs",
    subtitle: "Os primeiros passos na renda variável",
    icon: TrendingUp,
    videos: [
      { title: "O que é renda variável", description: "Por que o retorno não é garantido e como lidar com o risco.", youtubeId: "O9_7uPt3NMI", duration: "4:38", ...ANBIMA },
      { title: "Como funciona a bolsa de valores", description: "O que é uma ação e por que o preço sobe e desce, de forma visual.", youtubeId: "zE3MhwFUpnA", duration: "4:44", ...MANUAL_MUNDO },
      { title: "Como funciona o mercado de ações em 5 minutos", description: "Empresas, investidores e a bolsa explicados de forma simples.", youtubeId: "QYNrr3Di-D0", duration: "4:53", ...ch("EconoFácil", "_EconoFacil") },
      { title: "O que é o Ibovespa", description: "O principal índice da bolsa brasileira e o que ele mostra.", youtubeId: "FDwictNaJFs", duration: "2:29", ...B3 },
      { title: "Ações ordinárias e preferenciais", description: "A diferença entre ações com direito a voto e com preferência nos dividendos.", youtubeId: "TIvuH0X4D_k", duration: "3:03", ...ch("AGF", "agf-oficial") },
      { title: "Como funciona o livro de ofertas", description: "Como as ordens de compra e venda se encontram no home broker.", youtubeId: "_oVkvTOQvC0", duration: "9:48", ...PERINI },
      { title: "Volatilidade: o que é e como lidar", description: "Por que os preços oscilam e como usar isso a seu favor.", youtubeId: "dSXY8k1_zGo", duration: "6:35", ...RICO },
      { title: "Quando os dividendos são pagos", description: "Data com, data ex e o dia em que o dinheiro cai na conta.", youtubeId: "SYWeYDKybdI", duration: "4:00", ...BONA },
      { title: "O que é dividend yield e como calcular", description: "O indicador que mostra quanto uma ação paga em proventos.", youtubeId: "LpBT4OUuSVo", duration: "3:44", ...INFOMONEY },
      { title: "O que são juros sobre capital próprio", description: "A outra forma de as empresas distribuírem lucro aos acionistas.", youtubeId: "prwYJrxwKIg", duration: "2:33", ...ch("Genial Investimentos", "genialinvestimentos") },
      { title: "Indicador preço sobre lucro", description: "Como o preço sobre lucro ajuda a saber se uma ação está cara ou barata.", youtubeId: "mm6yznMWZAM", duration: "8:02", ...TIAGO_REIS },
      { title: "Preço sobre lucro, preço sobre valor patrimonial e retorno sobre patrimônio", description: "Os indicadores fundamentalistas mais usados, explicados.", youtubeId: "Op1F3sIS6bc", duration: "8:38", ...ch("Canal do Will", "CanaldoWillbaroukh") },
      { title: "IPO e OPA: o que são", description: "Quando uma empresa abre ou fecha o capital na bolsa.", youtubeId: "m1UxxeQPWzU", duration: "6:26", ...PERINI },
      { title: "O que são small caps", description: "As empresas menores da bolsa, com mais potencial e mais risco.", youtubeId: "QqgUGMiM82k", duration: "2:48", ...SUNO },
      { title: "O que são BDRs", description: "Como investir em empresas estrangeiras pela bolsa brasileira.", youtubeId: "IM8lxKHFpdE", duration: "5:50", ...ch("Papo de Bolsa", "PapodeBolsa") },
      { title: "O que são ETFs", description: "Fundos que seguem um índice e permitem diversificar com pouco dinheiro.", youtubeId: "8E7reA8gJcQ", duration: "2:49", ...B3 },
      { title: "ETF para iniciantes: o que é e como investir", description: "Como comprar um ETF e por que ele é uma porta de entrada na bolsa.", youtubeId: "iEIBMnrpnWk", duration: "5:30", ...ME_POUPE },
      { title: "O que são fundos imobiliários", description: "Como ganhar com imóveis sem comprar um imóvel inteiro.", youtubeId: "fc8T4qx34W4", duration: "7:45", ...ME_POUPE },
      { title: "Fundos imobiliários de tijolo e de papel", description: "A diferença entre fundos que têm imóveis e fundos que têm títulos.", youtubeId: "_mOxg2Ay6CM", duration: "3:43", ...ch("Sávio Investe", "savioinveste") },
      { title: "Fundos de investimento", description: "Como funcionam, quem cuida do dinheiro e os principais tipos.", youtubeId: "CDkSJv-s1aY", duration: "8:43", ...ANBIMA },
      { title: "Fundos multimercado", description: "Os fundos que misturam renda fixa, ações, câmbio e outros mercados.", youtubeId: "YzNLufo4Iw0", duration: "3:39", ...ANBIMA },
      { title: "Guia do ETF: o que são e como escolher", description: "Fundos que seguem um índice e dicas para escolher na B3.", youtubeId: "z2_3yV3nqgY", duration: "10:40", ...ch("Professor Mira", "ProfessorMira") },
      { title: "10 anos investindo em FIIs: o que aprendi", description: "Lições práticas sobre carteira, vacância e tese de longo prazo.", youtubeId: "xOWMQloIlGM", duration: "21:49", ...ch("Finclass - Aprenda a investir do zero", "Finclass") },
      { title: "Como investir em ações: aula para iniciantes", description: "O que é uma ação, como comprar e o que analisar antes de escolher.", youtubeId: "qQ1f8o_zF-o", duration: "11:28", ...JOVENS_NA_BOLSA },
      { title: "Aula sobre fundos imobiliários (FIIs)", description: "Tijolo, papel e o essencial para começar.", youtubeId: "xQOWiQMzq3M", duration: "1:05:34", ...ch("POP SHOW TV", "pobreshow") },
    ],
  },
  {
    id: "previdencia",
    title: "Aposentadoria e previdência",
    subtitle: "Planejar o futuro e entender a previdência privada",
    icon: PiggyBank,
    videos: [
      { title: "Planeje sua aposentadoria", description: "Quanto juntar e por que começar cedo faz tanta diferença.", youtubeId: "1qYAd3i2W6M", duration: "4:46", ...CERBASI },
      { title: "Como construir um plano seguro para a aposentadoria", description: "Os passos para não depender só do INSS.", youtubeId: "RbPUxJJMVIY", duration: "6:14", ...CERBASI },
      { title: "Previdência privada explicada de forma simples", description: "PGBL ou VGBL: qual combina com a sua declaração de imposto.", youtubeId: "fdcBQkyeBi4", duration: "3:14", ...PRIMATA },
      { title: "PGBL e VGBL descomplicados", description: "A diferença entre os dois planos e para quem cada um serve.", youtubeId: "lUndwv8MZvo", duration: "4:30", ...C6 },
      { title: "Previdência VGBL: o que é e como funciona", description: "Como o plano é tributado e quando faz sentido.", youtubeId: "nbXpvfrp8hU", duration: "5:40", ...BTG },
      { title: "Tabela regressiva ou progressiva na previdência?", description: "Como escolher o regime de imposto do seu plano.", youtubeId: "x2Vi5DudYIg", duration: "8:33", ...ch("Grão Investimentos", "Graoinvestimentos") },
      { title: "VGBL e PGBL: aula sobre previdência privada", description: "Como cada plano é tributado, as tabelas de imposto e para quem cada um serve.", youtubeId: "hgT2QZBXTKM", duration: "11:59", ...T2 },
      { title: "Como se aposentar em 15 anos", description: "Quanto investir por mês e quanto juntar para viver de renda.", youtubeId: "GuunpX6hIVg", duration: "11:37", ...SARDINHA },
    ],
  },
  {
    id: "exterior",
    title: "Exterior e criptomoedas",
    subtitle: "Dólar, investimentos fora do Brasil e os riscos das criptomoedas",
    icon: Globe,
    videos: [
      { title: "Como investir nos Estados Unidos de forma simples", description: "Os caminhos para ter investimentos em dólar.", youtubeId: "nMfkXIYzdME", duration: "6:15", ...ch("Os Economistas Podcast", "oseconomistas") },
      { title: "Renda fixa no exterior, em dólar e euro", description: "Como proteger parte do patrimônio em outras moedas.", youtubeId: "_-Bv_bGkf_g", duration: "9:55", ...PRIMO_POBRE },
      { title: "Bitcoin e blockchain: como funcionam", description: "Por que não dá para copiar e colar um bitcoin.", youtubeId: "0Mt16eeCv78", duration: "8:41", ...MANUAL_MUNDO },
      { title: "Quais são os riscos do bitcoin", description: "Volatilidade, golpes e cuidados antes de comprar criptomoedas.", youtubeId: "JZhT6Ll23Cs", duration: "3:24", ...ch("BTC em Portugues", "BTCemPortugues") },
      { title: "O que são stablecoins", description: "As criptomoedas atreladas ao dólar e como elas funcionam.", youtubeId: "PRQFgtFZtGg", duration: "3:06", ...BTG },
      { title: "Taxa de câmbio: como funciona", description: "Por que o dólar sobe e desce e como isso afeta preços e investimentos.", youtubeId: "ygjjcwZLm_4", duration: "11:52", ...ch("Gabriela Mosmann", "gabimosmann") },
      { title: "Bitcoin para leigos", description: "O básico sobre o que é o bitcoin, como funciona e quais são os riscos.", youtubeId: "HpfCXch-pno", duration: "16:27", ...ch("Breno Perrucho - Jovens de Negócios", "jovensdenegocios") },
    ],
  },
  {
    id: "protecao",
    title: "Proteja seu dinheiro",
    subtitle: "Como reconhecer golpes, pirâmides e promessas falsas",
    icon: ShieldAlert,
    videos: [
      { title: "Como reconhecer fraudes em investimentos", description: "Os sinais de pirâmide e de promessas de ganho fácil.", youtubeId: "HQ6OnZZOvhE", duration: "7:22", ...ANBIMA },
      { title: "Pirâmide financeira explicada de forma simples", description: "Como o esquema funciona e por que sempre quebra.", youtubeId: "_sck44AlejY", duration: "3:18", ...PRIMATA },
      { title: "Como reconhecer pirâmides financeiras", description: "As características que entregam um esquema fraudulento.", youtubeId: "x1WTG89qUp8", duration: "8:04", ...ch("Suno Notícias", "SunoNot%C3%ADcias") },
      { title: "Golpe do falso investimento", description: "Como identificar e evitar ofertas falsas de investimento.", youtubeId: "srIYGAJJ-bs", duration: "3:51", ...C6 },
      { title: "O golpe da falsa corretora", description: "Como funciona o golpe e como conferir se a empresa é autorizada.", youtubeId: "mQk7Nnls4vI", duration: "6:42", ...ch("TV Pajuçara", "tvpajucara") },
      { title: "O que é a CVM e o que ela faz", description: "O órgão que fiscaliza o mercado e onde conferir quem é autorizado.", youtubeId: "Itd1BqAWE2g", duration: "4:45", ...T2 },
      { title: "Fraudes financeiras: como funcionam", description: "Pirâmides, falsas promessas e os sinais de alerta, explicados pela Anbima.", youtubeId: "rR6xfooSKkk", duration: "11:13", ...ANBIMA },
      { title: "Por que as pessoas caem em fraudes financeiras", description: "Os atalhos da mente que os golpistas usam e como se defender.", youtubeId: "zmTmGfS9pK4", duration: "10:07", ...ANBIMA },
    ],
  },
];

export type Kind = "resumos" | "aulas";
export type View = "tema" | "canal";

export type Group = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  channelUrl?: string;
  videos: Video[];
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const ENTRIES = TRACKS.flatMap((track) =>
  track.videos.map((video) => ({
    video,
    track,
    text: fold([video.title, video.description, video.channel, track.title].join(" ")),
  })),
);

/** Todas as palavras da busca precisam aparecer no título, na descrição, no canal ou no tema, sem ligar para acentos. */
function select(kind: Kind, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return ENTRIES.filter((e) => (kind === "resumos") === isQuick(e.video) && words.every((w) => e.text.includes(w)));
}

export const countVideos = (kind: Kind, query = "") => select(kind, query).length;

/**
 * Por tema segue a ordem das trilhas. Por canal, do canal com mais vídeos para o com menos;
 * sem busca, canais com um vídeo só ficam juntos em "Outros canais" para a lista não virar uma fila de grupos de um item.
 */
export function groupVideos(kind: Kind, view: View, query = ""): Group[] {
  const entries = select(kind, query);
  if (view === "tema") {
    return TRACKS.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.subtitle,
      icon: t.icon,
      videos: entries.filter((e) => e.track.id === t.id).map((e) => e.video),
    })).filter((g) => g.videos.length);
  }

  const byChannel = new Map<string, Video[]>();
  for (const { video } of entries) byChannel.set(video.channel, [...(byChannel.get(video.channel) ?? []), video]);
  const sorted = [...byChannel.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "pt-BR"));
  const own = query.trim() ? sorted : sorted.filter(([, vs]) => vs.length > 1);
  const rest = query.trim() ? [] : sorted.filter(([, vs]) => vs.length === 1).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  const groups: Group[] = own.map(([channel, videos]) => ({
    id: `canal-${fold(channel).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    title: channel,
    subtitle: `${videos.length} ${videos.length === 1 ? "vídeo" : "vídeos"} deste canal`,
    icon: Tv,
    channelUrl: videos[0].channelUrl,
    videos,
  }));
  if (rest.length) {
    groups.push({
      id: "outros-canais",
      title: "Outros canais",
      subtitle: `${rest.length} canais com um vídeo cada`,
      icon: Users,
      videos: rest.map(([, [video]]) => video),
    });
  }
  return groups;
}
