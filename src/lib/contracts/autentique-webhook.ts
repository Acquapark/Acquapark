import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarDocumento } from "@/lib/signature/autentique";

/** Tenta achar o id do documento em qualquer um dos formatos que a Autentique manda, conforme o tipo de evento. */
function extrairDocumentoId(data: Record<string, unknown>): string | null {
  const objeto = data.object as Record<string, unknown> | undefined;
  if (!objeto) return null;
  if (typeof objeto.id === "string" && (data.type as string | undefined)?.startsWith("document.")) return objeto.id;
  const documento = objeto.document as Record<string, unknown> | undefined;
  if (documento && typeof documento.id === "string") return documento.id;
  if (typeof objeto.document_id === "string") return objeto.document_id;
  if (typeof objeto.id === "string") return objeto.id;
  return null;
}

/**
 * Processa um evento de webhook da Autentique. Idempotente: se o contrato já
 * não está mais "Enviado para assinatura", não faz nada (evita reprocessar
 * reentregas do mesmo evento).
 *
 * document.finished cobre tanto documento com 1 assinante (o caso de uso daqui)
 * quanto vários — dispara só quando todos já assinaram.
 */
export async function processarEventoAutentique(type: string, data: Record<string, unknown>) {
  if (type !== "document.finished" && type !== "signature.rejected") {
    return { success: true, ignorado: true };
  }

  const documentoId = extrairDocumentoId(data);
  if (!documentoId) return { error: "Não foi possível identificar o documento no payload do webhook." };

  const admin = createAdminClient();
  const { data: contrato } = await admin
    .from("contratos_gerados")
    .select("id, status")
    .eq("autentique_document_id", documentoId)
    .maybeSingle();

  if (!contrato) return { success: true, ignorado: true };
  if (contrato.status !== "Enviado para assinatura") return { success: true, jaProcessado: true };

  if (type === "signature.rejected") {
    const { error } = await admin.from("contratos_gerados").update({ status: "Recusado" }).eq("id", contrato.id);
    if (error) return { error: error.message };
    return { success: true };
  }

  // document.finished — busca o link do PDF assinado antes de marcar como Assinado.
  let documentoAssinadoUrl: string | null = null;
  try {
    const documento = await buscarDocumento(documentoId);
    documentoAssinadoUrl = documento?.files.signed ?? null;
  } catch (err) {
    console.error("[webhook autentique] falha ao buscar PDF assinado", documentoId, err);
  }

  const { error } = await admin
    .from("contratos_gerados")
    .update({ status: "Assinado", assinado_em: new Date().toISOString(), documento_assinado_url: documentoAssinadoUrl })
    .eq("id", contrato.id);
  if (error) return { error: error.message };
  return { success: true };
}
