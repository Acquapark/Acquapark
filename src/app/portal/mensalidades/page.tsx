import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getContratoAtivo, getMensalidadesDoContrato } from "@/lib/supabase/contrato-associado";
import { PortalShell } from "@/components/portal/PortalShell";
import { MensalidadesList } from "@/components/portal/MensalidadesList";
import { gatewayReal } from "@/lib/gateway";
import { termosPendentes } from "@/lib/termos";

export default async function PortalMensalidadesPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const result = await getAssociadoById(supabase, ctx.associadoId);
  if (!result) redirect("/portal/login");

  // Pagar continua liberado com termos pendentes — só lembramos do aceite.
  const [contratoAtivo, pendente] = await Promise.all([
    getContratoAtivo(supabase, ctx.associadoId),
    termosPendentes(supabase, ctx.associadoId),
  ]);
  const mensalidades = contratoAtivo ? await getMensalidadesDoContrato(supabase, contratoAtivo.id) : [];

  return (
    <PortalShell associadoNome={result.associado.nome}>
      {pendente && (
        <Link
          href="/portal/termos"
          className="mb-4 block rounded-[10px] border border-warning-600/30 bg-warning-50 px-4 py-3 text-sm text-warning-700"
        >
          Você ainda precisa aceitar os <strong>Termos de Adesão</strong> para usar o restante do Portal. Toque aqui para ler.
        </Link>
      )}
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Mensalidades</h1>
      <MensalidadesList mensalidades={mensalidades} gatewayReal={gatewayReal} />
    </PortalShell>
  );
}
