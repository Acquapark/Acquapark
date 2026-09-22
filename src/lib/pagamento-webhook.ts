import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fluxo da seção 10 do PRD: gateway confirma → webhook → localiza a
 * mensalidade pelo gateway_charge_id → atualiza status/forma/data de
 * pagamento → registra no financeiro (`pagamentos`).
 *
 * Usa o cliente com service role porque um webhook real chega sem sessão de
 * usuário — não há `auth.uid()` para a RLS avaliar.
 *
 * Idempotente: se a mensalidade já está paga, ou se o charge_id não bate com
 * nenhuma mensalidade pendente, não faz nada (evita pagamento duplicado
 * quando o mesmo webhook é reentregue).
 */
export async function processarConfirmacaoPagamento(params: { chargeId: string; formaPagamento: string }) {
  const admin = createAdminClient();

  const { data: mensalidade, error: findError } = await admin
    .from("mensalidades")
    .select("id, associado_id, valor, status")
    .eq("gateway_charge_id", params.chargeId)
    .maybeSingle();

  if (findError) return { error: findError.message };
  if (!mensalidade) return { error: "Cobrança não encontrada." };
  if (mensalidade.status === "Pago") return { success: true, jaProcessado: true };

  const pagoEm = new Date().toISOString();

  const { error: updateError } = await admin
    .from("mensalidades")
    .update({ status: "Pago", forma_pagamento: params.formaPagamento, pago_em: pagoEm })
    .eq("id", mensalidade.id)
    .neq("status", "Pago");
  if (updateError) return { error: updateError.message };

  await admin.from("pagamentos").insert({
    mensalidade_id: mensalidade.id,
    valor: mensalidade.valor,
    forma_pagamento: params.formaPagamento,
    referencia: params.chargeId,
  });

  return { success: true, associadoId: mensalidade.associado_id as string };
}

/** Cobrança cancelada/estornada no gateway: devolve a mensalidade para Pendente para o associado tentar de novo. */
async function reverterPagamento(chargeId: string) {
  const admin = createAdminClient();

  const { data: mensalidade } = await admin
    .from("mensalidades")
    .select("id, status")
    .eq("gateway_charge_id", chargeId)
    .maybeSingle();
  if (!mensalidade) return { success: true, ignorado: true };
  if (mensalidade.status !== "Pago" && mensalidade.status !== "Em processamento") return { success: true, ignorado: true };

  const { error } = await admin
    .from("mensalidades")
    .update({ status: "Pendente", gateway_charge_id: null, forma_pagamento: null, pago_em: null })
    .eq("id", mensalidade.id);
  if (error) return { error: error.message };
  return { success: true };
}

const BILLING_TYPE_PARA_FORMA: Record<string, string> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão de crédito",
};

const EVENTOS_PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const EVENTOS_CANCELADO = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED"]);

/**
 * Ponto de entrada do webhook do Asaas (POST /api/webhooks/asaas). Só reage
 * ao que muda o status da mensalidade; os demais eventos (visualizou o
 * boleto, foi para análise de risco etc.) retornam sucesso sem fazer nada —
 * o Asaas não precisa saber que ignoramos, só que recebemos.
 */
export async function processarEventoAsaas(evento: string, payment: { id: string; billingType?: string }) {
  const formaPagamento = BILLING_TYPE_PARA_FORMA[payment.billingType ?? ""] ?? "Pix";

  if (EVENTOS_PAGO.has(evento)) return processarConfirmacaoPagamento({ chargeId: payment.id, formaPagamento });
  if (EVENTOS_CANCELADO.has(evento)) return reverterPagamento(payment.id);
  return { success: true, ignorado: true };
}
