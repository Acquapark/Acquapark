"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AssociadoFormState } from "@/components/associados/form-types";
import { AssociadoStatus } from "@/types";
import { calcularPrimeiroVencimento, gerarParcelas } from "@/lib/mensalidades-engine";
import { RegraPrimeiraParcela } from "@/types";

function formatarDataBR(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Decide o vencimento da 1ª parcela a partir da regra do plano, validando a
 * coerência cronológica antes de qualquer escrita no banco. Usada tanto para
 * validar cedo (antes de criar o associado, evitando registro órfão se a
 * data escolhida for inválida) quanto dentro de `criarContratoEMensalidades`.
 */
function resolverPrimeiraParcela(params: {
  regraPrimeiraParcela: RegraPrimeiraParcela;
  dataInicio: string;
  diaVencimento: number;
  primeiraParcelaManual?: string;
}): { error?: string; primeiraParcelaVencimento?: string } {
  const { regraPrimeiraParcela, dataInicio, diaVencimento, primeiraParcelaManual } = params;

  if (regraPrimeiraParcela === "adesao") {
    return { primeiraParcelaVencimento: dataInicio };
  }

  if (regraPrimeiraParcela === "manual") {
    if (!primeiraParcelaManual) {
      return { error: "Este plano exige a data da 1ª parcela definida manualmente na contratação." };
    }
    const proximoVencimentoPadrao = calcularPrimeiroVencimento(dataInicio, diaVencimento);
    const manual = new Date(`${primeiraParcelaManual}T00:00:00Z`);
    if (manual.getTime() >= proximoVencimentoPadrao.getTime()) {
      return {
        error: `A data da 1ª parcela deve ser anterior ao vencimento da 2ª parcela (${formatarDataBR(proximoVencimentoPadrao.toISOString().slice(0, 10))}), para manter as parcelas em ordem cronológica.`,
      };
    }
    return { primeiraParcelaVencimento: primeiraParcelaManual };
  }

  return {};
}

/**
 * Valida a regra "Primeira parcela" do plano antes de qualquer escrita —
 * chamada antes de inserir o associado para não deixar um registro órfão
 * (associado sem contrato) quando a data escolhida for inválida.
 */
async function validarPrimeiraParcela(
  supabase: SupabaseClient,
  planoId: string,
  dataInicio: string,
  primeiraParcelaManual?: string,
): Promise<{ error?: string }> {
  const { data: planoRow, error } = await supabase
    .from("planos")
    .select("dia_vencimento, regra_primeira_parcela")
    .eq("id", planoId)
    .single();
  if (error || !planoRow) return { error: "Plano não encontrado." };

  const { error: regraError } = resolverPrimeiraParcela({
    regraPrimeiraParcela: planoRow.regra_primeira_parcela as RegraPrimeiraParcela,
    dataInicio,
    diaVencimento: planoRow.dia_vencimento as number,
    primeiraParcelaManual,
  });
  return { error: regraError };
}

/**
 * Cria o contrato (snapshot das condições do plano no momento da adesão) e
 * gera as mensalidades a partir das regras do plano — seções 12-17 do PRD do
 * Portal do Associado. Alterar o plano depois NÃO deve afetar contratos já
 * criados, por isso lemos o plano aqui e copiamos os valores para o contrato.
 *
 * A regra "Primeira parcela" do plano decide a origem do vencimento da 1ª
 * parcela (padrão do plano / data da adesão / escolhida manualmente); as
 * demais parcelas sempre seguem o dia de vencimento padrão do plano.
 */
async function criarContratoEMensalidades(
  supabase: SupabaseClient,
  params: { associadoId: string; planoId: string; dataInicio: string; valorOverride?: number; primeiraParcelaManual?: string },
) {
  const { data: planoRow, error: planoError } = await supabase
    .from("planos")
    .select("valor, quantidade_mensalidades, dia_vencimento, regra_primeira_parcela")
    .eq("id", params.planoId)
    .single();
  if (planoError || !planoRow) return { error: "Plano não encontrado." };

  const valor = params.valorOverride ?? Number(planoRow.valor);
  const quantidadeMensalidades = planoRow.quantidade_mensalidades as number;
  const diaVencimento = planoRow.dia_vencimento as number;
  const regraPrimeiraParcela = planoRow.regra_primeira_parcela as RegraPrimeiraParcela;

  const { error: regraError, primeiraParcelaVencimento } = resolverPrimeiraParcela({
    regraPrimeiraParcela,
    dataInicio: params.dataInicio,
    diaVencimento,
    primeiraParcelaManual: params.primeiraParcelaManual,
  });
  if (regraError) return { error: regraError };

  const { data: contrato, error: contratoError } = await supabase
    .from("contratos")
    .insert({
      associado_id: params.associadoId,
      plano_id: params.planoId,
      data_inicio: params.dataInicio,
      valor,
      quantidade_mensalidades: quantidadeMensalidades,
      regra_primeira_parcela: regraPrimeiraParcela,
      status: "Ativo",
    })
    .select("id, numero")
    .single();
  if (contratoError || !contrato) {
    return { error: contratoError?.message ?? "Não foi possível criar o contrato." };
  }

  const parcelas = gerarParcelas({
    dataInicio: params.dataInicio,
    diaVencimento,
    quantidadeMensalidades,
    valor,
    primeiraParcelaVencimento,
  });

  const { error: mensalidadesError } = await supabase.from("mensalidades").insert(
    parcelas.map((p) => ({
      associado_id: params.associadoId,
      contrato_id: contrato.id,
      numero_parcela: p.numeroParcela,
      total_parcelas: p.totalParcelas,
      vencimento: p.vencimento,
      valor: p.valor,
      status: "Pendente",
    })),
  );
  if (mensalidadesError) return { error: mensalidadesError.message };

  return { contratoId: contrato.id as string, numero: contrato.numero as string };
}

export async function createAssociado(form: AssociadoFormState) {
  const supabase = await createClient();

  if (form.planoId && form.dataInicio) {
    const validacao = await validarPrimeiraParcela(supabase, form.planoId, form.dataInicio, form.primeiraParcelaData);
    if (validacao.error) return { error: validacao.error };
  }

  const { data: associado, error: associadoError } = await supabase
    .from("associados")
    .insert({
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg || null,
      nascimento: form.nascimento || null,
      sexo: form.sexo || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      numero_endereco: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      observacoes: form.observacoes || null,
      plano_id: form.planoId || null,
      status: "Ativo",
    })
    .select("id, numero")
    .single();

  if (associadoError || !associado) {
    return { error: associadoError?.message ?? "Não foi possível criar o associado." };
  }

  if (form.dependentes.length > 0) {
    const { error: dependentesError } = await supabase.from("dependentes").insert(
      form.dependentes.map((d) => ({
        associado_id: associado.id,
        nome: d.nome,
        cpf: d.cpf || null,
        parentesco: d.parentesco,
        nascimento: d.nascimento || null,
      })),
    );
    if (dependentesError) {
      return { error: dependentesError.message, associadoId: associado.id as string };
    }
  }

  if (form.planoId && form.dataInicio) {
    const valorOverride = form.valorMensalidade ? Number(form.valorMensalidade.replace(",", ".")) : undefined;
    const contratoResult = await criarContratoEMensalidades(supabase, {
      associadoId: associado.id,
      planoId: form.planoId,
      dataInicio: form.dataInicio,
      valorOverride,
      primeiraParcelaManual: form.primeiraParcelaData || undefined,
    });
    if (contratoResult.error) {
      return { error: contratoResult.error, associadoId: associado.id as string };
    }
  }

  const { data: credencial } = await supabase
    .from("credenciais")
    .insert({ associado_id: associado.id })
    .select("codigo")
    .single();

  revalidatePath("/associados");
  return {
    associadoId: associado.id as string,
    numero: associado.numero as string,
    credencialCodigo: (credencial?.codigo as string) ?? undefined,
  };
}

export async function deleteAssociado(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("associados").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/associados");
  return { success: true };
}

export async function updateAssociado(id: string, form: AssociadoFormState) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("associados")
    .update({
      nome: form.nome,
      cpf: form.cpf,
      rg: form.rg || null,
      nascimento: form.nascimento || null,
      sexo: form.sexo || null,
      telefone: form.telefone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      cep: form.cep || null,
      endereco: form.endereco || null,
      numero_endereco: form.numero || null,
      complemento: form.complemento || null,
      bairro: form.bairro || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      observacoes: form.observacoes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/associados/${id}`);
  revalidatePath("/associados");
  return { success: true };
}

export async function addDependente(
  associadoId: string,
  dependente: { nome: string; cpf?: string; rg?: string; nascimento?: string; parentesco: string; sexo?: string },
) {
  const supabase = await createClient();

  const { error } = await supabase.from("dependentes").insert({
    associado_id: associadoId,
    nome: dependente.nome,
    cpf: dependente.cpf || null,
    rg: dependente.rg || null,
    nascimento: dependente.nascimento || null,
    parentesco: dependente.parentesco,
    sexo: dependente.sexo || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function removeDependente(dependenteId: string, associadoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("dependentes").delete().eq("id", dependenteId);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function updateAssociadoStatus(id: string, status: AssociadoStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("associados").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${id}`);
  revalidatePath("/associados");
  return { success: true };
}

export async function ensureCredencial(associadoId: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("credenciais")
    .select("codigo")
    .eq("associado_id", associadoId)
    .eq("ativa", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { codigo: existing.codigo as string };

  const { data, error } = await supabase
    .from("credenciais")
    .insert({ associado_id: associadoId })
    .select("codigo")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível gerar a credencial." };

  revalidatePath(`/associados/${associadoId}`);
  return { codigo: data.codigo as string };
}

export async function regenerarCredencial(associadoId: string) {
  const supabase = await createClient();

  await supabase.from("credenciais").update({ ativa: false }).eq("associado_id", associadoId).eq("ativa", true);

  const { data, error } = await supabase
    .from("credenciais")
    .insert({ associado_id: associadoId })
    .select("codigo")
    .single();

  if (error || !data) return { error: error?.message ?? "Não foi possível regenerar a credencial." };

  revalidatePath(`/associados/${associadoId}`);
  return { codigo: data.codigo as string };
}

export async function vincularPlano(
  associadoId: string,
  planoId: string,
  dataInicio: string,
  valorOverride?: number,
  primeiraParcelaManual?: string,
) {
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("contratos")
    .select("id")
    .eq("associado_id", associadoId)
    .eq("status", "Ativo")
    .maybeSingle();

  if (existente) {
    return { error: "Este associado já possui um contrato ativo. Renovação/troca de plano ainda não está disponível." };
  }

  const result = await criarContratoEMensalidades(supabase, {
    associadoId,
    planoId,
    dataInicio,
    valorOverride,
    primeiraParcelaManual,
  });
  if (result.error) return { error: result.error };

  await supabase.from("associados").update({ plano_id: planoId }).eq("id", associadoId);

  revalidatePath(`/associados/${associadoId}`);
  revalidatePath("/associados");
  return { contratoId: result.contratoId, numero: result.numero };
}

export async function registrarPagamento(
  mensalidadeId: string,
  associadoId: string,
  params: { formaPagamento: string; valor: number },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: pagamentoError } = await supabase.from("pagamentos").insert({
    mensalidade_id: mensalidadeId,
    valor: params.valor,
    forma_pagamento: params.formaPagamento,
    usuario_id: user?.id ?? null,
  });
  if (pagamentoError) return { error: pagamentoError.message };

  const { error: mensalidadeError } = await supabase
    .from("mensalidades")
    .update({ status: "Pago", forma_pagamento: params.formaPagamento, pago_em: new Date().toISOString() })
    .eq("id", mensalidadeId);
  if (mensalidadeError) return { error: mensalidadeError.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}
