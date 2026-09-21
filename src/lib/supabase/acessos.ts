import { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR } from "@/lib/datas-br";
import { buscarTodos } from "@/lib/supabase/paginar";

type Row = Record<string, unknown>;

export interface AcessosHoje {
  /** Associados distintos com pelo menos uma entrada autorizada hoje. */
  associados: number;
  /** Leituras autorizadas de associados hoje (entradas + reentradas). */
  acessosAssociados: number;
  /** Entradas autorizadas hoje (inclui reentradas), de ingressos e de associados. */
  entradas: { total: number; ingressos: number; associados: number; reentradas: number };
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
    if (tipo !== "Entrada" && tipo !== "Reentrada") continue; // saídas autorizadas não são entradas

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
  return resumo;
}
