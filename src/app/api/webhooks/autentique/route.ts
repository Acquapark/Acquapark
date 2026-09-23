import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { processarEventoAutentique } from "@/lib/contracts/autentique-webhook";

/**
 * Endpoint de webhook da Autentique — configure esta URL no painel da
 * Autentique (Integrações > Webhooks), eventos "document.finished" e
 * "signature.rejected", com o mesmo segredo em AUTENTIQUE_WEBHOOK_SECRET.
 *
 * Autenticação: a Autentique assina o corpo cru com HMAC-SHA256 usando o
 * segredo do webhook e manda o resultado no header `x-autentique-signature`.
 * Precisa ler o corpo como texto (não JSON) antes de calcular o HMAC, senão
 * a assinatura não bate.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  const assinaturaRecebida = request.headers.get("x-autentique-signature");
  if (!secret || !assinaturaRecebida) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rawBody = await request.text();
  const assinaturaEsperada = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(assinaturaRecebida);
  const b = Buffer.from(assinaturaEsperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
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
