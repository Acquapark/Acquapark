import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getContratoAtivo, getMensalidadesDoContrato } from "@/lib/supabase/contrato-associado";
import { PortalShell } from "@/components/portal/PortalShell";
import { MensalidadesList } from "@/components/portal/MensalidadesList";
import { gatewayReal } from "@/lib/gateway";

export default async function PortalMensalidadesPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const result = await getAssociadoById(supabase, ctx.associadoId);
  if (!result) redirect("/portal/login");

  const contratoAtivo = await getContratoAtivo(supabase, ctx.associadoId);
  const mensalidades = contratoAtivo ? await getMensalidadesDoContrato(supabase, contratoAtivo.id) : [];

  return (
    <PortalShell associadoNome={result.associado.nome}>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Mensalidades</h1>
      <MensalidadesList mensalidades={mensalidades} gatewayReal={gatewayReal} />
    </PortalShell>
  );
}
