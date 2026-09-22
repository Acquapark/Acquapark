import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/datas-br";
import { BoletoCharge, CardCheckout, Pagador, PaymentGateway, PixCharge } from "./types";

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

function baseUrl(apiKey: string) {
  return apiKey.startsWith("$aact_prod_") ? BASE_URL_PRODUCAO : BASE_URL_SANDBOX;
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

class AsaasApiError extends Error {}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasApiError("Gateway de pagamento não configurado (ASAAS_API_KEY ausente).");

  const response = await fetch(`${baseUrl(apiKey)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: apiKey, ...init?.headers },
    signal: AbortSignal.timeout(15000),
  });

  const body = (await response.json().catch(() => null)) as (T & AsaasErro) | null;
  if (!response.ok || !body) {
    const descricao = body?.errors?.map((e) => e.description).join(" ") || `Erro ${response.status} no gateway de pagamento.`;
    throw new AsaasApiError(descricao);
  }
  return body;
}

/** Reaproveita o cliente já criado no Asaas para este associado; cria e cacheia na primeira cobrança. */
async function obterOuCriarCliente(pagador: Pagador): Promise<string> {
  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("associados")
    .select("asaas_customer_id")
    .eq("id", pagador.associadoId)
    .maybeSingle();
  if (existente?.asaas_customer_id) return existente.asaas_customer_id as string;

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

  await admin.from("associados").update({ asaas_customer_id: cliente.id }).eq("id", pagador.associadoId);
  return cliente.id;
}

interface AsaasPayment {
  id: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  dueDate: string;
  value: number;
}

async function criarCobranca(params: {
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  mensalidadeId: string;
  valor: number;
  vencimento: string;
  descricao: string;
  pagador: Pagador;
}): Promise<AsaasPayment> {
  const customerId = await obterOuCriarCliente(params.pagador);
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

export class AsaasGateway implements PaymentGateway {
  async criarCobrancaPix(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<PixCharge> {
    const payment = await criarCobranca({ ...params, billingType: "PIX" });
    const qrCode = await asaasFetch<{ payload: string; expirationDate: string }>(`/payments/${payment.id}/pixQrCode`);
    return { chargeId: payment.id, copiaECola: qrCode.payload, valor: payment.value, expiraEm: qrCode.expirationDate };
  }

  async criarCobrancaBoleto(params: {
    mensalidadeId: string;
    valor: number;
    vencimento: string;
    descricao: string;
    pagador: Pagador;
  }): Promise<BoletoCharge> {
    const payment = await criarCobranca({ ...params, billingType: "BOLETO" });
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
  }): Promise<CardCheckout> {
    // Checkout hospedado pelo Asaas — o cartão nunca passa pelos nossos servidores.
    const payment = await criarCobranca({ ...params, billingType: "CREDIT_CARD" });
    return { chargeId: payment.id, checkoutUrl: payment.invoiceUrl, valor: payment.value };
  }
}
