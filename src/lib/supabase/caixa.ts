import { SupabaseClient } from "@supabase/supabase-js";
import { Caixa, CaixaLancamento, CaixaMovimento, CaixaResumo } from "@/types";

type Row = Record<string, unknown>;

const CAIXA_SELECT = "*, operador:usuarios!operador_id ( nome )";

function mapCaixa(row: Row): Caixa {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: row.id as string,
    numero: row.numero as string,
    operadorId: row.operador_id as string,
    operadorNome: (row.operador_nome as string) ?? ((row.operador as Row | null)?.nome as string) ?? "—",
    status: row.status as Caixa["status"],
    valorAbertura: Number(row.valor_abertura),
    abertoEm: row.aberto_em as string,
    fechadoEm: (row.fechado_em as string) ?? null,
    valorEsperado: num(row.valor_esperado),
    valorContado: num(row.valor_contado),
    diferenca: num(row.diferenca),
    observacoes: (row.observacoes as string) ?? null,
    reaberturas: (row.reaberturas as number) ?? 0,
  };
}

export async function getCaixaAberto(supabase: SupabaseClient, operadorId: string): Promise<Caixa | null> {
  const { data, error } = await supabase
    .from("caixas")
    .select(CAIXA_SELECT)
    .eq("operador_id", operadorId)
    .eq("status", "Aberto")
    .maybeSingle();
  if (error || !data) return null;
  return mapCaixa(data as unknown as Row);
}

/** apenasOperadorId: restringe ao histórico de um operador (quem não pode ver os caixas dos outros). */
export async function getCaixas(supabase: SupabaseClient, limit = 40, apenasOperadorId?: string): Promise<Caixa[]> {
  let query = supabase.from("caixas").select(CAIXA_SELECT).order("aberto_em", { ascending: false }).limit(limit);
  if (apenasOperadorId) query = query.eq("operador_id", apenasOperadorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as Row[]).map(mapCaixa);
}

export async function getCaixaResumo(supabase: SupabaseClient, caixaId: string): Promise<CaixaResumo | null> {
  const [caixaRes, movRes, pagRes] = await Promise.all([
    supabase.from("caixas").select(CAIXA_SELECT).eq("id", caixaId).maybeSingle(),
    supabase
      .from("caixa_movimentos")
      .select("id, tipo, valor, motivo, created_at")
      .eq("caixa_id", caixaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pagamentos")
      .select("id, valor, forma_pagamento, referencia, pago_em")
      .eq("caixa_id", caixaId)
      .order("pago_em", { ascending: false }),
  ]);
  if (caixaRes.error || !caixaRes.data) return null;

  const caixa = mapCaixa(caixaRes.data as unknown as Row);

  const movimentos: CaixaMovimento[] = ((movRes.data ?? []) as unknown as Row[]).map((m) => ({
    id: m.id as string,
    tipo: m.tipo as CaixaMovimento["tipo"],
    valor: Number(m.valor),
    motivo: (m.motivo as string) ?? null,
    createdAt: m.created_at as string,
  }));

  const lancamentos: CaixaLancamento[] = ((pagRes.data ?? []) as unknown as Row[]).map((p) => ({
    id: p.id as string,
    valor: Number(p.valor),
    forma: p.forma_pagamento as string,
    referencia: (p.referencia as string) ?? null,
    pagoEm: p.pago_em as string,
  }));

  const suprimentos = movimentos.filter((m) => m.tipo === "Suprimento").reduce((s, m) => s + m.valor, 0);
  const sangrias = movimentos.filter((m) => m.tipo === "Sangria").reduce((s, m) => s + m.valor, 0);
  const vendas = lancamentos.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const estornos = Math.abs(lancamentos.filter((l) => l.valor < 0).reduce((s, l) => s + l.valor, 0));

  const porForma: Record<string, number> = {};
  for (const l of lancamentos) porForma[l.forma] = (porForma[l.forma] ?? 0) + l.valor;

  const dinheiroEsperado =
    caixa.valorEsperado ?? caixa.valorAbertura + suprimentos - sangrias + (porForma["Dinheiro"] ?? 0);

  return { caixa, movimentos, lancamentos, suprimentos, sangrias, vendas, estornos, porForma, dinheiroEsperado };
}
