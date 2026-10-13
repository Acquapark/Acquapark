import "server-only";

/**
 * Envio de e-mail pelo Resend (https://resend.com). Configure no servidor:
 * - RESEND_API_KEY: chave de API do Resend;
 * - EMAIL_REMETENTE: ex. "Acqua Park <ingressos@meuacquapark.com>" — o domínio
 *   precisa estar verificado no Resend.
 * Nunca lança: devolve o erro para quem chamou decidir (o e-mail é um extra;
 * o ingresso continua disponível no link do pedido).
 */
export async function enviarEmail(params: { para: string; assunto: string; html: string }): Promise<{ ok: true } | { error: string }> {
  const chave = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!chave || !remetente) return { error: "Envio de e-mail não configurado (RESEND_API_KEY / EMAIL_REMETENTE)." };

  try {
    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente, to: [params.para], subject: params.assunto, html: params.html }),
      signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      return { error: `Resend respondeu HTTP ${resposta.status}: ${corpo.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao enviar o e-mail." };
  }
}

/** Escapa texto vindo do usuário antes de pôr no HTML do e-mail. */
export function escaparHtml(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
