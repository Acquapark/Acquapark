import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { PortalShell } from "@/components/portal/PortalShell";
import { CredencialCard } from "@/components/portal/CredencialCard";

export default async function PortalCredencialPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const result = await getAssociadoById(supabase, ctx.associadoId);
  if (!result) redirect("/portal/login");

  const { associado, credencialCodigo } = result;

  return (
    <PortalShell associadoNome={associado.nome}>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Minha Credencial</h1>

      {credencialCodigo ? (
        <CredencialCard
          nome={associado.nome}
          numero={associado.numero}
          planoNome={associado.plano === "—" ? null : associado.plano}
          codigo={credencialCodigo}
          ativa={associado.status === "Ativo"}
        />
      ) : (
        <div className="rounded-[10px] border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-gray-700">Sua credencial ainda não foi gerada</p>
          <p className="mt-1 text-xs text-gray-500">Procure a recepção do Aqua Park para gerar sua credencial.</p>
        </div>
      )}
    </PortalShell>
  );
}
