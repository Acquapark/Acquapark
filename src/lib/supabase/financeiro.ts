import { SupabaseClient } from "@supabase/supabase-js";
import { Despesa } from "@/types";
import { hojeBR, limitesDoMes } from "@/lib/datas-br";

type Row = Record<string, unknown>;

export interface ContaReceber {
  id: string;
  associadoId: string;
  associadoNome: string;
  associadoNumero: string;
  numeroParcela: number | null;
  totalParcelas: number | null;
  vencimento: string;
  valor: number;
  /** "Vencido" é calculado: Pendente com vencimento antes de hoje. */
  status: "Pendente" | "Vencido" | "Em processamento";
}

export async function getContasReceber(supabase: SupabaseClient): Promise<ContaReceber[]> {
  const hoje = hojeBR();
  const { data, error } = await supabase
    .from("mensalidades")
    .select("id, associado_id, vencimento, valor, status, numero_parcela, total_parcelas, associados ( nome, numero )")
    .in("status", ["Pendente", "Vencido", "Em processamento"])
    .order("vencimento")
    .limit(1000);
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const associado = row.associados as Row | null;
    const status = row.status as string;
    const vencimento = row.vencimento as string;
    return {
      id: row.id as string,
      associadoId: row.associado_id as string,
      associadoNome: (associado?.nome as string) ?? "—",
      associadoNumero: (associado?.numero as string) ?? "",
      numeroParcela: (row.numero_parcela as number) ?? null,
      totalParcelas: (row.total_parcelas as number) ?? null,
      vencimento,
      valor: Number(row.valor),
      status:
        status === "Em processamento"
          ? "Em processamento"
          : status === "Vencido" || vencimento < hoje
            ? "Vencido"
            : "Pendente",
    };
  });
}

export interface Recebimento {
  id: string;
  data: string; // ISO (timestamptz)
  tipo: "Mensalidade" | "Ingresso" | "Estorno" | "Outro";
  origem: string;
  valor: number;
  forma: string;
  responsavel: string;
}

export async function getRecebimentos(supabase: SupabaseClient, mes: string): Promise<Recebimento[]> {
  let query = supabase
    .from("pagamentos")
    .select(
      "id, valor, forma_pagamento, referencia, pago_em, mensalidades ( numero_parcela, total_parcelas, associados ( nome ) ), ingressos ( numero, comprador_nome ), usuarios ( nome )",
    )
    .order("pago_em", { ascending: false })
    .limit(2000);

  if (mes !== "todos") {
    const { de, ate } = limitesDoMes(mes);
    query = query.gte("pago_em", `${de}T00:00:00-03:00`).lt("pago_em", `${ate}T00:00:00-03:00`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const mensalidade = row.mensalidades as Row | null;
    const ingresso = row.ingressos as Row | null;
    const valor = Number(row.valor);

    let tipo: Recebimento["tipo"] = "Outro";
    let origem = (row.referencia as string) ?? "—";
    if (mensalidade) {
      tipo = "Mensalidade";
      const parcela = mensalidade.numero_parcela ? ` ${mensalidade.numero_parcela}/${mensalidade.total_parcelas}` : "";
      origem = `Mensalidade${parcela} — ${((mensalidade.associados as Row | null)?.nome as string) ?? "—"}`;
    } else if (ingresso) {
      tipo = valor < 0 ? "Estorno" : "Ingresso";
      origem = `${valor < 0 ? "Estorno " : ""}${ingresso.numero as string}${ingresso.comprador_nome ? ` — ${ingresso.comprador_nome as string}` : ""}`;
    }

    return {
      id: row.id as string,
      data: row.pago_em as string,
      tipo,
      origem,
      valor,
      forma: row.forma_pagamento as string,
      responsavel: ((row.usuarios as Row | null)?.nome as string) ?? "Sistema",
    };
  });
}

export async function getDespesas(supabase: SupabaseClient): Promise<Despesa[]> {
  const hoje = hojeBR();
  const { data, error } = await supabase
    .from("despesas")
    .select("*")
    .order("vencimento", { ascending: false })
    .limit(1000);
  if (error) throw error;

  return (data as unknown as Row[]).map((row) => {
    const status = row.status as string;
    const vencimento = row.vencimento as string;
    return {
      id: row.id as string,
      descricao: row.descricao as string,
      categoria: row.categoria as string,
      valor: Number(row.valor),
      vencimento,
      status: status === "Pago" ? "Pago" : vencimento < hoje ? "Vencido" : "Pendente",
      fornecedor: (row.fornecedor as string) ?? undefined,
      pagoEm: (row.pago_em as string) ?? undefined,
      formaPagamento: (row.forma_pagamento as string) ?? undefined,
      observacoes: (row.observacoes as string) ?? undefined,
    };
  });
}
