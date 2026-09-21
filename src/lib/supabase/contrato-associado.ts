import { SupabaseClient } from "@supabase/supabase-js";
import { Contrato, Mensalidade, RegraPrimeiraParcela } from "@/types";

type Row = Record<string, unknown>;

function mapContrato(row: Row): Contrato {
  const plano = row.planos as Row | null;
  return {
    id: row.id as string,
    numero: row.numero as string,
    associadoId: row.associado_id as string,
    planoId: (row.plano_id as string) ?? null,
    planoNome: (plano?.nome as string) ?? "—",
    dataContratacao: row.data_contratacao as string,
    dataInicio: row.data_inicio as string,
    dataFim: (row.data_fim as string) ?? null,
    valor: Number(row.valor),
    quantidadeMensalidades: row.quantidade_mensalidades as number,
    regraPrimeiraParcela: (row.regra_primeira_parcela as RegraPrimeiraParcela) ?? "padrao",
    vencimentoNaContratacao: (row.vencimento_na_contratacao as boolean) ?? false,
    status: row.status as Contrato["status"],
  };
}

export async function getContratoAtivo(supabase: SupabaseClient, associadoId: string): Promise<Contrato | null> {
  const { data, error } = await supabase
    .from("contratos")
    .select("*, planos ( nome )")
    .eq("associado_id", associadoId)
    .eq("status", "Ativo")
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapContrato(data as unknown as Row);
}

export async function getMensalidadesDoContrato(supabase: SupabaseClient, contratoId: string): Promise<Mensalidade[]> {
  const { data, error } = await supabase
    .from("mensalidades")
    .select("*")
    .eq("contrato_id", contratoId)
    .order("numero_parcela");

  if (error) throw error;
  return (data as unknown as Row[]).map((row) => ({
    id: row.id as string,
    contratoId: row.contrato_id as string,
    numeroParcela: row.numero_parcela as number,
    totalParcelas: row.total_parcelas as number,
    vencimento: row.vencimento as string,
    valor: Number(row.valor),
    status: row.status as Mensalidade["status"],
    formaPagamento: (row.forma_pagamento as string) ?? undefined,
    pagamentoEm: (row.pago_em as string) ?? undefined,
    gatewayChargeId: (row.gateway_charge_id as string) ?? undefined,
  }));
}
