"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { RegraReentrada } from "@/types";

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
  const supabase = await createClient();
  const { error } = await supabase.from("tipos_ingresso").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

const FORMAS_PAGAMENTO = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];

export async function venderIngresso(params: {
  tipoId: string;
  comprador: string;
  dataUtilizacao: string;
  formaPagamento: string;
}) {
  if (!params.tipoId) return { error: "Selecione o tipo de ingresso." };
  if (!params.comprador.trim()) return { error: "Informe o nome do comprador." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.dataUtilizacao)) return { error: "Informe a data de utilização." };
  if (!FORMAS_PAGAMENTO.includes(params.formaPagamento)) return { error: "Selecione a forma de pagamento." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vender_ingresso", {
    p_tipo_id: params.tipoId,
    p_comprador: params.comprador,
    p_data_utilizacao: params.dataUtilizacao,
    p_forma_pagamento: params.formaPagamento,
  });
  if (error || !data) return { error: error?.message ?? "Não foi possível emitir o ingresso." };

  revalidate();
  revalidatePath("/caixa");
  const ingresso = data as { id: string; numero: string; codigo: string };
  return { ingresso: { id: ingresso.id, numero: ingresso.numero, codigo: ingresso.codigo } };
}

export async function cancelarIngresso(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancelar_ingresso", { p_ingresso_id: id });
  if (error) return { error: error.message };

  revalidate();
  revalidatePath("/caixa");
  return { success: true };
}
