/**
 * Regras do cupom de desconto aplicado ao plano do associado. Módulo puro: a
 * mesma conta roda no servidor (parcelas gravadas) e na tela (pré-visualização).
 */
import type { ParcelaGerada } from "@/lib/mensalidades-engine";
import { formatCurrency } from "@/lib/utils";

export interface CupomPlano {
  id: string;
  codigo: string;
  tipoDesconto: "percentual" | "valor_fixo";
  valor: number;
  /** Desconto só nas N primeiras mensalidades; null = em todas. */
  mesesDesconto: number | null;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Valor de uma mensalidade depois do cupom (nunca negativo). */
export function valorComCupom(valor: number, cupom: Pick<CupomPlano, "tipoDesconto" | "valor">): number {
  const desconto =
    cupom.tipoDesconto === "percentual" ? arredondar((valor * Math.min(100, cupom.valor)) / 100) : Math.min(cupom.valor, valor);
  return Math.max(0, arredondar(valor - desconto));
}

/** Se a parcela de número `numeroParcela` recebe o desconto do cupom. */
export function parcelaTemDesconto(numeroParcela: number, cupom: Pick<CupomPlano, "mesesDesconto">): boolean {
  return cupom.mesesDesconto === null || numeroParcela <= cupom.mesesDesconto;
}

export function aplicarCupomNasParcelas(parcelas: ParcelaGerada[], cupom: CupomPlano | null): ParcelaGerada[] {
  if (!cupom) return parcelas;
  return parcelas.map((p) => (parcelaTemDesconto(p.numeroParcela, cupom) ? { ...p, valor: valorComCupom(p.valor, cupom) } : p));
}

/** Texto curto do desconto: "50% nas 3 primeiras mensalidades", "R$ 20,00 em todas as mensalidades". */
export function descreverCupomPlano(cupom: Pick<CupomPlano, "tipoDesconto" | "valor" | "mesesDesconto">): string {
  const desconto = cupom.tipoDesconto === "percentual" ? `${cupom.valor.toLocaleString("pt-BR")}%` : formatCurrency(cupom.valor);
  const onde =
    cupom.mesesDesconto === null
      ? "em todas as mensalidades"
      : cupom.mesesDesconto === 1
        ? "na 1ª mensalidade"
        : `nas ${cupom.mesesDesconto} primeiras mensalidades`;
  return `${desconto} de desconto ${onde}`;
}
