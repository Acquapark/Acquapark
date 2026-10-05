import "server-only";
import { NextRequest } from "next/server";

/**
 * As rotas /api/catraca/* são chamadas pela ponte instalada no PC da catraca,
 * sem sessão de funcionário: a única autenticação é a chave enviada no header
 * `x-api-key`, igual à CATRACA_API_KEY do servidor.
 */
export function chaveCatracaValida(request: NextRequest): boolean {
  const chave = process.env.CATRACA_API_KEY;
  return !!chave && request.headers.get("x-api-key") === chave;
}
