"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalContext } from "@/lib/supabase/portal";
import { paymentGateway } from "@/lib/gateway/mock";
import { processarConfirmacaoPagamento } from "@/lib/pagamento-webhook";
import { FormaPagamento } from "@/types";

/**
 * Cria a cobrança no gateway e grava o charge_id na mensalidade. A mensalidade
 * só é aceita se pertencer ao associado da sessão — nunca confiamos num id
 * vindo do cliente sem essa checagem.
 */
export async function iniciarPagamento(mensalidadeId: string, forma: FormaPagamento) {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { data: mensalidade, error: fetchError } = await supabase
    .from("mensalidades")
    .select("id, associado_id, valor, vencimento, status, numero_parcela, total_parcelas")
    .eq("id", mensalidadeId)
    .eq("associado_id", ctx.associadoId)
    .maybeSingle();

  if (fetchError || !mensalidade) return { error: "Mensalidade não encontrada." };
  if (mensalidade.status === "Pago") return { error: "Esta mensalidade já está paga." };

  const descricao = `Aqua Park — parcela ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`;
  const valor = Number(mensalidade.valor);

  if (forma === "Pix") {
    const charge = await paymentGateway.criarCobrancaPix({ mensalidadeId, valor, descricao });
    await marcarEmProcessamento(mensalidadeId, ctx.associadoId, charge.chargeId, forma);
    return { tipo: "pix" as const, chargeId: charge.chargeId, copiaECola: charge.copiaECola, valor: charge.valor, expiraEm: charge.expiraEm };
  }

  if (forma === "Boleto") {
    const charge = await paymentGateway.criarCobrancaBoleto({
      mensalidadeId,
      valor,
      vencimento: mensalidade.vencimento,
      descricao,
    });
    await marcarEmProcessamento(mensalidadeId, ctx.associadoId, charge.chargeId, forma);
    return {
      tipo: "boleto" as const,
      chargeId: charge.chargeId,
      linhaDigitavel: charge.linhaDigitavel,
      urlBoleto: charge.urlBoleto,
      valor: charge.valor,
    };
  }

  const charge = await paymentGateway.criarCheckoutCartao({ mensalidadeId, valor, descricao });
  await marcarEmProcessamento(mensalidadeId, ctx.associadoId, charge.chargeId, forma);
  return { tipo: "cartao" as const, chargeId: charge.chargeId, checkoutUrl: charge.checkoutUrl, valor: charge.valor };
}

/**
 * Usa o cliente com service role: a política de RLS do associado só permite
 * LEITURA em `mensalidades` (de propósito — ele nunca deve conseguir gravar
 * "Pago" na própria mensalidade). `iniciarPagamento` já confirmou a posse da
 * mensalidade com o cliente normal antes de chamar isto, então a gravação
 * aqui é restrita a uma mensalidade já verificada como do associado da sessão.
 */
async function marcarEmProcessamento(mensalidadeId: string, associadoId: string, chargeId: string, forma: string) {
  const admin = createAdminClient();
  await admin
    .from("mensalidades")
    .update({ status: "Em processamento", gateway_charge_id: chargeId, forma_pagamento: forma })
    .eq("id", mensalidadeId)
    .eq("associado_id", associadoId);
}

/**
 * Não existe gateway real conectado — este botão simula o que o webhook
 * faria quando o provedor confirma o pagamento, para dar pra testar o fluxo
 * completo (cobrança → confirmação → mensalidade paga) sem credenciais reais.
 */
export async function simularConfirmacaoPagamento(chargeId: string, forma: string) {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) return { error: "Sessão expirada." };

  // Confere que a cobrança pertence mesmo à sessão atual antes de confirmar.
  const { data: mensalidade } = await supabase
    .from("mensalidades")
    .select("id")
    .eq("gateway_charge_id", chargeId)
    .eq("associado_id", ctx.associadoId)
    .maybeSingle();
  if (!mensalidade) return { error: "Cobrança não encontrada." };

  return processarConfirmacaoPagamento({ chargeId, formaPagamento: forma });
}

export async function registrarUltimoAcessoPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  await admin.from("associado_acessos").update({ ultimo_acesso: new Date().toISOString() }).eq("id", user.id);
}
