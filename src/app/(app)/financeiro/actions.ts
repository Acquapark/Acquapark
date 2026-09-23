"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FORMAS_PAGAMENTO_DESPESA } from "@/lib/financeiro-constantes";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { paymentGateway } from "@/lib/gateway";
import { Pagador, TipoCobranca } from "@/lib/gateway/types";
import { sincronizarCobrancaAsaas } from "@/lib/gateway/sincronizar-mensalidade";
import { FormaPagamento } from "@/types";

export interface DespesaInput {
  descricao: string;
  categoria: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  observacoes: string;
}

function revalidate() {
  revalidatePath("/financeiro");
}

function validar(input: DespesaInput): string | null {
  if (!input.descricao.trim()) return "Informe a descrição da despesa.";
  if (!input.categoria.trim()) return "Selecione a categoria.";
  if (!Number.isFinite(input.valor) || input.valor <= 0) return "Informe um valor maior que zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.vencimento)) return "Informe a data de vencimento.";
  return null;
}

function toRow(input: DespesaInput) {
  return {
    descricao: input.descricao.trim(),
    categoria: input.categoria.trim(),
    fornecedor: input.fornecedor.trim() || null,
    valor: input.valor,
    vencimento: input.vencimento,
    observacoes: input.observacoes.trim() || null,
  };
}

