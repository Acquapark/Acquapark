import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/datas-br";
import { BoletoCharge, CardCheckout, CobrancaResumo, Pagador, PaymentGateway, PixCharge, TipoCobranca } from "./types";

/**
 * Integração real com o Asaas (https://docs.asaas.com). API key em
 * ASAAS_API_KEY — o ambiente (sandbox/produção) é detectado pelo prefixo da
 * própria chave ($aact_prod_ vs $aact_hmlg_), não precisa de outra variável.
 *
 * Fluxo: garante o cliente no Asaas (cacheado em associados.asaas_customer_id)
 * → cria a cobrança (POST /payments) → busca o QR Code do Pix ou a linha
 * digitável do boleto, que são endpoints separados na API do Asaas.
 * A confirmação chega depois via webhook (src/app/api/webhooks/asaas).
 */

const BASE_URL_PRODUCAO = "https://api.asaas.com/v3";
const BASE_URL_SANDBOX = "https://api-sandbox.asaas.com/v3";

/** Sandbox e produção são contas completamente separadas no Asaas — nada criado numa existe na outra. */
function ambiente(apiKey: string): "production" | "sandbox" {
  return apiKey.startsWith("$aact_prod_") ? "production" : "sandbox";
}

function baseUrl(apiKey: string) {
  return ambiente(apiKey) === "production" ? BASE_URL_PRODUCAO : BASE_URL_SANDBOX;
}

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

/** Asaas recusa dueDate no passado; mensalidades vencidas continuam cobráveis, só com o vencimento "adiado" na cobrança em si. */
function dueDate(vencimento: string) {
  return vencimento < hojeBR() ? hojeBR() : vencimento;
}

interface AsaasErro {
  errors?: { code: string; description: string }[];
}

class AsaasApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

function getApiKey(): string {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasApiError("Gateway de pagamento não configurado (ASAAS_API_KEY ausente).");
  return apiKey;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = getApiKey();

  const response = await fetch(`${baseUrl(apiKey)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: apiKey, ...init?.headers },
    signal: AbortSignal.timeout(15000),
  });

  const body = (await response.json().catch(() => null)) as (T & AsaasErro) | null;
  if (!response.ok || !body) {
    const descricao = body?.errors?.map((e) => e.description).join(" ") || `Erro ${response.status} no gateway de pagamento.`;
    throw new AsaasApiError(descricao, response.status);
  }
  return body;
}

/**
 * Reaproveita o cliente já criado no Asaas para este associado; cria e cacheia
 * na primeira cobrança. Só reaproveita se foi criado no MESMO ambiente da
 * chave atual — um id de cliente do sandbox não existe do lado da produção
 * (e vice-versa), então usar o cache do ambiente errado falha na hora de
 * criar a cobrança ("Customer inválido").
 */
async function obterOuCriarCliente(pagador: Pagador, apiKey: string): Promise<string> {
  const admin = createAdminClient();
  const env = ambiente(apiKey);

  const { data: existente } = await admin
    .from("associados")
    .select("asaas_customer_id, asaas_customer_env")
    .eq("id", pagador.associadoId)
    .maybeSingle();
  if (existente?.asaas_customer_id && existente.asaas_customer_env === env) {
    return existente.asaas_customer_id as string;
  }

  const cliente = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: pagador.nome,
      cpfCnpj: apenasDigitos(pagador.cpf),
      email: pagador.email || undefined,
      mobilePhone: pagador.telefone ? apenasDigitos(pagador.telefone) : undefined,
      externalReference: pagador.associadoId,
    }),
  });

  await admin.from("associados").update({ asaas_customer_id: cliente.id, asaas_customer_env: env }).eq("id", pagador.associadoId);
  return cliente.id;
}

type AsaasBillingType = "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED";

interface AsaasPayment {
  id: string;
  status: string;
  billingType: AsaasBillingType;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  dueDate: string;
  value: number;
}

const TIPO_PARA_ASAAS: Record<TipoCobranca, AsaasBillingType> = {
  Pix: "PIX",
  Boleto: "BOLETO",
  Cartão: "CREDIT_CARD",
  Undefined: "UNDEFINED",
};

const ASAAS_PARA_TIPO: Record<AsaasBillingType, TipoCobranca> = {
  PIX: "Pix",
  BOLETO: "Boleto",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "Undefined",
};

function paraResumo(payment: AsaasPayment): CobrancaResumo {
  return {
    chargeId: payment.id,
    status: payment.status,
    tipo: ASAAS_PARA_TIPO[payment.billingType] ?? "Undefined",
    vencimento: payment.dueDate,
    valor: payment.value,
    invoiceUrl: payment.invoiceUrl,
  };
}

async function criarCobranca(params: {
  billingType: AsaasBillingType;
  mensalidadeId: string;
  valor: number;
  vencimento: string;
  descricao: string;
  pagador: Pagador;
}): Promise<AsaasPayment> {
  const customerId = await obterOuCriarCliente(params.pagador, getApiKey());
  return asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType: params.billingType,
      value: params.valor,
      dueDate: dueDate(params.vencimento),
      description: params.descricao,
      externalReference: params.mensalidadeId,
    }),
  });
}

/**
 * PUT /payments/{id} — a Asaas documenta billingType+value+dueDate como
 * obrigatórios juntos na atualização (não é um PATCH parcial), então sempre
 * manda os três mesmo quando só um mudou.
 */
async function atualizarCobrancaAsaas(
  chargeId: string,
  params: { billingType: AsaasBillingType; valor: number; vencimento: string },
): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${chargeId}`, {
    method: "PUT",
    body: JSON.stringify({
      billingType: params.billingType,
      value: params.valor,
      dueDate: dueDate(params.vencimento),
    }),
  });
}

