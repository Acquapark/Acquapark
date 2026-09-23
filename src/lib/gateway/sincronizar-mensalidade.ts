import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paymentGateway } from "@/lib/gateway";
import { Pagador } from "@/lib/gateway/types";

/**
 * Garante que uma mensalidade tenha uma cobrança criada no gateway (Asaas),
 * com billingType "a definir" — o associado escolhe Pix/Boleto/Cartão depois,
 * no Portal, sem precisar de uma cobrança nova (ver `atualizarCobranca`).
 *
 * Idempotente: se a mensalidade já tem `gateway_charge_id` e não está com
 * `asaas_sync_error`, não faz nada. Nunca lança — erro fica registrado em
 * `asaas_sync_error` pra permitir nova tentativa depois (botão "Sincronizar"),
 * mesmo padrão não-bloqueante usado no envio automático de contrato pra
 * assinatura (`gerarEEnviarContratoAutomatico`).
 */
export async function sincronizarCobrancaAsaas(
  supabase: SupabaseClient,
  mensalidadeId: string,
): Promise<{ success: true; jaSincronizada?: boolean } | { error: string }> {
  const { data: mensalidade, error: fetchError } = await supabase
    .from("mensalidades")
    .select(
      "id, associado_id, valor, vencimento, numero_parcela, total_parcelas, gateway_charge_id, asaas_sync_error, status, associados ( nome, cpf, email, telefone )",
    )
    .eq("id", mensalidadeId)
    .maybeSingle();

  if (fetchError || !mensalidade) return { error: "Mensalidade não encontrada." };
  if (mensalidade.gateway_charge_id && !mensalidade.asaas_sync_error) {
    return { success: true, jaSincronizada: true };
  }

  const associado = mensalidade.associados as unknown as {
    nome: string;
    cpf: string;
    email: string | null;
    telefone: string | null;
  } | null;

  if (!associado?.cpf) {
    const mensagem = "Associado sem CPF cadastrado — atualize o cadastro antes de sincronizar.";
    await supabase
      .from("mensalidades")
      .update({ asaas_sync_error: mensagem, asaas_last_sync_at: new Date().toISOString() })
      .eq("id", mensalidadeId);
    return { error: mensagem };
  }

  const pagador: Pagador = {
    associadoId: mensalidade.associado_id as string,
    nome: associado.nome,
    cpf: associado.cpf,
    email: associado.email ?? undefined,
    telefone: associado.telefone ?? undefined,
  };

  try {
    const cobranca = await paymentGateway.criarCobrancaPendente({
      mensalidadeId,
      valor: Number(mensalidade.valor),
      vencimento: mensalidade.vencimento as string,
      descricao: `Aqua Park — parcela ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`,
      pagador,
    });

    const { error: updateError } = await supabase
      .from("mensalidades")
      .update({
        gateway_charge_id: cobranca.chargeId,
        asaas_billing_type: "Undefined",
        asaas_status: cobranca.status,
        asaas_invoice_url: cobranca.invoiceUrl,
        asaas_last_sync_at: new Date().toISOString(),
        asaas_sync_error: null,
      })
      .eq("id", mensalidadeId);
    if (updateError) return { error: updateError.message };

    return { success: true };
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Falha ao sincronizar com o Asaas.";
    await supabase
      .from("mensalidades")
      .update({ asaas_sync_error: mensagem, asaas_last_sync_at: new Date().toISOString() })
      .eq("id", mensalidadeId);
    return { error: mensagem };
  }
}
