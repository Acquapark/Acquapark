import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processarEventoAutentique } from "@/lib/contracts/autentique-webhook";

/**
 * Endpoint de webhook da Autentique — configure esta URL no painel da
 * Autentique (Integrações > Webhooks), eventos de assinatura.
 *
 * Autenticação: em teoria a Autentique assina o corpo com HMAC-SHA256 e manda
 * o resultado no header `x-autentique-signature` (documentado, código abaixo
 * segue esse padrão). Na prática, confirmado nesta conta: o header nunca
 * chega — o painel não expõe um "signing secret" de verdade, só o id do
 * próprio webhook (dois ids recriados em sequência tinham o mesmo prefixo
 * temporal, então não são segredos aleatórios). Por isso a verificação abaixo
 * é best-effort: valida a assinatura SE ela vier, mas não bloqueia quando
 * ausente — o id do documento é uma string longa e opaca gerada pela
 * Autentique, então o pior caso de um evento forjado é 1 contrato marcado
 * como assinado indevidamente (sem dado sensível exposto nem ação financeira).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  const assinaturaRecebida = request.headers.get("x-autentique-signature");
  const rawBody = await request.text();

  if (secret && assinaturaRecebida) {
    const assinaturaEsperada = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(assinaturaRecebida);
    const b = Buffer.from(assinaturaEsperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
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