async function buscarCobrancaAsaas(chargeId: string): Promise<AsaasPayment | null> {
  try {
    return await asaasFetch<AsaasPayment>(`/payments/${chargeId}`);
  } catch (err) {
    if (err instanceof AsaasApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Cria a cobrança com o `billingType` pedido — ou, se `chargeIdExistente` vier
 * preenchido (cobrança já criada antecipadamente na adesão), atualiza essa
 * mesma cobrança em vez de criar outra (PUT em vez de POST).
 */
async function criarOuAtualizarCobranca(params: {
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  mensalidadeId: string;
  valor: number;
  vencimento: string;
  descricao: string;
  pagador: Pagador;
  chargeIdExistente?: string;
}): Promise<AsaasPayment> {
  if (params.chargeIdExistente) {
    return atualizarCobrancaAsaas(params.chargeIdExistente, {
      billingType: params.billingType,
      valor: params.valor,
      vencimento: params.vencimento,
    });
  }
  return criarCobranca(params);
}

export class AsaasGateway implements PaymentGateway {
  async criarCobrancaPix(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<PixCharge> {
    const payment = await criarOuAtualizarCobranca({ ...params, billingType: "PIX" });
    const qrCode = await asaasFetch<{ payload: string; expirationDate: string }>(`/payments/${payment.id}/pixQrCode`);
    return { chargeId: payment.id, copiaECola: qrCode.payload, valor: payment.value, expiraEm: qrCode.expirationDate };
  }

  async criarCobrancaBoleto(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<BoletoCharge> {
    const payment = await criarOuAtualizarCobranca({ ...params, billingType: "BOLETO" });
    const identificacao = await asaasFetch<{ identificationField: string }>(`/payments/${payment.id}/identificationField`);
    return {
      chargeId: payment.id,
      linhaDigitavel: identificacao.identificationField,
      urlBoleto: payment.bankSlipUrl ?? payment.invoiceUrl,
      valor: payment.value,
      vencimento: payment.dueDate,
    };
  }

  async criarCheckoutCartao(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
    chargeIdExistente?: string;
  }): Promise<CardCheckout> {
    // Checkout hospedado pelo Asaas — o cartão nunca passa pelos nossos servidores.
    const payment = await criarOuAtualizarCobranca({ ...params, billingType: "CREDIT_CARD" });
    return { chargeId: payment.id, checkoutUrl: payment.invoiceUrl, valor: payment.value };
  }

  /** Cria a cobrança com billingType "UNDEFINED" — usada na criação antecipada, no momento da adesão. */
  async criarCobrancaPendente(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<CobrancaResumo> {
    const payment = await criarCobranca({ ...params, billingType: "UNDEFINED" });
    return paraResumo(payment);
  }

  async buscarCobranca(chargeId: string): Promise<CobrancaResumo | null> {
    const payment = await buscarCobrancaAsaas(chargeId);
    return payment ? paraResumo(payment) : null;
  }

  async atualizarCobranca(chargeId: string, params: { tipo: TipoCobranca; valor: number; vencimento: string }): Promise<CobrancaResumo> {
    const payment = await atualizarCobrancaAsaas(chargeId, {
      billingType: TIPO_PARA_ASAAS[params.tipo],
      valor: params.valor,
      vencimento: params.vencimento,
    });
    return paraResumo(payment);
  }

  async cancelarCobranca(chargeId: string): Promise<{ cancelada: boolean }> {
    const resultado = await asaasFetch<{ deleted: boolean; id: string }>(`/payments/${chargeId}`, { method: "DELETE" });
    return { cancelada: resultado.deleted };
  }
}
