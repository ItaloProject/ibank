import { HelpTip } from "@/components/ui/help-tip";

export function TipoCaixinhaHelp() {
  return (
    <HelpTip label="tipo de caixinha">
      <strong>Turbo</strong>: conta remunerada com rendimento acima do CDI, geralmente até um limite de saldo.{" "}
      <strong>Emergência</strong>: dinheiro guardado para imprevistos, com resgate imediato.{" "}
      <strong>Renda fixa / Investimentos</strong>: CDB, LCI, Tesouro e outras aplicações com taxa contratada.
      O tipo define onde a caixinha aparece e como o app calcula o rendimento.
    </HelpTip>
  );
}

export function CdiHelp() {
  return (
    <HelpTip label="% do CDI">
      Quanto a conta rende em relação ao CDI, a taxa de referência dos bancos. Ex.: 115% do CDI rende 15% a mais que o CDI.
      Se deixar em branco, o app usa 115%.
    </HelpTip>
  );
}

export function TetoHelp() {
  return (
    <HelpTip label="teto de rendimento">
      Saldo máximo que recebe o rendimento Turbo. Ex.: 115% do CDI até R$ 5.000: o que passar de R$ 5.000 rende só 100% do CDI.
      Confira no app do banco se a sua conta tem esse limite. Se não tiver, deixe em branco e todo o saldo rende o % informado.
    </HelpTip>
  );
}

export function SaldoEmContaHelp() {
  return (
    <HelpTip label="saldo em conta">
      Dinheiro disponível na corretora ou conta, ainda não aplicado. É dele que saem os aportes e compras feitos no MUVO Live,
      e é para ele que voltam retiradas e vendas.
    </HelpTip>
  );
}
