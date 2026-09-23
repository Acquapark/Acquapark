"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AssociadoFormState } from "@/components/associados/form-types";
import { AssociadoStatus } from "@/types";
import { calcularPrimeiroVencimento, gerarParcelas, valorComDesconto } from "@/lib/mensalidades-engine";
import { RegraPrimeiraParcela } from "@/types";
import { exigirPermissao } from "@/lib/auth/acesso-atual";
import { gerarContratoParaAssociado, getModeloPadrao } from "@/lib/contracts/gerar";
import { criarDocumentoParaAssinatura } from "@/lib/signature/autentique";
import { sincronizarCobrancaAsaas } from "@/lib/gateway/sincronizar-mensalidade";

/**
 * Gera o contrato a partir do modelo padrão e já envia para assinatura na
 * Autentique — roda ao final do cadastro do associado. Nunca falha a
 * criação do associado: se não houver modelo padrão, ou o envio der erro
 * (API fora do ar, etc.), o contrato fica só "Gerado" (ou nem é criado) e a
 * equipe resolve manualmente depois em Contrato → Enviar p/ assinatura.
 */
async function gerarEEnviarContratoAutomatico(
  supabase: SupabaseClient,
  params: { associadoId: string; associadoNome: string; associadoEmail: string; dataContrato: string; geradoPor: string | null },
) {
  try {
    const modeloId = await getModeloPadrao(supabase);
    if (!modeloId) return;

    const contrato = await gerarContratoParaAssociado(supabase, {
      associadoId: params.associadoId,
      modeloId,
      dataContrato: params.dataContrato,
      geradoPor: params.geradoPor,
    });
    if ("error" in contrato) {
      console.error("Contrato automático não gerado:", contrato.error);
      return;
    }

    const { documentoId } = await criarDocumentoParaAssinatura({
      nomeDocumento: `Contrato ${contrato.numero} - ${params.associadoNome}`,
      conteudoHtml: contrato.conteudoHtml,
      signerNome: params.associadoNome,
      signerEmail: params.associadoEmail,
    });

    await supabase
      .from("contratos_gerados")
      .update({ status: "Enviado para assinatura", enviado_em: new Date().toISOString(), autentique_document_id: documentoId })
      .eq("id", contrato.contratoId);
  } catch (err) {
    console.error("Falha ao gerar/enviar contrato automático para assinatura:", err);
  }
}

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
    .select("dia_vencimento, regra_primeira_parcela, vencimento_na_contratacao")
    .eq("id", planoId)
    .single();
  if (error || !planoRow) return { error: "Plano não encontrado." };

  // Vencimento na data da contratação: não há data da 1ª parcela a validar.
  if (planoRow.vencimento_na_contratacao) return {};

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
  params: {
    associadoId: string;
    planoId: string;
    dataInicio: string;
    valorOverride?: number;
    descontoPercentual?: number;
    primeiraParcelaManual?: string;
  },
) {
  const { data: planoRow, error: planoError } = await supabase
    .from("planos")
    .select("valor, quantidade_mensalidades, dia_vencimento, regra_primeira_parcela, vencimento_na_contratacao")
    .eq("id", params.planoId)
    .single();
  if (planoError || !planoRow) return { error: "Plano não encontrado." };

  const valorAntesDoDesconto = params.valorOverride ?? Number(planoRow.valor);
  const valor = valorComDesconto(valorAntesDoDesconto, params.descontoPercentual ?? 0);
  const quantidadeMensalidades = planoRow.quantidade_mensalidades as number;
  const diaVencimento = planoRow.dia_vencimento as number;
  const vencimentoNaContratacao = Boolean(planoRow.vencimento_na_contratacao);
  // Com vencimento na contratação a 1ª parcela é a própria data da contratação,
  // então o contrato registra a regra "adesao" (o dia fixo e a regra do plano não valem).
  const regraPrimeiraParcela: RegraPrimeiraParcela = vencimentoNaContratacao
    ? "adesao"
    : (planoRow.regra_primeira_parcela as RegraPrimeiraParcela);

  let primeiraParcelaVencimento: string | undefined;
  if (!vencimentoNaContratacao) {
    const resolvido = resolverPrimeiraParcela({
      regraPrimeiraParcela,
      dataInicio: params.dataInicio,
      diaVencimento,
      primeiraParcelaManual: params.primeiraParcelaManual,
    });
    if (resolvido.error) return { error: resolvido.error };
    primeiraParcelaVencimento = resolvido.primeiraParcelaVencimento;
  }

  const { data: contrato, error: contratoError } = await supabase
    .from("contratos")
    .insert({
      associado_id: params.associadoId,
      plano_id: params.planoId,
      data_inicio: params.dataInicio,
      valor,
      quantidade_mensalidades: quantidadeMensalidades,
      regra_primeira_parcela: regraPrimeiraParcela,
      vencimento_na_contratacao: vencimentoNaContratacao,
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
    vencimentoNaContratacao,
  });

  const { data: mensalidadesInseridas, error: mensalidadesError } = await supabase
    .from("mensalidades")
    .insert(
      parcelas.map((p) => ({
        associado_id: params.associadoId,
        contrato_id: contrato.id,
        numero_parcela: p.numeroParcela,
        total_parcelas: p.totalParcelas,
        vencimento: p.vencimento,
        valor: p.valor,
        status: "Pendente",
      })),
    )
    .select("id");
  if (mensalidadesError) return { error: mensalidadesError.message };

  // Cria a cobrança correspondente na Asaas pra cada mensalidade — em sequência
  // (evita rajada na API) e sem bloquear a criação do associado: uma falha aqui
  // fica registrada em `asaas_sync_error` e pode ser reprocessada depois pelo
  // botão "Sincronizar" no Financeiro, mesmo padrão não-bloqueante usado no
  // envio automático de contrato pra assinatura.
  for (const m of mensalidadesInseridas ?? []) {
    await sincronizarCobrancaAsaas(supabase, m.id as string);
  }

  return { contratoId: contrato.id as string, numero: contrato.numero as string };
}

