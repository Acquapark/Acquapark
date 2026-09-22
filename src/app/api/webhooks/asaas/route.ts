import { NextRequest, NextResponse } from "next/server";
import { processarEventoAsaas } from "@/lib/pagamento-webhook";

/**
 * Endpoint de webhook do Asaas — configure esta URL em Asaas > Integrações >
 * Webhooks, evento "Cobranças", com o mesmo token em ASAAS_WEBHOOK_TOKEN.
 *
 * Autenticação: Asaas manda o token configurado no header
 * `asaas-access-token` (não é a API key). O Asaas entrega "pelo menos uma
 * vez" — o mesmo evento pode chegar mais de uma vez — e `processarEventoAsaas`
 * é idempotente. Respondemos 200 mesmo quando ignoramos o evento ou não
 * encontramos a cobrança, para não entrar num loop de novas tentativas; só
 * token ausente/errado e corpo malformado retornam erro.
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get("asaas-access-token");
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const evento = body?.event as string | undefined;
  const payment = body?.payment as { id?: string; billingType?: string } | undefined;

  if (!evento || !payment?.id) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const result = await processarEventoAsaas(evento, { id: payment.id, billingType: payment.billingType });
  if ("error" in result) {
    // Loga para investigação, mas devolve 200: um erro nosso (ex: coluna cheia)
    // não deve gerar retentativas indefinidas do lado do Asaas.
    console.error("[webhook asaas] falha ao processar", evento, payment.id, result.error);
  }

  return NextResponse.json({ success: true });
}
