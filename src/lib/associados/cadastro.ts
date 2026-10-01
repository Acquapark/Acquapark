import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { calcularPrimeiroVencimento, gerarParcelas, valorComDesconto } from "@/lib/mensalidades-engine";
import { RegraPrimeiraParcela } from "@/types";
import { gerarContratoParaAssociado, getModeloPadrao } from "@/lib/contracts/gerar";
import { criarDocumentoParaAssinatura } from "@/lib/signature/autentique";
import { sincronizarCobrancaAsaas } from "@/lib/gateway/sincronizar-mensalidade";
import { getModeloById } from "@/lib/supabase/contratos";
import { criarLoginDoAssociado } from "./acesso-portal";
import { getContratoAutomatico } from "@/lib/termos";
import { FOTO_TAMANHO_MAXIMO } from "./autocadastro-tipos";
import { variaveisDoAssociadoUsadas } from "@/lib/contracts/variables";

/*
 * Etapas do cadastro de associado compartilhadas entre o painel da equipe
 * (createAssociado / vincularPlano) e o autocadastro público (/cadastro).
 * Fora de um arquivo "use server" de propósito: nada aqui vira endpoint.
 */

/**
 * Gera o contrato a partir do modelo padrão e já envia para assinatura na
 * Autentique — roda ao final do cadastro do associado. Nunca falha a
 * criação do associado: se não houver modelo padrão, faltar dado exigido pelo
 * modelo, ou o envio der erro (API fora do ar, etc.), o contrato fica só
 * "Gerado" (ou nem é criado) e a equipe resolve manualmente depois em
 * Contrato → Gerar / Enviar p/ assinatura. Retorna o motivo quando algo não
 * saiu (null = gerado e enviado), para quem chamou poder avisar a equipe.
 */
export async function gerarEEnviarContratoAutomatico(
  supabase: SupabaseClient,
  params: { associadoId: string; associadoNome: string; associadoEmail: string; dataContrato: string; geradoPor: string | null },
): Promise<string | null> {
  let contratoGerado = false;
  try {
    // Pausado em Configurações → Dados do Parque: o associado aceita os termos de adesão no lugar.
    if (!(await getContratoAutomatico(supabase))) return null;

    const modeloId = await getModeloPadrao(supabase);
    if (!modeloId) {
      return "O contrato não foi gerado: não há modelo de contrato padrão ativo (menu Contratos → Marcar como padrão).";
    }

    const contrato = await gerarContratoParaAssociado(supabase, {
      associadoId: params.associadoId,
      modeloId,
      dataContrato: params.dataContrato,
      geradoPor: params.geradoPor,
    });
    if ("error" in contrato) {
      console.error("Contrato automático não gerado:", contrato.error);
      const faltando = contrato.missing?.map((m) => `${m.label} (${m.group})`).join(", ");
      return faltando
        ? `O contrato não foi gerado: faltam dados usados no modelo — ${faltando}. Complete o cadastro e gere pela aba Contrato.`
        : `O contrato não foi gerado: ${contrato.error}`;
    }
    contratoGerado = true;

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
    return null;
  } catch (err) {
    console.error("Falha ao gerar/enviar contrato automático para assinatura:", err);
    const detalhe = err instanceof Error ? err.message : "erro desconhecido";
    return contratoGerado
      ? `O contrato foi gerado, mas não foi enviado para assinatura (${detalhe}). Envie pela aba Contrato.`
      : `O contrato não foi gerado (${detalhe}).`;
  }
}

/**
 * Dados do associado que o modelo de contrato padrão usa — o cadastro exige
 * esses campos para o contrato automático não falhar por falta de informação.
 */
export async function camposExigidosPeloContrato(supabase: SupabaseClient) {
  if (!(await getContratoAutomatico(supabase))) return [];
  const modeloId = await getModeloPadrao(supabase);
  if (!modeloId) return [];
  const modelo = await getModeloById(supabase, modeloId);
  return modelo ? variaveisDoAssociadoUsadas(modelo.conteudoHtml) : [];
}

/**
 * Cria o acesso ao Portal do Associado automaticamente no cadastro. No painel
 * a senha padrão é o CPF (só números); no autocadastro é a senha que o próprio
 * associado escolheu. Nunca falha a criação do associado: se o e-mail
 * já estiver em uso por outra conta, ou a criação der erro por qualquer
 * motivo, o acesso simplesmente não é criado e a equipe pode criar manualmente
 * depois pela aba Acesso — mesmo padrão não-bloqueante do contrato automático.
 * Retorna se o acesso foi criado.
 */
export async function criarAcessoAutomatico(associadoId: string, email: string, senha: string): Promise<boolean> {
  try {
    if (senha.length < 6) return false;

    const result = await criarLoginDoAssociado(createAdminClient(), { associadoId, email, senha });
    if ("error" in result) {
      console.error("Acesso automático ao Portal não criado:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Falha ao criar acesso automático ao Portal:", err);
    return false;
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
export async function validarPrimeiraParcela(
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
export async function criarContratoEMensalidades(
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

export const BUCKET_FOTOS = "associados-fotos";
const TIPOS_FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Confere a foto vinda de um FormData (autocadastro e painel usam as mesmas regras). */
export function validarFoto(foto: FormDataEntryValue | null): { error: string } | { arquivo: File; extensao: string } {
  if (!(foto instanceof File) || foto.size === 0) return { error: "A foto é obrigatória." };
  const extensao = TIPOS_FOTO[foto.type];
  if (!extensao) return { error: "Envie a foto em JPG, PNG ou WEBP." };
  if (foto.size > FOTO_TAMANHO_MAXIMO) return { error: "A foto ficou muito grande. Tente outra imagem." };
  return { arquivo: foto, extensao };
}

/** Guarda a foto no bucket privado e devolve o caminho a gravar em `foto_url`. */
export async function enviarFoto(
  supabase: SupabaseClient,
  foto: { arquivo: File; extensao: string },
): Promise<{ error: string } | { caminho: string }> {
  const caminho = `${crypto.randomUUID()}.${foto.extensao}`;
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .upload(caminho, Buffer.from(await foto.arquivo.arrayBuffer()), { contentType: foto.arquivo.type });
  if (error) {
    console.error("Falha ao enviar foto do associado:", error.message);
    return { error: "Não foi possível enviar a foto. Tente novamente." };
  }
  return { caminho };
}
