import { SupabaseClient } from "@supabase/supabase-js";
import { EmpresaParceira } from "@/types";

type Row = Record<string, unknown>;

function mapEmpresa(row: Row): EmpresaParceira {
  const contagem = Array.isArray(row.associados) ? (row.associados[0] as Row | undefined) : undefined;
  return {
    id: row.id as string,
    nome: row.nome as string,
    codigo: (row.codigo as string) ?? "",
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
 * Empresa ativa dona do código — a página pública usa isto (com a service
 * role) para vincular o associado. Devolve só id e nome.
 */
export async function getEmpresaAtivaPorCodigo(
  supabase: SupabaseClient,
  codigo: string,
): Promise<{ id: string; nome: string } | null> {
  if (!codigo) return null;
  const { data, error } = await supabase
    .from("empresas_parceiras")
    .select("id, nome")
    .eq("codigo", codigo)
    .eq("ativa", true)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id as string, nome: data.nome as string } : null;
}

/** Se há alguma empresa parceira ativa — sem nenhuma, a página pública nem mostra a opção. */
export async function existeEmpresaParceiraAtiva(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("empresas_parceiras")
    .select("id", { count: "exact", head: true })
    .eq("ativa", true);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Só id e nome das empresas ativas — o que as listas de escolha do painel
 * precisam.
 */
export async function getEmpresasParceirasAtivas(supabase: SupabaseClient): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase.from("empresas_parceiras").select("id, nome").eq("ativa", true).order("nome");
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => ({ id: row.id as string, nome: row.nome as string }));
}
