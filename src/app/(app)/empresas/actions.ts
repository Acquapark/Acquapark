"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { gerarCodigoEmpresa } from "@/lib/empresas-codigo";

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
  const cnpj = input.cnpj.replace(/\D/g, "");
  if (cnpj && cnpj.length !== 14) return "CNPJ incompleto. Preencha os 14 números ou deixe em branco.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "E-mail inválido.";
  return null;
}

function colunas(input: EmpresaParceiraInput) {
  return {
    nome: input.nome.trim(),
    cnpj: input.cnpj.trim() || null,
    contato_nome: input.contatoNome.trim() || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim().toLowerCase() || null,
    observacoes: input.observacoes.trim() || null,
    ativa: input.ativa,
  };
}

function mensagemDeErro(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    // Código repetido é raríssimo (8 caracteres aleatórios): basta tentar de novo.
    return error.message.includes("codigo")
      ? "Não foi possível gerar um código único. Tente de novo."
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
  const { error } = await supabase.from("empresas_parceiras").insert({ ...colunas(input), codigo: gerarCodigoEmpresa() });
  if (error) return { error: mensagemDeErro(error) };
  revalidar();
  return { success: true };
}

/**
 * Troca o código da empresa — usado quando o código vazou para quem não é
 * funcionário. O antigo para de valer na hora; quem já se vinculou continua
 * vinculado.
 */
export async function gerarNovoCodigoEmpresa(id: string): Promise<{ error: string } | { codigo: string }> {
  const negado = await exigirPermissao("empresas_parceiras.editar");
  if (negado) return { error: negado.error };

  const supabase = await createClient();
  const codigo = gerarCodigoEmpresa();
  const { error } = await supabase
    .from("empresas_parceiras")
    .update({ codigo, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: mensagemDeErro(error) };
  revalidar();
  return { codigo };
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
