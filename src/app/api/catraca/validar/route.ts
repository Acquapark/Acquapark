import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validarPorCodigo } from "@/lib/controle-acesso/validar";

/**
 * Endpoint que a catraca física chama direto (sem sessão de funcionário —
 * por isso usa o client com service role, não `createClient()`). Configure
 * a mesma chave em CATRACA_API_KEY e no equipamento, enviada no header
 * `x-api-key`. Mesma regra de negócio da tela Controle de Acesso
 * (`validarPorCodigo`, em src/lib/controle-acesso/validar.ts) — ingresso e
 * credencial de associado passam pelo mesmo código aqui.
 *
 * Corpo esperado: { "qrCode": "12345678901234" }.
 * Resposta (sempre 200 quando a chave e o corpo estão corretos):
 * { "autorizado": true, "mensagem": "BEM VINDO" } ou
 * { "autorizado": false, "mensagem": "INVALIDO" }.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!process.env.CATRACA_API_KEY || apiKey !== process.env.CATRACA_API_KEY) {
    return NextResponse.json({ autorizado: false, mensagem: "INVALIDO" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const qrCode = typeof body?.qrCode === "string" ? body.qrCode : null;
  if (!qrCode) {
    return NextResponse.json({ autorizado: false, mensagem: "INVALIDO" }, { status: 400 });
  }

  const admin = createAdminClient();
  const resultado = await validarPorCodigo(admin, qrCode);

  return NextResponse.json({
    autorizado: resultado.autorizado,
    mensagem: resultado.autorizado ? "BEM VINDO" : "INVALIDO",
  });
}
