import { SupabaseClient } from "@supabase/supabase-js";
import { Catraca } from "@/types";
import { hojeBR, janelaDoDiaBR } from "@/lib/datas-br";
import { buscarTodos } from "@/lib/supabase/paginar";

type Row = Record<string, unknown>;

export interface AcessosHoje {
  /** Associados distintos com pelo menos uma entrada autorizada hoje. */
  associados: number;
  /** Leituras autorizadas de associados hoje (entradas + reentradas). */
  acessosAssociados: number;
  /** Entradas autorizadas hoje (inclui reentradas), de ingressos e de associados. */
  entradas: { total: number; ingressos: number; associados: number; reentradas: number };
  /** Saídas autorizadas hoje. */
  saidas: number;
  /** Estimativa de quem ainda está no parque: entradas de hoje menos saídas de hoje. */
  pessoasNoParque: number;
  /** Leituras não autorizadas hoje. */
  negados: { total: number; negados: number; bloqueados: number };
}

/** Uma única busca dos acessos de hoje (horário de Brasília) alimenta todos os cartões do painel. */
export async function getAcessosHoje(supabase: SupabaseClient): Promise<AcessosHoje> {
  const inicioDoDia = `${hojeBR()}T00:00:00-03:00`;

  const { linhas } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("acessos")
      .select("id, tipo, resultado, ingresso_id, credenciais ( associado_id )")
      .gte("registrado_em", inicioDoDia)
      .order("registrado_em", { ascending: false })
      .order("id")
      .range(from, to),
  );

  const associadosDistintos = new Set<string>();
  const resumo: AcessosHoje = {
    associados: 0,
    acessosAssociados: 0,
    entradas: { total: 0, ingressos: 0, associados: 0, reentradas: 0 },
    saidas: 0,
    pessoasNoParque: 0,
    negados: { total: 0, negados: 0, bloqueados: 0 },
  };

  for (const linha of linhas) {
    const resultado = linha.resultado as string;
    const tipo = linha.tipo as string;

    if (resultado !== "Autorizado") {
      resumo.negados.total += 1;
      if (resultado === "Bloqueado") resumo.negados.bloqueados += 1;
      else resumo.negados.negados += 1;
      continue;
    }
    if (tipo === "Saída") {
      resumo.saidas += 1;
      continue;
    }
    if (tipo !== "Entrada" && tipo !== "Reentrada") continue;

    resumo.entradas.total += 1;
    if (tipo === "Reentrada") resumo.entradas.reentradas += 1;

    if (linha.ingresso_id) {
      resumo.entradas.ingressos += 1;
    } else {
      resumo.entradas.associados += 1;
      resumo.acessosAssociados += 1;
      const associadoId = (linha.credenciais as Row | null)?.associado_id as string | undefined;
      if (associadoId) associadosDistintos.add(associadoId);
    }
  }

  resumo.associados = associadosDistintos.size;
  resumo.pessoasNoParque = Math.max(0, resumo.entradas.total - resumo.saidas);
  return resumo;
}

/** Entradas autorizadas (Entrada + Reentrada) num dia qualquer — usado para comparar "hoje" com outro dia. */
export async function contarEntradasAutorizadasNoDia(supabase: SupabaseClient, dia: string): Promise<number> {
  const { inicio, fim } = janelaDoDiaBR(dia);
  const { count } = await supabase
    .from("acessos")
    .select("id", { count: "exact", head: true })
    .eq("resultado", "Autorizado")
    .in("tipo", ["Entrada", "Reentrada"])
    .gte("registrado_em", inicio)
    .lt("registrado_em", fim);
  return count ?? 0;
}

function mapCatraca(row: Row): Catraca {
  return {
    id: row.id as string,
    nome: row.nome as string,
    local: (row.local as string) ?? "",
    tipo: row.tipo as Catraca["tipo"],
    status: row.status as Catraca["status"],
  };
}

export async function getCatracas(supabase: SupabaseClient): Promise<Catraca[]> {
  const { data, error } = await supabase.from("catracas").select("*").order("nome");
  if (error) throw error;
  return (data as unknown as Row[]).map(mapCatraca);
}
