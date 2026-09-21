import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getContratoAtivo } from "@/lib/supabase/contrato-associado";
import { getContratosGeradosDoAssociado } from "@/lib/supabase/contratos";
import { PortalShell } from "@/components/portal/PortalShell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ContratoDocumentoViewer } from "@/components/portal/ContratoDocumentoViewer";

export default async function PortalContratoPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const result = await getAssociadoById(supabase, ctx.associadoId);
  if (!result) redirect("/portal/login");

  const [contratoAtivo, documentos] = await Promise.all([
    getContratoAtivo(supabase, ctx.associadoId),
    getContratosGeradosDoAssociado(supabase, ctx.associadoId),
  ]);
  const documentoMaisRecente = documentos[0] ?? null;

  return (
    <PortalShell associadoNome={result.associado.nome}>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Contrato</h1>

      {!contratoAtivo ? (
        <div className="rounded-[10px] border border-gray-200 bg-white p-6 text-center">
          <FileText size={28} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">Nenhum contrato ativo</p>
          <p className="mt-1 text-xs text-gray-500">Fale com a administração do parque para regularizar sua associação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">{contratoAtivo.planoNome}</p>
              <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-medium text-success-700">
                {contratoAtivo.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-400">Contrato {contratoAtivo.numero}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400">Início</p>
                <p className="font-medium text-gray-800">{formatDate(contratoAtivo.dataInicio)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Término</p>
                <p className="font-medium text-gray-800">{contratoAtivo.dataFim ? formatDate(contratoAtivo.dataFim) : "Indeterminado"}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Valor da mensalidade</p>
                <p className="font-medium text-gray-800">{formatCurrency(contratoAtivo.valor)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400">Mensalidades</p>
                <p className="font-medium text-gray-800">{contratoAtivo.quantidadeMensalidades}x</p>
              </div>
            </div>
          </div>

          <ContratoDocumentoViewer documento={documentoMaisRecente} />
        </div>
      )}
    </PortalShell>
  );
}
