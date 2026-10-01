import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getTermoVigente, termosPendentes } from "@/lib/termos";
import { PortalShell } from "@/components/portal/PortalShell";
import { AceiteTermosForm } from "./AceiteTermosForm";

export default async function PortalTermosPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const [result, termo, pendente] = await Promise.all([
    getAssociadoById(supabase, ctx.associadoId),
    getTermoVigente(supabase),
    termosPendentes(supabase, ctx.associadoId),
  ]);
  if (!result) redirect("/portal/login");
  // Nada a aceitar (sem termos publicados ou já aceitou a versão em vigor).
  if (!termo || !pendente) redirect("/portal");

  return (
    <PortalShell associadoNome={result.associado.nome}>
      <h1 className="text-lg font-semibold text-gray-900">Termos de Adesão</h1>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Para continuar usando o Portal, leia e aceite os termos de adesão do Aqua Park (versão {termo.versao}).
      </p>
      <AceiteTermosForm versaoId={termo.id} conteudo={termo.conteudo} />
    </PortalShell>
  );
}
