"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { CODIGO_EMPRESA_TAMANHO, codigoDoCnpj } from "@/lib/empresas-codigo";

export interface EmpresaParceiraInput {
  nome: string;
  cnpj: string;
  contatoNome: string;
  telefone: string;
  email: string;
  observacoes: string;
  ativa: boolean;
}

function validar(input: EmpresaParceiraInput): string | null {
  if (!input.nome.trim()) return "Informe o nome da empresa.";
  // O CNPJ é o código que o funcionário digita no cadastro — por isso é obrigatório.
  const cnpj = codigoDoCnpj(input.cnpj);
  if (!cnpj) return "Informe o CNPJ da empresa. Ele é o código que o funcionário digita no cadastro.";
  if (cnpj.length !== CODIGO_EMPRESA_TAMANHO) return "CNPJ incompleto. Preencha os 14 números.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "E-mail inválido.";
  return null;
}

function colunas(input: EmpresaParceiraInput) {
  return {
    nome: input.nome.trim(),
    cnpj: input.cnpj.trim(),
    codigo: codigoDoCnpj(input.cnpj),
    contato_nome: input.contatoNome.trim() || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim().toLowerCase() || null,
    observacoes: input.observacoes.trim() || null,
    ativa: input.ativa,
  };
}

function mensagemDeErro(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    // O código é o CNPJ: código repetido quer dizer CNPJ já cadastrado.
    return error.message.includes("codigo")
      ? "Já existe uma empresa parceira com esse CNPJ."
      : "Já existe uma empresa parceira com esse nome.";
  }
  return error.message;
}

function revalidar() {
  revalidatePath("/empresas");
  revalidatePath("/associados");
}

export async function createEmpresaParceira(input: EmpresaParceiraInput) {
  const negado = await exigirPermissao("empresas_parceiras.criar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase.from("empresas_parceiras").insert(colunas(input));
  if (error) return { error: mensagemDeErro(error) };
  revalidar();
  return { success: true };
}

export async function updateEmpresaParceira(id: string, input: EmpresaParceiraInput) {
  const negado = await exigirPermissao("empresas_parceiras.editar");
  if (negado) return { error: negado.error };
  const invalido = validar(input);
  if (invalido) return { error: invalido };

  const supabase = await createClient();
  const { error } = await supabase
    .from("empresas_parceiras")
    .update({ ...colunas(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mensagemDeErro(error) };
  revalidar();
  return { success: true };
}

/** Só exclui empresa sem associados vinculados — com vínculo, a saída é inativar. */
export async function deleteEmpresaParceira(id: string) {
  const negado = await exigirPermissao("empresas_parceiras.excluir");
  if (negado) return { error: negado.error };

  const supabase = await createClient();
  const { error } = await supabase.from("empresas_parceiras").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "Esta empresa tem associados vinculados e não pode ser excluída. Edite a empresa e desmarque \"Ativa\" para tirá-la das listas de cadastro.",
      };
    }
    return { error: error.message };
  }
  revalidar();
  return { success: true };
}
