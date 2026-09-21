import { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR } from "@/lib/datas-br";
import { buscarTodos } from "@/lib/supabase/paginar";

type Row = Record<string, unknown>;

export interface AssociadosHoje {
  /** Associados distintos com pelo menos uma entrada autorizada hoje. */
  associados: number;
  /** Total de leituras autorizadas de associados hoje (entradas + reentradas). */
  acessos: number;
}

export async function getAssociadosHoje(supabase: SupabaseClient): Promise<AssociadosHoje> {
  const inicioDoDia = `${hojeBR()}T00:00:00-03:00`;

  const { linhas } = await buscarTodos<Row>((from, to) =>
    supabase
      .from("acessos")
      .select("id, credenciais!inner ( associado_id )")
      .not("credencial_id", "is", null)
      .eq("resultado", "Autorizado")
      .in("tipo", ["Entrada", "Reentrada"])
      .gte("registrado_em", inicioDoDia)
      .order("registrado_em", { ascending: false })
      .order("id")
      .range(from, to),
  );

  const distintos = new Set<string>();
  for (const linha of linhas) {
    const associadoId = (linha.credenciais as Row | null)?.associado_id as string | undefined;
    if (associadoId) distintos.add(associadoId);
  }
  return { associados: distintos.size, acessos: linhas.length };
}
