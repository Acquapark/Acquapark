"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCaixaResumo } from "@/lib/supabase/caixa";
import { CaixaMovimentoTipo, CaixaResumo } from "@/types";
import { exigirPermissao, getAcessoAtual } from "@/lib/auth/acesso-atual";
import { temPermissao } from "@/lib/permissoes";

function revalidate() {
  revalidatePath("/caixa");
  revalidatePath("/bilheteria");
}

function valorValido(v: number) {
  return Number.isFinite(v) && v >= 0;
}

export async function abrirCaixa(valorAbertura: number, operadorNome: string) {
  const negado = await exigirPermissao("caixa.abrir");
  if (negado) return { error: negado.error };
  if (!valorValido(valorAbertura)) return { error: "Informe um valor de abertura válido." };
  if (!operadorNome.trim()) return { error: "Informe o nome do operador." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("abrir_caixa", {
    p_valor_abertura: valorAbertura,
    p_operador_nome: operadorNome,
  });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function registrarMovimento(params: {
  caixaId: string;
  tipo: CaixaMovimentoTipo;
  valor: number;
  motivo: string;
}) {
  const negado = await exigirPermissao("caixa.movimentar");
  if (negado) return { error: negado.error };
  if (!Number.isFinite(params.valor) || params.valor <= 0) return { error: "Informe um valor maior que zero." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_movimento_caixa", {
    p_caixa_id: params.caixaId,
    p_tipo: params.tipo,
    p_valor: params.valor,
    p_motivo: params.motivo,
  });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function fecharCaixa(params: { caixaId: string; valorContado: number; observacoes: string }) {
  const negado = await exigirPermissao("caixa.fechar");
  if (negado) return { error: negado.error };
  if (!valorValido(params.valorContado)) return { error: "Informe o valor contado no caixa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fechar_caixa", {
    p_caixa_id: params.caixaId,
    p_valor_contado: params.valorContado,
    p_observacoes: params.observacoes,
  });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function reabrirCaixa(caixaId: string) {
  const negado = await exigirPermissao("caixa.reabrir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reabrir_caixa", { p_caixa_id: caixaId });
  if (error) return { error: error.message };
  revalidate();
  return { success: true };
}

export async function carregarResumoCaixa(caixaId: string): Promise<CaixaResumo | null> {
  if (await exigirPermissao("caixa.visualizar")) return null;
  const supabase = await createClient();
  const resumo = await getCaixaResumo(supabase, caixaId);
  if (resumo && !temPermissao(await getAcessoAtual(), "caixa.ver_todos") && resumo.caixa.operadorId !== (await getAcessoAtual())?.userId) {
    return null;
  }
  return resumo;
}
