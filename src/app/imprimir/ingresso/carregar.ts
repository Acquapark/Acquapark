import type { SupabaseClient } from "@supabase/supabase-js";
import type { TicketData } from "./[id]/TicketPrint";

export async function carregarTickets(supabase: SupabaseClient, ids: string[]): Promise<TicketData[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("ingressos")
    .select(
      "id, numero, codigo, comprador_nome, data_utilizacao, valor, forma_pagamento, regra_reentrada, sem_expiracao, created_at, tipos_ingresso ( nome )",
    )
    .in("id", ids)
    .order("numero");

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    numero: row.numero as string,
    codigo: row.codigo as string,
    tipo: ((row.tipos_ingresso as Record<string, unknown> | null)?.nome as string) ?? "Ingresso",
    comprador: (row.comprador_nome as string) ?? "",
    dataUtilizacao: row.data_utilizacao as string,
    valor: Number(row.valor),
    formaPagamento: (row.forma_pagamento as string) ?? null,
    regraReentrada: (row.regra_reentrada as "unica" | "reentrada" | "ilimitado") ?? "unica",
    semExpiracao: (row.sem_expiracao as boolean) ?? false,
    emitidoEm: row.created_at as string,
  }));
}
