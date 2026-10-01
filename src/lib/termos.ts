import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

export interface TermoVersao {
  id: string;
  versao: number;
  conteudo: string;
  publicadoEm: string;
}

export interface AceiteTermos {
  versao: number;
  aceitoEm: string;
  origem: "autocadastro" | "portal";
  ip: string | null;
}

type Row = Record<string, unknown>;

function mapVersao(row: Row): TermoVersao {
  return {
    id: row.id as string,
    versao: row.versao as number,
    conteudo: row.conteudo as string,
    publicadoEm: row.publicado_em as string,
  };
}

/** Contrato automático (documento para assinatura na Autentique) — ligado em Configurações → Dados do Parque. */
export async function getContratoAutomatico(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from("empresa").select("contrato_automatico").eq("id", true).maybeSingle();
  return Boolean(data?.contrato_automatico);
}

/** Versão em vigor dos termos de adesão (a última publicada), ou null se nenhuma foi publicada. */
export async function getTermoVigente(supabase: SupabaseClient): Promise<TermoVersao | null> {
  const { data } = await supabase
    .from("termos_versoes")
    .select("id, versao, conteudo, publicado_em")
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapVersao(data as Row) : null;
}

export async function getVersoesTermos(supabase: SupabaseClient): Promise<(TermoVersao & { publicadoPor: string })[]> {
  const { data, error } = await supabase
    .from("termos_versoes")
    .select("id, versao, conteudo, publicado_em, usuarios ( nome )")
    .order("versao", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map((row) => ({
    ...mapVersao(row),
    publicadoPor: ((row.usuarios as Row | null)?.nome as string) ?? "—",
  }));
}

/** Último aceite do associado (qualquer versão). */
export async function getUltimoAceite(supabase: SupabaseClient, associadoId: string): Promise<AceiteTermos | null> {
  const { data } = await supabase
    .from("termos_aceites")
    .select("aceito_em, origem, ip, termos_versoes ( versao )")
    .eq("associado_id", associadoId)
    .order("aceito_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Row;
  return {
    versao: ((row.termos_versoes as Row | null)?.versao as number) ?? 0,
    aceitoEm: row.aceito_em as string,
    origem: row.origem as AceiteTermos["origem"],
    ip: (row.ip as string) ?? null,
  };
}

/** True quando há termos publicados e o associado ainda não aceitou a versão em vigor. */
export async function termosPendentes(supabase: SupabaseClient, associadoId: string): Promise<boolean> {
  const vigente = await getTermoVigente(supabase);
  if (!vigente) return false;
  const { count } = await supabase
    .from("termos_aceites")
    .select("id", { count: "exact", head: true })
    .eq("associado_id", associadoId)
    .eq("versao_id", vigente.id);
  return !count;
}

/**
 * Grava o aceite (prova): versão, data/hora, IP e navegador da requisição.
 * Usar o cliente com service role — `termos_aceites` não tem política de escrita.
 */
export async function registrarAceite(
  admin: SupabaseClient,
  params: { associadoId: string; versaoId: string; origem: AceiteTermos["origem"] },
): Promise<{ error?: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const { error } = await admin.from("termos_aceites").upsert(
    {
      associado_id: params.associadoId,
      versao_id: params.versaoId,
      origem: params.origem,
      ip,
      user_agent: h.get("user-agent")?.slice(0, 500) ?? null,
    },
    { onConflict: "associado_id,versao_id", ignoreDuplicates: true },
  );
  return { error: error?.message };
}
