import { SupabaseClient } from "@supabase/supabase-js";
import { EmpresaParceira, EmpresaParceiraOpcao } from "@/types";
import type { CupomPlano } from "@/lib/cupom-plano";
import { COLUNAS_CUPOM_PLANO, cupomPlanoDaLinha } from "@/lib/cupom-plano-servidor";

type Row = Record<string, unknown>;

/** Join do cupom de desconto da empresa, com as colunas para conferir se ainda vale. */
const JOIN_CUPOM = `cupom:cupons_desconto ( ${COLUNAS_CUPOM_PLANO} )`;

function cupomDaEmpresa(row: Row): CupomPlano | null {
  return cupomPlanoDaLinha(row.cupom as Row | null);
}

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
    cupomId: (row.cupom_id as string) ?? null,
    cupomCodigo: ((row.cupom as Row | null)?.codigo as string) ?? null,
    cupom: cupomDaEmpresa(row),
  };
}

function mapOpcao(row: Row): EmpresaParceiraOpcao {
  return { id: row.id as string, nome: row.nome as string, cupom: cupomDaEmpresa(row) };
}

/** Todas as empresas parceiras (ativas e inativas), com o total de associados de cada uma. */
export async function getEmpresasParceiras(supabase: SupabaseClient): Promise<EmpresaParceira[]> {
  const { data, error } = await supabase
    .from("empresas_parceiras")
    .select(`*, associados ( count ), ${JOIN_CUPOM}`)
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapEmpresa);
}

/**
 * Empresa ativa dona do código — a página pública usa isto (com a service
 * role) para vincular o associado. Devolve só id, nome e o desconto dela.
 */
export async function getEmpresaAtivaPorCodigo(
  supabase: SupabaseClient,
  codigo: string,
): Promise<EmpresaParceiraOpcao | null> {
  if (!codigo) return null;
  const { data, error } = await supabase
    .from("empresas_parceiras")
    .select(`id, nome, ${JOIN_CUPOM}`)
    .eq("codigo", codigo)
    .eq("ativa", true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapOpcao(data as Row) : null;
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
 * Id, nome e desconto das empresas ativas — o que as listas de escolha do
 * painel precisam.
 */
export async function getEmpresasParceirasAtivas(supabase: SupabaseClient): Promise<EmpresaParceiraOpcao[]> {
  const { data, error } = await supabase
    .from("empresas_parceiras")
    .select(`id, nome, ${JOIN_CUPOM}`)
    .eq("ativa", true)
    .order("nome");
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapOpcao);
}
