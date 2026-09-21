import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/supabase/portal";
import { getAssociadoById } from "@/lib/supabase/associados";
import { getContratoAtivo, getMensalidadesDoContrato } from "@/lib/supabase/contrato-associado";
import { PortalShell } from "@/components/portal/PortalShell";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Mensalidade } from "@/types";

const STATUS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  Pago: { label: "Pago", dot: "bg-success-600", text: "text-success-700" },
  Pendente: { label: "Em aberto", dot: "bg-warning-600", text: "text-warning-700" },
  Vencido: { label: "Vencido", dot: "bg-danger-600", text: "text-danger-700" },
  "Em processamento": { label: "Em processamento", dot: "bg-primary-600", text: "text-primary-700" },
  Cancelado: { label: "Cancelado", dot: "bg-gray-400", text: "text-gray-500" },
};

export default async function PortalInicioPage() {
  const supabase = await createClient();
  const ctx = await getPortalContext(supabase);
  if (!ctx) redirect("/portal/login");

  const result = await getAssociadoById(supabase, ctx.associadoId);
  if (!result) redirect("/portal/login");

  const contratoAtivo = await getContratoAtivo(supabase, ctx.associadoId);
  const mensalidades = contratoAtivo ? await getMensalidadesDoContrato(supabase, contratoAtivo.id) : [];

  const proxima = mensalidades
    .filter((m) => m.status !== "Pago" && m.status !== "Cancelado")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))[0] as Mensalidade | undefined;

  const style = proxima ? (STATUS_STYLE[proxima.status] ?? STATUS_STYLE.Pendente) : null;

  return (
    <PortalShell associadoNome={result.associado.nome}>
      <div className="space-y-4">
        {proxima ? (
          <div className="overflow-hidden rounded-[10px] border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <p className="text-xs font-medium text-gray-500">Próxima mensalidade</p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{formatCurrency(proxima.valor)}</p>
              <p className="mt-1 text-sm text-gray-500">Vencimento: {formatDate(proxima.vencimento)}</p>

              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs font-medium">
                <span className={`h-2 w-2 rounded-full ${style!.dot}`} />
                <span className={style!.text}>{style!.label}</span>
              </div>
            </div>

            <Link
              href="/portal/mensalidades"
              className="flex h-14 items-center justify-center gap-2 bg-primary-600 text-base font-semibold text-white active:bg-primary-700"
            >
              Pagar mensalidade
              <ArrowRight size={18} />
            </Link>
          </div>
        ) : (
          <div className="rounded-[10px] border border-gray-200 bg-white p-5 text-center shadow-sm">
            <Receipt size={28} className="mx-auto text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">Nenhuma mensalidade em aberto</p>
            <p className="mt-1 text-xs text-gray-500">Você está em dia com o Aqua Park.</p>
          </div>
        )}

        <Link
          href="/portal/mensalidades"
          className="flex items-center justify-between rounded-[10px] border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 shadow-sm"
        >
          Ver todas as mensalidades
          <ArrowRight size={16} className="text-gray-400" />
        </Link>

        <Link
          href="/portal/contrato"
          className="flex items-center justify-between rounded-[10px] border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-700 shadow-sm"
        >
          Ver meu contrato
          <ArrowRight size={16} className="text-gray-400" />
        </Link>
      </div>
    </PortalShell>
  );
}
