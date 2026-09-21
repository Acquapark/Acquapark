import { NextRequest, NextResponse } from "next/server";
import { processarConfirmacaoPagamento } from "@/lib/pagamento-webhook";

/**
 * Endpoint real de webhook — é aqui que um gateway como Asaas chamaria para
 * confirmar um pagamento (seção 10 do PRD). Hoje só o fluxo de simulação do
 * portal usa esta lógica diretamente (sem passar por HTTP); este endpoint já
 * está pronto para receber notificações de um provedor real no futuro.
 *
 * Validação mínima por segredo compartilhado — troque por validação de
 * assinatura HMAC específica do provedor escolhido quando integrar de vez.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-webhook-secret");
  if (!process.env.PAYMENT_WEBHOOK_SECRET || secret !== process.env.PAYMENT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const chargeId = body?.chargeId as string | undefined;
  const formaPagamento = (body?.formaPagamento as string | undefined) ?? "Pix";

  if (!chargeId) {
    return NextResponse.json({ error: "chargeId é obrigatório." }, { status: 400 });
  }

  const result = await processarConfirmacaoPagamento({ chargeId, formaPagamento });
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
