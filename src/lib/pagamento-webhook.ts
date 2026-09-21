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
