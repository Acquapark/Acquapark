import { SupabaseClient } from "@supabase/supabase-js";
import { Ingresso, RegraReentrada, TipoIngresso } from "@/types";

type Row = Record<string, unknown>;

function mapTipo(row: Row): TipoIngresso {
  return {
    id: row.id as string,
    nome: row.nome as string,
    descricao: (row.descricao as string) ?? "",
    valor: Number(row.valor),
    validade: (row.validade as string) ?? "1 dia",
    regraReentrada: ((row.regra_reentrada as RegraReentrada) ?? "unica"),
    ativo: (row.ativo as boolean) ?? true,
  };
}

export async function getTiposIngresso(supabase: SupabaseClient): Promise<TipoIngresso[]> {
  const { data, error } = await supabase.from("tipos_ingresso").select("*").order("valor");
  if (error) throw error;
  return (data as unknown as Row[]).map(mapTipo);
}

export async function getIngressos(supabase: SupabaseClient): Promise<Ingresso[]> {
  const { data, error } = await supabase
    .from("ingressos")
    .select("id, numero, codigo, comprador_nome, data_utilizacao, valor, status, forma_pagamento, tipos_ingresso ( nome )")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => ({
    id: row.id as string,
    numero: row.numero as string,
    codigo: row.codigo as string,
    tipo: ((row.tipos_ingresso as Row | null)?.nome as string) ?? "—",
    comprador: (row.comprador_nome as string) ?? "—",
    dataUtilizacao: row.data_utilizacao as string,
    valor: Number(row.valor),
    status: row.status as Ingresso["status"],
    formaPagamento: (row.forma_pagamento as string) ?? undefined,
  }));
}

export interface AcessoRecente {
  id: string;
  quem: string;
  origem: "Ingresso" | "Associado";
  tipo: string;
  resultado: string;
  motivo: string | null;
  registradoEm: string;
}

export async function getAcessosRecentes(supabase: SupabaseClient, limit = 8): Promise<AcessoRecente[]> {
  const { data, error } = await supabase
    .from("acessos")
    .select(
      "id, tipo, resultado, motivo, registrado_em, ingressos ( numero, comprador_nome ), credenciais ( associados ( nome ) )",
    )
    .order("registrado_em", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const ingresso = row.ingressos as Row | null;
    const associado = (row.credenciais as Row | null)?.associados as Row | null | undefined;
    return {
      id: row.id as string,
      quem: ingresso
        ? `${ingresso.numero as string}${ingresso.comprador_nome ? ` — ${ingresso.comprador_nome as string}` : ""}`
        : ((associado?.nome as string) ?? "—"),
      origem: ingresso ? "Ingresso" : "Associado",
      tipo: row.tipo as string,
      resultado: row.resultado as string,
      motivo: (row.motivo as string) ?? null,
      registradoEm: row.registrado_em as string,
    };
  });
}
