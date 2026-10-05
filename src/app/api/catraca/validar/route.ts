import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarPorAssociado, validarPorCodigo } from "@/lib/controle-acesso/validar";
import { chaveCatracaValida } from "@/lib/catraca/chave-api";

/**
 * Endpoint que a ponte da catraca chama (sem sessão de funcionário — por isso
 * usa o client com service role, não `createClient()`). Configure a mesma
 * chave em CATRACA_API_KEY e na ponte, enviada no header `x-api-key`. Mesma
 * regra de negócio da tela Controle de Acesso (src/lib/controle-acesso/validar.ts).
 *
 * Corpo esperado:
 * - QR Code lido na catraca: { "qrCode": "12345678901234" };
 * - rosto reconhecido no leitor facial: { "associadoNumero": "000042" }.
 * Resposta (sempre 200 quando a chave e o corpo estão corretos):
 * { "autorizado": true, "mensagem": "BEM VINDO", "nome": "..." } ou
 * { "autorizado": false, "mensagem": "INVALIDO", "motivo": "..." }.
 */
export async function POST(request: NextRequest) {
  if (!chaveCatracaValida(request)) {
    return NextResponse.json({ autorizado: false, mensagem: "INVALIDO" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const qrCode = typeof body?.qrCode === "string" ? body.qrCode : null;
  const associadoNumero = typeof body?.associadoNumero === "string" ? body.associadoNumero : null;
  if (!qrCode && !associadoNumero) {
    return NextResponse.json({ autorizado: false, mensagem: "INVALIDO" }, { status: 400 });
  }

  const admin = createAdminClient();
  const resultado = qrCode ? await validarPorCodigo(admin, qrCode) : await validarPorAssociado(admin, associadoNumero!);

  return NextResponse.json({
    autorizado: resultado.autorizado,
    mensagem: resultado.autorizado ? "BEM VINDO" : "INVALIDO",
    nome: resultado.titulo,
    motivo: resultado.motivo ?? null,
  });
}
