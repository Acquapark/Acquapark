"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FORMAS_PAGAMENTO_DESPESA } from "@/lib/financeiro-constantes";
import { exigirPermissao } from "@/lib/auth/acesso-atual";

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
