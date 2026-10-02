import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeBR, limitesDoMes, mesAtualBR, rotuloMes, somarDias } from "@/lib/datas-br";

/**
 * Cortesia mensal: todo associado Ativo com plano tem direito a 1 ingresso de
 * cortesia por mês do calendário (contado pela data do resgate), sem acumular.
 * É um ingresso normal de valor zero, ligado ao associado — a catraca, a
 * impressão e a Bilheteria tratam igual a qualquer ingresso.
 */

export interface IngressoCortesia {
  id: string;
  numero: string;
  codigo: string;
  dataUtilizacao: string;
  status: "Disponível" | "Utilizado" | "Cancelado" | "Expirado";
  tipo: string;
}

export interface SituacaoCortesia {
  /** Tipo de ingresso da cortesia configurado e ativo. */
  configurada: boolean;
  mes: string;
  rotuloMes: string;
  hoje: string;
  /** Último dia que pode ser escolhido como data da visita. */
  ultimoDia: string;
  /** Pode resgatar agora (tem direito e ainda não resgatou no mês). */
  podeResgatar: boolean;
  /** Por que não pode resgatar, quando não pode e ainda não resgatou. */
  motivo: string | null;
  ingresso: IngressoCortesia | null;
}

type Row = Record<string, unknown>;

export function ultimoDiaDoMes(mes: string): string {
  return somarDias(limitesDoMes(mes).ate, -1);
}

/** Tipo de ingresso usado na cortesia (Configurações → Tipos de Ingresso), se estiver ativo. */
export async function getTipoCortesia(
  supabase: SupabaseClient,
): Promise<{ id: string; nome: string; regraReentrada: string } | null> {
  const { data: empresa } = await supabase.from("empresa").select("cortesia_tipo_id").eq("id", true).maybeSingle();
  const tipoId = empresa?.cortesia_tipo_id as string | null | undefined;
  if (!tipoId) return null;
  const { data: tipo } = await supabase
    .from("tipos_ingresso")
    .select("id, nome, regra_reentrada, ativo")
    .eq("id", tipoId)
    .maybeSingle();
  if (!tipo || !tipo.ativo) return null;
  return { id: tipo.id as string, nome: tipo.nome as string, regraReentrada: (tipo.regra_reentrada as string) ?? "unica" };
}

export async function getTipoCortesiaId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.from("empresa").select("cortesia_tipo_id").eq("id", true).maybeSingle();
  return (data?.cortesia_tipo_id as string | null) ?? null;
}

function motivoSemDireito(associado: { status: string; plano_id: string | null }): string | null {
  if (!associado.plano_id) return "A cortesia mensal é para associados com plano.";
  if (associado.status !== "Ativo") {
    return associado.status === "Pendente"
      ? "A cortesia fica disponível depois que o pagamento da 1ª mensalidade for confirmado."
      : "A cortesia mensal é para associados com a associação ativa.";
  }
  return null;
}

/** Situação da cortesia do mês atual para o associado. Use o cliente admin no Portal (sempre filtrando pelo associado da sessão). */
export async function getSituacaoCortesia(supabase: SupabaseClient, associadoId: string): Promise<SituacaoCortesia> {
  const hoje = hojeBR();
  const mes = mesAtualBR();
  const [tipo, { data: associado }, { data: ingressoRow }] = await Promise.all([
    getTipoCortesia(supabase),
    supabase.from("associados").select("status, plano_id").eq("id", associadoId).maybeSingle(),
    supabase
      .from("ingressos")
      .select("id, numero, codigo, data_utilizacao, status, tipos_ingresso ( nome )")
      .eq("associado_id", associadoId)
      .eq("cortesia_mes", mes)
      .neq("status", "Cancelado")
      .maybeSingle(),
  ]);

  const ingresso: IngressoCortesia | null = ingressoRow
    ? {
        id: ingressoRow.id as string,
        numero: ingressoRow.numero as string,
        codigo: ingressoRow.codigo as string,
        dataUtilizacao: ingressoRow.data_utilizacao as string,
        status: ingressoRow.status as IngressoCortesia["status"],
        tipo: (((ingressoRow as Row).tipos_ingresso as Row | null)?.nome as string) ?? "Cortesia",
      }
    : null;

  const motivo = !tipo
    ? "A cortesia mensal ainda não está disponível."
    : associado
      ? motivoSemDireito({ status: associado.status as string, plano_id: (associado.plano_id as string) ?? null })
      : "Associado não encontrado.";

  return {
    configurada: !!tipo,
    mes,
    rotuloMes: rotuloMes(mes),
    hoje,
    ultimoDia: ultimoDiaDoMes(mes),
    podeResgatar: !ingresso && !motivo,
    motivo: ingresso ? null : motivo,
    ingresso,
  };
}

/**
 * Emite a cortesia do mês. Toda a validação acontece aqui (o Portal e o painel
 * só chamam); o limite de 1 por mês é garantido também pelo índice único do
 * banco, então dois resgates simultâneos nunca geram duas cortesias.
 * Precisa do cliente admin: o Portal não tem permissão de inserir ingressos.
 */
export async function resgatarCortesia(
  admin: SupabaseClient,
  params: { associadoId: string; dataUtilizacao: string; resgatadoPor: string | null },
): Promise<{ error: string } | { ingressoId: string }> {
  const situacao = await getSituacaoCortesia(admin, params.associadoId);
  if (situacao.ingresso) return { error: `A cortesia de ${situacao.rotuloMes} já foi resgatada.` };
  if (situacao.motivo) return { error: situacao.motivo };

  const data = params.dataUtilizacao;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < situacao.hoje || data > situacao.ultimoDia) {
    return { error: "Escolha a data da visita entre hoje e o último dia do mês." };
  }

  const tipo = await getTipoCortesia(admin);
  if (!tipo) return { error: "A cortesia mensal ainda não está disponível." };

  const { data: ingresso, error } = await admin
    .from("ingressos")
    .insert({
      tipo_id: tipo.id,
      comprador_nome: null,
      data_utilizacao: data,
      valor: 0,
      regra_reentrada: tipo.regraReentrada,
      sem_expiracao: false,
      forma_pagamento: "Cortesia",
      vendido_por: params.resgatadoPor,
      associado_id: params.associadoId,
      cortesia_mes: situacao.mes,
    })
    .select("id")
    .single();

  if (error || !ingresso) {
    if (error?.code === "23505") return { error: `A cortesia de ${situacao.rotuloMes} já foi resgatada.` };
    return { error: error?.message ?? "Não foi possível resgatar a cortesia." };
  }
  return { ingressoId: ingresso.id as string };
}