export async function createAssociado(form: AssociadoFormState) {
  const negado = await exigirPermissao("associados.criar");
  if (negado) return { error: negado.error };
  if (!form.email) return { error: "Informe o e-mail do associado — é para onde vai o contrato para assinatura." };
  // O cadastro pode já vincular um plano (gera contrato e mensalidades): isso tem permissão própria.
  if (form.planoId) {
    const semPlano = await exigirPermissao("planos_associado.criar");
    if (semPlano) return { error: "Você não tem permissão para vincular plano. Cadastre o associado sem plano." };
  }
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
    const descontoPercentual = Number(form.desconto.replace(",", ".")) || 0;
    const contratoResult = await criarContratoEMensalidades(supabase, {
      associadoId: associado.id,
      planoId: form.planoId,
      dataInicio: form.dataInicio,
      valorOverride,
      descontoPercentual,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await gerarEEnviarContratoAutomatico(supabase, {
    associadoId: associado.id as string,
    associadoNome: form.nome,
    associadoEmail: form.email,
    dataContrato: new Date().toISOString().slice(0, 10),
    geradoPor: user?.id ?? null,
  });

  revalidatePath(`/associados/${associado.id}`);
  revalidatePath("/associados");
  return {
    associadoId: associado.id as string,
    numero: associado.numero as string,
    credencialCodigo: (credencial?.codigo as string) ?? undefined,
  };
}

export async function deleteAssociado(id: string) {
  const negado = await exigirPermissao("associados.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("associados").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "Este associado tem histórico vinculado e não pode ser excluído. Inative-o em vez de excluir." };
    }
    return { error: error.message };
  }
  revalidatePath("/associados");
  return { success: true };
}

export async function updateAssociado(id: string, form: AssociadoFormState) {
  const negado = await exigirPermissao("associados.editar");
  if (negado) return { error: negado.error };
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
  const negado = await exigirPermissao("dependentes.criar");
  if (negado) return { error: negado.error };
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
  const negado = await exigirPermissao("dependentes.excluir");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("dependentes").delete().eq("id", dependenteId);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${associadoId}`);
  return { success: true };
}

export async function updateAssociadoStatus(id: string, status: AssociadoStatus) {
  const negado = await exigirPermissao("associados.alterar_status");
  if (negado) return { error: negado.error };
  const supabase = await createClient();
  const { error } = await supabase.from("associados").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/associados/${id}`);
  revalidatePath("/associados");
  return { success: true };
}

export async function ensureCredencial(associadoId: string) {
  // Roda sozinha ao abrir a aba Credencial: quem só visualiza recebe a existente, mas não cria uma nova.
  const negado = await exigirPermissao("credenciais.visualizar");
  if (negado) return { error: negado.error };
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

  const semCriar = await exigirPermissao("credenciais.criar");
  if (semCriar) return { error: "Este associado ainda não tem credencial e você não pode gerá-la." };

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
  const negado = await exigirPermissao("credenciais.editar");
  if (negado) return { error: negado.error };
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
  const negado = await exigirPermissao("planos_associado.criar");
  if (negado) return { error: negado.error };
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
  const negado = await exigirPermissao("contas_receber.receber");
  if (negado) return { error: negado.error };
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
  revalidatePath("/financeiro");
  return { success: true };
}
