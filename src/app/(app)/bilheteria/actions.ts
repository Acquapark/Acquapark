"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RegraReentrada, TipoDescontoCupom } from "@/types";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { hojeBR } from "@/lib/datas-br";

export interface TipoIngressoInput {
  nome: string;
  descricao: string;
  valor: number;
  validade: string;
  regraReentrada: RegraReentrada;
  ativo: boolean;
}

function revalidate() {
  revalidatePath("/bilheteria");
  revalidatePath("/configuracoes");
}

function validar(input: TipoIngressoInput): string | null {
  if (!input.nome.trim()) return "Informe o nome do tipo de ingresso.";
  if (!Number.isFinite(input.valor) || input.valor < 0) return "Informe um valor válido.";
  return null;
}

export async function createTipoIngresso(input: TipoIngressoInput) {
  const negado = await exigirPermissao("tipos_ingresso.criar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("tipos_ingresso").insert({
    nome: input.nome.trim(),
    descricao: input.descricao.trim() || null,
    valor: input.valor,
    validade: input.validade.trim() || "1 dia",
    regra_reentrada: input.regraReentrada,
    ativo: input.ativo,
  });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function updateTipoIngresso(id: string, input: TipoIngressoInput) {
  const negado = await exigirPermissao("tipos_ingresso.editar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipos_ingresso")
    .update({
      nome: input.nome.trim(),
      descricao: input.descricao.trim() || null,
      valor: input.valor,
      validade: input.validade.trim() || "1 dia",
      regra_reentrada: input.regraReentrada,
      ativo: input.ativo,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function setTipoIngressoAtivo(id: string, ativo: boolean) {
  const negado = await exigirPermissao("tipos_ingresso.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("tipos_ingresso").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function excluirTipoIngresso(id: string) {
  const negado = await exigirPermissao("tipos_ingresso.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("tipos_ingresso").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Este tipo já tem ingressos vendidos vinculados e não pode ser excluído. Desative-o em vez de excluir." };
    }
    return { error: error.message };
  }
  revalidate();
  return { success: true };
}

const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];

export async function venderIngresso(params: {
  tipoId: string;
  comprador: string;
  dataUtilizacao: string;
  formaPagamento: string;
  cupomCodigo?: string;
}) {
  const negado = await exigirPermissao("ingressos.criar");
  if (negado) return { error: negado.error };
  if (!params.tipoId) return { error: "Selecione o tipo de ingresso." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dataUtilizacao)) return { error: "Informe a data de utilização." };
  if (!FORMAS_PAGAMENTO.includes(params.formaPagamento)) return { error: "Selecione a forma de pagamento." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vender_ingresso", {
    p_tipo_id: params.tipoId,
    p_comprador: params.comprador.trim() || null,
    p_data_utilizacao: params.dataUtilizacao,
    p_forma_pagamento: params.formaPagamento,
    p_cupom_codigo: params.cupomCodigo?.trim() || null,
  });
  if (error || !data) return { error: error?.message ?? "Não foi possível emitir o ingresso." };

  revalidate();
  revalidatePath("/caixa");
  const ingresso = data as { id: string; numero: string; codigo: string; valor: number; valor_desconto: number };
  return {
    ingresso: {
      id: ingresso.id,
      numero: ingresso.numero,
      codigo: ingresso.codigo,
      valor: Number(ingresso.valor),
      valorDesconto: Number(ingresso.valor_desconto),
    },
  };
}

export async function cancelarIngresso(id: string) {
  const negado = await exigirPermissao("ingressos.cancelar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_ingresso", { p_ingresso_id: id });
  if (error) return { error: error.message };

  revalidate();
  revalidatePath("/caixa");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Cupons de desconto
// ---------------------------------------------------------------------------

export interface CupomInput {
  codigo: string;
  descricao: string;
  tipoDesconto: TipoDescontoCupom;
  valor: number;
  ativo: boolean;
  validade: string;
  limiteUsos: string;
}

function validarCupomInput(input: CupomInput): string | null {
  if (!input.codigo.trim()) return "Informe o código do cupom.";
  if (!Number.isFinite(input.valor) || input.valor <= 0) return "Informe um valor de desconto maior que zero.";
  if (input.tipoDesconto === "percentual" && input.valor > 100) return "O desconto percentual não pode passar de 100%.";
  if (input.validade && !/^\d{4}-\d{2}-\d{2}$/.test(input.validade)) return "Data de validade inválida.";
  if (input.limiteUsos && (!Number.isInteger(Number(input.limiteUsos)) || Number(input.limiteUsos) <= 0)) {
    return "O limite de usos deve ser um número inteiro maior que zero.";
  }
  return null;
}

function cupomRow(input: CupomInput) {
  return {
    codigo: input.codigo.trim().toUpperCase(),
    descricao: input.descricao.trim() || null,
    tipo_desconto: input.tipoDesconto,
    valor: input.valor,
    ativo: input.ativo,
    validade: input.validade || null,
    limite_usos: input.limiteUsos ? Number(input.limiteUsos) : null,
  };
}

export async function criarCupom(input: CupomInput) {
  const negado = await exigirPermissao("cupons_desconto.criar");
  if (negado) return { error: negado.error };
  const invalido = validarCupomInput(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("cupons_desconto").insert(cupomRow(input));
  if (error) {
    if (error.code === "23505") return { error: "Já existe um cupom com este código." };
    return { error: error.message };
  }
  revalidate();
  return { success: true };
}

export async function atualizarCupom(id: string, input: CupomInput) {
  const negado = await exigirPermissao("cupons_desconto.editar");
  if (negado) return { error: negado.error };
  const invalido = validarCupomInput(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("cupons_desconto").update(cupomRow(input)).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "Já existe um cupom com este código." };
    return { error: error.message };
  }
  revalidate();
  return { success: true };
}

export async function setCupomAtivo(id: string, ativo: boolean) {
  const negado = await exigirPermissao("cupons_desconto.editar");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("cupons_desconto").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function excluirCupom(id: string) {
  const negado = await exigirPermissao("cupons_desconto.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("cupons_desconto").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Este cupom já foi usado em alguma venda e não pode ser excluído. Desative-o em vez de excluir." };
    }
    return { error: error.message };
  }
  revalidate();
  return { success: true };
}

/**
 * Confere um cupom sem consumir uso — só para mostrar o preço com desconto
 * na tela antes de confirmar a venda. A validação "de verdade" (que soma ao
 * contador de usos) acontece dentro de vender_ingresso, na hora da venda.
 */
export async function validarCupom(
  codigo: string,
  valorBase: number,
): Promise<{ error: string } | { valorDesconto: number; valorFinal: number }> {
  const negado = await exigirPermissao("ingressos.criar");
  if (negado) return { error: negado.error };
  if (!codigo.trim()) return { error: "Informe o código do cupom." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cupons_desconto")
    .select("tipo_desconto, valor, ativo, validade, limite_usos, usos")
    .ilike("codigo", codigo.trim())
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Cupom não encontrado." };
  if (!data.ativo) return { error: "Este cupom não está mais ativo." };
  if (data.validade && data.validade < hojeBR()) return { error: "Este cupom expirou." };
  if (data.limite_usos !== null && data.usos >= data.limite_usos) return { error: "Este cupom atingiu o limite de usos." };

  const desconto =
    data.tipo_desconto === "percentual" ? Math.round(valorBase * (Number(data.valor) / 100) * 100) / 100 : Math.min(Number(data.valor), valorBase);

  return { valorDesconto: desconto, valorFinal: valorBase - desconto };
}
