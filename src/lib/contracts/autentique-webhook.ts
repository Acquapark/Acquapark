import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buscarDocumento } from "@/lib/signature/autentique";

/**
 * Acha o id do documento no payload real da Autentique (confirmado inspecionando
 * uma entrega real de "signature.viewed" — a doc oficial deles descreve um
 * formato diferente do que chega de verdade):
 * - eventos "signature.*": `event.data` É a assinatura, e `data.document` é o
 *   id do documento-pai como string simples (não um objeto aninhado).
 * - eventos "document.*": `event.data` É o documento, então `data.id` é o
 *   próprio id (nunca confirmado com um payload real, só por simetria).
 */
function extrairDocumentoId(data: Record<string, unknown>): string | null {
  if (typeof data.document === "string") return data.document;
  if (typeof data.id === "string") return data.id;
  return null;
}

/**
 * Processa um evento de webhook da Autentique. Idempotente: se o contrato já
 * não está mais "Enviado para assinatura", não faz nada (evita reprocessar
 * reentregas do mesmo evento).
 *
 * O webhook cadastrado no painel da Autentique está no grupo de eventos
 * "Assinatura", não "Documento" — por isso escutamos signature.accepted (o
 * associado sempre é o único signatário de verdade em cada contrato, então
 * "esse signatário aceitou" já equivale a "documento assinado") em vez de
 * depender só de document.finished, que pode nunca chegar com essa
 * configuração de webhook.
 */
export async function processarEventoAutentique(type: string, data: Record<string, unknown>) {
  if (type !== "document.finished" && type !== "signature.accepted" && type !== "signature.rejected") {
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

  // document.finished ou signature.accepted — busca o link do PDF assinado antes de marcar como Assinado.
  // Logo após o webhook, o PDF assinado pode ainda não estar pronto do lado da
  // Autentique — se `buscarDocumento` não trouxer o link ainda, guarda só o id
  // do documento; ele pode ser buscado depois sob demanda.
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
