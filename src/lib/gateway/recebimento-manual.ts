import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentGateway } from "@/lib/gateway";
import { hojeBR } from "@/lib/datas-br";

/** Status da Asaas em que a cobrança já está quitada — nada a fazer. */
const QUITADA = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "DELETED", "REFUNDED"]);

/**
 * Parcela paga por fora da Asaas (baixa manual no balcão) com cobrança ainda
 * aberta lá: marca a cobrança como recebida em dinheiro, para a Asaas parar de
 * cobrar o associado. Não mexe se o pagamento veio da própria cobrança (há
 * lançamento com `referencia` = id da cobrança) ou se ela já está quitada.
 * Nunca lança: devolve o motivo da falha para quem chamou avisar a equipe.
 */
export async function quitarCobrancaDeBaixaManual(
  supabase: SupabaseClient,
  mensalidade: { id: string; valor: number; gatewayChargeId: string | null; asaasStatus: string | null },
): Promise<string | null> {
  const chargeId = mensalidade.gatewayChargeId;
  if (!chargeId || (mensalidade.asaasStatus && QUITADA.has(mensalidade.asaasStatus))) return null;

  const { count: pagoPelaCobranca } = await supabase
    .from("pagamentos")
    .select("id", { count: "exact", head: true })
    .eq("mensalidade_id", mensalidade.id)
    .eq("referencia", chargeId);
  if (pagoPelaCobranca) return null;

  try {
    await paymentGateway.informarRecebimentoManual(chargeId, { valor: mensalidade.valor, data: hojeBR() });
  } catch (e) {
    return e instanceof Error ? e.message : "Não foi possível avisar a Asaas.";
  }
  await supabase
    .from("mensalidades")
    .update({ asaas_status: "RECEIVED_IN_CASH", asaas_last_sync_at: new Date().toISOString() })
    .eq("id", mensalidade.id);
  return null;
}
