import { SupabaseClient } from "@supabase/supabase-js";
import { EmpresaParceira } from "@/types";

type Row = Record<string, unknown>;

function mapEmpresa(row: Row): EmpresaParceira {
  const contagem = Array.isArray(row.associados) ? (row.associados[0] as Row | undefined) : undefined;
  return {
    id: row.id as string,
    nome: row.nome as string,
    cnpj: (row.cnpj as string) ?? "",
    contatoNome: (row.contato_nome as string) ?? "",
    telefone: (row.telefone as string) ?? "",
    email: (row.email as string) ?? "",
    observacoes: (row.observacoes as string) ?? "",
    ativa: (row.ativa as boolean) ?? true,
    totalAssociados: Number(contagem?.count ?? 0),
  };
}

/** Todas as empresas parceiras (ativas e inativas), com o total de associados de cada uma. */
export async function getEmpresasParceiras(supabase: SupabaseClient): Promise<EmpresaParceira[]> {
  const { data, error } = await supabase.from("empresas_parceiras").select("*, associados ( count )").order("nome");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapEmpresa);
}

/**
 * Só id e nome das empresas ativas — o que as listas de escolha do cadastro
 * precisam. Na página pública é chamada com a service role (sem sessão), por
 * isso não devolve CNPJ, contato ou observações.
 */
export async function getEmpresasParceirasAtivas(supabase: SupabaseClient): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from("empresas_parceiras").select("id, nome").eq("ativa", true).order("nome");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id as string, nome: row.nome as string }));
}
