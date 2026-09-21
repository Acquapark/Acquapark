import { SupabaseClient } from "@supabase/supabase-js";
import { Empresa } from "@/lib/contracts/variables";

export interface ModeloContrato {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  status: "Ativo" | "Inativo";
  versao: number;
  conteudoHtml: string;
  arquivoOriginalNome: string | null;
  updatedAt: string;
}

export interface ContratoGerado {
  id: string;
  numero: string;
  associadoId: string;
  modeloId: string | null;
  modeloNome: string;
  modeloVersao: number;
  dataContrato: string;
  conteudoHtml: string;
  status: string;
  geradoEm: string;
}

type Row = Record<string, unknown>;

function mapModelo(row: Row): ModeloContrato {
  return {
    id: row.id as string,
    nome: row.nome as string,
    descricao: (row.descricao as string) ?? "",
    tipo: row.tipo as string,
    status: row.status as "Ativo" | "Inativo",
    versao: row.versao as number,
    conteudoHtml: (row.conteudo_html as string) ?? "",
    arquivoOriginalNome: (row.arquivo_original_nome as string) ?? null,
    updatedAt: row.updated_at as string,
  };
}

export async function getModelos(supabase: SupabaseClient): Promise<ModeloContrato[]> {
  const { data, error } = await supabase.from("modelos_contrato").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(mapModelo);
}

export async function getModeloById(supabase: SupabaseClient, id: string): Promise<ModeloContrato | null> {
  const { data, error } = await supabase.from("modelos_contrato").select("*").eq("id", id).single();
  if (error || !data) return null;
  return mapModelo(data as unknown as Row);
}

export async function getModelosAtivos(supabase: SupabaseClient): Promise<ModeloContrato[]> {
  const { data, error } = await supabase
    .from("modelos_contrato")
    .select("*")
    .eq("status", "Ativo")
    .order("nome");
  if (error) throw error;
  return (data as unknown as Row[]).map(mapModelo);
}

export async function getEmpresa(supabase: SupabaseClient): Promise<Empresa> {
  const { data, error } = await supabase.from("empresa").select("*").eq("id", true).single();
  if (error || !data) {
    return {
      nome: "Aqua Park",
      razaoSocial: "",
      cnpj: "",
      telefone: "",
      email: "",
      endereco: "",
      numeroEndereco: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
      cep: "",
    };
  }
  const row = data as Row;
  return {
    nome: (row.nome as string) ?? "Aqua Park",
    razaoSocial: (row.razao_social as string) ?? "",
    cnpj: (row.cnpj as string) ?? "",
    telefone: (row.telefone as string) ?? "",
    email: (row.email as string) ?? "",
    endereco: (row.endereco as string) ?? "",
    numeroEndereco: (row.numero_endereco as string) ?? "",
    complemento: (row.complemento as string) ?? "",
    bairro: (row.bairro as string) ?? "",
    cidade: (row.cidade as string) ?? "",
    estado: (row.estado as string) ?? "",
    cep: (row.cep as string) ?? "",
  };
}

export async function getContratosGeradosDoAssociado(
  supabase: SupabaseClient,
  associadoId: string,
): Promise<ContratoGerado[]> {
  const { data, error } = await supabase
    .from("contratos_gerados")
    .select("*")
    .eq("associado_id", associadoId)
    .order("gerado_em", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map((row) => ({
    id: row.id as string,
    numero: row.numero as string,
    associadoId: row.associado_id as string,
    modeloId: (row.modelo_id as string) ?? null,
    modeloNome: row.modelo_nome as string,
    modeloVersao: row.modelo_versao as number,
    dataContrato: row.data_contrato as string,
    conteudoHtml: row.conteudo_html as string,
    status: row.status as string,
    geradoEm: row.gerado_em as string,
  }));
}

export async function getContratoGeradoById(supabase: SupabaseClient, id: string): Promise<ContratoGerado | null> {
  const { data, error } = await supabase.from("contratos_gerados").select("*").eq("id", id).single();
  if (error || !data) return null;
  const row = data as Row;
  return {
    id: row.id as string,
    numero: row.numero as string,
    associadoId: row.associado_id as string,
    modeloId: (row.modelo_id as string) ?? null,
    modeloNome: row.modelo_nome as string,
    modeloVersao: row.modelo_versao as number,
    dataContrato: row.data_contrato as string,
    conteudoHtml: row.conteudo_html as string,
    status: row.status as string,
    geradoEm: row.gerado_em as string,
  };
}
