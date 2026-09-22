import { SupabaseClient } from "@supabase/supabase-js";
import { CupomDesconto, Ingresso, RegraReentrada, TipoIngresso } from "@/types";
import { somarDias } from "@/lib/datas-br";

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

const INGRESSO_SELECT =
  "id, numero, codigo, comprador_nome, data_utilizacao, valor, valor_desconto, status, forma_pagamento, tipos_ingresso ( nome ), cupons_desconto ( codigo )";

function mapIngresso(row: Row): Ingresso {
  return {
    id: row.id as string,
    numero: row.numero as string,
    codigo: row.codigo as string,
    tipo: ((row.tipos_ingresso as Row | null)?.nome as string) ?? "—",
    comprador: (row.comprador_nome as string) ?? "—",
    dataUtilizacao: row.data_utilizacao as string,
    valor: Number(row.valor),
    status: row.status as Ingresso["status"],
    formaPagamento: (row.forma_pagamento as string) ?? undefined,
    cupomCodigo: (row.cupons_desconto as Row | null)?.codigo as string | undefined,
    valorDesconto: row.valor_desconto ? Number(row.valor_desconto) : undefined,
  };
}

/** Sem `periodo`, traz os últimos vendidos (limite de segurança); com `periodo`, todas as vendas da janela (data da venda, `created_at`). */
export async function getIngressos(supabase: SupabaseClient, periodo?: { de: string; ate: string }): Promise<Ingresso[]> {
  let query = supabase.from("ingressos").select(INGRESSO_SELECT).order("created_at", { ascending: false });

  if (periodo) {
    const inicio = `${periodo.de}T00:00:00-03:00`;
    const fim = `${somarDias(periodo.ate, 1)}T00:00:00-03:00`;
    query = query.gte("created_at", inicio).lt("created_at", fim).limit(2000);
  } else {
    query = query.limit(300);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Row[]).map(mapIngresso);
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

function mapCupom(row: Row): CupomDesconto {
  return {
    id: row.id as string,
    codigo: row.codigo as string,
    descricao: (row.descricao as string) ?? "",
    tipoDesconto: row.tipo_desconto as CupomDesconto["tipoDesconto"],
    valor: Number(row.valor),
    ativo: row.ativo as boolean,
    validade: (row.validade as string) ?? null,
    limiteUsos: (row.limite_usos as number) ?? null,
    usos: row.usos as number,
  };
}

export async function getCupons(supabase: SupabaseClient): Promise<CupomDesconto[]> {
  const { data, error } = await supabase.from("cupons_desconto").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(mapCupom);
}