export async function createDespesa(input: DespesaInput) {
  const negado = await exigirPermissao("despesas.criar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("despesas").insert({ ...toRow(input), status: "Pendente" });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function updateDespesa(id: string, input: DespesaInput) {
  const negado = await exigirPermissao("despesas.editar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("despesas").update(toRow(input)).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function pagarDespesa(id: string, params: { pagoEm: string; formaPagamento: string }) {
  const negado = await exigirPermissao("despesas.pagar");
  if (negado) return { error: negado.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.pagoEm)) return { error: "Informe a data do pagamento." };
  if (!FORMAS_PAGAMENTO_DESPESA.includes(params.formaPagamento)) return { error: "Selecione a forma de pagamento." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despesas")
    .update({ status: "Pago", pago_em: params.pagoEm, forma_pagamento: params.formaPagamento })
    .eq("id", id)
    .eq("status", "Pendente")
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Esta despesa já foi paga." };
  revalidate();
  return { success: true };
}

export async function desfazerPagamentoDespesa(id: string) {
  const negado = await exigirPermissao("despesas.pagar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despesas")
    .update({ status: "Pendente", pago_em: null, forma_pagamento: null })
    .eq("id", id)
    .eq("status", "Pago")
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Esta despesa não está paga." };
  revalidate();
  return { success: true };
}

/**
 * Gera uma cobrança real no Asaas em nome do associado — para quem não usa o
 * Portal, ou perdeu um boleto/Pix e precisa de um novo. Mesmo gateway que o
 * Portal usa (src/lib/gateway); a confirmação chega depois pelo mesmo
 * webhook, sem a equipe precisar fazer mais nada.
 */
type ResultadoCobranca =
  | { error: string }
  | { tipo: "pix"; copiaECola: string; expiraEm: string; valor: number }
  | { tipo: "boleto"; linhaDigitavel: string; urlBoleto: string; valor: number }
  | { tipo: "cartao"; checkoutUrl: string; valor: number };

export async function cobrarMensalidade(mensalidadeId: string, forma: FormaPagamento): Promise<ResultadoCobranca> {
  const negado = await exigirPermissao("contas_receber.receber");
  if (negado) return { error: negado.error };

  const supabase = await createClient();
  const { data: mensalidade, error: fetchError } = await supabase
    .from("mensalidades")
    .select(
      "id, associado_id, valor, vencimento, status, numero_parcela, total_parcelas, gateway_charge_id, associados ( nome, cpf, email, telefone )",
    )
    .eq("id", mensalidadeId)
    .maybeSingle();
  if (fetchError || !mensalidade) return { error: "Mensalidade não encontrada." };
  if (mensalidade.status === "Pago") return { error: "Esta mensalidade já está paga." };

  const associado = mensalidade.associados as unknown as {
    nome: string;
    cpf: string;
    email: string | null;
    telefone: string | null;
  } | null;
  if (!associado?.cpf) return { error: "Associado sem CPF cadastrado — atualize o cadastro antes de cobrar." };

  const pagador: Pagador = {
    associadoId: mensalidade.associado_id as string,
    nome: associado.nome,
    cpf: associado.cpf,
    email: associado.email ?? undefined,
    telefone: associado.telefone ?? undefined,
  };
  const descricao = `Aqua Park — parcela ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}`;
  const valor = Number(mensalidade.valor);
  const vencimento = mensalidade.vencimento as string;
  // Se a cobrança já existe (criada antecipadamente na adesão), atualiza-a em
  // vez de criar outra.
  const chargeIdExistente = (mensalidade.gateway_charge_id as string | null) ?? undefined;

  try {
    let resultado:
      | { tipo: "pix"; copiaECola: string; expiraEm: string }
      | { tipo: "boleto"; linhaDigitavel: string; urlBoleto: string }
      | { tipo: "cartao"; checkoutUrl: string };
    let chargeId: string;

    if (forma === "Pix") {
      const charge = await paymentGateway.criarCobrancaPix({ mensalidadeId, valor, vencimento, descricao, pagador, chargeIdExistente });
      chargeId = charge.chargeId;
      resultado = { tipo: "pix", copiaECola: charge.copiaECola, expiraEm: charge.expiraEm };
    } else if (forma === "Boleto") {
      const charge = await paymentGateway.criarCobrancaBoleto({ mensalidadeId, valor, vencimento, descricao, pagador, chargeIdExistente });
      chargeId = charge.chargeId;
      resultado = { tipo: "boleto", linhaDigitavel: charge.linhaDigitavel, urlBoleto: charge.urlBoleto };
    } else {
      const charge = await paymentGateway.criarCheckoutCartao({ mensalidadeId, valor, vencimento, descricao, pagador, chargeIdExistente });
      chargeId = charge.chargeId;
      resultado = { tipo: "cartao", checkoutUrl: charge.checkoutUrl };
    }

    await supabase
      .from("mensalidades")
      .update({ status: "Em processamento", gateway_charge_id: chargeId, forma_pagamento: forma, asaas_billing_type: forma })
      .eq("id", mensalidadeId);

    revalidatePath(`/associados/${mensalidade.associado_id}`);
    revalidatePath("/financeiro");
    return { ...resultado, valor };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível gerar a cobrança. Tente novamente." };
  }
}

/** Mapeia o texto livre já usado em `forma_pagamento`/`asaas_billing_type` pro tipo que o gateway espera. */
function formaParaTipo(forma: string | null | undefined): TipoCobranca {
  if (forma === "Pix") return "Pix";
  if (forma === "Boleto") return "Boleto";
  if (forma === "Cartão de crédito") return "Cartão";
  return "Undefined";
}

/** Status da cobrança na Asaas em que uma edição/cancelamento ainda é permitido — fora disso (pago, estornado etc.) a cobrança já seguiu adiante e não pode ser alterada por aqui. */
const STATUS_ASAAS_EDITAVEL = new Set(["PENDING", "OVERDUE"]);

export async function alterarVencimentoMensalidade(
  mensalidadeId: string,
  novoVencimento: string,
): Promise<{ error: string } | { success: true }> {
  const negado = await exigirPermissao("contas_receber.editar");
  if (negado) return { error: negado.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novoVencimento)) return { error: "Data inválida." };

  const supabase = await createClient();
  const { data: mensalidade, error: fetchError } = await supabase
    .from("mensalidades")
    .select("id, associado_id, valor, status, gateway_charge_id, asaas_billing_type")
    .eq("id", mensalidadeId)
    .maybeSingle();
  if (fetchError || !mensalidade) return { error: "Mensalidade não encontrada." };
  if (mensalidade.status === "Pago") return { error: "Esta mensalidade já está paga — não é possível alterar o vencimento." };
  if (mensalidade.status === "Cancelado") return { error: "Esta mensalidade está cancelada." };

  const chargeId = mensalidade.gateway_charge_id as string | null;
  if (chargeId) {
    try {
      const cobranca = await paymentGateway.buscarCobranca(chargeId);
      if (cobranca && !STATUS_ASAAS_EDITAVEL.has(cobranca.status)) {
        return { error: `A cobrança no Asaas está em um estado que não permite alteração de vencimento (${cobranca.status}).` };
      }

      const atualizada = await paymentGateway.atualizarCobranca(chargeId, {
        tipo: formaParaTipo(mensalidade.asaas_billing_type as string | null),
        valor: Number(mensalidade.valor),
        vencimento: novoVencimento,
      });

      const { error: updateError } = await supabase
        .from("mensalidades")
        .update({
          vencimento: novoVencimento,
          asaas_status: atualizada.status,
          asaas_last_sync_at: new Date().toISOString(),
          asaas_sync_error: null,
        })
        .eq("id", mensalidadeId);
      if (updateError) return { error: updateError.message };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível atualizar o vencimento no Asaas." };
    }
  } else {
    const { error: updateError } = await supabase.from("mensalidades").update({ vencimento: novoVencimento }).eq("id", mensalidadeId);
    if (updateError) return { error: updateError.message };
  }

  revalidatePath(`/associados/${mensalidade.associado_id}`);
  revalidate();
  return { success: true };
}

export async function cancelarMensalidade(mensalidadeId: string): Promise<{ error: string } | { success: true }> {
  const negado = await exigirPermissao("contas_receber.cancelar");
  if (negado) return { error: negado.error };

  const supabase = await createClient();
  const { data: mensalidade, error: fetchError } = await supabase
    .from("mensalidades")
    .select("id, associado_id, status, gateway_charge_id")
    .eq("id", mensalidadeId)
    .maybeSingle();
  if (fetchError || !mensalidade) return { error: "Mensalidade não encontrada." };
  if (mensalidade.status === "Pago") return { error: "Esta mensalidade já está paga — não é possível cancelar." };
  if (mensalidade.status === "Cancelado") return { error: "Esta mensalidade já está cancelada." };

  const chargeId = mensalidade.gateway_charge_id as string | null;
  if (chargeId) {
    try {
      await paymentGateway.cancelarCobranca(chargeId);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível cancelar a cobrança no Asaas." };
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: updateError } = await supabase
    .from("mensalidades")
    .update({ status: "Cancelado", cancelado_em: new Date().toISOString(), cancelado_por: user?.id ?? null })
    .eq("id", mensalidadeId);
  if (updateError) return { error: updateError.message };

  revalidatePath(`/associados/${mensalidade.associado_id}`);
  revalidate();
  return { success: true };
}

export async function sincronizarMensalidade(mensalidadeId: string) {
  const negado = await exigirPermissao("contas_receber.criar");
  if (negado) return { error: negado.error };

  const supabase = await createClient();
  const resultado = await sincronizarCobrancaAsaas(supabase, mensalidadeId);

  const { data: mensalidade } = await supabase.from("mensalidades").select("associado_id").eq("id", mensalidadeId).maybeSingle();
  if (mensalidade) revalidatePath(`/associados/${mensalidade.associado_id}`);
  revalidate();

  return resultado;
}

export async function excluirDespesa(id: string) {
  const negado = await exigirPermissao("despesas.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  // Despesa paga faz parte do histórico do fluxo de caixa: precisa desfazer o pagamento antes.
  const { data, error } = await supabase.from("despesas").delete().eq("id", id).eq("status", "Pendente").select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Só é possível excluir despesas pendentes. Desfaça o pagamento antes." };
  revalidate();
  return { success: true };
}
