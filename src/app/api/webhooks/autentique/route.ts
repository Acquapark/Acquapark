import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processarEventoAutentique } from "@/lib/contracts/autentique-webhook";

/**
 * Endpoint de webhook da Autentique — configure esta URL no painel da
 * Autentique (Integrações > Webhooks), eventos de assinatura.
 *
 * Autenticação: a Autentique manda um header `x-autentique-signature`
 * (confirmado em produção), mas o valor exposto no painel como "id do
 * webhook" não é o segredo usado pra gerar essa assinatura — validamos
 * mesmo assim se um dia descobrirmos o valor certo (`AUTENTIQUE_WEBHOOK_SECRET`),
 * mas NUNCA bloqueamos o processamento por causa disso, só logamos um aviso.
 * Risco aceito (combinado com o usuário): o id do documento é uma string
 * longa e opaca gerada pela Autentique, então o pior caso de um evento
 * forjado é 1 contrato marcado como assinado indevidamente — sem dado
 * sensível exposto nem ação financeira.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  const assinaturaRecebida = request.headers.get("x-autentique-signature");
  const rawBody = await request.text();

  if (secret && assinaturaRecebida) {
    const assinaturaEsperada = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(assinaturaRecebida);
    const b = Buffer.from(assinaturaEsperada);
    const valida = a.length === b.length && timingSafeEqual(a, b);
    if (!valida) {
      console.warn("[webhook autentique] assinatura recebida não bate com AUTENTIQUE_WEBHOOK_SECRET — processando mesmo assim (best-effort)");
    }
  }

  const body = JSON.parse(rawBody) as { event?: { type?: string; data?: Record<string, unknown> } };
  const type = body.event?.type;
  const data = body.event?.data;

  if (!type || !data) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const result = await processarEventoAutentique(type, data);
  if ("error" in result) {
    console.error("[webhook autentique] falha ao processar", type, result.error);
  }

  return NextResponse.json({ success: true });
}
